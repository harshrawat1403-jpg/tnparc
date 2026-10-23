-- Migration 19: Phase 12 Exports and Basic Operational Analytics
-- TNP Portal: Department of Architecture & Planning, VNIT Nagpur
-- Implements database-authoritative operational analytics and bounded staff exports.

-- ============================================================================
-- 1. Helper / Audit Event Registration
-- ============================================================================

-- Function to record sanitized DATA_EXPORT_REQUESTED audit event
CREATE OR REPLACE FUNCTION public.record_export_audit(
  p_export_type     TEXT,
  p_filter_summary  JSONB DEFAULT '{}'::jsonb,
  p_row_count       INTEGER DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_role     public.user_role := public.get_user_role();
BEGIN
  -- Strict authority check: Super Admin or TNP Secretary only
  IF v_actor_id IS NULL OR NOT public.is_active_staff() OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin and TNP Secretary can record export audits'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_actor_id,
    'DATA_EXPORT_REQUESTED',
    'exports',
    NULL,
    jsonb_build_object(
      'export_type', p_export_type,
      'filter_summary', COALESCE(p_filter_summary, '{}'::jsonb),
      'row_count', p_row_count,
      'requested_at', clock_timestamp()
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_export_audit(TEXT, JSONB, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_export_audit(TEXT, JSONB, INTEGER) TO authenticated;

-- ============================================================================
-- 2. Staff Operational Analytics RPCs
-- ============================================================================

-- A. Placement Drives by Year (Breakdown by placement vs internship)
CREATE OR REPLACE FUNCTION public.get_staff_drive_statistics(
  p_from_year INTEGER DEFAULT NULL,
  p_to_year   INTEGER DEFAULT NULL
)
RETURNS TABLE (
  "year"             INTEGER,
  placement_drives INTEGER,
  internship_drives INTEGER,
  total_drives      INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_role     public.user_role := public.get_user_role();
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_active_staff() OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin and TNP Secretary can view statistics'
      USING ERRCODE = '42501';
  END IF;

  IF p_from_year IS NOT NULL AND p_to_year IS NOT NULL AND p_from_year > p_to_year THEN
    RAISE EXCEPTION 'Invalid date range: from_year cannot exceed to_year'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    EXTRACT(YEAR FROM pd.published_at)::INTEGER AS "year",
    COUNT(*) FILTER (WHERE pd.drive_type = 'PLACEMENT')::INTEGER AS placement_drives,
    COUNT(*) FILTER (WHERE pd.drive_type = 'INTERNSHIP')::INTEGER AS internship_drives,
    COUNT(*)::INTEGER AS total_drives
  FROM public.placement_drives pd
  WHERE pd.status != 'DRAFT'
    AND pd.published_at IS NOT NULL
    AND (p_from_year IS NULL OR EXTRACT(YEAR FROM pd.published_at) >= p_from_year)
    AND (p_to_year IS NULL OR EXTRACT(YEAR FROM pd.published_at) <= p_to_year)
  GROUP BY EXTRACT(YEAR FROM pd.published_at)::INTEGER
  ORDER BY "year" DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_drive_statistics(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_drive_statistics(INTEGER, INTEGER) TO authenticated;

-- B. Placement Conversion Rate by Drive (Applied -> Selected)
CREATE OR REPLACE FUNCTION public.get_staff_conversion_statistics(
  p_year  INTEGER DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  drive_id       UUID,
  drive_title    TEXT,
  company_name   TEXT,
  drive_type     TEXT,
  drive_status   TEXT,
  published_year INTEGER,
  total_applied  INTEGER,
  total_selected INTEGER,
  conversion_pct DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id    UUID := auth.uid();
  v_role        public.user_role := public.get_user_role();
  v_clean_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_active_staff() OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin and TNP Secretary can view statistics'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pd.id AS drive_id,
    pd.title AS drive_title,
    c.name AS company_name,
    pd.drive_type::TEXT AS drive_type,
    pd.status::TEXT AS drive_status,
    EXTRACT(YEAR FROM pd.published_at)::INTEGER AS published_year,
    COUNT(a.id) FILTER (WHERE a.status != 'WITHDRAWN')::INTEGER AS total_applied,
    COUNT(a.id) FILTER (WHERE a.status = 'SELECTED')::INTEGER AS total_selected,
    COALESCE(
      ROUND(
        COUNT(a.id) FILTER (WHERE a.status = 'SELECTED')::NUMERIC /
        NULLIF(COUNT(a.id) FILTER (WHERE a.status != 'WITHDRAWN'), 0) * 100, 2
      )::DOUBLE PRECISION,
      0.0
    ) AS conversion_pct
  FROM public.placement_drives pd
  JOIN public.companies c ON c.id = pd.company_id
  LEFT JOIN public.applications a ON a.drive_id = pd.id
  WHERE pd.status != 'DRAFT'
    AND pd.published_at IS NOT NULL
    AND (p_year IS NULL OR EXTRACT(YEAR FROM pd.published_at) = p_year)
  GROUP BY pd.id, pd.title, c.name, pd.drive_type, pd.status, pd.published_at
  ORDER BY pd.published_at DESC, pd.id DESC
  LIMIT v_clean_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_conversion_statistics(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_conversion_statistics(INTEGER, INTEGER) TO authenticated;

-- C. Companies Recruiting by Year (PLACEMENT drives with SELECTED students)
CREATE OR REPLACE FUNCTION public.get_staff_companies_by_year(
  p_year  INTEGER DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  "year"             INTEGER,
  company_id       UUID,
  company_name     TEXT,
  students_selected INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id    UUID := auth.uid();
  v_role        public.user_role := public.get_user_role();
  v_clean_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_active_staff() OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin and TNP Secretary can view statistics'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    EXTRACT(YEAR FROM pd.published_at)::INTEGER AS "year",
    c.id AS company_id,
    c.name AS company_name,
    COUNT(DISTINCT a.student_id)::INTEGER AS students_selected
  FROM public.placement_drives pd
  JOIN public.companies c ON c.id = pd.company_id
  JOIN public.applications a ON a.drive_id = pd.id AND a.status = 'SELECTED'
  WHERE pd.drive_type = 'PLACEMENT'
    AND pd.status != 'DRAFT'
    AND pd.published_at IS NOT NULL
    AND (p_year IS NULL OR EXTRACT(YEAR FROM pd.published_at) = p_year)
  GROUP BY EXTRACT(YEAR FROM pd.published_at)::INTEGER, c.id, c.name
  ORDER BY "year" DESC, students_selected DESC, c.name ASC
  LIMIT v_clean_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_companies_by_year(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_companies_by_year(INTEGER, INTEGER) TO authenticated;

-- D. Repeat Recruiters (Companies appearing in multiple distinct years)
CREATE OR REPLACE FUNCTION public.get_staff_repeat_recruiters()
RETURNS TABLE (
  company_id      UUID,
  company_name    TEXT,
  years_recruited INTEGER,
  first_year      INTEGER,
  latest_year     INTEGER,
  total_drives    INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_role     public.user_role := public.get_user_role();
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_active_staff() OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin and TNP Secretary can view statistics'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id AS company_id,
    c.name AS company_name,
    COUNT(DISTINCT EXTRACT(YEAR FROM pd.published_at))::INTEGER AS years_recruited,
    MIN(EXTRACT(YEAR FROM pd.published_at))::INTEGER AS first_year,
    MAX(EXTRACT(YEAR FROM pd.published_at))::INTEGER AS latest_year,
    COUNT(pd.id)::INTEGER AS total_drives
  FROM public.placement_drives pd
  JOIN public.companies c ON c.id = pd.company_id
  WHERE pd.drive_type = 'PLACEMENT'
    AND pd.status IN ('CLOSED', 'ARCHIVED')
    AND pd.published_at IS NOT NULL
  GROUP BY c.id, c.name
  HAVING COUNT(DISTINCT EXTRACT(YEAR FROM pd.published_at)) > 1
  ORDER BY years_recruited DESC, latest_year DESC, c.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_repeat_recruiters() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_repeat_recruiters() TO authenticated;

-- E. Internship-to-Placement Conversion (Students selected in INTERNSHIP then also in PLACEMENT)
CREATE OR REPLACE FUNCTION public.get_staff_internship_placement_conversion()
RETURNS TABLE (
  total_internship_selected INTEGER,
  converted_to_placement    INTEGER,
  conversion_rate_pct       DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id   UUID := auth.uid();
  v_role       public.user_role := public.get_user_role();
  v_intern_cnt INTEGER;
  v_conv_cnt   INTEGER;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_active_staff() OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin and TNP Secretary can view statistics'
      USING ERRCODE = '42501';
  END IF;

  -- Total distinct students selected in any INTERNSHIP drive
  SELECT COUNT(DISTINCT a.student_id)::INTEGER
  INTO v_intern_cnt
  FROM public.applications a
  JOIN public.placement_drives pd ON pd.id = a.drive_id
  WHERE pd.drive_type = 'INTERNSHIP'
    AND a.status = 'SELECTED';

  -- Students selected in INTERNSHIP and also selected in PLACEMENT
  SELECT COUNT(DISTINCT a_p.student_id)::INTEGER
  INTO v_conv_cnt
  FROM public.applications a_i
  JOIN public.placement_drives pd_i ON pd_i.id = a_i.drive_id AND pd_i.drive_type = 'INTERNSHIP'
  JOIN public.applications a_p ON a_p.student_id = a_i.student_id
  JOIN public.placement_drives pd_p ON pd_p.id = a_p.drive_id AND pd_p.drive_type = 'PLACEMENT'
  WHERE a_i.status = 'SELECTED'
    AND a_p.status = 'SELECTED';

  RETURN QUERY
  SELECT
    COALESCE(v_intern_cnt, 0),
    COALESCE(v_conv_cnt, 0),
    COALESCE(
      ROUND(v_conv_cnt::NUMERIC / NULLIF(v_intern_cnt, 0) * 100, 2)::DOUBLE PRECISION,
      0.0
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_internship_placement_conversion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_internship_placement_conversion() TO authenticated;

-- ============================================================================
-- 3. Bounded Staff Export Data RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_staff_export_data(
  p_export_type TEXT,
  p_filters     JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id        UUID := auth.uid();
  v_role            public.user_role := public.get_user_role();
  v_result          JSONB;
  v_count           INTEGER;
  v_drive_id        UUID;
  v_batch           TEXT;
  v_program_code    TEXT;
  v_status          TEXT;
  v_drive_type      TEXT;
  v_year            INTEGER;
BEGIN
  -- Strict authority check: Super Admin or TNP Secretary only
  IF v_actor_id IS NULL OR NOT public.is_active_staff() OR v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin and TNP Secretary can export data'
      USING ERRCODE = '42501';
  END IF;

  -- Validate export type
  IF p_export_type NOT IN (
    'APPLICATIONS',
    'DRIVE_RESULTS',
    'PLACEMENT_OUTCOMES',
    'INTERNSHIP_OUTCOMES',
    'COMPANIES',
    'ALUMNI_INDUSTRY'
  ) THEN
    RAISE EXCEPTION 'Invalid export type: %', p_export_type
      USING ERRCODE = '22023';
  END IF;

  -- Extract and sanitize filter parameters
  IF (p_filters->>'drive_id') IS NOT NULL AND length(p_filters->>'drive_id') > 0 THEN
    v_drive_id := (p_filters->>'drive_id')::UUID;
  END IF;

  IF (p_filters->>'batch') IS NOT NULL AND length(p_filters->>'batch') > 0 THEN
    v_batch := trim(p_filters->>'batch');
  END IF;

  IF (p_filters->>'program_code') IS NOT NULL AND length(p_filters->>'program_code') > 0 THEN
    v_program_code := trim(p_filters->>'program_code');
  END IF;

  IF (p_filters->>'status') IS NOT NULL AND length(p_filters->>'status') > 0 THEN
    v_status := trim(p_filters->>'status');
  END IF;

  IF (p_filters->>'drive_type') IS NOT NULL AND length(p_filters->>'drive_type') > 0 THEN
    v_drive_type := trim(p_filters->>'drive_type');
  END IF;

  IF (p_filters->>'year') IS NOT NULL AND length(p_filters->>'year') > 0 THEN
    v_year := (p_filters->>'year')::INTEGER;
  END IF;

  -- 1. APPLICATIONS EXPORT
  IF p_export_type = 'APPLICATIONS' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.applications a
    JOIN public.placement_drives pd ON pd.id = a.drive_id
    LEFT JOIN public.academic_records ar ON ar.profile_id = a.student_id
    LEFT JOIN public.academic_programs ap ON ap.id = ar.program_id
    WHERE (v_drive_id IS NULL OR pd.id = v_drive_id)
      AND (v_batch IS NULL OR ar.batch = v_batch)
      AND (v_program_code IS NULL OR ap.code = v_program_code)
      AND (v_status IS NULL OR a.status::TEXT = v_status)
      AND (v_drive_type IS NULL OR pd.drive_type::TEXT = v_drive_type);

    IF v_count > 1000 THEN
      RAISE EXCEPTION 'Export row limit exceeded: query matches % rows, maximum allowed is 1000. Please narrow your date or filter range.', v_count
        USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_result
    FROM (
      SELECT
        COALESCE(sr.full_name, p.display_name) AS student_name,
        COALESCE(sr.institutional_id, '') AS roll_number,
        COALESCE(ap.code, '') AS program_code,
        COALESCE(ar.batch, sr.batch, '') AS batch_year,
        pd.title AS drive_title,
        c.name AS company_name,
        pd.drive_type::TEXT AS drive_type,
        a.status::TEXT AS application_status,
        to_char(a.applied_at, 'YYYY-MM-DD HH24:MI:SS') AS applied_at,
        COALESCE(sr.institutional_email, u.email, '') AS institutional_email
      FROM public.applications a
      JOIN public.placement_drives pd ON pd.id = a.drive_id
      JOIN public.companies c ON c.id = pd.company_id
      JOIN public.profiles p ON p.id = a.student_id
      LEFT JOIN public.academic_records ar ON ar.profile_id = a.student_id
      LEFT JOIN public.academic_programs ap ON ap.id = ar.program_id
      LEFT JOIN public.student_roster sr ON sr.claimed_by = a.student_id
      LEFT JOIN auth.users u ON u.id = a.student_id
      WHERE (v_drive_id IS NULL OR pd.id = v_drive_id)
        AND (v_batch IS NULL OR ar.batch = v_batch)
        AND (v_program_code IS NULL OR ap.code = v_program_code)
        AND (v_status IS NULL OR a.status::TEXT = v_status)
        AND (v_drive_type IS NULL OR pd.drive_type::TEXT = v_drive_type)
      ORDER BY a.applied_at DESC, a.id DESC
      LIMIT 1000
    ) sub;

  -- 2. DRIVE RESULTS EXPORT
  ELSIF p_export_type = 'DRIVE_RESULTS' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.placement_drives pd
    WHERE pd.status != 'DRAFT'
      AND pd.published_at IS NOT NULL
      AND (v_year IS NULL OR EXTRACT(YEAR FROM pd.published_at) = v_year)
      AND (v_drive_type IS NULL OR pd.drive_type::TEXT = v_drive_type);

    IF v_count > 1000 THEN
      RAISE EXCEPTION 'Export row limit exceeded: query matches % rows, maximum allowed is 1000. Please narrow your date or filter range.', v_count
        USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_result
    FROM (
      SELECT
        pd.title AS drive_title,
        c.name AS company_name,
        pd.drive_type::TEXT AS drive_type,
        pd.status::TEXT AS drive_status,
        EXTRACT(YEAR FROM pd.published_at)::INTEGER AS published_year,
        COUNT(a.id) FILTER (WHERE a.status != 'WITHDRAWN')::INTEGER AS total_applied,
        COUNT(a.id) FILTER (WHERE a.status = 'SELECTED')::INTEGER AS total_selected,
        COALESCE(
          ROUND(
            COUNT(a.id) FILTER (WHERE a.status = 'SELECTED')::NUMERIC /
            NULLIF(COUNT(a.id) FILTER (WHERE a.status != 'WITHDRAWN'), 0) * 100, 2
          )::DOUBLE PRECISION,
          0.0
        ) AS conversion_percentage
      FROM public.placement_drives pd
      JOIN public.companies c ON c.id = pd.company_id
      LEFT JOIN public.applications a ON a.drive_id = pd.id
      WHERE pd.status != 'DRAFT'
        AND pd.published_at IS NOT NULL
        AND (v_year IS NULL OR EXTRACT(YEAR FROM pd.published_at) = v_year)
        AND (v_drive_type IS NULL OR pd.drive_type::TEXT = v_drive_type)
      GROUP BY pd.id, pd.title, c.name, pd.drive_type, pd.status, pd.published_at
      ORDER BY pd.published_at DESC, pd.id DESC
      LIMIT 1000
    ) sub;

  -- 3. PLACEMENT OUTCOMES EXPORT
  ELSIF p_export_type = 'PLACEMENT_OUTCOMES' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.applications a
    JOIN public.placement_drives pd ON pd.id = a.drive_id
    LEFT JOIN public.academic_records ar ON ar.profile_id = a.student_id
    LEFT JOIN public.academic_programs ap ON ap.id = ar.program_id
    WHERE pd.drive_type = 'PLACEMENT'
      AND a.status = 'SELECTED'
      AND pd.status != 'DRAFT'
      AND (v_year IS NULL OR EXTRACT(YEAR FROM pd.published_at) = v_year)
      AND (v_batch IS NULL OR ar.batch = v_batch)
      AND (v_program_code IS NULL OR ap.code = v_program_code);

    IF v_count > 1000 THEN
      RAISE EXCEPTION 'Export row limit exceeded: query matches % rows, maximum allowed is 1000. Please narrow your date or filter range.', v_count
        USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_result
    FROM (
      SELECT
        COALESCE(sr.full_name, p.display_name) AS student_name,
        COALESCE(sr.institutional_id, '') AS roll_number,
        COALESCE(ap.code, '') AS program_code,
        COALESCE(ar.batch, sr.batch, '') AS batch_year,
        c.name AS company_name,
        pd.title AS drive_title,
        EXTRACT(YEAR FROM pd.published_at)::INTEGER AS recruitment_year,
        to_char(a.updated_at, 'YYYY-MM-DD') AS selection_date,
        COALESCE(sr.institutional_email, u.email, '') AS institutional_email
      FROM public.applications a
      JOIN public.placement_drives pd ON pd.id = a.drive_id
      JOIN public.companies c ON c.id = pd.company_id
      JOIN public.profiles p ON p.id = a.student_id
      LEFT JOIN public.academic_records ar ON ar.profile_id = a.student_id
      LEFT JOIN public.academic_programs ap ON ap.id = ar.program_id
      LEFT JOIN public.student_roster sr ON sr.claimed_by = a.student_id
      LEFT JOIN auth.users u ON u.id = a.student_id
      WHERE pd.drive_type = 'PLACEMENT'
        AND a.status = 'SELECTED'
        AND pd.status != 'DRAFT'
        AND (v_year IS NULL OR EXTRACT(YEAR FROM pd.published_at) = v_year)
        AND (v_batch IS NULL OR ar.batch = v_batch)
        AND (v_program_code IS NULL OR ap.code = v_program_code)
      ORDER BY pd.published_at DESC, c.name ASC, a.id ASC
      LIMIT 1000
    ) sub;

  -- 4. INTERNSHIP OUTCOMES EXPORT
  ELSIF p_export_type = 'INTERNSHIP_OUTCOMES' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.applications a
    JOIN public.placement_drives pd ON pd.id = a.drive_id
    LEFT JOIN public.academic_records ar ON ar.profile_id = a.student_id
    LEFT JOIN public.academic_programs ap ON ap.id = ar.program_id
    WHERE pd.drive_type = 'INTERNSHIP'
      AND a.status = 'SELECTED'
      AND pd.status != 'DRAFT'
      AND (v_year IS NULL OR EXTRACT(YEAR FROM pd.published_at) = v_year)
      AND (v_batch IS NULL OR ar.batch = v_batch)
      AND (v_program_code IS NULL OR ap.code = v_program_code);

    IF v_count > 1000 THEN
      RAISE EXCEPTION 'Export row limit exceeded: query matches % rows, maximum allowed is 1000. Please narrow your date or filter range.', v_count
        USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_result
    FROM (
      SELECT
        COALESCE(sr.full_name, p.display_name) AS student_name,
        COALESCE(sr.institutional_id, '') AS roll_number,
        COALESCE(ap.code, '') AS program_code,
        COALESCE(ar.batch, sr.batch, '') AS batch_year,
        c.name AS company_name,
        pd.title AS drive_title,
        EXTRACT(YEAR FROM pd.published_at)::INTEGER AS recruitment_year,
        to_char(a.updated_at, 'YYYY-MM-DD') AS selection_date,
        COALESCE(sr.institutional_email, u.email, '') AS institutional_email
      FROM public.applications a
      JOIN public.placement_drives pd ON pd.id = a.drive_id
      JOIN public.companies c ON c.id = pd.company_id
      JOIN public.profiles p ON p.id = a.student_id
      LEFT JOIN public.academic_records ar ON ar.profile_id = a.student_id
      LEFT JOIN public.academic_programs ap ON ap.id = ar.program_id
      LEFT JOIN public.student_roster sr ON sr.claimed_by = a.student_id
      LEFT JOIN auth.users u ON u.id = a.student_id
      WHERE pd.drive_type = 'INTERNSHIP'
        AND a.status = 'SELECTED'
        AND pd.status != 'DRAFT'
        AND (v_year IS NULL OR EXTRACT(YEAR FROM pd.published_at) = v_year)
        AND (v_batch IS NULL OR ar.batch = v_batch)
        AND (v_program_code IS NULL OR ap.code = v_program_code)
      ORDER BY pd.published_at DESC, c.name ASC, a.id ASC
      LIMIT 1000
    ) sub;

  -- 5. COMPANIES EXPORT
  ELSIF p_export_type = 'COMPANIES' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.companies c
    WHERE c.is_archived = false;

    IF v_count > 1000 THEN
      RAISE EXCEPTION 'Export row limit exceeded: query matches % rows, maximum allowed is 1000.', v_count
        USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_result
    FROM (
      SELECT
        c.name AS company_name,
        COALESCE(c.website, '') AS website,
        COUNT(DISTINCT pd.id)::INTEGER AS total_drives,
        COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'SELECTED')::INTEGER AS total_hires,
        MIN(EXTRACT(YEAR FROM pd.published_at))::INTEGER AS first_recruiting_year,
        MAX(EXTRACT(YEAR FROM pd.published_at))::INTEGER AS latest_recruiting_year
      FROM public.companies c
      LEFT JOIN public.placement_drives pd ON pd.company_id = c.id AND pd.status != 'DRAFT'
      LEFT JOIN public.applications a ON a.drive_id = pd.id
      WHERE c.is_archived = false
        AND (v_year IS NULL OR EXTRACT(YEAR FROM pd.published_at) = v_year)
      GROUP BY c.id, c.name, c.website
      ORDER BY total_hires DESC, total_drives DESC, c.name ASC
      LIMIT 1000
    ) sub;

  -- 6. ALUMNI INDUSTRY EXPORT
  ELSIF p_export_type = 'ALUMNI_INDUSTRY' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.alumni_profiles alp
    LEFT JOIN public.academic_programs ap ON ap.id = alp.program_id
    WHERE (v_batch IS NULL OR alp.graduation_year::TEXT = v_batch)
      AND (v_program_code IS NULL OR ap.code = v_program_code);

    IF v_count > 1000 THEN
      RAISE EXCEPTION 'Export row limit exceeded: query matches % rows, maximum allowed is 1000. Please narrow your date or filter range.', v_count
        USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_result
    FROM (
      SELECT
        p.display_name AS alumnus_name,
        alp.graduation_year,
        ap.code AS degree_program,
        COALESCE(alp.current_organization, '') AS current_organization,
        COALESCE(c.name, '') AS matched_company_name,
        COALESCE(alp.current_role, '') AS current_role,
        COALESCE(alp.city, '') AS city,
        alp.country,
        (alp.last_verified_at IS NOT NULL) AS is_verified
      FROM public.alumni_profiles alp
      JOIN public.profiles p ON p.id = alp.profile_id
      JOIN public.academic_programs ap ON ap.id = alp.program_id
      LEFT JOIN public.companies c ON c.id = alp.company_id
      WHERE (v_batch IS NULL OR alp.graduation_year::TEXT = v_batch)
        AND (v_program_code IS NULL OR ap.code = v_program_code)
      ORDER BY alp.graduation_year DESC, p.display_name ASC
      LIMIT 1000
    ) sub;
  END IF;

  RETURN jsonb_build_object(
    'export_type', p_export_type,
    'row_count', v_count,
    'data', v_result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_export_data(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_export_data(TEXT, JSONB) TO authenticated;
