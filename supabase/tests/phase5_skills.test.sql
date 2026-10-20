BEGIN;
SELECT plan(97);

-- ============================================================================
-- Phase 5 Skills Catalog, Claims, Evidence, and Staff Verification Tests
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
  INSERT INTO academic_records (profile_id, program_id, batch, cgpa, active_backlogs, verification_status, verified_by, verified_at) VALUES
    (v_stud_a_id, v_barch_id, '2026', 8.50, 0, 'VERIFIED', v_admin_id, now()),
    (v_stud_b_id, v_barch_id, '2026', 7.80, 1, 'VERIFIED', v_admin_id, now()),
    (v_stud_c_id, v_mplan_id, '2027', 9.10, 0, 'VERIFIED', v_admin_id, now())
  ON CONFLICT (profile_id) DO NOTHING;

  -- Assign coordinator scope for Coordinator Bob ONLY to BARCH 2026
  INSERT INTO coordinator_student_scopes (coordinator_id, program_id, batch, granted_by) VALUES
    (v_coord_id, v_barch_id, '2026', v_admin_id)
  ON CONFLICT (coordinator_id, program_id, batch) DO NOTHING;

  -- Seed initial catalog skills
  INSERT INTO skills (id, name, category, created_by, is_active) VALUES
    ('00000000-0000-0000-0001-000000000001', 'Revit BIM', 'Modeling', v_admin_id, true),
    ('00000000-0000-0000-0001-000000000002', 'AutoCAD 2D', 'Drafting', v_admin_id, true),
    ('00000000-0000-0000-0001-000000000003', 'Rhino Grasshopper', 'Parametric', v_admin_id, true),
    ('00000000-0000-0000-0001-000000000004', 'GIS Mapping', 'Urban Planning', v_admin_id, true),
    ('00000000-0000-0000-0001-000000000005', 'Inactive Legacy CAD', 'Legacy', v_admin_id, false)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ============================================================================
-- 1. Skills Catalog Management RBAC (12 tests)
-- ============================================================================

-- Admin can create skill
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT create_skill('SketchUp Pro', 'Modeling', '3D design and massing software') $$,
  'Super Admin can create a catalog skill'
);

-- Secretary can create skill
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT create_skill('Enscape', 'Rendering', 'Real-time architectural rendering') $$,
  'TNP Secretary can create a catalog skill'
);

-- Secretary can update skill
SELECT lives_ok(
  $$ SELECT update_skill('00000000-0000-0000-0001-000000000002', 'AutoCAD Architecture', 'Drafting', 'Updated description') $$,
  'TNP Secretary can update a catalog skill'
);

-- Secretary can deactivate skill
SELECT lives_ok(
  $$ SELECT deactivate_skill('00000000-0000-0000-0001-000000000002') $$,
  'TNP Secretary can deactivate a catalog skill'
);

-- Secretary can reactivate skill
SELECT lives_ok(
  $$ SELECT reactivate_skill('00000000-0000-0000-0001-000000000002') $$,
  'TNP Secretary can reactivate a catalog skill'
);

-- Coordinator CANNOT create skill
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_skill('Unauthorized Skill', 'Test', 'Desc') $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can create skills',
  'TNP Coordinator cannot create catalog skill'
);

SELECT throws_ok(
  $$ SELECT update_skill('00000000-0000-0000-0001-000000000001', 'Hacked', 'Test', 'Desc') $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can update skills',
  'TNP Coordinator cannot update catalog skill'
);

SELECT throws_ok(
  $$ SELECT deactivate_skill('00000000-0000-0000-0001-000000000001') $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can deactivate skills',
  'TNP Coordinator cannot deactivate catalog skill'
);

-- Student CANNOT manage catalog
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_skill('Student Skill', 'Test', 'Desc') $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can create skills',
  'Student cannot create catalog skill'
);

SELECT throws_ok(
  $$ SELECT deactivate_skill('00000000-0000-0000-0001-000000000001') $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can deactivate skills',
  'Student cannot deactivate catalog skill'
);

-- Recruiter CANNOT manage catalog
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_skill('Recruiter Skill', 'Test', 'Desc') $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can create skills',
  'Recruiter cannot create catalog skill'
);

-- Anonymous CANNOT manage catalog
RESET ROLE;
SET LOCAL ROLE anon;

SELECT throws_ok(
  $$ SELECT create_skill('Anon Skill', 'Test', 'Desc') $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can create skills',
  'Anonymous cannot create catalog skill'
);

-- ============================================================================
-- 2. Direct Table RLS Restrictions (6 tests)
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Direct insert on skills denied
SELECT throws_ok(
  $$ INSERT INTO skills (name, category, created_by) VALUES ('Hacked Skill', 'None', '40000000-0000-0000-0000-000000000001') $$,
  '42501',
  NULL,
  'Direct table INSERT on skills is blocked by RLS'
);

-- Direct update on skills denied
SELECT throws_ok(
  $$ UPDATE skills SET name = 'Hacked' WHERE id = '00000000-0000-0000-0001-000000000001' $$,
  '42501',
  NULL,
  'Direct table UPDATE on skills is blocked by RLS'
);

-- Direct insert on student_skills denied
SELECT throws_ok(
  $$ INSERT INTO student_skills (student_id, skill_id, proficiency_level)
     VALUES ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', 3) $$,
  '42501',
  NULL,
  'Direct table INSERT on student_skills is blocked by RLS'
);

-- Direct update on student_skills denied
SELECT throws_ok(
  $$ UPDATE student_skills SET verification_status = 'VERIFIED' WHERE student_id = '40000000-0000-0000-0000-000000000001' $$,
  '42501',
  NULL,
  'Direct table UPDATE on student_skills is blocked by RLS'
);

-- Direct insert on student_skill_evidence denied
SELECT throws_ok(
  $$ INSERT INTO student_skill_evidence (student_skill_id, evidence_type, evidence_url, description)
     VALUES ('00000000-0000-0000-0002-000000000001', 'PROJECT_LINK', 'https://example.com', 'Hack') $$,
  '42501',
  NULL,
  'Direct table INSERT on student_skill_evidence is blocked by RLS'
);

-- Direct delete on student_skill_evidence denied
SELECT throws_ok(
  $$ DELETE FROM student_skill_evidence WHERE id = '00000000-0000-0000-0002-000000000001' $$,
  '42501',
  NULL,
  'Direct table DELETE on student_skill_evidence is blocked by RLS'
);

-- Catalog RLS: Student Alice can select active skills from catalog
SELECT isnt_empty(
  $$ SELECT id FROM skills WHERE name = 'Revit BIM' $$,
  'Student Alice can view active catalog skills'
);

-- Catalog RLS: Student Alice CANNOT select inactive skills from catalog
SELECT is_empty(
  $$ SELECT id FROM skills WHERE name = 'Inactive Legacy CAD' $$,
  'Student Alice cannot view inactive catalog skills'
);

-- Catalog RLS: Coordinator Bob can select all catalog skills including inactive
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT isnt_empty(
  $$ SELECT id FROM skills WHERE name = 'Inactive Legacy CAD' $$,
  'TNP Coordinator can view all catalog skills including inactive'
);

-- Catalog RLS: Recruiter Dave CANNOT select any catalog skills (0 rows)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is_empty(
  $$ SELECT id FROM skills $$,
  'Recruiter receives zero rows from skills catalog table'
);

-- Catalog RLS: Anonymous CANNOT select any catalog skills (0 rows)
RESET ROLE;
SET LOCAL ROLE anon;

SELECT is_empty(
  $$ SELECT id FROM skills $$,
  'Anonymous user receives zero rows from skills catalog table'
);

-- Reset back to Alice context for Section 3
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- ============================================================================
-- 3. Student Claim Lifecycle & Validation (11 tests)
-- ============================================================================

-- Alice claims Revit BIM (Proficiency 3)
SELECT lives_ok(
  $$ SELECT claim_student_skill('00000000-0000-0000-0001-000000000001', 3) $$,
  'Student Alice can claim an active catalog skill with proficiency 3'
);

-- Verify status is PENDING and is_active is true
SELECT results_eq(
  $$ SELECT proficiency_level, verification_status, is_active
     FROM student_skills
     WHERE student_id = '40000000-0000-0000-0000-000000000001'
       AND skill_id = '00000000-0000-0000-0001-000000000001' $$,
  $$ VALUES (3, 'PENDING'::skill_verification_status, true) $$,
  'Claimed skill initializes with PENDING status and is_active = true'
);

-- Claiming invalid proficiency (0) fails
SELECT throws_ok(
  $$ SELECT claim_student_skill('00000000-0000-0000-0001-000000000003', 0) $$,
  'P0001',
  'Proficiency level must be an integer between 1 and 4',
  'Proficiency 0 is rejected'
);

-- Claiming invalid proficiency (5) fails
SELECT throws_ok(
  $$ SELECT claim_student_skill('00000000-0000-0000-0001-000000000003', 5) $$,
  'P0001',
  'Proficiency level must be an integer between 1 and 4',
  'Proficiency 5 is rejected'
);

-- Claiming inactive skill fails
SELECT throws_ok(
  $$ SELECT claim_student_skill('00000000-0000-0000-0001-000000000005', 2) $$,
  'P0001',
  'Cannot claim an inactive skill',
  'Claiming inactive skill is rejected'
);

-- Duplicate active claim fails
SELECT throws_ok(
  $$ SELECT claim_student_skill('00000000-0000-0000-0001-000000000001', 2) $$,
  'P0001',
  'Skill already claimed by student',
  'Duplicate active claim is rejected'
);

-- Non-student roles cannot claim skills
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT claim_student_skill('00000000-0000-0000-0001-000000000001', 2) $$,
  'P0001',
  'Unauthorized: Only active students can claim skills',
  'Recruiter cannot claim student skill'
);

-- Back to Alice context
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Alice updates proficiency from 3 to 4
DO $$
DECLARE
  v_claim_id UUID;
BEGIN
  SELECT id INTO v_claim_id FROM student_skills
  WHERE student_id = '40000000-0000-0000-0000-000000000001'
    AND skill_id = '00000000-0000-0000-0001-000000000001';

  PERFORM update_student_skill_proficiency(v_claim_id, 4);
END;
$$;

SELECT results_eq(
  $$ SELECT proficiency_level FROM student_skills
     WHERE student_id = '40000000-0000-0000-0000-000000000001'
       AND skill_id = '00000000-0000-0000-0001-000000000001' $$,
  ARRAY[4],
  'Alice can update proficiency on own claim to 4'
);

-- Alice CANNOT update another student claim proficiency
RESET ROLE;
INSERT INTO student_skills (id, student_id, skill_id, proficiency_level, verification_status, is_active)
VALUES ('00000000-0000-0000-0002-000000000002', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0001-000000000001', 2, 'PENDING', true);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT update_student_skill_proficiency('00000000-0000-0000-0002-000000000002', 4) $$,
  'P0001',
  'Skill claim not found or not owned by caller',
  'Alice cannot update Bob skill proficiency'
);

-- Alice CANNOT archive Bob claim
SELECT throws_ok(
  $$ SELECT archive_student_skill('00000000-0000-0000-0002-000000000002') $$,
  'P0001',
  'Skill claim not found or not owned by caller',
  'Alice cannot archive Bob skill claim'
);

-- Updating proficiency with invalid level fails
SELECT throws_ok(
  $$ SELECT update_student_skill_proficiency(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000001'),
       99
     ) $$,
  'P0001',
  'Proficiency level must be an integer between 1 and 4',
  'Updating proficiency to 99 is rejected'
);

-- ============================================================================
-- 4. 15-Active-Skill Cap Enforcement & Slot Reclamation (6 tests)
-- ============================================================================

-- Seed 13 additional distinct active catalog skills
RESET ROLE;
INSERT INTO skills (id, name, category, created_by, is_active) VALUES
  ('00000000-0000-0000-0001-000000000010', 'Skill 10', 'Cat', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0001-000000000011', 'Skill 11', 'Cat', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0001-000000000012', 'Skill 12', 'Cat', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0001-000000000013', 'Skill 13', 'Cat', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0001-000000000014', 'Skill 14', 'Cat', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0001-000000000015', 'Skill 15', 'Cat', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0001-000000000016', 'Skill 16', 'Cat', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0001-000000000017', 'Skill 17', 'Cat', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0001-000000000018', 'Skill 18', 'Cat', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0001-000000000019', 'Skill 19', 'Cat', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0001-000000000020', 'Skill 20', 'Cat', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0001-000000000021', 'Skill 21', 'Cat', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0001-000000000022', 'Skill 22', 'Cat', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0001-000000000023', 'Skill 23', 'Cat', '00000000-0000-0000-0000-000000000001', true)
ON CONFLICT (id) DO NOTHING;

-- Alice claims up to 15 skills (she currently has 1: Revit BIM)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT claim_student_skill('00000000-0000-0000-0001-000000000003', 2) $$,
  'Alice claims skill 2 of 15'
);
SELECT lives_ok(
  $$ SELECT claim_student_skill('00000000-0000-0000-0001-000000000004', 2) $$,
  'Alice claims skill 3 of 15'
);

-- Batch claim 4 through 15
DO $$
DECLARE
  v_sid UUID;
BEGIN
  FOR v_sid IN
    SELECT id FROM skills
    WHERE id >= '00000000-0000-0000-0001-000000000010'
      AND id <= '00000000-0000-0000-0001-000000000021'
  LOOP
    PERFORM claim_student_skill(v_sid, 2);
  END LOOP;
END;
$$;

-- Verify Alice has exactly 15 active claims
SELECT results_eq(
  $$ SELECT count(*)::integer FROM student_skills
     WHERE student_id = '40000000-0000-0000-0000-000000000001'
       AND is_active = true $$,
  ARRAY[15],
  'Alice has exactly 15 active claimed skills'
);

-- 16th active claim attempt is rejected by the trigger
SELECT throws_ok(
  $$ SELECT claim_student_skill('00000000-0000-0000-0001-000000000022', 2) $$,
  'P0001',
  'Maximum active skill claims limit (15) reached for this student',
  '16th active skill claim attempt is rejected by trigger'
);

-- Alice archives one claim (Revit BIM)
DO $$
DECLARE
  v_claim_id UUID;
BEGIN
  SELECT id INTO v_claim_id FROM student_skills
  WHERE student_id = '40000000-0000-0000-0000-000000000001'
    AND skill_id = '00000000-0000-0000-0001-000000000001';

  PERFORM archive_student_skill(v_claim_id);
END;
$$;

-- Verify count decreased to 14
SELECT results_eq(
  $$ SELECT count(*)::integer FROM student_skills
     WHERE student_id = '40000000-0000-0000-0000-000000000001'
       AND is_active = true $$,
  ARRAY[14],
  'Archiving a skill reduces active claims count to 14'
);

-- Now 15th slot is available again and succeeds
SELECT lives_ok(
  $$ SELECT claim_student_skill('00000000-0000-0000-0001-000000000022', 2) $$,
  'Alice can claim 15th skill after freeing a slot by archiving'
);

-- ============================================================================
-- 5. Optional Evidence Submission & Constraints (9 tests)
-- ============================================================================

-- Submit project link evidence
DO $$
DECLARE
  v_claim_id UUID;
BEGIN
  SELECT id INTO v_claim_id FROM student_skills
  WHERE student_id = '40000000-0000-0000-0000-000000000001'
    AND skill_id = '00000000-0000-0000-0001-000000000003';

  PERFORM submit_skill_evidence_link(
    p_student_skill_id => v_claim_id,
    p_evidence_url => 'https://github.com/alice/parametric-facade',
    p_description => 'Parametric computational facade model implemented in Grasshopper'
  );
END;
$$;

-- Verify evidence row created with PROJECT_LINK and storage_path NULL
SELECT results_eq(
  $$ SELECT e.evidence_type, e.evidence_url, e.storage_path
     FROM student_skill_evidence e
     JOIN student_skills s ON s.id = e.student_skill_id
     WHERE s.student_id = '40000000-0000-0000-0000-000000000001'
       AND s.skill_id = '00000000-0000-0000-0001-000000000003' $$,
  $$ VALUES ('PROJECT_LINK'::evidence_type, 'https://github.com/alice/parametric-facade'::text, NULL::text) $$,
  'Project link evidence is stored with storage_path NULL'
);

-- Submitting invalid link protocol fails
SELECT throws_ok(
  $$ SELECT submit_skill_evidence_link(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000003'),
       'javascript:alert(1)',
       'Invalid protocol'
     ) $$,
  'P0001',
  'Evidence URL must begin with http:// or https://',
  'Invalid protocol URL is rejected'
);

-- Submitting link with empty URL fails
SELECT throws_ok(
  $$ SELECT submit_skill_evidence_link(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000003'),
       '   ',
       'Empty URL'
     ) $$,
  'P0001',
  'Evidence URL cannot be empty',
  'Empty evidence URL is rejected'
);

-- Register PDF document evidence for GIS Mapping
RESET ROLE;
DO $$
DECLARE
  v_claim_id UUID;
  v_path     TEXT;
BEGIN
  SELECT id INTO v_claim_id FROM student_skills
  WHERE student_id = '40000000-0000-0000-0000-000000000001'
    AND skill_id = '00000000-0000-0000-0001-000000000004';

  v_path := '40000000-0000-0000-0000-000000000001/' || v_claim_id::text || '/gis_cert.pdf';

  -- Simulate trusted server action: upload to private skill-evidence bucket with admin client
  INSERT INTO storage.objects (id, bucket_id, name, owner_id, metadata)
  VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'skill-evidence',
    v_path,
    '40000000-0000-0000-0000-000000000001',
    '{"mimetype": "application/pdf", "size": 1024}'::jsonb
  ) ON CONFLICT (id) DO UPDATE SET metadata = EXCLUDED.metadata, name = EXCLUDED.name;
END;
$$;

-- Switch to Alice context for RPC call
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT register_skill_evidence_pdf(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004'),
       '40000000-0000-0000-0000-000000000001/' || (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004')::text || '/gis_cert.pdf',
       'Certificate in GIS and Spatial Urban Analytics'
     ) $$,
  'Student Alice can register valid PDF evidence document'
);

-- Verify PDF evidence row created with PDF_DOCUMENT and evidence_url NULL
SELECT results_eq(
  $$ SELECT e.evidence_type, e.evidence_url IS NULL
     FROM student_skill_evidence e
     JOIN student_skills s ON s.id = e.student_skill_id
     WHERE s.student_id = '40000000-0000-0000-0000-000000000001'
       AND s.skill_id = '00000000-0000-0000-0001-000000000004' $$,
  $$ VALUES ('PDF_DOCUMENT'::evidence_type, true) $$,
  'PDF evidence is stored with evidence_url NULL'
);

-- Direct RPC abuse: calling with non-existent storage path fails
SELECT throws_ok(
  $$ SELECT register_skill_evidence_pdf(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004'),
       '40000000-0000-0000-0000-000000000001/' || (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004')::text || '/nonexistent.pdf',
       'Non-existent file'
     ) $$,
  'P0001',
  'Evidence file not found in storage bucket skill-evidence',
  'Direct RPC with non-existent storage object is rejected'
);

-- Direct RPC abuse: calling with non-PDF mime type fails
RESET ROLE;
DO $$
DECLARE
  v_claim_id UUID;
  v_img_path TEXT;
BEGIN
  SELECT id INTO v_claim_id FROM student_skills
  WHERE student_id = '40000000-0000-0000-0000-000000000001'
    AND skill_id = '00000000-0000-0000-0001-000000000004';
  v_img_path := '40000000-0000-0000-0000-000000000001/' || v_claim_id::text || '/fake.pdf';

  INSERT INTO storage.objects (id, bucket_id, name, owner_id, metadata)
  VALUES (
    'e0000000-0000-0000-0000-000000000099',
    'skill-evidence',
    v_img_path,
    '40000000-0000-0000-0000-000000000001',
    '{"mimetype": "image/png", "size": 1024}'::jsonb
  ) ON CONFLICT (id) DO UPDATE SET metadata = EXCLUDED.metadata, name = EXCLUDED.name;
END;
$$;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT register_skill_evidence_pdf(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004'),
       '40000000-0000-0000-0000-000000000001/' || (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004')::text || '/fake.pdf',
       'Image pretending to be PDF'
     ) $$,
  'P0001',
  'Evidence file must be application/pdf',
  'Direct RPC with non-application/pdf MIME storage object is rejected'
);

-- Direct RPC abuse: calling with oversized file (> 5 MB) fails
RESET ROLE;
DO $$
DECLARE
  v_claim_id UUID;
  v_big_path TEXT;
BEGIN
  SELECT id INTO v_claim_id FROM student_skills
  WHERE student_id = '40000000-0000-0000-0000-000000000001'
    AND skill_id = '00000000-0000-0000-0001-000000000004';
  v_big_path := '40000000-0000-0000-0000-000000000001/' || v_claim_id::text || '/oversized.pdf';

  INSERT INTO storage.objects (id, bucket_id, name, owner_id, metadata)
  VALUES (
    'e0000000-0000-0000-0000-000000000098',
    'skill-evidence',
    v_big_path,
    '40000000-0000-0000-0000-000000000001',
    '{"mimetype": "application/pdf", "size": 6000000}'::jsonb
  ) ON CONFLICT (id) DO UPDATE SET metadata = EXCLUDED.metadata, name = EXCLUDED.name;
END;
$$;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT register_skill_evidence_pdf(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004'),
       '40000000-0000-0000-0000-000000000001/' || (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004')::text || '/oversized.pdf',
       'Oversized file'
     ) $$,
  'P0001',
  'Evidence file exceeds maximum permitted size of 5 MB',
  'Direct RPC with oversized storage object is rejected'
);

-- Re-register valid PDF with empty description (verifies description optionality)
SELECT lives_ok(
  $$ SELECT register_skill_evidence_pdf(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004'),
       '40000000-0000-0000-0000-000000000001/' || (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004')::text || '/gis_cert.pdf',
       '   '
     ) $$,
  'Empty description in PDF registration is accepted and optional'
);

-- PDF evidence with path outside student folder is rejected
SELECT throws_ok(
  $$ SELECT register_skill_evidence_pdf(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004'),
       '40000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000000/evidence.pdf',
       'Cross student attempt'
     ) $$,
  'P0001',
  'Invalid storage path: PDF evidence must reside in student skill folder and end with .pdf',
  'PDF evidence path outside student folder is rejected'
);

-- PDF evidence not ending in .pdf is rejected
SELECT throws_ok(
  $$ SELECT register_skill_evidence_pdf(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004'),
       '40000000-0000-0000-0000-000000000001/' || (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004')::text || '/malicious.exe',
       'Executable attempt'
     ) $$,
  'P0001',
  'Invalid storage path: PDF evidence must reside in student skill folder and end with .pdf',
  'Non-PDF evidence path is rejected'
);

-- Alice cannot attach evidence to Bob claim
SELECT throws_ok(
  $$ SELECT submit_skill_evidence_link(
       '00000000-0000-0000-0002-000000000002',
       'https://github.com/bob/project',
       'Bob project link'
     ) $$,
  'P0001',
  'Skill claim not found or not owned by caller',
  'Alice cannot attach evidence to Bob claim'
);

-- PDF evidence with path missing skill folder is rejected
SELECT throws_ok(
  $$ SELECT register_skill_evidence_pdf(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004'),
       '40000000-0000-0000-0000-000000000001/evidence_gis.pdf',
       'Missing subfolder'
     ) $$,
  'P0001',
  'Invalid storage path: PDF evidence must reside in student skill folder and end with .pdf',
  'PDF evidence without skill folder is rejected'
);

-- ============================================================================
-- 6. Scoped Staff Review & Verification (12 tests)
-- ============================================================================

-- Coordinator Bob (Scope: BARCH 2026) reviews Alice (BARCH 2026)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Bob can verify Alice in-scope skill claim (Rhino Grasshopper)
DO $$
DECLARE
  v_claim_id UUID;
BEGIN
  SELECT id INTO v_claim_id FROM student_skills
  WHERE student_id = '40000000-0000-0000-0000-000000000001'
    AND skill_id = '00000000-0000-0000-0001-000000000003';

  PERFORM verify_student_skill(v_claim_id);
END;
$$;

-- Verify claim is now VERIFIED, verified_by is Bob, and verified_at is set
SELECT results_eq(
  $$ SELECT verification_status, verified_by
     FROM student_skills
     WHERE student_id = '40000000-0000-0000-0000-000000000001'
       AND skill_id = '00000000-0000-0000-0001-000000000003' $$,
  $$ VALUES ('VERIFIED'::skill_verification_status, '30000000-0000-0000-0000-000000000001'::UUID) $$,
  'Coordinator Bob can verify in-scope student Alice skill claim'
);

-- Alice context for verified claim immutability and archive/reactivation tests
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Alice CANNOT modify proficiency of verified claim
SELECT throws_ok(
  $$ SELECT update_student_skill_proficiency(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000003'),
       4
     ) $$,
  'P0001',
  'Cannot modify proficiency of a verified skill claim',
  'Student cannot modify proficiency of verified skill claim'
);

-- Alice CANNOT submit link evidence on verified claim
SELECT throws_ok(
  $$ SELECT submit_skill_evidence_link(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000003'),
       'https://github.com/alice/hacked',
       'New link'
     ) $$,
  'P0001',
  'Cannot modify evidence for a verified skill claim',
  'Student cannot submit link evidence on verified skill claim'
);

-- Alice CANNOT register PDF evidence on verified claim
SELECT throws_ok(
  $$ SELECT register_skill_evidence_pdf(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000003'),
       '40000000-0000-0000-0000-000000000001/' || (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000003')::text || '/new.pdf',
       'New PDF'
     ) $$,
  'P0001',
  'Cannot modify evidence for a verified skill claim',
  'Student cannot register PDF evidence on verified skill claim'
);

-- Alice archives verified claim
SELECT lives_ok(
  $$ SELECT archive_student_skill(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000003')
     ) $$,
  'Student can archive a verified skill claim'
);

-- Alice CANNOT submit link evidence on archived verified claim
SELECT throws_ok(
  $$ SELECT submit_skill_evidence_link(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000003'),
       'https://github.com/alice/hacked-archived',
       'Archived link'
     ) $$,
  'P0001',
  'Cannot attach evidence to an archived skill claim',
  'Student cannot submit link evidence on archived verified claim'
);

-- Alice CANNOT register PDF evidence on archived verified claim
SELECT throws_ok(
  $$ SELECT register_skill_evidence_pdf(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000003'),
       '40000000-0000-0000-0000-000000000001/' || (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000003')::text || '/archived.pdf',
       'Archived PDF'
     ) $$,
  'P0001',
  'Cannot attach evidence to an archived skill claim',
  'Student cannot register PDF evidence on archived verified claim'
);

-- Alice attempts to reactivate verified claim with changed proficiency (4 != 2) -> REJECTED
SELECT throws_ok(
  $$ SELECT claim_student_skill('00000000-0000-0000-0001-000000000003', 4) $$,
  'P0001',
  'Cannot modify proficiency of a verified skill claim',
  'Reactivating verified claim with changed proficiency is rejected'
);

-- Alice reactivates verified claim with unchanged proficiency (2) -> PRESERVED AS VERIFIED
SELECT results_eq(
  $$ SELECT verification_status, verified_by
     FROM student_skills
     WHERE id = (SELECT (claim_student_skill('00000000-0000-0000-0001-000000000003', 2)->>'student_skill_id')::UUID) $$,
  $$ VALUES ('VERIFIED'::skill_verification_status, '30000000-0000-0000-0000-000000000001'::UUID) $$,
  'Reactivating verified claim with same proficiency preserves VERIFIED status and verifier metadata'
);

-- Reset back to Coordinator Bob context
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Bob rejects Alice second skill claim (GIS Mapping)
DO $$
DECLARE
  v_claim_id UUID;
BEGIN
  SELECT id INTO v_claim_id FROM student_skills
  WHERE student_id = '40000000-0000-0000-0000-000000000001'
    AND skill_id = '00000000-0000-0000-0001-000000000004';

  PERFORM reject_student_skill(v_claim_id, 'Supporting evidence does not demonstrate intermediate GIS proficiency');
END;
$$;

-- Verify claim is now REJECTED
SELECT results_eq(
  $$ SELECT verification_status, verified_by
     FROM student_skills
     WHERE student_id = '40000000-0000-0000-0000-000000000001'
       AND skill_id = '00000000-0000-0000-0001-000000000004' $$,
  $$ VALUES ('REJECTED'::skill_verification_status, '30000000-0000-0000-0000-000000000001'::UUID) $$,
  'Coordinator Bob can reject in-scope student Alice skill claim with reason'
);

-- Coordinator Bob rejects with NULL reason (verifies rejection reason is optional)
RESET ROLE;
INSERT INTO student_skills (id, student_id, skill_id, proficiency_level, verification_status, is_active)
VALUES ('00000000-0000-0000-0002-000000000004', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0001-000000000002', 1, 'PENDING', true);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT reject_student_skill('00000000-0000-0000-0002-000000000004', NULL) $$,
  'Coordinator can reject student claim without providing a reason (optional reason)'
);

-- Rejecting already rejected without resubmission fails
SELECT throws_ok(
  $$ SELECT reject_student_skill(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004'),
       'Rejecting again'
     ) $$,
  'P0001',
  'Skill claim is already rejected',
  'Rejecting already rejected claim fails'
);

-- Student Charlie (MPLAN 2027) claims skill
RESET ROLE;
INSERT INTO student_skills (id, student_id, skill_id, proficiency_level, verification_status, is_active)
VALUES ('00000000-0000-0000-0002-000000000003', '40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0001-000000000001', 3, 'PENDING', true);

-- Coordinator Bob attempts to verify Charlie (OUT OF SCOPE: MPLAN 2027 vs BARCH 2026) -> DENIED
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT verify_student_skill('00000000-0000-0000-0002-000000000003') $$,
  'P0001',
  'Unauthorized: Student is outside assigned coordinator scope',
  'Coordinator cannot verify student claim outside assigned scope'
);

SELECT throws_ok(
  $$ SELECT reject_student_skill('00000000-0000-0000-0002-000000000003', 'Attempt out of scope') $$,
  'P0001',
  'Unauthorized: Student is outside assigned coordinator scope',
  'Coordinator cannot reject student claim outside assigned scope'
);

-- Student cannot verify own claim
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT verify_student_skill(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004')
     ) $$,
  'P0001',
  'Unauthorized: Only authorized staff can verify student skills',
  'Student cannot verify skills'
);

SELECT throws_ok(
  $$ SELECT reject_student_skill(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004'),
       'Self reject'
     ) $$,
  'P0001',
  'Unauthorized: Only authorized staff can reject student skills',
  'Student cannot reject skills'
);

-- Recruiter cannot verify
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT verify_student_skill('00000000-0000-0000-0002-000000000003') $$,
  'P0001',
  'Unauthorized: Only authorized staff can verify student skills',
  'Recruiter cannot verify skills'
);

-- Anonymous cannot verify
RESET ROLE;
SET LOCAL ROLE anon;

SELECT throws_ok(
  $$ SELECT verify_student_skill('00000000-0000-0000-0002-000000000003') $$,
  'P0001',
  'Unauthorized: Only authorized staff can verify student skills',
  'Anonymous cannot verify skills'
);

-- Secretary can verify Charlie claim (Secretary has department-wide scope)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT verify_student_skill('00000000-0000-0000-0002-000000000003') $$,
  'TNP Secretary can verify student claim across any academic program'
);

-- Super Admin can verify verified Bob claim error or verify other claim
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT verify_student_skill('00000000-0000-0000-0002-000000000002') $$,
  'Super Admin can verify student claim across any academic program'
);

-- ============================================================================
-- 7. Resubmission Workflow (REJECTED -> PENDING) (2 tests)
-- ============================================================================

-- Alice resubmits rejected GIS Mapping claim by attaching project link
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

DO $$
DECLARE
  v_claim_id UUID;
BEGIN
  SELECT id INTO v_claim_id FROM student_skills
  WHERE student_id = '40000000-0000-0000-0000-000000000001'
    AND skill_id = '00000000-0000-0000-0001-000000000004';

  PERFORM submit_skill_evidence_link(
    p_student_skill_id => v_claim_id,
    p_evidence_url => 'https://github.com/alice/nagpur-gis-analysis',
    p_description => 'Complete spatial analysis of urban green cover in Nagpur'
  );
END;
$$;

-- Verify status transitioned back to PENDING and verified_by is cleared
SELECT results_eq(
  $$ SELECT verification_status, verified_by
     FROM student_skills
     WHERE student_id = '40000000-0000-0000-0000-000000000001'
       AND skill_id = '00000000-0000-0000-0001-000000000004' $$,
  $$ VALUES ('PENDING'::skill_verification_status, NULL::UUID) $$,
  'Attaching new evidence to REJECTED claim atomically resets status to PENDING'
);

-- Bob rejects it again so Alice can test explicit resubmit_student_skill
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

DO $$
DECLARE
  v_claim_id UUID;
BEGIN
  SELECT id INTO v_claim_id FROM student_skills
  WHERE student_id = '40000000-0000-0000-0000-000000000001'
    AND skill_id = '00000000-0000-0000-0001-000000000004';

  PERFORM reject_student_skill(v_claim_id, 'Please clarify methodology in report');
END;
$$;

-- Alice resubmits explicit resubmit_student_skill
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT resubmit_student_skill(
       (SELECT id FROM student_skills WHERE student_id = '40000000-0000-0000-0000-000000000001' AND skill_id = '00000000-0000-0000-0001-000000000004')
     ) $$,
  'Student can explicitly resubmit rejected skill'
);

-- ============================================================================
-- 8. Storage RLS on skill-evidence bucket (13 tests)
-- ============================================================================

-- Create synthetic objects in skill-evidence matching actual student/claim path
RESET ROLE;
DO $$
DECLARE
  v_gis_claim_id UUID;
  v_gis_path     TEXT;
BEGIN
  SELECT id INTO v_gis_claim_id FROM student_skills
  WHERE student_id = '40000000-0000-0000-0000-000000000001'
    AND skill_id = '00000000-0000-0000-0001-000000000004';

  v_gis_path := '40000000-0000-0000-0000-000000000001/' || v_gis_claim_id::text || '/gis_cert.pdf';

  INSERT INTO storage.objects (id, bucket_id, name, owner_id) VALUES
    ('e0000000-0000-0000-0000-000000000001', 'skill-evidence', v_gis_path, '40000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000002', 'skill-evidence', '40000000-0000-0000-0000-000000000001/orphan_evidence.pdf', '40000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000003', 'skill-evidence', '40000000-0000-0000-0000-000000000003/00000000-0000-0000-0002-000000000003/evidence_charlie.pdf', '40000000-0000-0000-0000-000000000003')
  ON CONFLICT (id) DO NOTHING;

  -- Re-register Alice's PDF to point to this storage object
  DELETE FROM student_skill_evidence WHERE student_skill_id = v_gis_claim_id;
  INSERT INTO student_skill_evidence (student_skill_id, evidence_type, storage_path, description)
  VALUES (v_gis_claim_id, 'PDF_DOCUMENT', v_gis_path, 'GIS Certification');

  -- Register Charlie's evidence
  DELETE FROM student_skill_evidence WHERE student_skill_id = '00000000-0000-0000-0002-000000000003';
  INSERT INTO student_skill_evidence (student_skill_id, evidence_type, storage_path, description)
  VALUES ('00000000-0000-0000-0002-000000000003', 'PDF_DOCUMENT', '40000000-0000-0000-0000-000000000003/00000000-0000-0000-0002-000000000003/evidence_charlie.pdf', 'Charlie portfolio');
END;
$$;

-- Alice context
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Alice CAN select her own registered evidence object
SELECT isnt_empty(
  $$ SELECT name FROM storage.objects
     WHERE bucket_id = 'skill-evidence'
       AND (storage.foldername(name))[1] = '40000000-0000-0000-0000-000000000001' $$,
  'Alice can select her own registered skill evidence storage object'
);

-- Alice CANNOT select Charlie's evidence object
SELECT is_empty(
  $$ SELECT name FROM storage.objects
     WHERE bucket_id = 'skill-evidence'
       AND name = '40000000-0000-0000-0000-000000000003/00000000-0000-0000-0002-000000000003/evidence_charlie.pdf' $$,
  'Alice cannot select other students skill evidence storage objects'
);

-- Alice CANNOT select orphan evidence object
SELECT is_empty(
  $$ SELECT name FROM storage.objects
     WHERE bucket_id = 'skill-evidence'
       AND name = '40000000-0000-0000-0000-000000000001/orphan_evidence.pdf' $$,
  'Student cannot select unregistered orphan storage objects'
);

-- Alice raw storage INSERT is DENIED
SELECT throws_ok(
  $$ INSERT INTO storage.objects (id, bucket_id, name, owner_id)
     VALUES (gen_random_uuid(), 'skill-evidence', '40000000-0000-0000-0000-000000000001/bypass.pdf', '40000000-0000-0000-0000-000000000001') $$,
  '42501',
  NULL,
  'Raw client INSERT to skill-evidence bucket is blocked by RLS'
);

-- Alice raw storage DELETE is DENIED
SELECT throws_ok(
  $$ DELETE FROM storage.objects
     WHERE bucket_id = 'skill-evidence'
       AND (storage.foldername(name))[1] = '40000000-0000-0000-0000-000000000001' $$,
  '42501',
  'Direct deletion from storage tables is not allowed. Use the Storage API instead.',
  'Raw client DELETE on skill-evidence bucket is blocked by storage protection'
);

-- Coordinator Bob context (Scope: BARCH 2026)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Bob CAN select Alice (in-scope) registered evidence
SELECT isnt_empty(
  $$ SELECT name FROM storage.objects
     WHERE bucket_id = 'skill-evidence'
       AND (storage.foldername(name))[1] = '40000000-0000-0000-0000-000000000001' $$,
  'Coordinator Bob can read in-scope student registered skill evidence PDF'
);

-- Bob CANNOT select Charlie (out-of-scope) registered evidence
SELECT is_empty(
  $$ SELECT name FROM storage.objects
     WHERE bucket_id = 'skill-evidence'
       AND name = '40000000-0000-0000-0000-000000000003/00000000-0000-0000-0002-000000000003/evidence_charlie.pdf' $$,
  'Coordinator Bob cannot read out-of-scope student skill evidence PDF'
);

-- Bob CANNOT select orphan evidence
SELECT is_empty(
  $$ SELECT name FROM storage.objects
     WHERE bucket_id = 'skill-evidence'
       AND name = '40000000-0000-0000-0000-000000000001/orphan_evidence.pdf' $$,
  'Coordinator cannot read orphan storage objects'
);

-- Secretary context (can read in-scope and department wide registered evidence)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$ SELECT name FROM storage.objects
     WHERE bucket_id = 'skill-evidence'
       AND name = '40000000-0000-0000-0000-000000000003/00000000-0000-0000-0002-000000000003/evidence_charlie.pdf' $$,
  ARRAY['40000000-0000-0000-0000-000000000003/00000000-0000-0000-0002-000000000003/evidence_charlie.pdf'::text],
  'TNP Secretary can read registered skill evidence across department'
);

-- Secretary CANNOT read orphan evidence
SELECT is_empty(
  $$ SELECT name FROM storage.objects
     WHERE bucket_id = 'skill-evidence'
       AND name = '40000000-0000-0000-0000-000000000001/orphan_evidence.pdf' $$,
  'TNP Secretary cannot read orphan storage objects'
);

-- Recruiter context
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Recruiter CANNOT select any skill evidence storage objects
SELECT is_empty(
  $$ SELECT name FROM storage.objects WHERE bucket_id = 'skill-evidence' $$,
  'Recruiters cannot read private skill-evidence storage objects'
);

-- Recruiter raw INSERT is DENIED
SELECT throws_ok(
  $$ INSERT INTO storage.objects (id, bucket_id, name, owner_id)
     VALUES (gen_random_uuid(), 'skill-evidence', '50000000-0000-0000-0000-000000000001/rec.pdf', '50000000-0000-0000-0000-000000000001') $$,
  '42501',
  NULL,
  'Recruiter raw INSERT to skill-evidence is blocked by RLS'
);

-- Anonymous context
RESET ROLE;
SET LOCAL ROLE anon;

-- Anonymous CANNOT select any skill evidence storage objects
SELECT is_empty(
  $$ SELECT name FROM storage.objects WHERE bucket_id = 'skill-evidence' $$,
  'Anonymous users cannot read private skill-evidence storage objects'
);

-- ============================================================================
-- 9. Verification View (v_staff_skill_reviews) Scoping (4 tests)
-- ============================================================================

-- Coordinator Bob context
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Bob only sees reviews for students in BARCH 2026 (Alice and Bob)
SELECT is_empty(
  $$ SELECT student_id FROM v_staff_skill_reviews
     WHERE student_id = '40000000-0000-0000-0000-000000000003' $$,
  'Coordinator Bob cannot see out-of-scope Charlie reviews in v_staff_skill_reviews'
);

-- Bob sees Alice reviews
SELECT isnt_empty(
  $$ SELECT student_id FROM v_staff_skill_reviews
     WHERE student_id = '40000000-0000-0000-0000-000000000001' $$,
  'Coordinator Bob sees in-scope Alice reviews in v_staff_skill_reviews'
);

-- Super Admin sees all reviews
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT isnt_empty(
  $$ SELECT student_id FROM v_staff_skill_reviews
     WHERE student_id = '40000000-0000-0000-0000-000000000003' $$,
  'Super Admin sees Charlie reviews in v_staff_skill_reviews'
);

-- Recruiter sees zero reviews
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is_empty(
  $$ SELECT student_id FROM v_staff_skill_reviews $$,
  'Recruiters see zero rows in staff skill review queue'
);

-- Student sees zero reviews (security_invoker protects view)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is_empty(
  $$ SELECT student_id FROM v_staff_skill_reviews $$,
  'Students see zero rows in staff skill review queue view'
);

-- Anonymous sees zero reviews
RESET ROLE;
SET LOCAL ROLE anon;

SELECT is_empty(
  $$ SELECT student_id FROM v_staff_skill_reviews $$,
  'Anonymous users see zero rows in staff skill review queue view'
);

-- ============================================================================
-- 10. Audit Logging Verification (2 tests)
-- ============================================================================

RESET ROLE;

SELECT isnt_empty(
  $$ SELECT id FROM audit_logs
     WHERE action = 'SKILL_VERIFIED'
       AND entity_type = 'student_skill' $$,
  'Skill verification logs SKILL_VERIFIED in audit_logs'
);

SELECT isnt_empty(
  $$ SELECT id FROM audit_logs
     WHERE action = 'SKILL_REJECTED'
       AND entity_type = 'student_skill' $$,
  'Skill rejection logs SKILL_REJECTED in audit_logs'
);

-- ============================================================================
-- 11. Skills Independence (Zero Effect on Drives & Completeness) (1 test)
-- ============================================================================

-- Completeness check: Alice profile completeness was 20 and remains unaffected by skills
SELECT results_eq(
  $$ SELECT calculate_student_profile_completeness('40000000-0000-0000-0000-000000000001'::UUID) $$,
  ARRAY[20],
  'Skills claims have zero effect on deterministic profile completeness calculation'
);

SELECT * FROM finish();
ROLLBACK;
