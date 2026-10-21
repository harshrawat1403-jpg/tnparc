-- Migration 16: Phase 8 Applications, Status Workflow & Permanent History
-- Authoritative RLS policies, views, application lifecycle procedures, and terminal correction

-- ============================================================================
-- 0. Schema Enhancements: Deterministic Transition Sequence
-- ============================================================================

-- Add columns without initial unique constraint so pre-existing rows can be safely ranked
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS current_sequence BIGINT;

ALTER TABLE application_status_history
  ADD COLUMN IF NOT EXISTS transition_sequence BIGINT;

-- Deterministic safe backfill for pre-existing history rows using creation order
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM application_status_history WHERE transition_sequence IS NULL) THEN
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY application_id
               ORDER BY created_at ASC, id ASC
             ) AS seq
      FROM application_status_history
    )
    UPDATE application_status_history ash
    SET transition_sequence = ranked.seq
    FROM ranked
    WHERE ash.id = ranked.id
      AND ash.transition_sequence IS NULL;
  END IF;
END $$;

ALTER TABLE application_status_history
  ALTER COLUMN transition_sequence SET NOT NULL,
  ALTER COLUMN transition_sequence SET DEFAULT 1;

-- Backfill applications.current_sequence to match the maximum history sequence
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM applications WHERE current_sequence IS NULL) THEN
    WITH max_seq AS (
      SELECT application_id, COALESCE(MAX(transition_sequence), 1) AS m_seq
      FROM application_status_history
      GROUP BY application_id
    )
    UPDATE applications a
    SET current_sequence = COALESCE(max_seq.m_seq, 1)
    FROM max_seq
    WHERE a.id = max_seq.application_id;

    UPDATE applications
    SET current_sequence = 1
    WHERE current_sequence IS NULL;
  END IF;
END $$;

ALTER TABLE applications
  ALTER COLUMN current_sequence SET NOT NULL,
  ALTER COLUMN current_sequence SET DEFAULT 1;

ALTER TABLE application_status_history
  DROP CONSTRAINT IF EXISTS uq_application_status_history_sequence;

ALTER TABLE application_status_history
  ADD CONSTRAINT uq_application_status_history_sequence
  UNIQUE (application_id, transition_sequence);

CREATE INDEX IF NOT EXISTS idx_history_application_sequence
  ON application_status_history (application_id, transition_sequence DESC);

-- ============================================================================
-- 1. Row Level Security Policies
-- ============================================================================

-- A. applications table
REVOKE ALL ON applications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON applications TO anon, authenticated;

DROP POLICY IF EXISTS anon_deny_applications ON applications;
CREATE POLICY anon_deny_applications ON applications
  FOR SELECT TO anon
  USING (false);

DROP POLICY IF EXISTS applications_select_student ON applications;
CREATE POLICY applications_select_student ON applications
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    AND is_active_student()
  );

DROP POLICY IF EXISTS applications_select_staff ON applications;
CREATE POLICY applications_select_staff ON applications
  FOR SELECT TO authenticated
  USING (
    can_access_student(student_id)
  );

-- B. application_status_history table
REVOKE ALL ON application_status_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON application_status_history TO anon, authenticated;

DROP POLICY IF EXISTS anon_deny_history ON application_status_history;
CREATE POLICY anon_deny_history ON application_status_history
  FOR SELECT TO anon
  USING (false);

DROP POLICY IF EXISTS history_select_student ON application_status_history;
CREATE POLICY history_select_student ON application_status_history
  FOR SELECT TO authenticated
  USING (
    is_active_student()
    AND EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_status_history.application_id
        AND a.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS history_select_staff ON application_status_history;
CREATE POLICY history_select_staff ON application_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_status_history.application_id
        AND can_access_student(a.student_id)
    )
  );

-- Note: Direct INSERT, UPDATE, DELETE on applications and application_status_history
-- remain revoked from PUBLIC, anon, and authenticated. All mutations proceed through
-- dedicated SECURITY DEFINER procedures.

-- ============================================================================
-- 2. Domain Views (Safe Projections)
-- ============================================================================

-- A. Student Applications View
CREATE OR REPLACE VIEW v_student_applications
WITH (security_invoker = true)
AS
SELECT
  a.id AS application_id,
  a.student_id,
  a.drive_id,
  pd.title AS drive_title,
  pd.drive_type,
  pd.status AS drive_status,
  pd.application_deadline,
  c.id AS company_id,
  c.name AS company_name,
  c.website AS company_website,
  a.status AS application_status,
  a.applied_at,
  a.snapshot_cgpa,
  a.snapshot_backlogs,
  a.updated_at,
  (a.status = 'APPLIED' AND (pd.application_deadline IS NULL OR pd.application_deadline > clock_timestamp())) AS can_withdraw
FROM applications a
JOIN placement_drives pd ON pd.id = a.drive_id
JOIN companies c ON c.id = pd.company_id;

REVOKE ALL ON v_student_applications FROM PUBLIC, anon;
GRANT SELECT ON v_student_applications TO authenticated;

-- B. Student Application Timeline (Sanitized: hides changed_by ID and internal reason)
CREATE OR REPLACE VIEW v_student_application_timeline
WITH (security_invoker = true)
AS
SELECT
  h.id,
  h.application_id,
  h.transition_sequence,
  h.previous_status,
  h.new_status,
  h.created_at
FROM application_status_history h;

REVOKE ALL ON v_student_application_timeline FROM PUBLIC, anon;
GRANT SELECT ON v_student_application_timeline TO authenticated;

-- C. Staff Applications View (Scoped lookahead & filters)
CREATE OR REPLACE VIEW v_staff_applications
WITH (security_invoker = true)
AS
SELECT
  a.id AS application_id,
  a.student_id,
  sp.display_name AS student_name,
  ar.program_id,
  ap.code AS program_code,
  ap.display_name AS program_name,
  ar.batch AS student_batch,
  a.drive_id,
  pd.title AS drive_title,
  pd.drive_type,
  pd.status AS drive_status,
  pd.application_deadline,
  pd.company_id,
  c.name AS company_name,
  a.status AS application_status,
  a.applied_at,
  a.snapshot_cgpa,
  a.snapshot_backlogs,
  a.updated_at
FROM applications a
JOIN profiles sp ON sp.id = a.student_id
LEFT JOIN academic_records ar ON ar.profile_id = a.student_id
LEFT JOIN academic_programs ap ON ap.id = ar.program_id
JOIN placement_drives pd ON pd.id = a.drive_id
JOIN companies c ON c.id = pd.company_id;

REVOKE ALL ON v_staff_applications FROM PUBLIC, anon;
GRANT SELECT ON v_staff_applications TO authenticated;

-- D. Staff Application History View (Includes audit actor name/role, sequence & correction reasons)
CREATE OR REPLACE VIEW v_staff_application_history
WITH (security_invoker = true)
AS
SELECT
  h.id,
  h.application_id,
  h.transition_sequence,
  h.previous_status,
  h.new_status,
  h.changed_by,
  p.display_name AS changed_by_name,
  p.role AS changed_by_role,
  h.reason,
  h.is_terminal_correction,
  h.created_at
FROM application_status_history h
JOIN profiles p ON p.id = h.changed_by;

REVOKE ALL ON v_staff_application_history FROM PUBLIC, anon;
GRANT SELECT ON v_staff_application_history TO authenticated;

-- ============================================================================
-- 3. Student Apply Procedure
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_to_drive(p_drive_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id     UUID := auth.uid();
  v_drive          placement_drives%ROWTYPE;
  v_acad_result    TEXT;
  v_is_available   BOOLEAN;
  v_snap_cgpa      NUMERIC(4,2);
  v_snap_backlogs  INTEGER;
  v_application_id UUID;
BEGIN
  -- 1. Identity & Role Verification
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT is_active_student() THEN
    RAISE EXCEPTION 'Unauthorized: Only active students can apply to drives';
  END IF;

  -- 2. Drive Existence, State & Deadline (Database authoritative time)
  SELECT * INTO v_drive
  FROM placement_drives
  WHERE id = p_drive_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement drive not found';
  END IF;

  IF v_drive.status != 'PUBLISHED' THEN
    RAISE EXCEPTION 'Cannot apply: drive status is %, only PUBLISHED drives accept applications', v_drive.status;
  END IF;

  IF v_drive.application_deadline IS NOT NULL AND v_drive.application_deadline <= clock_timestamp() THEN
    RAISE EXCEPTION 'Cannot apply: drive application deadline has passed';
  END IF;

  -- 3. Duplicate Application Verification
  IF EXISTS (
    SELECT 1 FROM applications
    WHERE student_id = v_student_id AND drive_id = p_drive_id
  ) THEN
    RAISE EXCEPTION 'Cannot apply: you have already submitted an application for this drive';
  END IF;

  -- 4. Authoritative Eligibility Evaluation
  SELECT academic_result, is_available
  INTO v_acad_result, v_is_available
  FROM _evaluate_eligibility_for_student(v_student_id, p_drive_id);

  IF v_acad_result != 'PASS' OR NOT v_is_available THEN
    RAISE EXCEPTION 'Cannot apply: student does not meet eligibility criteria for this drive';
  END IF;

  -- 5. Capture Permanent Academic Snapshot
  SELECT cgpa, active_backlogs
  INTO v_snap_cgpa, v_snap_backlogs
  FROM academic_records
  WHERE profile_id = v_student_id;

  IF v_snap_cgpa IS NULL OR v_snap_backlogs IS NULL THEN
    RAISE EXCEPTION 'Cannot apply: authoritative academic record is incomplete';
  END IF;

  -- 6. Atomic Application Creation
  INSERT INTO applications (
    student_id,
    drive_id,
    status,
    applied_at,
    snapshot_cgpa,
    snapshot_backlogs,
    current_sequence
  ) VALUES (
    v_student_id,
    p_drive_id,
    'APPLIED',
    now(),
    v_snap_cgpa,
    v_snap_backlogs,
    1
  ) RETURNING id INTO v_application_id;

  -- 7. Atomic Initial History Event
  INSERT INTO application_status_history (
    application_id,
    transition_sequence,
    previous_status,
    new_status,
    changed_by,
    reason,
    is_terminal_correction,
    created_at
  ) VALUES (
    v_application_id,
    1,
    NULL,
    'APPLIED',
    v_student_id,
    NULL,
    false,
    clock_timestamp()
  );

  -- 8. Sanitized Operational Audit Event
  INSERT INTO audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_student_id,
    'APPLICATION_SUBMITTED',
    'application',
    v_application_id,
    jsonb_build_object(
      'drive_id', p_drive_id,
      'eligibility_passed', true
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_application_id,
    'status', 'APPLIED',
    'transition_sequence', 1
  );
END;
$$;

REVOKE ALL ON FUNCTION apply_to_drive(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION apply_to_drive(UUID) TO authenticated;

-- ============================================================================
-- 4. Student Withdrawal Procedure
-- ============================================================================

CREATE OR REPLACE FUNCTION withdraw_application(
  p_application_id UUID,
  p_reason         TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_app        applications%ROWTYPE;
  v_deadline   TIMESTAMPTZ;
  v_next_seq   BIGINT;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Row lock for concurrency safety
  SELECT * INTO v_app
  FROM applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF v_app.student_id != v_student_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only withdraw your own applications';
  END IF;

  IF v_app.status != 'APPLIED' THEN
    RAISE EXCEPTION 'Cannot withdraw application: application is in % status, only APPLIED applications can be withdrawn', v_app.status;
  END IF;

  SELECT application_deadline INTO v_deadline
  FROM placement_drives
  WHERE id = v_app.drive_id;

  IF v_deadline IS NOT NULL AND v_deadline <= clock_timestamp() THEN
    RAISE EXCEPTION 'Cannot withdraw application: drive application deadline has passed';
  END IF;

  v_next_seq := GREATEST(v_app.current_sequence, (
    SELECT COALESCE(MAX(transition_sequence), 0)
    FROM application_status_history
    WHERE application_id = p_application_id
  )) + 1;

  -- Atomic Status Mutation
  UPDATE applications
  SET status = 'WITHDRAWN',
      current_sequence = v_next_seq,
      updated_at = now()
  WHERE id = p_application_id;

  -- Append History Event
  INSERT INTO application_status_history (
    application_id,
    transition_sequence,
    previous_status,
    new_status,
    changed_by,
    reason,
    is_terminal_correction,
    created_at
  ) VALUES (
    p_application_id,
    v_next_seq,
    'APPLIED',
    'WITHDRAWN',
    v_student_id,
    NULLIF(trim(p_reason), ''),
    false,
    clock_timestamp()
  );

  -- Sanitized Operational Audit Event
  INSERT INTO audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_student_id,
    'APPLICATION_WITHDRAWN',
    'application',
    p_application_id,
    jsonb_build_object('drive_id', v_app.drive_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'status', 'WITHDRAWN',
    'transition_sequence', v_next_seq
  );
END;
$$;

REVOKE ALL ON FUNCTION withdraw_application(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION withdraw_application(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 5. Staff Status Transition Procedure
-- ============================================================================

CREATE OR REPLACE FUNCTION transition_application_status(
  p_application_id UUID,
  p_new_status     application_status,
  p_reason         TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id     UUID := auth.uid();
  v_role         user_role;
  v_app          applications%ROWTYPE;
  v_drive_status drive_status;
  v_next_seq     BIGINT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT is_active_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only active staff can update application status';
  END IF;

  v_role := get_user_role();

  -- Lock application row
  SELECT * INTO v_app
  FROM applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Verify drive is not archived
  SELECT status INTO v_drive_status
  FROM placement_drives
  WHERE id = v_app.drive_id;

  IF v_drive_status = 'ARCHIVED' THEN
    RAISE EXCEPTION 'Cannot transition application: drive is archived';
  END IF;

  -- Coordinator Scoping Verification
  IF v_role = 'TNP_COORDINATOR' AND NOT can_access_student(v_app.student_id) THEN
    RAISE EXCEPTION 'Unauthorized: Student is outside assigned coordinator scope';
  END IF;

  -- Terminal Status Check
  IF v_app.status IN ('SELECTED', 'REJECTED', 'WITHDRAWN') THEN
    RAISE EXCEPTION 'Cannot transition application: application is in terminal state %', v_app.status;
  END IF;

  -- Exact State Machine & Transition Authority Validation
  IF v_app.status = 'APPLIED' THEN
    IF p_new_status NOT IN ('SHORTLISTED', 'REJECTED') THEN
      RAISE EXCEPTION 'Illegal application status transition from APPLIED to %', p_new_status;
    END IF;

  ELSIF v_app.status = 'SHORTLISTED' THEN
    IF p_new_status = 'INTERVIEW' THEN
      IF v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can move applications to INTERVIEW';
      END IF;
    ELSIF p_new_status = 'REJECTED' THEN
      NULL; -- Allowed for Coordinator(scoped), Secretary, Admin
    ELSE
      RAISE EXCEPTION 'Illegal application status transition from SHORTLISTED to %', p_new_status;
    END IF;

  ELSIF v_app.status = 'INTERVIEW' THEN
    IF p_new_status IN ('SELECTED', 'REJECTED') THEN
      IF v_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can decide INTERVIEW outcomes';
      END IF;
    ELSE
      RAISE EXCEPTION 'Illegal application status transition from INTERVIEW to %', p_new_status;
    END IF;
  END IF;

  v_next_seq := GREATEST(v_app.current_sequence, (
    SELECT COALESCE(MAX(transition_sequence), 0)
    FROM application_status_history
    WHERE application_id = p_application_id
  )) + 1;

  -- Atomic Status Mutation
  UPDATE applications
  SET status = p_new_status,
      current_sequence = v_next_seq,
      updated_at = now()
  WHERE id = p_application_id;

  -- Append History Event
  INSERT INTO application_status_history (
    application_id,
    transition_sequence,
    previous_status,
    new_status,
    changed_by,
    reason,
    is_terminal_correction,
    created_at
  ) VALUES (
    p_application_id,
    v_next_seq,
    v_app.status,
    p_new_status,
    v_actor_id,
    NULLIF(trim(p_reason), ''),
    false,
    clock_timestamp()
  );

  -- Sanitized Operational Audit Event
  INSERT INTO audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_actor_id,
    'APPLICATION_STATUS_CHANGED',
    'application',
    p_application_id,
    jsonb_build_object(
      'drive_id', v_app.drive_id,
      'from_status', v_app.status,
      'to_status', p_new_status
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'previous_status', v_app.status,
    'new_status', p_new_status,
    'transition_sequence', v_next_seq
  );
END;
$$;

REVOKE ALL ON FUNCTION transition_application_status(UUID, application_status, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION transition_application_status(UUID, application_status, TEXT) TO authenticated;

-- ============================================================================
-- 6. Super Admin Terminal Status Correction Procedure
-- ============================================================================

CREATE OR REPLACE FUNCTION correct_terminal_status(
  p_application_id UUID,
  p_reason         TEXT
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id        UUID := auth.uid();
  v_app             applications%ROWTYPE;
  v_restored_status application_status;
  v_clean_reason    TEXT;
  v_next_seq        BIGINT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF get_user_role() != 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can perform terminal status correction';
  END IF;

  v_clean_reason := trim(p_reason);
  IF v_clean_reason IS NULL OR v_clean_reason = '' THEN
    RAISE EXCEPTION 'Correction reason is required and cannot be empty';
  END IF;

  -- Lock application row
  SELECT * INTO v_app
  FROM applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF v_app.status NOT IN ('SELECTED', 'REJECTED', 'WITHDRAWN') THEN
    RAISE EXCEPTION 'Cannot perform terminal correction: application is in non-terminal state %', v_app.status;
  END IF;

  -- Derive immediate prior non-terminal state from append-only history using transition_sequence
  SELECT new_status INTO v_restored_status
  FROM application_status_history
  WHERE application_id = p_application_id
    AND new_status NOT IN ('SELECTED', 'REJECTED', 'WITHDRAWN')
  ORDER BY transition_sequence DESC
  LIMIT 1;

  IF v_restored_status IS NULL THEN
    RAISE EXCEPTION 'Cannot perform terminal correction: no prior non-terminal state found in history';
  END IF;

  v_next_seq := GREATEST(v_app.current_sequence, (
    SELECT COALESCE(MAX(transition_sequence), 0)
    FROM application_status_history
    WHERE application_id = p_application_id
  )) + 1;

  -- Atomic Status Restoration
  UPDATE applications
  SET status = v_restored_status,
      current_sequence = v_next_seq,
      updated_at = now()
  WHERE id = p_application_id;

  -- Append History Correction Event
  INSERT INTO application_status_history (
    application_id,
    transition_sequence,
    previous_status,
    new_status,
    changed_by,
    reason,
    is_terminal_correction,
    created_at
  ) VALUES (
    p_application_id,
    v_next_seq,
    v_app.status,
    v_restored_status,
    v_actor_id,
    v_clean_reason,
    true,
    clock_timestamp()
  );

  -- Sanitized Operational Audit Event
  INSERT INTO audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_actor_id,
    'TERMINAL_CORRECTION',
    'application',
    p_application_id,
    jsonb_build_object(
      'reason', v_clean_reason,
      'restored_from', v_app.status,
      'restored_to', v_restored_status
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'previous_status', v_app.status,
    'restored_status', v_restored_status,
    'transition_sequence', v_next_seq
  );
END;
$$;

REVOKE ALL ON FUNCTION correct_terminal_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION correct_terminal_status(UUID, TEXT) TO authenticated;
