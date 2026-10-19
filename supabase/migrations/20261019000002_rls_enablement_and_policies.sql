-- Migration 10: RLS Enablement across all tables and Phase 3 Core Security Policies
-- TNP Portal: Authentication, RBAC & RLS Foundation

-- 1. Enable and Force Row Level Security on ALL 22 Application Tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE academic_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_programs FORCE ROW LEVEL SECURITY;

ALTER TABLE student_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_roster FORCE ROW LEVEL SECURITY;

ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE academic_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_records FORCE ROW LEVEL SECURITY;

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills FORCE ROW LEVEL SECURITY;

ALTER TABLE student_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_skills FORCE ROW LEVEL SECURITY;

ALTER TABLE student_skill_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_skill_evidence FORCE ROW LEVEL SECURITY;

ALTER TABLE coordinator_student_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordinator_student_scopes FORCE ROW LEVEL SECURITY;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;

ALTER TABLE recruiter_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_contacts FORCE ROW LEVEL SECURITY;

ALTER TABLE recruiter_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_invitations FORCE ROW LEVEL SECURITY;

ALTER TABLE recruiter_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE placement_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_drives FORCE ROW LEVEL SECURITY;

ALTER TABLE drive_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_eligibility FORCE ROW LEVEL SECURITY;

ALTER TABLE drive_eligible_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_eligible_batches FORCE ROW LEVEL SECURITY;

ALTER TABLE recruiter_drive_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_drive_access FORCE ROW LEVEL SECURITY;

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications FORCE ROW LEVEL SECURITY;

ALTER TABLE application_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_status_history FORCE ROW LEVEL SECURITY;

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- 2. Core Functional Policies for Phase 3 Domains

-- PROFILES
-- Every authenticated user can read their own profile
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT
  USING (id = auth.uid());

-- Active staff can read all profiles (required for user management, student lists, coordinator scoping)
CREATE POLICY profiles_select_staff ON profiles
  FOR SELECT
  USING (is_staff());

-- Direct user UPDATE is strictly forbidden.
-- Protected columns (role, coordinator_slot, student_lifecycle_status, is_active)
-- can only be mutated through trusted SECURITY DEFINER procedures (assign_role, remove_staff_role, provision_student_account).
-- No UPDATE policy exists for profiles, enforcing absolute default-deny on direct mutations.

-- ACADEMIC PROGRAMS
-- Authenticated users can view active programs; staff can view all programs
CREATE POLICY programs_select_authenticated ON academic_programs
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (is_active = true OR is_staff())
  );

-- Program administration is strictly Super Admin-only per architecture (§19 /admin/programs)
CREATE POLICY programs_admin_insert ON academic_programs
  FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY programs_admin_update ON academic_programs
  FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY programs_admin_delete ON academic_programs
  FOR DELETE
  USING (is_super_admin());

-- STUDENT ROSTER
-- Roster administration is restricted to Super Admin and TNP Secretary (§19 /admin/roster)
-- Students, Coordinators, Recruiters, and Anonymous callers have NO SELECT privilege.
CREATE POLICY roster_select_staff ON student_roster
  FOR SELECT
  USING (get_user_role() IN ('SUPER_ADMIN', 'TNP_SECRETARY'));

CREATE POLICY roster_admin_mutate ON student_roster
  FOR ALL
  USING (get_user_role() IN ('SUPER_ADMIN', 'TNP_SECRETARY'))
  WITH CHECK (get_user_role() IN ('SUPER_ADMIN', 'TNP_SECRETARY'));

-- STUDENT PROFILES
-- Active student can view their own student profile
CREATE POLICY sp_select_own ON student_profiles
  FOR SELECT
  USING (
    profile_id = auth.uid()
    AND is_active_student()
  );

-- Authorized staff can view student profiles (Super Admin & Secretary = all; Coordinator = within assigned scope)
CREATE POLICY sp_select_staff ON student_profiles
  FOR SELECT
  USING (can_access_student(profile_id));

-- ACADEMIC RECORDS
-- Active student can view their own academic record
CREATE POLICY ar_select_own ON academic_records
  FOR SELECT
  USING (
    profile_id = auth.uid()
    AND is_active_student()
  );

-- Authorized staff can view academic records within their scope
CREATE POLICY ar_select_staff ON academic_records
  FOR SELECT
  USING (can_access_student(profile_id));

-- COORDINATOR STUDENT SCOPES
-- Coordinators view their own assigned scopes; Super Admin & TNP Secretary view all scopes
CREATE POLICY scopes_select ON coordinator_student_scopes
  FOR SELECT
  USING (
    coordinator_id = auth.uid()
    OR get_user_role() IN ('SUPER_ADMIN', 'TNP_SECRETARY')
  );

-- Scope creation, modification, and deletion are strictly Super Admin-only per architecture (§6.3, §19 /staff/skills/scopes)
CREATE POLICY scopes_admin_insert ON coordinator_student_scopes
  FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY scopes_admin_delete ON coordinator_student_scopes
  FOR DELETE
  USING (is_super_admin());

-- AUDIT LOGS
-- Explicitly revoke direct write privileges from public, anon, and authenticated roles
REVOKE ALL ON audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON audit_logs TO authenticated;

-- Super Admin can inspect the full audit trail
CREATE POLICY audit_select_admin ON audit_logs
  FOR SELECT
  USING (is_super_admin());

-- TNP Secretary can inspect operational audit trail (excludes bootstrap, role changes, system config)
CREATE POLICY audit_select_secretary ON audit_logs
  FOR SELECT
  USING (
    get_user_role() = 'TNP_SECRETARY'
    AND action NOT IN ('BOOTSTRAP_SUPER_ADMIN', 'ROLE_ASSIGNED', 'ROLE_REMOVED', 'SYSTEM_CONFIG')
  );

-- Direct INSERT, UPDATE, DELETE on audit_logs are forbidden to ordinary users.
-- Only trusted SECURITY DEFINER procedures (running with creator privileges) and operator tools can write audit entries.

-- Note: All 15 remaining future-domain tables (skills, student_skills, student_skill_evidence,
-- companies, recruiter_contacts, recruiter_invitations, recruiter_profiles, placement_drives,
-- drive_eligibility, drive_eligible_batches, recruiter_drive_access, applications,
-- application_status_history, documents, announcements) have RLS enabled and FORCED with NO policies,
-- strictly enforcing default-deny until their respective roadmap phases.
