-- ============================================================================
-- Migration: 20261026000001_phase11_announcements.sql
-- Description: Phase 11 — Institutional Announcements with Role-Aware Targeting
-- Authority: ARCHITECTURE.md §7, §9, §25; ARCHITECTURE-ADDENDUM-1.md §25
-- ============================================================================

-- 1. Table Constraints on announcements
DO $$
BEGIN
  -- Title length check: 1 to 200 chars, non-blank
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_announcements_title_length') THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT chk_announcements_title_length
      CHECK (length(trim(title)) > 0 AND length(title) <= 200);
  END IF;

  -- Body length check: 1 to 10000 chars, non-blank
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_announcements_body_length') THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT chk_announcements_body_length
      CHECK (length(trim(body)) > 0 AND length(body) <= 10000);
  END IF;

  -- Publication integrity: PUBLISHED status requires published_at timestamp
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_announcements_published_at_required') THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT chk_announcements_published_at_required
      CHECK (status != 'PUBLISHED' OR published_at IS NOT NULL);
  END IF;
END $$;

-- 2. Indexes for feed filtering and staff management
CREATE INDEX IF NOT EXISTS idx_announcements_feed_published
  ON public.announcements (audience, published_at DESC)
  WHERE status = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS idx_announcements_staff_mgmt
  ON public.announcements (created_at DESC, id DESC);

-- 3. Authoritative Canonical Visibility Predicate
-- Determines whether a given announcement row is visible to the authenticated caller
CREATE OR REPLACE FUNCTION public.can_view_announcement(
  p_audience     public.announcement_audience,
  p_status       public.announcement_status,
  p_published_at TIMESTAMPTZ,
  p_expires_at   TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      public.user_role;
  v_lifecycle public.student_lifecycle_status;
  v_is_active BOOLEAN;
  v_now       TIMESTAMPTZ := now();
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Only PUBLISHED announcements with a set published_at are visible to ordinary readers
  IF p_status != 'PUBLISHED' OR p_published_at IS NULL THEN
    RETURN false;
  END IF;

  -- Strict expiry boundary: expires_at must be strictly greater than DB current time
  IF p_expires_at IS NOT NULL AND p_expires_at <= v_now THEN
    RETURN false;
  END IF;

  -- Retrieve caller identity profile
  SELECT role, student_lifecycle_status, is_active
  INTO v_role, v_lifecycle, v_is_active
  FROM public.profiles
  WHERE id = v_uid;

  IF v_role IS NULL OR v_is_active IS NOT TRUE THEN
    RETURN false;
  END IF;

  -- Audience targeting evaluation
  IF p_audience = 'ALL' THEN
    -- Broadcast to all active authenticated accounts
    RETURN true;
  ELSIF p_audience = 'STUDENTS' THEN
    -- Strictly restricted to active enrolled students (not graduated, not alumni)
    RETURN v_role = 'STUDENT' AND v_lifecycle = 'STUDENT_ACTIVE';
  ELSIF p_audience = 'RECRUITERS' THEN
    -- Strictly active recruiters
    RETURN v_role = 'RECRUITER';
  ELSIF p_audience = 'STAFF' THEN
    -- All active staff members (Coordinators, Secretary, Super Admin)
    RETURN v_role IN ('TNP_COORDINATOR', 'TNP_SECRETARY', 'SUPER_ADMIN');
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_view_announcement(public.announcement_audience, public.announcement_status, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_announcement(public.announcement_audience, public.announcement_status, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- 4. Row Level Security Policies on announcements table
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements FORCE ROW LEVEL SECURITY;

-- Deny all direct INSERT, UPDATE, DELETE to client roles (managed strictly via SECURITY DEFINER procedures)
REVOKE INSERT, UPDATE, DELETE ON public.announcements FROM PUBLIC, anon, authenticated;

-- Drop any previous policies to ensure clean state
DROP POLICY IF EXISTS announcements_select_published ON public.announcements;
DROP POLICY IF EXISTS announcements_select_staff_management ON public.announcements;
DROP POLICY IF EXISTS anon_deny_announcements ON public.announcements;

-- Anonymous users cannot SELECT any announcements directly
CREATE POLICY anon_deny_announcements ON public.announcements
  FOR SELECT
  TO anon
  USING (false);

-- Authenticated users may read published announcements matching their audience that have not expired
CREATE POLICY announcements_select_published ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    public.can_view_announcement(audience, status, published_at, expires_at)
  );

-- Super Admin and TNP Secretary may view all announcements (DRAFT, PUBLISHED, ARCHIVED, expired) for administration
CREATE POLICY announcements_select_staff_management ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_staff() AND public.get_user_role() IN ('SUPER_ADMIN', 'TNP_SECRETARY')
  );

GRANT SELECT ON public.announcements TO authenticated;

-- 5. Privileged Operational Procedures

-- A. Create Announcement (Starts as DRAFT)
CREATE OR REPLACE FUNCTION public.create_announcement(
  p_title      TEXT,
  p_body       TEXT,
  p_audience   public.announcement_audience DEFAULT 'ALL',
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id  UUID := auth.uid();
  v_role      public.user_role := public.get_user_role();
  v_id        UUID;
  v_clean_title TEXT;
  v_clean_body  TEXT;
  v_now       TIMESTAMPTZ := now();
BEGIN
  -- Strict authority check: Super Admin or TNP Secretary only
  IF v_actor_id IS NULL OR NOT public.is_active_staff() OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin and TNP Secretary can create announcements'
      USING ERRCODE = '42501';
  END IF;

  v_clean_title := trim(p_title);
  v_clean_body  := trim(p_body);

  -- Input validations
  IF v_clean_title IS NULL OR length(v_clean_title) = 0 THEN
    RAISE EXCEPTION 'Announcement title cannot be empty'
      USING ERRCODE = '22023';
  END IF;

  IF length(v_clean_title) > 200 THEN
    RAISE EXCEPTION 'Announcement title cannot exceed 200 characters'
      USING ERRCODE = '22023';
  END IF;

  IF v_clean_body IS NULL OR length(v_clean_body) = 0 THEN
    RAISE EXCEPTION 'Announcement body cannot be empty'
      USING ERRCODE = '22023';
  END IF;

  IF length(v_clean_body) > 10000 THEN
    RAISE EXCEPTION 'Announcement body cannot exceed 10000 characters'
      USING ERRCODE = '22023';
  END IF;

  IF p_audience IS NULL THEN
    RAISE EXCEPTION 'Announcement audience must be specified'
      USING ERRCODE = '22023';
  END IF;

  IF p_expires_at IS NOT NULL AND p_expires_at <= v_now THEN
    RAISE EXCEPTION 'Expiry timestamp must be strictly in the future'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.announcements (
    title,
    body,
    audience,
    status,
    published_at,
    expires_at,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    v_clean_title,
    v_clean_body,
    p_audience,
    'DRAFT',
    NULL,
    p_expires_at,
    v_actor_id,
    v_now,
    v_now
  )
  RETURNING id INTO v_id;

  -- Audit log entry
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_actor_id,
    'ANNOUNCEMENT_CREATED',
    'announcements',
    v_id,
    jsonb_build_object(
      'announcement_id', v_id,
      'audience', p_audience,
      'status', 'DRAFT',
      'has_expiry', (p_expires_at IS NOT NULL)
    )
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_announcement(TEXT, TEXT, public.announcement_audience, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_announcement(TEXT, TEXT, public.announcement_audience, TIMESTAMPTZ) TO authenticated;

-- B. Update Draft Announcement
CREATE OR REPLACE FUNCTION public.update_draft_announcement(
  p_announcement_id UUID,
  p_title           TEXT,
  p_body            TEXT,
  p_audience        public.announcement_audience,
  p_expires_at      TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id    UUID := auth.uid();
  v_role        public.user_role := public.get_user_role();
  v_ann         public.announcements%ROWTYPE;
  v_clean_title TEXT;
  v_clean_body  TEXT;
  v_now         TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- Strict authority check: Super Admin or TNP Secretary only
  IF v_actor_id IS NULL OR NOT public.is_active_staff() OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin and TNP Secretary can update announcements'
      USING ERRCODE = '42501';
  END IF;

  -- Row lock to prevent concurrent publish or edit race conditions
  SELECT * INTO v_ann
  FROM public.announcements
  WHERE id = p_announcement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Announcement not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Immutability check: only DRAFT announcements may be updated
  IF v_ann.status != 'DRAFT' THEN
    RAISE EXCEPTION 'Only draft announcements can be edited. Published or archived announcements are immutable; archive and recreate to correct.'
      USING ERRCODE = '22023';
  END IF;

  v_clean_title := trim(p_title);
  v_clean_body  := trim(p_body);

  IF v_clean_title IS NULL OR length(v_clean_title) = 0 THEN
    RAISE EXCEPTION 'Announcement title cannot be empty'
      USING ERRCODE = '22023';
  END IF;

  IF length(v_clean_title) > 200 THEN
    RAISE EXCEPTION 'Announcement title cannot exceed 200 characters'
      USING ERRCODE = '22023';
  END IF;

  IF v_clean_body IS NULL OR length(v_clean_body) = 0 THEN
    RAISE EXCEPTION 'Announcement body cannot be empty'
      USING ERRCODE = '22023';
  END IF;

  IF length(v_clean_body) > 10000 THEN
    RAISE EXCEPTION 'Announcement body cannot exceed 10000 characters'
      USING ERRCODE = '22023';
  END IF;

  IF p_audience IS NULL THEN
    RAISE EXCEPTION 'Announcement audience must be specified'
      USING ERRCODE = '22023';
  END IF;

  IF p_expires_at IS NOT NULL AND p_expires_at <= v_now THEN
    RAISE EXCEPTION 'Expiry timestamp must be strictly in the future'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.announcements
  SET
    title = v_clean_title,
    body = v_clean_body,
    audience = p_audience,
    expires_at = p_expires_at,
    updated_at = v_now
  WHERE id = p_announcement_id;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_actor_id,
    'ANNOUNCEMENT_UPDATED',
    'announcements',
    p_announcement_id,
    jsonb_build_object(
      'announcement_id', p_announcement_id,
      'audience', p_audience,
      'has_expiry', (p_expires_at IS NOT NULL)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', p_announcement_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_draft_announcement(UUID, TEXT, TEXT, public.announcement_audience, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_draft_announcement(UUID, TEXT, TEXT, public.announcement_audience, TIMESTAMPTZ) TO authenticated;

-- C. Publish Announcement
CREATE OR REPLACE FUNCTION public.publish_announcement(
  p_announcement_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_role     public.user_role := public.get_user_role();
  v_ann      public.announcements%ROWTYPE;
  v_now      TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- Strict authority check: Super Admin or TNP Secretary only
  IF v_actor_id IS NULL OR NOT public.is_active_staff() OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin and TNP Secretary can publish announcements'
      USING ERRCODE = '42501';
  END IF;

  -- Row lock to serialize concurrent publish requests
  SELECT * INTO v_ann
  FROM public.announcements
  WHERE id = p_announcement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Announcement not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- State machine check: only DRAFT may transition to PUBLISHED
  IF v_ann.status != 'DRAFT' THEN
    RAISE EXCEPTION 'Only draft announcements can be published'
      USING ERRCODE = '22023';
  END IF;

  -- Publication integrity validations
  IF length(trim(v_ann.title)) = 0 THEN
    RAISE EXCEPTION 'Cannot publish announcement with empty title'
      USING ERRCODE = '22023';
  END IF;

  IF length(trim(v_ann.body)) = 0 THEN
    RAISE EXCEPTION 'Cannot publish announcement with empty body'
      USING ERRCODE = '22023';
  END IF;

  IF v_ann.expires_at IS NOT NULL AND v_ann.expires_at <= v_now THEN
    RAISE EXCEPTION 'Cannot publish announcement with past or current expiry timestamp'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.announcements
  SET
    status = 'PUBLISHED',
    published_at = v_now,
    updated_at = v_now
  WHERE id = p_announcement_id;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_actor_id,
    'ANNOUNCEMENT_PUBLISHED',
    'announcements',
    p_announcement_id,
    jsonb_build_object(
      'announcement_id', p_announcement_id,
      'audience', v_ann.audience,
      'old_status', 'DRAFT',
      'new_status', 'PUBLISHED',
      'published_at', v_now
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', p_announcement_id,
    'status', 'PUBLISHED',
    'published_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_announcement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_announcement(UUID) TO authenticated;

-- D. Archive Announcement
CREATE OR REPLACE FUNCTION public.archive_announcement(
  p_announcement_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_role     public.user_role := public.get_user_role();
  v_ann      public.announcements%ROWTYPE;
  v_now      TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- Strict authority check: Super Admin or TNP Secretary only
  IF v_actor_id IS NULL OR NOT public.is_active_staff() OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin and TNP Secretary can archive announcements'
      USING ERRCODE = '42501';
  END IF;

  -- Row lock
  SELECT * INTO v_ann
  FROM public.announcements
  WHERE id = p_announcement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Announcement not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency check: if already ARCHIVED, return deterministic success without timestamp modification
  IF v_ann.status = 'ARCHIVED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'id', p_announcement_id,
      'status', 'ARCHIVED',
      'already_archived', true
    );
  END IF;

  UPDATE public.announcements
  SET
    status = 'ARCHIVED',
    updated_at = v_now
  WHERE id = p_announcement_id;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_actor_id,
    'ANNOUNCEMENT_ARCHIVED',
    'announcements',
    p_announcement_id,
    jsonb_build_object(
      'announcement_id', p_announcement_id,
      'old_status', v_ann.status,
      'new_status', 'ARCHIVED'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', p_announcement_id,
    'status', 'ARCHIVED'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.archive_announcement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_announcement(UUID) TO authenticated;

-- 6. Read RPCs

-- A. get_my_announcements (Ordinary user feed)
CREATE OR REPLACE FUNCTION public.get_my_announcements(
  p_limit  INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id           UUID,
  title        TEXT,
  body         TEXT,
  audience     public.announcement_audience,
  published_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit  INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authentication required to view announcements'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.body,
    a.audience,
    a.published_at,
    a.expires_at
  FROM public.announcements a
  WHERE public.can_view_announcement(a.audience, a.status, a.published_at, a.expires_at)
  ORDER BY a.published_at DESC, a.id DESC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_announcements(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_announcements(INTEGER, INTEGER) TO authenticated;

-- B. get_staff_announcements (Management view for Super Admin and TNP Secretary)
CREATE OR REPLACE FUNCTION public.get_staff_announcements(
  p_status   public.announcement_status   DEFAULT NULL,
  p_audience public.announcement_audience DEFAULT NULL,
  p_limit    INTEGER DEFAULT 50,
  p_offset   INTEGER DEFAULT 0
)
RETURNS TABLE (
  id           UUID,
  title        TEXT,
  body         TEXT,
  audience     public.announcement_audience,
  status       public.announcement_status,
  created_by   UUID,
  creator_name TEXT,
  published_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_role     public.user_role := public.get_user_role();
  v_limit    INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 50);
  v_offset   INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  -- Strict authority check: Super Admin or TNP Secretary only
  IF v_actor_id IS NULL OR NOT public.is_active_staff() OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin and TNP Secretary can access announcement management'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.body,
    a.audience,
    a.status,
    a.created_by,
    COALESCE(p.display_name, 'Staff') AS creator_name,
    a.published_at,
    a.expires_at,
    a.created_at,
    a.updated_at
  FROM public.announcements a
  JOIN public.profiles p ON p.id = a.created_by
  WHERE (p_status IS NULL OR a.status = p_status)
    AND (p_audience IS NULL OR a.audience = p_audience)
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_announcements(public.announcement_status, public.announcement_audience, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_announcements(public.announcement_status, public.announcement_audience, INTEGER, INTEGER) TO authenticated;
