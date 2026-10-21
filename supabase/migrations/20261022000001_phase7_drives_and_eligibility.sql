-- Migration 15: Phase 7 Placement Drives, Drive Eligibility & Recruiter Drive Access
-- Authoritative schema RLS policies, views, lifecycle procedures, and eligibility evaluator

-- ============================================================================
-- 1. Row Level Security Policies
-- ============================================================================

-- A. placement_drives
REVOKE ALL ON placement_drives FROM PUBLIC, anon, authenticated;
GRANT SELECT ON placement_drives TO authenticated;

-- Helper function (SECURITY DEFINER) to check if a company has published drives
-- Breaking RLS mutual recursion between companies and placement_drives
CREATE OR REPLACE FUNCTION company_has_published_drive(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM placement_drives
    WHERE company_id = p_company_id
      AND status = 'PUBLISHED'
  );
$$;

REVOKE ALL ON FUNCTION company_has_published_drive(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION company_has_published_drive(UUID) TO authenticated;

-- Allow active students to view companies that have published placement drives
DROP POLICY IF EXISTS companies_select_student ON companies;
CREATE POLICY companies_select_student ON companies
  FOR SELECT
  USING (
    is_active_student()
    AND company_has_published_drive(id)
  );

DROP POLICY IF EXISTS drives_select_staff ON placement_drives;
CREATE POLICY drives_select_staff ON placement_drives
  FOR SELECT
  USING (is_active_staff());

DROP POLICY IF EXISTS drives_select_student ON placement_drives;
CREATE POLICY drives_select_student ON placement_drives
  FOR SELECT
  USING (
    status = 'PUBLISHED'
    AND is_active_student()
  );

DROP POLICY IF EXISTS drives_select_recruiter ON placement_drives;
CREATE POLICY drives_select_recruiter ON placement_drives
  FOR SELECT
  USING (
    status = 'PUBLISHED'
    AND EXISTS (
      SELECT 1 FROM recruiter_profiles rp
      JOIN recruiter_contacts rc ON rc.id = rp.recruiter_contact_id
      JOIN companies c ON c.id = rp.company_id
      JOIN recruiter_drive_access rda ON rda.recruiter_profile_id = rp.id
      WHERE rp.profile_id = auth.uid()
        AND rda.drive_id = placement_drives.id
        AND rda.revoked_at IS NULL
        AND (rda.expires_at IS NULL OR rda.expires_at > now())
        AND rc.is_active = true
        AND c.is_archived = false
    )
  );

-- B. drive_eligibility
REVOKE ALL ON drive_eligibility FROM PUBLIC, anon, authenticated;
GRANT SELECT ON drive_eligibility TO authenticated;

DROP POLICY IF EXISTS drive_eligibility_select_staff ON drive_eligibility;
CREATE POLICY drive_eligibility_select_staff ON drive_eligibility
  FOR SELECT
  USING (is_active_staff());

DROP POLICY IF EXISTS drive_eligibility_select_student ON drive_eligibility;
CREATE POLICY drive_eligibility_select_student ON drive_eligibility
  FOR SELECT
  USING (
    is_active_student()
    AND EXISTS (
      SELECT 1 FROM placement_drives pd
      WHERE pd.id = drive_eligibility.drive_id
        AND pd.status = 'PUBLISHED'
    )
  );

DROP POLICY IF EXISTS drive_eligibility_select_recruiter ON drive_eligibility;
CREATE POLICY drive_eligibility_select_recruiter ON drive_eligibility
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recruiter_profiles rp
      JOIN recruiter_contacts rc ON rc.id = rp.recruiter_contact_id
      JOIN companies c ON c.id = rp.company_id
      JOIN recruiter_drive_access rda ON rda.recruiter_profile_id = rp.id
      JOIN placement_drives pd ON pd.id = rda.drive_id
      WHERE rp.profile_id = auth.uid()
        AND rda.drive_id = drive_eligibility.drive_id
        AND pd.status = 'PUBLISHED'
        AND rda.revoked_at IS NULL
        AND (rda.expires_at IS NULL OR rda.expires_at > now())
        AND rc.is_active = true
        AND c.is_archived = false
    )
  );

-- C. drive_eligible_batches
REVOKE ALL ON drive_eligible_batches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON drive_eligible_batches TO authenticated;

DROP POLICY IF EXISTS drive_eligible_batches_select_staff ON drive_eligible_batches;
CREATE POLICY drive_eligible_batches_select_staff ON drive_eligible_batches
  FOR SELECT
  USING (is_active_staff());

DROP POLICY IF EXISTS drive_eligible_batches_select_student ON drive_eligible_batches;
CREATE POLICY drive_eligible_batches_select_student ON drive_eligible_batches
  FOR SELECT
  USING (
    is_active_student()
    AND EXISTS (
      SELECT 1 FROM placement_drives pd
      WHERE pd.id = drive_eligible_batches.drive_id
        AND pd.status = 'PUBLISHED'
    )
  );

DROP POLICY IF EXISTS drive_eligible_batches_select_recruiter ON drive_eligible_batches;
CREATE POLICY drive_eligible_batches_select_recruiter ON drive_eligible_batches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recruiter_profiles rp
      JOIN recruiter_contacts rc ON rc.id = rp.recruiter_contact_id
      JOIN companies c ON c.id = rp.company_id
      JOIN recruiter_drive_access rda ON rda.recruiter_profile_id = rp.id
      JOIN placement_drives pd ON pd.id = rda.drive_id
      WHERE rp.profile_id = auth.uid()
        AND rda.drive_id = drive_eligible_batches.drive_id
        AND pd.status = 'PUBLISHED'
        AND rda.revoked_at IS NULL
        AND (rda.expires_at IS NULL OR rda.expires_at > now())
        AND rc.is_active = true
        AND c.is_archived = false
    )
  );

-- D. recruiter_drive_access
REVOKE ALL ON recruiter_drive_access FROM PUBLIC, anon, authenticated;
GRANT SELECT ON recruiter_drive_access TO authenticated;

DROP POLICY IF EXISTS rda_select_staff ON recruiter_drive_access;
CREATE POLICY rda_select_staff ON recruiter_drive_access
  FOR SELECT
  USING (is_active_staff());

DROP POLICY IF EXISTS rda_select_recruiter ON recruiter_drive_access;
CREATE POLICY rda_select_recruiter ON recruiter_drive_access
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recruiter_profiles rp
      WHERE rp.id = recruiter_drive_access.recruiter_profile_id
        AND rp.profile_id = auth.uid()
    )
  );

-- ============================================================================
-- 2. Domain Views (Safe Projections)
-- ============================================================================

-- A. Staff Overview View
CREATE OR REPLACE VIEW v_staff_drives
WITH (security_invoker = true)
AS
SELECT
  pd.id,
  pd.company_id,
  c.name AS company_name,
  c.is_archived AS company_is_archived,
  pd.title,
  pd.drive_type,
  pd.status,
  pd.description,
  pd.location,
  pd.application_deadline,
  pd.package_lpa,
  pd.stipend_monthly,
  pd.compensation_details,
  pd.requirements_info,
  pd.created_by,
  cp.display_name AS created_by_name,
  pd.published_by,
  pp.display_name AS published_by_name,
  pd.published_at,
  pd.closed_by,
  clp.display_name AS closed_by_name,
  pd.closed_at,
  pd.archived_by,
  ap.display_name AS archived_by_name,
  pd.archived_at,
  pd.created_at,
  pd.updated_at,
  COALESCE(eb.batch_count, 0) AS eligible_batches_count,
  COALESCE(rda.grant_count, 0) AS recruiter_grants_count
FROM placement_drives pd
JOIN companies c ON c.id = pd.company_id
LEFT JOIN profiles cp ON cp.id = pd.created_by
LEFT JOIN profiles pp ON pp.id = pd.published_by
LEFT JOIN profiles clp ON clp.id = pd.closed_by
LEFT JOIN profiles ap ON ap.id = pd.archived_by
LEFT JOIN (
  SELECT drive_id, COUNT(*) AS batch_count
  FROM drive_eligible_batches
  GROUP BY drive_id
) eb ON eb.drive_id = pd.id
LEFT JOIN (
  SELECT drive_id, COUNT(*) AS grant_count
  FROM recruiter_drive_access
  WHERE revoked_at IS NULL
  GROUP BY drive_id
) rda ON rda.drive_id = pd.id;

REVOKE ALL ON v_staff_drives FROM PUBLIC, anon;
GRANT SELECT ON v_staff_drives TO authenticated;

-- B. Student Published Drives View
CREATE OR REPLACE VIEW v_student_published_drives
WITH (security_invoker = true)
AS
SELECT
  pd.id,
  pd.company_id,
  c.name AS company_name,
  c.website AS company_website,
  pd.title,
  pd.drive_type,
  pd.status,
  pd.description,
  pd.location,
  pd.application_deadline,
  pd.package_lpa,
  pd.stipend_monthly,
  pd.compensation_details,
  pd.requirements_info,
  pd.published_at,
  (pd.application_deadline IS NOT NULL AND pd.application_deadline > now()) AS is_open
FROM placement_drives pd
JOIN companies c ON c.id = pd.company_id
WHERE pd.status = 'PUBLISHED';

REVOKE ALL ON v_student_published_drives FROM PUBLIC, anon;
GRANT SELECT ON v_student_published_drives TO authenticated;

-- C. Recruiter Granted Drives View (projects approved company display fields for granted drives)
CREATE OR REPLACE VIEW v_recruiter_granted_drives AS
SELECT
  pd.id,
  pd.company_id,
  c.name AS company_name,
  c.website AS company_website,
  pd.title,
  pd.drive_type,
  pd.status,
  pd.description,
  pd.location,
  pd.application_deadline,
  pd.package_lpa,
  pd.stipend_monthly,
  pd.compensation_details,
  pd.requirements_info,
  pd.published_at,
  (pd.application_deadline IS NOT NULL AND pd.application_deadline > now()) AS is_open,
  rda.id AS access_grant_id,
  rda.granted_at,
  rda.expires_at
FROM placement_drives pd
JOIN companies c ON c.id = pd.company_id
JOIN recruiter_drive_access rda ON rda.drive_id = pd.id
JOIN recruiter_profiles rp ON rp.id = rda.recruiter_profile_id
WHERE pd.status = 'PUBLISHED'
  AND rp.profile_id = auth.uid()
  AND rda.revoked_at IS NULL
  AND (rda.expires_at IS NULL OR rda.expires_at > now())
  AND c.is_archived = false;

REVOKE ALL ON v_recruiter_granted_drives FROM PUBLIC, anon;
GRANT SELECT ON v_recruiter_granted_drives TO authenticated;

-- ============================================================================
-- 3. Staff Drive CRUD & Configuration Procedures
-- ============================================================================

-- Create a placement drive in DRAFT status
CREATE OR REPLACE FUNCTION create_placement_drive(
  p_company_id           UUID,
  p_title                TEXT,
  p_drive_type           drive_type,
  p_description          TEXT DEFAULT NULL,
  p_location             TEXT DEFAULT NULL,
  p_application_deadline TIMESTAMPTZ DEFAULT NULL,
  p_package_lpa          NUMERIC DEFAULT NULL,
  p_stipend_monthly      NUMERIC DEFAULT NULL,
  p_compensation_details TEXT DEFAULT NULL,
  p_requirements_info    TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id    UUID := auth.uid();
  v_company     companies%ROWTYPE;
  v_clean_title TEXT;
  v_drive_id    UUID;
BEGIN
  IF NOT is_active_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only active staff can create placement drives';
  END IF;

  SELECT * INTO v_company FROM companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  IF v_company.is_archived THEN
    RAISE EXCEPTION 'Cannot create placement drive for an archived company';
  END IF;

  v_clean_title := NULLIF(trim(p_title), '');
  IF v_clean_title IS NULL THEN
    RAISE EXCEPTION 'Drive title cannot be empty';
  END IF;

  IF length(v_clean_title) > 200 THEN
    RAISE EXCEPTION 'Drive title cannot exceed 200 characters';
  END IF;

  IF p_package_lpa IS NOT NULL AND (p_package_lpa < 0 OR p_package_lpa > 9999.99) THEN
    RAISE EXCEPTION 'Package LPA must be between 0 and 9999.99';
  END IF;

  IF p_stipend_monthly IS NOT NULL AND (p_stipend_monthly < 0 OR p_stipend_monthly > 99999999.99) THEN
    RAISE EXCEPTION 'Monthly stipend must be positive';
  END IF;

  INSERT INTO placement_drives (
    company_id,
    title,
    drive_type,
    status,
    description,
    location,
    application_deadline,
    package_lpa,
    stipend_monthly,
    compensation_details,
    requirements_info,
    created_by
  ) VALUES (
    p_company_id,
    v_clean_title,
    p_drive_type,
    'DRAFT',
    NULLIF(trim(p_description), ''),
    NULLIF(trim(p_location), ''),
    p_application_deadline,
    p_package_lpa,
    p_stipend_monthly,
    NULLIF(trim(p_compensation_details), ''),
    NULLIF(trim(p_requirements_info), ''),
    v_actor_id
  ) RETURNING id INTO v_drive_id;

  -- Automatically initialize default single eligibility threshold row
  INSERT INTO drive_eligibility (
    drive_id,
    minimum_cgpa,
    maximum_active_backlogs,
    exclude_previously_selected_placement
  ) VALUES (
    v_drive_id,
    0.00,
    0,
    true
  ) ON CONFLICT (drive_id) DO NOTHING;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'DRIVE_CREATED',
    'placement_drive',
    v_drive_id,
    jsonb_build_object(
      'company_id', p_company_id,
      'title', v_clean_title,
      'drive_type', p_drive_type
    )
  );

  RETURN jsonb_build_object('success', true, 'drive_id', v_drive_id);
END;
$$;

REVOKE ALL ON FUNCTION create_placement_drive(UUID, TEXT, drive_type, TEXT, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_placement_drive(UUID, TEXT, drive_type, TEXT, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;

-- Update DRAFT placement drive details
CREATE OR REPLACE FUNCTION update_placement_drive(
  p_drive_id             UUID,
  p_title                TEXT,
  p_description          TEXT DEFAULT NULL,
  p_location             TEXT DEFAULT NULL,
  p_application_deadline TIMESTAMPTZ DEFAULT NULL,
  p_package_lpa          NUMERIC DEFAULT NULL,
  p_stipend_monthly      NUMERIC DEFAULT NULL,
  p_compensation_details TEXT DEFAULT NULL,
  p_requirements_info    TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id    UUID := auth.uid();
  v_drive       placement_drives%ROWTYPE;
  v_clean_title TEXT;
BEGIN
  IF NOT is_active_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only active staff can update placement drives';
  END IF;

  -- Lock drive row and verify DRAFT state
  SELECT * INTO v_drive FROM placement_drives WHERE id = p_drive_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement drive not found';
  END IF;

  IF v_drive.status != 'DRAFT' THEN
    RAISE EXCEPTION 'Cannot update drive: drive status is %, only DRAFT drives can be edited', v_drive.status;
  END IF;

  v_clean_title := NULLIF(trim(p_title), '');
  IF v_clean_title IS NULL THEN
    RAISE EXCEPTION 'Drive title cannot be empty';
  END IF;

  IF length(v_clean_title) > 200 THEN
    RAISE EXCEPTION 'Drive title cannot exceed 200 characters';
  END IF;

  IF p_package_lpa IS NOT NULL AND (p_package_lpa < 0 OR p_package_lpa > 9999.99) THEN
    RAISE EXCEPTION 'Package LPA must be between 0 and 9999.99';
  END IF;

  IF p_stipend_monthly IS NOT NULL AND (p_stipend_monthly < 0 OR p_stipend_monthly > 99999999.99) THEN
    RAISE EXCEPTION 'Monthly stipend must be positive';
  END IF;

  UPDATE placement_drives
  SET title = v_clean_title,
      description = COALESCE(NULLIF(trim(p_description), ''), v_drive.description),
      location = COALESCE(NULLIF(trim(p_location), ''), v_drive.location),
      application_deadline = COALESCE(p_application_deadline, v_drive.application_deadline),
      package_lpa = COALESCE(p_package_lpa, v_drive.package_lpa),
      stipend_monthly = COALESCE(p_stipend_monthly, v_drive.stipend_monthly),
      compensation_details = COALESCE(NULLIF(trim(p_compensation_details), ''), v_drive.compensation_details),
      requirements_info = COALESCE(NULLIF(trim(p_requirements_info), ''), v_drive.requirements_info),
      updated_at = now()
  WHERE id = p_drive_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'DRIVE_UPDATED',
    'placement_drive',
    p_drive_id,
    jsonb_build_object('title', v_clean_title)
  );

  RETURN jsonb_build_object('success', true, 'drive_id', p_drive_id);
END;
$$;

REVOKE ALL ON FUNCTION update_placement_drive(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_placement_drive(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;

-- Configure Drive Eligibility criteria
CREATE OR REPLACE FUNCTION configure_drive_eligibility(
  p_drive_id                              UUID,
  p_minimum_cgpa                          NUMERIC,
  p_maximum_active_backlogs               INTEGER,
  p_exclude_previously_selected_placement BOOLEAN DEFAULT true,
  p_informational_requirements            TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_drive    placement_drives%ROWTYPE;
BEGIN
  IF NOT is_active_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only active staff can configure drive eligibility';
  END IF;

  SELECT * INTO v_drive FROM placement_drives WHERE id = p_drive_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement drive not found';
  END IF;

  IF v_drive.status != 'DRAFT' THEN
    RAISE EXCEPTION 'Cannot configure eligibility: drive status is %, only DRAFT drives can be configured', v_drive.status;
  END IF;

  IF p_minimum_cgpa < 0.00 OR p_minimum_cgpa > 10.00 THEN
    RAISE EXCEPTION 'Minimum CGPA must be between 0.00 and 10.00';
  END IF;

  IF p_maximum_active_backlogs < 0 THEN
    RAISE EXCEPTION 'Maximum active backlogs cannot be negative';
  END IF;

  INSERT INTO drive_eligibility (
    drive_id,
    minimum_cgpa,
    maximum_active_backlogs,
    exclude_previously_selected_placement,
    informational_requirements,
    updated_at
  ) VALUES (
    p_drive_id,
    p_minimum_cgpa,
    p_maximum_active_backlogs,
    COALESCE(p_exclude_previously_selected_placement, true),
    NULLIF(trim(p_informational_requirements), ''),
    now()
  )
  ON CONFLICT (drive_id) DO UPDATE
  SET minimum_cgpa = EXCLUDED.minimum_cgpa,
      maximum_active_backlogs = EXCLUDED.maximum_active_backlogs,
      exclude_previously_selected_placement = EXCLUDED.exclude_previously_selected_placement,
      informational_requirements = EXCLUDED.informational_requirements,
      updated_at = now();

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'DRIVE_ELIGIBILITY_UPDATED',
    'placement_drive',
    p_drive_id,
    jsonb_build_object(
      'minimum_cgpa', p_minimum_cgpa,
      'maximum_active_backlogs', p_maximum_active_backlogs,
      'exclude_previously_selected_placement', p_exclude_previously_selected_placement
    )
  );

  RETURN jsonb_build_object('success', true, 'drive_id', p_drive_id);
END;
$$;

REVOKE ALL ON FUNCTION configure_drive_eligibility(UUID, NUMERIC, INTEGER, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION configure_drive_eligibility(UUID, NUMERIC, INTEGER, BOOLEAN, TEXT) TO authenticated;

-- Configure Drive Eligible Batches
CREATE OR REPLACE FUNCTION configure_drive_eligible_batches(
  p_drive_id UUID,
  p_batches  JSONB -- Array of objects: [{"program_id": "...", "batch": "..."}]
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_drive    placement_drives%ROWTYPE;
  v_item     JSONB;
  v_prog_id  UUID;
  v_batch    TEXT;
  v_count    INTEGER := 0;
BEGIN
  IF NOT is_active_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only active staff can configure eligible batches';
  END IF;

  SELECT * INTO v_drive FROM placement_drives WHERE id = p_drive_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement drive not found';
  END IF;

  IF v_drive.status != 'DRAFT' THEN
    RAISE EXCEPTION 'Cannot configure eligible batches: drive status is %, only DRAFT drives can be configured', v_drive.status;
  END IF;

  IF jsonb_typeof(p_batches) != 'array' THEN
    RAISE EXCEPTION 'p_batches must be a JSON array of program_id and batch objects';
  END IF;

  -- Clear existing batches
  DELETE FROM drive_eligible_batches WHERE drive_id = p_drive_id;

  -- Insert new batch pairs
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_batches)
  LOOP
    v_prog_id := (v_item->>'program_id')::UUID;
    v_batch   := NULLIF(trim(v_item->>'batch'), '');

    IF v_prog_id IS NULL OR v_batch IS NULL THEN
      RAISE EXCEPTION 'Each cohort item must have a valid program_id and non-empty batch';
    END IF;

    -- Validate program exists and is placement_eligible
    IF NOT EXISTS (
      SELECT 1 FROM academic_programs WHERE id = v_prog_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Academic program % does not exist or is inactive', v_prog_id;
    END IF;

    INSERT INTO drive_eligible_batches (drive_id, program_id, batch)
    VALUES (p_drive_id, v_prog_id, v_batch)
    ON CONFLICT (drive_id, program_id, batch) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'DRIVE_ELIGIBLE_BATCHES_UPDATED',
    'placement_drive',
    p_drive_id,
    jsonb_build_object('batch_count', v_count)
  );

  RETURN jsonb_build_object('success', true, 'drive_id', p_drive_id, 'batches_count', v_count);
END;
$$;

REVOKE ALL ON FUNCTION configure_drive_eligible_batches(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION configure_drive_eligible_batches(UUID, JSONB) TO authenticated;

-- ============================================================================
-- 4. Drive Lifecycle State Machine Procedures (Super Admin & Secretary Only)
-- ============================================================================

-- Publish Placement Drive (DRAFT -> PUBLISHED)
CREATE OR REPLACE FUNCTION publish_placement_drive(p_drive_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id    UUID := auth.uid();
  v_drive       placement_drives%ROWTYPE;
  v_company     companies%ROWTYPE;
  v_batch_count INTEGER;
BEGIN
  IF NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can publish placement drives';
  END IF;

  SELECT * INTO v_drive FROM placement_drives WHERE id = p_drive_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement drive not found';
  END IF;

  IF v_drive.status != 'DRAFT' THEN
    RAISE EXCEPTION 'Cannot publish drive: current status is %, expected DRAFT', v_drive.status;
  END IF;

  -- 1. Validate parent company is active
  SELECT * INTO v_company FROM companies WHERE id = v_drive.company_id;
  IF NOT FOUND OR v_company.is_archived THEN
    RAISE EXCEPTION 'Cannot publish drive: parent company is archived or not found';
  END IF;

  -- 2. Validate application deadline
  IF v_drive.application_deadline IS NULL THEN
    RAISE EXCEPTION 'Cannot publish drive: application deadline is required';
  END IF;

  IF v_drive.application_deadline <= now() THEN
    RAISE EXCEPTION 'Cannot publish drive: application deadline must be in the future';
  END IF;

  -- 3. Validate eligibility row exists
  IF NOT EXISTS (SELECT 1 FROM drive_eligibility WHERE drive_id = p_drive_id) THEN
    RAISE EXCEPTION 'Cannot publish drive: drive eligibility criteria must be configured';
  END IF;

  -- 4. Validate at least one eligible cohort batch is configured
  SELECT count(*) INTO v_batch_count FROM drive_eligible_batches WHERE drive_id = p_drive_id;
  IF v_batch_count = 0 THEN
    RAISE EXCEPTION 'Cannot publish drive: at least one eligible program and batch must be configured';
  END IF;

  -- Transition drive to PUBLISHED (enforces chk_published_fields and trg_enforce_drive_status)
  UPDATE placement_drives
  SET status = 'PUBLISHED',
      published_by = v_actor_id,
      published_at = now(),
      updated_at = now()
  WHERE id = p_drive_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'DRIVE_PUBLISHED',
    'placement_drive',
    p_drive_id,
    jsonb_build_object(
      'company_id', v_drive.company_id,
      'title', v_drive.title,
      'drive_type', v_drive.drive_type
    )
  );

  RETURN jsonb_build_object('success', true, 'drive_id', p_drive_id, 'status', 'PUBLISHED');
END;
$$;

REVOKE ALL ON FUNCTION publish_placement_drive(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publish_placement_drive(UUID) TO authenticated;

-- Close Placement Drive (PUBLISHED -> CLOSED)
CREATE OR REPLACE FUNCTION close_placement_drive(p_drive_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_drive    placement_drives%ROWTYPE;
BEGIN
  IF NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can close placement drives';
  END IF;

  SELECT * INTO v_drive FROM placement_drives WHERE id = p_drive_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement drive not found';
  END IF;

  IF v_drive.status != 'PUBLISHED' THEN
    RAISE EXCEPTION 'Cannot close drive: current status is %, expected PUBLISHED', v_drive.status;
  END IF;

  UPDATE placement_drives
  SET status = 'CLOSED',
      closed_by = v_actor_id,
      closed_at = now(),
      updated_at = now()
  WHERE id = p_drive_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'DRIVE_CLOSED',
    'placement_drive',
    p_drive_id,
    jsonb_build_object('title', v_drive.title)
  );

  RETURN jsonb_build_object('success', true, 'drive_id', p_drive_id, 'status', 'CLOSED');
END;
$$;

REVOKE ALL ON FUNCTION close_placement_drive(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION close_placement_drive(UUID) TO authenticated;

-- Archive Placement Drive (CLOSED -> ARCHIVED)
CREATE OR REPLACE FUNCTION archive_placement_drive(p_drive_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_drive    placement_drives%ROWTYPE;
BEGIN
  IF NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can archive placement drives';
  END IF;

  SELECT * INTO v_drive FROM placement_drives WHERE id = p_drive_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement drive not found';
  END IF;

  IF v_drive.status != 'CLOSED' THEN
    RAISE EXCEPTION 'Cannot archive drive: current status is %, expected CLOSED', v_drive.status;
  END IF;

  UPDATE placement_drives
  SET status = 'ARCHIVED',
      archived_by = v_actor_id,
      archived_at = now(),
      updated_at = now()
  WHERE id = p_drive_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'DRIVE_ARCHIVED',
    'placement_drive',
    p_drive_id,
    jsonb_build_object('title', v_drive.title)
  );

  RETURN jsonb_build_object('success', true, 'drive_id', p_drive_id, 'status', 'ARCHIVED');
END;
$$;

REVOKE ALL ON FUNCTION archive_placement_drive(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION archive_placement_drive(UUID) TO authenticated;

-- ============================================================================
-- 5. Recruiter Drive Access Grant Procedures (Super Admin & Secretary Only)
-- ============================================================================

CREATE OR REPLACE FUNCTION grant_recruiter_drive_access(
  p_drive_id             UUID,
  p_recruiter_profile_id UUID,
  p_expires_at           TIMESTAMPTZ DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id   UUID := auth.uid();
  v_rec_prof   recruiter_profiles%ROWTYPE;
  v_contact    recruiter_contacts%ROWTYPE;
  v_company    companies%ROWTYPE;
  v_access_id  UUID;
BEGIN
  IF NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can grant recruiter drive access';
  END IF;

  -- 1. Validate drive exists
  PERFORM 1 FROM placement_drives WHERE id = p_drive_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement drive not found';
  END IF;

  -- 2. Validate recruiter profile exists (supports either recruiter_profiles.id or profile_id)
  SELECT * INTO v_rec_prof FROM recruiter_profiles
  WHERE id = p_recruiter_profile_id OR profile_id = p_recruiter_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recruiter profile not found';
  END IF;

  -- 3. Validate recruiter contact is active
  SELECT * INTO v_contact FROM recruiter_contacts WHERE id = v_rec_prof.recruiter_contact_id;
  IF NOT FOUND OR NOT v_contact.is_active THEN
    RAISE EXCEPTION 'Cannot grant access: recruiter contact is inactive or not found';
  END IF;

  -- 4. Validate recruiter company is not archived
  SELECT * INTO v_company FROM companies WHERE id = v_rec_prof.company_id;
  IF NOT FOUND OR v_company.is_archived THEN
    RAISE EXCEPTION 'Cannot grant access: recruiter company is archived or not found';
  END IF;

  -- 5. Validate expiry if provided
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'Grant expiry timestamp must be in the future';
  END IF;

  -- Upsert grant (un-revoke if previously revoked)
  INSERT INTO recruiter_drive_access (
    recruiter_profile_id,
    drive_id,
    granted_by,
    granted_at,
    expires_at,
    revoked_by,
    revoked_at
  ) VALUES (
    v_rec_prof.id,
    p_drive_id,
    v_actor_id,
    now(),
    p_expires_at,
    NULL,
    NULL
  )
  ON CONFLICT (recruiter_profile_id, drive_id) DO UPDATE
  SET granted_by = v_actor_id,
      granted_at = now(),
      expires_at = EXCLUDED.expires_at,
      revoked_by = NULL,
      revoked_at = NULL
  RETURNING id INTO v_access_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'RECRUITER_DRIVE_ACCESS_GRANTED',
    'recruiter_drive_access',
    v_access_id,
    jsonb_build_object(
      'drive_id', p_drive_id,
      'recruiter_profile_id', v_rec_prof.id,
      'expires_at', p_expires_at
    )
  );

  RETURN jsonb_build_object('success', true, 'access_id', v_access_id);
END;
$$;

REVOKE ALL ON FUNCTION grant_recruiter_drive_access(UUID, UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grant_recruiter_drive_access(UUID, UUID, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION revoke_recruiter_drive_access(p_access_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_access   recruiter_drive_access%ROWTYPE;
BEGIN
  IF NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can revoke recruiter drive access';
  END IF;

  SELECT * INTO v_access FROM recruiter_drive_access WHERE id = p_access_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recruiter drive access record not found';
  END IF;

  IF v_access.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Drive access has already been revoked';
  END IF;

  UPDATE recruiter_drive_access
  SET revoked_by = v_actor_id,
      revoked_at = now()
  WHERE id = p_access_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'RECRUITER_DRIVE_ACCESS_REVOKED',
    'recruiter_drive_access',
    p_access_id,
    jsonb_build_object(
      'drive_id', v_access.drive_id,
      'recruiter_profile_id', v_access.recruiter_profile_id
    )
  );

  RETURN jsonb_build_object('success', true, 'access_id', p_access_id);
END;
$$;

REVOKE ALL ON FUNCTION revoke_recruiter_drive_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION revoke_recruiter_drive_access(UUID) TO authenticated;

-- ============================================================================
-- 6. Authoritative Student Eligibility Evaluator
-- ============================================================================

-- Private internal evaluator: NEVER callable by ordinary authenticated users
CREATE OR REPLACE FUNCTION _evaluate_eligibility_for_student(
  p_student_id UUID,
  p_drive_id   UUID
)
RETURNS TABLE (
  academic_result TEXT,   -- 'PASS' | 'FAIL' | 'UNDETERMINED'
  is_available    BOOLEAN,
  reason_codes    TEXT[]
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_drive          RECORD;
  v_elig           RECORD;
  v_academic       RECORD;
  v_prog_exists    BOOLEAN;
  v_batch_exists   BOOLEAN;
  v_already_placed BOOLEAN;
  v_codes          TEXT[] := ARRAY[]::TEXT[];
  v_acad_result    TEXT := 'PASS';
  v_available      BOOLEAN := true;
BEGIN
  -- 1. Verify student is an active student with active lifecycle
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_student_id
      AND role = 'STUDENT'
      AND is_active = true
      AND student_lifecycle_status = 'STUDENT_ACTIVE'
  ) THEN
    RETURN QUERY SELECT 'UNDETERMINED'::TEXT, false, ARRAY['NOT_A_STUDENT']::TEXT[];
    RETURN;
  END IF;

  -- 2. Drive availability checks
  SELECT status, application_deadline, drive_type INTO v_drive
  FROM placement_drives WHERE id = p_drive_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNDETERMINED'::TEXT, false, ARRAY['DRIVE_NOT_FOUND']::TEXT[];
    RETURN;
  END IF;

  IF v_drive.status != 'PUBLISHED' THEN
    v_available := false;
  END IF;

  IF v_drive.application_deadline IS NOT NULL AND v_drive.application_deadline <= now() THEN
    v_available := false;
    v_codes := array_append(v_codes, 'DEADLINE_PASSED');
  END IF;

  -- 3. Eligibility criteria exist?
  SELECT * INTO v_elig FROM drive_eligibility WHERE drive_id = p_drive_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNDETERMINED'::TEXT, v_available, ARRAY['DRIVE_CRITERIA_UNAVAILABLE']::TEXT[];
    RETURN;
  END IF;

  -- 4. Authoritative verified academic record lookup
  SELECT ar.*, ap.placement_eligible INTO v_academic
  FROM academic_records ar
  JOIN academic_programs ap ON ap.id = ar.program_id
  WHERE ar.profile_id = p_student_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNDETERMINED'::TEXT, v_available, ARRAY['ACADEMIC_DATA_UNAVAILABLE']::TEXT[];
    RETURN;
  END IF;

  IF v_academic.verification_status != 'VERIFIED' THEN
    RETURN QUERY SELECT 'UNDETERMINED'::TEXT, v_available, ARRAY['ACADEMIC_UNVERIFIED']::TEXT[];
    RETURN;
  END IF;

  IF v_academic.cgpa IS NULL OR v_academic.active_backlogs IS NULL THEN
    RETURN QUERY SELECT 'UNDETERMINED'::TEXT, v_available, ARRAY['ACADEMIC_DATA_UNAVAILABLE']::TEXT[];
    RETURN;
  END IF;

  -- 5. Program placement eligibility flag
  IF NOT v_academic.placement_eligible THEN
    v_acad_result := 'FAIL';
    v_codes := array_append(v_codes, 'COURSE_NOT_ELIGIBLE');
  END IF;

  -- 6. Program + batch in drive_eligible_batches?
  SELECT EXISTS (
    SELECT 1 FROM drive_eligible_batches
    WHERE drive_id = p_drive_id AND program_id = v_academic.program_id
  ) INTO v_prog_exists;

  IF NOT v_prog_exists THEN
    v_acad_result := 'FAIL';
    IF NOT ('COURSE_NOT_ELIGIBLE' = ANY(v_codes)) THEN
      v_codes := array_append(v_codes, 'COURSE_NOT_ELIGIBLE');
    END IF;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM drive_eligible_batches
      WHERE drive_id = p_drive_id AND program_id = v_academic.program_id AND batch = v_academic.batch
    ) INTO v_batch_exists;

    IF NOT v_batch_exists THEN
      v_acad_result := 'FAIL';
      v_codes := array_append(v_codes, 'BATCH_NOT_ELIGIBLE');
    END IF;
  END IF;

  -- 7. Minimum CGPA threshold
  IF v_academic.cgpa < v_elig.minimum_cgpa THEN
    v_acad_result := 'FAIL';
    v_codes := array_append(v_codes, 'CGPA_BELOW_MINIMUM');
  END IF;

  -- 8. Maximum active backlogs limit
  IF v_academic.active_backlogs > v_elig.maximum_active_backlogs THEN
    v_acad_result := 'FAIL';
    v_codes := array_append(v_codes, 'ACTIVE_BACKLOG_LIMIT_EXCEEDED');
  END IF;

  -- 9. Prior selected PLACEMENT exclusion (applies to either PLACEMENT or INTERNSHIP drive if flag is enabled)
  IF v_elig.exclude_previously_selected_placement THEN
    SELECT EXISTS (
      SELECT 1 FROM applications a
      JOIN placement_drives pd ON pd.id = a.drive_id
      WHERE a.student_id = p_student_id
        AND a.status = 'SELECTED'
        AND pd.drive_type = 'PLACEMENT'
    ) INTO v_already_placed;

    IF v_already_placed THEN
      v_acad_result := 'FAIL';
      v_codes := array_append(v_codes, 'PREVIOUSLY_SELECTED_PLACEMENT');
    END IF;
  END IF;

  RETURN QUERY SELECT v_acad_result, v_available, v_codes;
END;
$$;

-- Strict revocation: private evaluator cannot be executed directly by public, anon, or authenticated users
REVOKE ALL ON FUNCTION _evaluate_eligibility_for_student(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION _evaluate_eligibility_for_student(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION _evaluate_eligibility_for_student(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION _evaluate_eligibility_for_student(UUID, UUID) TO service_role;

-- Public / Student-facing wrapper: derives student identity strictly from auth.uid()
CREATE OR REPLACE FUNCTION get_my_drive_eligibility(p_drive_id UUID)
RETURNS TABLE (
  academic_result TEXT,
  is_available    BOOLEAN,
  reason_codes    TEXT[]
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
BEGIN
  IF v_student_id IS NULL THEN
    RETURN QUERY SELECT 'UNDETERMINED'::TEXT, false, ARRAY['AUTHENTICATION_REQUIRED']::TEXT[];
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM _evaluate_eligibility_for_student(v_student_id, p_drive_id);
END;
$$;

REVOKE ALL ON FUNCTION get_my_drive_eligibility(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_my_drive_eligibility(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION get_my_drive_eligibility(UUID) TO authenticated;
