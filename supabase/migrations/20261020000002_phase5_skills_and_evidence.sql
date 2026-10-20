-- Migration 13: Phase 5 Skills Catalog, Student Skill Claims, Evidence & Verification
-- TNP Portal: Skills Workflow & Verification

-- ============================================================================
-- 1. Private Storage Bucket Configuration for Skill Evidence
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('skill-evidence', 'skill-evidence', false, 5242880, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 2. Storage Helpers & Row-Level Security Policies for Skill Evidence
-- ============================================================================

-- Helper: Authorizes staff to read a skill evidence object ONLY IF:
-- 1. The object is registered in public.student_skill_evidence
-- 2. The evidence_type is 'PDF_DOCUMENT'
-- 3. The folder matches the student_id
-- 4. The caller has staff access to that student via can_access_student()
-- Unregistered orphan blobs cannot be read by staff even if placed in an in-scope student folder.
CREATE OR REPLACE FUNCTION can_staff_access_skill_evidence(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_skill_evidence sse
    JOIN public.student_skills ss ON ss.id = sse.student_skill_id
    WHERE sse.storage_path = p_object_name
      AND sse.evidence_type = 'PDF_DOCUMENT'
      AND (storage.foldername(p_object_name))[1] = ss.student_id::text
      AND public.can_access_student(ss.student_id)
  );
$$;

REVOKE ALL ON FUNCTION can_staff_access_skill_evidence(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_staff_access_skill_evidence(TEXT) TO authenticated;

-- Helper: Authorizes student to read their own registered skill evidence object
CREATE OR REPLACE FUNCTION can_student_access_own_skill_evidence(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_skill_evidence sse
    JOIN public.student_skills ss ON ss.id = sse.student_skill_id
    WHERE sse.storage_path = p_object_name
      AND sse.evidence_type = 'PDF_DOCUMENT'
      AND ss.student_id = auth.uid()
      AND (storage.foldername(p_object_name))[1] = auth.uid()::text
  );
$$;

REVOKE ALL ON FUNCTION can_student_access_own_skill_evidence(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_student_access_own_skill_evidence(TEXT) TO authenticated;

-- Storage Policies on storage.objects for skill-evidence:
-- Direct raw INSERT and DELETE are strictly DENIED to all ordinary users (including students).
-- Uploads flow through trusted server actions with binary magic byte inspection and admin client upload.
CREATE POLICY skill_evidence_select_own ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'skill-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND can_student_access_own_skill_evidence(name)
  );

CREATE POLICY skill_evidence_select_staff ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'skill-evidence'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND can_staff_access_skill_evidence(name)
  );

-- ============================================================================
-- 3. RLS Policies on Skills, Student Skills & Evidence Tables
-- ============================================================================

-- A. skills: Active catalog viewable only by students and staff; recruiters and anon receive zero rows
CREATE POLICY skills_select_policy ON skills
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND (
          p.role IN ('SUPER_ADMIN', 'TNP_SECRETARY', 'TNP_COORDINATOR')
          OR (p.role = 'STUDENT' AND skills.is_active = true)
        )
    )
  );

REVOKE INSERT, UPDATE, DELETE ON skills FROM PUBLIC, anon, authenticated;
GRANT SELECT ON skills TO authenticated;

-- B. student_skills: Student can view own; Staff can view within scope
CREATE POLICY student_skills_select_own ON student_skills
  FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY student_skills_select_staff ON student_skills
  FOR SELECT
  USING (can_access_student(student_id));

REVOKE INSERT, UPDATE, DELETE ON student_skills FROM PUBLIC, anon, authenticated;
GRANT SELECT ON student_skills TO authenticated;

-- C. student_skill_evidence: Student can view own evidence; Staff can view within scope
CREATE POLICY student_skill_evidence_select_own ON student_skill_evidence
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_skills ss
      WHERE ss.id = student_skill_evidence.student_skill_id
        AND ss.student_id = auth.uid()
    )
  );

CREATE POLICY student_skill_evidence_select_staff ON student_skill_evidence
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_skills ss
      WHERE ss.id = student_skill_evidence.student_skill_id
        AND can_access_student(ss.student_id)
    )
  );

REVOKE INSERT, UPDATE, DELETE ON student_skill_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT ON student_skill_evidence TO authenticated;

-- Database-level uniqueness guarantee: exactly one evidence row per student_skill_id
CREATE OR REPLACE FUNCTION enforce_single_evidence_per_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM student_skill_evidence
  WHERE student_skill_id = NEW.student_skill_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_evidence_per_claim ON student_skill_evidence;
CREATE TRIGGER trg_single_evidence_per_claim
  BEFORE INSERT ON student_skill_evidence
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_evidence_per_claim();

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_skill_evidence_claim
  ON public.student_skill_evidence(student_skill_id);

-- ============================================================================
-- 4. Skills Catalog Management Procedures (Super Admin & Secretary Only)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_skill(
  p_name        TEXT,
  p_category    TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id   UUID := auth.uid();
  v_role       user_role;
  v_clean_name TEXT;
  v_clean_cat  TEXT;
  v_clean_desc TEXT;
  v_skill_id   UUID;
BEGIN
  -- Permission check: Super Admin or TNP Secretary only
  SELECT role INTO v_role FROM profiles WHERE id = v_actor_id AND is_active = true;
  IF v_role IS NULL OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can create skills';
  END IF;

  v_clean_name := NULLIF(trim(p_name), '');
  IF v_clean_name IS NULL THEN
    RAISE EXCEPTION 'Skill name cannot be empty';
  END IF;

  IF length(v_clean_name) > 100 THEN
    RAISE EXCEPTION 'Skill name cannot exceed 100 characters';
  END IF;

  v_clean_cat := NULLIF(trim(p_category), '');
  IF v_clean_cat IS NOT NULL AND length(v_clean_cat) > 100 THEN
    RAISE EXCEPTION 'Category cannot exceed 100 characters';
  END IF;

  v_clean_desc := NULLIF(trim(p_description), '');
  IF v_clean_desc IS NOT NULL AND length(v_clean_desc) > 500 THEN
    RAISE EXCEPTION 'Description cannot exceed 500 characters';
  END IF;

  -- Insert skill (unique constraint on name enforced at DB level)
  INSERT INTO skills (name, category, description, created_by, is_active)
  VALUES (v_clean_name, v_clean_cat, v_clean_desc, v_actor_id, true)
  RETURNING id INTO v_skill_id;

  -- Audit log entry
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'SKILL_CREATED',
    'skill',
    v_skill_id,
    jsonb_build_object('name', v_clean_name, 'category', v_clean_cat)
  );

  RETURN jsonb_build_object(
    'success', true,
    'skill_id', v_skill_id,
    'name', v_clean_name
  );
END;
$$;

REVOKE ALL ON FUNCTION create_skill(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_skill(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION update_skill(
  p_skill_id    UUID,
  p_name        TEXT,
  p_category    TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id   UUID := auth.uid();
  v_role       user_role;
  v_clean_name TEXT;
  v_clean_cat  TEXT;
  v_clean_desc TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = v_actor_id AND is_active = true;
  IF v_role IS NULL OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can update skills';
  END IF;

  v_clean_name := NULLIF(trim(p_name), '');
  IF v_clean_name IS NULL THEN
    RAISE EXCEPTION 'Skill name cannot be empty';
  END IF;

  IF length(v_clean_name) > 100 THEN
    RAISE EXCEPTION 'Skill name cannot exceed 100 characters';
  END IF;

  v_clean_cat := NULLIF(trim(p_category), '');
  IF v_clean_cat IS NOT NULL AND length(v_clean_cat) > 100 THEN
    RAISE EXCEPTION 'Category cannot exceed 100 characters';
  END IF;

  v_clean_desc := NULLIF(trim(p_description), '');
  IF v_clean_desc IS NOT NULL AND length(v_clean_desc) > 500 THEN
    RAISE EXCEPTION 'Description cannot exceed 500 characters';
  END IF;

  UPDATE skills
  SET name = v_clean_name,
      category = v_clean_cat,
      description = v_clean_desc,
      updated_at = now()
  WHERE id = p_skill_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill not found';
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'SKILL_UPDATED',
    'skill',
    p_skill_id,
    jsonb_build_object('name', v_clean_name, 'category', v_clean_cat)
  );

  RETURN jsonb_build_object('success', true, 'skill_id', p_skill_id);
END;
$$;

REVOKE ALL ON FUNCTION update_skill(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_skill(UUID, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION deactivate_skill(p_skill_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_role     user_role;
  v_skill    skills%ROWTYPE;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = v_actor_id AND is_active = true;
  IF v_role IS NULL OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can deactivate skills';
  END IF;

  SELECT * INTO v_skill FROM skills WHERE id = p_skill_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill not found';
  END IF;

  -- Deactivate skill (existing historical claims are preserved)
  UPDATE skills
  SET is_active = false,
      updated_at = now()
  WHERE id = p_skill_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'SKILL_DEACTIVATED',
    'skill',
    p_skill_id,
    jsonb_build_object('name', v_skill.name)
  );

  RETURN jsonb_build_object('success', true, 'skill_id', p_skill_id, 'is_active', false);
END;
$$;

REVOKE ALL ON FUNCTION deactivate_skill(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION deactivate_skill(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION reactivate_skill(p_skill_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_role     user_role;
  v_skill    skills%ROWTYPE;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = v_actor_id AND is_active = true;
  IF v_role IS NULL OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can reactivate skills';
  END IF;

  SELECT * INTO v_skill FROM skills WHERE id = p_skill_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill not found';
  END IF;

  UPDATE skills
  SET is_active = true,
      updated_at = now()
  WHERE id = p_skill_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'SKILL_REACTIVATED',
    'skill',
    p_skill_id,
    jsonb_build_object('name', v_skill.name)
  );

  RETURN jsonb_build_object('success', true, 'skill_id', p_skill_id, 'is_active', true);
END;
$$;

REVOKE ALL ON FUNCTION reactivate_skill(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reactivate_skill(UUID) TO authenticated;

-- ============================================================================
-- 5. Student Skill Claims Procedures (Active Student Only)
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_student_skill(
  p_skill_id          UUID,
  p_proficiency_level INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_skill      skills%ROWTYPE;
  v_existing   student_skills%ROWTYPE;
  v_new_id     UUID;
BEGIN
  -- Strict identity & active student status check
  IF v_student_id IS NULL OR NOT is_active_student() THEN
    RAISE EXCEPTION 'Unauthorized: Only active students can claim skills';
  END IF;

  IF get_my_lifecycle() != 'STUDENT_ACTIVE' THEN
    RAISE EXCEPTION 'Unauthorized: Only currently active enrolled students can claim skills';
  END IF;

  -- Proficiency bounds check
  IF p_proficiency_level IS NULL OR p_proficiency_level < 1 OR p_proficiency_level > 4 THEN
    RAISE EXCEPTION 'Proficiency level must be an integer between 1 and 4';
  END IF;

  -- Skill existence & active state check
  SELECT * INTO v_skill FROM skills WHERE id = p_skill_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill not found';
  END IF;

  IF NOT v_skill.is_active THEN
    RAISE EXCEPTION 'Cannot claim an inactive skill';
  END IF;

  -- Check existing claim for this (student_id, skill_id)
  SELECT * INTO v_existing
  FROM student_skills
  WHERE student_id = v_student_id AND skill_id = p_skill_id;

  IF FOUND THEN
    IF v_existing.is_active THEN
      RAISE EXCEPTION 'Skill already claimed by student';
    ELSE
      -- Reactivate previously archived claim (trigger trg_check_skill_cap enforces 15 cap)
      IF v_existing.verification_status = 'VERIFIED' THEN
        -- If previously verified, student CANNOT alter proficiency level upon reactivation
        IF v_existing.proficiency_level != p_proficiency_level THEN
          RAISE EXCEPTION 'Cannot modify proficiency of a verified skill claim';
        END IF;

        -- Reactivate preserving VERIFIED state and verifier metadata
        UPDATE student_skills
        SET is_active = true,
            updated_at = now()
        WHERE id = v_existing.id
        RETURNING id INTO v_new_id;

        RETURN jsonb_build_object(
          'success', true,
          'student_skill_id', v_new_id,
          'reactivated', true,
          'verification_status', 'VERIFIED'
        );
      ELSE
        -- Previously PENDING or REJECTED: reactivate as PENDING with requested proficiency
        UPDATE student_skills
        SET is_active = true,
            proficiency_level = p_proficiency_level,
            verification_status = 'PENDING',
            verified_by = NULL,
            verified_at = NULL,
            updated_at = now()
        WHERE id = v_existing.id
        RETURNING id INTO v_new_id;

        RETURN jsonb_build_object(
          'success', true,
          'student_skill_id', v_new_id,
          'reactivated', true,
          'verification_status', 'PENDING'
        );
      END IF;
    END IF;
  ELSE
    -- Insert new claim (trigger trg_check_skill_cap will enforce 15 active limit atomically)
    INSERT INTO student_skills (
      student_id,
      skill_id,
      proficiency_level,
      verification_status,
      is_active
    ) VALUES (
      v_student_id,
      p_skill_id,
      p_proficiency_level,
      'PENDING',
      true
    ) RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
      'success', true,
      'student_skill_id', v_new_id,
      'reactivated', false,
      'verification_status', 'PENDING'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION claim_student_skill(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_student_skill(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION update_student_skill_proficiency(
  p_student_skill_id  UUID,
  p_proficiency_level INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_claim      student_skills%ROWTYPE;
BEGIN
  IF v_student_id IS NULL OR NOT is_active_student() THEN
    RAISE EXCEPTION 'Unauthorized: Only active students can update skills';
  END IF;

  IF p_proficiency_level IS NULL OR p_proficiency_level < 1 OR p_proficiency_level > 4 THEN
    RAISE EXCEPTION 'Proficiency level must be an integer between 1 and 4';
  END IF;

  SELECT * INTO v_claim
  FROM student_skills
  WHERE id = p_student_skill_id AND student_id = v_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill claim not found or not owned by caller';
  END IF;

  IF NOT v_claim.is_active THEN
    RAISE EXCEPTION 'Cannot update proficiency on an archived skill claim';
  END IF;

  -- Invariant: VERIFIED claims are terminal and immutable to the student in Phase 5
  IF v_claim.verification_status = 'VERIFIED' THEN
    RAISE EXCEPTION 'Cannot modify proficiency of a verified skill claim';
  END IF;

  UPDATE student_skills
  SET proficiency_level = p_proficiency_level,
      updated_at = now()
  WHERE id = p_student_skill_id;

  RETURN jsonb_build_object('success', true, 'student_skill_id', p_student_skill_id, 'proficiency_level', p_proficiency_level);
END;
$$;

REVOKE ALL ON FUNCTION update_student_skill_proficiency(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_student_skill_proficiency(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION archive_student_skill(p_student_skill_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
BEGIN
  IF v_student_id IS NULL OR NOT is_active_student() THEN
    RAISE EXCEPTION 'Unauthorized: Only active students can archive skills';
  END IF;

  PERFORM 1
  FROM student_skills
  WHERE id = p_student_skill_id AND student_id = v_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill claim not found or not owned by caller';
  END IF;

  -- Soft archive: preserves historical record without consuming active slot
  UPDATE student_skills
  SET is_active = false,
      updated_at = now()
  WHERE id = p_student_skill_id;

  RETURN jsonb_build_object('success', true, 'student_skill_id', p_student_skill_id, 'is_active', false);
END;
$$;

REVOKE ALL ON FUNCTION archive_student_skill(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION archive_student_skill(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION resubmit_student_skill(p_student_skill_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_claim      student_skills%ROWTYPE;
  v_has_ev     BOOLEAN;
BEGIN
  IF v_student_id IS NULL OR NOT is_active_student() THEN
    RAISE EXCEPTION 'Unauthorized: Only active students can resubmit skills';
  END IF;

  SELECT * INTO v_claim
  FROM student_skills
  WHERE id = p_student_skill_id AND student_id = v_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill claim not found or not owned by caller';
  END IF;

  IF NOT v_claim.is_active THEN
    RAISE EXCEPTION 'Cannot resubmit an archived skill claim';
  END IF;

  IF v_claim.verification_status != 'REJECTED' THEN
    RAISE EXCEPTION 'Only rejected skill claims can be resubmitted';
  END IF;

  -- Ensure evidence is attached before resubmission
  SELECT EXISTS (
    SELECT 1 FROM student_skill_evidence WHERE student_skill_id = p_student_skill_id
  ) INTO v_has_ev;

  IF NOT v_has_ev THEN
    RAISE EXCEPTION 'Please attach supporting evidence before resubmitting a rejected skill';
  END IF;

  -- Transition REJECTED -> PENDING
  UPDATE student_skills
  SET verification_status = 'PENDING',
      verified_by = NULL,
      verified_at = NULL,
      updated_at = now()
  WHERE id = p_student_skill_id;

  RETURN jsonb_build_object('success', true, 'student_skill_id', p_student_skill_id, 'verification_status', 'PENDING');
END;
$$;

REVOKE ALL ON FUNCTION resubmit_student_skill(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resubmit_student_skill(UUID) TO authenticated;

-- ============================================================================
-- 6. Student Skill Evidence Procedures (Active Student Only)
-- ============================================================================

CREATE OR REPLACE FUNCTION submit_skill_evidence_link(
  p_student_skill_id UUID,
  p_evidence_url     TEXT,
  p_description      TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_claim      student_skills%ROWTYPE;
  v_clean_url  TEXT;
  v_clean_desc TEXT;
  v_ev_id      UUID;
BEGIN
  IF v_student_id IS NULL OR NOT is_active_student() THEN
    RAISE EXCEPTION 'Unauthorized: Only active students can submit skill evidence';
  END IF;

  SELECT * INTO v_claim
  FROM student_skills
  WHERE id = p_student_skill_id AND student_id = v_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill claim not found or not owned by caller';
  END IF;

  IF NOT v_claim.is_active THEN
    RAISE EXCEPTION 'Cannot attach evidence to an archived skill claim';
  END IF;

  IF v_claim.verification_status = 'VERIFIED' THEN
    RAISE EXCEPTION 'Cannot modify evidence for a verified skill claim';
  END IF;

  v_clean_url := NULLIF(trim(p_evidence_url), '');
  IF v_clean_url IS NULL THEN
    RAISE EXCEPTION 'Evidence URL cannot be empty';
  END IF;

  IF length(v_clean_url) > 500 THEN
    RAISE EXCEPTION 'Evidence URL cannot exceed 500 characters';
  END IF;

  -- Basic HTTP/HTTPS protocol validation
  IF v_clean_url !~* '^https?:\/\/.+' THEN
    RAISE EXCEPTION 'Evidence URL must begin with http:// or https://';
  END IF;

  v_clean_desc := NULLIF(trim(p_description), '');
  IF v_clean_desc IS NOT NULL AND length(v_clean_desc) > 500 THEN
    RAISE EXCEPTION 'Description cannot exceed 500 characters';
  END IF;

  -- Atomic upsert: delete any prior evidence for this skill claim
  DELETE FROM student_skill_evidence WHERE student_skill_id = p_student_skill_id;

  INSERT INTO student_skill_evidence (
    student_skill_id,
    evidence_type,
    evidence_url,
    storage_path,
    description
  ) VALUES (
    p_student_skill_id,
    'PROJECT_LINK',
    v_clean_url,
    NULL,
    v_clean_desc
  ) RETURNING id INTO v_ev_id;

  -- If claim was REJECTED, automatically transition back to PENDING for review
  IF v_claim.verification_status = 'REJECTED' THEN
    UPDATE student_skills
    SET verification_status = 'PENDING',
        verified_by = NULL,
        verified_at = NULL,
        updated_at = now()
    WHERE id = p_student_skill_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'evidence_id', v_ev_id,
    'evidence_type', 'PROJECT_LINK',
    'verification_status', CASE WHEN v_claim.verification_status = 'REJECTED' THEN 'PENDING' ELSE v_claim.verification_status::text END
  );
END;
$$;

REVOKE ALL ON FUNCTION submit_skill_evidence_link(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_skill_evidence_link(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION register_skill_evidence_pdf(
  p_student_skill_id UUID,
  p_storage_path     TEXT,
  p_description      TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_claim      student_skills%ROWTYPE;
  v_storage_obj RECORD;
  v_clean_desc TEXT;
  v_ev_id      UUID;
BEGIN
  IF v_student_id IS NULL OR NOT is_active_student() THEN
    RAISE EXCEPTION 'Unauthorized: Only active students can submit skill evidence';
  END IF;

  IF get_my_lifecycle() != 'STUDENT_ACTIVE' THEN
    RAISE EXCEPTION 'Unauthorized: Only currently active enrolled students can submit skill evidence';
  END IF;

  SELECT * INTO v_claim
  FROM student_skills
  WHERE id = p_student_skill_id AND student_id = v_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill claim not found or not owned by caller';
  END IF;

  IF NOT v_claim.is_active THEN
    RAISE EXCEPTION 'Cannot attach evidence to an archived skill claim';
  END IF;

  IF v_claim.verification_status = 'VERIFIED' THEN
    RAISE EXCEPTION 'Cannot modify evidence for a verified skill claim';
  END IF;

  -- Path must strictly adhere to convention: <student_uuid>/<student_skill_uuid>/...pdf
  IF p_storage_path !~ ('^' || v_student_id::text || '\/' || p_student_skill_id::text || '\/[a-zA-Z0-9_\-\.]+\.pdf$') THEN
    RAISE EXCEPTION 'Invalid storage path: PDF evidence must reside in student skill folder and end with .pdf';
  END IF;

  -- Inspect real storage.objects record in private skill-evidence bucket
  SELECT * INTO v_storage_obj
  FROM storage.objects
  WHERE bucket_id = 'skill-evidence'
    AND name = p_storage_path;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evidence file not found in storage bucket skill-evidence';
  END IF;

  -- Verify folder tokens match caller student and skill claim
  IF (storage.foldername(p_storage_path))[1] != v_student_id::text OR (storage.foldername(p_storage_path))[2] != p_student_skill_id::text THEN
    RAISE EXCEPTION 'Evidence file path does not match student skill folder';
  END IF;

  -- Verify MIME type and size from actual storage metadata
  IF COALESCE(v_storage_obj.metadata->>'mimetype', '') != 'application/pdf' THEN
    RAISE EXCEPTION 'Evidence file must be application/pdf';
  END IF;

  IF (COALESCE(v_storage_obj.metadata->>'size', '0'))::bigint > 5242880 THEN
    RAISE EXCEPTION 'Evidence file exceeds maximum permitted size of 5 MB';
  END IF;

  v_clean_desc := NULLIF(trim(p_description), '');
  IF v_clean_desc IS NOT NULL AND length(v_clean_desc) > 500 THEN
    RAISE EXCEPTION 'Description cannot exceed 500 characters';
  END IF;

  -- Atomic upsert: delete any prior evidence for this skill claim
  DELETE FROM student_skill_evidence WHERE student_skill_id = p_student_skill_id;

  INSERT INTO student_skill_evidence (
    student_skill_id,
    evidence_type,
    evidence_url,
    storage_path,
    description
  ) VALUES (
    p_student_skill_id,
    'PDF_DOCUMENT',
    NULL,
    p_storage_path,
    v_clean_desc
  ) RETURNING id INTO v_ev_id;

  -- If claim was REJECTED, automatically transition back to PENDING for review
  IF v_claim.verification_status = 'REJECTED' THEN
    UPDATE student_skills
    SET verification_status = 'PENDING',
        verified_by = NULL,
        verified_at = NULL,
        updated_at = now()
    WHERE id = p_student_skill_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'evidence_id', v_ev_id,
    'evidence_type', 'PDF_DOCUMENT',
    'verification_status', CASE WHEN v_claim.verification_status = 'REJECTED' THEN 'PENDING' ELSE v_claim.verification_status::text END
  );
END;
$$;

REVOKE ALL ON FUNCTION register_skill_evidence_pdf(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_skill_evidence_pdf(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 7. Staff Review & Verification Procedures (Coordinator / Secretary / Admin)
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_student_skill(p_student_skill_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reviewer_id UUID := auth.uid();
  v_role        user_role;
  v_claim       student_skills%ROWTYPE;
BEGIN
  -- Strict permission check
  SELECT role INTO v_role FROM profiles WHERE id = v_reviewer_id AND is_active = true;
  IF v_role IS NULL OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY', 'TNP_COORDINATOR') THEN
    RAISE EXCEPTION 'Unauthorized: Only authorized staff can verify student skills';
  END IF;

  SELECT * INTO v_claim FROM student_skills WHERE id = p_student_skill_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill claim not found';
  END IF;

  IF NOT v_claim.is_active THEN
    RAISE EXCEPTION 'Cannot verify an archived skill claim';
  END IF;

  -- Coordinator scope check
  IF v_role = 'TNP_COORDINATOR' AND NOT can_access_student(v_claim.student_id) THEN
    RAISE EXCEPTION 'Unauthorized: Student is outside assigned coordinator scope';
  END IF;

  -- State machine check: must be PENDING
  IF v_claim.verification_status = 'VERIFIED' THEN
    RAISE EXCEPTION 'Skill claim is already verified';
  END IF;

  IF v_claim.verification_status = 'REJECTED' THEN
    RAISE EXCEPTION 'Cannot verify a rejected skill without resubmission';
  END IF;

  -- Transition PENDING -> VERIFIED
  UPDATE student_skills
  SET verification_status = 'VERIFIED',
      verified_by = v_reviewer_id,
      verified_at = now(),
      updated_at = now()
  WHERE id = p_student_skill_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_reviewer_id,
    'SKILL_VERIFIED',
    'student_skill',
    p_student_skill_id,
    jsonb_build_object(
      'student_skill_id', p_student_skill_id,
      'student_id', v_claim.student_id,
      'skill_id', v_claim.skill_id,
      'old_status', v_claim.verification_status,
      'new_status', 'VERIFIED'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'student_skill_id', p_student_skill_id,
    'verification_status', 'VERIFIED',
    'verified_by', v_reviewer_id
  );
END;
$$;

REVOKE ALL ON FUNCTION verify_student_skill(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_student_skill(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION reject_student_skill(
  p_student_skill_id UUID,
  p_reason           TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reviewer_id UUID := auth.uid();
  v_role        user_role;
  v_claim       student_skills%ROWTYPE;
  v_clean_reason TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = v_reviewer_id AND is_active = true;
  IF v_role IS NULL OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY', 'TNP_COORDINATOR') THEN
    RAISE EXCEPTION 'Unauthorized: Only authorized staff can reject student skills';
  END IF;

  SELECT * INTO v_claim FROM student_skills WHERE id = p_student_skill_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skill claim not found';
  END IF;

  IF NOT v_claim.is_active THEN
    RAISE EXCEPTION 'Cannot reject an archived skill claim';
  END IF;

  -- Coordinator scope check
  IF v_role = 'TNP_COORDINATOR' AND NOT can_access_student(v_claim.student_id) THEN
    RAISE EXCEPTION 'Unauthorized: Student is outside assigned coordinator scope';
  END IF;

  IF v_claim.verification_status = 'VERIFIED' THEN
    RAISE EXCEPTION 'Cannot reject an already verified skill claim';
  END IF;

  IF v_claim.verification_status = 'REJECTED' THEN
    RAISE EXCEPTION 'Skill claim is already rejected';
  END IF;

  v_clean_reason := NULLIF(trim(p_reason), '');
  IF v_clean_reason IS NOT NULL AND length(v_clean_reason) > 500 THEN
    RAISE EXCEPTION 'Rejection reason cannot exceed 500 characters';
  END IF;

  -- Transition PENDING -> REJECTED
  UPDATE student_skills
  SET verification_status = 'REJECTED',
      verified_by = v_reviewer_id,
      verified_at = now(),
      updated_at = now()
  WHERE id = p_student_skill_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_reviewer_id,
    'SKILL_REJECTED',
    'student_skill',
    p_student_skill_id,
    jsonb_build_object(
      'student_skill_id', p_student_skill_id,
      'student_id', v_claim.student_id,
      'skill_id', v_claim.skill_id,
      'old_status', v_claim.verification_status,
      'new_status', 'REJECTED',
      'reason', v_clean_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'student_skill_id', p_student_skill_id,
    'verification_status', 'REJECTED'
  );
END;
$$;

REVOKE ALL ON FUNCTION reject_student_skill(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reject_student_skill(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 8. Staff Skill Reviews Queue View
-- ============================================================================

CREATE OR REPLACE VIEW v_staff_skill_reviews
WITH (security_invoker = true)
AS
SELECT
  ss.id AS student_skill_id,
  ss.student_id,
  p.display_name AS student_name,
  ap.display_name AS program_name,
  ap.code AS program_code,
  ar.batch,
  s.id AS skill_id,
  s.name AS skill_name,
  s.category AS skill_category,
  ss.proficiency_level,
  ss.verification_status,
  ss.is_active,
  ss.created_at AS claim_created_at,
  ss.updated_at AS claim_updated_at,
  sse.id AS evidence_id,
  sse.evidence_type,
  sse.evidence_url,
  sse.storage_path AS evidence_storage_path,
  sse.description AS evidence_description,
  sse.submitted_at AS evidence_submitted_at,
  ss.verified_by,
  verifier.display_name AS verifier_name,
  ss.verified_at
FROM student_skills ss
JOIN profiles p ON p.id = ss.student_id
JOIN academic_records ar ON ar.profile_id = ss.student_id
JOIN academic_programs ap ON ap.id = ar.program_id
JOIN skills s ON s.id = ss.skill_id
LEFT JOIN student_skill_evidence sse ON sse.student_skill_id = ss.id
LEFT JOIN profiles verifier ON verifier.id = ss.verified_by
WHERE ss.is_active = true
  AND is_staff()
  AND can_access_student(ss.student_id);

GRANT SELECT ON v_staff_skill_reviews TO authenticated;
