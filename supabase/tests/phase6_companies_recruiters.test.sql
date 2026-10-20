BEGIN;
SELECT plan(92);

-- ============================================================================
-- Phase 6 — Companies, Recruiters & Invitation Workflow Security & Integrity Suite
-- ============================================================================

-- Fixtures Setup
DO $$
DECLARE
  v_admin_id    UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_sec_id      UUID := '20000000-0000-0000-0000-000000000001'::UUID;
  v_coord_id    UUID := '30000000-0000-0000-0000-000000000001'::UUID;
  v_stud_id     UUID := '40000000-0000-0000-0000-000000000001'::UUID;
  v_rec_bob_id  UUID := '50000000-0000-0000-0000-000000000001'::UUID;
  v_rec_char_id UUID := '50000000-0000-0000-0000-000000000002'::UUID;
  v_rec_dave_id UUID := '50000000-0000-0000-0000-000000000003'::UUID;
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (v_admin_id, 'authenticated', 'authenticated', 'admin@vnit.test'),
    (v_sec_id, 'authenticated', 'authenticated', 'sec@vnit.test'),
    (v_coord_id, 'authenticated', 'authenticated', 'coord@vnit.test'),
    (v_stud_id, 'authenticated', 'authenticated', 'student@vnit.test'),
    (v_rec_bob_id, 'authenticated', 'authenticated', 'recruiter.bob@acme.test'),
    (v_rec_char_id, 'authenticated', 'authenticated', 'recruiter.charlie@acme.test'),
    (v_rec_dave_id, 'authenticated', 'authenticated', 'recruiter.dave@globex.test')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Insert/update profiles
  INSERT INTO profiles (id, role, display_name, is_active, coordinator_slot, student_lifecycle_status) VALUES
    (v_admin_id, 'SUPER_ADMIN', 'Super Admin', true, NULL, NULL),
    (v_sec_id, 'TNP_SECRETARY', 'Secretary Jane', true, NULL, NULL),
    (v_coord_id, 'TNP_COORDINATOR', 'Coordinator Bob', true, 'SLOT_1', NULL),
    (v_stud_id, 'STUDENT', 'Student Alice', true, NULL, 'STUDENT_ACTIVE'),
    (v_rec_char_id, 'RECRUITER', 'Charlie Recruiter', true, NULL, NULL),
    (v_rec_dave_id, 'RECRUITER', 'Dave Recruiter', true, NULL, NULL)
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role,
      display_name = EXCLUDED.display_name,
      is_active = EXCLUDED.is_active,
      coordinator_slot = EXCLUDED.coordinator_slot,
      student_lifecycle_status = EXCLUDED.student_lifecycle_status;
END;
$$;

-- ============================================================================
-- Section 1: Company Management (17 tests)
-- ============================================================================

-- 1. Super Admin can create company
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT create_company('Acme Architecture Corp', 'https://acme.test', 'Leading design firm') $$,
  'Super Admin can create company'
);

-- 2. TNP Secretary can create company
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT create_company('Globex Planning Ltd', 'https://globex.test', 'Global urban planning') $$,
  'TNP Secretary can create company'
);

-- 3. Coordinator CANNOT create company
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_company('Coord Studio', 'https://coord.test', 'Forbidden') $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can create companies',
  'Coordinator cannot create company'
);

-- 4. Student CANNOT create company
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_company('Student Studio', 'https://student.test', 'Forbidden') $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can create companies',
  'Student cannot create company'
);

-- 5. Recruiter CANNOT create company
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000002';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000002", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_company('Recruiter Studio', 'https://rec.test', 'Forbidden') $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can create companies',
  'Recruiter cannot create company'
);

-- 6. Normalized duplicate company name is rejected
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_company('  acme architecture corp  ', 'https://acme-dup.test', 'Duplicate normalized name') $$,
  '23505',
  NULL,
  'Duplicate company name with whitespace/case variation is rejected by normalized_name constraint'
);

-- 7. Empty company name is rejected
SELECT throws_ok(
  $$ SELECT create_company('   ', 'https://test.com', 'Empty name') $$,
  'P0001',
  'Company name cannot be empty',
  'Whitespace-only company name is rejected'
);

-- 8. Secretary can update company
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT update_company(
       (SELECT id FROM companies WHERE normalized_name = 'acme architecture corp'),
       'Acme Architecture Corp Updated',
       'https://acme-updated.test',
       'Updated description'
     ) $$,
  'Secretary can update company'
);

-- 9. Coordinator CANNOT update company
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT update_company(
       (SELECT id FROM companies WHERE normalized_name = 'acme architecture corp updated'),
       'Hacked', 'https://hack.com', 'Hack'
     ) $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can update companies',
  'Coordinator cannot update company'
);

-- 10. Student CANNOT update company
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT update_company(
       (SELECT id FROM companies WHERE normalized_name = 'acme architecture corp updated'),
       'Hacked', 'https://hack.com', 'Hack'
     ) $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can update companies',
  'Student cannot update company'
);

-- 11. Secretary can archive company
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT archive_company(
       (SELECT id FROM companies WHERE normalized_name = 'globex planning ltd')
     ) $$,
  'Secretary can archive company'
);

-- 12. Verify archived state in DB
SELECT results_eq(
  $$ SELECT is_archived FROM companies WHERE normalized_name = 'globex planning ltd' $$,
  ARRAY[true],
  'Company is_archived is set to true'
);

-- 13. Secretary can reactivate company
SELECT lives_ok(
  $$ SELECT reactivate_company(
       (SELECT id FROM companies WHERE normalized_name = 'globex planning ltd')
     ) $$,
  'Secretary can reactivate company'
);

-- 14. Verify reactivated state in DB
SELECT results_eq(
  $$ SELECT is_archived FROM companies WHERE normalized_name = 'globex planning ltd' $$,
  ARRAY[false],
  'Company is_archived is set to false after reactivation'
);

-- 15. Staff can SELECT companies via RLS
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$ SELECT count(*)::integer >= 2 FROM companies $$,
  ARRAY[true],
  'Staff coordinator can read all companies'
);

-- 16. Student CANNOT SELECT companies (RLS default deny)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$ SELECT count(*)::integer FROM companies $$,
  ARRAY[0],
  'Student receives 0 rows from companies table'
);

-- 17. Anonymous CANNOT SELECT companies (table-level revoke)
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT count(*)::integer FROM companies $$,
  '42501',
  NULL,
  'Anonymous caller is denied SELECT on companies table'
);

-- ============================================================================
-- Section 2: Recruiter Contact Management (18 tests)
-- ============================================================================

-- Reset role to setup companies
RESET ROLE;
DO $$
BEGIN
  -- Re-normalize company names for test consistency
  UPDATE companies SET name = 'Acme Architecture Corp' WHERE normalized_name LIKE 'acme architecture%';
END;
$$;

-- 18. Super Admin creates recruiter contact
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT create_recruiter_contact(
       (SELECT id FROM companies WHERE normalized_name = 'acme architecture corp'),
       'Bob Builder',
       'recruiter.bob@acme.test',
       '+919876543210',
       'Senior Talent Partner'
     ) $$,
  'Super Admin can create recruiter contact'
);

-- 19. Secretary creates recruiter contact
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT create_recruiter_contact(
       (SELECT id FROM companies WHERE normalized_name = 'acme architecture corp'),
       'Charlie Recruiter',
       'recruiter.charlie@acme.test',
       '+919876543211',
       'Lead HR'
     ) $$,
  'Secretary can create recruiter contact'
);

-- 20. Coordinator CANNOT create contact
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_recruiter_contact(
       (SELECT id FROM companies WHERE normalized_name = 'acme architecture corp'),
       'Illegal Contact', 'illegal@acme.test', NULL, NULL
     ) $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can create recruiter contacts',
  'Coordinator cannot create recruiter contact'
);

-- 21. Student CANNOT create contact
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_recruiter_contact(
       (SELECT id FROM companies WHERE normalized_name = 'acme architecture corp'),
       'Illegal Contact', 'illegal2@acme.test', NULL, NULL
     ) $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can create recruiter contacts',
  'Student cannot create recruiter contact'
);

-- 22. Recruiter CANNOT create contact
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000002';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000002", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_recruiter_contact(
       (SELECT id FROM companies WHERE normalized_name = 'acme architecture corp'),
       'Illegal Contact', 'illegal3@acme.test', NULL, NULL
     ) $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can create recruiter contacts',
  'Recruiter cannot create recruiter contact'
);

-- 23. Duplicate normalized contact email is rejected
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_recruiter_contact(
       (SELECT id FROM companies WHERE normalized_name = 'acme architecture corp'),
       'Bob Builder Dup',
       '  RECRUITER.BOB@ACME.TEST  ',
       NULL, NULL
     ) $$,
  '23505',
  NULL,
  'Duplicate contact email with case and whitespace variation is rejected'
);

-- 24. Invalid email format is rejected
SELECT throws_ok(
  $$ SELECT create_recruiter_contact(
       (SELECT id FROM companies WHERE normalized_name = 'acme architecture corp'),
       'Bad Email', 'not-an-email', NULL, NULL
     ) $$,
  'P0001',
  'Invalid email format',
  'Malformed contact email is rejected'
);

-- 25. Cannot create contact for archived company
RESET ROLE;
UPDATE companies SET is_archived = true WHERE normalized_name = 'globex planning ltd';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_recruiter_contact(
       (SELECT id FROM companies WHERE normalized_name = 'globex planning ltd'),
       'Dave Globex', 'dave@globex.test', NULL, NULL
     ) $$,
  'P0001',
  'Cannot add recruiter contact to an archived company',
  'Cannot add recruiter contact to an archived company'
);

RESET ROLE;
UPDATE companies SET is_archived = false WHERE normalized_name = 'globex planning ltd';

-- 26. Secretary updates contact
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT update_recruiter_contact(
       (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test'),
       'Bob Builder Updated',
       '+919876543299',
       'VP Talent'
     ) $$,
  'Secretary can update recruiter contact details'
);

-- 27. Coordinator CANNOT update contact
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT update_recruiter_contact(
       (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test'),
       'Hacked', NULL, NULL
     ) $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can update recruiter contacts',
  'Coordinator cannot update recruiter contact'
);

-- 28. Secretary deactivates contact
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT deactivate_recruiter_contact(
       (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
     ) $$,
  'Secretary can deactivate recruiter contact'
);

-- 29. Verify contact is_active = false
SELECT results_eq(
  $$ SELECT is_active FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test' $$,
  ARRAY[false],
  'Contact is_active is now false'
);

-- 30. Secretary reactivates contact
SELECT lives_ok(
  $$ SELECT reactivate_recruiter_contact(
       (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
     ) $$,
  'Secretary can reactivate recruiter contact'
);

-- 31. Verify contact is_active = true
SELECT results_eq(
  $$ SELECT is_active FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test' $$,
  ARRAY[true],
  'Contact is_active is now true'
);

-- 32. Reactivating contact of archived company fails
RESET ROLE;
UPDATE companies SET is_archived = true WHERE normalized_name = 'acme architecture corp';
UPDATE recruiter_contacts SET is_active = false WHERE email = 'recruiter.bob@acme.test';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT reactivate_recruiter_contact(
       (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
     ) $$,
  'P0001',
  'Cannot reactivate recruiter contact: parent company is archived',
  'Reactivating contact under an archived company is rejected'
);

RESET ROLE;
UPDATE companies SET is_archived = false WHERE normalized_name = 'acme architecture corp';
UPDATE recruiter_contacts SET is_active = true WHERE email = 'recruiter.bob@acme.test';

-- 33. Staff can read recruiter contacts
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$ SELECT count(*)::integer >= 2 FROM recruiter_contacts $$,
  ARRAY[true],
  'Staff coordinator can read recruiter contacts'
);

-- 34. Student receives 0 rows from recruiter_contacts
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$ SELECT count(*)::integer FROM recruiter_contacts $$,
  ARRAY[0],
  'Student receives 0 rows from recruiter_contacts table'
);

-- 35. Anonymous receives 0 rows from recruiter_contacts (table-level revoke)
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT count(*)::integer FROM recruiter_contacts $$,
  '42501',
  NULL,
  'Anonymous caller is denied SELECT on recruiter_contacts table'
);

-- ============================================================================
-- Section 3: Recruiter Invitation Lifecycle & Expiry (14 tests)
-- ============================================================================

-- 36. Super Admin can issue invitation for active contact
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT create_recruiter_invitation(
       (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
     ) $$,
  'Super Admin can issue recruiter invitation'
);

-- 37. Verify invitation created with status = 'PENDING' and 7-day expiry
SELECT results_eq(
  $$ SELECT status, (expires_at > now() + interval '6 days 23 hours')
     FROM recruiter_invitations
     WHERE recruiter_contact_id = (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
     ORDER BY invited_at DESC LIMIT 1 $$,
  $$ VALUES ('PENDING'::invitation_status, true) $$,
  'Invitation is created with PENDING status and exactly 7-day expiry'
);

-- 38. Duplicate valid pending invitation attempt fails
SELECT throws_ok(
  $$ SELECT create_recruiter_invitation(
       (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
     ) $$,
  'P0001',
  'A valid pending invitation already exists for this contact',
  'Duplicate valid pending invitation is rejected'
);

-- 39. Coordinator CANNOT create invitation
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_recruiter_invitation(
       (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.charlie@acme.test')
     ) $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can issue recruiter invitations',
  'Coordinator cannot issue recruiter invitation'
);

-- 40. Student CANNOT create invitation
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_recruiter_invitation(
       (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.charlie@acme.test')
     ) $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can issue recruiter invitations',
  'Student cannot issue recruiter invitation'
);

-- 41. Cannot invite inactive contact
RESET ROLE;
UPDATE recruiter_contacts SET is_active = false WHERE email = 'recruiter.charlie@acme.test';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_recruiter_invitation(
       (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.charlie@acme.test')
     ) $$,
  'P0001',
  'Cannot issue invitation: recruiter contact is inactive',
  'Cannot issue invitation for inactive recruiter contact'
);

RESET ROLE;
UPDATE recruiter_contacts SET is_active = true WHERE email = 'recruiter.charlie@acme.test';

-- 42. Cannot invite contact of archived company
RESET ROLE;
UPDATE companies SET is_archived = true WHERE normalized_name = 'acme architecture corp';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT create_recruiter_invitation(
       (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.charlie@acme.test')
     ) $$,
  'P0001',
  'Cannot issue invitation: company is archived',
  'Cannot issue invitation under archived company'
);

RESET ROLE;
UPDATE companies SET is_archived = false WHERE normalized_name = 'acme architecture corp';

-- 43. Secretary can revoke invitation
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT revoke_recruiter_invitation(
       (SELECT id FROM recruiter_invitations
        WHERE recruiter_contact_id = (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
          AND status = 'PENDING')
     ) $$,
  'Secretary can revoke pending recruiter invitation'
);

-- 44. Verify invitation is now REVOKED and revoked_by is set
SELECT results_eq(
  $$ SELECT status, revoked_by
     FROM recruiter_invitations
     WHERE recruiter_contact_id = (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
     ORDER BY invited_at DESC LIMIT 1 $$,
  $$ VALUES ('REVOKED'::invitation_status, '20000000-0000-0000-0000-000000000001'::UUID) $$,
  'Invitation status is REVOKED and revoked_by is recorded'
);

-- 45. Revoking an already revoked invitation fails
SELECT throws_ok(
  $$ SELECT revoke_recruiter_invitation(
       (SELECT id FROM recruiter_invitations
        WHERE recruiter_contact_id = (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
        ORDER BY invited_at DESC LIMIT 1)
     ) $$,
  'P0001',
  'Cannot revoke an invitation with status REVOKED',
  'Cannot revoke an already revoked invitation'
);

-- 46. Coordinator CANNOT revoke invitation
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT revoke_recruiter_invitation(
       (SELECT id FROM recruiter_invitations
        WHERE recruiter_contact_id = (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
        ORDER BY invited_at DESC LIMIT 1)
     ) $$,
  'P0001',
  'Unauthorized: Only Super Admin or TNP Secretary can revoke recruiter invitations',
  'Coordinator cannot revoke invitation'
);

-- 47. Re-invitation after REVOKED succeeds with fresh invitation row
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT create_recruiter_invitation(
       (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
     ) $$,
  'Can issue a fresh invitation after prior invitation was revoked'
);

-- 48. Re-invitation after simulated expiry succeeds with fresh row
RESET ROLE;
-- Artificially expire the latest pending invitation for Bob
UPDATE recruiter_invitations
SET invited_at = now() - interval '8 days',
    expires_at = now() - interval '1 day'
WHERE recruiter_contact_id = (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
  AND status = 'PENDING';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT create_recruiter_invitation(
       (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
     ) $$,
  'Can issue a fresh invitation after previous pending invitation expired'
);

-- 49. Student receives 0 rows from recruiter_invitations
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$ SELECT count(*)::integer FROM recruiter_invitations $$,
  ARRAY[0],
  'Student receives 0 rows from recruiter_invitations table'
);

-- ============================================================================
-- Section 4: Acceptance Transaction & Identity Binding (14 tests)
-- ============================================================================

-- 50. Unauthenticated caller cannot accept invitation
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '{}';
SELECT throws_ok(
  $$ SELECT accept_recruiter_invitation() $$,
  'P0001',
  'Authentication required to accept recruiter invitation',
  'Unauthenticated caller cannot accept recruiter invitation'
);

-- 51. Caller with conflicting role (e.g. STUDENT Alice) cannot accept
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT accept_recruiter_invitation() $$,
  'P0001',
  'Cannot accept recruiter invitation: User profile already exists with conflicting role STUDENT',
  'Student cannot accept recruiter invitation or escalate role'
);

-- 52. Caller whose email has no matching recruiter contact cannot accept
RESET ROLE;
INSERT INTO auth.users (id, email) VALUES
  ('50000000-0000-0000-0000-000000000099', 'stranger@nowhere.test')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000099';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000099", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT accept_recruiter_invitation() $$,
  'P0001',
  'No recruiter contact found matching authenticated email',
  'Caller with unmatched email cannot accept'
);

-- 53. Caller cannot accept if invitation has expired
RESET ROLE;
UPDATE recruiter_invitations
SET invited_at = now() - interval '8 days',
    expires_at = now() - interval '1 day'
WHERE recruiter_contact_id = (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
  AND status = 'PENDING';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT accept_recruiter_invitation() $$,
  'P0001',
  'Invitation has expired',
  'Acceptance of expired invitation is rejected'
);

-- 54. Caller cannot accept if company is archived
RESET ROLE;
UPDATE recruiter_invitations
SET status = 'EXPIRED'
WHERE recruiter_contact_id = (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test');

INSERT INTO recruiter_invitations (recruiter_contact_id, invited_by, status, invited_at, expires_at)
VALUES (
  (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test'),
  '00000000-0000-0000-0000-000000000001',
  'PENDING',
  now() + interval '5 seconds',
  now() + interval '7 days'
);
UPDATE companies SET is_archived = true WHERE normalized_name = 'acme architecture corp';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT accept_recruiter_invitation() $$,
  'P0001',
  'Cannot accept invitation: company is archived',
  'Cannot accept invitation if company is archived'
);

RESET ROLE;
UPDATE companies SET is_archived = false WHERE normalized_name = 'acme architecture corp';

-- 55. Caller cannot accept if contact is deactivated
RESET ROLE;
UPDATE recruiter_contacts SET is_active = false WHERE email = 'recruiter.bob@acme.test';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT accept_recruiter_invitation() $$,
  'P0001',
  'Cannot accept invitation: recruiter contact is inactive',
  'Cannot accept invitation if contact is inactive'
);

RESET ROLE;
UPDATE recruiter_contacts SET is_active = true WHERE email = 'recruiter.bob@acme.test';

-- 56. Caller cannot accept if onboarding delivery is not confirmed (unsent-pending protection)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT accept_recruiter_invitation() $$,
  'P0001',
  'Cannot accept invitation: onboarding delivery has not been confirmed',
  'Cannot accept invitation if onboarding delivery is not confirmed'
);

RESET ROLE;
-- Trusted server confirms delivery
UPDATE recruiter_invitations
SET delivery_confirmed_at = now()
WHERE recruiter_contact_id = (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
  AND status = 'PENDING';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- 57. Valid acceptance transaction succeeds once delivery is confirmed
SELECT lives_ok(
  $$ SELECT accept_recruiter_invitation() $$,
  'Bob successfully accepts recruiter invitation'
);

-- 57. Verify profiles row has role = 'RECRUITER' and display_name = 'Bob Builder Updated'
SELECT results_eq(
  $$ SELECT role, display_name, is_active FROM profiles WHERE id = '50000000-0000-0000-0000-000000000001' $$,
  $$ VALUES ('RECRUITER'::user_role, 'Bob Builder Updated', true) $$,
  'Bob profile role is RECRUITER and active'
);

-- 58. Verify recruiter_profiles row is created and bound to company
SELECT results_eq(
  $$ SELECT rp.company_id = c.id
     FROM recruiter_profiles rp
     JOIN companies c ON c.normalized_name = 'acme architecture corp'
     WHERE rp.profile_id = '50000000-0000-0000-0000-000000000001' $$,
  ARRAY[true],
  'recruiter_profiles binds Bob profile to Acme company'
);

-- 59. Verify invitation is marked ACCEPTED and accepted_at is set
RESET ROLE;
SELECT results_eq(
  $$ SELECT status, (accepted_at IS NOT NULL)
     FROM recruiter_invitations
     WHERE recruiter_contact_id = (SELECT id FROM recruiter_contacts WHERE email = 'recruiter.bob@acme.test')
     ORDER BY accepted_at DESC NULLS LAST, invited_at DESC LIMIT 1 $$,
  $$ VALUES ('ACCEPTED'::invitation_status, true) $$,
  'Invitation status is ACCEPTED with accepted_at timestamp'
);

-- 60. Replay acceptance fails (contact already accepted / no pending invite)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT accept_recruiter_invitation() $$,
  'P0001',
  'Recruiter contact is already accepted and bound to an account',
  'Replay acceptance attempt is rejected'
);

-- 61. Recruiter cannot re-bind or switch company
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$ SELECT company_id = (SELECT id FROM companies WHERE normalized_name = 'acme architecture corp')
     FROM recruiter_profiles
     WHERE profile_id = '50000000-0000-0000-0000-000000000001' $$,
  ARRAY[true],
  'Recruiter profile remains bound to Acme company'
);

-- 62. Recruiter can SELECT own company via RLS
SELECT results_eq(
  $$ SELECT normalized_name FROM companies $$,
  ARRAY['acme architecture corp'],
  'Recruiter Bob can only read own company'
);

-- 63. Recruiter can SELECT own contact via RLS
SELECT results_eq(
  $$ SELECT email FROM recruiter_contacts $$,
  ARRAY['recruiter.bob@acme.test'],
  'Recruiter Bob can only read own recruiter contact'
);

-- 64. Recruiter CANNOT select other contacts from SAME company (privacy protection)
SELECT is_empty(
  $$ SELECT 1 FROM recruiter_contacts WHERE email = 'recruiter.charlie@acme.test' $$,
  'Recruiter Bob cannot view or enumerate other contacts from same company'
);

-- 65. Recruiter CANNOT select recruiter_invitations directly
SELECT is_empty(
  $$ SELECT 1 FROM recruiter_invitations $$,
  'Recruiter Bob receives 0 rows from recruiter_invitations table directly'
);

-- ============================================================================
-- Section 5: Zero Student Private Data for Recruiter (7 tests)
-- ============================================================================

-- Recruiter Bob context
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- 64. Recruiter receives 0 rows from student_profiles
SELECT results_eq(
  $$ SELECT count(*)::integer FROM student_profiles $$,
  ARRAY[0],
  'Recruiter receives 0 rows from student_profiles'
);

-- 65. Recruiter receives 0 rows from academic_records
SELECT results_eq(
  $$ SELECT count(*)::integer FROM academic_records $$,
  ARRAY[0],
  'Recruiter receives 0 rows from academic_records'
);

-- 66. Recruiter receives 0 rows from documents
SELECT results_eq(
  $$ SELECT count(*)::integer FROM documents $$,
  ARRAY[0],
  'Recruiter receives 0 rows from documents table'
);

-- 67. Recruiter receives 0 rows from student_skills
SELECT results_eq(
  $$ SELECT count(*)::integer FROM student_skills $$,
  ARRAY[0],
  'Recruiter receives 0 rows from student_skills'
);

-- 68. Recruiter receives 0 rows from student_skill_evidence
SELECT results_eq(
  $$ SELECT count(*)::integer FROM student_skill_evidence $$,
  ARRAY[0],
  'Recruiter receives 0 rows from student_skill_evidence'
);

-- 69. Recruiter receives 0 rows from student_roster
SELECT results_eq(
  $$ SELECT count(*)::integer FROM student_roster $$,
  ARRAY[0],
  'Recruiter receives 0 rows from student_roster'
);

-- 70. Recruiter receives 0 rows from audit_logs
SELECT results_eq(
  $$ SELECT count(*)::integer FROM audit_logs $$,
  ARRAY[0],
  'Recruiter receives 0 rows from audit_logs'
);

-- ============================================================================
-- Section 6: Default Deny on Phase 7+ Tables (5 tests)
-- ============================================================================

-- 71. Recruiter receives 0 rows from placement_drives (default-deny preserved)
SELECT results_eq(
  $$ SELECT count(*)::integer FROM placement_drives $$,
  ARRAY[0],
  'Recruiter receives 0 rows from placement_drives in Phase 6'
);

-- 72. Recruiter receives 0 rows from drive_eligibility
SELECT results_eq(
  $$ SELECT count(*)::integer FROM drive_eligibility $$,
  ARRAY[0],
  'Recruiter receives 0 rows from drive_eligibility'
);

-- 73. Recruiter receives 0 rows from drive_eligible_batches
SELECT results_eq(
  $$ SELECT count(*)::integer FROM drive_eligible_batches $$,
  ARRAY[0],
  'Recruiter receives 0 rows from drive_eligible_batches'
);

-- 74. Recruiter receives 0 rows from recruiter_drive_access
SELECT results_eq(
  $$ SELECT count(*)::integer FROM recruiter_drive_access $$,
  ARRAY[0],
  'Recruiter receives 0 rows from recruiter_drive_access'
);

-- 75. Recruiter receives 0 rows from applications
SELECT results_eq(
  $$ SELECT count(*)::integer FROM applications $$,
  ARRAY[0],
  'Recruiter receives 0 rows from applications'
);

-- ============================================================================
-- Section 7: Table Direct Mutation Revocation (12 tests)
-- ============================================================================

-- Recruiter Bob attempts direct table mutations
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- 76. Direct INSERT into companies is revoked
SELECT throws_ok(
  $$ INSERT INTO companies (name, created_by) VALUES ('Direct Corp', '50000000-0000-0000-0000-000000000001') $$,
  '42501',
  NULL,
  'Direct INSERT on companies is revoked'
);

-- 77. Direct UPDATE on companies is revoked
SELECT throws_ok(
  $$ UPDATE companies SET name = 'Direct Corp' $$,
  '42501',
  NULL,
  'Direct UPDATE on companies is revoked'
);

-- 78. Direct DELETE on companies is revoked
SELECT throws_ok(
  $$ DELETE FROM companies $$,
  '42501',
  NULL,
  'Direct DELETE on companies is revoked'
);

-- 79. Direct INSERT into recruiter_contacts is revoked
SELECT throws_ok(
  $$ INSERT INTO recruiter_contacts (company_id, full_name, email, created_by)
     VALUES ('00000000-0000-0000-0000-000000000001', 'Direct', 'direct@test.com', '50000000-0000-0000-0000-000000000001') $$,
  '42501',
  NULL,
  'Direct INSERT on recruiter_contacts is revoked'
);

-- 80. Direct UPDATE on recruiter_contacts is revoked
SELECT throws_ok(
  $$ UPDATE recruiter_contacts SET full_name = 'Direct' $$,
  '42501',
  NULL,
  'Direct UPDATE on recruiter_contacts is revoked'
);

-- 81. Direct DELETE on recruiter_contacts is revoked
SELECT throws_ok(
  $$ DELETE FROM recruiter_contacts $$,
  '42501',
  NULL,
  'Direct DELETE on recruiter_contacts is revoked'
);

-- 82. Direct INSERT into recruiter_invitations is revoked
SELECT throws_ok(
  $$ INSERT INTO recruiter_invitations (recruiter_contact_id, invited_by, expires_at)
     VALUES ('00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', now() + interval '7 days') $$,
  '42501',
  NULL,
  'Direct INSERT on recruiter_invitations is revoked'
);

-- 83. Direct UPDATE on recruiter_invitations is revoked
SELECT throws_ok(
  $$ UPDATE recruiter_invitations SET status = 'ACCEPTED' $$,
  '42501',
  NULL,
  'Direct UPDATE on recruiter_invitations is revoked'
);

-- 84. Direct DELETE on recruiter_invitations is revoked
SELECT throws_ok(
  $$ DELETE FROM recruiter_invitations $$,
  '42501',
  NULL,
  'Direct DELETE on recruiter_invitations is revoked'
);

-- 85. Direct INSERT into recruiter_profiles is revoked
SELECT throws_ok(
  $$ INSERT INTO recruiter_profiles (profile_id, recruiter_contact_id, company_id)
     VALUES ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001') $$,
  '42501',
  NULL,
  'Direct INSERT on recruiter_profiles is revoked'
);

-- 86. Direct UPDATE on recruiter_profiles is revoked
SELECT throws_ok(
  $$ UPDATE recruiter_profiles SET company_id = '00000000-0000-0000-0000-000000000002' $$,
  '42501',
  NULL,
  'Direct UPDATE on recruiter_profiles is revoked'
);

-- 87. Direct DELETE on recruiter_profiles is revoked
SELECT throws_ok(
  $$ DELETE FROM recruiter_profiles $$,
  '42501',
  NULL,
  'Direct DELETE on recruiter_profiles is revoked'
);

-- 88. Direct execution of mark_invitation_delivery_confirmed by authenticated recruiter is revoked
SELECT throws_ok(
  $$ SELECT mark_invitation_delivery_confirmed('00000000-0000-0000-0000-000000000001'::UUID) $$,
  '42501',
  NULL,
  'Direct execution of mark_invitation_delivery_confirmed is revoked from authenticated'
);

-- 89. Direct execution of is_admin_or_secretary by authenticated recruiter is revoked
SELECT throws_ok(
  $$ SELECT is_admin_or_secretary() $$,
  '42501',
  NULL,
  'Direct execution of is_admin_or_secretary is revoked from authenticated'
);

SELECT * FROM finish();
ROLLBACK;
