-- Migration 9: Phase 3 Auth and RBAC Helper Functions
-- TNP Portal: Authentication, RBAC & RLS Foundation

-- 1. Returns caller's active role, or NULL if caller has no active profile
-- Canonical: get_my_role(); Alias: get_user_role()
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT get_my_role();
$$;

REVOKE ALL ON FUNCTION get_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;

-- 2. Returns caller's student lifecycle status, or NULL if not an active student
-- Canonical: get_my_lifecycle(); Alias: get_student_lifecycle_status()
CREATE OR REPLACE FUNCTION get_my_lifecycle()
RETURNS student_lifecycle_status
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT student_lifecycle_status FROM profiles WHERE id = auth.uid() AND is_active = true LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_my_lifecycle() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_lifecycle() TO authenticated;

CREATE OR REPLACE FUNCTION get_student_lifecycle_status()
RETURNS student_lifecycle_status
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT get_my_lifecycle();
$$;

REVOKE ALL ON FUNCTION get_student_lifecycle_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_student_lifecycle_status() TO authenticated;

-- 3. True if caller is any active staff role
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_active = true
      AND role IN ('TNP_COORDINATOR', 'TNP_SECRETARY', 'SUPER_ADMIN')
  );
$$;

REVOKE ALL ON FUNCTION is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_staff() TO authenticated;

-- 4. Alias for active staff check matching architecture specification
CREATE OR REPLACE FUNCTION is_active_staff()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT is_staff();
$$;

REVOKE ALL ON FUNCTION is_active_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_active_staff() TO authenticated;

-- 5. True if caller is an active student with active lifecycle
-- Canonical: is_current_user_active_student(); Alias: is_active_student()
CREATE OR REPLACE FUNCTION is_current_user_active_student()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_active = true
      AND role = 'STUDENT'
      AND student_lifecycle_status = 'STUDENT_ACTIVE'
  );
$$;

REVOKE ALL ON FUNCTION is_current_user_active_student() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_current_user_active_student() TO authenticated;

CREATE OR REPLACE FUNCTION is_active_student()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT is_current_user_active_student();
$$;

REVOKE ALL ON FUNCTION is_active_student() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_active_student() TO authenticated;

-- 6. True if caller is an active Super Admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_active = true
      AND role = 'SUPER_ADMIN'
  );
$$;

REVOKE ALL ON FUNCTION is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;

-- 7. Private internal helper: True if calling coordinator has active scope over given student
-- Derived strictly from auth.uid(); never callable by ordinary authenticated users directly
CREATE OR REPLACE FUNCTION _coordinator_has_scope_over(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM coordinator_student_scopes css
    JOIN academic_records ar
      ON ar.program_id = css.program_id AND ar.batch = css.batch
    JOIN profiles p
      ON p.id = css.coordinator_id AND p.is_active = true AND p.role = 'TNP_COORDINATOR'
    WHERE css.coordinator_id = auth.uid()
      AND ar.profile_id = p_student_id
  );
$$;

-- Explicitly private: revoked from PUBLIC and authenticated
REVOKE ALL ON FUNCTION _coordinator_has_scope_over(UUID) FROM PUBLIC, authenticated;

-- 8. Accessor: True if caller is authorized staff with scope over given student
-- Canonical: can_current_user_access_student(p_student_id); Alias: can_access_student(p_student_id)
CREATE OR REPLACE FUNCTION can_current_user_access_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role user_role;
BEGIN
  -- Caller identity derived strictly from auth.uid(); cannot be forged
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND is_active = true;
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_role IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RETURN true;
  END IF;

  IF v_role = 'TNP_COORDINATOR' THEN
    RETURN _coordinator_has_scope_over(p_student_id);
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION can_current_user_access_student(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_current_user_access_student(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION can_access_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN can_current_user_access_student(p_student_id);
END;
$$;

REVOKE ALL ON FUNCTION can_access_student(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_access_student(UUID) TO authenticated;
