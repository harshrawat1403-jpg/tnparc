-- Migration 18: Phase 10 Alumni & Industry Relations
-- Implements alumni lifecycle extensions, employment history, company linkage,
-- alumni self-update, staff verification & matching, and narrow public alumni directory.

-- ============================================================================
-- 1. Helper Function: is_active_alumni()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_active_alumni()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_active = true
      AND role = 'STUDENT'
      AND student_lifecycle_status = 'ALUMNI'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_alumni() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 2. Tables: alumni_profiles and alumni_employment_history
-- ============================================================================

CREATE TABLE public.alumni_profiles (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id                   UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Graduation
  graduation_year              INTEGER NOT NULL,
  program_id                   UUID NOT NULL REFERENCES public.academic_programs(id) ON DELETE RESTRICT,

  -- Current Professional Status
  current_organization         TEXT,
  company_id                   UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  "current_role"               TEXT,
  professional_domain          TEXT,
  city                         TEXT,
  country                      TEXT NOT NULL DEFAULT 'India',
  linkedin_url                 TEXT,

  -- Higher Studies (optional)
  higher_studies_institution   TEXT,
  higher_studies_program       TEXT,
  higher_studies_year_start    INTEGER,

  -- Community Preferences (internal staff use only)
  willing_to_mentor            BOOLEAN NOT NULL DEFAULT false,
  willing_to_refer             BOOLEAN NOT NULL DEFAULT false,
  willing_to_support_placement BOOLEAN NOT NULL DEFAULT false,

  -- Privacy & Visibility
  public_alumni_enabled        BOOLEAN NOT NULL DEFAULT false,
  consent_recorded_at          TIMESTAMPTZ,

  -- Data Currency & Verification
  last_verified_at             TIMESTAMPTZ,
  last_verified_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_graduation_year
    CHECK (graduation_year BETWEEN 1950 AND (EXTRACT(YEAR FROM now()) + 10)::INTEGER),

  CONSTRAINT chk_consent_for_public
    CHECK (
      (public_alumni_enabled = false)
      OR (public_alumni_enabled = true AND consent_recorded_at IS NOT NULL)
    ),

  CONSTRAINT chk_company_or_org
    CHECK (
      (company_id IS NULL)
      OR (company_id IS NOT NULL AND current_organization IS NULL)
    ),

  CONSTRAINT chk_higher_studies_year
    CHECK (higher_studies_year_start IS NULL OR higher_studies_year_start BETWEEN 1950 AND (EXTRACT(YEAR FROM now()) + 10)::INTEGER),

  CONSTRAINT chk_alumni_linkedin_url
    CHECK (linkedin_url IS NULL OR linkedin_url ~* '^https?://'),

  CONSTRAINT chk_alumni_text_bounds
    CHECK (
      (current_organization IS NULL OR length(trim(current_organization)) <= 200)
      AND ("current_role" IS NULL OR length(trim("current_role")) <= 150)
      AND (professional_domain IS NULL OR length(trim(professional_domain)) <= 100)
      AND (city IS NULL OR length(trim(city)) <= 100)
      AND (length(trim(country)) <= 100)
      AND (higher_studies_institution IS NULL OR length(trim(higher_studies_institution)) <= 200)
      AND (higher_studies_program IS NULL OR length(trim(higher_studies_program)) <= 150)
    )
);

CREATE TRIGGER trg_alumni_profiles_updated_at
  BEFORE UPDATE ON public.alumni_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_alumni_profile_id ON public.alumni_profiles (profile_id);
CREATE INDEX idx_alumni_graduation_year ON public.alumni_profiles (graduation_year);
CREATE INDEX idx_alumni_company ON public.alumni_profiles (company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_alumni_public ON public.alumni_profiles (graduation_year) WHERE public_alumni_enabled = true;

CREATE TABLE public.alumni_employment_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumni_id           UUID NOT NULL REFERENCES public.alumni_profiles(id) ON DELETE CASCADE,
  organization        TEXT NOT NULL,
  company_id          UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  role                TEXT NOT NULL,
  professional_domain TEXT,
  city                TEXT,
  country             TEXT,
  started_at          DATE NOT NULL,
  ended_at            DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_employment_dates
    CHECK (ended_at IS NULL OR ended_at >= started_at),

  CONSTRAINT chk_employment_text_bounds
    CHECK (
      length(trim(organization)) > 0 AND length(trim(organization)) <= 200
      AND length(trim(role)) > 0 AND length(trim(role)) <= 150
      AND (professional_domain IS NULL OR length(trim(professional_domain)) <= 100)
      AND (city IS NULL OR length(trim(city)) <= 100)
      AND (country IS NULL OR length(trim(country)) <= 100)
      AND (notes IS NULL OR length(trim(notes)) <= 1000)
    )
);

CREATE INDEX idx_employment_alumni ON public.alumni_employment_history (alumni_id);
CREATE INDEX idx_employment_company ON public.alumni_employment_history (company_id) WHERE company_id IS NOT NULL;

-- ============================================================================
-- 3. Row-Level Security Policies
-- ============================================================================

ALTER TABLE public.alumni_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_employment_history ENABLE ROW LEVEL SECURITY;

-- A. Explicit Anonymous Deny Policies
GRANT SELECT ON public.alumni_profiles TO anon;
DROP POLICY IF EXISTS anon_deny_alumni_profiles ON public.alumni_profiles;
CREATE POLICY anon_deny_alumni_profiles ON public.alumni_profiles
  FOR SELECT TO anon
  USING (false);

GRANT SELECT ON public.alumni_employment_history TO anon;
DROP POLICY IF EXISTS anon_deny_alumni_employment_history ON public.alumni_employment_history;
CREATE POLICY anon_deny_alumni_employment_history ON public.alumni_employment_history
  FOR SELECT TO anon
  USING (false);

-- B. Alumni Self-Access
CREATE POLICY alumni_read_own_profile ON public.alumni_profiles
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY alumni_read_own_employment ON public.alumni_employment_history
  FOR SELECT TO authenticated
  USING (alumni_id IN (SELECT id FROM public.alumni_profiles WHERE profile_id = auth.uid()));

-- C. Staff Scoped Access
CREATE POLICY staff_read_alumni_profiles ON public.alumni_profiles
  FOR SELECT TO authenticated
  USING (
    public.is_active_staff() AND public.can_access_student(profile_id)
  );

CREATE POLICY staff_read_alumni_employment ON public.alumni_employment_history
  FOR SELECT TO authenticated
  USING (
    public.is_active_staff() AND alumni_id IN (
      SELECT ap.id FROM public.alumni_profiles ap WHERE public.can_access_student(ap.profile_id)
    )
  );

-- Direct client INSERT, UPDATE, and DELETE are not granted to prevent bypass of state validation
REVOKE INSERT, UPDATE, DELETE ON public.alumni_profiles FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.alumni_employment_history FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 4. Lifecycle Procedures: Graduation & Atomic Alumni Conversion
-- ============================================================================

-- A. Mark student graduated (STUDENT_ACTIVE -> STUDENT_GRADUATED)
CREATE OR REPLACE FUNCTION public.mark_student_graduated(
  p_student_id UUID,
  p_reason     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id   UUID := auth.uid();
  v_cleaned_reason TEXT := trim(p_reason);
  v_current_status student_lifecycle_status;
  v_role           user_role;
  v_is_active      BOOLEAN;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only active staff can graduate students'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_access_student(p_student_id) THEN
    RAISE EXCEPTION 'Forbidden: Coordinator has no scope over this student'
      USING ERRCODE = '42501';
  END IF;

  IF v_cleaned_reason IS NULL OR length(v_cleaned_reason) = 0 THEN
    RAISE EXCEPTION 'Graduation reason cannot be empty'
      USING ERRCODE = '22023';
  END IF;

  IF length(v_cleaned_reason) > 500 THEN
    RAISE EXCEPTION 'Graduation reason cannot exceed 500 characters'
      USING ERRCODE = '22023';
  END IF;

  -- Lock student profile row to prevent concurrent lifecycle modifications
  SELECT role, student_lifecycle_status, is_active
    INTO v_role, v_current_status, v_is_active
  FROM public.profiles
  WHERE id = p_student_id
  FOR UPDATE;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Target student profile not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_role != 'STUDENT' THEN
    RAISE EXCEPTION 'Only students can be graduated'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'Cannot graduate an inactive student profile'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_current_status != 'STUDENT_ACTIVE' THEN
    RAISE EXCEPTION 'Student must be in STUDENT_ACTIVE lifecycle status to graduate (currently %)', v_current_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
  SET student_lifecycle_status = 'STUDENT_GRADUATED',
      updated_at = now()
  WHERE id = p_student_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'STUDENT_GRADUATED',
    'profiles',
    p_student_id,
    jsonb_build_object(
      'from_status', 'STUDENT_ACTIVE',
      'to_status', 'STUDENT_GRADUATED',
      'reason', v_cleaned_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_student_id,
    'student_lifecycle_status', 'STUDENT_GRADUATED'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_student_graduated(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_student_graduated(UUID, TEXT) TO authenticated;

-- B. Convert graduated student to alumni (STUDENT_GRADUATED -> ALUMNI)
CREATE OR REPLACE FUNCTION public.convert_student_to_alumni(
  p_student_id           UUID,
  p_current_organization TEXT DEFAULT NULL,
  p_company_id           UUID DEFAULT NULL,
  p_current_role         TEXT DEFAULT NULL,
  p_professional_domain  TEXT DEFAULT NULL,
  p_city                 TEXT DEFAULT NULL,
  p_country              TEXT DEFAULT 'India',
  p_linkedin_url         TEXT DEFAULT NULL,
  p_reason               TEXT DEFAULT 'Student graduated and transitioned to alumni'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id        UUID := auth.uid();
  v_cleaned_reason  TEXT := trim(COALESCE(p_reason, 'Student graduated and transitioned to alumni'));
  v_current_status  student_lifecycle_status;
  v_role            user_role;
  v_is_active       BOOLEAN;
  v_program_id      UUID;
  v_batch           TEXT;
  v_graduation_year INTEGER;
  v_alumni_id       UUID;
  v_company_active  BOOLEAN;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only active staff can convert students to alumni'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_access_student(p_student_id) THEN
    RAISE EXCEPTION 'Forbidden: Coordinator has no scope over this student'
      USING ERRCODE = '42501';
  END IF;

  IF length(v_cleaned_reason) = 0 OR length(v_cleaned_reason) > 500 THEN
    RAISE EXCEPTION 'Reason must be between 1 and 500 characters'
      USING ERRCODE = '22023';
  END IF;

  -- Lock student profile row
  SELECT role, student_lifecycle_status, is_active
    INTO v_role, v_current_status, v_is_active
  FROM public.profiles
  WHERE id = p_student_id
  FOR UPDATE;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Target student profile not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_role != 'STUDENT' THEN
    RAISE EXCEPTION 'Only student profiles can be converted to alumni'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'Cannot convert inactive student to alumni'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_current_status = 'STUDENT_ACTIVE' THEN
    RAISE EXCEPTION 'Student must be graduated before converting to alumni (cannot transition STUDENT_ACTIVE -> ALUMNI directly)'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_current_status != 'STUDENT_GRADUATED' THEN
    RAISE EXCEPTION 'Student is already ALUMNI or in invalid lifecycle status (%)', v_current_status
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.alumni_profiles WHERE profile_id = p_student_id) THEN
    RAISE EXCEPTION 'Alumni profile already exists for this student'
      USING ERRCODE = '23505';
  END IF;

  -- Derive graduation cohort and program authoritatively from verified academic record
  SELECT ar.program_id, ar.batch
    INTO v_program_id, v_batch
  FROM public.academic_records ar
  WHERE ar.profile_id = p_student_id
    AND ar.verification_status = 'VERIFIED'
  LIMIT 1;

  IF v_program_id IS NULL OR v_batch IS NULL THEN
    RAISE EXCEPTION 'Cannot convert to alumni: student has no verified academic record to establish cohort'
      USING ERRCODE = 'P0001';
  END IF;

  -- Parse graduation year strictly from verified academic batch
  -- Supports 4-digit graduation year (e.g. '2027') or year range (e.g. '2022-2027' -> 2027)
  IF v_batch ~ '^\s*([0-9]{4})\s*$' THEN
    v_graduation_year := (regexp_match(v_batch, '^\s*([0-9]{4})\s*$'))[1]::INTEGER;
  ELSIF v_batch ~ '^\s*([0-9]{4})\s*[-–—/]\s*([0-9]{4})\s*$' THEN
    DECLARE
      v_parts text[] := regexp_match(v_batch, '^\s*([0-9]{4})\s*[-–—/]\s*([0-9]{4})\s*$');
      v_start_yr integer := v_parts[1]::INTEGER;
      v_end_yr   integer := v_parts[2]::INTEGER;
    BEGIN
      IF v_start_yr >= v_end_yr THEN
        RAISE EXCEPTION 'Invalid academic record batch range (%): start year must precede graduation year', v_batch
          USING ERRCODE = '22023';
      END IF;
      v_graduation_year := v_end_yr;
    END;
  ELSE
    RAISE EXCEPTION 'Invalid academic record batch format (%): expected 4-digit year (e.g. 2027) or year range (e.g. 2022-2027)', v_batch
      USING ERRCODE = '22023';
  END IF;

  IF v_graduation_year < 1960 OR v_graduation_year > 2100 THEN
    RAISE EXCEPTION 'Graduation year % out of valid range (1960-2100)', v_graduation_year
      USING ERRCODE = '22023';
  END IF;

  -- Validate company matching rule
  IF p_company_id IS NOT NULL THEN
    IF p_current_organization IS NOT NULL AND length(trim(p_current_organization)) > 0 THEN
      RAISE EXCEPTION 'Current organization must be NULL when canonical company_id is provided'
        USING ERRCODE = '22023';
    END IF;

    SELECT NOT is_archived INTO v_company_active
    FROM public.companies
    WHERE id = p_company_id;

    IF v_company_active IS NULL OR NOT v_company_active THEN
      RAISE EXCEPTION 'Referenced company not found or is archived'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- Insert alumni_profiles record atomically
  INSERT INTO public.alumni_profiles (
    profile_id,
    graduation_year,
    program_id,
    current_organization,
    company_id,
    "current_role",
    professional_domain,
    city,
    country,
    linkedin_url,
    public_alumni_enabled,
    consent_recorded_at
  ) VALUES (
    p_student_id,
    v_graduation_year,
    v_program_id,
    CASE WHEN p_company_id IS NULL THEN NULLIF(trim(p_current_organization), '') ELSE NULL END,
    p_company_id,
    NULLIF(trim(p_current_role), ''),
    NULLIF(trim(p_professional_domain), ''),
    NULLIF(trim(p_city), ''),
    COALESCE(NULLIF(trim(p_country), ''), 'India'),
    NULLIF(trim(p_linkedin_url), ''),
    false,
    NULL
  )
  RETURNING id INTO v_alumni_id;

  -- Update lifecycle status
  UPDATE public.profiles
  SET student_lifecycle_status = 'ALUMNI',
      updated_at = now()
  WHERE id = p_student_id;

  -- Record audit event
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'STUDENT_ALUMNI_CONVERTED',
    'alumni_profiles',
    p_student_id,
    jsonb_build_object(
      'alumni_id', v_alumni_id,
      'from_status', 'STUDENT_GRADUATED',
      'to_status', 'ALUMNI',
      'graduation_year', v_graduation_year,
      'program_id', v_program_id,
      'reason', v_cleaned_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'alumni_id', v_alumni_id,
    'profile_id', p_student_id,
    'student_lifecycle_status', 'ALUMNI'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.convert_student_to_alumni(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_student_to_alumni(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 5. Alumni Self-Management Procedures
-- ============================================================================

-- Update own alumni professional profile
CREATE OR REPLACE FUNCTION public.update_own_alumni_profile(
  p_current_organization        TEXT DEFAULT NULL,
  p_company_id                  UUID DEFAULT NULL,
  p_current_role                TEXT DEFAULT NULL,
  p_professional_domain         TEXT DEFAULT NULL,
  p_city                        TEXT DEFAULT NULL,
  p_country                     TEXT DEFAULT 'India',
  p_linkedin_url                TEXT DEFAULT NULL,
  p_higher_studies_institution  TEXT DEFAULT NULL,
  p_higher_studies_program      TEXT DEFAULT NULL,
  p_higher_studies_year_start   INTEGER DEFAULT NULL,
  p_willing_to_mentor           BOOLEAN DEFAULT false,
  p_willing_to_refer            BOOLEAN DEFAULT false,
  p_willing_to_support_placement BOOLEAN DEFAULT false,
  p_public_alumni_enabled       BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_consent_at TIMESTAMPTZ;
  v_org        TEXT;
BEGIN
  IF v_student_id IS NULL OR NOT public.is_active_alumni() THEN
    RAISE EXCEPTION 'Unauthorized: Only active alumni can update their professional profile'
      USING ERRCODE = '42501';
  END IF;

  IF p_linkedin_url IS NOT NULL AND p_linkedin_url != '' AND p_linkedin_url !~* '^https?://' THEN
    RAISE EXCEPTION 'LinkedIn URL must start with http:// or https://'
      USING ERRCODE = '22023';
  END IF;

  -- Validate company matching rule
  IF p_company_id IS NOT NULL THEN
    IF p_current_organization IS NOT NULL AND length(trim(p_current_organization)) > 0 THEN
      RAISE EXCEPTION 'Current organization must be NULL when company_id is provided'
        USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id AND NOT is_archived) THEN
      RAISE EXCEPTION 'Referenced company does not exist or is archived'
        USING ERRCODE = 'P0002';
    END IF;
    v_org := NULL;
  ELSE
    v_org := NULLIF(trim(p_current_organization), '');
  END IF;

  -- Consent timestamp management: server database time only
  IF p_public_alumni_enabled = true THEN
    v_consent_at := now();
  ELSE
    v_consent_at := NULL;
  END IF;

  UPDATE public.alumni_profiles
  SET
    current_organization = v_org,
    company_id = p_company_id,
    "current_role" = NULLIF(trim(p_current_role), ''),
    professional_domain = NULLIF(trim(p_professional_domain), ''),
    city = NULLIF(trim(p_city), ''),
    country = COALESCE(NULLIF(trim(p_country), ''), 'India'),
    linkedin_url = NULLIF(trim(p_linkedin_url), ''),
    higher_studies_institution = NULLIF(trim(p_higher_studies_institution), ''),
    higher_studies_program = NULLIF(trim(p_higher_studies_program), ''),
    higher_studies_year_start = p_higher_studies_year_start,
    willing_to_mentor = COALESCE(p_willing_to_mentor, false),
    willing_to_refer = COALESCE(p_willing_to_refer, false),
    willing_to_support_placement = COALESCE(p_willing_to_support_placement, false),
    public_alumni_enabled = COALESCE(p_public_alumni_enabled, false),
    consent_recorded_at = v_consent_at,
    updated_at = now()
  WHERE profile_id = v_student_id;

  RETURN jsonb_build_object(
    'success', true,
    'public_alumni_enabled', COALESCE(p_public_alumni_enabled, false),
    'consent_recorded_at', v_consent_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_alumni_profile(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_alumni_profile(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;

-- Add employment history row
CREATE OR REPLACE FUNCTION public.add_own_alumni_employment(
  p_organization        TEXT,
  p_role                TEXT,
  p_started_at          DATE,
  p_ended_at            DATE DEFAULT NULL,
  p_company_id          UUID DEFAULT NULL,
  p_professional_domain TEXT DEFAULT NULL,
  p_city                TEXT DEFAULT NULL,
  p_country             TEXT DEFAULT NULL,
  p_notes               TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_alumni_id  UUID;
  v_entry_id   UUID;
BEGIN
  IF v_student_id IS NULL OR NOT public.is_active_alumni() THEN
    RAISE EXCEPTION 'Unauthorized: Only active alumni can add employment history'
      USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_alumni_id
  FROM public.alumni_profiles
  WHERE profile_id = v_student_id;

  IF v_alumni_id IS NULL THEN
    RAISE EXCEPTION 'Alumni profile record not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF p_organization IS NULL OR length(trim(p_organization)) = 0 THEN
    RAISE EXCEPTION 'Organization cannot be empty'
      USING ERRCODE = '22023';
  END IF;

  IF p_role IS NULL OR length(trim(p_role)) = 0 THEN
    RAISE EXCEPTION 'Role cannot be empty'
      USING ERRCODE = '22023';
  END IF;

  IF p_ended_at IS NOT NULL AND p_ended_at < p_started_at THEN
    RAISE EXCEPTION 'End date cannot be prior to start date'
      USING ERRCODE = '22023';
  END IF;

  IF p_company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id AND NOT is_archived) THEN
    RAISE EXCEPTION 'Referenced company does not exist or is archived'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.alumni_employment_history (
    alumni_id,
    organization,
    company_id,
    role,
    professional_domain,
    city,
    country,
    started_at,
    ended_at,
    notes
  ) VALUES (
    v_alumni_id,
    trim(p_organization),
    p_company_id,
    trim(p_role),
    NULLIF(trim(p_professional_domain), ''),
    NULLIF(trim(p_city), ''),
    NULLIF(trim(p_country), ''),
    p_started_at,
    p_ended_at,
    NULLIF(trim(p_notes), '')
  )
  RETURNING id INTO v_entry_id;

  RETURN jsonb_build_object(
    'success', true,
    'employment_id', v_entry_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_own_alumni_employment(TEXT, TEXT, DATE, DATE, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_own_alumni_employment(TEXT, TEXT, DATE, DATE, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Note: Alumni employment history is additive institutional history.
-- Ordinary deletion is permanently revoked to preserve career progression records.

-- ============================================================================
-- 6. Staff Alumni Matching & Verification Procedures
-- ============================================================================

-- Match unmatched free-text employer to canonical company
CREATE OR REPLACE FUNCTION public.match_alumni_company(
  p_alumni_id  UUID,
  p_company_id UUID,
  p_reason     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id   UUID := auth.uid();
  v_alumni_pk  UUID;
  v_profile_id UUID;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only active staff can match alumni companies'
      USING ERRCODE = '42501';
  END IF;

  SELECT id, profile_id INTO v_alumni_pk, v_profile_id
  FROM public.alumni_profiles
  WHERE id = p_alumni_id OR profile_id = p_alumni_id
  LIMIT 1
  FOR UPDATE;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Alumni profile record not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_access_student(v_profile_id) THEN
    RAISE EXCEPTION 'Forbidden: Coordinator has no scope over this alumnus'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id AND NOT is_archived) THEN
    RAISE EXCEPTION 'Target company not found or is archived'
      USING ERRCODE = 'P0002';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Reason for matching must be provided'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.alumni_profiles
  SET company_id = p_company_id,
      current_organization = NULL,
      updated_at = now()
  WHERE id = v_alumni_pk;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'ALUMNI_COMPANY_MATCHED',
    'alumni_profiles',
    v_profile_id,
    jsonb_build_object(
      'alumni_id', v_alumni_pk,
      'company_id', p_company_id,
      'reason', trim(p_reason)
    )
  );

  RETURN jsonb_build_object('success', true, 'company_id', p_company_id);
END;
$$;

REVOKE ALL ON FUNCTION public.match_alumni_company(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_alumni_company(UUID, UUID, TEXT) TO authenticated;

-- Verify alumni profile
CREATE OR REPLACE FUNCTION public.verify_alumni_profile(
  p_alumni_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id   UUID := auth.uid();
  v_alumni_pk  UUID;
  v_profile_id UUID;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only active staff can verify alumni profiles'
      USING ERRCODE = '42501';
  END IF;

  SELECT id, profile_id INTO v_alumni_pk, v_profile_id
  FROM public.alumni_profiles
  WHERE id = p_alumni_id OR profile_id = p_alumni_id
  LIMIT 1
  FOR UPDATE;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Alumni profile record not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_access_student(v_profile_id) THEN
    RAISE EXCEPTION 'Forbidden: Coordinator has no scope over this alumnus'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.alumni_profiles
  SET last_verified_at = now(),
      last_verified_by = v_actor_id,
      updated_at = now()
  WHERE id = v_alumni_pk;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'ALUMNI_PROFILE_VERIFIED',
    'alumni_profiles',
    v_profile_id,
    jsonb_build_object('alumni_id', v_alumni_pk)
  );

  RETURN jsonb_build_object('success', true, 'verified_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.verify_alumni_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_alumni_profile(UUID) TO authenticated;

-- ============================================================================
-- 7. Public Alumni RPC: get_public_alumni_directory
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_public_alumni_directory(
  p_graduation_year INTEGER DEFAULT NULL,
  p_program_code    TEXT DEFAULT NULL,
  p_search          TEXT DEFAULT NULL,
  p_limit           INTEGER DEFAULT 20,
  p_offset          INTEGER DEFAULT 0
)
RETURNS TABLE (
  name                 TEXT,
  graduation_year      INTEGER,
  program_code         TEXT,
  program_name         TEXT,
  professional_domain  TEXT,
  city                 TEXT,
  country              TEXT,
  current_employer     TEXT,
  designation          TEXT,
  total_count          BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit INTEGER;
  v_offset INTEGER;
  v_prog_code TEXT := upper(trim(p_program_code));
  v_search TEXT := trim(p_search);
BEGIN
  -- Strict limit clamping: between 1 and 24
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 24);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
  WITH filtered AS (
    SELECT
      p.display_name AS f_name,
      ap.graduation_year AS f_graduation_year,
      prg.code AS f_program_code,
      prg.display_name AS f_program_name,
      ap.professional_domain AS f_professional_domain,
      ap.city AS f_city,
      ap.country AS f_country,
      COALESCE(c.name, ap.current_organization) AS f_current_employer,
      ap."current_role" AS f_designation,
      ap.id AS f_id,
      COUNT(*) OVER() AS f_total_count
    FROM public.alumni_profiles ap
    JOIN public.profiles p ON p.id = ap.profile_id
    JOIN public.academic_programs prg ON prg.id = ap.program_id
    LEFT JOIN public.companies c ON c.id = ap.company_id
    WHERE ap.public_alumni_enabled = true
      AND ap.consent_recorded_at IS NOT NULL
      AND p.is_active = true
      AND p.role = 'STUDENT'
      AND p.student_lifecycle_status = 'ALUMNI'
      AND (p_graduation_year IS NULL OR ap.graduation_year = p_graduation_year)
      AND (v_prog_code IS NULL OR v_prog_code = '' OR prg.code = v_prog_code)
      AND (v_search IS NULL OR v_search = '' OR p.display_name ILIKE '%' || v_search || '%')
  )
  SELECT
    f.f_name,
    f.f_graduation_year,
    f.f_program_code,
    f.f_program_name,
    f.f_professional_domain,
    f.f_city,
    f.f_country,
    f.f_current_employer,
    f.f_designation,
    f.f_total_count
  FROM filtered f
  ORDER BY f.f_name ASC, f.f_graduation_year DESC, f.f_id ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_alumni_directory(INTEGER, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_alumni_directory(INTEGER, TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated, service_role;

-- ============================================================================
-- 8. Staff Views & Analytics
-- ============================================================================

-- Staff Scoped Alumni Directory View
CREATE OR REPLACE VIEW public.v_staff_alumni_directory
WITH (security_invoker = true)
AS
SELECT
  ap.id AS alumni_id,
  ap.profile_id,
  p.display_name AS student_name,
  p.student_lifecycle_status,
  p.is_active AS student_is_active,
  ap.graduation_year,
  ap.program_id,
  prg.code AS program_code,
  prg.display_name AS program_name,
  ap.company_id,
  c.name AS company_name,
  c.website AS company_website,
  c.is_archived AS company_is_archived,
  ap.current_organization,
  COALESCE(c.name, ap.current_organization) AS current_employer,
  ap."current_role",
  ap.professional_domain,
  ap.city,
  ap.country,
  ap.linkedin_url,
  ap.higher_studies_institution,
  ap.higher_studies_program,
  ap.higher_studies_year_start,
  ap.willing_to_mentor,
  ap.willing_to_refer,
  ap.willing_to_support_placement,
  ap.public_alumni_enabled,
  ap.consent_recorded_at,
  ap.last_verified_at,
  ap.last_verified_by,
  ap.created_at,
  ap.updated_at
FROM public.alumni_profiles ap
JOIN public.profiles p ON p.id = ap.profile_id
JOIN public.academic_programs prg ON prg.id = ap.program_id
LEFT JOIN public.companies c ON c.id = ap.company_id
WHERE public.can_access_student(ap.profile_id);

GRANT SELECT ON public.v_staff_alumni_directory TO authenticated;

-- Staff Scoped Employment History View
CREATE OR REPLACE VIEW public.v_staff_alumni_employment_history
WITH (security_invoker = true)
AS
SELECT
  eh.id AS employment_id,
  eh.alumni_id,
  ap.profile_id,
  p.display_name AS student_name,
  eh.organization,
  eh.company_id,
  c.name AS company_name,
  eh.role,
  eh.professional_domain,
  eh.city,
  eh.country,
  eh.started_at,
  eh.ended_at,
  eh.notes,
  eh.created_at
FROM public.alumni_employment_history eh
JOIN public.alumni_profiles ap ON ap.id = eh.alumni_id
JOIN public.profiles p ON p.id = ap.profile_id
LEFT JOIN public.companies c ON c.id = eh.company_id
WHERE public.can_access_student(ap.profile_id);

GRANT SELECT ON public.v_staff_alumni_employment_history TO authenticated;

-- Staff Alumni Analytics Function
CREATE OR REPLACE FUNCTION public.get_staff_alumni_analytics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_top_companies JSONB;
  v_by_year       JSONB;
  v_outreach      JSONB;
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only staff can access alumni analytics'
      USING ERRCODE = '42501';
  END IF;

  -- Top companies where alumni work
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'company_id', t.company_id,
        'company_name', t.name,
        'alumni_count', t.cnt
      )
    ),
    '[]'::jsonb
  ) INTO v_top_companies
  FROM (
    SELECT c.id AS company_id, c.name, COUNT(*) AS cnt
    FROM public.alumni_profiles ap
    JOIN public.companies c ON c.id = ap.company_id
    WHERE public.can_access_student(ap.profile_id)
    GROUP BY c.id, c.name
    ORDER BY cnt DESC, c.name ASC
    LIMIT 10
  ) t;

  -- Alumni count by graduation year
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'graduation_year', y.graduation_year,
        'alumni_count', y.cnt
      )
      ORDER BY y.graduation_year DESC
    ),
    '[]'::jsonb
  ) INTO v_by_year
  FROM (
    SELECT ap.graduation_year, COUNT(*) AS cnt
    FROM public.alumni_profiles ap
    WHERE public.can_access_student(ap.profile_id)
    GROUP BY ap.graduation_year
  ) y;

  -- Outreach candidates counts
  SELECT jsonb_build_object(
    'willing_to_mentor', COUNT(*) FILTER (WHERE ap.willing_to_mentor = true),
    'willing_to_refer', COUNT(*) FILTER (WHERE ap.willing_to_refer = true),
    'willing_to_support_placement', COUNT(*) FILTER (WHERE ap.willing_to_support_placement = true),
    'total_alumni', COUNT(*)
  ) INTO v_outreach
  FROM public.alumni_profiles ap
  WHERE public.can_access_student(ap.profile_id);

  RETURN jsonb_build_object(
    'top_companies', v_top_companies,
    'by_graduation_year', v_by_year,
    'outreach_candidates', v_outreach
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_alumni_analytics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_alumni_analytics() TO authenticated;

-- A. Alumni By Company Analytics
CREATE OR REPLACE FUNCTION public.get_staff_alumni_by_company(
  p_limit  INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  company_id   UUID,
  company_name TEXT,
  is_canonical BOOLEAN,
  alumni_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit  INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only active staff can access alumni company analytics'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH scoped_alumni AS (
    SELECT
      ap.company_id AS c_id,
      ap.current_organization AS c_org
    FROM public.alumni_profiles ap
    JOIN public.profiles p ON p.id = ap.profile_id
    WHERE p.is_active = true
      AND public.can_access_student(ap.profile_id)
  ),
  matched AS (
    SELECT
      c.id AS m_comp_id,
      c.name AS m_comp_name,
      true AS m_is_canon,
      COUNT(*)::BIGINT AS m_cnt
    FROM scoped_alumni sa
    JOIN public.companies c ON c.id = sa.c_id
    GROUP BY c.id, c.name
  ),
  unmatched AS (
    SELECT
      NULL::UUID AS m_comp_id,
      trim(sa.c_org) AS m_comp_name,
      false AS m_is_canon,
      COUNT(*)::BIGINT AS m_cnt
    FROM scoped_alumni sa
    WHERE sa.c_id IS NULL
      AND sa.c_org IS NOT NULL
      AND length(trim(sa.c_org)) > 0
    GROUP BY trim(sa.c_org)
  ),
  combined AS (
    SELECT * FROM matched
    UNION ALL
    SELECT * FROM unmatched
  )
  SELECT
    cb.m_comp_id AS company_id,
    cb.m_comp_name AS company_name,
    cb.m_is_canon AS is_canonical,
    cb.m_cnt AS alumni_count
  FROM combined cb
  ORDER BY cb.m_cnt DESC, cb.m_comp_name ASC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_alumni_by_company(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_alumni_by_company(INTEGER, INTEGER) TO authenticated;

-- B. Alumni By Graduation Year Analytics
CREATE OR REPLACE FUNCTION public.get_staff_alumni_by_year()
RETURNS TABLE (
  graduation_year INTEGER,
  alumni_count    BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only active staff can access graduation year analytics'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ap.graduation_year,
    COUNT(*)::BIGINT AS alumni_count
  FROM public.alumni_profiles ap
  JOIN public.profiles p ON p.id = ap.profile_id
  WHERE p.is_active = true
    AND public.can_access_student(ap.profile_id)
  GROUP BY ap.graduation_year
  ORDER BY ap.graduation_year DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_alumni_by_year() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_alumni_by_year() TO authenticated;

-- C. Alumni Outreach Candidates
CREATE OR REPLACE FUNCTION public.get_staff_alumni_outreach_candidates(
  p_preference TEXT DEFAULT NULL,
  p_limit      INTEGER DEFAULT 50,
  p_offset     INTEGER DEFAULT 0
)
RETURNS TABLE (
  alumni_id                    UUID,
  profile_id                   UUID,
  name                         TEXT,
  graduation_year              INTEGER,
  program_code                 TEXT,
  program_name                 TEXT,
  current_employer             TEXT,
  designation                  TEXT,
  city                         TEXT,
  country                      TEXT,
  linkedin_url                 TEXT,
  willing_to_mentor            BOOLEAN,
  willing_to_refer             BOOLEAN,
  willing_to_support_placement BOOLEAN,
  total_count                  BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit  INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
  v_pref   TEXT := NULLIF(upper(trim(p_preference)), '');
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only active staff can access outreach candidates'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH authorized_candidates AS (
    SELECT
      ap.id AS a_id,
      ap.profile_id AS p_id,
      p.display_name AS a_name,
      ap.graduation_year AS a_grad_yr,
      prog.code AS a_prog_code,
      prog.display_name AS a_prog_name,
      COALESCE(c.name, ap.current_organization) AS a_employer,
      ap."current_role" AS a_role,
      ap.city AS a_city,
      ap.country AS a_country,
      ap.linkedin_url AS a_linkedin,
      ap.willing_to_mentor AS a_mentor,
      ap.willing_to_refer AS a_refer,
      ap.willing_to_support_placement AS a_placement
    FROM public.alumni_profiles ap
    JOIN public.profiles p ON p.id = ap.profile_id
    JOIN public.academic_programs prog ON prog.id = ap.program_id
    LEFT JOIN public.companies c ON c.id = ap.company_id
    WHERE p.is_active = true
      AND public.can_access_student(ap.profile_id)
      AND (ap.willing_to_mentor = true OR ap.willing_to_refer = true OR ap.willing_to_support_placement = true)
      AND (
        v_pref IS NULL
        OR (v_pref = 'MENTOR' AND ap.willing_to_mentor = true)
        OR (v_pref = 'REFER' AND ap.willing_to_refer = true)
        OR (v_pref = 'PLACEMENT' AND ap.willing_to_support_placement = true)
      )
  ),
  counted AS (
    SELECT COUNT(*)::BIGINT AS full_count FROM authorized_candidates
  )
  SELECT
    ac.a_id,
    ac.p_id,
    ac.a_name,
    ac.a_grad_yr,
    ac.a_prog_code,
    ac.a_prog_name,
    ac.a_employer,
    ac.a_role,
    ac.a_city,
    ac.a_country,
    ac.a_linkedin,
    ac.a_mentor,
    ac.a_refer,
    ac.a_placement,
    cnt.full_count
  FROM authorized_candidates ac
  CROSS JOIN counted cnt
  ORDER BY ac.a_grad_yr DESC, ac.a_name ASC, ac.a_id ASC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_alumni_outreach_candidates(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_alumni_outreach_candidates(TEXT, INTEGER, INTEGER) TO authenticated;
