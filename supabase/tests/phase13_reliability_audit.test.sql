-- Phase 13: Reliability, Errors, and Audit Refinement pgTAP Test Suite
-- Tests:
-- 1. Defense-in-depth metadata privacy trigger (trg_audit_metadata_privacy):
--    - Rejecting forbidden keys: cgpa, backlogs, active_backlogs, snapshot_cgpa, snapshot_backlogs,
--      password, password_hash, token, jwt, otp, invitation_url, signed_url, resume_content
--    - Rejecting oversized metadata (>32KB)
--    - Allowing clean valid metadata
-- 2. get_audit_log_page RPC authorization:
--    - Anon, Student, Recruiter, Coordinator, Inactive staff denied (42501)
--    - Super Admin allowed full access (including administrative actions)
--    - TNP Secretary allowed operational subset only (strictly excludes bootstrap, role changes, config)
--    - Secretary querying explicitly for forbidden actions returns 0 rows
-- 3. Immutability & Bounded pagination:
--    - Direct INSERT/UPDATE/DELETE denied for authenticated users
--    - Deterministic ordering and bounded limit (<= 100)

BEGIN;

SELECT plan(72);

-- ============================================================================
-- 1. Test Fixtures Setup
-- ============================================================================

DO $$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_sec_id   UUID := '20000000-0000-0000-0000-000000000013'::UUID;
  v_coord_id UUID := '30000000-0000-0000-0000-000000000013'::UUID;
  v_stud_id  UUID := '40000000-0000-0000-0000-000000000013'::UUID;
  v_rec_id   UUID := '50000000-0000-0000-0000-000000000013'::UUID;
  v_inact_id UUID := '60000000-0000-0000-0000-000000000013'::UUID;
BEGIN
  -- Insert Auth Users
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (v_admin_id, 'authenticated', 'authenticated', 'admin13@vnit.test'),
    (v_sec_id, 'authenticated', 'authenticated', 'sec13@vnit.test'),
    (v_coord_id, 'authenticated', 'authenticated', 'coord13@vnit.test'),
    (v_stud_id, 'authenticated', 'authenticated', 'stud13@vnit.test'),
    (v_rec_id, 'authenticated', 'authenticated', 'recruiter13@vnit.test'),
    (v_inact_id, 'authenticated', 'authenticated', 'inact13@vnit.test')
  ON CONFLICT (id) DO NOTHING;

  -- Insert Profiles
  INSERT INTO public.profiles (id, role, display_name, is_active, coordinator_slot, student_lifecycle_status) VALUES
    (v_admin_id, 'SUPER_ADMIN', 'Super Admin 13', true, NULL, NULL),
    (v_sec_id, 'TNP_SECRETARY', 'Secretary 13', true, NULL, NULL),
    (v_coord_id, 'TNP_COORDINATOR', 'Coordinator 13', true, 'SLOT_1', NULL),
    (v_stud_id, 'STUDENT', 'Student 13', true, NULL, 'STUDENT_ACTIVE'),
    (v_rec_id, 'RECRUITER', 'Recruiter 13', true, NULL, NULL),
    (v_inact_id, 'TNP_SECRETARY', 'Inactive Staff 13', false, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    is_active = EXCLUDED.is_active,
    coordinator_slot = EXCLUDED.coordinator_slot,
    student_lifecycle_status = EXCLUDED.student_lifecycle_status;

  -- Insert Known Audit Trail Events (Admin events and operational events)
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at) VALUES
    ('a0000000-0000-0000-0000-000000000001'::UUID, v_admin_id, 'BOOTSTRAP_SUPER_ADMIN', 'system', v_admin_id, '{"event": "system_bootstrap"}'::JSONB, NOW() - INTERVAL '10 days'),
    ('a0000000-0000-0000-0000-000000000002'::UUID, v_admin_id, 'ROLE_ASSIGNED', 'profile', v_sec_id, '{"role": "TNP_SECRETARY"}'::JSONB, NOW() - INTERVAL '9 days'),
    ('a0000000-0000-0000-0000-000000000003'::UUID, v_admin_id, 'ROLE_REMOVED', 'profile', v_coord_id, '{"role": "TNP_COORDINATOR"}'::JSONB, NOW() - INTERVAL '8 days'),
    ('a0000000-0000-0000-0000-000000000004'::UUID, v_admin_id, 'SYSTEM_CONFIG', 'system', NULL, '{"maintenance": false}'::JSONB, NOW() - INTERVAL '7 days'),
    ('a0000000-0000-0000-0000-000000000005'::UUID, v_sec_id, 'DRIVE_PUBLISHED', 'placement_drive', '70000000-0000-0000-0000-000000000001'::UUID, '{"title": "Google Placement"}'::JSONB, NOW() - INTERVAL '5 days'),
    ('a0000000-0000-0000-0000-000000000006'::UUID, v_sec_id, 'STATUS_CHANGE', 'application', '80000000-0000-0000-0000-000000000001'::UUID, '{"from": "APPLIED", "to": "SHORTLISTED"}'::JSONB, NOW() - INTERVAL '4 days'),
    ('a0000000-0000-0000-0000-000000000007'::UUID, v_sec_id, 'ANNOUNCEMENT_PUBLISHED', 'announcement', '90000000-0000-0000-0000-000000000001'::UUID, '{"audience": "ALL"}'::JSONB, NOW() - INTERVAL '3 days'),
    ('a0000000-0000-0000-0000-000000000008'::UUID, v_sec_id, 'DATA_EXPORT_REQUESTED', 'export', NULL, '{"export_type": "APPLICATIONS", "row_count": 25}'::JSONB, NOW() - INTERVAL '2 days');

  -- Insert Company and Drives for Phase 13 correction tests
  INSERT INTO public.companies (id, name, normalized_name, created_by) VALUES
    ('60000000-0000-0000-0000-000000000001'::UUID, 'Phase 13 Tech', 'phase 13 tech', v_admin_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.placement_drives (id, company_id, title, drive_type, status, application_deadline, created_by) VALUES
    ('70000000-0000-0000-0000-000000000010'::UUID, '60000000-0000-0000-0000-000000000001'::UUID, 'Draft Drive 13', 'PLACEMENT', 'DRAFT', NOW() + INTERVAL '10 days', v_admin_id),
    ('70000000-0000-0000-0000-000000000011'::UUID, '60000000-0000-0000-0000-000000000001'::UUID, 'Published Drive 13', 'PLACEMENT', 'DRAFT', NOW() + INTERVAL '10 days', v_admin_id),
    ('70000000-0000-0000-0000-000000000012'::UUID, '60000000-0000-0000-0000-000000000001'::UUID, 'Closed Drive 13', 'PLACEMENT', 'DRAFT', NOW() - INTERVAL '1 day', v_admin_id),
    ('70000000-0000-0000-0000-000000000013'::UUID, '60000000-0000-0000-0000-000000000001'::UUID, 'Archived Drive 13', 'PLACEMENT', 'DRAFT', NOW() - INTERVAL '10 days', v_admin_id)
  ON CONFLICT (id) DO NOTHING;

  -- Transition 11 to PUBLISHED
  UPDATE public.placement_drives
  SET status = 'PUBLISHED', published_by = v_admin_id, published_at = NOW() - INTERVAL '2 days'
  WHERE id = '70000000-0000-0000-0000-000000000011'::UUID;

  -- Transition 12 to PUBLISHED then CLOSED
  UPDATE public.placement_drives
  SET status = 'PUBLISHED', published_by = v_admin_id, published_at = NOW() - INTERVAL '5 days'
  WHERE id = '70000000-0000-0000-0000-000000000012'::UUID;
  UPDATE public.placement_drives
  SET status = 'CLOSED', closed_at = NOW() - INTERVAL '1 day'
  WHERE id = '70000000-0000-0000-0000-000000000012'::UUID;

  -- Transition 13 to PUBLISHED then CLOSED then ARCHIVED
  UPDATE public.placement_drives
  SET status = 'PUBLISHED', published_by = v_admin_id, published_at = NOW() - INTERVAL '15 days'
  WHERE id = '70000000-0000-0000-0000-000000000013'::UUID;
  UPDATE public.placement_drives
  SET status = 'CLOSED', closed_at = NOW() - INTERVAL '10 days'
  WHERE id = '70000000-0000-0000-0000-000000000013'::UUID;
  UPDATE public.placement_drives
  SET status = 'ARCHIVED', archived_at = NOW() - INTERVAL '8 days'
  WHERE id = '70000000-0000-0000-0000-000000000013'::UUID;
END;
$$;

-- ============================================================================
-- 2. Schema, Function, and Trigger Existence Tests
-- ============================================================================

SELECT has_trigger(
  'public',
  'audit_logs',
  'trg_audit_metadata_privacy',
  'Trigger trg_audit_metadata_privacy exists on public.audit_logs'
);

SELECT has_function(
  'public',
  'check_audit_metadata_privacy',
  'Trigger function check_audit_metadata_privacy exists'
);

SELECT has_function(
  'public',
  'get_audit_log_page',
  ARRAY['integer', 'integer', 'text', 'text', 'timestamp with time zone', 'timestamp with time zone'],
  'RPC procedure get_audit_log_page exists with expected signature'
);

SELECT has_function(
  'public',
  'correct_published_drive',
  ARRAY['uuid', 'text', 'text', 'text', 'text', 'timestamp with time zone', 'numeric', 'numeric', 'text', 'text'],
  'RPC procedure correct_published_drive exists with expected signature'
);

-- ============================================================================
-- 3. Defense-in-Depth Privacy Guard Trigger Tests (Code 23514)
-- ============================================================================

-- cgpa forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"cgpa": 9.5}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "cgpa" is rejected with 23514'
);

-- backlogs forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"backlogs": 0}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "backlogs" is rejected with 23514'
);

-- active_backlogs forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"active_backlogs": 1}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "active_backlogs" is rejected with 23514'
);

-- snapshot_cgpa forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"snapshot_cgpa": 8.8}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "snapshot_cgpa" is rejected with 23514'
);

-- snapshot_backlogs forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"snapshot_backlogs": 0}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "snapshot_backlogs" is rejected with 23514'
);

-- password forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"password": "secret"}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "password" is rejected with 23514'
);

-- password_hash forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"password_hash": "hash"}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "password_hash" is rejected with 23514'
);

-- token forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"token": "xyz123"}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "token" is rejected with 23514'
);

-- jwt forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"jwt": "eyJhbG..."}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "jwt" is rejected with 23514'
);

-- otp forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"otp": "123456"}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "otp" is rejected with 23514'
);

-- invitation_url forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"invitation_url": "https://..."}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "invitation_url" is rejected with 23514'
);

-- signed_url forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"signed_url": "https://..."}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "signed_url" is rejected with 23514'
);

-- resume_content forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"resume_content": "binary"}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "resume_content" is rejected with 23514'
);

-- Oversized metadata (>32KB) rejected
SELECT throws_ok(
  format(
    $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
       VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', jsonb_build_object('blob', %L)) $$,
    repeat('A', 33000)
  ),
  '23514',
  NULL,
  'Audit metadata > 32KB is rejected with 23514'
);

-- Clean metadata accepted
SELECT lives_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_CLEAN', 'test', '{"status": "OK", "reason": "System verification"}'::JSONB) $$,
  'Clean audit metadata without forbidden keys succeeds'
);

-- Nested forbidden key detection (academic.cgpa)
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"academic": {"cgpa": 8.2}}'::JSONB) $$,
  '23514',
  NULL,
  'Nested audit metadata containing "academic.cgpa" is rejected with 23514'
);

-- Nested forbidden key detection (credentials.token)
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"credentials": {"token": "secret"}}'::JSONB) $$,
  '23514',
  NULL,
  'Nested audit metadata containing "credentials.token" is rejected with 23514'
);

-- Nested forbidden key detection (student.snapshot_backlogs)
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"student": {"snapshot_backlogs": 2}}'::JSONB) $$,
  '23514',
  NULL,
  'Nested audit metadata containing "student.snapshot_backlogs" is rejected with 23514'
);

-- Deeply nested inside array
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"items": [{"token": "nested_in_array"}]}'::JSONB) $$,
  '23514',
  NULL,
  'Deeply nested audit metadata in array element is rejected with 23514'
);

-- Case normalization: uppercase CGPA
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"CGPA": 8.0}'::JSONB) $$,
  '23514',
  NULL,
  'Uppercase "CGPA" key is rejected with 23514'
);

-- Case normalization: title case Token
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"Token": "xyz"}'::JSONB) $$,
  '23514',
  NULL,
  'Titlecase "Token" key is rejected with 23514'
);

-- Case normalization nested: academic.Cgpa
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"academic": {"Cgpa": 7.5}}'::JSONB) $$,
  '23514',
  NULL,
  'Nested mixed-case "academic.Cgpa" key is rejected with 23514'
);

-- Case normalization: mixed case Snapshot_CGPA
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"Snapshot_CGPA": 9.1}'::JSONB) $$,
  '23514',
  NULL,
  'Mixed-case "Snapshot_CGPA" key is rejected with 23514'
);

-- Case normalization: invitation_URL
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"invitation_URL": "https://..."}'::JSONB) $$,
  '23514',
  NULL,
  'Mixed-case "invitation_URL" key is rejected with 23514'
);

-- signed_document_url forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"signed_document_url": "https://..."}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "signed_document_url" is rejected with 23514'
);

-- access_token forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"access_token": "secret_access"}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "access_token" is rejected with 23514'
);

-- refresh_token forbidden
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"refresh_token": "secret_refresh"}'::JSONB) $$,
  '23514',
  NULL,
  'Audit metadata containing "refresh_token" is rejected with 23514'
);

-- Case normalization: mixed case Signed_Document_Url
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"Signed_Document_Url": "https://..."}'::JSONB) $$,
  '23514',
  NULL,
  'Mixed-case "Signed_Document_Url" key is rejected with 23514'
);

-- Case normalization: mixed case Access_Token
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"Access_Token": "tok"}'::JSONB) $$,
  '23514',
  NULL,
  'Mixed-case "Access_Token" key is rejected with 23514'
);

-- Case normalization: mixed case Refresh_Token
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test', '{"Refresh_Token": "tok"}'::JSONB) $$,
  '23514',
  NULL,
  'Mixed-case "Refresh_Token" key is rejected with 23514'
);

-- Fail-closed traversal bound: metadata with >500 nodes and forbidden key after 500 nodes is rejected
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     SELECT '00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test',
            (SELECT jsonb_object_agg('key_' || i, i) FROM generate_series(1, 520) i) || '{"token": "secret"}'::JSONB $$,
  '23514',
  NULL,
  '>500-node metadata with forbidden key after traversal threshold is rejected fail-closed with 23514'
);

-- Fail-closed traversal bound: metadata array with >500 nodes is rejected with 23514
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     SELECT '00000000-0000-0000-0000-000000000001'::UUID, 'TEST_PRIVACY', 'test',
            (SELECT jsonb_agg(jsonb_build_object('item', i)) FROM generate_series(1, 520) i) $$,
  '23514',
  NULL,
  '>500-node array metadata is rejected fail-closed with 23514'
);

-- ============================================================================
-- 4. Authorization Gates for get_audit_log_page (Code 42501)
-- ============================================================================

-- A. Anonymous caller denied
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT * FROM public.get_audit_log_page(50, 0) $$,
  '42501',
  NULL,
  'Anonymous caller is denied with 42501'
);

-- B. Student caller denied
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000013';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000013", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT * FROM public.get_audit_log_page(50, 0) $$,
  '42501',
  NULL,
  'Student caller is denied with 42501'
);

-- C. Recruiter caller denied
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000013';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000013", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT * FROM public.get_audit_log_page(50, 0) $$,
  '42501',
  NULL,
  'Recruiter caller is denied with 42501'
);

-- D. Coordinator caller denied
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000013';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000013", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT * FROM public.get_audit_log_page(50, 0) $$,
  '42501',
  NULL,
  'Coordinator caller is denied with 42501'
);

-- E. Inactive Secretary denied
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '60000000-0000-0000-0000-000000000013';
SET LOCAL "request.jwt.claims" = '{"sub": "60000000-0000-0000-0000-000000000013", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT * FROM public.get_audit_log_page(50, 0) $$,
  '42501',
  NULL,
  'Inactive staff caller is denied with 42501'
);

-- ============================================================================
-- 5. Secretary Role Scope & Exclusions
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000013';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000013", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT * FROM public.get_audit_log_page(50, 0) $$,
  'Active TNP Secretary executes get_audit_log_page successfully'
);

-- Secretary strictly cannot see administrative actions
SELECT is(
  (SELECT count(*)::integer FROM public.get_audit_log_page(50, 0) WHERE action IN ('BOOTSTRAP_SUPER_ADMIN', 'ROLE_ASSIGNED', 'ROLE_REMOVED', 'SYSTEM_CONFIG')),
  0,
  'Secretary result set strictly excludes BOOTSTRAP_SUPER_ADMIN, ROLE_ASSIGNED, ROLE_REMOVED, SYSTEM_CONFIG'
);

-- Secretary querying explicitly for BOOTSTRAP_SUPER_ADMIN returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.get_audit_log_page(50, 0, 'BOOTSTRAP_SUPER_ADMIN')),
  0,
  'Secretary querying for BOOTSTRAP_SUPER_ADMIN returns 0 rows'
);

-- Secretary querying explicitly for ROLE_ASSIGNED returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.get_audit_log_page(50, 0, 'ROLE_ASSIGNED')),
  0,
  'Secretary querying for ROLE_ASSIGNED returns 0 rows'
);

-- Secretary querying explicitly for ROLE_REMOVED returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.get_audit_log_page(50, 0, 'ROLE_REMOVED')),
  0,
  'Secretary querying for ROLE_REMOVED returns 0 rows'
);

-- Secretary querying explicitly for SYSTEM_CONFIG returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.get_audit_log_page(50, 0, 'SYSTEM_CONFIG')),
  0,
  'Secretary querying for SYSTEM_CONFIG returns 0 rows'
);

-- Secretary sees operational logs (e.g. DRIVE_PUBLISHED, STATUS_CHANGE, ANNOUNCEMENT_PUBLISHED)
SELECT cmp_ok(
  (SELECT count(*)::integer FROM public.get_audit_log_page(50, 0)),
  '>=',
  4,
  'Secretary sees at least 4 operational audit logs'
);

-- ============================================================================
-- 6. Super Admin Full Audit Trail & Capabilities
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT * FROM public.get_audit_log_page(50, 0) $$,
  'Super Admin executes get_audit_log_page successfully'
);

-- Super Admin can see administrative events
SELECT cmp_ok(
  (SELECT count(*)::integer FROM public.get_audit_log_page(50, 0) WHERE action IN ('BOOTSTRAP_SUPER_ADMIN', 'ROLE_ASSIGNED', 'ROLE_REMOVED', 'SYSTEM_CONFIG')),
  '>=',
  4,
  'Super Admin sees administrative events in full audit log'
);

-- Super Admin explicit filter for ROLE_ASSIGNED returns records
SELECT is(
  (SELECT action FROM public.get_audit_log_page(50, 0, 'ROLE_ASSIGNED') LIMIT 1),
  'ROLE_ASSIGNED',
  'Super Admin querying for ROLE_ASSIGNED retrieves the audit record'
);

-- Total count window function returns overall match count
SELECT cmp_ok(
  (SELECT total_count FROM public.get_audit_log_page(2, 0) LIMIT 1)::integer,
  '>=',
  8,
  'Windowed total_count reports total matching rows despite limit = 2'
);

-- Bounded page size (limit 2 returns at most 2 rows)
SELECT is(
  (SELECT count(*)::integer FROM public.get_audit_log_page(2, 0)),
  2,
  'Limit = 2 correctly restricts returned row count'
);

-- Offset pagination advances
SELECT isnt(
  (SELECT id FROM public.get_audit_log_page(1, 0) LIMIT 1),
  (SELECT id FROM public.get_audit_log_page(1, 1) LIMIT 1),
  'Offset advances to distinct log item'
);

-- ============================================================================
-- 7. Audit Log Immutability for Authenticated Roles
-- ============================================================================

-- Authenticated user cannot direct UPDATE audit_logs
SELECT throws_ok(
  $$ UPDATE public.audit_logs SET action = 'TAMPERED' WHERE id = 'a0000000-0000-0000-0000-000000000001'::UUID $$,
  '42501',
  NULL,
  'Direct UPDATE on audit_logs is denied (42501)'
);

-- Authenticated user cannot direct DELETE from audit_logs
SELECT throws_ok(
  $$ DELETE FROM public.audit_logs WHERE id = 'a0000000-0000-0000-0000-000000000001'::UUID $$,
  '42501',
  NULL,
  'Direct DELETE on audit_logs is denied (42501)'
);

-- Authenticated user cannot direct INSERT into audit_logs
SELECT throws_ok(
  $$ INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
     VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'DIRECT_INSERT', 'test', '{}'::JSONB) $$,
  '42501',
  NULL,
  'Direct INSERT on audit_logs is denied (42501)'
);

-- ============================================================================
-- 8. Audited Published Drive Correction Tests (correct_published_drive)
-- ============================================================================

-- A. Anonymous caller denied (42501)
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.correct_published_drive(
       '70000000-0000-0000-0000-000000000011'::UUID,
       'Anonymous attempt to correct drive'
     ) $$,
  '42501',
  NULL,
  'Anonymous caller is denied correcting published drive with 42501'
);

-- B. Student caller denied (42501)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000013';
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000013", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.correct_published_drive(
       '70000000-0000-0000-0000-000000000011'::UUID,
       'Student attempt to correct drive'
     ) $$,
  '42501',
  NULL,
  'Student caller is denied correcting published drive with 42501'
);

-- C. Recruiter caller denied (42501)
SET LOCAL "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000013';
SET LOCAL "request.jwt.claims" = '{"sub": "50000000-0000-0000-0000-000000000013", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.correct_published_drive(
       '70000000-0000-0000-0000-000000000011'::UUID,
       'Recruiter attempt to correct drive'
     ) $$,
  '42501',
  NULL,
  'Recruiter caller is denied correcting published drive with 42501'
);

-- D. Coordinator caller denied (42501)
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000013';
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000013", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.correct_published_drive(
       '70000000-0000-0000-0000-000000000011'::UUID,
       'Coordinator attempt to correct drive'
     ) $$,
  '42501',
  NULL,
  'Coordinator caller is denied correcting published drive with 42501'
);

-- E. Inactive Secretary denied (42501)
SET LOCAL "request.jwt.claim.sub" = '60000000-0000-0000-0000-000000000013';
SET LOCAL "request.jwt.claims" = '{"sub": "60000000-0000-0000-0000-000000000013", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.correct_published_drive(
       '70000000-0000-0000-0000-000000000011'::UUID,
       'Inactive staff attempt to correct drive'
     ) $$,
  '42501',
  NULL,
  'Inactive staff caller is denied correcting published drive with 42501'
);

-- F. Secretary on DRAFT drive denied (22023)
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000013';
SET LOCAL "request.jwt.claims" = '{"sub": "20000000-0000-0000-0000-000000000013", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.correct_published_drive(
       '70000000-0000-0000-0000-000000000010'::UUID,
       'Secretary correcting draft drive'
     ) $$,
  '22023',
  NULL,
  'Correcting DRAFT drive via published correction RPC is rejected with 22023'
);

-- G. Secretary on CLOSED drive denied (22023)
SELECT throws_ok(
  $$ SELECT public.correct_published_drive(
       '70000000-0000-0000-0000-000000000012'::UUID,
       'Secretary correcting closed drive'
     ) $$,
  '22023',
  NULL,
  'Correcting CLOSED drive is rejected with 22023'
);

-- H. Secretary on ARCHIVED drive denied (22023)
SELECT throws_ok(
  $$ SELECT public.correct_published_drive(
       '70000000-0000-0000-0000-000000000013'::UUID,
       'Secretary correcting archived drive'
     ) $$,
  '22023',
  NULL,
  'Correcting ARCHIVED drive is rejected with 22023'
);

-- I. Missing or too short reason rejected (22023)
SELECT throws_ok(
  $$ SELECT public.correct_published_drive(
       '70000000-0000-0000-0000-000000000011'::UUID,
       'bad'
     ) $$,
  '22023',
  NULL,
  'Correction with reason < 5 chars is rejected with 22023'
);

-- J. Direct table UPDATE on published drive remains denied for staff (42501)
SELECT throws_ok(
  $$ UPDATE public.placement_drives SET title = 'Direct Attack' WHERE id = '70000000-0000-0000-0000-000000000011'::UUID $$,
  '42501',
  NULL,
  'Direct UPDATE on placement_drives is denied for authenticated staff (42501)'
);

-- K. Secretary correction succeeds on PUBLISHED drive
SELECT lives_ok(
  $$ SELECT public.correct_published_drive(
       '70000000-0000-0000-0000-000000000011'::UUID,
       'Corrected title and deadline per corporate request',
       'Published Drive 13 Corrected',
       NULL,
       'Nagpur Office',
       NOW() + INTERVAL '14 days'
     ) $$,
  'Secretary can correct published drive with valid reason and fields'
);

-- L. Super Admin correction succeeds on PUBLISHED drive
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ SELECT public.correct_published_drive(
       '70000000-0000-0000-0000-000000000011'::UUID,
       'Super Admin administrative correction',
       'Published Drive 13 Final',
       'Updated role description',
       'Pune Campus'
     ) $$,
  'Super Admin can correct published drive with valid reason and fields'
);

-- M. State machine integrity: Status remains PUBLISHED and published_at is preserved
SELECT is(
  (SELECT status FROM public.placement_drives WHERE id = '70000000-0000-0000-0000-000000000011'::UUID)::TEXT,
  'PUBLISHED',
  'Drive status remains PUBLISHED after correction'
);

SELECT ok(
  (SELECT published_at FROM public.placement_drives WHERE id = '70000000-0000-0000-0000-000000000011'::UUID) < NOW() - INTERVAL '1 day',
  'Original publication timestamp published_at is preserved'
);

-- N. Audit trail: DRIVE_CORRECTED_PUBLISHED is recorded
SELECT ok(
  EXISTS(
    SELECT 1 FROM public.audit_logs
    WHERE action = 'DRIVE_CORRECTED_PUBLISHED'
      AND entity_id = '70000000-0000-0000-0000-000000000011'::UUID
  ),
  'DRIVE_CORRECTED_PUBLISHED event is recorded in audit_logs'
);

SELECT * FROM finish();
ROLLBACK;
