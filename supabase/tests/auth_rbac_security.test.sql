BEGIN;
SELECT plan(82);

-- ============================================================================
-- Phase 3 Authentication, RBAC & RLS Security Test Suite
-- ============================================================================

-- 1. Verify RLS is enabled and FORCED on all 22 application tables
SELECT ok(relrowsecurity AND relforcerowsecurity, 'profiles should have RLS enabled and forced')
FROM pg_class WHERE relname = 'profiles';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'academic_programs should have RLS enabled and forced')
FROM pg_class WHERE relname = 'academic_programs';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'student_roster should have RLS enabled and forced')
FROM pg_class WHERE relname = 'student_roster';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'student_profiles should have RLS enabled and forced')
FROM pg_class WHERE relname = 'student_profiles';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'academic_records should have RLS enabled and forced')
FROM pg_class WHERE relname = 'academic_records';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'skills should have RLS enabled and forced')
FROM pg_class WHERE relname = 'skills';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'student_skills should have RLS enabled and forced')
FROM pg_class WHERE relname = 'student_skills';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'student_skill_evidence should have RLS enabled and forced')
FROM pg_class WHERE relname = 'student_skill_evidence';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'coordinator_student_scopes should have RLS enabled and forced')
FROM pg_class WHERE relname = 'coordinator_student_scopes';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'companies should have RLS enabled and forced')
FROM pg_class WHERE relname = 'companies';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'recruiter_contacts should have RLS enabled and forced')
FROM pg_class WHERE relname = 'recruiter_contacts';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'recruiter_invitations should have RLS enabled and forced')
FROM pg_class WHERE relname = 'recruiter_invitations';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'recruiter_profiles should have RLS enabled and forced')
FROM pg_class WHERE relname = 'recruiter_profiles';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'placement_drives should have RLS enabled and forced')
FROM pg_class WHERE relname = 'placement_drives';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'drive_eligibility should have RLS enabled and forced')
FROM pg_class WHERE relname = 'drive_eligibility';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'drive_eligible_batches should have RLS enabled and forced')
FROM pg_class WHERE relname = 'drive_eligible_batches';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'recruiter_drive_access should have RLS enabled and forced')
FROM pg_class WHERE relname = 'recruiter_drive_access';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'applications should have RLS enabled and forced')
FROM pg_class WHERE relname = 'applications';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'application_status_history should have RLS enabled and forced')
FROM pg_class WHERE relname = 'application_status_history';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'documents should have RLS enabled and forced')
FROM pg_class WHERE relname = 'documents';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'announcements should have RLS enabled and forced')
FROM pg_class WHERE relname = 'announcements';

SELECT ok(relrowsecurity AND relforcerowsecurity, 'audit_logs should have RLS enabled and forced')
FROM pg_class WHERE relname = 'audit_logs';

-- ============================================================================
-- Test Fixtures Setup (as postgres superuser)
-- ============================================================================
DO $$
DECLARE
  v_admin_id     UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_sec_id       UUID := '20000000-0000-0000-0000-000000000001'::UUID;
  v_coord_id     UUID := '30000000-0000-0000-0000-000000000001'::UUID;
  v_stud_a_id    UUID := '40000000-0000-0000-0000-000000000001'::UUID;
  v_stud_b_id    UUID := '40000000-0000-0000-0000-000000000002'::UUID;
  v_stud_c_id    UUID := '40000000-0000-0000-0000-000000000003'::UUID;
  v_recruiter_id UUID := '50000000-0000-0000-0000-000000000001'::UUID;
  v_deact_id     UUID := '60000000-0000-0000-0000-000000000001'::UUID;
  v_new_stud_id  UUID := '70000000-0000-0000-0000-000000000001'::UUID;
  v_barch_id     UUID;
  v_mplan_id     UUID;
BEGIN
  SELECT id INTO v_barch_id FROM academic_programs WHERE code = 'BARCH';
  SELECT id INTO v_mplan_id FROM academic_programs WHERE code = 'MPLAN';

  -- Create synthetic auth users
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (v_sec_id, 'authenticated', 'authenticated', 'sec@vnit.test'),
    (v_coord_id, 'authenticated', 'authenticated', 'coord@vnit.test'),
    (v_stud_a_id, 'authenticated', 'authenticated', 'student_a@vnit.test'),
    (v_stud_b_id, 'authenticated', 'authenticated', 'student_b@vnit.test'),
    (v_stud_c_id, 'authenticated', 'authenticated', 'student_c@vnit.test'),
    (v_recruiter_id, 'authenticated', 'authenticated', 'recruiter@company.test'),
    (v_deact_id, 'authenticated', 'authenticated', 'deactivated@vnit.test'),
    (v_new_stud_id, 'authenticated', 'authenticated', 'new_student@vnit.test')
  ON CONFLICT (id) DO NOTHING;

  -- Create Profiles
  INSERT INTO profiles (id, role, display_name, is_active, coordinator_slot, student_lifecycle_status) VALUES
    (v_sec_id, 'TNP_SECRETARY', 'Secretary Jane', true, NULL, NULL),
    (v_coord_id, 'TNP_COORDINATOR', 'Coordinator Bob', true, 'SLOT_1', NULL),
    (v_stud_a_id, 'STUDENT', 'Student Alice', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud_b_id, 'STUDENT', 'Student Bob', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud_c_id, 'STUDENT', 'Student Charlie', true, NULL, 'STUDENT_ACTIVE'),
    (v_recruiter_id, 'RECRUITER', 'Recruiter Dave', true, NULL, NULL),
    (v_deact_id, 'STUDENT', 'Deactivated Dan', false, NULL, 'STUDENT_ACTIVE')
  ON CONFLICT (id) DO NOTHING;

  -- Create Student Profiles
  INSERT INTO student_profiles (profile_id, public_headline) VALUES
    (v_stud_a_id, 'Alice Headline'),
    (v_stud_b_id, 'Bob Headline'),
    (v_stud_c_id, 'Charlie Headline'),
    (v_deact_id, 'Dan Headline')
  ON CONFLICT (profile_id) DO NOTHING;

  -- Create Academic Records
  INSERT INTO academic_records (profile_id, program_id, batch, cgpa, verification_status, verified_by, verified_at) VALUES
    (v_stud_a_id, v_barch_id, '2026', 8.50, 'VERIFIED', v_admin_id, now()),
    (v_stud_b_id, v_barch_id, '2026', 7.80, 'VERIFIED', v_admin_id, now()),
    (v_stud_c_id, v_mplan_id, '2027', 9.10, 'VERIFIED', v_admin_id, now()),
    (v_deact_id, v_barch_id, '2026', 6.50, 'UNVERIFIED', NULL, NULL)
  ON CONFLICT (profile_id) DO NOTHING;

  -- Assign coordinator scope ONLY for BARCH 2026
  INSERT INTO coordinator_student_scopes (coordinator_id, program_id, batch, granted_by) VALUES
    (v_coord_id, v_barch_id, '2026', v_admin_id)
  ON CONFLICT (coordinator_id, program_id, batch) DO NOTHING;

  -- Seed Roster entry for Alice (claimed) and New Student (unclaimed)
  INSERT INTO student_roster (institutional_id, full_name, institutional_email, program_id, batch, is_active, claimed_by)
  VALUES
    ('ID_ALICE', 'Student Alice', 'student_a@vnit.test', v_barch_id, '2026', true, v_stud_a_id),
    ('ID_NEW_STUD', 'New Student', 'new_student@vnit.test', v_barch_id, '2026', true, NULL)
  ON CONFLICT (institutional_email) DO NOTHING;
END;
$$;

-- ============================================================================
-- 2. Anonymous User Tests
-- ============================================================================
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '{}';

SELECT is_empty(
  'SELECT * FROM student_roster',
  'Anonymous cannot read student_roster'
);

SELECT is_empty(
  'SELECT * FROM student_profiles',
  'Anonymous cannot read student_profiles'
);

SELECT is_empty(
  'SELECT * FROM academic_records',
  'Anonymous cannot read academic_records'
);

SELECT is_empty(
  'SELECT * FROM applications',
  'Anonymous cannot read applications'
);

SELECT throws_ok(
  $$ SELECT * FROM audit_logs $$,
  '42501',
  NULL,
  'Anonymous cannot read audit_logs (permission denied)'
);

SELECT throws_ok(
  $$ INSERT INTO audit_logs (action) VALUES ('FAKE_ANON_LOG') $$,
  '42501',
  NULL,
  'Anonymous cannot direct insert into audit_logs'
);

-- ============================================================================
-- 3. Student A (Alice) Context Tests
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  'SELECT display_name FROM profiles WHERE id = ''40000000-0000-0000-0000-000000000001''',
  ARRAY['Student Alice'],
  'Student A can read own profile'
);

SELECT is_empty(
  'SELECT * FROM profiles WHERE id = ''40000000-0000-0000-0000-000000000002''',
  'Student A cannot read Student B private profile row'
);

SELECT results_eq(
  'SELECT public_headline FROM student_profiles WHERE profile_id = ''40000000-0000-0000-0000-000000000001''',
  ARRAY['Alice Headline'],
  'Student A can read own student profile'
);

SELECT is_empty(
  'SELECT * FROM student_profiles WHERE profile_id = ''40000000-0000-0000-0000-000000000002''',
  'Student A cannot read Student B student profile'
);

SELECT results_eq(
  'SELECT cgpa FROM academic_records WHERE profile_id = ''40000000-0000-0000-0000-000000000001''',
  ARRAY[8.50::numeric(4,2)],
  'Student A can read own academic record'
);

SELECT is_empty(
  'SELECT * FROM academic_records WHERE profile_id = ''40000000-0000-0000-0000-000000000002''',
  'Student A cannot read Student B academic record'
);

SELECT is_empty(
  'SELECT * FROM student_roster',
  'Student A cannot browse student_roster (even own row)'
);

-- Student cannot modify academic record (RLS denies UPDATE)
SELECT is_empty(
  'UPDATE academic_records SET cgpa = 10.00 WHERE profile_id = ''40000000-0000-0000-0000-000000000001'' RETURNING *',
  'Student A cannot modify their own academic record'
);

-- Student cannot directly modify profiles (RLS default-deny on UPDATE)
SELECT is_empty(
  'UPDATE profiles SET role = ''SUPER_ADMIN'' WHERE id = ''40000000-0000-0000-0000-000000000001'' RETURNING *',
  'Student A cannot change own role'
);

SELECT is_empty(
  'UPDATE profiles SET is_active = false WHERE id = ''40000000-0000-0000-0000-000000000001'' RETURNING *',
  'Student A cannot change own is_active status'
);

SELECT is_empty(
  'UPDATE profiles SET coordinator_slot = ''SLOT_1'' WHERE id = ''40000000-0000-0000-0000-000000000001'' RETURNING *',
  'Student A cannot change own coordinator slot'
);

SELECT is_empty(
  'UPDATE profiles SET student_lifecycle_status = ''ALUMNI'' WHERE id = ''40000000-0000-0000-0000-000000000001'' RETURNING *',
  'Student A cannot change own student lifecycle status'
);

SELECT is_empty(
  'UPDATE profiles SET display_name = ''Hacked'' WHERE id = ''40000000-0000-0000-0000-000000000001'' RETURNING *',
  'Student A cannot directly change display name (direct UPDATE denied)'
);

-- Student cannot call assign_role()
SELECT throws_ok(
  $$ SELECT assign_role('40000000-0000-0000-0000-000000000002'::UUID, 'TNP_SECRETARY'::user_role) $$,
  'Unauthorized: Only an active SUPER_ADMIN can assign roles',
  'Student A cannot assign roles'
);

-- Student cannot direct insert into audit_logs
SELECT throws_ok(
  $$ INSERT INTO audit_logs (action) VALUES ('FAKE_STUDENT_LOG') $$,
  '42501',
  NULL,
  'Student cannot direct insert into audit_logs'
);

-- Identity Impersonation Protection
SELECT results_eq(
  'SELECT get_my_role()::text',
  ARRAY['STUDENT'],
  'get_my_role() returns STUDENT for Student A'
);

SELECT results_eq(
  'SELECT is_super_admin()',
  ARRAY[false],
  'is_super_admin() is false for Student A'
);

-- Student cannot execute private scoping helper
SELECT throws_ok(
  $$ SELECT _coordinator_has_scope_over('40000000-0000-0000-0000-000000000002'::UUID) $$,
  '42501',
  NULL,
  'Student cannot execute private _coordinator_has_scope_over function'
);

-- ============================================================================
-- 4. Deactivated User Tests
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '60000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "60000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is_empty(
  'SELECT * FROM student_profiles WHERE profile_id = ''60000000-0000-0000-0000-000000000001''',
  'Deactivated student cannot read student_profiles'
);

SELECT is_empty(
  'SELECT * FROM academic_records WHERE profile_id = ''60000000-0000-0000-0000-000000000001''',
  'Deactivated student cannot read academic_records'
);

-- ============================================================================
-- 5. Coordinator Tests (Scoped to BARCH 2026)
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Coordinator can see Alice (in-scope: BARCH 2026)
SELECT results_eq(
  'SELECT public_headline FROM student_profiles WHERE profile_id = ''40000000-0000-0000-0000-000000000001''',
  ARRAY['Alice Headline'],
  'Coordinator can read in-scope student profile'
);

SELECT results_eq(
  'SELECT cgpa FROM academic_records WHERE profile_id = ''40000000-0000-0000-0000-000000000001''',
  ARRAY[8.50::numeric(4,2)],
  'Coordinator can read in-scope academic record'
);

-- Coordinator CANNOT see Charlie (out-of-scope: MPLAN 2027)
SELECT is_empty(
  'SELECT * FROM student_profiles WHERE profile_id = ''40000000-0000-0000-0000-000000000003''',
  'Coordinator cannot read out-of-scope student profile'
);

SELECT is_empty(
  'SELECT * FROM academic_records WHERE profile_id = ''40000000-0000-0000-0000-000000000003''',
  'Coordinator cannot read out-of-scope academic record'
);

SELECT is_empty(
  'SELECT * FROM student_roster',
  'Coordinator cannot browse student_roster'
);

SELECT throws_ok(
  $$ SELECT assign_role('40000000-0000-0000-0000-000000000001'::UUID, 'TNP_SECRETARY'::user_role) $$,
  'Unauthorized: Only an active SUPER_ADMIN can assign roles',
  'Coordinator cannot assign roles'
);

-- Coordinator cannot mutate academic programs
SELECT throws_ok(
  $$ INSERT INTO academic_programs (code, display_name, degree_level, duration_years, created_by) VALUES ('TEST_PRG', 'Test', 'UG', 4, '30000000-0000-0000-0000-000000000001'::uuid) $$,
  '42501',
  NULL,
  'Coordinator cannot insert academic_programs (RLS denies)'
);

SELECT throws_ok(
  $$ INSERT INTO audit_logs (action) VALUES ('FAKE_COORD_LOG') $$,
  '42501',
  NULL,
  'Coordinator cannot direct insert into audit_logs'
);

-- ============================================================================
-- 6. Secretary Tests (Department-Wide Scope)
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  'SELECT count(*)::integer FROM student_profiles WHERE profile_id IN (''40000000-0000-0000-0000-000000000001'', ''40000000-0000-0000-0000-000000000003'')',
  ARRAY[2],
  'Secretary can read department-wide student profiles'
);

SELECT ok(
  (SELECT count(*) FROM student_roster) > 0,
  'Secretary can read student_roster'
);

SELECT throws_ok(
  $$ SELECT assign_role('40000000-0000-0000-0000-000000000001'::UUID, 'TNP_COORDINATOR'::user_role, 'SLOT_2'::coordinator_slot) $$,
  'Unauthorized: Only an active SUPER_ADMIN can assign roles',
  'Secretary cannot assign coordinator role'
);

SELECT throws_ok(
  $$ SELECT remove_staff_role('30000000-0000-0000-0000-000000000001'::UUID) $$,
  'Unauthorized: Only an active SUPER_ADMIN can remove staff roles',
  'Secretary cannot remove staff role'
);

-- Secretary cannot assign coordinator student scopes
SELECT throws_ok(
  $$ INSERT INTO coordinator_student_scopes (coordinator_id, program_id, batch, granted_by) VALUES ('30000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM academic_programs WHERE code = 'MPLAN'), '2027', '20000000-0000-0000-0000-000000000001'::uuid) $$,
  '42501',
  NULL,
  'Secretary cannot insert into coordinator_student_scopes (RLS denies)'
);

-- Secretary cannot mutate academic programs
SELECT throws_ok(
  $$ INSERT INTO academic_programs (code, display_name, degree_level, duration_years, created_by) VALUES ('SEC_PRG', 'Test', 'UG', 4, '20000000-0000-0000-0000-000000000001'::uuid) $$,
  '42501',
  NULL,
  'Secretary cannot insert academic_programs (RLS denies)'
);

SELECT throws_ok(
  $$ INSERT INTO audit_logs (action) VALUES ('FAKE_SEC_LOG') $$,
  '42501',
  NULL,
  'Secretary cannot direct insert into audit_logs'
);

-- ============================================================================
-- 7. Super Admin Tests
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is(
  (SELECT assign_role('40000000-0000-0000-0000-000000000001'::UUID, 'TNP_COORDINATOR'::user_role, 'SLOT_2'::coordinator_slot)->>'success')::boolean,
  true,
  'Super Admin can assign coordinator role to Slot 2'
);

-- Cannot assign second secretary
SELECT throws_ok(
  $$ SELECT assign_role('40000000-0000-0000-0000-000000000002'::UUID, 'TNP_SECRETARY'::user_role) $$,
  'An active TNP Secretary already exists (cardinality limit: 1)',
  'Super Admin cannot assign second Secretary'
);

-- Cannot assign slot 1 if already occupied
SELECT throws_ok(
  $$ SELECT assign_role('40000000-0000-0000-0000-000000000002'::UUID, 'TNP_COORDINATOR'::user_role, 'SLOT_1'::coordinator_slot) $$,
  'Coordinator slot SLOT_1 is already occupied',
  'Super Admin cannot assign already occupied coordinator slot'
);

-- Super Admin can assign coordinator student scopes
SELECT lives_ok(
  $$ INSERT INTO coordinator_student_scopes (coordinator_id, program_id, batch, granted_by) VALUES ('40000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM academic_programs WHERE code = 'MPLAN'), '2027', '00000000-0000-0000-0000-000000000001'::uuid) $$,
  'Super Admin can assign coordinator student scopes'
);

-- Super Admin can manage academic programs
SELECT lives_ok(
  $$ INSERT INTO academic_programs (code, display_name, degree_level, duration_years, created_by) VALUES ('ADMIN_PRG', 'Admin Program', 'PG', 2, '00000000-0000-0000-0000-000000000001'::uuid) $$,
  'Super Admin can insert academic programs'
);

-- Super Admin can read full audit logs
SELECT ok(
  (SELECT count(*) FROM audit_logs) > 0,
  'Super Admin can read full audit logs'
);

-- Super Admin cannot UPDATE or DELETE audit_logs (privileges revoked and trigger prevents)
SELECT throws_ok(
  $$ UPDATE audit_logs SET action = 'TAMPERED' $$,
  '42501',
  NULL,
  'Super Admin cannot UPDATE audit_logs (permission denied)'
);

SELECT throws_ok(
  $$ DELETE FROM audit_logs $$,
  '42501',
  NULL,
  'Super Admin cannot DELETE audit_logs (permission denied)'
);

-- Super Admin can remove staff role
SELECT is(
  (SELECT remove_staff_role('40000000-0000-0000-0000-000000000001'::UUID)->>'success')::boolean,
  true,
  'Super Admin can remove staff role'
);

-- ============================================================================
-- 8. Recruiter Context Tests
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is_empty(
  'SELECT * FROM student_profiles',
  'Recruiter cannot read student_profiles'
);

SELECT is_empty(
  'SELECT * FROM academic_records',
  'Recruiter cannot read academic_records'
);

SELECT is_empty(
  'SELECT * FROM applications',
  'Recruiter cannot read applications'
);

SELECT is_empty(
  'SELECT * FROM student_roster',
  'Recruiter cannot read student_roster'
);

SELECT is_empty(
  'SELECT * FROM audit_logs',
  'Recruiter cannot read audit_logs'
);

SELECT throws_ok(
  $$ INSERT INTO audit_logs (action) VALUES ('FAKE_REC_LOG') $$,
  '42501',
  NULL,
  'Recruiter cannot direct insert into audit_logs'
);

-- ============================================================================
-- 9. Student Provisioning Operation Tests
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '70000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "70000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is(
  (SELECT provision_student_account()->>'success')::boolean,
  true,
  'provision_student_account succeeds for valid unclaimed roster student'
);

SELECT results_eq(
  'SELECT role::text FROM profiles WHERE id = ''70000000-0000-0000-0000-000000000001''',
  ARRAY['STUDENT'],
  'Provisioning created active STUDENT profile'
);

-- Switch to postgres/admin to inspect student_roster (since students cannot read roster via RLS)
SET LOCAL ROLE postgres;
SELECT results_eq(
  'SELECT claimed_by FROM student_roster WHERE institutional_email = ''new_student@vnit.test''',
  ARRAY['70000000-0000-0000-0000-000000000001'::uuid],
  'Roster entry is claimed by provisioned student'
);

-- Switch back to student to verify idempotency on repeated call
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '70000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "70000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is(
  (SELECT provision_student_account()->>'status'),
  'ALREADY_PROVISIONED',
  'Repeated provision_student_account call is cleanly idempotent'
);

SELECT * FROM finish();
ROLLBACK;
