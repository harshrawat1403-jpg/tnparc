-- Migration 11: Protected Operations for Role Assignment, Role Removal, and Student Account Provisioning
-- TNP Portal: Authentication, RBAC & RLS Foundation

-- 1. assign_role: Protected procedure for Super Admin role assignment
CREATE OR REPLACE FUNCTION assign_role(
  p_target_profile_id UUID,
  p_new_role          user_role,
  p_coordinator_slot  coordinator_slot DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_target    RECORD;
BEGIN
  -- Strict Super Admin authorization check
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only an active SUPER_ADMIN can assign roles';
  END IF;

  -- Prevent self-reassignment or lockout
  IF p_target_profile_id = v_caller_id THEN
    RAISE EXCEPTION 'Super Admin cannot reassign their own role';
  END IF;

  -- Validate target profile exists and is active
  SELECT * INTO v_target FROM profiles WHERE id = p_target_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target profile not found';
  END IF;

  IF NOT v_target.is_active THEN
    RAISE EXCEPTION 'Cannot assign roles to a deactivated profile';
  END IF;

  -- Cardinality and role constraints enforcement
  IF p_new_role = 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Cannot assign Super Admin role via assign_role procedure';
  ELSIF p_new_role = 'TNP_SECRETARY' THEN
    IF p_coordinator_slot IS NOT NULL THEN
      RAISE EXCEPTION 'Coordinator slot must be NULL for TNP_SECRETARY';
    END IF;
    IF EXISTS (
      SELECT 1 FROM profiles
      WHERE role = 'TNP_SECRETARY' AND is_active = true AND id != p_target_profile_id
    ) THEN
      RAISE EXCEPTION 'An active TNP Secretary already exists (cardinality limit: 1)';
    END IF;
  ELSIF p_new_role = 'TNP_COORDINATOR' THEN
    IF p_coordinator_slot IS NULL THEN
      RAISE EXCEPTION 'Coordinator slot is required for TNP_COORDINATOR';
    END IF;
    IF EXISTS (
      SELECT 1 FROM profiles
      WHERE role = 'TNP_COORDINATOR' AND coordinator_slot = p_coordinator_slot
        AND is_active = true AND id != p_target_profile_id
    ) THEN
      RAISE EXCEPTION 'Coordinator slot % is already occupied', p_coordinator_slot;
    END IF;
  ELSIF p_new_role IN ('STUDENT', 'RECRUITER') THEN
    IF p_coordinator_slot IS NOT NULL THEN
      RAISE EXCEPTION 'Coordinator slot must be NULL for non-coordinator roles';
    END IF;
  END IF;

  -- Atomic update of role, slot, and lifecycle status
  UPDATE profiles
  SET role = p_new_role,
      coordinator_slot = CASE WHEN p_new_role = 'TNP_COORDINATOR' THEN p_coordinator_slot ELSE NULL END,
      student_lifecycle_status = CASE
        WHEN p_new_role = 'STUDENT' THEN COALESCE(v_target.student_lifecycle_status, 'STUDENT_ACTIVE')
        ELSE NULL
      END,
      updated_at = now()
  WHERE id = p_target_profile_id;

  -- Append-only audit logging
  INSERT INTO audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_caller_id,
    'ROLE_ASSIGNED',
    'profile',
    p_target_profile_id,
    jsonb_build_object(
      'previous_role', v_target.role,
      'new_role', p_new_role,
      'coordinator_slot', p_coordinator_slot
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_target_profile_id,
    'new_role', p_new_role,
    'coordinator_slot', p_coordinator_slot
  );
END;
$$;

REVOKE ALL ON FUNCTION assign_role(UUID, user_role, coordinator_slot) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assign_role(UUID, user_role, coordinator_slot) TO authenticated;

-- 2. remove_staff_role: Protected procedure for Super Admin to remove staff privileges
CREATE OR REPLACE FUNCTION remove_staff_role(p_target_profile_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_target    RECORD;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only an active SUPER_ADMIN can remove staff roles';
  END IF;

  IF p_target_profile_id = v_caller_id THEN
    RAISE EXCEPTION 'Super Admin cannot remove their own role';
  END IF;

  SELECT * INTO v_target FROM profiles WHERE id = p_target_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target profile not found';
  END IF;

  -- Reset to STUDENT role if a student record exists, otherwise keep active status but clear slot
  UPDATE profiles
  SET role = 'STUDENT',
      coordinator_slot = NULL,
      student_lifecycle_status = COALESCE(v_target.student_lifecycle_status, 'STUDENT_ACTIVE'),
      updated_at = now()
  WHERE id = p_target_profile_id;

  INSERT INTO audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_caller_id,
    'ROLE_REMOVED',
    'profile',
    p_target_profile_id,
    jsonb_build_object(
      'previous_role', v_target.role,
      'previous_slot', v_target.coordinator_slot
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_target_profile_id,
    'role', 'STUDENT'
  );
END;
$$;

REVOKE ALL ON FUNCTION remove_staff_role(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION remove_staff_role(UUID) TO authenticated;

-- 3. provision_student_account: Idempotent transactional student account provisioning
CREATE OR REPLACE FUNCTION provision_student_account()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_email     TEXT;
  v_roster    RECORD;
  v_profile   RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to provision account';
  END IF;

  -- Idempotency check: if profile already exists, verify and return cleanly
  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  IF FOUND THEN
    IF v_profile.role = 'STUDENT' THEN
      SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
      IF v_email IS NOT NULL THEN
        UPDATE student_roster
        SET claimed_by = v_user_id, updated_at = now()
        WHERE lower(trim(institutional_email)) = lower(trim(v_email))
          AND (claimed_by IS NULL OR claimed_by = v_user_id);
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'status', 'ALREADY_PROVISIONED',
        'profile_id', v_user_id
      );
    ELSE
      RAISE EXCEPTION 'Profile already exists with non-student role';
    END IF;
  END IF;

  -- Retrieve institutional email directly from auth.users (cannot be forged by caller)
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user email not found';
  END IF;

  -- Lock matching roster record FOR UPDATE to prevent race conditions
  SELECT * INTO v_roster
  FROM student_roster
  WHERE lower(trim(institutional_email)) = lower(trim(v_email))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No matching roster record found for email';
  END IF;

  IF NOT v_roster.is_active THEN
    RAISE EXCEPTION 'Roster record is inactive';
  END IF;

  IF v_roster.claimed_by IS NOT NULL AND v_roster.claimed_by != v_user_id THEN
    RAISE EXCEPTION 'Roster record is already claimed by another user';
  END IF;

  -- 1. Create profiles row
  INSERT INTO profiles (
    id,
    role,
    display_name,
    is_active,
    coordinator_slot,
    student_lifecycle_status
  ) VALUES (
    v_user_id,
    'STUDENT',
    v_roster.full_name,
    true,
    NULL,
    'STUDENT_ACTIVE'
  );

  -- 2. Create student_profiles row
  INSERT INTO student_profiles (
    profile_id,
    profile_completeness,
    public_profile_enabled,
    public_resume_enabled,
    public_portfolio_enabled
  ) VALUES (
    v_user_id,
    0,
    false,
    false,
    false
  );

  -- 3. Create academic_records row
  INSERT INTO academic_records (
    profile_id,
    program_id,
    batch,
    cgpa,
    active_backlogs,
    verification_status
  ) VALUES (
    v_user_id,
    v_roster.program_id,
    v_roster.batch,
    NULL,
    NULL,
    'UNVERIFIED'
  );

  -- 4. Mark roster record claimed
  UPDATE student_roster
  SET claimed_by = v_user_id,
      updated_at = now()
  WHERE id = v_roster.id;

  -- 5. Append audit log entry (no PII, credentials, or sensitive tokens)
  INSERT INTO audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_user_id,
    'STUDENT_REGISTERED',
    'profile',
    v_user_id,
    jsonb_build_object(
      'program_id', v_roster.program_id,
      'batch', v_roster.batch
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'PROVISIONED',
    'profile_id', v_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION provision_student_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provision_student_account() TO authenticated;
