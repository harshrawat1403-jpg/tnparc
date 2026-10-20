-- Migration 12: Phase 4 Student Profiles, Resume Storage, Academic Verification & Completeness
-- TNP Portal: Student Profiles & Resume Foundation

-- ============================================================================
-- 1. Private Storage Buckets Configuration
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('resumes', 'resumes', false, 5242880, ARRAY['application/pdf']::text[]),
  ('profile-photos', 'profile-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 2. Storage Objects Row-Level Security Policies & Staff Access Helpers
-- ============================================================================

-- Helper: Authorizes staff to read a resume object ONLY IF:
-- 1. The object is registered in public.documents
-- 2. The document_type is 'RESUME'
-- 3. The folder matches the owner_id
-- 4. The caller has staff access to that student via can_access_student()
-- Unregistered orphan blobs cannot be read by staff even if placed in an in-scope student folder.
CREATE OR REPLACE FUNCTION can_staff_access_resume_object(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.storage_path = p_object_name
      AND d.document_type = 'RESUME'
      AND (storage.foldername(p_object_name))[1] = d.owner_id::text
      AND public.can_access_student(d.owner_id)
  );
$$;

REVOKE ALL ON FUNCTION can_staff_access_resume_object(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_staff_access_resume_object(TEXT) TO authenticated;

-- Helper: Authorizes staff to read a profile photo object ONLY IF:
-- 1. The object path matches the student's currently active registered profile_photo_path
-- 2. The folder matches the profile_id
-- 3. The caller has staff access to that student via can_access_student()
-- Orphan or replaced/superseded photo blobs cannot be read by staff.
CREATE OR REPLACE FUNCTION can_staff_access_photo_object(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_profiles sp
    WHERE sp.profile_photo_path = p_object_name
      AND (storage.foldername(p_object_name))[1] = sp.profile_id::text
      AND public.can_access_student(sp.profile_id)
  );
$$;

REVOKE ALL ON FUNCTION can_staff_access_photo_object(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_staff_access_photo_object(TEXT) TO authenticated;

-- Direct raw INSERT and DELETE on storage.objects are strictly DENIED to all ordinary users (including students).
-- All uploads flow through trusted server actions that validate file magic bytes, MIME, and size limits,
-- and upload via the server-only admin client before atomic database registration.
-- This prevents forged MIME uploads or storage-metadata desynchronization.

-- Resumes: Student reads own folder; staff reads registered documents according to scope; recruiter/anon denied
CREATE POLICY resume_storage_select_own ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY resume_storage_select_staff ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND can_staff_access_resume_object(name)
  );

-- Profile Photos: Student reads own folder; staff reads currently active photo according to scope; recruiter/anon denied
CREATE POLICY photo_storage_select_own ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY photo_storage_select_staff ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND can_staff_access_photo_object(name)
  );

-- ============================================================================
-- 3. Documents Table Security Policies
-- ============================================================================

-- Active student can view their own documents
CREATE POLICY documents_select_own ON documents
  FOR SELECT
  USING (owner_id = auth.uid());

-- Authorized staff can view student documents within their scope (Super Admin/Sec = all; Coord = in-scope)
CREATE POLICY documents_select_staff ON documents
  FOR SELECT
  USING (can_access_student(owner_id));

-- Direct INSERT, UPDATE, DELETE on documents are strictly revoked from public, anon, and authenticated.
-- All document mutations must be executed through the trusted SECURITY DEFINER procedure register_student_resume().
REVOKE INSERT, UPDATE, DELETE ON documents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON documents TO authenticated;

-- ============================================================================
-- 4. Authoritative Deterministic Profile Completeness Function
-- ============================================================================
-- Phase 4 deterministic scoring formula (100% total):
-- 1. Base Identity (profiles + academic_records present): 20%
-- 2. Contact Phone (phone present and non-empty): 15%
-- 3. Professional Bio / Headline (bio or headline present and non-empty): 15%
-- 4. LinkedIn Profile (linkedin_url present and valid format): 15%
-- 5. Portfolio URL (portfolio_url present and valid format): 10%
-- 6. Profile Photo (profile_photo_path present): 10%
-- 7. Current Resume (active current resume in documents): 15%

CREATE OR REPLACE FUNCTION calculate_student_profile_completeness(p_student_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_score INTEGER := 0;
  v_sp    RECORD;
  v_ar    BOOLEAN;
  v_res   BOOLEAN;
BEGIN
  -- 1. Base Identity verification (Profile + Academic record exist)
  SELECT EXISTS (
    SELECT 1 FROM academic_records WHERE profile_id = p_student_id
  ) INTO v_ar;

  IF v_ar THEN
    v_score := v_score + 20;
  END IF;

  -- Inspect student_profiles fields
  SELECT * INTO v_sp FROM student_profiles WHERE profile_id = p_student_id;
  IF FOUND THEN
    -- 2. Contact Phone (15%)
    IF v_sp.phone IS NOT NULL AND length(trim(v_sp.phone)) >= 7 THEN
      v_score := v_score + 15;
    END IF;

    -- 3. Bio or Professional Headline (15%)
    IF (v_sp.bio IS NOT NULL AND length(trim(v_sp.bio)) >= 10)
       OR (v_sp.public_headline IS NOT NULL AND length(trim(v_sp.public_headline)) >= 5) THEN
      v_score := v_score + 15;
    END IF;

    -- 4. LinkedIn URL (15%)
    IF v_sp.linkedin_url IS NOT NULL AND length(trim(v_sp.linkedin_url)) > 0
       AND (v_sp.linkedin_url ILIKE 'https://%linkedin.com%' OR v_sp.linkedin_url ILIKE 'http://%linkedin.com%') THEN
      v_score := v_score + 15;
    END IF;

    -- 5. Portfolio URL (10%)
    IF v_sp.portfolio_url IS NOT NULL AND length(trim(v_sp.portfolio_url)) > 0
       AND (v_sp.portfolio_url ILIKE 'http://%' OR v_sp.portfolio_url ILIKE 'https://%') THEN
      v_score := v_score + 10;
    END IF;

    -- 6. Profile Photo (10%)
    IF v_sp.profile_photo_path IS NOT NULL AND length(trim(v_sp.profile_photo_path)) > 0 THEN
      v_score := v_score + 10;
    END IF;
  END IF;

  -- 7. Current Resume (15%)
  SELECT EXISTS (
    SELECT 1 FROM documents
    WHERE owner_id = p_student_id
      AND document_type = 'RESUME'
      AND is_current = true
  ) INTO v_res;

  IF v_res THEN
    v_score := v_score + 15;
  END IF;

  -- Guard bounds 0..100
  IF v_score > 100 THEN
    v_score := 100;
  END IF;

  RETURN v_score;
END;
$$;

REVOKE ALL ON FUNCTION calculate_student_profile_completeness(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_student_profile_completeness(UUID) TO authenticated;

-- ============================================================================
-- 5. Narrow Student Profile Mutation Procedure
-- ============================================================================
CREATE OR REPLACE FUNCTION update_own_student_profile(
  p_bio             TEXT DEFAULT NULL,
  p_public_headline TEXT DEFAULT NULL,
  p_public_tagline  TEXT DEFAULT NULL,
  p_phone           TEXT DEFAULT NULL,
  p_linkedin_url    TEXT DEFAULT NULL,
  p_portfolio_url   TEXT DEFAULT NULL,
  p_other_links     JSONB DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_cleaned_phone TEXT;
  v_cleaned_linkedin TEXT;
  v_cleaned_portfolio TEXT;
  v_new_completeness INTEGER;
BEGIN
  -- Strict identity & active student status check
  IF v_student_id IS NULL OR NOT is_active_student() THEN
    RAISE EXCEPTION 'Unauthorized: Only an active student can update their profile';
  END IF;

  -- Input sanitization and length validation
  IF p_bio IS NOT NULL AND length(p_bio) > 2000 THEN
    RAISE EXCEPTION 'Bio cannot exceed 2000 characters';
  END IF;

  IF p_public_headline IS NOT NULL AND length(p_public_headline) > 120 THEN
    RAISE EXCEPTION 'Headline cannot exceed 120 characters';
  END IF;

  IF p_public_tagline IS NOT NULL AND length(p_public_tagline) > 200 THEN
    RAISE EXCEPTION 'Tagline cannot exceed 200 characters';
  END IF;

  -- Phone validation
  v_cleaned_phone := NULLIF(trim(p_phone), '');
  IF v_cleaned_phone IS NOT NULL THEN
    IF length(v_cleaned_phone) > 20 THEN
      RAISE EXCEPTION 'Phone number cannot exceed 20 characters';
    END IF;
    IF v_cleaned_phone !~ '^\+?[0-9\s\-\(\)]+$' THEN
      RAISE EXCEPTION 'Invalid phone number format';
    END IF;
  END IF;

  -- LinkedIn URL validation
  v_cleaned_linkedin := NULLIF(trim(p_linkedin_url), '');
  IF v_cleaned_linkedin IS NOT NULL THEN
    IF length(v_cleaned_linkedin) > 255 THEN
      RAISE EXCEPTION 'LinkedIn URL cannot exceed 255 characters';
    END IF;
    IF v_cleaned_linkedin !~* '^https?:\/\/(www\.)?linkedin\.com\/.*' THEN
      RAISE EXCEPTION 'LinkedIn URL must begin with http:// or https:// and reference linkedin.com';
    END IF;
  END IF;

  -- Portfolio URL validation
  v_cleaned_portfolio := NULLIF(trim(p_portfolio_url), '');
  IF v_cleaned_portfolio IS NOT NULL THEN
    IF length(v_cleaned_portfolio) > 255 THEN
      RAISE EXCEPTION 'Portfolio URL cannot exceed 255 characters';
    END IF;
    IF v_cleaned_portfolio !~* '^https?:\/\/.*' THEN
      RAISE EXCEPTION 'Portfolio URL must begin with http:// or https://';
    END IF;
  END IF;

  -- JSON array validation for other_links
  IF jsonb_typeof(p_other_links) != 'array' THEN
    RAISE EXCEPTION 'other_links must be a JSON array';
  END IF;

  -- Atomically update permitted professional fields (strictly ignores protected columns)
  UPDATE student_profiles
  SET bio = NULLIF(trim(p_bio), ''),
      public_headline = NULLIF(trim(p_public_headline), ''),
      public_tagline = NULLIF(trim(p_public_tagline), ''),
      phone = v_cleaned_phone,
      linkedin_url = v_cleaned_linkedin,
      portfolio_url = v_cleaned_portfolio,
      other_links = p_other_links,
      updated_at = now()
  WHERE profile_id = v_student_id;

  -- Recalculate completeness transactionally
  v_new_completeness := calculate_student_profile_completeness(v_student_id);

  UPDATE student_profiles
  SET profile_completeness = v_new_completeness
  WHERE profile_id = v_student_id;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', v_student_id,
    'profile_completeness', v_new_completeness
  );
END;
$$;

REVOKE ALL ON FUNCTION update_own_student_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_own_student_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- ============================================================================
-- 6. Profile Photo Update Procedure
-- ============================================================================
CREATE OR REPLACE FUNCTION update_own_profile_photo(p_storage_path TEXT)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_cleaned_path TEXT;
  v_new_completeness INTEGER;
BEGIN
  IF v_student_id IS NULL OR NOT is_active_student() THEN
    RAISE EXCEPTION 'Unauthorized: Only an active student can update their profile photo';
  END IF;

  v_cleaned_path := NULLIF(trim(p_storage_path), '');

  -- Path must strictly adhere to ownership directory convention: <student_uuid>/...
  IF v_cleaned_path IS NOT NULL AND v_cleaned_path !~ ('^' || v_student_id::text || '\/[a-zA-Z0-9_\-\.]+$') THEN
    RAISE EXCEPTION 'Invalid storage path: photo path must reside in student folder';
  END IF;

  UPDATE student_profiles
  SET profile_photo_path = v_cleaned_path,
      updated_at = now()
  WHERE profile_id = v_student_id;

  v_new_completeness := calculate_student_profile_completeness(v_student_id);

  UPDATE student_profiles
  SET profile_completeness = v_new_completeness
  WHERE profile_id = v_student_id;

  RETURN jsonb_build_object(
    'success', true,
    'profile_photo_path', v_cleaned_path,
    'profile_completeness', v_new_completeness
  );
END;
$$;

REVOKE ALL ON FUNCTION update_own_profile_photo(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_own_profile_photo(TEXT) TO authenticated;

-- ============================================================================
-- 7. Transactional Resume Registration Procedure
-- ============================================================================
CREATE OR REPLACE FUNCTION register_student_resume(
  p_storage_path    TEXT,
  p_file_name       TEXT,
  p_file_size_bytes INTEGER,
  p_mime_type       TEXT
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_doc_id     UUID;
  v_new_completeness INTEGER;
BEGIN
  IF v_student_id IS NULL OR NOT is_active_student() THEN
    RAISE EXCEPTION 'Unauthorized: Only an active student can register a resume';
  END IF;

  -- Path verification: must begin with student's own UUID
  IF p_storage_path !~ ('^' || v_student_id::text || '\/[a-zA-Z0-9_\-\.]+\.pdf$') THEN
    RAISE EXCEPTION 'Invalid storage path: resume must reside in student folder and end with .pdf';
  END IF;

  -- MIME and size constraints
  IF p_mime_type != 'application/pdf' THEN
    RAISE EXCEPTION 'Invalid MIME type: resume must be application/pdf';
  END IF;

  IF p_file_size_bytes IS NULL OR p_file_size_bytes <= 0 OR p_file_size_bytes > 5242880 THEN
    RAISE EXCEPTION 'File size must be positive and not exceed 5 MB (5,242,880 bytes)';
  END IF;

  -- Atomically archive prior active resume(s)
  UPDATE documents
  SET is_current = false
  WHERE owner_id = v_student_id
    AND document_type = 'RESUME'
    AND is_current = true;

  -- Insert new active resume document
  INSERT INTO documents (
    owner_id,
    document_type,
    storage_path,
    file_name,
    file_size_bytes,
    mime_type,
    is_current
  ) VALUES (
    v_student_id,
    'RESUME',
    p_storage_path,
    p_file_name,
    p_file_size_bytes,
    p_mime_type,
    true
  ) RETURNING id INTO v_doc_id;

  -- Recalculate profile completeness transactionally
  v_new_completeness := calculate_student_profile_completeness(v_student_id);

  UPDATE student_profiles
  SET profile_completeness = v_new_completeness
  WHERE profile_id = v_student_id;

  RETURN jsonb_build_object(
    'success', true,
    'document_id', v_doc_id,
    'storage_path', p_storage_path,
    'profile_completeness', v_new_completeness
  );
END;
$$;

REVOKE ALL ON FUNCTION register_student_resume(TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_student_resume(TEXT, TEXT, INTEGER, TEXT) TO authenticated;

-- ============================================================================
-- 8. Academic Verification & Correction Procedures (Secretary / Super Admin Only)
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_student_academic_record(
  p_target_profile_id UUID,
  p_cgpa              NUMERIC,
  p_active_backlogs   INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_verifier_id UUID := auth.uid();
  v_role        user_role;
  v_record      RECORD;
BEGIN
  -- Strict permission check: Secretary and Super Admin only
  SELECT role INTO v_role FROM profiles WHERE id = v_verifier_id AND is_active = true;
  IF v_role IS NULL OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only TNP Secretary or Super Admin can verify academic records';
  END IF;

  -- Bounds validation
  IF p_cgpa IS NULL OR p_cgpa < 0.00 OR p_cgpa > 10.00 THEN
    RAISE EXCEPTION 'CGPA must be between 0.00 and 10.00';
  END IF;

  IF p_active_backlogs IS NULL OR p_active_backlogs < 0 THEN
    RAISE EXCEPTION 'Active backlogs count must be a non-negative integer';
  END IF;

  SELECT * INTO v_record FROM academic_records WHERE profile_id = p_target_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Academic record not found for student';
  END IF;

  -- Update academic record with verified values
  UPDATE academic_records
  SET cgpa = p_cgpa,
      active_backlogs = p_active_backlogs,
      verification_status = 'VERIFIED',
      verified_by = v_verifier_id,
      verified_at = now(),
      updated_at = now()
  WHERE profile_id = p_target_profile_id;

  -- Audit log entry (sanitized: NO raw CGPA or backlog count in audit metadata)
  INSERT INTO audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_verifier_id,
    'ACADEMIC_VERIFIED',
    'academic_record',
    v_record.id,
    jsonb_build_object(
      'student_id', p_target_profile_id,
      'previous_status', v_record.verification_status,
      'new_status', 'VERIFIED'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'student_id', p_target_profile_id,
    'verification_status', 'VERIFIED'
  );
END;
$$;

REVOKE ALL ON FUNCTION verify_student_academic_record(UUID, NUMERIC, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_student_academic_record(UUID, NUMERIC, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION correct_student_academic_record(
  p_target_profile_id UUID,
  p_cgpa              NUMERIC,
  p_active_backlogs   INTEGER,
  p_reason            TEXT
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_verifier_id UUID := auth.uid();
  v_role        user_role;
  v_record      RECORD;
  v_clean_reason TEXT;
BEGIN
  -- Strict permission check: Secretary and Super Admin only
  SELECT role INTO v_role FROM profiles WHERE id = v_verifier_id AND is_active = true;
  IF v_role IS NULL OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only TNP Secretary or Super Admin can correct academic records';
  END IF;

  v_clean_reason := NULLIF(trim(p_reason), '');
  IF v_clean_reason IS NULL OR length(v_clean_reason) < 5 THEN
    RAISE EXCEPTION 'A mandatory justification reason (min 5 characters) is required for academic corrections';
  END IF;

  -- Bounds validation
  IF p_cgpa IS NULL OR p_cgpa < 0.00 OR p_cgpa > 10.00 THEN
    RAISE EXCEPTION 'CGPA must be between 0.00 and 10.00';
  END IF;

  IF p_active_backlogs IS NULL OR p_active_backlogs < 0 THEN
    RAISE EXCEPTION 'Active backlogs count must be a non-negative integer';
  END IF;

  SELECT * INTO v_record FROM academic_records WHERE profile_id = p_target_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Academic record not found for student';
  END IF;

  -- Update record with corrected values
  UPDATE academic_records
  SET cgpa = p_cgpa,
      active_backlogs = p_active_backlogs,
      verification_status = 'VERIFIED',
      verified_by = v_verifier_id,
      verified_at = now(),
      updated_at = now()
  WHERE profile_id = p_target_profile_id;

  -- Audit log entry with mandatory reason (sanitized: NO raw CGPA or backlog count in audit metadata)
  INSERT INTO audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_verifier_id,
    'ACADEMIC_CORRECTED',
    'academic_record',
    v_record.id,
    jsonb_build_object(
      'student_id', p_target_profile_id,
      'reason', v_clean_reason,
      'previous_status', v_record.verification_status,
      'new_status', 'VERIFIED'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'student_id', p_target_profile_id,
    'verification_status', 'VERIFIED'
  );
END;
$$;

REVOKE ALL ON FUNCTION correct_student_academic_record(UUID, NUMERIC, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION correct_student_academic_record(UUID, NUMERIC, INTEGER, TEXT) TO authenticated;
