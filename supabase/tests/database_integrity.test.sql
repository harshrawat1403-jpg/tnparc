BEGIN;
SELECT plan(80);

-- ============================================================================
-- 1. Table Existence Checks (22 tables)
-- ============================================================================
SELECT has_table('public', 'profiles', 'Table profiles should exist');
SELECT has_table('public', 'academic_programs', 'Table academic_programs should exist');
SELECT has_table('public', 'student_roster', 'Table student_roster should exist');
SELECT has_table('public', 'student_profiles', 'Table student_profiles should exist');
SELECT has_table('public', 'academic_records', 'Table academic_records should exist');
SELECT has_table('public', 'skills', 'Table skills should exist');
SELECT has_table('public', 'student_skills', 'Table student_skills should exist');
SELECT has_table('public', 'student_skill_evidence', 'Table student_skill_evidence should exist');
SELECT has_table('public', 'coordinator_student_scopes', 'Table coordinator_student_scopes should exist');
SELECT has_table('public', 'companies', 'Table companies should exist');
SELECT has_table('public', 'recruiter_contacts', 'Table recruiter_contacts should exist');
SELECT has_table('public', 'recruiter_invitations', 'Table recruiter_invitations should exist');
SELECT has_table('public', 'recruiter_profiles', 'Table recruiter_profiles should exist');
SELECT has_table('public', 'placement_drives', 'Table placement_drives should exist');
SELECT has_table('public', 'drive_eligibility', 'Table drive_eligibility should exist');
SELECT has_table('public', 'drive_eligible_batches', 'Table drive_eligible_batches should exist');
SELECT has_table('public', 'recruiter_drive_access', 'Table recruiter_drive_access should exist');
SELECT has_table('public', 'applications', 'Table applications should exist');
SELECT has_table('public', 'application_status_history', 'Table application_status_history should exist');
SELECT has_table('public', 'documents', 'Table documents should exist');
SELECT has_table('public', 'announcements', 'Table announcements should exist');
SELECT has_table('public', 'audit_logs', 'Table audit_logs should exist');

-- ============================================================================
-- Test Fixtures Setup (within transaction)
-- ============================================================================
-- Insert synthetic users in auth.users for test references
INSERT INTO auth.users (id, aud, role, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'test-sa2@vnit.test'),
  ('22222222-2222-2222-2222-222222222221', 'authenticated', 'authenticated', 'test-sec1@vnit.test'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'test-sec2@vnit.test'),
  ('33333333-3333-3333-3333-333333333331', 'authenticated', 'authenticated', 'test-coord1@vnit.test'),
  ('33333333-3333-3333-3333-333333333332', 'authenticated', 'authenticated', 'test-coord2@vnit.test'),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'test-coord3@vnit.test'),
  ('44444444-4444-4444-4444-444444444441', 'authenticated', 'authenticated', 'test-student1@vnit.test'),
  ('44444444-4444-4444-4444-444444444442', 'authenticated', 'authenticated', 'test-student2@vnit.test'),
  ('55555555-5555-5555-5555-555555555551', 'authenticated', 'authenticated', 'test-recruiter1@vnit.test')
ON CONFLICT (id) DO NOTHING;

-- Retrieve existing seed admin ID
DO $$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
  -- Verify seed admin is present
  PERFORM 1 FROM profiles WHERE id = v_admin_id;
END;
$$;

-- ============================================================================
-- 2. Exactly One Active Super Admin (uq_active_super_admin)
-- ============================================================================
SELECT throws_ok(
  $$ INSERT INTO profiles (id, role, display_name, is_active)
     VALUES ('11111111-1111-1111-1111-111111111111', 'SUPER_ADMIN', 'Second Super Admin', true) $$,
  '23505',
  NULL,
  'Cannot create a second active SUPER_ADMIN'
);

-- ============================================================================
-- 3. At Most One Active TNP Secretary (uq_active_secretary)
-- ============================================================================
SELECT lives_ok(
  $$ INSERT INTO profiles (id, role, display_name, is_active)
     VALUES ('22222222-2222-2222-2222-222222222221', 'TNP_SECRETARY', 'First Secretary', true) $$,
  'First active TNP_SECRETARY can be inserted'
);

SELECT throws_ok(
  $$ INSERT INTO profiles (id, role, display_name, is_active)
     VALUES ('22222222-2222-2222-2222-222222222222', 'TNP_SECRETARY', 'Second Secretary', true) $$,
  '23505',
  NULL,
  'Cannot create a second active TNP_SECRETARY'
);

-- ============================================================================
-- 4. At Most Two Active Coordinators, Unique Slots (uq_active_coordinator_slot)
-- ============================================================================
SELECT lives_ok(
  $$ INSERT INTO profiles (id, role, display_name, coordinator_slot, is_active)
     VALUES ('33333333-3333-3333-3333-333333333331', 'TNP_COORDINATOR', 'Coordinator 1', 'SLOT_1', true) $$,
  'First coordinator with SLOT_1 can be inserted'
);

SELECT throws_ok(
  $$ INSERT INTO profiles (id, role, display_name, coordinator_slot, is_active)
     VALUES ('33333333-3333-3333-3333-333333333332', 'TNP_COORDINATOR', 'Coordinator 2 Conflict', 'SLOT_1', true) $$,
  '23505',
  NULL,
  'Cannot insert two active coordinators with the same SLOT_1'
);

SELECT lives_ok(
  $$ INSERT INTO profiles (id, role, display_name, coordinator_slot, is_active)
     VALUES ('33333333-3333-3333-3333-333333333332', 'TNP_COORDINATOR', 'Coordinator 2', 'SLOT_2', true) $$,
  'Second coordinator with SLOT_2 can be inserted'
);

-- ============================================================================
-- 5. Coordinator Slot Validity (chk_coordinator_slot)
-- ============================================================================
SELECT throws_ok(
  $$ INSERT INTO profiles (id, role, display_name, coordinator_slot, is_active)
     VALUES ('33333333-3333-3333-3333-333333333333', 'TNP_COORDINATOR', 'Coordinator No Slot', NULL, true) $$,
  '23514',
  NULL,
  'TNP_COORDINATOR must have a non-null coordinator_slot'
);

SELECT throws_ok(
  $$ INSERT INTO profiles (id, role, display_name, coordinator_slot, is_active)
     VALUES ('44444444-4444-4444-4444-444444444441', 'STUDENT', 'Student With Slot', 'SLOT_1', true) $$,
  '23514',
  NULL,
  'STUDENT role cannot have a coordinator_slot'
);

-- ============================================================================
-- 6. Student Lifecycle Status Check (chk_lifecycle_status_student_only)
-- ============================================================================
SELECT lives_ok(
  $$ INSERT INTO profiles (id, role, display_name, student_lifecycle_status, is_active)
     VALUES ('44444444-4444-4444-4444-444444444441', 'STUDENT', 'Student One', 'STUDENT_ACTIVE', true) $$,
  'STUDENT role with valid student_lifecycle_status can be inserted'
);

SELECT throws_ok(
  $$ INSERT INTO profiles (id, role, display_name, student_lifecycle_status, is_active)
     VALUES ('44444444-4444-4444-4444-444444444442', 'STUDENT', 'Student Null Status', NULL, true) $$,
  '23514',
  NULL,
  'STUDENT role must have a non-null student_lifecycle_status'
);

SELECT throws_ok(
  $$ INSERT INTO profiles (id, role, display_name, student_lifecycle_status, is_active)
     VALUES ('55555555-5555-5555-5555-555555555551', 'RECRUITER', 'Recruiter With Lifecycle', 'STUDENT_ACTIVE', true) $$,
  '23514',
  NULL,
  'Non-STUDENT role cannot have student_lifecycle_status'
);

-- Insert second valid student for subsequent tests
INSERT INTO profiles (id, role, display_name, student_lifecycle_status, is_active)
VALUES ('44444444-4444-4444-4444-444444444442', 'STUDENT', 'Student Two', 'STUDENT_ACTIVE', true);

-- Insert valid recruiter profile
INSERT INTO profiles (id, role, display_name, is_active)
VALUES ('55555555-5555-5555-5555-555555555551', 'RECRUITER', 'Recruiter One', true);

-- ============================================================================
-- 7. Normalized Unique Roster Email
-- ============================================================================
INSERT INTO student_roster (institutional_id, full_name, institutional_email, program_id, batch)
SELECT 'BT22ARC001', 'Roster Candidate 1', '  STUDENT1@VNIT.TEST  ', id, '2022-2027'
FROM academic_programs WHERE code = 'BARCH' LIMIT 1;

SELECT is(
  (SELECT institutional_email FROM student_roster WHERE institutional_id = 'BT22ARC001'),
  'student1@vnit.test',
  'Roster email is automatically normalized to lower and trimmed'
);

SELECT throws_ok(
  $$ INSERT INTO student_roster (institutional_id, full_name, institutional_email, program_id, batch)
     SELECT 'BT22ARC002', 'Roster Candidate 2', 'student1@vnit.test', id, '2022-2027'
     FROM academic_programs WHERE code = 'BARCH' LIMIT 1 $$,
  '23505',
  NULL,
  'Duplicate normalized institutional_email is rejected'
);

-- ============================================================================
-- 8. Unique Roster Claim (claimed_by UNIQUE)
-- ============================================================================
SELECT lives_ok(
  $$ UPDATE student_roster
     SET claimed_by = '44444444-4444-4444-4444-444444444441'
     WHERE institutional_id = 'BT22ARC001' $$,
  'Roster entry can be claimed by a student profile'
);

-- Insert another roster entry
INSERT INTO student_roster (institutional_id, full_name, institutional_email, program_id, batch)
SELECT 'BT22ARC002', 'Roster Candidate 2', 'student2@vnit.test', id, '2022-2027'
FROM academic_programs WHERE code = 'BARCH' LIMIT 1;

SELECT throws_ok(
  $$ UPDATE student_roster
     SET claimed_by = '44444444-4444-4444-4444-444444444441'
     WHERE institutional_id = 'BT22ARC002' $$,
  '23505',
  NULL,
  'Same student profile cannot claim a second roster entry'
);

-- ============================================================================
-- 9. Academic CGPA Bounds (academic_records)
-- ============================================================================
SELECT throws_ok(
  $$ INSERT INTO academic_records (profile_id, program_id, batch, cgpa, active_backlogs)
     SELECT '44444444-4444-4444-4444-444444444441', id, '2022-2027', 10.50, 0
     FROM academic_programs WHERE code = 'BARCH' LIMIT 1 $$,
  '23514',
  NULL,
  'CGPA > 10.0 is rejected by check constraint'
);

SELECT throws_ok(
  $$ INSERT INTO academic_records (profile_id, program_id, batch, cgpa, active_backlogs)
     SELECT '44444444-4444-4444-4444-444444444441', id, '2022-2027', -0.10, 0
     FROM academic_programs WHERE code = 'BARCH' LIMIT 1 $$,
  '23514',
  NULL,
  'CGPA < 0.0 is rejected by check constraint'
);

SELECT lives_ok(
  $$ INSERT INTO academic_records (profile_id, program_id, batch, cgpa, active_backlogs)
     SELECT '44444444-4444-4444-4444-444444444441', id, '2022-2027', 8.75, 0
     FROM academic_programs WHERE code = 'BARCH' LIMIT 1 $$,
  'Valid CGPA between 0 and 10 is accepted'
);

-- ============================================================================
-- 10. Nonnegative Active Backlogs (academic_records)
-- ============================================================================
SELECT throws_ok(
  $$ INSERT INTO academic_records (profile_id, program_id, batch, cgpa, active_backlogs)
     SELECT '44444444-4444-4444-4444-444444444442', id, '2022-2027', 7.50, -1
     FROM academic_programs WHERE code = 'BARCH' LIMIT 1 $$,
  '23514',
  NULL,
  'Negative active backlogs are rejected'
);

SELECT lives_ok(
  $$ INSERT INTO academic_records (profile_id, program_id, batch, cgpa, active_backlogs)
     SELECT '44444444-4444-4444-4444-444444444442', id, '2022-2027', 7.50, 0
     FROM academic_programs WHERE code = 'BARCH' LIMIT 1 $$,
  'Nonnegative active backlogs are accepted'
);

SELECT throws_ok(
  $$ DELETE FROM profiles WHERE id = '44444444-4444-4444-4444-444444444442' $$,
  '23503',
  NULL,
  'Deleting student profile is blocked by academic_records ON DELETE RESTRICT'
);

-- ============================================================================
-- 11. Public Slug Format, Uniqueness, and Enable Requirement (student_profiles)
-- ============================================================================
SELECT throws_ok(
  $$ INSERT INTO student_profiles (profile_id, public_profile_slug)
     VALUES ('44444444-4444-4444-4444-444444444441', 'Bad Slug!') $$,
  '23514',
  NULL,
  'Slug with special characters or uppercase is rejected'
);

SELECT lives_ok(
  $$ INSERT INTO student_profiles (profile_id, public_profile_slug, public_profile_enabled)
     VALUES ('44444444-4444-4444-4444-444444444441', 'harsh-rawat-2027', true) $$,
  'Valid public slug format is accepted'
);

SELECT throws_ok(
  $$ INSERT INTO student_profiles (profile_id, public_profile_slug)
     VALUES ('44444444-4444-4444-4444-444444444442', 'harsh-rawat-2027') $$,
  '23505',
  NULL,
  'Duplicate public slug is rejected'
);

SELECT throws_ok(
  $$ INSERT INTO student_profiles (profile_id, public_profile_enabled, public_profile_slug)
     VALUES ('44444444-4444-4444-4444-444444444442', true, NULL) $$,
  '23514',
  NULL,
  'public_profile_enabled = true requires public_profile_slug NOT NULL'
);

-- Insert valid student_profile for student 2 with private settings
INSERT INTO student_profiles (profile_id, public_profile_enabled, public_profile_slug)
VALUES ('44444444-4444-4444-4444-444444444442', false, NULL);

-- ============================================================================
-- 12. One Active/Current Resume per Student (documents)
-- ============================================================================
SELECT lives_ok(
  $$ INSERT INTO documents (owner_id, document_type, storage_path, is_current)
     VALUES ('44444444-4444-4444-4444-444444444441', 'RESUME', 'resumes/s1-v1.pdf', true) $$,
  'First current resume can be inserted'
);

SELECT throws_ok(
  $$ INSERT INTO documents (owner_id, document_type, storage_path, is_current)
     VALUES ('44444444-4444-4444-4444-444444444441', 'RESUME', 'resumes/s1-v2.pdf', true) $$,
  '23505',
  NULL,
  'Second current resume for the same owner is rejected by partial unique index'
);

SELECT lives_ok(
  $$ INSERT INTO documents (owner_id, document_type, storage_path, is_current)
     VALUES ('44444444-4444-4444-4444-444444444441', 'RESUME', 'resumes/s1-v0-archived.pdf', false) $$,
  'Historical archived resume (is_current = false) can be inserted'
);

-- ============================================================================
-- 13. Max 15 Active Student Skills (student_skills)
-- ============================================================================
-- Seed 16 skills for testing
INSERT INTO skills (id, name, created_by)
SELECT
  gen_random_uuid(),
  'Skill Test ' || LPAD(i::text, 2, '0'),
  '00000000-0000-0000-0000-000000000001'::UUID
FROM generate_series(1, 16) AS i;

-- Insert 15 active skills for student 1
SELECT lives_ok(
  $$ INSERT INTO student_skills (student_id, skill_id, proficiency_level, is_active)
     SELECT
       '44444444-4444-4444-4444-444444444441',
       id,
       3,
       true
     FROM skills
     WHERE name LIKE 'Skill Test %'
     ORDER BY name
     LIMIT 15 $$,
  'Can insert up to 15 active skill claims for a student'
);

-- Attempt 16th active skill
SELECT throws_ok(
  $$ INSERT INTO student_skills (student_id, skill_id, proficiency_level, is_active)
     SELECT
       '44444444-4444-4444-4444-444444444441',
       id,
       3,
       true
     FROM skills
     WHERE name = 'Skill Test 16' $$,
  NULL,
  'Maximum active skill claims limit (15) reached for this student',
  '16th active skill claim is rejected by trigger'
);

-- 16th inactive skill is allowed
SELECT lives_ok(
  $$ INSERT INTO student_skills (student_id, skill_id, proficiency_level, is_active)
     SELECT
       '44444444-4444-4444-4444-444444444441',
       id,
       3,
       false
     FROM skills
     WHERE name = 'Skill Test 16' $$,
  '16th skill claim with is_active = false is allowed'
);

-- ============================================================================
-- 14. One Student-Skill Pair (uq_student_skill)
-- ============================================================================
SELECT throws_ok(
  $$ INSERT INTO student_skills (student_id, skill_id, proficiency_level, is_active)
     SELECT
       '44444444-4444-4444-4444-444444444441',
       id,
       2,
       false
     FROM skills
     WHERE name = 'Skill Test 01' $$,
  '23505',
  NULL,
  'Cannot insert duplicate student-skill pair'
);

-- ============================================================================
-- 15. Valid Evidence Source Exclusivity (student_skill_evidence)
-- ============================================================================
DO $$
DECLARE
  v_student_skill_id UUID;
BEGIN
  SELECT id INTO v_student_skill_id
  FROM student_skills
  WHERE student_id = '44444444-4444-4444-4444-444444444441'
  LIMIT 1;

  -- Test both provided
  BEGIN
    INSERT INTO student_skill_evidence (student_skill_id, evidence_type, evidence_url, storage_path)
    VALUES (v_student_skill_id, 'PROJECT_LINK', 'https://example.com/project', 'evidence/file.pdf');
    RAISE EXCEPTION 'Expected check violation on both evidence sources provided';
  EXCEPTION WHEN check_violation THEN
    -- Expected
  END;

  -- Test neither provided
  BEGIN
    INSERT INTO student_skill_evidence (student_skill_id, evidence_type, evidence_url, storage_path)
    VALUES (v_student_skill_id, 'PROJECT_LINK', NULL, NULL);
    RAISE EXCEPTION 'Expected check violation on neither evidence source provided';
  EXCEPTION WHEN check_violation THEN
    -- Expected
  END;

  -- Test mismatched type PROJECT_LINK with storage_path
  BEGIN
    INSERT INTO student_skill_evidence (student_skill_id, evidence_type, evidence_url, storage_path)
    VALUES (v_student_skill_id, 'PROJECT_LINK', NULL, 'evidence/file.pdf');
    RAISE EXCEPTION 'Expected check violation on PROJECT_LINK with storage_path';
  EXCEPTION WHEN check_violation THEN
    -- Expected
  END;
END;
$$;

SELECT pass('Evidence with both sources provided is rejected by check constraint');
SELECT pass('Evidence with neither source provided is rejected by check constraint');
SELECT pass('Evidence with mismatched source and evidence_type is rejected');

SELECT lives_ok(
  $$ INSERT INTO student_skill_evidence (student_skill_id, evidence_type, evidence_url)
     SELECT id, 'PROJECT_LINK', 'https://github.com/vnit/cad-sample'
     FROM student_skills WHERE student_id = '44444444-4444-4444-4444-444444444441' LIMIT 1 $$,
  'Valid PROJECT_LINK evidence with URL is accepted'
);

SELECT lives_ok(
  $$ INSERT INTO student_skill_evidence (student_skill_id, evidence_type, storage_path)
     SELECT id, 'PDF_DOCUMENT', 'evidence/cad-cert.pdf'
     FROM student_skills WHERE student_id = '44444444-4444-4444-4444-444444444441' LIMIT 1 $$,
  'Valid PDF_DOCUMENT evidence with storage_path is accepted'
);

-- ============================================================================
-- 16. Company Normalized Name Uniqueness (companies)
-- ============================================================================
INSERT INTO companies (name, normalized_name, created_by)
VALUES ('Studio Lotus Architects', 'temp', '00000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT normalized_name FROM companies WHERE name = 'Studio Lotus Architects'),
  'studio lotus architects',
  'Company normalized_name is automatically computed via trigger'
);

SELECT throws_ok(
  $$ INSERT INTO companies (name, normalized_name, created_by)
     VALUES ('  STUDIO LOTUS ARCHITECTS  ', 'temp2', '00000000-0000-0000-0000-000000000001') $$,
  '23505',
  NULL,
  'Duplicate company normalized name is rejected'
);

-- ============================================================================
-- 17. Recruiter Invitation Expiry Sanity and Single Pending Rule
-- ============================================================================
-- Insert contact
INSERT INTO recruiter_contacts (id, company_id, full_name, email, created_by)
SELECT
  '66666666-6666-6666-6666-666666666661',
  id,
  'Jane Recruiter',
  'jane@studiolotus.test',
  '00000000-0000-0000-0000-000000000001'
FROM companies WHERE normalized_name = 'studio lotus architects' LIMIT 1;

-- Test invitation expiry sanity
SELECT throws_ok(
  $$ INSERT INTO recruiter_invitations (recruiter_contact_id, invited_by, expires_at)
     VALUES (
       '66666666-6666-6666-6666-666666666661',
       '00000000-0000-0000-0000-000000000001',
       now() - INTERVAL '1 hour'
     ) $$,
  '23514',
  NULL,
  'expires_at must be strictly greater than invited_at'
);

-- Insert valid invitation
INSERT INTO recruiter_invitations (recruiter_contact_id, invited_by, status, expires_at)
VALUES (
  '66666666-6666-6666-6666-666666666661',
  '00000000-0000-0000-0000-000000000001',
  'PENDING',
  now() + INTERVAL '7 days'
);

-- Second pending invitation is rejected
SELECT throws_ok(
  $$ INSERT INTO recruiter_invitations (recruiter_contact_id, invited_by, status, expires_at)
     VALUES (
       '66666666-6666-6666-6666-666666666661',
       '00000000-0000-0000-0000-000000000001',
       'PENDING',
       now() + INTERVAL '7 days'
     ) $$,
  '23505',
  NULL,
  'Only one PENDING invitation permitted per contact'
);

-- ============================================================================
-- 18. Drive Status Constraints, FSM, and Immutability
-- ============================================================================
-- Direct insert with PUBLISHED status is rejected (must start in DRAFT)
SELECT throws_ok(
  $$ INSERT INTO placement_drives (company_id, title, drive_type, status, application_deadline, created_by)
     SELECT id, 'Direct Published Drive', 'PLACEMENT', 'PUBLISHED', now() + INTERVAL '7 days', '00000000-0000-0000-0000-000000000001'
     FROM companies WHERE normalized_name = 'studio lotus architects' LIMIT 1 $$,
  NULL,
  'Placement drives must be created in DRAFT status',
  'Direct INSERT into placement_drives with PUBLISHED status is rejected'
);

-- Insert valid DRAFT drive
INSERT INTO placement_drives (id, company_id, title, drive_type, status, application_deadline, created_by)
SELECT
  '77777777-7777-7777-7777-777777777771',
  id,
  'Junior Architect Drive 2027',
  'PLACEMENT',
  'DRAFT',
  now() + INTERVAL '14 days',
  '00000000-0000-0000-0000-000000000001'
FROM companies WHERE normalized_name = 'studio lotus architects' LIMIT 1;

-- Invalid skip transition DRAFT -> CLOSED
SELECT throws_ok(
  $$ UPDATE placement_drives
     SET status = 'CLOSED'
     WHERE id = '77777777-7777-7777-7777-777777777771' $$,
  NULL,
  'Invalid drive status transition from DRAFT to CLOSED',
  'FSM rejects skipping PUBLISHED state'
);

-- Valid transition DRAFT -> PUBLISHED
SELECT lives_ok(
  $$ UPDATE placement_drives
     SET status = 'PUBLISHED',
         published_by = '00000000-0000-0000-0000-000000000001'
     WHERE id = '77777777-7777-7777-7777-777777777771' $$,
  'Valid transition DRAFT -> PUBLISHED succeeds'
);

-- Mutating drive_type after publication is rejected
SELECT throws_ok(
  $$ UPDATE placement_drives
     SET drive_type = 'INTERNSHIP'
     WHERE id = '77777777-7777-7777-7777-777777777771' $$,
  NULL,
  'drive_type is immutable after drive publication',
  'drive_type is immutable after drive publication'
);

-- Mutating company_id after publication is rejected
INSERT INTO companies (name, normalized_name, created_by)
VALUES ('Another Company', 'temp3', '00000000-0000-0000-0000-000000000001');

SELECT throws_ok(
  $$ UPDATE placement_drives
     SET company_id = (SELECT id FROM companies WHERE normalized_name = 'another company' LIMIT 1)
     WHERE id = '77777777-7777-7777-7777-777777777771' $$,
  NULL,
  'company_id is immutable after drive publication',
  'company_id is immutable after drive publication'
);

-- Full lifecycle to terminal ARCHIVED state on a second drive
INSERT INTO placement_drives (id, company_id, title, drive_type, status, application_deadline, created_by)
SELECT
  '77777777-7777-7777-7777-777777777772',
  id,
  'Terminal Drive Lifecycle Test',
  'PLACEMENT',
  'DRAFT',
  now() + INTERVAL '7 days',
  '00000000-0000-0000-0000-000000000001'
FROM companies WHERE normalized_name = 'studio lotus architects' LIMIT 1;

UPDATE placement_drives
SET status = 'PUBLISHED', published_by = '00000000-0000-0000-0000-000000000001'
WHERE id = '77777777-7777-7777-7777-777777777772';

SELECT lives_ok(
  $$ UPDATE placement_drives
     SET status = 'CLOSED',
         closed_by = '00000000-0000-0000-0000-000000000001'
     WHERE id = '77777777-7777-7777-7777-777777777772' $$,
  'Valid transition PUBLISHED -> CLOSED succeeds'
);

SELECT lives_ok(
  $$ UPDATE placement_drives
     SET status = 'ARCHIVED',
         archived_by = '00000000-0000-0000-0000-000000000001'
     WHERE id = '77777777-7777-7777-7777-777777777772' $$,
  'Valid transition CLOSED -> ARCHIVED succeeds'
);

SELECT throws_ok(
  $$ UPDATE placement_drives
     SET title = 'Modifying terminal archived drive'
     WHERE id = '77777777-7777-7777-7777-777777777772' $$,
  NULL,
  'Placement drives in ARCHIVED status are terminal and cannot be modified',
  'Modification of an ARCHIVED drive is rejected as terminal'
);

-- ============================================================================
-- 19. Drive Eligibility: One Row per Drive and Numeric Bounds
-- ============================================================================
INSERT INTO drive_eligibility (drive_id, minimum_cgpa, maximum_active_backlogs)
VALUES ('77777777-7777-7777-7777-777777777771', 7.00, 0);

SELECT throws_ok(
  $$ INSERT INTO drive_eligibility (drive_id, minimum_cgpa, maximum_active_backlogs)
     VALUES ('77777777-7777-7777-7777-777777777771', 6.50, 1) $$,
  '23505',
  NULL,
  'Only one drive_eligibility row per drive allowed'
);

SELECT throws_ok(
  $$ INSERT INTO drive_eligibility (drive_id, minimum_cgpa, maximum_active_backlogs)
     VALUES (gen_random_uuid(), 11.00, 0) $$,
  '23514',
  NULL,
  'minimum_cgpa > 10 is rejected'
);

SELECT throws_ok(
  $$ INSERT INTO drive_eligibility (drive_id, minimum_cgpa, maximum_active_backlogs)
     VALUES (gen_random_uuid(), 6.50, -1) $$,
  '23514',
  NULL,
  'maximum_active_backlogs < 0 is rejected'
);

-- ============================================================================
-- 20. Drive Eligible Batches: Unique Program+Batch Pairs
-- ============================================================================
INSERT INTO drive_eligible_batches (drive_id, program_id, batch)
SELECT '77777777-7777-7777-7777-777777777771', id, '2022-2027'
FROM academic_programs WHERE code = 'BARCH' LIMIT 1;

SELECT throws_ok(
  $$ INSERT INTO drive_eligible_batches (drive_id, program_id, batch)
     SELECT '77777777-7777-7777-7777-777777777771', id, '2022-2027'
     FROM academic_programs WHERE code = 'BARCH' LIMIT 1 $$,
  '23505',
  NULL,
  'Duplicate drive eligible program+batch pair is rejected'
);

-- ============================================================================
-- 21. Applications: One Application per Student per Drive
-- ============================================================================
INSERT INTO applications (student_id, drive_id, status, snapshot_cgpa, snapshot_backlogs)
VALUES ('44444444-4444-4444-4444-444444444441', '77777777-7777-7777-7777-777777777771', 'APPLIED', 8.75, 0);

SELECT throws_ok(
  $$ INSERT INTO applications (student_id, drive_id, status)
     VALUES ('44444444-4444-4444-4444-444444444441', '77777777-7777-7777-7777-777777777771', 'APPLIED') $$,
  '23505',
  NULL,
  'Duplicate application for same student and drive is rejected'
);

-- ============================================================================
-- 22. Append-Only Application Status History
-- ============================================================================
INSERT INTO application_status_history (
  id,
  application_id,
  previous_status,
  new_status,
  changed_by,
  reason
)
SELECT
  '88888888-8888-8888-8888-888888888881',
  id,
  NULL,
  'APPLIED',
  '44444444-4444-4444-4444-444444444441',
  'Candidate applied'
FROM applications WHERE student_id = '44444444-4444-4444-4444-444444444441' LIMIT 1;

SELECT throws_ok(
  $$ UPDATE application_status_history
     SET reason = 'Tampered reason'
     WHERE id = '88888888-8888-8888-8888-888888888881' $$,
  NULL,
  'This table is append-only: UPDATE operation is not permitted on application_status_history',
  'UPDATE on application_status_history is blocked by trigger'
);

SELECT throws_ok(
  $$ DELETE FROM application_status_history
     WHERE id = '88888888-8888-8888-8888-888888888881' $$,
  NULL,
  'This table is append-only: DELETE operation is not permitted on application_status_history',
  'DELETE on application_status_history is blocked by trigger'
);

-- ============================================================================
-- 23. Append-Only Audit Logs
-- ============================================================================
INSERT INTO audit_logs (id, actor_id, action, entity_type, metadata)
VALUES (
  '99999999-9999-9999-9999-999999999991',
  '00000000-0000-0000-0000-000000000001',
  'DRIVE_PUBLISHED',
  'placement_drives',
  '{"drive_title":"Junior Architect Drive 2027"}'::jsonb
);

SELECT throws_ok(
  $$ UPDATE audit_logs
     SET action = 'TAMPERED_ACTION'
     WHERE id = '99999999-9999-9999-9999-999999999991' $$,
  NULL,
  'This table is append-only: UPDATE operation is not permitted on audit_logs',
  'UPDATE on audit_logs is blocked by trigger'
);

SELECT throws_ok(
  $$ DELETE FROM audit_logs
     WHERE id = '99999999-9999-9999-9999-999999999991' $$,
  NULL,
  'This table is append-only: DELETE operation is not permitted on audit_logs',
  'DELETE on audit_logs is blocked by trigger'
);

-- ============================================================================
-- Finish Tests
-- ============================================================================
SELECT * FROM finish();
ROLLBACK;
