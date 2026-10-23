-- Phase 12 — Exports and Basic Operational Analytics Test Suite
-- Tests authoritative statistics derivation, placement conversion rates,
-- repeat recruiter identification, internship-to-placement conversion,
-- bounded export queries (max 1000 rows), authority checks (Super Admin / Secretary only),
-- Coordinator/Student/Recruiter/Anon denials, and sanitized DATA_EXPORT_REQUESTED audit logging.

BEGIN;

SELECT plan(61);

-- ============================================================================
-- 1. Fixtures & Test Actors Setup
-- ============================================================================

DO $$
DECLARE
  v_admin_id     UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_sec_id       UUID := '20000000-0000-0000-0000-000000000012'::UUID;
  v_coord_id     UUID := '30000000-0000-0000-0000-000000000012'::UUID;
  v_stud1_id     UUID := '40000000-0000-0000-0000-000000000021'::UUID;
  v_stud2_id     UUID := '40000000-0000-0000-0000-000000000022'::UUID;
  v_stud3_id     UUID := '40000000-0000-0000-0000-000000000023'::UUID;
  v_recruiter_id UUID := '50000000-0000-0000-0000-000000000012'::UUID;
  v_deact_sec_id UUID := '20000000-0000-0000-0000-000000000099'::UUID;

  v_barch_id     UUID;
  v_comp1_id     UUID;
  v_comp2_id     UUID;

  v_drive_place_2025 UUID := '60000000-0000-0000-0000-000000000001'::UUID;
  v_drive_place_2026 UUID := '60000000-0000-0000-0000-000000000002'::UUID;
  v_drive_intern_2026 UUID := '60000000-0000-0000-0000-000000000003'::UUID;
  v_drive_draft_2026 UUID := '60000000-0000-0000-0000-000000000004'::UUID;
BEGIN
  -- Insert Auth Users
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (v_admin_id, 'authenticated', 'authenticated', 'admin12@vnit.test'),
    (v_sec_id, 'authenticated', 'authenticated', 'sec12@vnit.test'),
    (v_coord_id, 'authenticated', 'authenticated', 'coord12@vnit.test'),
    (v_stud1_id, 'authenticated', 'authenticated', 'stud12_1@vnit.test'),
    (v_stud2_id, 'authenticated', 'authenticated', 'stud12_2@vnit.test'),
    (v_stud3_id, 'authenticated', 'authenticated', 'stud12_3@vnit.test'),
    (v_recruiter_id, 'authenticated', 'authenticated', 'recruiter12@vnit.test'),
    (v_deact_sec_id, 'authenticated', 'authenticated', 'deact_sec12@vnit.test')
  ON CONFLICT (id) DO NOTHING;

  -- Insert Profiles
  INSERT INTO public.profiles (id, role, display_name, is_active, coordinator_slot, student_lifecycle_status) VALUES
    (v_admin_id, 'SUPER_ADMIN', 'Super Admin 12', true, NULL, NULL),
    (v_sec_id, 'TNP_SECRETARY', 'Secretary 12', true, NULL, NULL),
    (v_coord_id, 'TNP_COORDINATOR', 'Coordinator 12', true, 'SLOT_1', NULL),
    (v_stud1_id, 'STUDENT', 'Student 12 One', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud2_id, 'STUDENT', 'Student 12 Two', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud3_id, 'STUDENT', 'Student 12 Three', true, NULL, 'STUDENT_ACTIVE'),
    (v_recruiter_id, 'RECRUITER', 'Recruiter 12', true, NULL, NULL),
    (v_deact_sec_id, 'TNP_SECRETARY', 'Inactive Secretary', false, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    is_active = EXCLUDED.is_active,
    coordinator_slot = EXCLUDED.coordinator_slot,
    student_lifecycle_status = EXCLUDED.student_lifecycle_status;

  SELECT id INTO v_barch_id FROM public.academic_programs WHERE code = 'BARCH';

  -- Roster & Academic records
  INSERT INTO public.student_roster (institutional_id, full_name, institutional_email, program_id, batch, is_active, claimed_by)
  VALUES
    ('BT22ARC021', 'Student 12 One', 'stud12_1@vnit.test', v_barch_id, '2026', true, v_stud1_id),
    ('BT22ARC022', 'Student 12 Two', 'stud12_2@vnit.test', v_barch_id, '2026', true, v_stud2_id),
    ('BT22ARC023', 'Student 12 Three', 'stud12_3@vnit.test', v_barch_id, '2026', true, v_stud3_id)
  ON CONFLICT (institutional_id) DO NOTHING;

  INSERT INTO public.academic_records (profile_id, program_id, batch, cgpa, active_backlogs, verification_status, verified_by, verified_at)
  VALUES
    (v_stud1_id, v_barch_id, '2026', 8.50, 0, 'VERIFIED', v_admin_id, now()),
    (v_stud2_id, v_barch_id, '2026', 7.80, 0, 'VERIFIED', v_admin_id, now()),
    (v_stud3_id, v_barch_id, '2026', 8.90, 0, 'VERIFIED', v_admin_id, now())
  ON CONFLICT (profile_id) DO NOTHING;

  -- Companies
  INSERT INTO public.companies (name, website, created_by)
  VALUES ('Foster and Partners Phase12', 'https://fosterandpartners.test', v_admin_id)
  RETURNING id INTO v_comp1_id;

  INSERT INTO public.companies (name, website, created_by)
  VALUES ('Gensler Design Phase12', 'https://gensler.test', v_admin_id)
  RETURNING id INTO v_comp2_id;

  -- Drives
  -- 1. Drive 2025: PLACEMENT, CLOSED (Foster and Partners)
  INSERT INTO public.placement_drives (
    id, company_id, title, drive_type, status, application_deadline, created_by
  ) VALUES (
    v_drive_place_2025, v_comp1_id, 'Foster 2025 Campus Drive', 'PLACEMENT', 'DRAFT',
    '2025-03-01 18:00:00+00', v_admin_id
  );
  UPDATE public.placement_drives
  SET status = 'PUBLISHED', published_by = v_admin_id, published_at = '2025-02-01 10:00:00+00'
  WHERE id = v_drive_place_2025;
  UPDATE public.placement_drives
  SET status = 'CLOSED', closed_by = v_admin_id, closed_at = '2025-03-05 10:00:00+00'
  WHERE id = v_drive_place_2025;

  -- 2. Drive 2026: PLACEMENT, PUBLISHED (Foster and Partners)
  INSERT INTO public.placement_drives (
    id, company_id, title, drive_type, status, application_deadline, created_by
  ) VALUES (
    v_drive_place_2026, v_comp1_id, 'Foster 2026 Campus Drive', 'PLACEMENT', 'DRAFT',
    '2026-03-01 18:00:00+00', v_admin_id
  );
  UPDATE public.placement_drives
  SET status = 'PUBLISHED', published_by = v_admin_id, published_at = '2026-02-01 10:00:00+00'
  WHERE id = v_drive_place_2026;

  -- 3. Drive 2026: INTERNSHIP, PUBLISHED (Gensler)
  INSERT INTO public.placement_drives (
    id, company_id, title, drive_type, status, application_deadline, created_by
  ) VALUES (
    v_drive_intern_2026, v_comp2_id, 'Gensler Summer Internship 2026', 'INTERNSHIP', 'DRAFT',
    '2026-04-01 18:00:00+00', v_admin_id
  );
  UPDATE public.placement_drives
  SET status = 'PUBLISHED', published_by = v_admin_id, published_at = '2026-03-01 10:00:00+00'
  WHERE id = v_drive_intern_2026;

  -- 4. Drive 2026: PLACEMENT, DRAFT (Should be excluded from statistics)
  INSERT INTO public.placement_drives (
    id, company_id, title, drive_type, status, created_by
  ) VALUES (
    v_drive_draft_2026, v_comp2_id, 'Unpublished Draft Drive', 'PLACEMENT', 'DRAFT', v_admin_id
  );

  -- Applications & Outcomes
  -- Student 1: SELECTED in Foster 2025 PLACEMENT, SELECTED in Gensler 2026 INTERNSHIP, SELECTED in Foster 2026 PLACEMENT
  INSERT INTO public.applications (student_id, drive_id, status, applied_at) VALUES
    (v_stud1_id, v_drive_place_2025, 'SELECTED', '2025-02-02 12:00:00+00'),
    (v_stud1_id, v_drive_intern_2026, 'SELECTED', '2026-03-02 12:00:00+00'),
    (v_stud1_id, v_drive_place_2026, 'SELECTED', '2026-02-02 12:00:00+00');

  -- Student 2: SELECTED in Gensler 2026 INTERNSHIP, REJECTED in Foster 2026 PLACEMENT
  INSERT INTO public.applications (student_id, drive_id, status, applied_at) VALUES
    (v_stud2_id, v_drive_intern_2026, 'SELECTED', '2026-03-03 12:00:00+00'),
    (v_stud2_id, v_drive_place_2026, 'REJECTED', '2026-02-03 12:00:00+00');

  -- Student 3: WITHDRAWN from Foster 2026 PLACEMENT (Must be excluded from conversion denominator)
  INSERT INTO public.applications (student_id, drive_id, status, applied_at) VALUES
    (v_stud3_id, v_drive_place_2026, 'WITHDRAWN', '2026-02-04 12:00:00+00');
END $$;

-- ============================================================================
-- 2. Schema & Function Existence
-- ============================================================================

SELECT has_function('public', 'get_staff_drive_statistics', 'get_staff_drive_statistics function exists');
SELECT has_function('public', 'get_staff_conversion_statistics', 'get_staff_conversion_statistics function exists');
SELECT has_function('public', 'get_staff_companies_by_year', 'get_staff_companies_by_year function exists');
SELECT has_function('public', 'get_staff_repeat_recruiters', 'get_staff_repeat_recruiters function exists');
SELECT has_function('public', 'get_staff_internship_placement_conversion', 'get_staff_internship_placement_conversion function exists');
SELECT has_function('public', 'get_staff_export_data', 'get_staff_export_data function exists');
SELECT has_function('public', 'record_export_audit', 'record_export_audit function exists');

-- ============================================================================
-- 3. Super Admin Authority & Statistics Correctness
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Test A: Drives by Year
-- In 2025: 1 PLACEMENT, 0 INTERNSHIP, 1 Total
SELECT is(
  (SELECT placement_drives FROM public.get_staff_drive_statistics() WHERE "year" = 2025),
  1,
  '2025 has exactly 1 placement drive'
);
SELECT is(
  (SELECT internship_drives FROM public.get_staff_drive_statistics() WHERE "year" = 2025),
  0,
  '2025 has 0 internship drives'
);

-- In 2026: 1 PLACEMENT, 1 INTERNSHIP, 2 Total (DRAFT drive excluded)
SELECT is(
  (SELECT placement_drives FROM public.get_staff_drive_statistics() WHERE "year" = 2026),
  1,
  '2026 has exactly 1 published placement drive (draft excluded)'
);
SELECT is(
  (SELECT internship_drives FROM public.get_staff_drive_statistics() WHERE "year" = 2026),
  1,
  '2026 has exactly 1 internship drive'
);
SELECT is(
  (SELECT total_drives FROM public.get_staff_drive_statistics() WHERE "year" = 2026),
  2,
  '2026 total drives = 2 (draft excluded)'
);

-- Test B: Conversion Statistics & Withdrawn Handling
-- For Foster 2026: 3 applications (1 SELECTED, 1 REJECTED, 1 WITHDRAWN)
-- Denominator = applied - withdrawn = 3 - 1 = 2
-- Selected = 1
-- Conversion % = 1 / 2 * 100 = 50.00%
SELECT is(
  (SELECT total_applied FROM public.get_staff_conversion_statistics() WHERE drive_title = 'Foster 2026 Campus Drive'),
  2,
  'Foster 2026 total_applied excludes WITHDRAWN application (3 total - 1 withdrawn = 2)'
);
SELECT is(
  (SELECT total_selected FROM public.get_staff_conversion_statistics() WHERE drive_title = 'Foster 2026 Campus Drive'),
  1,
  'Foster 2026 total_selected = 1'
);
SELECT is(
  (SELECT conversion_pct FROM public.get_staff_conversion_statistics() WHERE drive_title = 'Foster 2026 Campus Drive')::NUMERIC,
  50.00::NUMERIC,
  'Foster 2026 conversion_pct = 50.00%'
);

-- Test C: Companies Recruiting by Year
-- In 2025: Foster had 1 selected student
SELECT is(
  (SELECT students_selected FROM public.get_staff_companies_by_year(2025) WHERE company_name LIKE 'Foster%'),
  1,
  'Foster has 1 student selected in 2025'
);
-- In 2026: Foster had 1 selected student
SELECT is(
  (SELECT students_selected FROM public.get_staff_companies_by_year(2026) WHERE company_name LIKE 'Foster%'),
  1,
  'Foster has 1 student selected in 2026'
);

-- Test D: Internship to Placement Conversion
-- Student 1 was SELECTED in Gensler 2026 (INTERNSHIP) and SELECTED in Foster 2025/2026 (PLACEMENT)
-- Student 2 was SELECTED in Gensler 2026 (INTERNSHIP) but REJECTED in PLACEMENT
-- Total internship selected = 2 (Student 1 and Student 2)
-- Converted to placement = 1 (Student 1)
-- Conversion rate = 1 / 2 * 100 = 50.00%
SELECT is(
  (SELECT total_internship_selected FROM public.get_staff_internship_placement_conversion()),
  2,
  'Total distinct students selected in internships = 2'
);
SELECT is(
  (SELECT converted_to_placement FROM public.get_staff_internship_placement_conversion()),
  1,
  'Distinct students converted from internship to placement = 1'
);
SELECT is(
  (SELECT conversion_rate_pct FROM public.get_staff_internship_placement_conversion())::NUMERIC,
  50.00::NUMERIC,
  'Internship-to-placement conversion rate = 50.00%'
);

-- Test E: Repeat Recruiters
-- Foster had CLOSED placement drive in 2025 and PUBLISHED in 2026 (CLOSED/ARCHIVED in 2025 only)
-- Let's close Foster 2026 so it qualifies for repeat recruiter (>1 distinct year in CLOSED/ARCHIVED)
SET LOCAL ROLE postgres;
UPDATE public.placement_drives
SET status = 'CLOSED', closed_at = now(), closed_by = '00000000-0000-0000-0000-000000000001'
WHERE id = '60000000-0000-0000-0000-000000000002';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is(
  (SELECT years_recruited FROM public.get_staff_repeat_recruiters() WHERE company_name LIKE 'Foster%'),
  2,
  'Foster identified as repeat recruiter across 2 distinct years'
);
SELECT is(
  (SELECT first_year FROM public.get_staff_repeat_recruiters() WHERE company_name LIKE 'Foster%'),
  2025,
  'Foster first recruiting year = 2025'
);
SELECT is(
  (SELECT latest_year FROM public.get_staff_repeat_recruiters() WHERE company_name LIKE 'Foster%'),
  2026,
  'Foster latest recruiting year = 2026'
);

-- ============================================================================
-- 4. Bounded Export Query & Field Privacy Check
-- ============================================================================

-- Export APPLICATIONS
SELECT ok(
  (SELECT (public.get_staff_export_data('APPLICATIONS')->>'row_count')::INTEGER >= 3),
  'get_staff_export_data returns application records'
);

-- Check that private fields (cgpa, backlogs, phone, resume path) are NOT in the export projection
SELECT is(
  (SELECT jsonb_path_exists(public.get_staff_export_data('APPLICATIONS')->'data', '$[*].cgpa')),
  false,
  'Applications export does NOT contain cgpa'
);
SELECT is(
  (SELECT jsonb_path_exists(public.get_staff_export_data('APPLICATIONS')->'data', '$[*].active_backlogs')),
  false,
  'Applications export does NOT contain active_backlogs'
);
SELECT is(
  (SELECT jsonb_path_exists(public.get_staff_export_data('APPLICATIONS')->'data', '$[*].phone')),
  false,
  'Applications export does NOT contain phone'
);
SELECT is(
  (SELECT jsonb_path_exists(public.get_staff_export_data('APPLICATIONS')->'data', '$[*].resume_path')),
  false,
  'Applications export does NOT contain resume_path'
);
SELECT is(
  (SELECT jsonb_path_exists(public.get_staff_export_data('APPLICATIONS')->'data', '$[*].application_id')),
  false,
  'Applications export does NOT contain application_id raw UUID'
);

-- Export DRIVE_RESULTS
SELECT is(
  (SELECT (public.get_staff_export_data('DRIVE_RESULTS')->>'export_type')),
  'DRIVE_RESULTS',
  'DRIVE_RESULTS export returns valid payload'
);

-- Export PLACEMENT_OUTCOMES
SELECT is(
  (SELECT (public.get_staff_export_data('PLACEMENT_OUTCOMES')->>'export_type')),
  'PLACEMENT_OUTCOMES',
  'PLACEMENT_OUTCOMES export returns valid payload'
);

-- Export INTERNSHIP_OUTCOMES
SELECT is(
  (SELECT (public.get_staff_export_data('INTERNSHIP_OUTCOMES')->>'export_type')),
  'INTERNSHIP_OUTCOMES',
  'INTERNSHIP_OUTCOMES export returns valid payload'
);

-- Export COMPANIES
SELECT is(
  (SELECT (public.get_staff_export_data('COMPANIES')->>'export_type')),
  'COMPANIES',
  'COMPANIES export returns valid payload'
);

-- Export ALUMNI_INDUSTRY
SELECT is(
  (SELECT (public.get_staff_export_data('ALUMNI_INDUSTRY')->>'export_type')),
  'ALUMNI_INDUSTRY',
  'ALUMNI_INDUSTRY export returns valid payload'
);

-- Invalid export type throws 22023
SELECT throws_ok(
  $$ SELECT public.get_staff_export_data('INVALID_TYPE') $$,
  '22023',
  NULL,
  'Invalid export type is rejected'
);

-- ============================================================================
-- 5. Export Audit Logging
-- ============================================================================

SELECT lives_ok(
  $$ SELECT public.record_export_audit('APPLICATIONS', '{"batch": "2026"}'::jsonb, 3) $$,
  'Super Admin records export audit event'
);

SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs WHERE action = 'DATA_EXPORT_REQUESTED'),
  1,
  'DATA_EXPORT_REQUESTED audit event recorded'
);

SELECT is(
  (SELECT (metadata->>'export_type') FROM public.audit_logs WHERE action = 'DATA_EXPORT_REQUESTED' LIMIT 1),
  'APPLICATIONS',
  'Audit metadata contains correct export_type'
);

SELECT is(
  (SELECT (metadata->>'row_count')::integer FROM public.audit_logs WHERE action = 'DATA_EXPORT_REQUESTED' LIMIT 1),
  3,
  'Audit metadata contains row_count'
);

-- Ensure full payload is NOT in audit metadata
SELECT is(
  (SELECT metadata ? 'data' FROM public.audit_logs WHERE action = 'DATA_EXPORT_REQUESTED' LIMIT 1),
  false,
  'Audit metadata does NOT contain raw exported payload'
);

-- ============================================================================
-- 6. Secretary Authority Verification
-- ============================================================================

SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000012';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000012", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT * FROM public.get_staff_drive_statistics() $$,
  'TNP Secretary can view drive statistics'
);
SELECT lives_ok(
  $$ SELECT * FROM public.get_staff_conversion_statistics() $$,
  'TNP Secretary can view conversion statistics'
);
SELECT lives_ok(
  $$ SELECT * FROM public.get_staff_repeat_recruiters() $$,
  'TNP Secretary can view repeat recruiters'
);
SELECT lives_ok(
  $$ SELECT * FROM public.get_staff_export_data('APPLICATIONS') $$,
  'TNP Secretary can export data'
);
SELECT lives_ok(
  $$ SELECT public.record_export_audit('COMPANIES', '{}'::jsonb, 2) $$,
  'TNP Secretary can record export audit'
);

-- ============================================================================
-- 7. Coordinator Denials (Strict No-Export / No-Stats Enforcement)
-- ============================================================================

SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000012';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000012", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_drive_statistics() $$,
  '42501',
  NULL,
  'Coordinator cannot view drive statistics'
);
SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_conversion_statistics() $$,
  '42501',
  NULL,
  'Coordinator cannot view conversion statistics'
);
SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_repeat_recruiters() $$,
  '42501',
  NULL,
  'Coordinator cannot view repeat recruiters'
);
SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_export_data('APPLICATIONS') $$,
  '42501',
  NULL,
  'Coordinator cannot export data'
);
SELECT throws_ok(
  $$ SELECT public.record_export_audit('APPLICATIONS', '{}'::jsonb, 1) $$,
  '42501',
  NULL,
  'Coordinator cannot record export audit'
);

-- ============================================================================
-- 8. Student & Recruiter Denials
-- ============================================================================

SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000021';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000021", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_drive_statistics() $$,
  '42501',
  NULL,
  'Student cannot view drive statistics'
);
SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_export_data('APPLICATIONS') $$,
  '42501',
  NULL,
  'Student cannot export data'
);

SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000012';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000012", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_drive_statistics() $$,
  '42501',
  NULL,
  'Recruiter cannot view drive statistics'
);
SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_export_data('APPLICATIONS') $$,
  '42501',
  NULL,
  'Recruiter cannot export data'
);

-- ============================================================================
-- 9. Inactive Staff Denials
-- ============================================================================

SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000099';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000099", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_drive_statistics() $$,
  '42501',
  NULL,
  'Inactive Secretary cannot view statistics'
);
SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_export_data('APPLICATIONS') $$,
  '42501',
  NULL,
  'Inactive Secretary cannot export data'
);

-- ============================================================================
-- 10. Anonymous Denials
-- ============================================================================

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '{"role": "anon"}';

SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_drive_statistics() $$,
  '42501',
  NULL,
  'Anonymous cannot view drive statistics'
);
SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_conversion_statistics() $$,
  '42501',
  NULL,
  'Anonymous cannot view conversion statistics'
);
SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_repeat_recruiters() $$,
  '42501',
  NULL,
  'Anonymous cannot view repeat recruiters'
);
SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_export_data('APPLICATIONS') $$,
  '42501',
  NULL,
  'Anonymous cannot export data'
);
SELECT throws_ok(
  $$ SELECT public.record_export_audit('APPLICATIONS', '{}'::jsonb, 0) $$,
  '42501',
  NULL,
  'Anonymous cannot record export audit'
);

SELECT * FROM finish();
ROLLBACK;
