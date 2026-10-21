BEGIN;
SELECT plan(85);

-- ============================================================================
-- Phase 8 — Applications, Status Workflow & Permanent History Test Suite
-- ============================================================================

-- Fixtures Setup
DO $$
DECLARE
  v_admin_id      UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_sec_id        UUID := '20000000-0000-0000-0000-000000000001'::UUID;
  v_coord_id      UUID := '30000000-0000-0000-0000-000000000001'::UUID;
  v_stud1_id      UUID := '40000000-0000-0000-0000-000000000001'::UUID; -- Alice: BARCH 2026, 8.5 CGPA, 0 backlogs (PASS)
  v_stud2_id      UUID := '40000000-0000-0000-0000-000000000002'::UUID; -- Bob: MPLAN 2026, 7.5 CGPA (Wrong Program)
  v_stud3_id      UUID := '40000000-0000-0000-0000-000000000003'::UUID; -- Charlie: BARCH 2025 (Wrong Batch)
  v_stud4_id      UUID := '40000000-0000-0000-0000-000000000004'::UUID; -- Dave: BARCH 2026, 5.5 CGPA (Low CGPA)
  v_stud5_id      UUID := '40000000-0000-0000-0000-000000000005'::UUID; -- Eve: BARCH 2026, UNVERIFIED
  v_stud6_id      UUID := '40000000-0000-0000-0000-000000000006'::UUID; -- Frank: BARCH 2026, Missing Academics
  v_stud9_id      UUID := '40000000-0000-0000-0000-000000000009'::UUID; -- Ivy: BARCH 2026, prior SELECTED PLACEMENT
  v_stud10_id     UUID := '40000000-0000-0000-0000-000000000010'::UUID; -- Jack: BARCH 2026, prior SELECTED INTERNSHIP
  v_rec_acme_id   UUID := '50000000-0000-0000-0000-000000000001'::UUID; -- Acme Recruiter

  v_prog_barch_id UUID;
  v_prog_mplan_id UUID;
  v_company_acme  UUID := '60000000-0000-0000-0000-000000000001'::UUID;
  v_contact_acme  UUID := '70000000-0000-0000-0000-000000000001'::UUID;

  v_pub_drive_id    UUID := '80000000-0000-0000-0000-000000000001'::UUID;
  v_draft_drive_id  UUID := '80000000-0000-0000-0000-000000000002'::UUID;
  v_closed_drive_id UUID := '80000000-0000-0000-0000-000000000003'::UUID;
  v_arch_drive_id   UUID := '80000000-0000-0000-0000-000000000004'::UUID;
  v_exp_drive_id    UUID := '80000000-0000-0000-0000-000000000005'::UUID;
  v_second_drive_id UUID := '80000000-0000-0000-0000-000000000006'::UUID;
  v_prior_p_id      UUID := '80000000-0000-0000-0000-000000000007'::UUID;
  v_prior_i_id      UUID := '80000000-0000-0000-0000-000000000008'::UUID;
BEGIN
  -- Ensure auth.users exist
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
    (v_stud9_id, 'authenticated', 'authenticated', 'ivy@vnit.test'),
    (v_stud10_id, 'authenticated', 'authenticated', 'jack@vnit.test'),
    (v_rec_acme_id, 'authenticated', 'authenticated', 'recruiter@acme.test')
  ON CONFLICT (id) DO NOTHING;

  -- Ensure profiles exist
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
    (v_stud9_id, 'STUDENT', 'Ivy Placed', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud10_id, 'STUDENT', 'Jack Interned', true, NULL, 'STUDENT_ACTIVE'),
    (v_rec_acme_id, 'RECRUITER', 'Recruiter Acme', true, NULL, NULL)
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role,
      display_name = EXCLUDED.display_name,
      is_active = EXCLUDED.is_active;

  SELECT id INTO v_prog_barch_id FROM academic_programs WHERE code = 'BARCH';
  SELECT id INTO v_prog_mplan_id FROM academic_programs WHERE code = 'MPLAN';

  -- Seed Academic Records for Students
  INSERT INTO academic_records (profile_id, program_id, batch, cgpa, active_backlogs, verification_status, verified_by, verified_at)
  VALUES
    (v_stud1_id, v_prog_barch_id, '2026', 8.50, 0, 'VERIFIED', v_admin_id, now()),
    (v_stud2_id, v_prog_mplan_id, '2026', 7.50, 0, 'VERIFIED', v_admin_id, now()),
    (v_stud3_id, v_prog_barch_id, '2025', 9.00, 0, 'VERIFIED', v_admin_id, now()),
    (v_stud4_id, v_prog_barch_id, '2026', 5.50, 3, 'VERIFIED', v_admin_id, now()),
    (v_stud5_id, v_prog_barch_id, '2026', 8.00, 0, 'UNVERIFIED', NULL, NULL),
    -- v_stud6_id has no academic record intentionally
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

  -- Seed Acme Company & Recruiter
  INSERT INTO companies (id, name, normalized_name, website, created_by)
  VALUES (v_company_acme, 'Acme Test Labs', 'acme test labs', 'https://acme.test', v_admin_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO recruiter_contacts (id, company_id, full_name, email, phone, created_by)
  VALUES (v_contact_acme, v_company_acme, 'Recruiter Acme', 'recruiter@acme.test', '+919999900001', v_admin_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO recruiter_profiles (profile_id, company_id, recruiter_contact_id)
  VALUES (v_rec_acme_id, v_company_acme, v_contact_acme)
  ON CONFLICT (profile_id) DO NOTHING;

  -- 1. Main PUBLISHED open drive (BARCH 2026 targeted, min CGPA 7.0, max backlogs 0)
  INSERT INTO placement_drives (
    id, company_id, title, drive_type, status, application_deadline, created_by
  ) VALUES (
    v_pub_drive_id, v_company_acme, 'Phase 8 Main Architecture Drive 2026', 'PLACEMENT', 'DRAFT',
    now() + interval '30 days', v_sec_id
  );
  UPDATE placement_drives SET status = 'PUBLISHED', published_by = v_sec_id, published_at = now() WHERE id = v_pub_drive_id;

  INSERT INTO drive_eligibility (drive_id, minimum_cgpa, maximum_active_backlogs, exclude_previously_selected_placement)
  VALUES (v_pub_drive_id, 7.00, 0, true);

  INSERT INTO drive_eligible_batches (drive_id, program_id, batch)
  VALUES (v_pub_drive_id, v_prog_barch_id, '2026');

  -- 2. DRAFT drive
  INSERT INTO placement_drives (
    id, company_id, title, drive_type, status, created_by
  ) VALUES (
    v_draft_drive_id, v_company_acme, 'Phase 8 Draft Drive', 'PLACEMENT', 'DRAFT', v_coord_id
  );

  INSERT INTO drive_eligibility (drive_id, minimum_cgpa, maximum_active_backlogs)
  VALUES (v_draft_drive_id, 6.00, 1);

  INSERT INTO drive_eligible_batches (drive_id, program_id, batch)
  VALUES (v_draft_drive_id, v_prog_barch_id, '2026');

  -- 3. CLOSED drive
  INSERT INTO placement_drives (
    id, company_id, title, drive_type, status, application_deadline, created_by
  ) VALUES (
    v_closed_drive_id, v_company_acme, 'Phase 8 Closed Drive', 'PLACEMENT', 'DRAFT',
    now() + interval '10 days', v_sec_id
  );
  UPDATE placement_drives SET status = 'PUBLISHED', published_by = v_sec_id, published_at = now() - interval '5 days' WHERE id = v_closed_drive_id;
  UPDATE placement_drives SET status = 'CLOSED', closed_by = v_sec_id, closed_at = now() - interval '1 day' WHERE id = v_closed_drive_id;

  INSERT INTO drive_eligibility (drive_id, minimum_cgpa, maximum_active_backlogs)
  VALUES (v_closed_drive_id, 6.00, 1);

  INSERT INTO drive_eligible_batches (drive_id, program_id, batch)
  VALUES (v_closed_drive_id, v_prog_barch_id, '2026');

  -- 4. ARCHIVED drive
  INSERT INTO placement_drives (
    id, company_id, title, drive_type, status, application_deadline, created_by
  ) VALUES (
    v_arch_drive_id, v_company_acme, 'Phase 8 Archived Drive', 'PLACEMENT', 'DRAFT',
    now() - interval '10 days', v_sec_id
  );
  UPDATE placement_drives SET status = 'PUBLISHED', published_by = v_sec_id, published_at = now() - interval '20 days' WHERE id = v_arch_drive_id;
  UPDATE placement_drives SET status = 'CLOSED', closed_by = v_sec_id, closed_at = now() - interval '15 days' WHERE id = v_arch_drive_id;
  UPDATE placement_drives SET status = 'ARCHIVED', archived_by = v_admin_id, archived_at = now() - interval '5 days' WHERE id = v_arch_drive_id;

  INSERT INTO drive_eligibility (drive_id, minimum_cgpa, maximum_active_backlogs)
  VALUES (v_arch_drive_id, 6.00, 1);

  INSERT INTO drive_eligible_batches (drive_id, program_id, batch)
  VALUES (v_arch_drive_id, v_prog_barch_id, '2026');

  -- 5. Expired PUBLISHED drive (deadline in the past)
  INSERT INTO placement_drives (
    id, company_id, title, drive_type, status, application_deadline, created_by
  ) VALUES (
    v_exp_drive_id, v_company_acme, 'Phase 8 Expired Drive', 'PLACEMENT', 'DRAFT',
    now() - interval '1 hour', v_sec_id
  );
  UPDATE placement_drives SET status = 'PUBLISHED', published_by = v_sec_id, published_at = now() - interval '10 days' WHERE id = v_exp_drive_id;

  INSERT INTO drive_eligibility (drive_id, minimum_cgpa, maximum_active_backlogs)
  VALUES (v_exp_drive_id, 6.00, 1);

  INSERT INTO drive_eligible_batches (drive_id, program_id, batch)
  VALUES (v_exp_drive_id, v_prog_barch_id, '2026');

  -- 6. Second Exclusive Placement Drive 2026
  INSERT INTO placement_drives (
    id, company_id, title, drive_type, status, application_deadline, created_by
  ) VALUES (
    v_second_drive_id, v_company_acme, 'Second Exclusive Placement Drive 2026', 'PLACEMENT', 'DRAFT',
    now() + interval '30 days', v_sec_id
  );
  UPDATE placement_drives SET status = 'PUBLISHED', published_by = v_sec_id, published_at = now() WHERE id = v_second_drive_id;

  INSERT INTO drive_eligibility (drive_id, minimum_cgpa, maximum_active_backlogs, exclude_previously_selected_placement)
  VALUES (v_second_drive_id, 7.00, 0, true);

  INSERT INTO drive_eligible_batches (drive_id, program_id, batch)
  VALUES (v_second_drive_id, v_prog_barch_id, '2026');

  -- Prior drives for selected-placement testing
  INSERT INTO placement_drives (
    id, company_id, title, drive_type, status, application_deadline, created_by
  ) VALUES (
    v_prior_p_id, v_company_acme, 'Prior Placement For Ivy', 'PLACEMENT', 'DRAFT',
    now() + interval '5 days', v_sec_id
  );
  UPDATE placement_drives SET status = 'PUBLISHED', published_by = v_sec_id, published_at = now() WHERE id = v_prior_p_id;

  INSERT INTO applications (student_id, drive_id, status, applied_at, snapshot_cgpa, snapshot_backlogs)
  VALUES (v_stud9_id, v_prior_p_id, 'SELECTED', now(), 8.50, 0);

  INSERT INTO placement_drives (
    id, company_id, title, drive_type, status, application_deadline, created_by
  ) VALUES (
    v_prior_i_id, v_company_acme, 'Prior Internship For Jack', 'INTERNSHIP', 'DRAFT',
    now() + interval '5 days', v_sec_id
  );
  UPDATE placement_drives SET status = 'PUBLISHED', published_by = v_sec_id, published_at = now() WHERE id = v_prior_i_id;

  INSERT INTO applications (student_id, drive_id, status, applied_at, snapshot_cgpa, snapshot_backlogs)
  VALUES (v_stud10_id, v_prior_i_id, 'SELECTED', now(), 8.00, 0);

  -- Coordinator student scope assignment (Coordinator covers BARCH 2026)
  INSERT INTO coordinator_student_scopes (coordinator_id, program_id, batch, granted_by)
  VALUES (v_coord_id, v_prog_barch_id, '2026', v_admin_id)
  ON CONFLICT (coordinator_id, program_id, batch) DO NOTHING;
END;
$$;

-- ============================================================================
-- Section 1: RLS & Direct Mutation Revocations (Tests 1 - 16)
-- ============================================================================

-- 1. Anonymous direct SELECT on applications returns 0 rows
SET LOCAL ROLE anon;
SELECT is_empty(
  $$ SELECT * FROM applications $$,
  'Anonymous direct SELECT on applications returns 0 rows'
);

-- 2. Anonymous direct SELECT on application_status_history returns 0 rows
SELECT is_empty(
  $$ SELECT * FROM application_status_history $$,
  'Anonymous direct SELECT on application_status_history returns 0 rows'
);

-- 3. Anonymous direct INSERT into applications is blocked
SELECT throws_ok(
  $$
    INSERT INTO applications (student_id, drive_id)
    VALUES ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
  $$,
  '42501',
  NULL,
  'Anonymous direct INSERT into applications blocked by lack of privilege'
);

-- 4. Anonymous direct UPDATE on applications is blocked
SELECT throws_ok(
  $$
    UPDATE applications SET status = 'SELECTED'
  $$,
  '42501',
  NULL,
  'Anonymous direct UPDATE on applications blocked by lack of privilege'
);

-- 5. Anonymous direct DELETE on applications is blocked
SELECT throws_ok(
  $$
    DELETE FROM applications
  $$,
  '42501',
  NULL,
  'Anonymous direct DELETE on applications blocked by lack of privilege'
);

-- 6. Anonymous direct INSERT into application_status_history is blocked
SELECT throws_ok(
  $$
    INSERT INTO application_status_history (application_id, new_status, changed_by)
    VALUES ('00000000-0000-0000-0000-000000000001', 'APPLIED', '40000000-0000-0000-0000-000000000001')
  $$,
  '42501',
  NULL,
  'Anonymous direct INSERT into application_status_history blocked by lack of privilege'
);

-- 7. Anonymous direct UPDATE on application_status_history is blocked
SELECT throws_ok(
  $$
    UPDATE application_status_history SET reason = 'tampered'
  $$,
  '42501',
  NULL,
  'Anonymous direct UPDATE on application_status_history blocked by lack of privilege'
);

-- 8. Anonymous direct DELETE on application_status_history is blocked
SELECT throws_ok(
  $$
    DELETE FROM application_status_history
  $$,
  '42501',
  NULL,
  'Anonymous direct DELETE on application_status_history blocked by lack of privilege'
);

-- 9. Recruiter direct SELECT on applications returns 0 rows (Confidentiality Shield)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is_empty(
  $$ SELECT * FROM applications $$,
  'Recruiter direct SELECT on applications returns 0 rows'
);

-- 10. Recruiter direct SELECT on application_status_history returns 0 rows
SELECT is_empty(
  $$ SELECT * FROM application_status_history $$,
  'Recruiter direct SELECT on application_status_history returns 0 rows'
);

-- 11. Recruiter direct INSERT into applications is blocked
SELECT throws_ok(
  $$
    INSERT INTO applications (student_id, drive_id)
    VALUES ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
  $$,
  '42501',
  NULL,
  'Recruiter direct INSERT into applications blocked by lack of privilege'
);

-- 12. Student direct INSERT into applications is blocked (must use apply_to_drive)
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    INSERT INTO applications (student_id, drive_id, snapshot_cgpa, snapshot_backlogs)
    VALUES ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 10.0, 0)
  $$,
  '42501',
  NULL,
  'Student direct INSERT into applications blocked by lack of privilege'
);

-- 13. Student direct UPDATE on applications is blocked
SELECT throws_ok(
  $$
    UPDATE applications SET status = 'WITHDRAWN'
  $$,
  '42501',
  NULL,
  'Student direct UPDATE on applications blocked by lack of privilege'
);

-- 14. Student direct DELETE on applications is blocked
SELECT throws_ok(
  $$
    DELETE FROM applications
  $$,
  '42501',
  NULL,
  'Student direct DELETE on applications blocked by lack of privilege'
);

-- 15. Staff direct UPDATE on applications is blocked (must use transition_application_status)
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    UPDATE applications SET status = 'SHORTLISTED'
  $$,
  '42501',
  NULL,
  'Staff direct UPDATE on applications blocked by lack of privilege'
);

-- 16. Staff direct DELETE on applications is blocked
SELECT throws_ok(
  $$
    DELETE FROM applications
  $$,
  '42501',
  NULL,
  'Staff direct DELETE on applications blocked by lack of privilege'
);

-- ============================================================================
-- Section 2: Student Application Submission (Tests 17 - 35)
-- ============================================================================

-- 17. Anonymous call to apply_to_drive is blocked
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$
    SELECT apply_to_drive((SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026'))
  $$,
  '42501',
  NULL,
  'Anonymous call to apply_to_drive blocked by lack of privilege'
);

-- 18. Recruiter call to apply_to_drive fails with unauthorized
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT apply_to_drive((SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026'))
  $$,
  'Unauthorized: Only active students can apply to drives',
  'Recruiter cannot call apply_to_drive'
);

-- 19. Coordinator call to apply_to_drive fails with unauthorized
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT apply_to_drive((SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026'))
  $$,
  'Unauthorized: Only active students can apply to drives',
  'Coordinator cannot call apply_to_drive'
);

-- 20. Student apply to non-existent drive fails
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT apply_to_drive('99999999-9999-9999-9999-999999999999'::UUID)
  $$,
  'Placement drive not found',
  'Apply to non-existent drive fails'
);

-- 21. Student apply to DRAFT drive fails
SELECT throws_ok(
  $$
    SELECT apply_to_drive('80000000-0000-0000-0000-000000000002'::UUID)
  $$,
  'Cannot apply: drive status is DRAFT, only PUBLISHED drives accept applications',
  'Apply to DRAFT drive fails'
);

-- 22. Student apply to CLOSED drive fails
SELECT throws_ok(
  $$
    SELECT apply_to_drive('80000000-0000-0000-0000-000000000003'::UUID)
  $$,
  'Cannot apply: drive status is CLOSED, only PUBLISHED drives accept applications',
  'Apply to CLOSED drive fails'
);

-- 23. Student apply to ARCHIVED drive fails
SELECT throws_ok(
  $$
    SELECT apply_to_drive('80000000-0000-0000-0000-000000000004'::UUID)
  $$,
  'Cannot apply: drive status is ARCHIVED, only PUBLISHED drives accept applications',
  'Apply to ARCHIVED drive fails'
);

-- 24. Student apply to expired PUBLISHED drive fails (deadline passed)
SELECT throws_ok(
  $$
    SELECT apply_to_drive('80000000-0000-0000-0000-000000000005'::UUID)
  $$,
  'Cannot apply: drive application deadline has passed',
  'Apply to expired drive fails'
);

-- 25. Ineligible Student 2 (Bob: MPLAN, wrong program) apply fails
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000002';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000002", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT apply_to_drive((SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026'))
  $$,
  'Cannot apply: student does not meet eligibility criteria for this drive',
  'Ineligible student (Bob, wrong program) apply fails'
);

-- 26. Ineligible Student 3 (Charlie: BARCH 2025, wrong batch) apply fails
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000003';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT apply_to_drive((SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026'))
  $$,
  'Cannot apply: student does not meet eligibility criteria for this drive',
  'Ineligible student (Charlie, wrong batch) apply fails'
);

-- 27. Ineligible Student 4 (Dave: 5.5 CGPA, below minimum) apply fails
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000004", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT apply_to_drive((SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026'))
  $$,
  'Cannot apply: student does not meet eligibility criteria for this drive',
  'Ineligible student (Dave, low CGPA) apply fails'
);

-- 28. Undetermined Student 5 (Eve: unverified record) apply fails
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000005';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000005", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT apply_to_drive((SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026'))
  $$,
  'Cannot apply: student does not meet eligibility criteria for this drive',
  'Undetermined student (Eve, unverified) apply fails'
);

-- 29. Undetermined Student 6 (Frank: missing record) apply fails
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000006';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000006", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT apply_to_drive((SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026'))
  $$,
  'Cannot apply: student does not meet eligibility criteria for this drive',
  'Undetermined student (Frank, missing record) apply fails'
);

-- 30. Student 9 (Ivy: prior SELECTED on PLACEMENT) apply fails on drive with exclusion flag
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000009';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000009", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT apply_to_drive((SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026'))
  $$,
  'Cannot apply: student does not meet eligibility criteria for this drive',
  'Prior selected placement student apply fails'
);

-- 31. Student 10 (Jack: prior SELECTED on INTERNSHIP) apply SUCCEEDS (not excluded)
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000010';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000010", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT apply_to_drive((SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026'))
  $$,
  'Student 10 (Jack, prior internship) apply succeeds'
);

-- 32. Eligible Student 1 (Alice: BARCH 2026, 8.5 CGPA, 0 backlogs) apply SUCCEEDS
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT apply_to_drive((SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026'))
  $$,
  'Eligible student Alice apply succeeds'
);

-- 33. Authoritative Snapshot Verification: Alice application has exact snapshot_cgpa and snapshot_backlogs
SELECT results_eq(
  $$
    SELECT status, snapshot_cgpa, snapshot_backlogs
    FROM applications
    WHERE student_id = '40000000-0000-0000-0000-000000000001'::UUID
      AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
  $$,
  $$ VALUES ('APPLIED'::application_status, 8.50::NUMERIC(4,2), 0) $$,
  'Alice application has correct status APPLIED and captured snapshot_cgpa=8.50, snapshot_backlogs=0'
);

-- 34. Initial History Verification: Alice application has initial history row with transition_sequence 1
SELECT results_eq(
  $$
    SELECT transition_sequence, previous_status, new_status, changed_by, is_terminal_correction
    FROM application_status_history
    WHERE application_id = (
      SELECT id FROM applications
      WHERE student_id = '40000000-0000-0000-0000-000000000001'::UUID
        AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
    )
  $$,
  $$ VALUES (1::BIGINT, NULL::application_status, 'APPLIED'::application_status, '40000000-0000-0000-0000-000000000001'::UUID, false) $$,
  'Alice application has initial history row with transition_sequence 1, previous_status NULL and new_status APPLIED'
);

-- 35. Duplicate apply attempt by Alice fails
SELECT throws_ok(
  $$
    SELECT apply_to_drive((SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026'))
  $$,
  'Cannot apply: you have already submitted an application for this drive',
  'Duplicate apply attempt by Alice fails safely'
);

-- ============================================================================
-- Section 3: Student Withdrawal (Tests 36 - 45)
-- ============================================================================

-- Save Alice application id in transaction setting
SELECT set_config('test.alice_app_id', (
  SELECT id::text FROM applications
  WHERE student_id = '40000000-0000-0000-0000-000000000001'::UUID
    AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
), true);

-- Switch to Jack
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000010';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000010", "role": "authenticated"}';

-- 36. Student Jack attempts to withdraw Alice application (IDOR attack) -> fails
SELECT throws_ok(
  $$
    SELECT withdraw_application(current_setting('test.alice_app_id')::UUID, 'Malicious withdrawal attempt')
  $$,
  'Unauthorized: You can only withdraw your own applications',
  'Cross-student withdrawal IDOR attack rejected'
);

-- Switch back to Alice
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- 37. Alice withdraws own APPLIED application before deadline -> SUCCEEDS
SELECT lives_ok(
  $$
    SELECT withdraw_application(current_setting('test.alice_app_id')::UUID, 'Personal reasons')
  $$,
  'Alice withdraws own application before deadline succeeds'
);

-- 38. Alice application status is now WITHDRAWN
SELECT results_eq(
  $$
    SELECT status
    FROM applications
    WHERE student_id = '40000000-0000-0000-0000-000000000001'::UUID
      AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
  $$,
  $$ VALUES ('WITHDRAWN'::application_status) $$,
  'Application status updated to WITHDRAWN'
);

-- 39. Withdrawal history appended with transition_sequence 2
SELECT results_eq(
  $$
    SELECT transition_sequence, previous_status, new_status, reason, is_terminal_correction
    FROM application_status_history
    WHERE application_id = (
      SELECT id FROM applications
      WHERE student_id = '40000000-0000-0000-0000-000000000001'::UUID
        AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
    )
    ORDER BY transition_sequence DESC LIMIT 1
  $$,
  $$ VALUES (2::BIGINT, 'APPLIED'::application_status, 'WITHDRAWN'::application_status, 'Personal reasons', false) $$,
  'Withdrawal history event recorded with transition_sequence 2, previous_status APPLIED and new_status WITHDRAWN'
);

-- 40. Re-apply after withdrawal is rejected (UNIQUE student_id, drive_id invariant preserved)
SELECT throws_ok(
  $$
    SELECT apply_to_drive((SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026'))
  $$,
  'Cannot apply: you have already submitted an application for this drive',
  'Re-apply after withdrawal is rejected'
);

-- 41. Second withdrawal on already WITHDRAWN application fails
SELECT throws_ok(
  $$
    SELECT withdraw_application((
      SELECT id FROM applications
      WHERE student_id = '40000000-0000-0000-0000-000000000001'::UUID
        AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
    ))
  $$,
  'Cannot withdraw application: application is in WITHDRAWN status, only APPLIED applications can be withdrawn',
  'Repeated withdrawal fails'
);

-- Reset: Alice withdraws, let's test withdrawal on Jack's application when deadline passes
-- 42. Set deadline to past on Jack's drive and verify withdrawal rejected
RESET ROLE;
UPDATE placement_drives
SET application_deadline = now() - interval '10 minutes'
WHERE title = 'Phase 8 Main Architecture Drive 2026';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000010';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000010", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT withdraw_application((
      SELECT id FROM applications
      WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID
        AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
    ))
  $$,
  'Cannot withdraw application: drive application deadline has passed',
  'Withdrawal after deadline is rejected'
);

-- Restore deadline for Jack's application tests
RESET ROLE;
UPDATE placement_drives
SET application_deadline = now() + interval '30 days'
WHERE title = 'Phase 8 Main Architecture Drive 2026';

-- ============================================================================
-- Section 4: Staff Transitions & Scoping (Tests 43 - 65)
-- ============================================================================

-- 43. Student cannot call transition_application_status
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT transition_application_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'SHORTLISTED'::application_status
    )
  $$,
  'Unauthorized: Only active staff can update application status',
  'Student cannot call transition_application_status'
);

-- 44. Recruiter cannot call transition_application_status
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT transition_application_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'SHORTLISTED'::application_status
    )
  $$,
  'Unauthorized: Only active staff can update application status',
  'Recruiter cannot call transition_application_status'
);

-- 45. In-scope coordinator transitions Jack: APPLIED -> SHORTLISTED -> SUCCEEDS
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT transition_application_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'SHORTLISTED'::application_status,
      'Portfolio review cleared'
    )
  $$,
  'In-scope coordinator shortlists Jack application'
);

-- 46. Jack application status is now SHORTLISTED
SELECT results_eq(
  $$
    SELECT status
    FROM applications
    WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID
      AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
  $$,
  $$ VALUES ('SHORTLISTED'::application_status) $$,
  'Application status updated to SHORTLISTED'
);

-- 47. History ledger contains SHORTLISTED entry with transition_sequence 2
SELECT results_eq(
  $$
    SELECT transition_sequence, previous_status, new_status, reason
    FROM application_status_history
    WHERE application_id = (
      SELECT id FROM applications
      WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID
        AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
    )
    ORDER BY transition_sequence DESC LIMIT 1
  $$,
  $$ VALUES (2::BIGINT, 'APPLIED'::application_status, 'SHORTLISTED'::application_status, 'Portfolio review cleared') $$,
  'History ledger updated with SHORTLISTED transition and sequence 2'
);

-- 48. Student cannot withdraw after being SHORTLISTED
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000010';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000010", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT withdraw_application((
      SELECT id FROM applications
      WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID
        AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
    ))
  $$,
  'Cannot withdraw application: application is in SHORTLISTED status, only APPLIED applications can be withdrawn',
  'Student cannot withdraw shortlisted application'
);

-- 49. Coordinator CANNOT move SHORTLISTED to INTERVIEW (Secretary/Admin only)
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT transition_application_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'INTERVIEW'::application_status
    )
  $$,
  'Unauthorized: Only Super Admin or TNP Secretary can move applications to INTERVIEW',
  'Coordinator cannot move SHORTLISTED to INTERVIEW'
);

-- 50. Secretary CAN move SHORTLISTED to INTERVIEW
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT transition_application_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'INTERVIEW'::application_status,
      'Invited to interview round 1'
    )
  $$,
  'Secretary moves application to INTERVIEW'
);

-- 51. Status is now INTERVIEW
SELECT results_eq(
  $$
    SELECT status
    FROM applications
    WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID
      AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
  $$,
  $$ VALUES ('INTERVIEW'::application_status) $$,
  'Application status is INTERVIEW'
);

-- 52. Illegal transition: INTERVIEW -> SHORTLISTED is rejected
SELECT throws_ok(
  $$
    SELECT transition_application_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'SHORTLISTED'::application_status
    )
  $$,
  'Illegal application status transition from INTERVIEW to SHORTLISTED',
  'INTERVIEW to SHORTLISTED is rejected'
);

-- 53. Coordinator CANNOT decide INTERVIEW outcome
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT transition_application_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'SELECTED'::application_status
    )
  $$,
  'Unauthorized: Only Super Admin or TNP Secretary can decide INTERVIEW outcomes',
  'Coordinator cannot select candidate'
);

-- 54. Secretary selects candidate: INTERVIEW -> SELECTED -> SUCCEEDS
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT transition_application_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'SELECTED'::application_status,
      'Final placement offer extended'
    )
  $$,
  'Secretary selects candidate'
);

-- 55. Status is now SELECTED (terminal)
SELECT results_eq(
  $$
    SELECT status
    FROM applications
    WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID
      AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
  $$,
  $$ VALUES ('SELECTED'::application_status) $$,
  'Application status is SELECTED'
);

-- 56. Normal staff transition out of terminal state SELECTED is rejected
SELECT throws_ok(
  $$
    SELECT transition_application_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'REJECTED'::application_status
    )
  $$,
  'Cannot transition application: application is in terminal state SELECTED',
  'Normal transition out of SELECTED is rejected'
);

-- ============================================================================
-- Section 5: Super Admin Terminal Correction (Tests 57 - 70)
-- ============================================================================

-- 57. Student cannot call correct_terminal_status
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT correct_terminal_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'Administrative mistake'
    )
  $$,
  'Unauthorized: Only Super Admin can perform terminal status correction',
  'Student cannot call correct_terminal_status'
);

-- 58. Coordinator cannot call correct_terminal_status
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT correct_terminal_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'Administrative mistake'
    )
  $$,
  'Unauthorized: Only Super Admin can perform terminal status correction',
  'Coordinator cannot call correct_terminal_status'
);

-- 59. Secretary cannot call correct_terminal_status
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT correct_terminal_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'Administrative mistake'
    )
  $$,
  'Unauthorized: Only Super Admin can perform terminal status correction',
  'Secretary cannot call correct_terminal_status'
);

-- 60. Super Admin with empty reason fails
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$
    SELECT correct_terminal_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      '   '
    )
  $$,
  'Correction reason is required and cannot be empty',
  'Super Admin with whitespace reason fails'
);

-- 61. Super Admin corrects SELECTED -> derives previous non-terminal state INTERVIEW -> SUCCEEDS
SELECT lives_ok(
  $$
    SELECT correct_terminal_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'Company rescinded offer due to procedural issue'
    )
  $$,
  'Super Admin terminal correction succeeds'
);

-- 62. Status is restored to INTERVIEW
SELECT results_eq(
  $$
    SELECT status
    FROM applications
    WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID
      AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
  $$,
  $$ VALUES ('INTERVIEW'::application_status) $$,
  'Status successfully restored to immediate prior state INTERVIEW'
);

-- 63. Correction history row recorded with is_terminal_correction = true and sequence 5
SELECT results_eq(
  $$
    SELECT transition_sequence, previous_status, new_status, is_terminal_correction, reason
    FROM application_status_history
    WHERE application_id = (
      SELECT id FROM applications
      WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID
        AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
    )
    ORDER BY transition_sequence DESC LIMIT 1
  $$,
  $$ VALUES (5::BIGINT, 'SELECTED'::application_status, 'INTERVIEW'::application_status, true, 'Company rescinded offer due to procedural issue') $$,
  'Correction history row appended with is_terminal_correction true and transition_sequence 5'
);

-- 64. Second terminal correction fails because application is now non-terminal (INTERVIEW)
SELECT throws_ok(
  $$
    SELECT correct_terminal_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000010'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'Second correction attempt'
    )
  $$,
  'Cannot perform terminal correction: application is in non-terminal state INTERVIEW',
  'Correction on non-terminal application fails'
);

-- 65. Super Admin can also correct WITHDRAWN (Alice) back to APPLIED
SELECT lives_ok(
  $$
    SELECT correct_terminal_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000001'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'Student withdrew by mistake, coordinator verified request'
    )
  $$,
  'Super Admin corrects WITHDRAWN application'
);

-- 66. Alice status restored to APPLIED
SELECT results_eq(
  $$
    SELECT status
    FROM applications
    WHERE student_id = '40000000-0000-0000-0000-000000000001'::UUID
      AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
  $$,
  $$ VALUES ('APPLIED'::application_status) $$,
  'Alice status restored to APPLIED'
);

-- ============================================================================
-- Section 6: Reactive Selected Placement Impact (Tests 67 - 72)
-- ============================================================================

-- 67. Second placement drive with exclude_previously_selected_placement exists
SELECT isnt_empty(
  $$ SELECT id FROM placement_drives WHERE id = '80000000-0000-0000-0000-000000000006'::UUID $$,
  'Second placement drive with exclude_previously_selected_placement exists'
);

-- 68. Alice is currently APPLIED on drive 1 (not SELECTED). Evaluator on second drive returns PASS!
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT academic_result, reason_codes
    FROM get_my_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Second Exclusive Placement Drive 2026')
    )
  $$,
  $$ VALUES ('PASS', ARRAY[]::TEXT[]) $$,
  'Alice evaluates PASS while not selected'
);

-- 69. Move Alice through to SELECTED on drive 1
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

DO $$
DECLARE
  v_alice_app_id UUID;
BEGIN
  SELECT id INTO v_alice_app_id
  FROM applications
  WHERE student_id = '40000000-0000-0000-0000-000000000001'::UUID
    AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026');

  PERFORM transition_application_status(v_alice_app_id, 'SHORTLISTED'::application_status);
  PERFORM transition_application_status(v_alice_app_id, 'INTERVIEW'::application_status);
  PERFORM transition_application_status(v_alice_app_id, 'SELECTED'::application_status);
END;
$$;

SELECT results_eq(
  $$
    SELECT status
    FROM applications
    WHERE student_id = '40000000-0000-0000-0000-000000000001'::UUID
      AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')
  $$,
  $$ VALUES ('SELECTED'::application_status) $$,
  'Alice application transitioned to SELECTED on drive 1'
);

-- 70. Now Alice evaluates on second drive: FAIL, PREVIOUSLY_SELECTED_PLACEMENT
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT academic_result, ('PREVIOUSLY_SELECTED_PLACEMENT' = ANY(reason_codes))
    FROM get_my_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Second Exclusive Placement Drive 2026')
    )
  $$,
  $$ VALUES ('FAIL', true) $$,
  'Alice now evaluates FAIL due to SELECTED placement'
);

-- 71. Super Admin corrects Alice: SELECTED -> INTERVIEW
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$
    SELECT correct_terminal_status(
      (SELECT id FROM applications WHERE student_id = '40000000-0000-0000-0000-000000000001'::UUID AND drive_id = (SELECT id FROM placement_drives WHERE title = 'Phase 8 Main Architecture Drive 2026')),
      'Placement offer cancelled'
    )
  $$,
  'Super Admin corrects Alice back to INTERVIEW'
);

-- 72. Re-evaluate Alice on second drive: immediately returns PASS again!
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$
    SELECT academic_result, reason_codes
    FROM get_my_drive_eligibility(
      (SELECT id FROM placement_drives WHERE title = 'Second Exclusive Placement Drive 2026')
    )
  $$,
  $$ VALUES ('PASS', ARRAY[]::TEXT[]) $$,
  'Alice immediately returns PASS after terminal correction'
);

-- ============================================================================
-- Section 7: History Invariants & Domain Views (Tests 73 - 85)
-- ============================================================================

-- 73. History append-only trigger blocks UPDATE
RESET ROLE;
SELECT throws_ok(
  $$
    UPDATE application_status_history SET reason = 'Tampered'
  $$,
  'This table is append-only: UPDATE operation is not permitted on application_status_history',
  'Direct UPDATE on application_status_history blocked by trigger'
);

-- 74. History append-only trigger blocks DELETE
SELECT throws_ok(
  $$
    DELETE FROM application_status_history
  $$,
  'This table is append-only: DELETE operation is not permitted on application_status_history',
  'Direct DELETE on application_status_history blocked by trigger'
);

-- 75. Student view v_student_applications returns Alice own application
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT isnt_empty(
  $$
    SELECT * FROM v_student_applications
  $$,
  'v_student_applications returns rows for authenticated student'
);

-- 76. Student view v_student_applications does NOT return other students applications
SELECT is_empty(
  $$
    SELECT * FROM v_student_applications WHERE student_id != '40000000-0000-0000-0000-000000000001'::UUID
  $$,
  'v_student_applications isolates student data from other students'
);

-- 77. Student timeline v_student_application_timeline returns Alice events
SELECT isnt_empty(
  $$
    SELECT * FROM v_student_application_timeline
  $$,
  'v_student_application_timeline returns timeline events for student'
);

-- 78. Student timeline does NOT expose staff IDs or internal reasons (column projection test)
SELECT throws_ok(
  $$
    SELECT changed_by FROM v_student_application_timeline
  $$,
  '42703',
  NULL,
  'v_student_application_timeline does not project changed_by column'
);

-- 79. Student timeline does not project reason column
SELECT throws_ok(
  $$
    SELECT reason FROM v_student_application_timeline
  $$,
  '42703',
  NULL,
  'v_student_application_timeline does not project reason column'
);

-- 80. Staff view v_staff_applications works for Coordinator within scope
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT isnt_empty(
  $$
    SELECT * FROM v_staff_applications
  $$,
  'Coordinator can read scoped applications in v_staff_applications'
);

-- 81. Coordinator CANNOT see out-of-scope student applications in v_staff_applications
SELECT is_empty(
  $$
    SELECT * FROM v_staff_applications WHERE student_id = '40000000-0000-0000-0000-000000000002'::UUID
  $$,
  'Coordinator cannot see out-of-scope student applications in v_staff_applications'
);

-- 82. Staff view v_staff_application_history exposes staff names and reasons to staff
SELECT isnt_empty(
  $$
    SELECT changed_by_name, reason FROM v_staff_application_history
  $$,
  'v_staff_application_history exposes audit details to authorized staff'
);

-- 83. Recruiter view v_staff_applications returns 0 rows (Confidentiality Shield)
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is_empty(
  $$
    SELECT * FROM v_staff_applications
  $$,
  'Recruiter receives 0 rows from v_staff_applications'
);

-- 84. Recruiter view v_student_applications returns 0 rows
SELECT is_empty(
  $$
    SELECT * FROM v_student_applications
  $$,
  'Recruiter receives 0 rows from v_student_applications'
);

-- 85. Recruiter view v_staff_application_history returns 0 rows
SELECT is_empty(
  $$
    SELECT * FROM v_staff_application_history
  $$,
  'Recruiter receives 0 rows from v_staff_application_history'
);

SELECT * FROM finish();
ROLLBACK;
