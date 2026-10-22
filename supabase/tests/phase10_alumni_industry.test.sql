-- Phase 10 — Alumni & Industry Relations Test Suite
-- Tests alumni lifecycle (STUDENT_ACTIVE -> STUDENT_GRADUATED -> ALUMNI),
-- authoritative cohort derivation (single year and year-range batches),
-- matched vs unmatched employer rules, archived company matching rejection,
-- self-service updates, consent timestamping, additive employment history,
-- zero deletion invariants across all roles, staff matching/verification,
-- deep staff analytics (by company, by year, outreach candidates),
-- anon RLS denials, public directory RPC, and Phase 9 showcase exclusion.

BEGIN;

SELECT plan(82);

-- ============================================================================
-- Fixtures Setup
-- ============================================================================

DO $$
DECLARE
  v_admin_id      UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_sec_id        UUID := '20000000-0000-0000-0000-000000000001'::UUID;
  v_coord_id      UUID := '30000000-0000-0000-0000-000000000001'::UUID;
  v_stud_active   UUID := '40000000-0000-0000-0000-000000000011'::UUID;
  v_stud_grad     UUID := '40000000-0000-0000-0000-000000000012'::UUID;
  v_stud_alum     UUID := '40000000-0000-0000-0000-000000000013'::UUID;
  v_stud_unscoped UUID := '40000000-0000-0000-0000-000000000014'::UUID;
  v_stud_range    UUID := '40000000-0000-0000-0000-000000000015'::UUID;

  v_prog_barch_id UUID;
  v_prog_mplan_id UUID;
  v_company_id    UUID;
  v_arch_comp_id  UUID := '60000000-0000-0000-0000-000000000099'::UUID;
BEGIN
  -- Programs lookup
  SELECT id INTO v_prog_barch_id FROM academic_programs WHERE code = 'BARCH';
  SELECT id INTO v_prog_mplan_id FROM academic_programs WHERE code = 'MPLAN';

  -- Fixture Active Company
  INSERT INTO companies (id, name, normalized_name, website, description, is_archived, created_by) VALUES
    ('60000000-0000-0000-0000-000000000001'::UUID, 'Foster + Partners', 'FOSTER + PARTNERS', 'https://fosterandpartners.com', 'Architecture Practice', false, v_admin_id)
  ON CONFLICT (id) DO UPDATE SET is_archived = false;

  -- Fixture Archived Company
  INSERT INTO companies (id, name, normalized_name, website, description, is_archived, created_by) VALUES
    (v_arch_comp_id, 'Defunct Architects', 'DEFUNCT ARCHITECTS', 'https://defunct.example.com', 'Archived Studio', true, v_admin_id)
  ON CONFLICT (id) DO UPDATE SET is_archived = true;

  -- Auth Users
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (v_admin_id, 'authenticated', 'authenticated', 'admin10@vnit.test'),
    (v_sec_id, 'authenticated', 'authenticated', 'sec10@vnit.test'),
    (v_coord_id, 'authenticated', 'authenticated', 'coord10@vnit.test'),
    (v_stud_active, 'authenticated', 'authenticated', 'active10@vnit.test'),
    (v_stud_grad, 'authenticated', 'authenticated', 'grad10@vnit.test'),
    (v_stud_alum, 'authenticated', 'authenticated', 'alum10@vnit.test'),
    (v_stud_unscoped, 'authenticated', 'authenticated', 'unscoped10@vnit.test'),
    (v_stud_range, 'authenticated', 'authenticated', 'range10@vnit.test')
  ON CONFLICT (id) DO NOTHING;

  -- Fixture Users (Profiles)
  INSERT INTO profiles (id, display_name, role, is_active, coordinator_slot, student_lifecycle_status) VALUES
    (v_admin_id, 'Super Admin', 'SUPER_ADMIN', true, NULL, NULL),
    (v_sec_id, 'Secretary Jane', 'TNP_SECRETARY', true, NULL, NULL),
    (v_coord_id, 'Coordinator Bob', 'TNP_COORDINATOR', true, 'SLOT_1', NULL),
    (v_stud_active, 'Active Student', 'STUDENT', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud_grad, 'Graduated Student', 'STUDENT', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud_alum, 'Alumni User', 'STUDENT', true, NULL, 'ALUMNI'),
    (v_stud_unscoped, 'Unscoped Student', 'STUDENT', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud_range, 'Range Batch Student', 'STUDENT', true, NULL, 'STUDENT_GRADUATED')
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    coordinator_slot = EXCLUDED.coordinator_slot,
    student_lifecycle_status = EXCLUDED.student_lifecycle_status;

  -- Fixture Student Profiles (with slugs)
  INSERT INTO student_profiles (profile_id, public_profile_slug, public_profile_enabled) VALUES
    (v_stud_active, 'active-student-slug', true),
    (v_stud_grad, 'grad-showcase-slug', true),
    (v_stud_alum, 'alumni-showcase-slug', true),
    (v_stud_unscoped, 'unscoped-student-slug', true),
    (v_stud_range, 'range-batch-slug', true)
  ON CONFLICT (profile_id) DO NOTHING;

  -- Academic Records (Verified)
  INSERT INTO academic_records (profile_id, program_id, batch, cgpa, active_backlogs, verification_status, verified_by, verified_at) VALUES
    (v_stud_active, v_prog_barch_id, '2026', 8.50, 0, 'VERIFIED', v_admin_id, clock_timestamp()),
    (v_stud_grad, v_prog_barch_id, '2025', 9.00, 0, 'VERIFIED', v_admin_id, clock_timestamp()),
    (v_stud_alum, v_prog_barch_id, '2024', 8.20, 0, 'VERIFIED', v_admin_id, clock_timestamp()),
    (v_stud_unscoped, v_prog_mplan_id, '2026', 7.50, 0, 'VERIFIED', v_admin_id, clock_timestamp()),
    (v_stud_range, v_prog_barch_id, '2022-2027', 8.80, 0, 'VERIFIED', v_admin_id, clock_timestamp())
  ON CONFLICT (profile_id) DO UPDATE SET
    batch = EXCLUDED.batch,
    verification_status = EXCLUDED.verification_status,
    verified_at = EXCLUDED.verified_at;

  -- Coordinator Scopes
  -- Coordinator 3000... has scope over BARCH 2025 and 2026, but NOT MPLAN 2026, BARCH 2024, or BARCH 2022-2027
  INSERT INTO coordinator_student_scopes (coordinator_id, program_id, batch, granted_by) VALUES
    (v_coord_id, v_prog_barch_id, '2026', v_admin_id),
    (v_coord_id, v_prog_barch_id, '2025', v_admin_id)
  ON CONFLICT (coordinator_id, program_id, batch) DO NOTHING;

  -- Seed an existing alumni profile for v_stud_alum
  INSERT INTO alumni_profiles (
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
    consent_recorded_at,
    willing_to_mentor,
    willing_to_refer,
    willing_to_support_placement
  ) VALUES (
    v_stud_alum,
    2024,
    v_prog_barch_id,
    'Design Matrix Ltd',
    NULL,
    'Principal Architect',
    'Architecture & Urbanism',
    'Pune',
    'India',
    'https://linkedin.com/in/alumni-user-10',
    true,
    now(),
    true,
    true,
    false
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    public_alumni_enabled = EXCLUDED.public_alumni_enabled,
    consent_recorded_at = EXCLUDED.consent_recorded_at,
    willing_to_mentor = EXCLUDED.willing_to_mentor,
    willing_to_refer = EXCLUDED.willing_to_refer;

END $$;

-- ============================================================================
-- Section 1: Helper Functions & Schema Structure (Tests 1-12)
-- ============================================================================

SELECT has_function('public', 'is_active_alumni', 'is_active_alumni helper exists');
SELECT has_function('public', 'mark_student_graduated', ARRAY['uuid', 'text'], 'mark_student_graduated procedure exists');
SELECT has_function('public', 'convert_student_to_alumni', 'convert_student_to_alumni procedure exists');
SELECT has_function('public', 'update_own_alumni_profile', 'update_own_alumni_profile procedure exists');
SELECT has_function('public', 'add_own_alumni_employment', 'add_own_alumni_employment procedure exists');
SELECT has_function('public', 'match_alumni_company', 'match_alumni_company procedure exists');
SELECT has_function('public', 'verify_alumni_profile', 'verify_alumni_profile procedure exists');
SELECT has_function('public', 'get_public_alumni_directory', 'get_public_alumni_directory RPC exists');
SELECT has_function('public', 'get_staff_alumni_by_company', 'get_staff_alumni_by_company RPC exists');
SELECT has_function('public', 'get_staff_alumni_by_year', 'get_staff_alumni_by_year RPC exists');
SELECT has_function('public', 'get_staff_alumni_outreach_candidates', 'get_staff_alumni_outreach_candidates RPC exists');
SELECT hasnt_function('public', 'delete_own_alumni_employment', 'delete_own_alumni_employment RPC is dropped from schema');

-- ============================================================================
-- Section 2: Helper Function is_active_alumni & Grant Check (Tests 13-14)
-- ============================================================================

-- Authenticated user cannot directly invoke is_active_alumni (internal helper only)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000013", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.is_active_alumni() $$,
  '42501',
  NULL,
  'Direct execution of is_active_alumni by authenticated user is denied (internal helper only)'
);

-- Internal execution as postgres functions correctly
SET LOCAL ROLE postgres;
SET LOCAL "request.jwt.claims" = '';
SELECT is(
  public.is_active_alumni(),
  false,
  'is_active_alumni executes internally and returns false when no JWT sub claim present'
);

-- ============================================================================
-- Section 3: Graduation Authority: mark_student_graduated (Tests 15-21)
-- ============================================================================

-- Unauthorized caller: student trying to graduate self
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000011", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.mark_student_graduated('40000000-0000-0000-0000-000000000011'::UUID, 'Self graduation attempt') $$,
  '42501',
  NULL,
  'Student cannot graduate themselves'
);

-- Out of scope coordinator: Coordinator lacks authority over MPLAN 2026 student
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.mark_student_graduated('40000000-0000-0000-0000-000000000014'::UUID, 'Out of scope graduation') $$,
  '42501',
  NULL,
  'Coordinator out of scope cannot graduate student'
);

-- In-scope coordinator: graduates BARCH 2025 student successfully
SELECT lives_ok(
  $$ SELECT public.mark_student_graduated('40000000-0000-0000-0000-000000000012'::UUID, 'Completed B.Arch coursework and studio finals') $$,
  'In-scope coordinator can mark student graduated'
);

-- Verify status changed to STUDENT_GRADUATED and account is NOT deactivated
SELECT is(
  (SELECT student_lifecycle_status FROM profiles WHERE id = '40000000-0000-0000-0000-000000000012'::UUID),
  'STUDENT_GRADUATED'::student_lifecycle_status,
  'Student lifecycle status updated to STUDENT_GRADUATED'
);

SELECT is(
  (SELECT is_active FROM profiles WHERE id = '40000000-0000-0000-0000-000000000012'::UUID),
  true,
  'Account remains active (is_active = true) at graduation per A1-Q1'
);

-- Empty graduation reason rejected
SELECT throws_ok(
  $$ SELECT public.mark_student_graduated('40000000-0000-0000-0000-000000000011'::UUID, '   ') $$,
  '22023',
  NULL,
  'Graduation reason cannot be empty or whitespace'
);

-- Cannot graduate an already graduated student
SELECT throws_ok(
  $$ SELECT public.mark_student_graduated('40000000-0000-0000-0000-000000000012'::UUID, 'Re-graduate') $$,
  'P0001',
  NULL,
  'Cannot mark an already graduated student as graduated'
);

-- Reset back to postgres role for next checks
SET LOCAL ROLE postgres;
SET LOCAL "request.jwt.claims" = '';

-- ============================================================================
-- Section 4: Alumni Conversion & Batch Parsing (Tests 22-33)
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Deny direct transition from STUDENT_ACTIVE to ALUMNI
SELECT throws_ok(
  $$ SELECT public.convert_student_to_alumni(
       '40000000-0000-0000-0000-000000000014'::UUID,
       'Unscoped Company'
     ) $$,
  'P0001',
  NULL,
  'Cannot convert STUDENT_ACTIVE directly to ALUMNI without graduation'
);

-- Deny invalid company matching: both company_id and current_organization cannot be set
SELECT throws_ok(
  $$ SELECT public.convert_student_to_alumni(
       '40000000-0000-0000-0000-000000000012'::UUID,
       'Acme Corp Free Text',
       '60000000-0000-0000-0000-000000000001'::UUID
     ) $$,
  '22023',
  NULL,
  'Cannot supply both company_id and current_organization simultaneously'
);

-- Deny matching to archived company on conversion
SELECT throws_ok(
  $$ SELECT public.convert_student_to_alumni(
       '40000000-0000-0000-0000-000000000012'::UUID,
       NULL,
       '60000000-0000-0000-0000-000000000099'::UUID
     ) $$,
  'P0002',
  NULL,
  'Cannot convert to alumni with archived company reference'
);

-- Successful staff conversion of graduated student to alumni (unmatched company)
SELECT lives_ok(
  $$ SELECT public.convert_student_to_alumni(
       '40000000-0000-0000-0000-000000000012'::UUID,
       'Tata Consultancy Services',
       NULL,
       'Software Engineer',
       'Information Technology',
       'Bengaluru',
       'India',
       'https://linkedin.com/in/grad-student'
     ) $$,
  'Staff can convert STUDENT_GRADUATED to ALUMNI'
);

SELECT is(
  (SELECT student_lifecycle_status FROM profiles WHERE id = '40000000-0000-0000-0000-000000000012'::UUID),
  'ALUMNI'::student_lifecycle_status,
  'Lifecycle status successfully set to ALUMNI'
);

SELECT is(
  (SELECT graduation_year FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID),
  2025,
  'Graduation year authoritatively derived from single 4-digit batch (2025)'
);

SELECT is(
  (SELECT current_organization FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID),
  'Tata Consultancy Services',
  'Unmatched employer text preserved when company_id is NULL'
);

-- Conversion with Year-Range Batch: '2022-2027' -> graduation year 2027
SELECT lives_ok(
  $$ SELECT public.convert_student_to_alumni(
       '40000000-0000-0000-0000-000000000015'::UUID,
       'Morphogenesis',
       NULL,
       'Architect',
       'Sustainable Architecture'
     ) $$,
  'Conversion with year-range batch (2022-2027) succeeds'
);

SELECT is(
  (SELECT graduation_year FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000015'::UUID),
  2027,
  'Graduation year extracted as end year 2027 from batch range 2022-2027'
);

-- Batch parsing validation tests (as postgres)
SET LOCAL ROLE postgres;
SET LOCAL "request.jwt.claims" = '';

-- Reset v_stud_range academic record to malformed batch to test rejection
UPDATE academic_records SET batch = 'Spring 2027' WHERE profile_id = '40000000-0000-0000-0000-000000000011'::UUID;
-- Graduate student 11
UPDATE profiles SET student_lifecycle_status = 'STUDENT_GRADUATED' WHERE id = '40000000-0000-0000-0000-000000000011'::UUID;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT public.convert_student_to_alumni('40000000-0000-0000-0000-000000000011'::UUID, 'Studio A') $$,
  '22023',
  NULL,
  'Malformed batch format (Spring 2027) is rejected with 22023'
);

-- Inverted batch range rejected
SET LOCAL ROLE postgres;
SET LOCAL "request.jwt.claims" = '';
UPDATE academic_records SET batch = '2027-2022' WHERE profile_id = '40000000-0000-0000-0000-000000000011'::UUID;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT public.convert_student_to_alumni('40000000-0000-0000-0000-000000000011'::UUID, 'Studio A') $$,
  '22023',
  NULL,
  'Inverted batch range (2027-2022) is rejected with 22023'
);

-- ============================================================================
-- Section 5: Alumni Self-Service & Consent Server-Timestamping (Tests 34-42)
-- ============================================================================

-- Other student cannot update someone else's alumni profile
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000014", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.update_own_alumni_profile(
       'Freelance Studio',
       NULL,
       'Senior Architect'
     ) $$,
  '42501',
  NULL,
  'Active student (non-alumni) cannot update alumni profile'
);

-- Alumni 12 updates own profile
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000012", "role": "authenticated"}';
SELECT lives_ok(
  $$ SELECT public.update_own_alumni_profile(
       NULL,
       '60000000-0000-0000-0000-000000000001'::UUID,
       'Design Architect',
       'Sustainable Design',
       'London',
       'United Kingdom',
       'https://linkedin.com/in/verified-alum',
       'Harvard Graduate School of Design',
       'Master in Architecture',
       2026,
       true,
       true,
       true,
       true
     ) $$,
  'Alumnus can update own profile details'
);

SELECT is(
  (SELECT company_id FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID),
  '60000000-0000-0000-0000-000000000001'::UUID,
  'Canonical company_id set'
);

SELECT is(
  (SELECT current_organization FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID),
  NULL,
  'current_organization is atomically set to NULL when company_id is provided'
);

SELECT is(
  (SELECT public_alumni_enabled FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID),
  true,
  'public_alumni_enabled is now true'
);

SELECT isnt(
  (SELECT consent_recorded_at FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID),
  NULL,
  'Server database time stamped consent_recorded_at upon enabling public profile'
);

-- Cannot update to archived company
SELECT throws_ok(
  $$ SELECT public.update_own_alumni_profile(
       NULL,
       '60000000-0000-0000-0000-000000000099'::UUID
     ) $$,
  'P0002',
  NULL,
  'Cannot update own profile to link to an archived company'
);

-- Toggling public_alumni_enabled to false clears consent_recorded_at
SELECT lives_ok(
  $$ SELECT public.update_own_alumni_profile(
       NULL,
       '60000000-0000-0000-0000-000000000001'::UUID,
       'Design Architect',
       'Sustainable Design',
       'London',
       'United Kingdom',
       'https://linkedin.com/in/verified-alum',
       NULL,
       NULL,
       NULL,
       false,
       false,
       false,
       false
     ) $$,
  'Alumnus can opt out of public directory'
);

SELECT is(
  (SELECT consent_recorded_at FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID),
  NULL,
  'consent_recorded_at is reset to NULL when public_alumni_enabled is false'
);

-- ============================================================================
-- Section 6: Additive Employment History & Zero Deletion Invariants (Tests 43-52)
-- ============================================================================

-- Opt back in for downstream tests
SELECT public.update_own_alumni_profile(
  NULL,
  '60000000-0000-0000-0000-000000000001'::UUID,
  'Design Architect',
  'Sustainable Design',
  'London',
  'United Kingdom',
  'https://linkedin.com/in/verified-alum',
  NULL,
  NULL,
  NULL,
  true,
  true,
  true,
  true
);

-- Alumnus adds first employment history row
SELECT lives_ok(
  $$ SELECT public.add_own_alumni_employment(
       'Apex Architecture Bureau',
       'Junior Architect',
       '2024-06-01'::DATE,
       '2025-05-31'::DATE,
       NULL,
       'Architecture',
       'Pune',
       'India',
       'Worked on commercial complexes'
     ) $$,
  'Alumni can add own past employment history'
);

-- Alumnus adds second employment position (additive timeline)
SELECT lives_ok(
  $$ SELECT public.add_own_alumni_employment(
       'Foster + Partners',
       'Design Architect',
       '2025-06-01'::DATE,
       NULL,
       '60000000-0000-0000-0000-000000000001'::UUID,
       'Sustainable Architecture',
       'London',
       'United Kingdom',
       'Major master plan projects'
     ) $$,
  'Alumni adds second employment record (additive progression)'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM alumni_employment_history WHERE alumni_id = (SELECT id FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID)),
  2,
  'Exactly 2 employment history entries recorded'
);

-- Invalid dates (start_date > end_date) must fail with 22023
SELECT throws_ok(
  $$ SELECT public.add_own_alumni_employment(
       'Some Studio',
       'Intern',
       '2025-01-01'::DATE,
       '2024-01-01'::DATE
     ) $$,
  '22023',
  NULL,
  'Employment start_date cannot be after end_date'
);

-- Adding employment with archived company rejected
SELECT throws_ok(
  $$ SELECT public.add_own_alumni_employment(
       'Defunct Studio',
       'Intern',
       '2024-01-01'::DATE,
       '2024-05-01'::DATE,
       '60000000-0000-0000-0000-000000000099'::UUID
     ) $$,
  'P0002',
  NULL,
  'Cannot add employment linked to an archived company'
);

-- Direct DELETE on alumni_employment_history is DENIED across all roles:
-- 1. Alumni direct DELETE denied
SELECT throws_ok(
  $$ DELETE FROM public.alumni_employment_history WHERE alumni_id = (SELECT id FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID) $$,
  '42501',
  NULL,
  'Direct DELETE on alumni_employment_history by alumni is denied'
);

-- 2. Coordinator direct DELETE denied
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT throws_ok(
  $$ DELETE FROM public.alumni_employment_history $$,
  '42501',
  NULL,
  'Direct DELETE on alumni_employment_history by coordinator is denied'
);

-- 3. Anonymous direct DELETE denied
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '';
SELECT throws_ok(
  $$ DELETE FROM public.alumni_employment_history $$,
  '42501',
  NULL,
  'Direct DELETE on alumni_employment_history by anonymous visitor is denied'
);

-- Verify employment rows survive profile updates and verification
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000012", "role": "authenticated"}';
SELECT public.update_own_alumni_profile(
  'Independent Consultancy',
  NULL,
  'Consultant Architect'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM alumni_employment_history WHERE alumni_id = (SELECT id FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID)),
  2,
  'Updating current profile snapshot does NOT delete or rewrite historical employment rows'
);

-- Re-link canonical company for downstream matching tests
SELECT public.update_own_alumni_profile(
  NULL,
  '60000000-0000-0000-0000-000000000001'::UUID,
  'Design Architect',
  NULL,
  NULL,
  'India',
  NULL,
  NULL,
  NULL,
  NULL,
  true,
  true,
  true,
  true
);

-- ============================================================================
-- Section 7: Staff Company Matching & Verification (Tests 53-61)
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Student cannot match company
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000012", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.match_alumni_company(
       (SELECT id FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID),
       '60000000-0000-0000-0000-000000000001'::UUID,
       'Self matching'
     ) $$,
  '42501',
  NULL,
  'Student cannot call match_alumni_company'
);

-- Staff matching with empty reason rejected
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.match_alumni_company(
       (SELECT id FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID),
       '60000000-0000-0000-0000-000000000001'::UUID,
       '   '
     ) $$,
  '22023',
  NULL,
  'Reason for company match cannot be empty'
);

-- Staff matching to archived company is rejected
SELECT throws_ok(
  $$ SELECT public.match_alumni_company(
       (SELECT id FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID),
       '60000000-0000-0000-0000-000000000099'::UUID,
       'Matching to archived company'
     ) $$,
  'P0002',
  NULL,
  'Cannot match alumnus to an archived company'
);

-- Valid staff company matching
SELECT lives_ok(
  $$ SELECT public.match_alumni_company(
       (SELECT id FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID),
       '60000000-0000-0000-0000-000000000001'::UUID,
       'Verified employment offer letter and corporate email domain'
     ) $$,
  'Staff can match unmatched employer to registered company'
);

-- Student cannot verify profile
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000012", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.verify_alumni_profile(
       (SELECT id FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID)
     ) $$,
  '42501',
  NULL,
  'Student cannot verify alumni profile'
);

-- Staff verifies profile
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ SELECT public.verify_alumni_profile(
       (SELECT id FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID)
     ) $$,
  'Staff can verify alumni profile'
);

SELECT isnt(
  (SELECT last_verified_at FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID),
  NULL,
  'last_verified_at is set upon verification'
);

SELECT is(
  (SELECT last_verified_by FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID),
  '00000000-0000-0000-0000-000000000001'::UUID,
  'last_verified_by recorded staff id'
);

-- Verify employment rows still intact after matching and verification
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM alumni_employment_history WHERE alumni_id = (SELECT id FROM alumni_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID)),
  2,
  'Employment history entries survive company matching and staff verification'
);

-- ============================================================================
-- Section 8: Staff Analytics RPCs: Company, Year, Outreach (Tests 62-69)
-- ============================================================================

-- Staff can execute get_staff_alumni_by_company
SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.get_staff_alumni_by_company()),
  '>=',
  1,
  'get_staff_alumni_by_company returns rows for staff caller'
);

-- Separate handling of unmatched free-text vs canonical companies
SELECT is(
  (SELECT is_canonical FROM public.get_staff_alumni_by_company() WHERE company_name = 'Foster + Partners' LIMIT 1),
  true,
  'Canonical company has is_canonical = true'
);

-- Staff can execute get_staff_alumni_by_year
SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.get_staff_alumni_by_year()),
  '>=',
  1,
  'get_staff_alumni_by_year returns cohort rows'
);

-- Staff can execute get_staff_alumni_outreach_candidates
SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.get_staff_alumni_outreach_candidates()),
  '>=',
  1,
  'get_staff_alumni_outreach_candidates returns outreach candidates'
);

-- Outreach candidate contains willingness flags
SELECT is(
  (SELECT willing_to_mentor FROM public.get_staff_alumni_outreach_candidates() WHERE name = 'Alumni User' LIMIT 1),
  true,
  'Outreach candidate reflects mentorship willingness'
);

-- Recruiter calling staff analytics is DENIED across all 3 RPCs
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_alumni_by_company() $$,
  '42501',
  NULL,
  'Recruiter cannot execute get_staff_alumni_by_company'
);

SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_alumni_by_year() $$,
  '42501',
  NULL,
  'Recruiter cannot execute get_staff_alumni_by_year'
);

SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_alumni_outreach_candidates() $$,
  '42501',
  NULL,
  'Recruiter cannot execute get_staff_alumni_outreach_candidates'
);

-- ============================================================================
-- Section 9: Anonymous Base Table Denials (Tests 70-71)
-- ============================================================================

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '';

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.alumni_profiles),
  0,
  'Anonymous SELECT on alumni_profiles returns 0 rows'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.alumni_employment_history),
  0,
  'Anonymous SELECT on alumni_employment_history returns 0 rows'
);

-- ============================================================================
-- Section 10: Public Directory RPC & Privacy Projection (Tests 72-80)
-- ============================================================================

SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.get_public_alumni_directory()),
  '>=',
  2,
  'Public directory returns consenting active alumni profiles'
);

-- Filter by graduation year
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.get_public_alumni_directory(p_graduation_year => 2025)),
  1,
  'Filter by graduation_year = 2025 returns exactly 1 profile'
);

SELECT is(
  (SELECT name FROM public.get_public_alumni_directory(p_graduation_year => 2025)),
  'Graduated Student',
  'Returned record matches expected display name'
);

-- Coalesced employer returns matched company name
SELECT is(
  (SELECT current_employer FROM public.get_public_alumni_directory(p_graduation_year => 2025)),
  'Foster + Partners',
  'current_employer is populated from matched company'
);

-- Filter by program code
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.get_public_alumni_directory(p_program_code => 'BARCH')),
  2,
  'Filter by program_code = BARCH returns 2 profiles'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.get_public_alumni_directory(p_program_code => 'NONEXISTENT')),
  0,
  'Filter by non-existent program code returns 0 profiles'
);

-- Clamped limit enforcement
SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.get_public_alumni_directory(p_limit => 100)),
  '<=',
  24,
  'Directory limit clamped to maximum 24 records'
);

-- Opt-out immediate absence
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000012", "role": "authenticated"}';
SELECT public.update_own_alumni_profile(
  NULL,
  '60000000-0000-0000-0000-000000000001'::UUID,
  'Design Architect',
  NULL,
  NULL,
  'India',
  NULL,
  NULL,
  NULL,
  NULL,
  true,
  true,
  true,
  false
);

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '';
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.get_public_alumni_directory(p_graduation_year => 2025)),
  0,
  'Alumnus who toggled public_alumni_enabled to false is immediately absent from public directory'
);

-- Re-enable for subsequent checks
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000012", "role": "authenticated"}';
SELECT public.update_own_alumni_profile(
  NULL,
  '60000000-0000-0000-0000-000000000001'::UUID,
  'Design Architect',
  NULL,
  NULL,
  'India',
  NULL,
  NULL,
  NULL,
  NULL,
  true,
  true,
  true,
  true
);

-- ============================================================================
-- Section 11: Phase 9 Showcase Exclusion Regression (Tests 81-82)
-- ============================================================================

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '';

-- Active alumni must NOT appear in Phase 9 student showcase batch page
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.get_public_batch_page('2024') WHERE name = 'Alumni User'),
  0,
  'Alumni user is strictly excluded from Phase 9 public batch page'
);

-- Graduated student transitioned to ALUMNI must not appear in Phase 9 public student profile
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.get_public_student_profile('grad-showcase-slug')),
  0,
  'Alumni user does not appear in Phase 9 get_public_student_profile'
);

-- ============================================================================
-- Section 12: Staff Scoped Access Views (Tests 83-85)
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.v_staff_alumni_directory),
  '>=',
  2,
  'Super Admin sees all alumni in v_staff_alumni_directory'
);

-- Coordinator can see scoped alumni (BARCH 2025 scoped, BARCH 2024 not scoped)
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.v_staff_alumni_directory WHERE profile_id = '40000000-0000-0000-0000-000000000012'::UUID),
  1,
  'Coordinator can view scoped alumni record (BARCH 2025)'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.v_staff_alumni_directory WHERE profile_id = '40000000-0000-0000-0000-000000000013'::UUID),
  0,
  'Coordinator cannot view unscoped alumni record (BARCH 2024)'
);

ROLLBACK;
