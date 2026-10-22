-- Migration 17: Phase 9 Public Batch Showcase
-- Implements privacy-safe public student talent directory, narrow public RPCs,
-- anonymous RLS deny policies, student privacy controls, and staff public audit view.

-- ============================================================================
-- 1. Explicit Anonymous RLS Deny Policies
-- ============================================================================

-- A. student_profiles: no anonymous SELECT
GRANT SELECT ON public.student_profiles TO anon;
DROP POLICY IF EXISTS anon_deny_student_profiles ON public.student_profiles;
CREATE POLICY anon_deny_student_profiles ON public.student_profiles
  FOR SELECT TO anon
  USING (false);

-- B. academic_records: no anonymous SELECT
GRANT SELECT ON public.academic_records TO anon;
DROP POLICY IF EXISTS anon_deny_academic_records ON public.academic_records;
CREATE POLICY anon_deny_academic_records ON public.academic_records
  FOR SELECT TO anon
  USING (false);

-- C. student_roster: no anonymous SELECT
GRANT SELECT ON public.student_roster TO anon;
DROP POLICY IF EXISTS anon_deny_student_roster ON public.student_roster;
CREATE POLICY anon_deny_student_roster ON public.student_roster
  FOR SELECT TO anon
  USING (false);

-- D. documents: no anonymous SELECT
GRANT SELECT ON public.documents TO anon;
DROP POLICY IF EXISTS anon_deny_documents ON public.documents;
CREATE POLICY anon_deny_documents ON public.documents
  FOR SELECT TO anon
  USING (false);

-- E. student_skills: no anonymous SELECT
GRANT SELECT ON public.student_skills TO anon;
DROP POLICY IF EXISTS anon_deny_student_skills ON public.student_skills;
CREATE POLICY anon_deny_student_skills ON public.student_skills
  FOR SELECT TO anon
  USING (false);

-- F. student_skill_evidence: no anonymous SELECT
GRANT SELECT ON public.student_skill_evidence TO anon;
DROP POLICY IF EXISTS anon_deny_student_skill_evidence ON public.student_skill_evidence;
CREATE POLICY anon_deny_student_skill_evidence ON public.student_skill_evidence
  FOR SELECT TO anon
  USING (false);

-- G. audit_logs: no anonymous SELECT (strictly revoked)
REVOKE ALL ON public.audit_logs FROM PUBLIC, anon;

-- H. profiles: no anonymous SELECT
GRANT SELECT ON public.profiles TO anon;
DROP POLICY IF EXISTS anon_deny_profiles ON public.profiles;
CREATE POLICY anon_deny_profiles ON public.profiles
  FOR SELECT TO anon
  USING (false);

-- ============================================================================
-- 1.5 Shared Canonical Public Visibility & Storage Helpers
-- ============================================================================

-- Canonical single-source-of-truth public student visibility predicate
CREATE OR REPLACE FUNCTION public._is_student_publicly_eligible(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM student_profiles sp
    JOIN profiles p ON p.id = sp.profile_id
    JOIN academic_records ar ON ar.profile_id = sp.profile_id
    WHERE sp.profile_id = p_profile_id
      AND sp.public_profile_enabled = true
      AND sp.public_profile_slug IS NOT NULL
      AND p.is_active = true
      AND p.role = 'STUDENT'
      AND p.student_lifecycle_status IN ('STUDENT_ACTIVE', 'STUDENT_GRADUATED')
      AND ar.verification_status = 'VERIFIED'
  );
$$;

REVOKE ALL ON FUNCTION public._is_student_publicly_eligible(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._is_student_publicly_eligible(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._is_student_publicly_eligible(UUID) TO service_role;

-- Canonical avatar storage path resolver (used server-side by /api/public/avatar/[slug])
CREATE OR REPLACE FUNCTION public._get_public_avatar_storage_path(p_slug TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_cleaned_slug TEXT := lower(trim(p_slug));
  v_profile_id   UUID;
  v_photo_path   TEXT;
BEGIN
  IF v_cleaned_slug IS NULL OR v_cleaned_slug = '' OR v_cleaned_slug !~ '^[a-z0-9][a-z0-9\-]{2,62}$' THEN
    RETURN NULL;
  END IF;

  SELECT sp.profile_id, sp.profile_photo_path
    INTO v_profile_id, v_photo_path
  FROM student_profiles sp
  WHERE sp.public_profile_slug = v_cleaned_slug;

  IF v_profile_id IS NULL OR NOT public._is_student_publicly_eligible(v_profile_id) THEN
    RETURN NULL;
  END IF;

  -- Profile photo must be registered and path must reside strictly in student folder
  IF v_photo_path IS NULL OR length(trim(v_photo_path)) = 0 THEN
    RETURN NULL;
  END IF;

  IF (storage.foldername(v_photo_path))[1] != v_profile_id::text THEN
    RETURN NULL;
  END IF;

  RETURN v_photo_path;
END;
$$;

REVOKE ALL ON FUNCTION public._get_public_avatar_storage_path(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._get_public_avatar_storage_path(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._get_public_avatar_storage_path(TEXT) TO service_role;

-- ============================================================================
-- 2. Public Profile RPC: get_public_student_profile
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_public_student_profile(p_slug TEXT)
RETURNS TABLE (
  slug                TEXT,
  name                TEXT,
  program_code        TEXT,
  program_name        TEXT,
  graduation_batch    TEXT,
  headline            TEXT,
  tagline             TEXT,
  has_photo           BOOLEAN,
  linkedin_url        TEXT,
  portfolio_url       TEXT,
  portfolio_available BOOLEAN,
  resume_available    BOOLEAN,
  verified_skills     JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cleaned_slug TEXT := lower(trim(p_slug));
BEGIN
  -- Strict slug parameter validation
  IF v_cleaned_slug IS NULL OR v_cleaned_slug = '' OR v_cleaned_slug !~ '^[a-z0-9][a-z0-9\-]{2,62}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    sp.public_profile_slug AS slug,
    p.display_name AS name,
    ap.code AS program_code,
    ap.display_name AS program_name,
    ar.batch AS graduation_batch,
    sp.public_headline AS headline,
    sp.public_tagline AS tagline,
    (sp.profile_photo_path IS NOT NULL) AS has_photo,
    sp.linkedin_url AS linkedin_url,
    CASE WHEN sp.public_portfolio_enabled = true THEN sp.portfolio_url ELSE NULL END AS portfolio_url,
    sp.public_portfolio_enabled AS portfolio_available,
    sp.public_resume_enabled AS resume_available,
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object('name', sk.name, 'category', sk.category::text)
          ORDER BY sk.name ASC
        ),
        '[]'::jsonb
      )
      FROM student_skills ss
      JOIN skills sk ON sk.id = ss.skill_id
      WHERE ss.student_id = p.id
        AND ss.is_active = true
        AND ss.verification_status = 'VERIFIED'
        AND sk.is_active = true
    ) AS verified_skills
  FROM student_profiles sp
  JOIN profiles p ON p.id = sp.profile_id
  JOIN academic_records ar ON ar.profile_id = sp.profile_id
  JOIN academic_programs ap ON ap.id = ar.program_id
  WHERE sp.public_profile_slug = v_cleaned_slug
    AND public._is_student_publicly_eligible(sp.profile_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_student_profile(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_student_profile(TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- 3. Public Batch Directory RPC: get_public_batch_page
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_public_batch_page(
  p_batch             TEXT,
  p_program_code      TEXT DEFAULT NULL,
  p_skill             TEXT DEFAULT NULL,
  p_has_portfolio     BOOLEAN DEFAULT NULL,
  p_search            TEXT DEFAULT NULL,
  p_limit             INTEGER DEFAULT 20,
  p_offset            INTEGER DEFAULT 0
)
RETURNS TABLE (
  slug                TEXT,
  name                TEXT,
  program_code        TEXT,
  program_name        TEXT,
  graduation_batch    TEXT,
  headline            TEXT,
  tagline             TEXT,
  has_photo           BOOLEAN,
  portfolio_available BOOLEAN,
  portfolio_url       TEXT,
  resume_available    BOOLEAN,
  top_skills          JSONB,
  total_count         BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit INTEGER;
  v_offset INTEGER;
  v_batch TEXT := trim(p_batch);
  v_prog_code TEXT := upper(trim(p_program_code));
  v_skill TEXT := trim(p_skill);
  v_search TEXT := trim(p_search);
BEGIN
  -- Strict limit clamping: between 1 and 24
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 24);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  IF v_batch IS NULL OR v_batch = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      sp.public_profile_slug AS f_slug,
      p.display_name AS f_name,
      ap.code AS f_program_code,
      ap.display_name AS f_program_name,
      ar.batch AS f_graduation_batch,
      sp.public_headline AS f_headline,
      sp.public_tagline AS f_tagline,
      (sp.profile_photo_path IS NOT NULL) AS f_has_photo,
      sp.public_portfolio_enabled AS f_portfolio_available,
      CASE WHEN sp.public_portfolio_enabled = true THEN sp.portfolio_url ELSE NULL END AS f_portfolio_url,
      sp.public_resume_enabled AS f_resume_available,
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object('name', sk.name, 'category', sk.category::text)
            ORDER BY sk.name ASC
          ),
          '[]'::jsonb
        )
        FROM (
          SELECT sk_inner.name, sk_inner.category
          FROM student_skills ss_inner
          JOIN skills sk_inner ON sk_inner.id = ss_inner.skill_id
          WHERE ss_inner.student_id = p.id
            AND ss_inner.is_active = true
            AND ss_inner.verification_status = 'VERIFIED'
            AND sk_inner.is_active = true
          ORDER BY sk_inner.name ASC
          LIMIT 5
        ) sk
      ) AS f_top_skills,
      COUNT(*) OVER() AS f_total_count
    FROM student_profiles sp
    JOIN profiles p ON p.id = sp.profile_id
    JOIN academic_records ar ON ar.profile_id = sp.profile_id
    JOIN academic_programs ap ON ap.id = ar.program_id
    WHERE public._is_student_publicly_eligible(sp.profile_id)
      AND ar.batch = v_batch
      AND (v_prog_code IS NULL OR v_prog_code = '' OR ap.code = v_prog_code)
      AND (p_has_portfolio IS NULL OR p_has_portfolio = false OR (sp.public_portfolio_enabled = true AND sp.portfolio_url IS NOT NULL))
      AND (v_search IS NULL OR v_search = '' OR p.display_name ILIKE '%' || v_search || '%')
      AND (
        v_skill IS NULL OR v_skill = '' OR EXISTS (
          SELECT 1 FROM student_skills ss_check
          JOIN skills sk_check ON sk_check.id = ss_check.skill_id
          WHERE ss_check.student_id = p.id
            AND ss_check.is_active = true
            AND ss_check.verification_status = 'VERIFIED'
            AND sk_check.is_active = true
            AND (sk_check.name ILIKE '%' || v_skill || '%' OR sk_check.category::text ILIKE '%' || v_skill || '%')
        )
      )
  )
  SELECT
    f.f_slug,
    f.f_name,
    f.f_program_code,
    f.f_program_name,
    f.f_graduation_batch,
    f.f_headline,
    f.f_tagline,
    f.f_has_photo,
    f.f_portfolio_available,
    f.f_portfolio_url,
    f.f_resume_available,
    f.f_top_skills,
    f.f_total_count
  FROM filtered f
  ORDER BY f.f_name ASC, f.f_slug ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_batch_page(TEXT, TEXT, TEXT, BOOLEAN, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_batch_page(TEXT, TEXT, TEXT, BOOLEAN, TEXT, INTEGER, INTEGER) TO anon, authenticated, service_role;

-- ============================================================================
-- 4. Public Batches Summary RPC: get_public_batches
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_public_batches()
RETURNS TABLE (
  batch               TEXT,
  program_code        TEXT,
  program_name        TEXT,
  student_count       BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.batch,
    ap.code AS program_code,
    ap.display_name AS program_name,
    COUNT(sp.profile_id) AS student_count
  FROM student_profiles sp
  JOIN profiles p ON p.id = sp.profile_id
  JOIN academic_records ar ON ar.profile_id = sp.profile_id
  JOIN academic_programs ap ON ap.id = ar.program_id
  WHERE public._is_student_publicly_eligible(sp.profile_id)
  GROUP BY ar.batch, ap.code, ap.display_name
  ORDER BY ar.batch DESC, ap.display_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_batches() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_batches() TO anon, authenticated, service_role;

-- ============================================================================
-- 5. Student Privacy Settings Mutation Procedure
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_own_public_profile_settings(
  p_public_profile_enabled   BOOLEAN,
  p_public_resume_enabled    BOOLEAN,
  p_public_portfolio_enabled BOOLEAN,
  p_public_profile_slug      TEXT DEFAULT NULL,
  p_public_headline          TEXT DEFAULT NULL,
  p_public_tagline           TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_current_slug TEXT;
  v_clean_slug TEXT;
  v_clean_headline TEXT;
  v_clean_tagline TEXT;
BEGIN
  -- Strict identity & active student status check
  IF v_student_id IS NULL OR NOT is_active_student() THEN
    RAISE EXCEPTION 'Unauthorized: Only an active student can update public profile settings';
  END IF;

  -- Read current slug and settings
  SELECT public_profile_slug
  INTO v_current_slug
  FROM student_profiles
  WHERE profile_id = v_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student profile not found';
  END IF;

  -- Clean inputs
  v_clean_slug := lower(NULLIF(trim(p_public_profile_slug), ''));
  v_clean_headline := NULLIF(trim(p_public_headline), '');
  v_clean_tagline := NULLIF(trim(p_public_tagline), '');

  -- Headline & tagline length validations
  IF v_clean_headline IS NOT NULL AND length(v_clean_headline) > 120 THEN
    RAISE EXCEPTION 'Headline cannot exceed 120 characters';
  END IF;

  IF v_clean_tagline IS NOT NULL AND length(v_clean_tagline) > 200 THEN
    RAISE EXCEPTION 'Tagline cannot exceed 200 characters';
  END IF;

  -- Slug immutability rule (A1-Q4): slug is immutable once assigned during normal student use
  IF v_current_slug IS NOT NULL AND v_clean_slug IS NOT NULL AND v_current_slug != v_clean_slug THEN
    RAISE EXCEPTION 'Public profile slug cannot be changed once assigned';
  END IF;

  -- Initial slug validation if setting slug for the first time
  IF v_current_slug IS NULL AND v_clean_slug IS NOT NULL THEN
    IF v_clean_slug !~ '^[a-z0-9][a-z0-9\-]{2,62}$' THEN
      RAISE EXCEPTION 'Invalid slug format: must be 3-63 lowercase alphanumeric characters or hyphens, starting with a letter or digit';
    END IF;

    -- Uniqueness check
    IF EXISTS (
      SELECT 1 FROM student_profiles
      WHERE public_profile_slug = v_clean_slug
        AND profile_id != v_student_id
    ) THEN
      RAISE EXCEPTION 'Slug is already claimed by another student';
    END IF;
  END IF;

  -- Final effective slug
  v_clean_slug := COALESCE(v_current_slug, v_clean_slug);

  -- Opt-in requirement: cannot enable public profile without a valid slug
  IF p_public_profile_enabled = true AND v_clean_slug IS NULL THEN
    RAISE EXCEPTION 'Cannot enable public profile without specifying a valid slug';
  END IF;

  -- Atomically update public settings
  UPDATE student_profiles
  SET public_profile_enabled = p_public_profile_enabled,
      public_resume_enabled = p_public_resume_enabled,
      public_portfolio_enabled = p_public_portfolio_enabled,
      public_profile_slug = v_clean_slug,
      public_headline = v_clean_headline,
      public_tagline = v_clean_tagline,
      updated_at = clock_timestamp()
  WHERE profile_id = v_student_id;

  RETURN jsonb_build_object(
    'success', true,
    'public_profile_enabled', p_public_profile_enabled,
    'public_profile_slug', v_clean_slug,
    'public_resume_enabled', p_public_resume_enabled,
    'public_portfolio_enabled', p_public_portfolio_enabled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_public_profile_settings(BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_public_profile_settings(BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ============================================================================
-- 6. Super Admin Slug Recovery Procedure (A1-Q4)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_reassign_profile_slug(
  p_target_student_id UUID,
  p_new_slug           TEXT,
  p_reason             TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_clean_slug TEXT := lower(trim(p_new_slug));
  v_old_slug TEXT;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden: only Super Admins can reassign public profile slugs';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is strictly required for slug reassignment';
  END IF;

  IF v_clean_slug IS NULL OR v_clean_slug !~ '^[a-z0-9][a-z0-9\-]{2,62}$' THEN
    RAISE EXCEPTION 'Invalid slug format: must be 3-63 lowercase alphanumeric characters or hyphens, starting with a letter or digit';
  END IF;

  SELECT public_profile_slug INTO v_old_slug
  FROM student_profiles
  WHERE profile_id = p_target_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target student profile not found';
  END IF;

  -- Check uniqueness
  IF EXISTS (
    SELECT 1 FROM student_profiles
    WHERE public_profile_slug = v_clean_slug
      AND profile_id != p_target_student_id
  ) THEN
    RAISE EXCEPTION 'Slug is already claimed by another student';
  END IF;

  UPDATE student_profiles
  SET public_profile_slug = v_clean_slug,
      updated_at = clock_timestamp()
  WHERE profile_id = p_target_student_id;

  -- Record audit log
  INSERT INTO audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_caller_id,
    'PROFILE_SLUG_REASSIGNED',
    'student_profiles',
    p_target_student_id,
    jsonb_build_object(
      'old_slug', v_old_slug,
      'new_slug', v_clean_slug,
      'reason', trim(p_reason)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_slug', v_old_slug,
    'new_slug', v_clean_slug
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reassign_profile_slug(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reassign_profile_slug(UUID, TEXT, TEXT) TO authenticated, service_role;

-- ============================================================================
-- 7. Staff Public Visibility Audit View
-- ============================================================================

CREATE OR REPLACE VIEW public.v_staff_student_public_profiles
WITH (security_invoker = true)
AS
SELECT
  p.id AS student_id,
  p.display_name AS student_name,
  sr.institutional_email AS student_email,
  ap.code AS program_code,
  ap.display_name AS program_name,
  ar.batch,
  p.student_lifecycle_status,
  sp.public_profile_enabled,
  sp.public_profile_slug,
  sp.public_resume_enabled,
  sp.public_portfolio_enabled,
  (sp.profile_photo_path IS NOT NULL) AS has_photo,
  sp.public_headline,
  sp.public_tagline,
  sp.portfolio_url
FROM student_profiles sp
JOIN profiles p ON p.id = sp.profile_id
JOIN academic_records ar ON ar.profile_id = sp.profile_id
JOIN academic_programs ap ON ap.id = ar.program_id
LEFT JOIN student_roster sr ON sr.claimed_by = p.id
WHERE can_access_student(p.id);

REVOKE ALL ON public.v_staff_student_public_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.v_staff_student_public_profiles TO authenticated, service_role;
