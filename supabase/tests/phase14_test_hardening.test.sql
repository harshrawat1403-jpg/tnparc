-- Phase 14: Test Hardening pgTAP Test Suite
-- Covers:
-- 1. Negative pgTAP tests proving anon cannot access student PII from base tables (seeded records)
-- 2. Separation of public RPC projections from private base tables
-- 3. get_public_student_profile() privacy flag and null-field behavior
-- 4. Public profile lifecycle visibility matrix
-- 5. Alumni public consent and projection privacy
-- 6. Alumni company linkage mutual exclusivity constraint
-- 7. Privileged RPC and internal helper execution denials

BEGIN;

SELECT plan(68);

-- ============================================================================
-- 1. Fixtures Setup (running as superuser / postgres)
-- ============================================================================

DO $$
DECLARE
  v_btech_id UUID;
  v_admin_id UUID := '00000000-0000-0000-0000-000000000001';
  v_alice_id UUID := '80000000-0000-0000-0000-000000000001';
  v_bob_id   UUID := '80000000-0000-0000-0000-000000000002';
  v_carol_id UUID := '80000000-0000-0000-0000-000000000003';
  v_comp_id  UUID;
  v_drive_id UUID := '80000000-0000-0000-0000-000000000010';
  v_skill_id UUID;
  v_rec_id   UUID := '80000000-0000-0000-0000-000000000020';
  v_contact_id UUID;
  v_rec_profile_pk UUID;
BEGIN
  SELECT id INTO v_btech_id FROM public.academic_programs WHERE code = 'BARCH' LIMIT 1;

  -- 0. Auth Users
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (v_admin_id, 'authenticated', 'authenticated', 'admin14@vnit.test'),
    (v_alice_id, 'authenticated', 'authenticated', 'alice14@vnit.test'),
    (v_bob_id, 'authenticated', 'authenticated', 'bob14@vnit.test'),
    (v_carol_id, 'authenticated', 'authenticated', 'carol14@vnit.test'),
    (v_rec_id, 'authenticated', 'authenticated', 'recruiter14@vnit.test')
  ON CONFLICT (id) DO NOTHING;

  -- 1. Company
  INSERT INTO public.companies (name, normalized_name, created_by)
  VALUES ('Phase 14 Hardened Corp', 'phase 14 hardened corp', v_admin_id)
  RETURNING id INTO v_comp_id;

  -- 2. Recruiter Contact & Profile
  INSERT INTO public.profiles (id, role, display_name, is_active)
  VALUES (v_rec_id, 'RECRUITER', 'Recruiter Bob', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.recruiter_contacts (company_id, full_name, email, is_active, created_by)
  VALUES (v_comp_id, 'Recruiter Contact', 'recruiter14@example.com', true, v_admin_id)
  RETURNING id INTO v_contact_id;

  INSERT INTO public.recruiter_invitations (recruiter_contact_id, invited_by, status, expires_at)
  VALUES (v_contact_id, v_admin_id, 'PENDING', now() + interval '7 days');

  INSERT INTO public.recruiter_profiles (profile_id, company_id, recruiter_contact_id)
  VALUES (v_rec_id, v_comp_id, v_contact_id)
  RETURNING id INTO v_rec_profile_pk;

  -- 3. Placement Drive
  INSERT INTO public.placement_drives (
    id, company_id, title, drive_type, status, application_deadline, created_by, published_by, published_at
  ) VALUES (
    v_drive_id, v_comp_id, 'Phase 14 Placement Drive', 'PLACEMENT', 'DRAFT', now() + interval '30 days', v_admin_id, NULL, NULL
  ) ON CONFLICT (id) DO NOTHING;

  UPDATE public.placement_drives
  SET status = 'PUBLISHED', published_by = v_admin_id, published_at = now()
  WHERE id = v_drive_id;

  INSERT INTO public.recruiter_drive_access (recruiter_profile_id, drive_id, granted_by)
  VALUES (v_rec_profile_pk, v_drive_id, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- 4. Alice (Active Student with public profile and verified academic record)
  INSERT INTO public.profiles (id, role, display_name, is_active, student_lifecycle_status)
  VALUES (v_alice_id, 'STUDENT', 'Alice Hardened', true, 'STUDENT_ACTIVE')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.student_roster (program_id, batch, institutional_id, full_name, institutional_email, is_active, claimed_by)
  VALUES (v_btech_id, '2026', 'P14-001', 'Alice Hardened', 'alice.p14@inst.edu', true, v_alice_id)
  ON CONFLICT (institutional_email) DO UPDATE SET claimed_by = v_alice_id;

  INSERT INTO public.academic_records (
    profile_id, program_id, batch, cgpa, active_backlogs, verification_status, verified_by, verified_at
  ) VALUES (
    v_alice_id, v_btech_id, '2026', 9.45, 0, 'VERIFIED', v_admin_id, now()
  ) ON CONFLICT (profile_id) DO NOTHING;

  INSERT INTO public.student_profiles (
    profile_id, public_profile_slug, public_profile_enabled, public_portfolio_enabled,
    public_resume_enabled, public_headline, public_tagline, portfolio_url, linkedin_url,
    profile_photo_path, phone
  ) VALUES (
    v_alice_id, 'alice-hardened', true, true,
    true, 'Software Engineer in Training', 'Building robust systems', 'https://alice.portfolio.dev',
    'https://linkedin.com/in/alice-hardened', v_alice_id || '/avatar.png', '+919876543210'
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- 5. Alice Skill & Evidence
  INSERT INTO public.skills (name, category, is_active, created_by)
  VALUES ('Hardened Verification', 'TECHNICAL', true, v_admin_id)
  RETURNING id INTO v_skill_id;

  INSERT INTO public.student_skills (student_id, skill_id, proficiency_level, verification_status, verified_by, verified_at, is_active)
  VALUES (v_alice_id, v_skill_id, 3, 'VERIFIED', v_admin_id, now(), true);

  -- 6. Alice Document & Application
  INSERT INTO public.documents (owner_id, document_type, storage_path, file_name, mime_type, file_size_bytes)
  VALUES (v_alice_id, 'RESUME', v_alice_id || '/resume.pdf', 'resume.pdf', 'application/pdf', 10240);

  INSERT INTO public.applications (student_id, drive_id, status)
  VALUES (v_alice_id, v_drive_id, 'APPLIED');

  -- 7. Bob (Alumni with consent)
  INSERT INTO public.profiles (id, role, display_name, is_active, student_lifecycle_status)
  VALUES (v_bob_id, 'STUDENT', 'Bob Hardened Alumni', true, 'ALUMNI')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.alumni_profiles (
    profile_id, program_id, graduation_year, public_alumni_enabled, consent_recorded_at,
    company_id, current_organization, "current_role", professional_domain, city, country
  ) VALUES (
    v_bob_id, v_btech_id, 2024, true, now(),
    v_comp_id, NULL, 'Senior SRE', 'Cloud Infrastructure', 'Pune', 'India'
  ) ON CONFLICT (profile_id) DO NOTHING;

  INSERT INTO public.alumni_employment_history (
    alumni_id, company_id, organization, role, started_at
  ) VALUES (
    (SELECT id FROM public.alumni_profiles WHERE profile_id = v_bob_id),
    v_comp_id, 'Phase 14 Hardened Corp', 'Site Reliability Engineer', '2024-07-01'
  );

  -- 8. Carol (Student with portfolio disabled and unverified record)
  INSERT INTO public.profiles (id, role, display_name, is_active, student_lifecycle_status)
  VALUES (v_carol_id, 'STUDENT', 'Carol Private', true, 'STUDENT_ACTIVE')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.academic_records (
    profile_id, program_id, batch, cgpa, active_backlogs, verification_status
  ) VALUES (
    v_carol_id, v_btech_id, '2026', 8.50, 0, 'UNVERIFIED'
  ) ON CONFLICT (profile_id) DO NOTHING;

  INSERT INTO public.student_profiles (
    profile_id, public_profile_slug, public_profile_enabled, public_portfolio_enabled,
    public_resume_enabled, portfolio_url
  ) VALUES (
    v_carol_id, 'carol-private', false, false, false, 'https://carol.portfolio.dev'
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- 9. Audit Log Entry
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_admin_id, 'TEST_AUDIT_ENTRY', 'profiles', v_alice_id, '{"note": "Controlled test entry"}'::jsonb);
END;
$$;

-- ============================================================================
-- 2. Verify Controlled Test Data Actually Exists Before Anon Checks
-- ============================================================================

SELECT isnt_empty(
  'SELECT * FROM public.profiles WHERE id = ''80000000-0000-0000-0000-000000000001''',
  'Seed data exists in profiles'
);

SELECT isnt_empty(
  'SELECT * FROM public.student_roster WHERE institutional_id = ''P14-001''',
  'Seed data exists in student_roster'
);

SELECT isnt_empty(
  'SELECT * FROM public.student_profiles WHERE public_profile_slug = ''alice-hardened''',
  'Seed data exists in student_profiles'
);

SELECT isnt_empty(
  'SELECT * FROM public.academic_records WHERE profile_id = ''80000000-0000-0000-0000-000000000001''',
  'Seed data exists in academic_records'
);

SELECT isnt_empty(
  'SELECT * FROM public.student_skills WHERE student_id = ''80000000-0000-0000-0000-000000000001''',
  'Seed data exists in student_skills'
);

SELECT isnt_empty(
  'SELECT * FROM public.documents WHERE owner_id = ''80000000-0000-0000-0000-000000000001''',
  'Seed data exists in documents'
);

SELECT isnt_empty(
  'SELECT * FROM public.applications WHERE student_id = ''80000000-0000-0000-0000-000000000001''',
  'Seed data exists in applications'
);

SELECT isnt_empty(
  'SELECT * FROM public.alumni_profiles WHERE profile_id = ''80000000-0000-0000-0000-000000000002''',
  'Seed data exists in alumni_profiles'
);

SELECT isnt_empty(
  'SELECT * FROM public.alumni_employment_history',
  'Seed data exists in alumni_employment_history'
);

SELECT isnt_empty(
  'SELECT * FROM public.recruiter_contacts WHERE email = ''recruiter14@example.com''',
  'Seed data exists in recruiter_contacts'
);

SELECT isnt_empty(
  'SELECT * FROM public.recruiter_invitations',
  'Seed data exists in recruiter_invitations'
);

SELECT isnt_empty(
  'SELECT * FROM public.recruiter_drive_access WHERE drive_id = ''80000000-0000-0000-0000-000000000010''',
  'Seed data exists in recruiter_drive_access'
);

SELECT isnt_empty(
  'SELECT * FROM public.audit_logs WHERE action = ''TEST_AUDIT_ENTRY''',
  'Seed data exists in audit_logs'
);

-- ============================================================================
-- 3. Switch to Anonymous Role: Broad SELECT Tests (RLS / Revocation Gates)
-- ============================================================================

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '{}';

SELECT is_empty(
  'SELECT * FROM public.profiles',
  'Anon cannot read public.profiles (0 rows returned)'
);

SELECT is_empty(
  'SELECT * FROM public.student_roster',
  'Anon cannot read public.student_roster (0 rows returned)'
);

SELECT is_empty(
  'SELECT * FROM public.student_profiles',
  'Anon cannot read public.student_profiles (0 rows returned)'
);

SELECT is_empty(
  'SELECT * FROM public.academic_records',
  'Anon cannot read public.academic_records (0 rows returned)'
);

SELECT is_empty(
  'SELECT * FROM public.documents',
  'Anon cannot read public.documents (0 rows returned)'
);

SELECT is_empty(
  'SELECT * FROM public.applications',
  'Anon cannot read public.applications (0 rows returned)'
);

SELECT is_empty(
  'SELECT * FROM public.application_status_history',
  'Anon cannot read public.application_status_history (0 rows returned)'
);

SELECT is_empty(
  'SELECT * FROM public.student_skills',
  'Anon cannot read public.student_skills (0 rows returned)'
);

SELECT is_empty(
  'SELECT * FROM public.student_skill_evidence',
  'Anon cannot read public.student_skill_evidence (0 rows returned)'
);

SELECT is_empty(
  'SELECT * FROM public.alumni_profiles',
  'Anon cannot read public.alumni_profiles (0 rows returned)'
);

SELECT is_empty(
  'SELECT * FROM public.alumni_employment_history',
  'Anon cannot read public.alumni_employment_history (0 rows returned)'
);

SELECT throws_ok(
  $$ SELECT * FROM public.audit_logs $$,
  '42501',
  NULL,
  'Anon cannot read public.audit_logs (permission denied 42501)'
);

SELECT throws_ok(
  $$ SELECT * FROM public.recruiter_contacts $$,
  '42501',
  NULL,
  'Anon cannot read public.recruiter_contacts (permission denied 42501)'
);

SELECT throws_ok(
  $$ SELECT * FROM public.recruiter_invitations $$,
  '42501',
  NULL,
  'Anon cannot read public.recruiter_invitations (permission denied 42501)'
);

SELECT throws_ok(
  $$ SELECT * FROM public.recruiter_drive_access $$,
  '42501',
  NULL,
  'Anon cannot read public.recruiter_drive_access (permission denied 42501)'
);

-- ============================================================================
-- 4. Anonymous Targeted Guessed UUID SELECT Tests
-- ============================================================================

SELECT is_empty(
  'SELECT * FROM public.profiles WHERE id = ''80000000-0000-0000-0000-000000000001''',
  'Anon guessed UUID SELECT on profiles returns 0 rows'
);

SELECT is_empty(
  'SELECT * FROM public.student_profiles WHERE profile_id = ''80000000-0000-0000-0000-000000000001''',
  'Anon guessed UUID SELECT on student_profiles returns 0 rows'
);

SELECT is_empty(
  'SELECT * FROM public.academic_records WHERE profile_id = ''80000000-0000-0000-0000-000000000001''',
  'Anon guessed UUID SELECT on academic_records returns 0 rows'
);

SELECT is_empty(
  'SELECT * FROM public.applications WHERE student_id = ''80000000-0000-0000-0000-000000000001''',
  'Anon guessed UUID SELECT on applications returns 0 rows'
);

SELECT is_empty(
  'SELECT * FROM public.alumni_profiles WHERE profile_id = ''80000000-0000-0000-0000-000000000002''',
  'Anon guessed UUID SELECT on alumni_profiles returns 0 rows'
);

-- ============================================================================
-- 5. Anonymous Mutation Negative Tests
-- ============================================================================

SELECT throws_ok(
  $$ INSERT INTO public.profiles (id, role, display_name) VALUES ('80000000-0000-0000-0000-000000000099', 'STUDENT', 'Hacker') $$,
  '42501',
  NULL,
  'Anon cannot INSERT into profiles'
);

SELECT throws_ok(
  $$ INSERT INTO public.student_profiles (profile_id, public_profile_slug) VALUES ('80000000-0000-0000-0000-000000000001', 'hacked-slug') $$,
  '42501',
  NULL,
  'Anon cannot INSERT into student_profiles'
);

SELECT throws_ok(
  $$ INSERT INTO public.academic_records (profile_id, program_id, batch, cgpa, active_backlogs)
     VALUES ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '2026', 10.0, 0) $$,
  '42501',
  NULL,
  'Anon cannot INSERT into academic_records'
);

SELECT throws_ok(
  $$ INSERT INTO public.applications (student_id, drive_id, status) VALUES ('80000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000010', 'APPLIED') $$,
  '42501',
  NULL,
  'Anon cannot INSERT into applications'
);

SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (action) VALUES ('ANON_MUTATION') $$,
  '42501',
  NULL,
  'Anon cannot INSERT into audit_logs'
);

SELECT throws_ok(
  $$ INSERT INTO public.alumni_profiles (profile_id, program_id, graduation_year) VALUES ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 2026) $$,
  '42501',
  NULL,
  'Anon cannot INSERT into alumni_profiles'
);

-- ============================================================================
-- 6. Separation: Safe Public RPC Projections vs Inaccessible Base Tables
-- ============================================================================

-- Anon CAN execute public profile RPC for eligible student
SELECT isnt_empty(
  'SELECT * FROM public.get_public_student_profile(''alice-hardened'')',
  'Anon can execute get_public_student_profile for eligible student'
);

-- But base student_profiles remains completely inaccessible to anon
SELECT is_empty(
  'SELECT * FROM public.student_profiles WHERE public_profile_slug = ''alice-hardened''',
  'Base student_profiles remains inaccessible to anon even when public RPC resolves'
);

-- Anon CAN execute public alumni directory RPC for eligible consented alumni
SELECT isnt_empty(
  'SELECT * FROM public.get_public_alumni_directory(2024)',
  'Anon can execute get_public_alumni_directory for consented alumni'
);

-- But base alumni_profiles remains completely inaccessible to anon
SELECT is_empty(
  'SELECT * FROM public.alumni_profiles WHERE graduation_year = 2024',
  'Base alumni_profiles remains inaccessible to anon even when alumni directory resolves'
);

-- ============================================================================
-- 7. get_public_student_profile() Privacy Flags & Null-Field Behavior
-- ============================================================================

-- Portfolio available & URL projection
SELECT results_eq(
  'SELECT portfolio_available, portfolio_url FROM public.get_public_student_profile(''alice-hardened'')',
  $$ VALUES (true, 'https://alice.portfolio.dev') $$,
  'Eligible student with public portfolio enabled returns portfolio_available=true and valid URL'
);

-- Headline, Tagline, Photo and Resume Availability Indicators
SELECT results_eq(
  'SELECT headline, tagline, has_photo, resume_available FROM public.get_public_student_profile(''alice-hardened'')',
  $$ VALUES ('Software Engineer in Training'::text, 'Building robust systems'::text, true, true) $$,
  'Public profile projects approved indicators and text fields'
);

-- Verified skills projection (contains name and category, omits proficiency and evidence)
SELECT is(
  (SELECT verified_skills->0->>'name' FROM public.get_public_student_profile('alice-hardened')),
  'Hardened Verification',
  'Verified skill name is exposed'
);

SELECT is(
  (SELECT verified_skills->0->>'category' FROM public.get_public_student_profile('alice-hardened')),
  'TECHNICAL',
  'Verified skill category is exposed'
);

SELECT is(
  (SELECT verified_skills->0->'proficiency' FROM public.get_public_student_profile('alice-hardened')),
  NULL,
  'Skill proficiency is not exposed in public profile'
);

SELECT is(
  (SELECT verified_skills->0->'evidence' FROM public.get_public_student_profile('alice-hardened')),
  NULL,
  'Skill evidence is not exposed in public profile'
);

-- ============================================================================
-- 8. Public Profile Lifecycle & Privacy Visibility Matrix
-- ============================================================================

-- A. Disabled public profile returns 0 rows
SELECT is_empty(
  'SELECT * FROM public.get_public_student_profile(''carol-private'')',
  'Disabled public profile returns 0 rows (404 boundary)'
);

-- B. Nonexistent slug returns 0 rows
SELECT is_empty(
  'SELECT * FROM public.get_public_student_profile(''nonexistent-slug-xyz'')',
  'Nonexistent slug returns 0 rows'
);

-- C. Invalid slug characters return 0 rows
SELECT is_empty(
  'SELECT * FROM public.get_public_student_profile(''INVALID_UPPERCASE'')',
  'Invalid uppercase slug returns 0 rows'
);

-- D. Slug with special characters returns 0 rows
SELECT is_empty(
  'SELECT * FROM public.get_public_student_profile(''slug;drop table'')',
  'Malformed injection slug returns 0 rows'
);

-- ============================================================================
-- 9. Alumni Public Consent & Projection Privacy
-- ============================================================================

-- Bob is returned in alumni directory
SELECT results_eq(
  'SELECT name, graduation_year, professional_domain, current_employer, designation FROM public.get_public_alumni_directory(2024)',
  $$ VALUES ('Bob Hardened Alumni'::text, 2024, 'Cloud Infrastructure'::text, 'Phase 14 Hardened Corp'::text, 'Senior SRE'::text) $$,
  'Consented alumni profile returns only approved public fields'
);

-- Switch back to postgres for constraint tests
RESET ROLE;

-- Alumni without consent is NOT returned in public directory
DO $$
DECLARE
  v_dave_id UUID := '80000000-0000-0000-0000-000000000004';
  v_btech_id UUID;
BEGIN
  SELECT id INTO v_btech_id FROM public.academic_programs WHERE code = 'BARCH' LIMIT 1;

  INSERT INTO auth.users (id, aud, role, email)
  VALUES (v_dave_id, 'authenticated', 'authenticated', 'dave14@vnit.test')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, role, display_name, is_active, student_lifecycle_status)
  VALUES (v_dave_id, 'STUDENT', 'Dave No Consent', true, 'ALUMNI')
  ON CONFLICT (id) DO NOTHING;

  -- Notice consent_recorded_at is NULL, so public_alumni_enabled must be false due to chk_consent_for_public
  INSERT INTO public.alumni_profiles (
    profile_id, program_id, graduation_year, public_alumni_enabled, consent_recorded_at, current_organization
  ) VALUES (
    v_dave_id, v_btech_id, 2024, false, NULL, 'Unconsented Org'
  ) ON CONFLICT (profile_id) DO NOTHING;
END;
$$;

SELECT is_empty(
  'SELECT * FROM public.get_public_alumni_directory(2024, NULL, ''Dave No Consent'')',
  'Alumni with public_alumni_enabled=false is hidden from public directory'
);

-- Attempting to set public_alumni_enabled = true with consent_recorded_at NULL violates chk_consent_for_public
SELECT throws_ok(
  $$ INSERT INTO public.alumni_profiles (profile_id, program_id, graduation_year, public_alumni_enabled, consent_recorded_at)
     VALUES ('80000000-0000-0000-0000-000000000001', (SELECT id FROM academic_programs LIMIT 1), 2024, true, NULL) $$,
  '23514',
  NULL,
  'Enabling public alumni without consent timestamp violates chk_consent_for_public (23514)'
);

-- Attempting to set BOTH company_id AND current_organization violates chk_company_or_org
SELECT throws_ok(
  $$ UPDATE public.alumni_profiles SET current_organization = 'Conflict Org' WHERE profile_id = '80000000-0000-0000-0000-000000000002' $$,
  '23514',
  NULL,
  'Setting both company_id and current_organization violates chk_company_or_org (23514)'
);

-- Alumni employment history invalid date range (ended_at < started_at) violates chk_employment_dates
SELECT throws_ok(
  $$ INSERT INTO public.alumni_employment_history (alumni_id, organization, role, started_at, ended_at)
     VALUES ((SELECT id FROM alumni_profiles LIMIT 1), 'Bad Corp', 'Dev', '2025-01-01', '2024-01-01') $$,
  '23514',
  NULL,
  'Employment with ended_at before started_at violates chk_employment_dates (23514)'
);

-- ============================================================================
-- 10. Security Definer & Internal Helper Access Denials
-- ============================================================================

-- Anon cannot call internal helper _is_student_publicly_eligible directly
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public._is_student_publicly_eligible('80000000-0000-0000-0000-000000000001'::UUID) $$,
  '42501',
  NULL,
  'Anon cannot execute internal helper _is_student_publicly_eligible'
);

-- Anon cannot call internal helper _get_public_avatar_storage_path directly
SELECT throws_ok(
  $$ SELECT public._get_public_avatar_storage_path('alice-hardened') $$,
  '42501',
  NULL,
  'Anon cannot execute internal helper _get_public_avatar_storage_path'
);

-- Anon cannot execute privileged RPC correct_published_drive
SELECT throws_ok(
  $$ SELECT public.correct_published_drive('80000000-0000-0000-0000-000000000010'::UUID, 'Reason long enough', 'New Title') $$,
  '42501',
  NULL,
  'Anon cannot execute correct_published_drive'
);

-- Anon cannot execute privileged RPC record_export_audit
SELECT throws_ok(
  $$ SELECT public.record_export_audit('STUDENTS', '{}'::jsonb, 10) $$,
  '42501',
  NULL,
  'Anon cannot execute record_export_audit'
);

-- Anon cannot execute privileged RPC close_placement_drive
SELECT throws_ok(
  $$ SELECT public.close_placement_drive('80000000-0000-0000-0000-000000000010'::UUID) $$,
  'P0001',
  NULL,
  'Anon cannot execute close_placement_drive'
);

-- Anon cannot execute privileged RPC mark_student_graduated
SELECT throws_ok(
  $$ SELECT public.mark_student_graduated('80000000-0000-0000-0000-000000000001'::UUID, 'Graduation reason here') $$,
  '42501',
  NULL,
  'Anon cannot execute mark_student_graduated'
);

-- Student cannot execute correct_published_drive
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '80000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "80000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT public.correct_published_drive('80000000-0000-0000-0000-000000000010'::UUID, 'Reason long enough', 'New Title') $$,
  '42501',
  NULL,
  'Student cannot execute correct_published_drive'
);

-- Student cannot execute record_export_audit
SELECT throws_ok(
  $$ SELECT public.record_export_audit('STUDENTS', '{}'::jsonb, 10) $$,
  '42501',
  NULL,
  'Student cannot execute record_export_audit'
);

-- Student cannot execute mark_student_graduated
SELECT throws_ok(
  $$ SELECT public.mark_student_graduated('80000000-0000-0000-0000-000000000001'::UUID, 'Graduation reason here') $$,
  '42501',
  NULL,
  'Student cannot execute mark_student_graduated'
);

-- Coordinator cannot execute correct_published_drive
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT public.correct_published_drive('80000000-0000-0000-0000-000000000010'::UUID, 'Reason long enough', 'New Title') $$,
  '42501',
  NULL,
  'Coordinator cannot execute correct_published_drive'
);

SELECT * FROM finish();
ROLLBACK;
