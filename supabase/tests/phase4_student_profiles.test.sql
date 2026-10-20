BEGIN;
SELECT plan(73);

-- ============================================================================
-- Phase 4 Student Profiles, Completeness, Resumes & Academic Verification Tests
-- ============================================================================

-- Fixtures Setup
DO $$
DECLARE
  v_admin_id     UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_sec_id       UUID := '20000000-0000-0000-0000-000000000001'::UUID;
  v_coord_id     UUID := '30000000-0000-0000-0000-000000000001'::UUID;
  v_stud_a_id    UUID := '40000000-0000-0000-0000-000000000001'::UUID;
  v_stud_b_id    UUID := '40000000-0000-0000-0000-000000000002'::UUID;
  v_stud_c_id    UUID := '40000000-0000-0000-0000-000000000003'::UUID;
  v_recruiter_id UUID := '50000000-0000-0000-0000-000000000001'::UUID;
  v_barch_id     UUID;
  v_mplan_id     UUID;
BEGIN
  SELECT id INTO v_barch_id FROM academic_programs WHERE code = 'BARCH';
  SELECT id INTO v_mplan_id FROM academic_programs WHERE code = 'MPLAN';

  -- Create synthetic auth users if not present
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (v_admin_id, 'authenticated', 'authenticated', 'admin@vnit.test'),
    (v_sec_id, 'authenticated', 'authenticated', 'sec@vnit.test'),
    (v_coord_id, 'authenticated', 'authenticated', 'coord@vnit.test'),
    (v_stud_a_id, 'authenticated', 'authenticated', 'student_a@vnit.test'),
    (v_stud_b_id, 'authenticated', 'authenticated', 'student_b@vnit.test'),
    (v_stud_c_id, 'authenticated', 'authenticated', 'student_c@vnit.test'),
    (v_recruiter_id, 'authenticated', 'authenticated', 'recruiter@company.test')
  ON CONFLICT (id) DO NOTHING;

  -- Create Profiles
  INSERT INTO profiles (id, role, display_name, is_active, coordinator_slot, student_lifecycle_status) VALUES
    (v_admin_id, 'SUPER_ADMIN', 'Super Admin', true, NULL, NULL),
    (v_sec_id, 'TNP_SECRETARY', 'Secretary Jane', true, NULL, NULL),
    (v_coord_id, 'TNP_COORDINATOR', 'Coordinator Bob', true, 'SLOT_1', NULL),
    (v_stud_a_id, 'STUDENT', 'Student Alice', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud_b_id, 'STUDENT', 'Student Bob', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud_c_id, 'STUDENT', 'Student Charlie', true, NULL, 'STUDENT_ACTIVE'),
    (v_recruiter_id, 'RECRUITER', 'Recruiter Dave', true, NULL, NULL)
  ON CONFLICT (id) DO NOTHING;

  -- Create Student Profiles
  INSERT INTO student_profiles (profile_id, profile_completeness) VALUES
    (v_stud_a_id, 20),
    (v_stud_b_id, 20),
    (v_stud_c_id, 20)
  ON CONFLICT (profile_id) DO NOTHING;

  -- Create Academic Records
  INSERT INTO academic_records (profile_id, program_id, batch, cgpa, active_backlogs, verification_status) VALUES
    (v_stud_a_id, v_barch_id, '2026', 8.50, 0, 'UNVERIFIED'),
    (v_stud_b_id, v_barch_id, '2026', 7.80, 1, 'UNVERIFIED'),
    (v_stud_c_id, v_mplan_id, '2027', 9.10, 0, 'UNVERIFIED')
  ON CONFLICT (profile_id) DO NOTHING;

  -- Assign coordinator scope for Coordinator Bob ONLY to BARCH 2026
  INSERT INTO coordinator_student_scopes (coordinator_id, program_id, batch, granted_by) VALUES
    (v_coord_id, v_barch_id, '2026', v_admin_id)
  ON CONFLICT (coordinator_id, program_id, batch) DO NOTHING;

  -- Insert synthetic storage objects for storage RLS verification
  INSERT INTO storage.objects (id, bucket_id, name, owner_id) VALUES
    ('a0000000-0000-0000-0000-000000000001'::UUID, 'resumes', '40000000-0000-0000-0000-000000000001/orphan_resume.pdf', v_stud_a_id::text),
    ('a0000000-0000-0000-0000-000000000002'::UUID, 'resumes', '40000000-0000-0000-0000-000000000001/resume1.pdf', v_stud_a_id::text),
    ('b0000000-0000-0000-0000-000000000001'::UUID, 'resumes', '40000000-0000-0000-0000-000000000003/resume.pdf', v_stud_c_id::text),
    ('c0000000-0000-0000-0000-000000000001'::UUID, 'profile-photos', '40000000-0000-0000-0000-000000000001/photo.jpg', v_stud_a_id::text),
    ('c0000000-0000-0000-0000-000000000002'::UUID, 'profile-photos', '40000000-0000-0000-0000-000000000001/orphan_photo.jpg', v_stud_a_id::text),
    ('d0000000-0000-0000-0000-000000000001'::UUID, 'profile-photos', '40000000-0000-0000-0000-000000000003/photo.jpg', v_stud_c_id::text)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ============================================================================
-- 1. Deterministic Completeness Calculation
-- ============================================================================

-- Base score with only profile + academic_record is 20
SELECT results_eq(
  $$ SELECT calculate_student_profile_completeness('40000000-0000-0000-0000-000000000001'::UUID) $$,
  ARRAY[20],
  'Base profile with academic record has completeness 20%'
);

-- ============================================================================
-- 2. Student Profile Narrow Mutation Procedure (Alice Context)
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Valid update succeeds and recalculates completeness
SELECT lives_ok(
  $$ SELECT update_own_student_profile(
       p_bio => 'Passionate about sustainable architecture.',
       p_public_headline => 'Architectural Designer & Planner',
       p_public_tagline => 'Designing resilient urban futures',
       p_phone => '+91 98765 43210',
       p_linkedin_url => 'https://linkedin.com/in/alice-arch',
       p_portfolio_url => 'https://alice.design'
     ) $$,
  'Student Alice can update permitted profile fields'
);

-- Verify completeness updated (20 base + 15 phone + 15 bio/headline + 15 linkedin + 10 portfolio = 75)
SELECT results_eq(
  $$ SELECT profile_completeness FROM student_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000001' $$,
  ARRAY[75],
  'Profile completeness reflects updated contact, bio, and portfolio links (75%)'
);

-- Verify Phase 9 showcase fields remain strictly dormant (false / null)
SELECT results_eq(
  $$ SELECT public_profile_enabled, public_resume_enabled, public_portfolio_enabled, public_profile_slug
     FROM student_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000001' $$,
  $$ VALUES (false, false, false, NULL::text) $$,
  'Public showcase activation and slug fields remain strictly dormant (false/null) after profile update'
);

-- Invalid phone number format fails
SELECT throws_ok(
  $$ SELECT update_own_student_profile(p_phone => 'bad_phone') $$,
  'P0001',
  'Invalid phone number format',
  'Invalid phone number format throws error'
);

-- Invalid LinkedIn URL format fails
SELECT throws_ok(
  $$ SELECT update_own_student_profile(p_linkedin_url => 'not-a-valid-url') $$,
  'P0001',
  'LinkedIn URL must begin with http:// or https:// and reference linkedin.com',
  'Invalid LinkedIn URL protocol throws error'
);

-- Invalid Portfolio URL format fails
SELECT throws_ok(
  $$ SELECT update_own_student_profile(p_portfolio_url => 'ftp://invalid-proto') $$,
  'P0001',
  'Portfolio URL must begin with http:// or https://',
  'Invalid portfolio URL protocol throws error'
);

-- ============================================================================
-- 3. Photo Update Procedure
-- ============================================================================

-- Valid photo path within student directory succeeds
SELECT lives_ok(
  $$ SELECT update_own_profile_photo('40000000-0000-0000-0000-000000000001/photo.jpg') $$,
  'Student Alice can update profile photo path in own folder'
);

-- Completeness increases by 10% (75 + 10 = 85%)
SELECT results_eq(
  $$ SELECT profile_completeness FROM student_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000001' $$,
  ARRAY[85],
  'Profile completeness increases with photo uploaded (85%)'
);

-- Invalid photo path outside student folder is strictly rejected
SELECT throws_ok(
  $$ SELECT update_own_profile_photo('40000000-0000-0000-0000-000000000002/photo.jpg') $$,
  'P0001',
  'Invalid storage path: photo path must reside in student folder',
  'Photo path outside student folder is rejected'
);

-- Root photo path is rejected
SELECT throws_ok(
  $$ SELECT update_own_profile_photo('malicious.jpg') $$,
  'P0001',
  'Invalid storage path: photo path must reside in student folder',
  'Root photo path without folder is rejected'
);

-- ============================================================================
-- 4. Transactional Resume Registration & Uniqueness (Alice Context)
-- ============================================================================

-- Register Resume 1
SELECT lives_ok(
  $$ SELECT register_student_resume(
       p_storage_path => '40000000-0000-0000-0000-000000000001/resume1.pdf',
       p_file_name => 'Alice_Resume_v1.pdf',
       p_file_size_bytes => 1048576,
       p_mime_type => 'application/pdf'
     ) $$,
  'Student Alice can register initial resume'
);

-- Verify Resume 1 is current and completeness is 100% (85 + 15 = 100%)
SELECT results_eq(
  $$ SELECT count(*)::integer FROM documents WHERE owner_id = '40000000-0000-0000-0000-000000000001' AND is_current = true $$,
  ARRAY[1],
  'Exactly one current resume exists'
);

SELECT results_eq(
  $$ SELECT profile_completeness FROM student_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000001' $$,
  ARRAY[100],
  'Completeness reaches 100% with all sections completed'
);

-- Register Resume 2 (Atomically supersedes Resume 1)
SELECT lives_ok(
  $$ SELECT register_student_resume(
       p_storage_path => '40000000-0000-0000-0000-000000000001/resume2.pdf',
       p_file_name => 'Alice_Resume_v2.pdf',
       p_file_size_bytes => 1250000,
       p_mime_type => 'application/pdf'
     ) $$,
  'Student Alice can register replacement resume'
);

-- Exactly one current resume remains
SELECT results_eq(
  $$ SELECT count(*)::integer FROM documents WHERE owner_id = '40000000-0000-0000-0000-000000000001' AND is_current = true $$,
  ARRAY[1],
  'Superseding resume keeps exactly one current resume'
);

-- Resume 1 is now archived (is_current = false)
SELECT results_eq(
  $$ SELECT is_current FROM documents WHERE storage_path = '40000000-0000-0000-0000-000000000001/resume1.pdf' $$,
  ARRAY[false],
  'Prior resume is atomically marked is_current = false'
);

-- Resume 2 is current
SELECT results_eq(
  $$ SELECT is_current FROM documents WHERE storage_path = '40000000-0000-0000-0000-000000000001/resume2.pdf' $$,
  ARRAY[true],
  'New resume is current'
);

-- Invalid MIME type is rejected
SELECT throws_ok(
  $$ SELECT register_student_resume(
       p_storage_path => '40000000-0000-0000-0000-000000000001/resume.png',
       p_file_name => 'Resume.png',
       p_file_size_bytes => 50000,
       p_mime_type => 'image/png'
     ) $$,
  'P0001',
  'Invalid storage path: resume must reside in student folder and end with .pdf',
  'Resume path without .pdf extension is rejected'
);

-- File size exceeding 5 MB is rejected
SELECT throws_ok(
  $$ SELECT register_student_resume(
       p_storage_path => '40000000-0000-0000-0000-000000000001/huge.pdf',
       p_file_name => 'Huge.pdf',
       p_file_size_bytes => 6000000,
       p_mime_type => 'application/pdf'
     ) $$,
  'P0001',
  'File size must be positive and not exceed 5 MB (5,242,880 bytes)',
  'Resume file size exceeding 5 MB is rejected'
);

-- ============================================================================
-- 5. Documents Table RLS Policies
-- ============================================================================

-- Alice can select own documents
SELECT results_eq(
  $$ SELECT count(*)::integer FROM documents WHERE owner_id = '40000000-0000-0000-0000-000000000001' $$,
  ARRAY[2],
  'Student Alice can select own document records'
);

-- Alice cannot select Bob's documents
SELECT is_empty(
  $$ SELECT * FROM documents WHERE owner_id = '40000000-0000-0000-0000-000000000002' $$,
  'Student Alice cannot select Student Bob document records'
);

-- Alice direct INSERT on documents table is denied (REVOKED)
SELECT throws_ok(
  $$ INSERT INTO documents (owner_id, document_type, storage_path, file_name, file_size_bytes, mime_type)
     VALUES ('40000000-0000-0000-0000-000000000001', 'RESUME', 'path.pdf', 'f.pdf', 100, 'application/pdf') $$,
  '42501',
  NULL,
  'Student Alice cannot directly insert into documents table'
);

-- Alice direct UPDATE on documents table is denied (REVOKED)
SELECT throws_ok(
  $$ UPDATE documents SET is_current = false WHERE owner_id = '40000000-0000-0000-0000-000000000001' $$,
  '42501',
  NULL,
  'Student Alice cannot directly update documents table'
);

-- Alice direct DELETE on documents table is denied (REVOKED)
SELECT throws_ok(
  $$ DELETE FROM documents WHERE owner_id = '40000000-0000-0000-0000-000000000001' $$,
  '42501',
  NULL,
  'Student Alice cannot directly delete from documents table'
);

-- Alice can select own photo from storage.objects
SELECT results_eq(
  $$ SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'profile-photos' AND name = '40000000-0000-0000-0000-000000000001/photo.jpg' $$,
  ARRAY[1],
  'Student Alice can view own profile photo in storage.objects'
);

-- Alice cannot select Charlie's photo from storage.objects
SELECT is_empty(
  $$ SELECT * FROM storage.objects WHERE bucket_id = 'profile-photos' AND name LIKE '40000000-0000-0000-0000-000000000003/%' $$,
  'Student Alice cannot view Charlie photo in storage.objects'
);

-- Alice raw SQL INSERT on resumes is denied by RLS
SELECT throws_ok(
  $$ INSERT INTO storage.objects (id, bucket_id, name, owner_id)
     VALUES (gen_random_uuid(), 'resumes', '40000000-0000-0000-0000-000000000001/raw.pdf', '40000000-0000-0000-0000-000000000001') $$,
  '42501',
  NULL,
  'Student Alice direct INSERT on resumes storage is denied'
);

-- Alice raw SQL INSERT on profile-photos is denied by RLS
SELECT throws_ok(
  $$ INSERT INTO storage.objects (id, bucket_id, name, owner_id)
     VALUES (gen_random_uuid(), 'profile-photos', '40000000-0000-0000-0000-000000000001/raw.jpg', '40000000-0000-0000-0000-000000000001') $$,
  '42501',
  NULL,
  'Student Alice direct INSERT on profile-photos storage is denied'
);

-- Alice raw SQL DELETE on own resume is blocked by protect_delete trigger
SELECT throws_ok(
  $$ DELETE FROM storage.objects WHERE bucket_id = 'resumes' AND name LIKE '40000000-0000-0000-0000-000000000001/%' $$,
  '42501',
  'Direct deletion from storage tables is not allowed. Use the Storage API instead.',
  'Student Alice raw SQL DELETE on resumes is blocked'
);

-- Alice raw SQL DELETE on own photo is blocked by protect_delete trigger
SELECT throws_ok(
  $$ DELETE FROM storage.objects WHERE bucket_id = 'profile-photos' AND name LIKE '40000000-0000-0000-0000-000000000001/%' $$,
  '42501',
  'Direct deletion from storage tables is not allowed. Use the Storage API instead.',
  'Student Alice raw SQL DELETE on photos is blocked'
);

-- In Storage API context (storage.allow_delete_query = true), RLS policy absence ensures 0 rows deleted
SET LOCAL storage.allow_delete_query = 'true';
DELETE FROM storage.objects WHERE bucket_id = 'resumes' AND name = '40000000-0000-0000-0000-000000000001/resume1.pdf';
SELECT results_eq(
  $$ SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'resumes' AND name = '40000000-0000-0000-0000-000000000001/resume1.pdf' $$,
  ARRAY[1],
  'Student Alice raw DELETE on own resume leaves object intact under RLS'
);

DELETE FROM storage.objects WHERE bucket_id = 'profile-photos' AND name = '40000000-0000-0000-0000-000000000001/photo.jpg';
SELECT results_eq(
  $$ SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'profile-photos' AND name = '40000000-0000-0000-0000-000000000001/photo.jpg' $$,
  ARRAY[1],
  'Student Alice raw DELETE on own photo leaves object intact under RLS'
);

-- ============================================================================
-- 6. Coordinator Scoping on Documents & Student Profiles (Coordinator Bob Context)
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Coordinator Bob has scope over BARCH 2026 -> Can select Alice's resume
SELECT results_eq(
  $$ SELECT count(*)::integer FROM documents WHERE owner_id = '40000000-0000-0000-0000-000000000001' $$,
  ARRAY[2],
  'Coordinator Bob can view in-scope student documents (Alice BARCH 2026)'
);

-- Coordinator Bob CANNOT view Charlie's documents or academic record (Charlie is MPLAN 2027)
SELECT is_empty(
  $$ SELECT * FROM documents WHERE owner_id = '40000000-0000-0000-0000-000000000003' $$,
  'Coordinator Bob cannot view out-of-scope student documents (Charlie MPLAN 2027)'
);

SELECT is_empty(
  $$ SELECT * FROM academic_records WHERE profile_id = '40000000-0000-0000-0000-000000000003' $$,
  'Coordinator Bob cannot view out-of-scope academic records (Charlie MPLAN 2027)'
);

SELECT is_empty(
  $$ SELECT * FROM student_profiles WHERE profile_id = '40000000-0000-0000-0000-000000000003' $$,
  'Coordinator Bob cannot view out-of-scope student profiles (Charlie MPLAN 2027)'
);

-- Coordinator Bob can select Alice's registered resume in storage.objects (in-scope)
SELECT results_eq(
  $$ SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'resumes' AND name = '40000000-0000-0000-0000-000000000001/resume1.pdf' $$,
  ARRAY[1],
  'Coordinator Bob can view registered in-scope student resume in storage.objects'
);

-- Coordinator Bob CANNOT select Alice's orphan resume in storage.objects (unregistered)
SELECT is_empty(
  $$ SELECT * FROM storage.objects WHERE bucket_id = 'resumes' AND name = '40000000-0000-0000-0000-000000000001/orphan_resume.pdf' $$,
  'Coordinator Bob cannot view orphan resume even in in-scope student folder'
);

-- Coordinator Bob can select Alice's active registered photo in storage.objects (in-scope)
SELECT results_eq(
  $$ SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'profile-photos' AND name = '40000000-0000-0000-0000-000000000001/photo.jpg' $$,
  ARRAY[1],
  'Coordinator Bob can view active registered student photo in storage.objects'
);

-- Coordinator Bob CANNOT select Alice's orphan photo in storage.objects (unregistered)
SELECT is_empty(
  $$ SELECT * FROM storage.objects WHERE bucket_id = 'profile-photos' AND name = '40000000-0000-0000-0000-000000000001/orphan_photo.jpg' $$,
  'Coordinator Bob cannot view orphan photo even in in-scope student folder'
);

-- Coordinator Bob CANNOT select Charlie's resume in storage.objects (out-of-scope)
SELECT is_empty(
  $$ SELECT * FROM storage.objects WHERE bucket_id = 'resumes' AND name LIKE '40000000-0000-0000-0000-000000000003/%' $$,
  'Coordinator Bob cannot view out-of-scope student resume in storage.objects'
);

-- Coordinator Bob CANNOT select Charlie's photo in storage.objects (out-of-scope)
SELECT is_empty(
  $$ SELECT * FROM storage.objects WHERE bucket_id = 'profile-photos' AND name LIKE '40000000-0000-0000-0000-000000000003/%' $$,
  'Coordinator Bob cannot view out-of-scope student photo in storage.objects'
);

-- Coordinator Bob scoping helper checks
SELECT results_eq(
  $$ SELECT can_access_student('40000000-0000-0000-0000-000000000001'::UUID) $$,
  ARRAY[true],
  'can_access_student returns true for in-scope student (Alice)'
);

SELECT results_eq(
  $$ SELECT can_access_student('40000000-0000-0000-0000-000000000003'::UUID) $$,
  ARRAY[false],
  'can_access_student returns false for out-of-scope student (Charlie)'
);

-- Coordinator Bob raw DELETE on student storage is denied (0 rows affected under RLS)
SET LOCAL storage.allow_delete_query = 'true';
DELETE FROM storage.objects WHERE bucket_id = 'resumes' AND name = '40000000-0000-0000-0000-000000000001/resume1.pdf';
SELECT results_eq(
  $$ SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'resumes' AND name = '40000000-0000-0000-0000-000000000001/resume1.pdf' $$,
  ARRAY[1],
  'Coordinator Bob raw DELETE on in-scope student resume leaves object intact (denied by policy)'
);

-- Coordinator Bob CANNOT call update_own_student_profile
SELECT throws_ok(
  $$ SELECT update_own_student_profile(p_bio => 'Hacked') $$,
  'P0001',
  'Unauthorized: Only an active student can update their profile',
  'Coordinator cannot call update_own_student_profile'
);

-- Coordinator Bob CANNOT verify academic records
SELECT throws_ok(
  $$ SELECT verify_student_academic_record(
       '40000000-0000-0000-0000-000000000001'::UUID,
       9.00,
       0
     ) $$,
  'P0001',
  'Unauthorized: Only TNP Secretary or Super Admin can verify academic records',
  'Coordinator cannot verify academic records'
);

-- Coordinator Bob CANNOT correct academic records
SELECT throws_ok(
  $$ SELECT correct_student_academic_record(
       '40000000-0000-0000-0000-000000000001'::UUID,
       9.00,
       0,
       'Coordinator justification'
     ) $$,
  'P0001',
  'Unauthorized: Only TNP Secretary or Super Admin can correct academic records',
  'Coordinator cannot correct academic records'
);

-- ============================================================================
-- 7. Academic Verification by Super Admin
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Super Admin verifies Charlie (MPLAN 2027)
SELECT lives_ok(
  $$ SELECT verify_student_academic_record(
       '40000000-0000-0000-0000-000000000003'::UUID,
       9.20,
       0
     ) $$,
  'Super Admin can verify academic record'
);

-- Verify Charlie record updated
SELECT results_eq(
  $$ SELECT verification_status FROM academic_records WHERE profile_id = '40000000-0000-0000-0000-000000000003' $$,
  ARRAY['VERIFIED'::verification_status],
  'Academic record status is VERIFIED'
);

SELECT results_eq(
  $$ SELECT cgpa FROM academic_records WHERE profile_id = '40000000-0000-0000-0000-000000000003' $$,
  ARRAY[9.20::numeric(4,2)],
  'Academic record CGPA updated to 9.20'
);

-- Verify audit log generated for verification
SELECT results_eq(
  $$ SELECT count(*)::integer FROM audit_logs
     WHERE action = 'ACADEMIC_VERIFIED'
       AND actor_id = '00000000-0000-0000-0000-000000000001'
       AND (metadata->>'student_id') = '40000000-0000-0000-0000-000000000003' $$,
  ARRAY[1],
  'ACADEMIC_VERIFIED audit log entry created'
);

-- Verify audit log metadata does NOT leak raw CGPA
SELECT is_empty(
  $$ SELECT * FROM audit_logs
     WHERE action = 'ACADEMIC_VERIFIED'
       AND (metadata ? 'cgpa' OR metadata ? 'active_backlogs') $$,
  'Audit log metadata does NOT contain raw CGPA or backlog numbers'
);

-- CGPA out of bounds (< 0) fails
SELECT throws_ok(
  $$ SELECT verify_student_academic_record(
       '40000000-0000-0000-0000-000000000003'::UUID,
       -1.00,
       0
     ) $$,
  'P0001',
  'CGPA must be between 0.00 and 10.00',
  'Negative CGPA is rejected'
);

-- CGPA out of bounds (> 10.00) fails
SELECT throws_ok(
  $$ SELECT verify_student_academic_record(
       '40000000-0000-0000-0000-000000000003'::UUID,
       10.50,
       0
     ) $$,
  'P0001',
  'CGPA must be between 0.00 and 10.00',
  'CGPA exceeding 10.00 is rejected'
);

-- ============================================================================
-- 8. Academic Correction by TNP Secretary
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- TNP Secretary corrects Charlie's record with mandatory justification
SELECT lives_ok(
  $$ SELECT correct_student_academic_record(
       '40000000-0000-0000-0000-000000000003'::UUID,
       9.35,
       0,
       'Official grade sheet verification by authorized staff'
     ) $$,
  'TNP Secretary can correct academic record with reason'
);

-- Verify CGPA updated to 9.35
SELECT results_eq(
  $$ SELECT cgpa FROM academic_records WHERE profile_id = '40000000-0000-0000-0000-000000000003' $$,
  ARRAY[9.35::numeric(4,2)],
  'Academic record CGPA corrected to 9.35'
);

-- Correction without justification reason fails (< 5 chars)
SELECT throws_ok(
  $$ SELECT correct_student_academic_record(
       '40000000-0000-0000-0000-000000000003'::UUID,
       9.40,
       0,
       'Fix'
     ) $$,
  'P0001',
  'A mandatory justification reason (min 5 characters) is required for academic corrections',
  'Correction with short justification is rejected'
);

-- Verify audit log generated for correction with reason
SELECT results_eq(
  $$ SELECT count(*)::integer FROM audit_logs
     WHERE action = 'ACADEMIC_CORRECTED'
       AND actor_id = '20000000-0000-0000-0000-000000000001'
       AND (metadata->>'reason') = 'Official grade sheet verification by authorized staff' $$,
  ARRAY[1],
  'ACADEMIC_CORRECTED audit log entry created with mandatory reason'
);

-- Verify correction audit log does NOT leak raw CGPA
SELECT is_empty(
  $$ SELECT * FROM audit_logs
     WHERE action = 'ACADEMIC_CORRECTED'
       AND (metadata ? 'cgpa' OR metadata ? 'active_backlogs') $$,
  'Correction audit log metadata does NOT contain raw CGPA or backlog numbers'
);

-- TNP Secretary raw DELETE on student storage is denied (0 rows affected under RLS)
SET LOCAL storage.allow_delete_query = 'true';
DELETE FROM storage.objects WHERE bucket_id = 'resumes' AND name = '40000000-0000-0000-0000-000000000001/resume1.pdf';
SELECT results_eq(
  $$ SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'resumes' AND name = '40000000-0000-0000-0000-000000000001/resume1.pdf' $$,
  ARRAY[1],
  'TNP Secretary raw DELETE on student resume leaves object intact (denied by policy)'
);

-- ============================================================================
-- 9. Recruiter Access Denial to Documents & Profiles
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Recruiter cannot read any documents
SELECT is_empty(
  $$ SELECT * FROM documents $$,
  'Recruiter cannot read any documents'
);

-- Recruiter cannot read student_profiles
SELECT is_empty(
  $$ SELECT * FROM student_profiles $$,
  'Recruiter cannot read student_profiles'
);

-- Recruiter cannot read academic_records
SELECT is_empty(
  $$ SELECT * FROM academic_records $$,
  'Recruiter cannot read academic_records'
);

-- Recruiter cannot verify or correct records
SELECT throws_ok(
  $$ SELECT verify_student_academic_record('40000000-0000-0000-0000-000000000001'::UUID, 8.50, 0) $$,
  'P0001',
  'Unauthorized: Only TNP Secretary or Super Admin can verify academic records',
  'Recruiter cannot verify academic records'
);

-- Recruiter cannot read any resumes from storage.objects
SELECT is_empty(
  $$ SELECT * FROM storage.objects WHERE bucket_id = 'resumes' $$,
  'Recruiter cannot read any resumes from storage.objects'
);

-- Recruiter cannot read any photos from storage.objects
SELECT is_empty(
  $$ SELECT * FROM storage.objects WHERE bucket_id = 'profile-photos' $$,
  'Recruiter cannot read any photos from storage.objects'
);

-- ============================================================================
-- 10. Anonymous Access Denial
-- ============================================================================

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '{}';

SELECT is_empty(
  $$ SELECT * FROM documents $$,
  'Anonymous cannot read any documents'
);

SELECT is_empty(
  $$ SELECT * FROM student_profiles $$,
  'Anonymous cannot read student_profiles'
);

SELECT is_empty(
  $$ SELECT * FROM academic_records $$,
  'Anonymous cannot read academic_records'
);

-- Anonymous cannot read any resumes from storage.objects
SELECT is_empty(
  $$ SELECT * FROM storage.objects WHERE bucket_id = 'resumes' $$,
  'Anonymous cannot read any resumes from storage.objects'
);

-- Anonymous cannot read any photos from storage.objects
SELECT is_empty(
  $$ SELECT * FROM storage.objects WHERE bucket_id = 'profile-photos' $$,
  'Anonymous cannot read any photos from storage.objects'
);

SELECT finish();
ROLLBACK;
