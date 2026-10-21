BEGIN;
SELECT plan(97);

-- ============================================================================
-- Phase 7 — Placement Drives, Eligibility & Recruiter Drive Access Test Suite
-- ============================================================================

-- Fixtures Setup
DO $$
DECLARE
  v_admin_id      UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_sec_id        UUID := '20000000-0000-0000-0000-000000000001'::UUID;
  v_coord_id      UUID := '30000000-0000-0000-0000-000000000001'::UUID;
  v_stud1_id      UUID := '40000000-0000-0000-0000-000000000001'::UUID; -- Alice: BARCH 2026, 8.5 CGPA, 0 backlogs
  v_stud2_id      UUID := '40000000-0000-0000-0000-000000000002'::UUID; -- Bob: MPLAN 2026, 7.5 CGPA, 0 backlogs
  v_stud3_id      UUID := '40000000-0000-0000-0000-000000000003'::UUID; -- Charlie: BARCH 2025, 9.0 CGPA, 0 backlogs
  v_stud4_id      UUID := '40000000-0000-0000-0000-000000000004'::UUID; -- Dave: BARCH 2026, 5.5 CGPA, 3 backlogs
  v_stud5_id      UUID := '40000000-0000-0000-0000-000000000005'::UUID; -- Eve: BARCH 2026, UNVERIFIED
  v_stud6_id      UUID := '40000000-0000-0000-0000-000000000006'::UUID; -- Frank: BARCH 2026, Missing academic record
  v_stud7_id      UUID := '40000000-0000-0000-0000-000000000007'::UUID; -- Grace: BARCH 2026, Lifecycle GRADUATED
  v_stud8_id      UUID := '40000000-0000-0000-0000-000000000008'::UUID; -- Henry: PHD (not placement eligible)
  v_stud9_id      UUID := '40000000-0000-0000-0000-000000000009'::UUID; -- Ivy: BARCH 2026, prior SELECTED on PLACEMENT
  v_stud10_id     UUID := '40000000-0000-0000-0000-000000000010'::UUID; -- Jack: BARCH 2026, prior SELECTED on INTERNSHIP
  v_rec_acme_id   UUID := '50000000-0000-0000-0000-000000000001'::UUID; -- Acme Recruiter (active)
  v_rec_globex_id UUID := '50000000-0000-0000-0000-000000000002'::UUID; -- Globex Recruiter (active)
  v_rec_inact_id  UUID := '50000000-0000-0000-0000-000000000003'::UUID; -- Acme Inactive Recruiter

  v_prog_barch_id UUID;
  v_prog_mplan_id UUID;
  v_prog_phd_id   UUID;

  v_company_acme   UUID := '60000000-0000-0000-0000-000000000001'::UUID;
  v_company_arch   UUID := '60000000-0000-0000-0000-000000000002'::UUID;
  v_company_globex UUID := '60000000-0000-0000-0000-000000000003'::UUID;

  v_contact_acme   UUID := '70000000-0000-0000-0000-000000000001'::UUID;
  v_contact_globex UUID := '70000000-0000-0000-0000-000000000002'::UUID;
  v_contact_inact  UUID := '70000000-0000-0000-0000-000000000003'::UUID;

  v_prior_place_id UUID;
  v_prior_intern_id UUID;
BEGIN
  -- Insert auth.users
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (v_admin_id, 'authenticated', 'authenticated', 'admin@vnit.test'),
    (v_sec_id, 'authenticated', 'authenticated', 'sec@vnit.test'),
    (v_coord_id, 'authenticated', 'authenticated', 'coord@vnit.test'),
    (v_stud1_id, 'authenticated', 'authenticated', 'alice@vnit.test'),
    (v_stud2_id, 'authenticated', 'authenticated', 'bob@vnit.test'),
    (v_stud3_id, 'authenticated', 'authenticated', 'charlie@vnit.test'),
    (v_stud4_id, 'authenticated', 'authenticated', 'dave@vnit.test'),
    (v_stud5_id, 'authenticated', 'authenticated', 'eve@vnit.test'),
    (v_stud6_id, 'authenticated', 'authenticated', 'frank@vnit.test'),
    (v_stud7_id, 'authenticated', 'authenticated', 'grace@vnit.test'),
    (v_stud8_id, 'authenticated', 'authenticated', 'henry@vnit.test'),
    (v_stud9_id, 'authenticated', 'authenticated', 'ivy@vnit.test'),
    (v_stud10_id, 'authenticated', 'authenticated', 'jack@vnit.test'),
    (v_rec_acme_id, 'authenticated', 'authenticated', 'recruiter@acme.test'),
    (v_rec_globex_id, 'authenticated', 'authenticated', 'recruiter@globex.test'),
    (v_rec_inact_id, 'authenticated', 'authenticated', 'inactive@acme.test')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Insert profiles
  INSERT INTO profiles (id, role, display_name, is_active, coordinator_slot, student_lifecycle_status) VALUES
    (v_admin_id, 'SUPER_ADMIN', 'Super Admin', true, NULL, NULL),
    (v_sec_id, 'TNP_SECRETARY', 'Secretary Jane', true, NULL, NULL),
    (v_coord_id, 'TNP_COORDINATOR', 'Coordinator Bob', true, 'SLOT_1', NULL),
    (v_stud1_id, 'STUDENT', 'Alice Architect', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud2_id, 'STUDENT', 'Bob Planner', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud3_id, 'STUDENT', 'Charlie Senior', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud4_id, 'STUDENT', 'Dave Struggling', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud5_id, 'STUDENT', 'Eve Unverified', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud6_id, 'STUDENT', 'Frank NoRecord', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud7_id, 'STUDENT', 'Grace Graduated', true, NULL, 'STUDENT_GRADUATED'),
    (v_stud8_id, 'STUDENT', 'Henry Doctoral', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud9_id, 'STUDENT', 'Ivy Placed', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud10_id, 'STUDENT', 'Jack Interned', true, NULL, 'STUDENT_ACTIVE'),
    (v_rec_acme_id, 'RECRUITER', 'Acme Recruiter', true, NULL, NULL),
    (v_rec_globex_id, 'RECRUITER', 'Globex Recruiter', true, NULL, NULL),
    (v_rec_inact_id, 'RECRUITER', 'Inactive Recruiter', true, NULL, NULL)
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role,
      display_name = EXCLUDED.display_name,
      is_active = EXCLUDED.is_active,
      coordinator_slot = EXCLUDED.coordinator_slot,
      student_lifecycle_status = EXCLUDED.student_lifecycle_status;

  -- Academic Programs lookup
  SELECT id INTO v_prog_barch_id FROM academic_programs WHERE code = 'BARCH';
  SELECT id INTO v_prog_mplan_id FROM academic_programs WHERE code = 'MPLAN';
  SELECT id INTO v_prog_phd_id FROM academic_programs WHERE code = 'PHD';

  -- Student Academic Records
  INSERT INTO academic_records (profile_id, program_id, batch, cgpa, active_backlogs, verification_status, verified_by, verified_at)
  VALUES
    (v_stud1_id, v_prog_barch_id, '2026', 8.50, 0, 'VERIFIED', v_admin_id, now()),
    (v_stud2_id, v_prog_mplan_id, '2026', 7.50, 0, 'VERIFIED', v_admin_id, now()),
    (v_stud3_id, v_prog_barch_id, '2025', 9.00, 0, 'VERIFIED', v_admin_id, now()),
    (v_stud4_id, v_prog_barch_id, '2026', 5.50, 3, 'VERIFIED', v_admin_id, now()),
    (v_stud5_id, v_prog_barch_id, '2026', 8.00, 0, 'UNVERIFIED', NULL, NULL),
    (v_stud7_id, v_prog_barch_id, '2026', 8.80, 0, 'VERIFIED', v_admin_id, now()),
    (v_stud8_id, v_prog_phd_id,   '2026', 8.20, 0, 'VERIFIED', v_admin_id, now()),
    (v_stud9_id, v_prog_barch_id, '2026', 8.50, 0, 'VERIFIED', v_admin_id, now()),
    (v_stud10_id, v_prog_barch_id, '2026', 8.50, 0, 'VERIFIED', v_admin_id, now())
  ON CONFLICT (profile_id) DO UPDATE
  SET program_id = EXCLUDED.program_id,
      batch = EXCLUDED.batch,
      cgpa = EXCLUDED.cgpa,
      active_backlogs = EXCLUDED.active_backlogs,
      verification_status = EXCLUDED.verification_status,
      verified_by = EXCLUDED.verified_by,
      verified_at = EXCLUDED.verified_at;

  -- Companies
  INSERT INTO companies (id, name, website, is_archived, created_by)
  VALUES
    (v_company_acme, 'Acme Architecture Studio', 'https://acme-studio.test', false, v_admin_id),
    (v_company_arch, 'Archived Beta Corp', 'https://beta.test', true, v_admin_id),
    (v_company_globex, 'Globex Planning Associates', 'https://globex-planning.test', false, v_admin_id)
  ON CONFLICT (id) DO UPDATE SET is_archived = EXCLUDED.is_archived;

  -- Recruiter Contacts
  INSERT INTO recruiter_contacts (id, company_id, full_name, email, is_active, created_by)
  VALUES
    (v_contact_acme, v_company_acme, 'Alice Contact', 'recruiter@acme.test', true, v_admin_id),
    (v_contact_globex, v_company_globex, 'Greg Contact', 'recruiter@globex.test', true, v_admin_id),
    (v_contact_inact, v_company_acme, 'Inactive Contact', 'inactive@acme.test', false, v_admin_id)
  ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active;

  -- Recruiter Profiles
  INSERT INTO recruiter_profiles (profile_id, company_id, recruiter_contact_id)
  VALUES
    (v_rec_acme_id, v_company_acme, v_contact_acme),
    (v_rec_globex_id, v_company_globex, v_contact_globex),
    (v_rec_inact_id, v_company_acme, v_contact_inact)
  ON CONFLICT (profile_id) DO UPDATE
  SET company_id = EXCLUDED.company_id,
      recruiter_contact_id = EXCLUDED.recruiter_contact_id;

  -- Prior drives for Ivy (PLACEMENT) and Jack (INTERNSHIP)
  INSERT INTO placement_drives (id, company_id, title, drive_type, status, application_deadline, created_by)
  VALUES
    ('90000000-0000-0000-0000-000000000001'::UUID, v_company_acme, 'Prior Full-Time Drive', 'PLACEMENT', 'DRAFT', now() + interval '30 days', v_admin_id),
    ('90000000-0000-0000-0000-000000000002'::UUID, v_company_acme, 'Prior Summer Internship', 'INTERNSHIP', 'DRAFT', now() + interval '30 days', v_admin_id)
  ON CONFLICT (id) DO NOTHING;

  UPDATE placement_drives
  SET status = 'PUBLISHED', published_by = v_admin_id, published_at = now()
  WHERE id IN ('90000000-0000-0000-0000-000000000001'::UUID, '90000000-0000-0000-0000-000000000002'::UUID);

  -- Selected applications for Ivy and Jack
  INSERT INTO applications (drive_id, student_id, status)
  VALUES
    ('90000000-0000-0000-0000-000000000001'::UUID, v_stud9_id, 'SELECTED'),
    ('90000000-0000-0000-0000-000000000002'::UUID, v_stud10_id, 'SELECTED')
  ON CONFLICT (drive_id, student_id) DO NOTHING;

  -- Seed skill and student skill for Alice (Student 1) to test non-interference
  INSERT INTO skills (name, category, is_active, created_by)
  VALUES ('Autodesk Revit BIM', 'TECHNICAL', true, v_admin_id)
  ON CONFLICT (name) DO NOTHING;

  INSERT INTO student_skills (student_id, skill_id, proficiency_level, verification_status, verified_by, verified_at)
  VALUES (
    v_stud1_id,
    (SELECT id FROM skills WHERE name = 'Autodesk Revit BIM'),
    4,
    'VERIFIED',
    v_admin_id,
    now()
  )
  ON CONFLICT DO NOTHING;

END;
$$;

-- ============================================================================
-- Section 1: Drive Creation & Draft Updating (Staff Authorization) (12 tests)
-- ============================================================================

-- 1. Coordinator can create DRAFT drive
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT create_placement_drive(
      (SELECT id FROM companies WHERE name = 'Acme Architecture Studio'),
      'Senior Architect Campus Drive 2026',
      'PLACEMENT'::drive_type,
      'Full time campus placement drive',
      'Nagpur / Hybrid',
      now() + interval '30 days',
      12.50,
      NULL,
      '12.5 LPA CTC fixed',
      'Requires B.Arch 2026 graduate'
    )
  $$,
  'Coordinator can create DRAFT drive'
);

-- 2. Secretary can create DRAFT drive
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT create_placement_drive(
      (SELECT id FROM companies WHERE name = 'Acme Architecture Studio'),
      'Urban Designer Internship 2026',
      'INTERNSHIP'::drive_type,
      'Summer internship drive',
      'Mumbai',
      now() + interval '20 days',
      NULL,
      40000.00,
      '40k per month stipend',
      'Requires portfolio'
    )
  $$,
  'Secretary can create DRAFT drive'
);

-- 3. Super Admin can create DRAFT drive
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT create_placement_drive(
      (SELECT id FROM companies WHERE name = 'Globex Planning Associates'),
      'Globex Urban Planner Placement',
      'PLACEMENT'::drive_type,
      'Full time role',
      'Pune',
      now() + interval '15 days',
      10.00,
      NULL,
      '10 LPA CTC',
      NULL
    )
  $$,
  'Super Admin can create DRAFT drive'
);

-- 4. Student CANNOT create drive
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT create_placement_drive(
      (SELECT id FROM companies WHERE name = 'Acme Architecture Studio'),
      'Malicious Student Drive',
      'PLACEMENT'::drive_type
    )
  $$,
  'Unauthorized: Only active staff can create placement drives',
  'Student CANNOT create placement drive'
);

-- 5. Recruiter CANNOT create drive
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT create_placement_drive(
      (SELECT id FROM companies WHERE name = 'Acme Architecture Studio'),
      'Recruiter Self Drive',
      'PLACEMENT'::drive_type
    )
  $$,
  'Unauthorized: Only active staff can create placement drives',
  'Recruiter CANNOT create placement drive'
);

-- 6. Anonymous CANNOT create drive
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$
    SELECT create_placement_drive(
      (SELECT id FROM companies WHERE name = 'Acme Architecture Studio'),
      'Anon Drive',
      'PLACEMENT'::drive_type
    )
  $$,
  '42501',
  NULL,
  'Anonymous CANNOT create placement drive'
);

-- 7. Cannot create drive for archived company
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT create_placement_drive(
      (SELECT id FROM companies WHERE name = 'Archived Beta Corp'),
      'Drive for Archived Company',
      'PLACEMENT'::drive_type
    )
  $$,
  'Cannot create placement drive for an archived company',
  'Cannot create drive for archived company'
);

-- 8. Empty drive title rejected
SELECT throws_ok(
  $$
    SELECT create_placement_drive(
      (SELECT id FROM companies WHERE name = 'Acme Architecture Studio'),
      '   ',
      'PLACEMENT'::drive_type
    )
  $$,
  'Drive title cannot be empty',
  'Empty drive title rejected'
);

-- 9. Negative package LPA rejected
SELECT throws_ok(
  $$
    SELECT create_placement_drive(
      (SELECT id FROM companies WHERE name = 'Acme Architecture Studio'),
      'Negative Package Drive',
      'PLACEMENT'::drive_type,
      NULL, NULL, NULL, -5.00
    )
  $$,
  'Package LPA must be between 0 and 9999.99',
  'Negative package LPA rejected'
);

-- 10. Coordinator can update DRAFT drive
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT update_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026'),
      'Senior Architect Campus Drive 2026 (Updated)',
      'Updated description for architecture students',
      'Nagpur HQ',
      now() + interval '25 days',
      13.00,
      NULL,
      '13 LPA CTC fixed',
      'Updated requirements'
    )
  $$,
  'Coordinator can update DRAFT drive'
);

-- 11. Student CANNOT update DRAFT drive
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT update_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      'Hacked Title'
    )
  $$,
  'Unauthorized: Only active staff can update placement drives',
  'Student CANNOT update DRAFT drive'
);

-- 12. Recruiter CANNOT update DRAFT drive
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT update_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      'Recruiter Edited Title'
    )
  $$,
  'Unauthorized: Only active staff can update placement drives',
  'Recruiter CANNOT update DRAFT drive'
);

-- ============================================================================
-- Section 2: Criteria & Batch Configuration (9 tests)
-- ============================================================================

-- 13. Coordinator can configure eligibility criteria on DRAFT drive
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT configure_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      7.00,
      1,
      true,
      'Minimum 7.0 CGPA, max 1 active backlog'
    )
  $$,
  'Coordinator can configure eligibility criteria on DRAFT drive'
);

-- 14. Invalid CGPA (> 10.00) rejected
SELECT throws_ok(
  $$
    SELECT configure_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      11.00,
      0,
      true
    )
  $$,
  'Minimum CGPA must be between 0.00 and 10.00',
  'CGPA > 10.00 rejected'
);

-- 15. Negative backlogs limit rejected
SELECT throws_ok(
  $$
    SELECT configure_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      6.00,
      -1,
      true
    )
  $$,
  'Maximum active backlogs cannot be negative',
  'Negative backlogs limit rejected'
);

-- 16. Coordinator can configure eligible batches on DRAFT drive
SELECT lives_ok(
  $$
    SELECT configure_drive_eligible_batches(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      jsonb_build_array(
        jsonb_build_object(
          'program_id', (SELECT id FROM academic_programs WHERE code = 'BARCH'),
          'batch', '2026'
        )
      )
    )
  $$,
  'Coordinator can configure eligible batches on DRAFT drive'
);

-- 17. Invalid batch JSON format (not an array) rejected
SELECT throws_ok(
  $$
    SELECT configure_drive_eligible_batches(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      '{"program_id": "bad"}'::jsonb
    )
  $$,
  'p_batches must be a JSON array of program_id and batch objects',
  'Non-array batch JSON rejected'
);

-- 18. Student CANNOT configure eligibility criteria
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT configure_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      0.00, 10, false
    )
  $$,
  'Unauthorized: Only active staff can configure drive eligibility',
  'Student CANNOT configure eligibility criteria'
);

-- 19. Student CANNOT configure eligible batches
SELECT throws_ok(
  $$
    SELECT configure_drive_eligible_batches(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      jsonb_build_array()
    )
  $$,
  'Unauthorized: Only active staff can configure eligible batches',
  'Student CANNOT configure eligible batches'
);

-- 20. Recruiter CANNOT configure eligibility criteria
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT configure_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      5.00, 0, true
    )
  $$,
  'Unauthorized: Only active staff can configure drive eligibility',
  'Recruiter CANNOT configure eligibility criteria'
);

-- 21. Recruiter CANNOT configure eligible batches
SELECT throws_ok(
  $$
    SELECT configure_drive_eligible_batches(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      jsonb_build_array()
    )
  $$,
  'Unauthorized: Only active staff can configure eligible batches',
  'Recruiter CANNOT configure eligible batches'
);

-- ============================================================================
-- Section 3: Drive Lifecycle Transitions & Role Permissions (28 tests)
-- ============================================================================

-- 22. Coordinator CANNOT publish drive
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT publish_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  'Unauthorized: Only Super Admin or TNP Secretary can publish placement drives',
  'Coordinator CANNOT publish drive'
);

-- 23. Student CANNOT publish drive
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT publish_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  'Unauthorized: Only Super Admin or TNP Secretary can publish placement drives',
  'Student CANNOT publish drive'
);

-- 24. Recruiter CANNOT publish drive
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT publish_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  'Unauthorized: Only Super Admin or TNP Secretary can publish placement drives',
  'Recruiter CANNOT publish drive'
);

-- Setup test drive with 0 batches to verify batch check
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT create_placement_drive(
  (SELECT id FROM companies WHERE name = 'Globex Planning Associates'),
  'Incomplete Draft Drive',
  'PLACEMENT'::drive_type,
  NULL, NULL, now() + interval '10 days'
);

-- 25. Cannot publish drive with 0 eligible batches
SELECT throws_ok(
  $$
    SELECT publish_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Incomplete Draft Drive')
    )
  $$,
  'Cannot publish drive: at least one eligible program and batch must be configured',
  'Cannot publish drive with 0 eligible batches'
);

-- Setup test drive with past deadline
SELECT create_placement_drive(
  (SELECT id FROM companies WHERE name = 'Globex Planning Associates'),
  'Past Deadline Draft Drive',
  'PLACEMENT'::drive_type,
  NULL, NULL, now() - interval '2 days'
);

-- 26. Cannot publish drive with past deadline
SELECT throws_ok(
  $$
    SELECT publish_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Past Deadline Draft Drive')
    )
  $$,
  'Cannot publish drive: application deadline must be in the future',
  'Cannot publish drive with past deadline'
);

-- Setup test drive with NULL deadline
SELECT create_placement_drive(
  (SELECT id FROM companies WHERE name = 'Globex Planning Associates'),
  'No Deadline Draft Drive',
  'PLACEMENT'::drive_type,
  NULL, NULL, NULL
);

-- 27. Cannot publish drive with NULL deadline
SELECT throws_ok(
  $$
    SELECT publish_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'No Deadline Draft Drive')
    )
  $$,
  'Cannot publish drive: application deadline is required',
  'Cannot publish drive with NULL deadline'
);

-- 28. Secretary CAN publish valid drive
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT publish_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  'Secretary CAN publish valid drive'
);

-- 29. Published drive has status = PUBLISHED and published_by/published_at populated
SELECT results_eq(
  $$
    SELECT status, (published_by = '20000000-0000-0000-0000-000000000001'::UUID), (published_at IS NOT NULL)
    FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'
  $$,
  $$ VALUES ('PUBLISHED'::drive_status, true, true) $$,
  'Published drive status and publisher metadata are set'
);

-- 30. Post-publish freeze: configure_drive_eligibility rejects PUBLISHED drive
SELECT throws_ok(
  $$
    SELECT configure_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      6.50, 0, true
    )
  $$,
  'Cannot configure eligibility: drive status is PUBLISHED, only DRAFT drives can be configured',
  'Post-publish freeze: criteria modification rejected'
);

-- 31. Post-publish freeze: configure_drive_eligible_batches rejects PUBLISHED drive
SELECT throws_ok(
  $$
    SELECT configure_drive_eligible_batches(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      jsonb_build_array()
    )
  $$,
  'Cannot configure eligible batches: drive status is PUBLISHED, only DRAFT drives can be configured',
  'Post-publish freeze: batch modification rejected'
);

-- 32. Post-publish freeze: update_placement_drive rejects PUBLISHED drive
SELECT throws_ok(
  $$
    SELECT update_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      'New Title After Publish'
    )
  $$,
  'Cannot update drive: drive status is PUBLISHED, only DRAFT drives can be edited',
  'Post-publish freeze: detail editing rejected'
);

-- 33. Direct table UPDATE on placement_drives is blocked
SELECT throws_ok(
  $$
    UPDATE placement_drives
    SET title = 'Direct SQL injection title'
    WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'
  $$,
  '42501',
  NULL,
  'Direct table UPDATE on placement_drives blocked by lack of privilege'
);

-- 34. Direct table UPDATE on drive_eligibility is blocked
SELECT throws_ok(
  $$
    UPDATE drive_eligibility
    SET minimum_cgpa = 0.00
    WHERE drive_id = (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
  $$,
  '42501',
  NULL,
  'Direct table UPDATE on drive_eligibility blocked by lack of privilege'
);

-- 35. Direct table UPDATE on drive_eligible_batches is blocked
SELECT throws_ok(
  $$
    UPDATE drive_eligible_batches
    SET batch = 2099
    WHERE drive_id = (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
  $$,
  '42501',
  NULL,
  'Direct table UPDATE on drive_eligible_batches blocked by lack of privilege'
);

-- 36. Coordinator CANNOT close drive
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT close_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  'Unauthorized: Only Super Admin or TNP Secretary can close placement drives',
  'Coordinator CANNOT close drive'
);

-- 37. Student CANNOT close drive
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT close_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  'Unauthorized: Only Super Admin or TNP Secretary can close placement drives',
  'Student CANNOT close drive'
);

-- 38. Recruiter CANNOT close drive
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT close_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  'Unauthorized: Only Super Admin or TNP Secretary can close placement drives',
  'Recruiter CANNOT close drive'
);

-- Create and publish a separate drive for testing close and archive
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

DO $$
DECLARE
  v_d_id UUID;
BEGIN
  SELECT (create_placement_drive(
    (SELECT id FROM companies WHERE name = 'Globex Planning Associates'),
    'Globex Lifecycle Test Drive',
    'PLACEMENT'::drive_type,
    NULL, NULL, now() + interval '10 days'
  )->>'drive_id')::UUID INTO v_d_id;

  PERFORM configure_drive_eligible_batches(
    v_d_id,
    jsonb_build_array(
      jsonb_build_object(
        'program_id', (SELECT id FROM academic_programs WHERE code = 'BARCH'),
        'batch', '2026'
      )
    )
  );

  PERFORM publish_placement_drive(v_d_id);
END;
$$;

-- 39. Super Admin CAN close PUBLISHED drive
SELECT lives_ok(
  $$
    SELECT close_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Globex Lifecycle Test Drive')
    )
  $$,
  'Super Admin CAN close PUBLISHED drive'
);

-- 40. Closed drive status is CLOSED and closed_by/closed_at populated
SELECT results_eq(
  $$
    SELECT status, (closed_by = '00000000-0000-0000-0000-000000000001'::UUID), (closed_at IS NOT NULL)
    FROM placement_drives WHERE title = 'Globex Lifecycle Test Drive'
  $$,
  $$ VALUES ('CLOSED'::drive_status, true, true) $$,
  'Closed drive status and closer metadata are set'
);

-- 41. Invalid FSM: Cannot publish a CLOSED drive
SELECT throws_ok(
  $$
    SELECT publish_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Globex Lifecycle Test Drive')
    )
  $$,
  'Cannot publish drive: current status is CLOSED, expected DRAFT',
  'Cannot publish CLOSED drive'
);

-- 42. Coordinator CANNOT archive drive
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT archive_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Globex Lifecycle Test Drive')
    )
  $$,
  'Unauthorized: Only Super Admin or TNP Secretary can archive placement drives',
  'Coordinator CANNOT archive drive'
);

-- 43. Student CANNOT archive drive
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT archive_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Globex Lifecycle Test Drive')
    )
  $$,
  'Unauthorized: Only Super Admin or TNP Secretary can archive placement drives',
  'Student CANNOT archive drive'
);

-- 44. Recruiter CANNOT archive drive
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT archive_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Globex Lifecycle Test Drive')
    )
  $$,
  'Unauthorized: Only Super Admin or TNP Secretary can archive placement drives',
  'Recruiter CANNOT archive drive'
);

-- 45. TNP Secretary CAN archive CLOSED drive
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT archive_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Globex Lifecycle Test Drive')
    )
  $$,
  'TNP Secretary CAN archive CLOSED drive'
);

-- 46. Archived drive status is ARCHIVED and archived_by/archived_at populated
SELECT results_eq(
  $$
    SELECT status, (archived_by = '20000000-0000-0000-0000-000000000001'::UUID), (archived_at IS NOT NULL)
    FROM placement_drives WHERE title = 'Globex Lifecycle Test Drive'
  $$,
  $$ VALUES ('ARCHIVED'::drive_status, true, true) $$,
  'Archived drive status and archiver metadata are set'
);

-- 47. Terminal state: cannot close an ARCHIVED drive
SELECT throws_ok(
  $$
    SELECT close_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Globex Lifecycle Test Drive')
    )
  $$,
  'Cannot close drive: current status is ARCHIVED, expected PUBLISHED',
  'Terminal state: cannot close ARCHIVED drive'
);

-- 48. Terminal state: cannot update an ARCHIVED drive
SELECT throws_ok(
  $$
    SELECT update_placement_drive(
      (SELECT id FROM placement_drives WHERE title = 'Globex Lifecycle Test Drive'),
      'Attempt to edit archived drive'
    )
  $$,
  'Cannot update drive: drive status is ARCHIVED, only DRAFT drives can be edited',
  'Terminal state: cannot edit ARCHIVED drive'
);

-- 49. Cannot delete placement_drive
SELECT throws_ok(
  $$
    DELETE FROM placement_drives WHERE title = 'Globex Lifecycle Test Drive'
  $$,
  '42501',
  NULL,
  'Direct DELETE on placement_drives blocked by lack of privilege'
);

-- ============================================================================
-- Section 4: Authoritative Eligibility Engine Evaluation (15 tests)
-- ============================================================================

-- 50. Private evaluator _evaluate_eligibility_for_student is BLOCKED for student
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT * FROM _evaluate_eligibility_for_student(
      '40000000-0000-0000-0000-000000000001'::UUID,
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  '42501',
  NULL,
  'Private evaluator _evaluate_eligibility_for_student EXECUTE blocked for student'
);

-- 51. Private evaluator _evaluate_eligibility_for_student is BLOCKED for recruiter
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT * FROM _evaluate_eligibility_for_student(
      '40000000-0000-0000-0000-000000000001'::UUID,
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  '42501',
  NULL,
  'Private evaluator _evaluate_eligibility_for_student EXECUTE blocked for recruiter'
);

-- 52. Student 1 (Alice: BARCH 2026, 8.5 CGPA, 0 backlogs): PASS, ELIGIBLE
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT academic_result, is_available, reason_codes
    FROM get_my_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  $$ VALUES ('PASS', true, ARRAY[]::TEXT[]) $$,
  'Student 1 (Alice) evaluates PASS with empty reason_codes'
);

-- 53. Student 2 (Bob: MPLAN 2026, wrong program): FAIL, COURSE_NOT_ELIGIBLE
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000002';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000002", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT academic_result, ('COURSE_NOT_ELIGIBLE' = ANY(reason_codes))
    FROM get_my_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  $$ VALUES ('FAIL', true) $$,
  'Student 2 (Bob) evaluates FAIL, COURSE_NOT_ELIGIBLE'
);

-- 54. Student 3 (Charlie: BARCH 2025, wrong batch): FAIL, BATCH_NOT_ELIGIBLE
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000003';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT academic_result, ('BATCH_NOT_ELIGIBLE' = ANY(reason_codes))
    FROM get_my_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  $$ VALUES ('FAIL', true) $$,
  'Student 3 (Charlie) evaluates FAIL, BATCH_NOT_ELIGIBLE'
);

-- 55. Student 4 (Dave: BARCH 2026, 5.5 CGPA, 3 backlogs): FAIL, CGPA_BELOW_MINIMUM & ACTIVE_BACKLOG_LIMIT_EXCEEDED
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000004", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT academic_result,
           ('CGPA_BELOW_MINIMUM' = ANY(reason_codes)),
           ('ACTIVE_BACKLOG_LIMIT_EXCEEDED' = ANY(reason_codes))
    FROM get_my_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  $$ VALUES ('FAIL', true, true) $$,
  'Student 4 (Dave) evaluates FAIL, CGPA_BELOW_MINIMUM & ACTIVE_BACKLOG_LIMIT_EXCEEDED'
);

-- 56. Student 5 (Eve: BARCH 2026, unverified academic record): UNDETERMINED, ACADEMIC_UNVERIFIED
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000005';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000005", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT academic_result, ('ACADEMIC_UNVERIFIED' = ANY(reason_codes))
    FROM get_my_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  $$ VALUES ('UNDETERMINED', true) $$,
  'Student 5 (Eve) evaluates UNDETERMINED, ACADEMIC_UNVERIFIED'
);

-- 57. Student 6 (Frank: BARCH 2026, missing academic record): UNDETERMINED, ACADEMIC_DATA_UNAVAILABLE
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000006';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000006", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT academic_result, ('ACADEMIC_DATA_UNAVAILABLE' = ANY(reason_codes))
    FROM get_my_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  $$ VALUES ('UNDETERMINED', true) $$,
  'Student 6 (Frank) evaluates UNDETERMINED, ACADEMIC_DATA_UNAVAILABLE'
);

-- 58. Student 7 (Grace: Graduated lifecycle): UNDETERMINED, NOT_A_STUDENT
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000007';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000007", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT academic_result, ('NOT_A_STUDENT' = ANY(reason_codes))
    FROM get_my_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  $$ VALUES ('UNDETERMINED', true) $$,
  'Student 7 (Grace) evaluates UNDETERMINED, NOT_A_STUDENT'
);

-- 59. Student 8 (Henry: PHD program, placement_eligible = false): FAIL, COURSE_NOT_ELIGIBLE
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000008';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000008", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT academic_result, ('COURSE_NOT_ELIGIBLE' = ANY(reason_codes))
    FROM get_my_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  $$ VALUES ('FAIL', true) $$,
  'Student 8 (Henry) evaluates FAIL, COURSE_NOT_ELIGIBLE'
);

-- 60. Student 9 (Ivy: Prior SELECTED on PLACEMENT drive with exclude flag): FAIL, PREVIOUSLY_SELECTED_PLACEMENT
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000009';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000009", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT academic_result, ('PREVIOUSLY_SELECTED_PLACEMENT' = ANY(reason_codes))
    FROM get_my_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  $$ VALUES ('FAIL', true) $$,
  'Student 9 (Ivy) evaluates FAIL, PREVIOUSLY_SELECTED_PLACEMENT'
);

-- 61. Student 10 (Jack: Prior SELECTED on INTERNSHIP drive with exclude flag): PASS, ELIGIBLE
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000010';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000010", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT academic_result, reason_codes
    FROM get_my_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  $$ VALUES ('PASS', ARRAY[]::TEXT[]) $$,
  'Student 10 (Jack) evaluates PASS with empty reason_codes (prior INTERNSHIP does not exclude)'
);

-- 62. Skills and resumes do NOT affect eligibility evaluation (Alice has verified skill and evidence)
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT academic_result, reason_codes
    FROM get_my_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
    )
  $$,
  $$ VALUES ('PASS', ARRAY[]::TEXT[]) $$,
  'Alice with skills/evidence evaluates identically PASS with empty reason_codes'
);

-- 63. Drive with past deadline: is_available = false and reason_codes includes DEADLINE_PASSED
-- Create a published drive with past deadline in database
RESET ROLE;
DO $$
DECLARE
  v_d_id UUID;
BEGIN
  INSERT INTO placement_drives (
    id, company_id, title, drive_type, status, application_deadline, created_by
  ) VALUES (
    '80000000-0000-0000-0000-000000000001'::UUID,
    (SELECT id FROM companies WHERE name = 'Acme Architecture Studio'),
    'Expired Deadline Published Drive',
    'PLACEMENT',
    'DRAFT',
    now() - interval '1 hour',
    '00000000-0000-0000-0000-000000000001'::UUID
  ) ON CONFLICT (id) DO NOTHING;

  UPDATE placement_drives
  SET status = 'PUBLISHED',
      published_by = '00000000-0000-0000-0000-000000000001'::UUID,
      published_at = now() - interval '2 days'
  WHERE id = '80000000-0000-0000-0000-000000000001'::UUID;

  INSERT INTO drive_eligibility (drive_id, minimum_cgpa, maximum_active_backlogs)
  VALUES ('80000000-0000-0000-0000-000000000001'::UUID, 6.00, 0)
  ON CONFLICT (drive_id) DO NOTHING;

  INSERT INTO drive_eligible_batches (drive_id, program_id, batch)
  VALUES (
    '80000000-0000-0000-0000-000000000001'::UUID,
    (SELECT id FROM academic_programs WHERE code = 'BARCH'),
    '2026'
  ) ON CONFLICT (drive_id, program_id, batch) DO NOTHING;
END;
$$;

SELECT results_eq(
  $$
    SELECT is_available, ('DEADLINE_PASSED' = ANY(reason_codes))
    FROM get_my_drive_eligibility('80000000-0000-0000-0000-000000000001'::UUID)
  $$,
  $$ VALUES (false, true) $$,
  'Drive with past deadline evaluates is_available = false and includes DEADLINE_PASSED'
);

-- 64. Unauthenticated call to get_my_drive_eligibility is blocked
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$
    SELECT * FROM get_my_drive_eligibility('80000000-0000-0000-0000-000000000001'::UUID)
  $$,
  '42501',
  NULL,
  'Unauthenticated eligibility query blocked by lack of privilege'
);

-- ============================================================================
-- Section 5: Student & Recruiter Drive Visibility & Confidentiality (32 tests)
-- ============================================================================

-- 65. Student sees PUBLISHED drive in v_student_published_drives
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT title FROM v_student_published_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'
  $$,
  $$ VALUES ('Senior Architect Campus Drive 2026 (Updated)') $$,
  'Student sees PUBLISHED drive in v_student_published_drives'
);

-- 66. Student sees ZERO draft drives in v_student_published_drives
SELECT is_empty(
  $$
    SELECT * FROM v_student_published_drives WHERE status = 'DRAFT'
  $$,
  'Student sees ZERO DRAFT drives in v_student_published_drives'
);

-- 67. Student sees ZERO closed drives in v_student_published_drives
SELECT is_empty(
  $$
    SELECT * FROM v_student_published_drives WHERE status = 'CLOSED'
  $$,
  'Student sees ZERO CLOSED drives in v_student_published_drives'
);

-- 68. Student sees ZERO archived drives in v_student_published_drives
SELECT is_empty(
  $$
    SELECT * FROM v_student_published_drives WHERE status = 'ARCHIVED'
  $$,
  'Student sees ZERO ARCHIVED drives in v_student_published_drives'
);

-- 69. Student direct SELECT on recruiter_drive_access returns 0 rows
SELECT is_empty(
  $$
    SELECT * FROM recruiter_drive_access
  $$,
  'Student SELECT on recruiter_drive_access returns 0 rows'
);

-- 70. Recruiter with NO grant sees ZERO drives in v_recruiter_granted_drives
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is_empty(
  $$
    SELECT * FROM v_recruiter_granted_drives
  $$,
  'Recruiter with NO grant sees ZERO drives in v_recruiter_granted_drives'
);

-- 71. Recruiter direct SELECT on placement_drives returns ZERO rows
SELECT is_empty(
  $$
    SELECT * FROM placement_drives
  $$,
  'Recruiter with NO grant direct SELECT on placement_drives returns 0 rows'
);

-- 72. Coordinator CANNOT grant recruiter drive access
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT grant_recruiter_drive_access(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      (SELECT id FROM recruiter_profiles WHERE profile_id = '50000000-0000-0000-0000-000000000001'::UUID)
    )
  $$,
  'Unauthorized: Only Super Admin or TNP Secretary can grant recruiter drive access',
  'Coordinator CANNOT grant recruiter drive access'
);

-- 73. Student CANNOT grant recruiter drive access
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT grant_recruiter_drive_access(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      (SELECT id FROM recruiter_profiles WHERE profile_id = '50000000-0000-0000-0000-000000000001'::UUID)
    )
  $$,
  'Unauthorized: Only Super Admin or TNP Secretary can grant recruiter drive access',
  'Student CANNOT grant recruiter drive access'
);

-- 74. Recruiter CANNOT grant recruiter drive access
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT grant_recruiter_drive_access(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      (SELECT id FROM recruiter_profiles WHERE profile_id = '50000000-0000-0000-0000-000000000001'::UUID)
    )
  $$,
  'Unauthorized: Only Super Admin or TNP Secretary can grant recruiter drive access',
  'Recruiter CANNOT grant recruiter drive access'
);

-- 75. Grant access succeeds for active recruiter regardless of company (architecture does not restrict company)
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT grant_recruiter_drive_access(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'), -- Acme Drive
      (SELECT id FROM recruiter_profiles WHERE profile_id = '50000000-0000-0000-0000-000000000002'::UUID)  -- Globex Recruiter
    )
  $$,
  'Grant access succeeds for active recruiter regardless of company'
);

-- 76. Grant access fails if recruiter contact is inactive
SELECT throws_ok(
  $$
    SELECT grant_recruiter_drive_access(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      (SELECT id FROM recruiter_profiles WHERE profile_id = '50000000-0000-0000-0000-000000000003'::UUID)  -- Inactive Contact Recruiter
    )
  $$,
  'Cannot grant access: recruiter contact is inactive or not found',
  'Grant access fails if recruiter contact is inactive'
);

-- 77. Grant access fails if past expires_at is provided
SELECT throws_ok(
  $$
    SELECT grant_recruiter_drive_access(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      (SELECT id FROM recruiter_profiles WHERE profile_id = '50000000-0000-0000-0000-000000000001'::UUID),
      now() - interval '1 hour'
    )
  $$,
  'Grant expiry timestamp must be in the future',
  'Grant access fails if past expires_at is provided'
);

-- 78. Super Admin CAN grant drive access to matching Acme recruiter
SELECT lives_ok(
  $$
    SELECT grant_recruiter_drive_access(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      (SELECT id FROM recruiter_profiles WHERE profile_id = '50000000-0000-0000-0000-000000000001'::UUID),
      now() + interval '60 days'
    )
  $$,
  'Super Admin CAN grant drive access to matching Acme recruiter'
);

-- 79. Recruiter with active grant sees granted published drive in v_recruiter_granted_drives
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT title, company_name FROM v_recruiter_granted_drives
  $$,
  $$ VALUES ('Senior Architect Campus Drive 2026 (Updated)', 'Acme Architecture Studio') $$,
  'Recruiter with active grant sees granted published drive in v_recruiter_granted_drives'
);

-- 80. Recruiter sees ZERO other company drives
SELECT is_empty(
  $$
    SELECT * FROM v_recruiter_granted_drives WHERE company_name != 'Acme Architecture Studio'
  $$,
  'Recruiter sees ZERO other company drives'
);

-- 81. Recruiter cannot see draft/closed/archived drives even if grant row exists
-- Create grant on closed drive directly for testing
RESET ROLE;
DO $$
DECLARE
  v_closed_id UUID;
  v_rec_id    UUID;
BEGIN
  SELECT id INTO v_closed_id FROM placement_drives WHERE title = 'Globex Lifecycle Test Drive';
  SELECT id INTO v_rec_id FROM recruiter_profiles WHERE profile_id = '50000000-0000-0000-0000-000000000002'::UUID;

  INSERT INTO recruiter_drive_access (recruiter_profile_id, drive_id, granted_by, granted_at)
  VALUES (v_rec_id, v_closed_id, '00000000-0000-0000-0000-000000000001'::UUID, now())
  ON CONFLICT DO NOTHING;
END;
$$;

-- Switch to Globex Recruiter
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000002';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000002", "role": "authenticated"}';

SELECT is_empty(
  $$
    SELECT * FROM v_recruiter_granted_drives WHERE title = 'Globex Lifecycle Test Drive'
  $$,
  'Recruiter cannot see ARCHIVED/CLOSED drive even if access row exists'
);

-- 82. Coordinator CANNOT revoke recruiter drive access
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT revoke_recruiter_drive_access(
      (SELECT id FROM recruiter_drive_access
       WHERE drive_id = (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
         AND recruiter_profile_id = (SELECT id FROM recruiter_profiles WHERE profile_id = '50000000-0000-0000-0000-000000000001'::UUID))
    )
  $$,
  'Unauthorized: Only Super Admin or TNP Secretary can revoke recruiter drive access',
  'Coordinator CANNOT revoke recruiter drive access'
);

-- 83. Secretary CAN revoke recruiter drive access
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT revoke_recruiter_drive_access(
      (SELECT id FROM recruiter_drive_access
       WHERE drive_id = (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)')
         AND recruiter_profile_id = (SELECT id FROM recruiter_profiles WHERE profile_id = '50000000-0000-0000-0000-000000000001'::UUID))
    )
  $$,
  'Secretary CAN revoke recruiter drive access'
);

-- 84. After revocation, recruiter sees ZERO drives in v_recruiter_granted_drives
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is_empty(
  $$
    SELECT * FROM v_recruiter_granted_drives
  $$,
  'After revocation, recruiter sees ZERO drives in v_recruiter_granted_drives'
);

-- 85. Re-granting access un-revokes and restores visibility
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT grant_recruiter_drive_access(
      (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)'),
      (SELECT id FROM recruiter_profiles WHERE profile_id = '50000000-0000-0000-0000-000000000001'::UUID),
      now() + interval '60 days'
    )
  $$,
  'Re-granting access succeeds'
);

SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT title FROM v_recruiter_granted_drives
  $$,
  $$ VALUES ('Senior Architect Campus Drive 2026 (Updated)') $$,
  'Restored visibility after re-grant'
);

-- 86. Recruiter with expired grant sees ZERO drives in v_recruiter_granted_drives
-- Set expires_at in the past for testing expired grant
RESET ROLE;
DO $$
BEGIN
  UPDATE recruiter_drive_access
  SET expires_at = now() - interval '10 minutes'
  WHERE drive_id = (SELECT id FROM placement_drives WHERE title = 'Senior Architect Campus Drive 2026 (Updated)');
END;
$$;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is_empty(
  $$
    SELECT * FROM v_recruiter_granted_drives
  $$,
  'Recruiter with expired grant sees ZERO drives in v_recruiter_granted_drives'
);

-- 87. Recruiter Confidentiality Shield: SELECT on profiles (students) returns 0 rows
SELECT is_empty(
  $$
    SELECT * FROM profiles WHERE role = 'STUDENT'
  $$,
  'Recruiter Confidentiality Shield: 0 student profiles visible'
);

-- 88. Recruiter Confidentiality Shield: SELECT on academic_records returns 0 rows
SELECT is_empty(
  $$
    SELECT * FROM academic_records
  $$,
  'Recruiter Confidentiality Shield: 0 academic records visible'
);

-- 89. Recruiter Confidentiality Shield: SELECT on student_skills returns 0 rows
SELECT is_empty(
  $$
    SELECT * FROM student_skills
  $$,
  'Recruiter Confidentiality Shield: 0 student skills visible'
);

-- 90. Recruiter Confidentiality Shield: SELECT on student_skill_evidence returns 0 rows
SELECT is_empty(
  $$
    SELECT * FROM student_skill_evidence
  $$,
  'Recruiter Confidentiality Shield: 0 student skill evidence visible'
);

-- 91. Recruiter Confidentiality Shield: SELECT on documents returns 0 rows
SELECT is_empty(
  $$
    SELECT * FROM documents
  $$,
  'Recruiter Confidentiality Shield: 0 documents visible'
);

-- 92. Recruiter Confidentiality Shield: SELECT on applications returns 0 rows
SELECT is_empty(
  $$
    SELECT * FROM applications
  $$,
  'Recruiter Confidentiality Shield: 0 applications visible'
);

-- 93. Staff v_staff_drives view shows all drives (DRAFT, PUBLISHED, CLOSED, ARCHIVED)
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT isnt_empty(
  $$
    SELECT * FROM v_staff_drives
  $$,
  'Staff v_staff_drives view displays drives to staff'
);

-- 94. Anonymous SELECT on v_staff_drives is blocked
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$
    SELECT * FROM v_staff_drives
  $$,
  '42501',
  NULL,
  'Anonymous SELECT on v_staff_drives blocked by lack of privilege'
);

-- 95. Anonymous SELECT on v_student_published_drives is blocked
SELECT throws_ok(
  $$
    SELECT * FROM v_student_published_drives
  $$,
  '42501',
  NULL,
  'Anonymous SELECT on v_student_published_drives blocked by lack of privilege'
);

-- 96. Anonymous SELECT on v_recruiter_granted_drives is blocked
SELECT throws_ok(
  $$
    SELECT * FROM v_recruiter_granted_drives
  $$,
  '42501',
  NULL,
  'Anonymous SELECT on v_recruiter_granted_drives blocked by lack of privilege'
);

SELECT * FROM finish();
ROLLBACK;
