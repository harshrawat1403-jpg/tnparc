-- Phase 11 — Announcements Test Suite
-- Tests institutional announcement creation, draft editing, publishing, archiving,
-- strict audience targeting (ALL, STUDENTS, RECRUITERS, STAFF),
-- student lifecycle isolation (STUDENT_ACTIVE vs STUDENT_GRADUATED vs ALUMNI),
-- strict database-time expiry boundary semantics,
-- immutable published records, draft/archived privacy, staff management RPC,
-- role escalation denials, and base table mutation protection.

BEGIN;

SELECT plan(76);

-- ============================================================================
-- Fixtures Setup
-- ============================================================================

DO $$
DECLARE
  v_admin_id     UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_sec_id       UUID := '20000000-0000-0000-0000-000000000001'::UUID;
  v_coord_id     UUID := '30000000-0000-0000-0000-000000000001'::UUID;
  v_stud_active  UUID := '40000000-0000-0000-0000-000000000011'::UUID;
  v_stud_grad    UUID := '40000000-0000-0000-0000-000000000012'::UUID;
  v_stud_alum    UUID := '40000000-0000-0000-0000-000000000013'::UUID;
  v_recruiter_id UUID := '50000000-0000-0000-0000-000000000001'::UUID;
  v_deact_id     UUID := '00000000-0000-0000-0000-000000000099'::UUID;
BEGIN
  -- Auth Users
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (v_admin_id, 'authenticated', 'authenticated', 'admin11@vnit.test'),
    (v_sec_id, 'authenticated', 'authenticated', 'sec11@vnit.test'),
    (v_coord_id, 'authenticated', 'authenticated', 'coord11@vnit.test'),
    (v_stud_active, 'authenticated', 'authenticated', 'stud11_active@vnit.test'),
    (v_stud_grad, 'authenticated', 'authenticated', 'stud11_grad@vnit.test'),
    (v_stud_alum, 'authenticated', 'authenticated', 'stud11_alum@vnit.test'),
    (v_recruiter_id, 'authenticated', 'authenticated', 'recruiter11@vnit.test'),
    (v_deact_id, 'authenticated', 'authenticated', 'deact11@vnit.test')
  ON CONFLICT (id) DO NOTHING;

  -- Profiles
  INSERT INTO public.profiles (id, role, display_name, is_active, coordinator_slot, student_lifecycle_status) VALUES
    (v_admin_id, 'SUPER_ADMIN', 'Super Admin 11', true, NULL, NULL),
    (v_sec_id, 'TNP_SECRETARY', 'Secretary 11', true, NULL, NULL),
    (v_coord_id, 'TNP_COORDINATOR', 'Coordinator 11', true, 'SLOT_1', NULL),
    (v_stud_active, 'STUDENT', 'Active Student 11', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud_grad, 'STUDENT', 'Graduated Student 11', true, NULL, 'STUDENT_GRADUATED'),
    (v_stud_alum, 'STUDENT', 'Alumni 11', true, NULL, 'ALUMNI'),
    (v_recruiter_id, 'RECRUITER', 'Recruiter 11', true, NULL, NULL),
    (v_deact_id, 'SUPER_ADMIN', 'Deactivated Admin 11', false, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    is_active = EXCLUDED.is_active,
    coordinator_slot = EXCLUDED.coordinator_slot,
    student_lifecycle_status = EXCLUDED.student_lifecycle_status;
END $$;

-- ============================================================================
-- Test 1: Schema Integrity & RLS Verification
-- ============================================================================

SELECT has_table('public', 'announcements', 'announcements table exists');
SELECT ok(relrowsecurity AND relforcerowsecurity, 'announcements table has RLS enabled and forced')
FROM pg_class WHERE relname = 'announcements';

SELECT has_function('public', 'can_view_announcement', 'can_view_announcement function exists');
SELECT has_function('public', 'create_announcement', 'create_announcement procedure exists');
SELECT has_function('public', 'update_draft_announcement', 'update_draft_announcement procedure exists');
SELECT has_function('public', 'publish_announcement', 'publish_announcement procedure exists');
SELECT has_function('public', 'archive_announcement', 'archive_announcement procedure exists');
SELECT has_function('public', 'get_my_announcements', 'get_my_announcements RPC exists');
SELECT has_function('public', 'get_staff_announcements', 'get_staff_announcements RPC exists');
SELECT hasnt_function('public', 'delete_announcement', 'delete_announcement procedure is not present');

-- ============================================================================
-- Test 2: Direct Client Base Table Mutation Denials (INSERT, UPDATE, DELETE)
-- ============================================================================

-- Authenticated student attempts direct INSERT on announcements
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000011';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000011", "role": "authenticated"}';

SELECT throws_ok(
  $$ INSERT INTO public.announcements (title, body, audience, created_by)
     VALUES ('Hacked Title', 'Hacked Body', 'ALL', '40000000-0000-0000-0000-000000000011') $$,
  '42501',
  NULL,
  'Student direct INSERT on announcements base table is denied'
);

SELECT throws_ok(
  $$ UPDATE public.announcements SET title = 'Pwned' $$,
  '42501',
  NULL,
  'Student direct UPDATE on announcements base table is denied'
);

SELECT throws_ok(
  $$ DELETE FROM public.announcements $$,
  '42501',
  NULL,
  'Student direct DELETE on announcements base table is denied'
);

-- ============================================================================
-- Test 3: Role Escalation Denials on Privileged RPCs
-- ============================================================================

-- 3a. Student cannot create announcement
SELECT throws_ok(
  $$ SELECT public.create_announcement('Test Title', 'Test Body', 'ALL') $$,
  '42501',
  NULL,
  'Student cannot create announcement'
);

-- 3b. Recruiter cannot create announcement
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT public.create_announcement('Recruiter Title', 'Recruiter Body', 'RECRUITERS') $$,
  '42501',
  NULL,
  'Recruiter cannot create announcement'
);

-- 3c. Coordinator cannot create announcement
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT public.create_announcement('Coord Title', 'Coord Body', 'STAFF') $$,
  '42501',
  NULL,
  'Coordinator cannot create announcement'
);

SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_announcements() $$,
  '42501',
  NULL,
  'Coordinator cannot access staff announcement management view'
);

-- 3d. Deactivated Super Admin cannot create announcement
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000099';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT public.create_announcement('Deact Title', 'Deact Body', 'ALL') $$,
  '42501',
  NULL,
  'Deactivated admin cannot create announcement'
);

-- ============================================================================
-- Test 4: Super Admin / Secretary Creation & Input Bound Validations
-- ============================================================================

SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Blank title rejected
SELECT throws_ok(
  $$ SELECT public.create_announcement('   ', 'Valid body', 'ALL') $$,
  '22023',
  NULL,
  'Empty announcement title is rejected'
);

-- Excessively long title (>200 chars) rejected
SELECT throws_ok(
  $$ SELECT public.create_announcement(repeat('A', 201), 'Valid body', 'ALL') $$,
  '22023',
  NULL,
  'Announcement title > 200 chars is rejected'
);

-- Blank body rejected
SELECT throws_ok(
  $$ SELECT public.create_announcement('Valid Title', '   ', 'ALL') $$,
  '22023',
  NULL,
  'Empty announcement body is rejected'
);

-- Past expiry rejected
SELECT throws_ok(
  $$ SELECT public.create_announcement('Valid Title', 'Valid Body', 'ALL', now() - interval '1 hour') $$,
  '22023',
  NULL,
  'Past expiry timestamp is rejected on creation'
);

-- Valid announcement creation by Super Admin
SELECT lives_ok(
  $$ SELECT public.create_announcement('Orientation Notice', 'Welcome to campus placement session 2026-27', 'ALL') $$,
  'Super Admin creates valid announcement draft'
);

-- Verify created row in table
SELECT is(
  (SELECT status FROM public.announcements WHERE title = 'Orientation Notice'),
  'DRAFT'::announcement_status,
  'New announcement starts in DRAFT status'
);

SELECT is(
  (SELECT published_at FROM public.announcements WHERE title = 'Orientation Notice'),
  NULL,
  'Draft announcement has NULL published_at'
);

SELECT is(
  (SELECT created_by FROM public.announcements WHERE title = 'Orientation Notice'),
  '00000000-0000-0000-0000-000000000001'::UUID,
  'created_by derives automatically from caller auth.uid()'
);

-- Verify audit log
SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs WHERE action = 'ANNOUNCEMENT_CREATED'),
  1,
  'ANNOUNCEMENT_CREATED audit event logged'
);

-- TNP Secretary can also create announcement
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT public.create_announcement('Secretary Notice', 'Notice from TNP Secretary office', 'STAFF') $$,
  'TNP Secretary creates valid announcement draft'
);

-- ============================================================================
-- Test 5: Draft Update Procedure & Row Locking
-- ============================================================================

DO $$
DECLARE
  v_draft_id UUID;
BEGIN
  SELECT id INTO v_draft_id FROM public.announcements WHERE title = 'Orientation Notice';

  PERFORM public.update_draft_announcement(
    v_draft_id,
    'Updated Orientation Notice',
    'Updated body content with new venue details',
    'ALL',
    now() + interval '7 days'
  );
END $$;

SELECT is(
  (SELECT title FROM public.announcements WHERE id = (SELECT id FROM public.announcements WHERE title = 'Updated Orientation Notice')),
  'Updated Orientation Notice',
  'Draft title updated successfully'
);

SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs WHERE action = 'ANNOUNCEMENT_UPDATED'),
  1,
  'ANNOUNCEMENT_UPDATED audit event logged'
);

-- Non-existent ID rejected
SELECT throws_ok(
  $$ SELECT public.update_draft_announcement('ffffffff-ffff-ffff-ffff-ffffffffffff'::UUID, 'Title', 'Body', 'ALL') $$,
  'P0002',
  NULL,
  'Updating non-existent announcement raises P0002'
);

-- ============================================================================
-- Test 6: Publication State Machine & Immutability
-- ============================================================================

DO $$
DECLARE
  v_draft_id UUID;
BEGIN
  SELECT id INTO v_draft_id FROM public.announcements WHERE title = 'Updated Orientation Notice';
  PERFORM public.publish_announcement(v_draft_id);
END $$;

SELECT is(
  (SELECT status FROM public.announcements WHERE title = 'Updated Orientation Notice'),
  'PUBLISHED'::announcement_status,
  'Announcement transitioned to PUBLISHED status'
);

SELECT isnt(
  (SELECT published_at FROM public.announcements WHERE title = 'Updated Orientation Notice'),
  NULL,
  'Published announcement has database-managed published_at set'
);

SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs WHERE action = 'ANNOUNCEMENT_PUBLISHED'),
  1,
  'ANNOUNCEMENT_PUBLISHED audit event logged'
);

-- Immutability check: cannot edit published announcement
SELECT throws_ok(
  $$ SELECT public.update_draft_announcement(
       (SELECT id FROM public.announcements WHERE title = 'Updated Orientation Notice'),
       'Illegally Changed Title',
       'Illegal body',
       'ALL'
     ) $$,
  '22023',
  NULL,
  'Editing a PUBLISHED announcement is strictly forbidden'
);

-- Re-publishing already published announcement fails
SELECT throws_ok(
  $$ SELECT public.publish_announcement(
       (SELECT id FROM public.announcements WHERE title = 'Updated Orientation Notice')
     ) $$,
  '22023',
  NULL,
  'Re-publishing a PUBLISHED announcement is rejected'
);

-- ============================================================================
-- Test 7: Archiving Procedure & Idempotency
-- ============================================================================

DO $$
DECLARE
  v_pub_id UUID;
BEGIN
  SELECT id INTO v_pub_id FROM public.announcements WHERE title = 'Updated Orientation Notice';
  PERFORM public.archive_announcement(v_pub_id);
END $$;

SELECT is(
  (SELECT status FROM public.announcements WHERE title = 'Updated Orientation Notice'),
  'ARCHIVED'::announcement_status,
  'Announcement transitioned to ARCHIVED status'
);

SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs WHERE action = 'ANNOUNCEMENT_ARCHIVED'),
  1,
  'ANNOUNCEMENT_ARCHIVED audit event logged'
);

-- Repeated archive on ARCHIVED is idempotent without error
SELECT lives_ok(
  $$ SELECT public.archive_announcement(
       (SELECT id FROM public.announcements WHERE title = 'Updated Orientation Notice')
     ) $$,
  'Repeated archive attempt is idempotent'
);

-- Publishing an ARCHIVED announcement is strictly rejected
SELECT throws_ok(
  $$ SELECT public.publish_announcement(
       (SELECT id FROM public.announcements WHERE title = 'Updated Orientation Notice')
     ) $$,
  '22023',
  NULL,
  'Publishing an ARCHIVED announcement is rejected'
);

-- ============================================================================
-- Test 8: Multi-Audience Fixtures for Audience & Lifecycle Matrix
-- ============================================================================

SET LOCAL ROLE postgres;

DO $$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_id_all   UUID;
  v_id_stud  UUID;
  v_id_rec   UUID;
  v_id_stf   UUID;
  v_id_draft UUID;
  v_id_arch  UUID;
  v_id_exp   UUID;
BEGIN
  -- 1. Published ALL
  INSERT INTO public.announcements (title, body, audience, status, published_at, created_by)
  VALUES ('Notice for All', 'Broadcast to all campus members', 'ALL', 'PUBLISHED', now(), v_admin_id);

  -- 2. Published STUDENTS
  INSERT INTO public.announcements (title, body, audience, status, published_at, created_by)
  VALUES ('Student Placement Drive Notice', 'Only for active students', 'STUDENTS', 'PUBLISHED', now(), v_admin_id);

  -- 3. Published RECRUITERS
  INSERT INTO public.announcements (title, body, audience, status, published_at, created_by)
  VALUES ('Recruiter Guidelines 2026', 'Guidelines for interview panel', 'RECRUITERS', 'PUBLISHED', now(), v_admin_id);

  -- 4. Published STAFF
  INSERT INTO public.announcements (title, body, audience, status, published_at, created_by)
  VALUES ('Staff Meeting Schedule', 'Department meeting in Hall A', 'STAFF', 'PUBLISHED', now(), v_admin_id);

  -- 5. Draft Notice
  INSERT INTO public.announcements (title, body, audience, status, published_at, created_by)
  VALUES ('Unpublished Draft', 'Work in progress draft notice', 'ALL', 'DRAFT', NULL, v_admin_id);

  -- 6. Expired Notice (expires_at in past)
  INSERT INTO public.announcements (title, body, audience, status, published_at, expires_at, created_by)
  VALUES ('Expired Drive Registration', 'Registration deadline passed', 'ALL', 'PUBLISHED', now() - interval '2 days', now() - interval '1 hour', v_admin_id);

  -- 7. Future Expiry Notice (expires_at in future)
  INSERT INTO public.announcements (title, body, audience, status, published_at, expires_at, created_by)
  VALUES ('Valid Future Notice', 'Registration open until next week', 'ALL', 'PUBLISHED', now(), now() + interval '5 days', v_admin_id);
END $$;

-- ============================================================================
-- Test 9: Audience Visibility Matrix for STUDENT_ACTIVE
-- ============================================================================

SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000011';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000011", "role": "authenticated"}';

-- Can see ALL notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Notice for All'),
  1,
  'STUDENT_ACTIVE sees ALL announcement'
);

-- Can see STUDENTS notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Student Placement Drive Notice'),
  1,
  'STUDENT_ACTIVE sees STUDENTS announcement'
);

-- CANNOT see RECRUITERS notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Recruiter Guidelines 2026'),
  0,
  'STUDENT_ACTIVE CANNOT see RECRUITERS announcement'
);

-- CANNOT see STAFF notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Staff Meeting Schedule'),
  0,
  'STUDENT_ACTIVE CANNOT see STAFF announcement'
);

-- CANNOT see DRAFT notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Unpublished Draft'),
  0,
  'STUDENT_ACTIVE CANNOT see DRAFT announcement'
);

-- CANNOT see EXPIRED notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Expired Drive Registration'),
  0,
  'STUDENT_ACTIVE CANNOT see EXPIRED announcement'
);

-- CAN see active announcement with future expiry
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Valid Future Notice'),
  1,
  'STUDENT_ACTIVE sees announcement with future expires_at'
);

-- ============================================================================
-- Test 10: Audience Visibility Matrix for STUDENT_GRADUATED
-- ============================================================================

SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000012';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000012", "role": "authenticated"}';

-- Can see ALL notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Notice for All'),
  1,
  'STUDENT_GRADUATED sees ALL announcement'
);

-- CANNOT see STUDENTS notice (placement privileges ended)
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Student Placement Drive Notice'),
  0,
  'STUDENT_GRADUATED CANNOT see STUDENTS placement announcement'
);

-- CANNOT see RECRUITERS notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Recruiter Guidelines 2026'),
  0,
  'STUDENT_GRADUATED CANNOT see RECRUITERS announcement'
);

-- CANNOT see STAFF notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Staff Meeting Schedule'),
  0,
  'STUDENT_GRADUATED CANNOT see STAFF announcement'
);

-- ============================================================================
-- Test 11: Audience Visibility Matrix for ALUMNI
-- ============================================================================

SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000013';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000013", "role": "authenticated"}';

-- Can see ALL notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Notice for All'),
  1,
  'ALUMNI sees ALL announcement'
);

-- CANNOT see STUDENTS notice (alumni do not receive student placement notices)
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Student Placement Drive Notice'),
  0,
  'ALUMNI CANNOT see STUDENTS announcement'
);

-- CANNOT see RECRUITERS notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Recruiter Guidelines 2026'),
  0,
  'ALUMNI CANNOT see RECRUITERS announcement'
);

-- CANNOT see STAFF notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Staff Meeting Schedule'),
  0,
  'ALUMNI CANNOT see STAFF announcement'
);

-- ============================================================================
-- Test 12: Audience Visibility Matrix for RECRUITER
-- ============================================================================

SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Can see ALL notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Notice for All'),
  1,
  'RECRUITER sees ALL announcement'
);

-- Can see RECRUITERS notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Recruiter Guidelines 2026'),
  1,
  'RECRUITER sees RECRUITERS announcement'
);

-- CANNOT see STUDENTS notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Student Placement Drive Notice'),
  0,
  'RECRUITER CANNOT see STUDENTS announcement'
);

-- CANNOT see STAFF notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Staff Meeting Schedule'),
  0,
  'RECRUITER CANNOT see STAFF announcement'
);

-- CANNOT see DRAFT notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Unpublished Draft'),
  0,
  'RECRUITER CANNOT see DRAFT announcement'
);

-- ============================================================================
-- Test 13: Audience Visibility Matrix for TNP_COORDINATOR
-- ============================================================================

SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Can see ALL notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Notice for All'),
  1,
  'COORDINATOR sees ALL announcement'
);

-- Can see STAFF notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Staff Meeting Schedule'),
  1,
  'COORDINATOR sees STAFF announcement'
);

-- CANNOT see STUDENTS notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Student Placement Drive Notice'),
  0,
  'COORDINATOR CANNOT see STUDENTS announcement'
);

-- CANNOT see RECRUITERS notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Recruiter Guidelines 2026'),
  0,
  'COORDINATOR CANNOT see RECRUITERS announcement'
);

-- CANNOT see DRAFT notice
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Unpublished Draft'),
  0,
  'COORDINATOR CANNOT see DRAFT announcement'
);

-- ============================================================================
-- Test 14: Super Admin / Secretary Staff Management View
-- ============================================================================

SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Super Admin ordinary feed sees ALL and STAFF
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Notice for All'),
  1,
  'SUPER_ADMIN ordinary feed sees ALL notice'
);

SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Staff Meeting Schedule'),
  1,
  'SUPER_ADMIN ordinary feed sees STAFF notice'
);

-- Super Admin management view sees ALL announcements including drafts, archived, and expired
SELECT ok(
  (SELECT count(*)::integer FROM public.get_staff_announcements()) >= 6,
  'SUPER_ADMIN management view returns all statuses and audiences'
);

-- Filter by status = 'DRAFT'
SELECT is(
  (SELECT count(*)::integer FROM public.get_staff_announcements('DRAFT')),
  2,
  'Management view filters by DRAFT status'
);

-- Filter by audience = 'STAFF'
SELECT is(
  (SELECT count(*)::integer FROM public.get_staff_announcements(NULL, 'STAFF')),
  2,
  'Management view filters by STAFF audience'
);

-- Verify creator_name is joined
SELECT isnt(
  (SELECT creator_name FROM public.get_staff_announcements() WHERE title = 'Notice for All'),
  NULL,
  'Management view includes non-null creator_name'
);

-- ============================================================================
-- Test 15: Expiry Boundary Semantics
-- ============================================================================

SET LOCAL ROLE postgres;

DO $$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
  -- Insert notice expiring exactly at current transaction time
  INSERT INTO public.announcements (title, body, audience, status, published_at, expires_at, created_by)
  VALUES ('Boundary Exactly Now', 'Expires right now', 'ALL', 'PUBLISHED', now() - interval '1 hour', now(), v_admin_id);

  -- Insert notice expiring 1 second in the future
  INSERT INTO public.announcements (title, body, audience, status, published_at, expires_at, created_by)
  VALUES ('Boundary One Sec Future', 'Expires 1 second in future', 'ALL', 'PUBLISHED', now(), now() + interval '10 seconds', v_admin_id);
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000011';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000011", "role": "authenticated"}';

-- Notice expiring exactly now is NOT visible (expires_at <= now() boundary)
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Boundary Exactly Now'),
  0,
  'Announcement expiring exactly now is NOT visible'
);

-- Notice expiring in the future IS visible
SELECT is(
  (SELECT count(*)::integer FROM public.get_my_announcements() WHERE title = 'Boundary One Sec Future'),
  1,
  'Announcement expiring in the future IS visible'
);

-- ============================================================================
-- Test 16: Anonymous RLS Base Table Denials
-- ============================================================================

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '{"role": "anon"}';

SELECT is(
  (SELECT count(*)::integer FROM public.announcements),
  0,
  'Anonymous SELECT on announcements table returns 0 rows via RLS'
);

-- Anonymous cannot invoke get_my_announcements
SELECT throws_ok(
  $$ SELECT * FROM public.get_my_announcements() $$,
  '42501',
  NULL,
  'Anonymous cannot execute get_my_announcements'
);

-- Anonymous cannot invoke get_staff_announcements
SELECT throws_ok(
  $$ SELECT * FROM public.get_staff_announcements() $$,
  '42501',
  NULL,
  'Anonymous cannot execute get_staff_announcements'
);

SELECT * FROM finish();
ROLLBACK;
