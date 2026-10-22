-- Phase 9 — Public Batch Showcase Test Suite
-- Tests narrow public RPCs, anonymous RLS base table denials, student privacy toggles,
-- slug immutability, Super Admin recovery, and staff public audit view scoping.

BEGIN;

SELECT plan(79);

-- ============================================================================
-- Fixtures Setup
-- ============================================================================

DO $$
DECLARE
  v_admin_id      UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_sec_id        UUID := '20000000-0000-0000-0000-000000000001'::UUID;
  v_coord_id      UUID := '30000000-0000-0000-0000-000000000001'::UUID;
  v_stud1_id      UUID := '40000000-0000-0000-0000-000000000001'::UUID; -- Alice: BARCH 2026
  v_stud2_id      UUID := '40000000-0000-0000-0000-000000000002'::UUID; -- Bob: MPLAN 2026
  v_stud3_id      UUID := '40000000-0000-0000-0000-000000000003'::UUID; -- Charlie: BARCH 2026 (No slug initially)
  v_stud4_id      UUID := '40000000-0000-0000-0000-000000000004'::UUID; -- Dave: BARCH 2026 (Private)

  v_prog_barch_id UUID;
  v_prog_mplan_id UUID;
  v_skill_id      UUID;
BEGIN
  -- Programs lookup
  SELECT id INTO v_prog_barch_id FROM academic_programs WHERE code = 'BARCH';
  SELECT id INTO v_prog_mplan_id FROM academic_programs WHERE code = 'MPLAN';

  -- Auth Users
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (v_admin_id, 'authenticated', 'authenticated', 'admin@vnit.test'),
    (v_sec_id, 'authenticated', 'authenticated', 'sec@vnit.test'),
    (v_coord_id, 'authenticated', 'authenticated', 'coord@vnit.test'),
    (v_stud1_id, 'authenticated', 'authenticated', 'alice@vnit.test'),
    (v_stud2_id, 'authenticated', 'authenticated', 'bob@vnit.test'),
    (v_stud3_id, 'authenticated', 'authenticated', 'charlie@vnit.test'),
    (v_stud4_id, 'authenticated', 'authenticated', 'dave@vnit.test')
  ON CONFLICT (id) DO NOTHING;

  -- Profiles
  INSERT INTO profiles (id, role, display_name, is_active, coordinator_slot, student_lifecycle_status) VALUES
    (v_admin_id, 'SUPER_ADMIN', 'Super Admin', true, NULL, NULL),
    (v_sec_id, 'TNP_SECRETARY', 'Secretary Jane', true, NULL, NULL),
    (v_coord_id, 'TNP_COORDINATOR', 'Coordinator Bob', true, 'SLOT_1', NULL),
    (v_stud1_id, 'STUDENT', 'Alice Test', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud2_id, 'STUDENT', 'Bob Test', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud3_id, 'STUDENT', 'Charlie Test', true, NULL, 'STUDENT_ACTIVE'),
    (v_stud4_id, 'STUDENT', 'Dave Test', true, NULL, 'STUDENT_ACTIVE')
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    is_active = EXCLUDED.is_active,
    student_lifecycle_status = EXCLUDED.student_lifecycle_status;

  -- Student Profiles
  INSERT INTO student_profiles (
    profile_id,
    public_profile_enabled,
    public_resume_enabled,
    public_portfolio_enabled,
    public_profile_slug,
    public_headline,
    public_tagline,
    portfolio_url,
    profile_photo_path
  ) VALUES
    (v_stud1_id, true, true, true, 'alice-showcase-2026', 'Architectural Designer', 'Sustainable urban habitats.', 'https://alice-architecture.example.com', '40000000-0000-0000-0000-000000000001/photo_v1.jpg'),
    (v_stud2_id, true, false, false, 'bob-showcase-2026', 'Urban Planner', 'Transport infrastructure.', 'https://bob-urbanplan.example.com', NULL),
    (v_stud3_id, false, false, false, NULL, NULL, NULL, NULL, NULL),
    (v_stud4_id, false, false, false, 'dave-showcase-2026', 'Interior Designer', 'Private showcase.', NULL, NULL)
  ON CONFLICT (profile_id) DO UPDATE SET
    public_profile_enabled = EXCLUDED.public_profile_enabled,
    public_resume_enabled = EXCLUDED.public_resume_enabled,
    public_portfolio_enabled = EXCLUDED.public_portfolio_enabled,
    public_profile_slug = EXCLUDED.public_profile_slug,
    public_headline = EXCLUDED.public_headline,
    public_tagline = EXCLUDED.public_tagline,
    portfolio_url = EXCLUDED.portfolio_url,
    profile_photo_path = EXCLUDED.profile_photo_path;

  -- Academic Records
  INSERT INTO academic_records (profile_id, program_id, batch, cgpa, verification_status, verified_by, verified_at) VALUES
    (v_stud1_id, v_prog_barch_id, '2026', 8.50, 'VERIFIED', v_admin_id, now()),
    (v_stud2_id, v_prog_mplan_id, '2026', 7.80, 'VERIFIED', v_admin_id, now()),
    (v_stud3_id, v_prog_barch_id, '2026', 8.20, 'VERIFIED', v_admin_id, now()),
    (v_stud4_id, v_prog_barch_id, '2026', 6.50, 'VERIFIED', v_admin_id, now())
  ON CONFLICT (profile_id) DO UPDATE SET
    verification_status = EXCLUDED.verification_status,
    batch = EXCLUDED.batch;

  -- Coordinator Student Scope for BARCH 2026 only
  INSERT INTO coordinator_student_scopes (coordinator_id, program_id, batch, granted_by) VALUES
    (v_coord_id, v_prog_barch_id, '2026', v_admin_id)
  ON CONFLICT (coordinator_id, program_id, batch) DO NOTHING;

  -- Skills & Verified student skill for Alice
  SELECT id INTO v_skill_id FROM skills WHERE is_active = true LIMIT 1;
  IF v_skill_id IS NOT NULL THEN
    INSERT INTO student_skills (student_id, skill_id, proficiency_level, verification_status, is_active)
    VALUES (v_stud1_id, v_skill_id, 3, 'VERIFIED', true)
    ON CONFLICT (student_id, skill_id) DO UPDATE SET verification_status = 'VERIFIED', is_active = true;
  END IF;
END;
$$;

-- ============================================================================
-- Section 1: Function Existence & Permissions (Tests 1 - 11)
-- ============================================================================

-- 1. get_public_student_profile exists
SELECT has_function(
  'public',
  'get_public_student_profile',
  ARRAY['text'],
  'Function get_public_student_profile(TEXT) exists'
);

-- 2. get_public_batch_page exists
SELECT has_function(
  'public',
  'get_public_batch_page',
  ARRAY['text', 'text', 'text', 'boolean', 'text', 'integer', 'integer'],
  'Function get_public_batch_page exists'
);

-- 3. get_public_batches exists
SELECT has_function(
  'public',
  'get_public_batches',
  ARRAY[]::text[],
  'Function get_public_batches() exists'
);

-- 4. update_own_public_profile_settings exists
SELECT has_function(
  'public',
  'update_own_public_profile_settings',
  ARRAY['boolean', 'boolean', 'boolean', 'text', 'text', 'text'],
  'Function update_own_public_profile_settings exists'
);

-- 5. admin_reassign_profile_slug exists
SELECT has_function(
  'public',
  'admin_reassign_profile_slug',
  ARRAY['uuid', 'text', 'text'],
  'Function admin_reassign_profile_slug exists'
);

-- 6. v_staff_student_public_profiles view exists
SELECT has_view(
  'public',
  'v_staff_student_public_profiles',
  'View v_staff_student_public_profiles exists'
);

-- 7. get_public_student_profile can be executed by anon
SELECT ok(
  has_function_privilege('anon', 'get_public_student_profile(text)', 'EXECUTE'),
  'anon role can execute get_public_student_profile'
);

-- 8. get_public_batch_page can be executed by anon
SELECT ok(
  has_function_privilege('anon', 'get_public_batch_page(text, text, text, boolean, text, integer, integer)', 'EXECUTE'),
  'anon role can execute get_public_batch_page'
);

-- 9. get_public_batches can be executed by anon
SELECT ok(
  has_function_privilege('anon', 'get_public_batches()', 'EXECUTE'),
  'anon role can execute get_public_batches'
);

-- 10. update_own_public_profile_settings is REVOKED from anon
SELECT ok(
  NOT has_function_privilege('anon', 'update_own_public_profile_settings(boolean, boolean, boolean, text, text, text)', 'EXECUTE'),
  'anon role CANNOT execute update_own_public_profile_settings'
);

-- 11. admin_reassign_profile_slug is REVOKED from anon
SELECT ok(
  NOT has_function_privilege('anon', 'admin_reassign_profile_slug(uuid, text, text)', 'EXECUTE'),
  'anon role CANNOT execute admin_reassign_profile_slug'
);

-- 12. _is_student_publicly_eligible exists
SELECT has_function(
  'public',
  '_is_student_publicly_eligible',
  ARRAY['uuid'],
  'Internal helper _is_student_publicly_eligible(UUID) exists'
);

-- 13. _get_public_avatar_storage_path exists
SELECT has_function(
  'public',
  '_get_public_avatar_storage_path',
  ARRAY['text'],
  'Internal helper _get_public_avatar_storage_path(TEXT) exists'
);

-- 14. _get_public_avatar_storage_path is REVOKED from anon
SELECT ok(
  NOT has_function_privilege('anon', '_get_public_avatar_storage_path(text)', 'EXECUTE'),
  'anon role CANNOT execute _get_public_avatar_storage_path'
);

-- 15. _get_public_avatar_storage_path is REVOKED from authenticated
SELECT ok(
  NOT has_function_privilege('authenticated', '_get_public_avatar_storage_path(text)', 'EXECUTE'),
  'authenticated role CANNOT execute _get_public_avatar_storage_path'
);

-- 16. _is_student_publicly_eligible is REVOKED from anon
SELECT ok(
  NOT has_function_privilege('anon', '_is_student_publicly_eligible(uuid)', 'EXECUTE'),
  'anon role CANNOT execute _is_student_publicly_eligible'
);

-- 17. _is_student_publicly_eligible is REVOKED from authenticated
SELECT ok(
  NOT has_function_privilege('authenticated', '_is_student_publicly_eligible(uuid)', 'EXECUTE'),
  'authenticated role CANNOT execute _is_student_publicly_eligible'
);

-- ============================================================================
-- Section 2: Anonymous Direct Base-Table SELECT Denial (Tests 12 - 22)
-- ============================================================================

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '{"role": "anon"}';

-- 12. anon SELECT student_profiles returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.student_profiles),
  0,
  'anon SELECT on student_profiles returns 0 rows'
);

-- 13. anon SELECT academic_records returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.academic_records),
  0,
  'anon SELECT on academic_records returns 0 rows'
);

-- 14. anon SELECT student_roster returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.student_roster),
  0,
  'anon SELECT on student_roster returns 0 rows'
);

-- 15. anon SELECT documents returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.documents),
  0,
  'anon SELECT on documents returns 0 rows'
);

-- 16. anon SELECT student_skills returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.student_skills),
  0,
  'anon SELECT on student_skills returns 0 rows'
);

-- 17. anon SELECT student_skill_evidence returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.student_skill_evidence),
  0,
  'anon SELECT on student_skill_evidence returns 0 rows'
);

-- 18. anon SELECT audit_logs is denied (throws 42501 permission denied)
SELECT throws_ok(
  'SELECT count(*) FROM public.audit_logs',
  '42501',
  NULL,
  'anon SELECT on audit_logs is denied (throws 42501)'
);

-- 19. anon SELECT profiles returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.profiles),
  0,
  'anon SELECT on profiles returns 0 rows'
);

-- 20. anon SELECT applications returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.applications),
  0,
  'anon SELECT on applications returns 0 rows'
);

-- 21. anon SELECT application_status_history returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.application_status_history),
  0,
  'anon SELECT on application_status_history returns 0 rows'
);

-- 22. anon SELECT v_staff_student_public_profiles is denied
SELECT throws_ok(
  'SELECT count(*) FROM public.v_staff_student_public_profiles',
  '42501',
  NULL,
  'anon SELECT on v_staff_student_public_profiles is denied (permission denied)'
);

-- ============================================================================
-- Section 3: Public Profile RPC (Tests 23 - 35)
-- ============================================================================

-- 23. Test setup confirmation
SELECT ok(true, 'Test data seeded for Phase 9 showcase tests');

-- 24. get_public_student_profile resolves Alice
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_student_profile('alice-showcase-2026')),
  1,
  'get_public_student_profile resolves 1 row for active public slug'
);

-- 25. Alice name matches
SELECT is(
  (SELECT name FROM public.get_public_student_profile('alice-showcase-2026')),
  'Alice Test',
  'get_public_student_profile returns correct display name'
);

-- 26. Alice program_code matches BARCH
SELECT is(
  (SELECT program_code FROM public.get_public_student_profile('alice-showcase-2026')),
  'BARCH',
  'get_public_student_profile returns correct program_code'
);

-- 27. Alice graduation_batch matches 2026
SELECT is(
  (SELECT graduation_batch FROM public.get_public_student_profile('alice-showcase-2026')),
  '2026',
  'get_public_student_profile returns correct graduation_batch'
);

-- 28. Alice portfolio_available is true
SELECT is(
  (SELECT portfolio_available FROM public.get_public_student_profile('alice-showcase-2026')),
  true,
  'get_public_student_profile reports portfolio_available = true'
);

-- 29. Alice portfolio_url is returned
SELECT is(
  (SELECT portfolio_url FROM public.get_public_student_profile('alice-showcase-2026')),
  'https://alice-architecture.example.com',
  'get_public_student_profile returns portfolio_url when enabled'
);

-- 30. Alice resume_available is true
SELECT is(
  (SELECT resume_available FROM public.get_public_student_profile('alice-showcase-2026')),
  true,
  'get_public_student_profile reports resume_available = true'
);

-- 31. Alice verified_skills is returned as JSONB array
SELECT ok(
  jsonb_typeof((SELECT verified_skills FROM public.get_public_student_profile('alice-showcase-2026'))) = 'array',
  'get_public_student_profile returns verified_skills as JSONB array'
);

-- 32. Bob get_public_student_profile resolves
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_student_profile('bob-showcase-2026')),
  1,
  'get_public_student_profile resolves Bob showcase'
);

-- 33. Bob portfolio_available is false
SELECT is(
  (SELECT portfolio_available FROM public.get_public_student_profile('bob-showcase-2026')),
  false,
  'Bob portfolio_available = false'
);

-- 34. Bob portfolio_url is NULL when disabled
SELECT is(
  (SELECT portfolio_url FROM public.get_public_student_profile('bob-showcase-2026')),
  NULL::text,
  'Bob portfolio_url is NULL when public_portfolio_enabled = false'
);

-- 35. Bob resume_available is false
SELECT is(
  (SELECT resume_available FROM public.get_public_student_profile('bob-showcase-2026')),
  false,
  'Bob resume_available = false'
);

-- ============================================================================
-- Section 4: Negative Profile Tests & Unknown Slugs (Tests 36 - 40)
-- ============================================================================

-- 36. Dave is private -> get_public_student_profile returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_student_profile('dave-showcase-2026')),
  0,
  'Private student dave-showcase-2026 returns 0 rows'
);

-- 37. Unknown slug returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_student_profile('non-existent-student-slug')),
  0,
  'Unknown slug returns 0 rows'
);

-- 38. Empty string slug returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_student_profile('')),
  0,
  'Empty slug returns 0 rows'
);

-- 39. Malformed slug with special characters returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_student_profile('alice_invalid!slug')),
  0,
  'Malformed slug returns 0 rows'
);

-- 40. Uppercase slug query is case-insensitively resolved
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_student_profile('ALICE-SHOWCASE-2026')),
  1,
  'Case-insensitive slug lookup resolves Alice profile'
);

-- ============================================================================
-- Section 5: Batch Directory RPC (Tests 41 - 50)
-- ============================================================================

-- 41. get_public_batch_page('2026') returns exactly 2 opted-in students (Alice, Bob)
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_batch_page('2026')),
  2,
  'get_public_batch_page(2026) returns exactly 2 opted-in students'
);

-- 42. Private student Dave is excluded from batch page
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_batch_page('2026') WHERE slug = 'dave-showcase-2026'),
  0,
  'Private student is excluded from batch page'
);

-- 43. Deterministic ordering: Alice Test precedes Bob Test
SELECT is(
  (SELECT slug FROM public.get_public_batch_page('2026') LIMIT 1),
  'alice-showcase-2026',
  'Batch page orders deterministically by display name (Alice precedes Bob)'
);

-- 44. Program filter BARCH returns only Alice
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_batch_page('2026', 'BARCH')),
  1,
  'Program filter BARCH returns 1 student (Alice)'
);

-- 45. Program filter MPLAN returns only Bob
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_batch_page('2026', 'MPLAN')),
  1,
  'Program filter MPLAN returns 1 student (Bob)'
);

-- 46. Portfolio filter true returns only Alice (has portfolio)
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_batch_page('2026', NULL, NULL, true)),
  1,
  'Portfolio filter true returns only students with public portfolio enabled'
);

-- 47. Portfolio filter false returns all public students
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_batch_page('2026', NULL, NULL, false)),
  2,
  'Portfolio filter false returns all public batch students'
);

-- 48. Search filter "Alice" matches Alice
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_batch_page('2026', NULL, NULL, NULL, 'Alice')),
  1,
  'Search by name matches Alice'
);

-- 49. Search filter "NonExistent" returns 0
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_batch_page('2026', NULL, NULL, NULL, 'NonExistent')),
  0,
  'Search for non-existent name returns 0'
);

-- 50. Cross-batch isolation: query for batch 2025 returns 0
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_batch_page('2025')),
  0,
  'Cross-batch query returns 0 rows (isolation verified)'
);

-- ============================================================================
-- Section 6: Batches Summary RPC (Tests 51 - 52)
-- ============================================================================

-- 51. get_public_batches() returns 2 cohort rows (BARCH 2026 & MPLAN 2026)
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_batches()),
  2,
  'get_public_batches returns 2 cohort summaries for 2026'
);

-- 52. get_public_batches total student_count sum equals 2
SELECT is(
  (SELECT sum(student_count)::integer FROM public.get_public_batches()),
  2,
  'get_public_batches sums to 2 public students'
);

RESET ROLE;

-- ============================================================================
-- Section 7: Student Privacy Toggles & Invalidation (Tests 53 - 57)
-- ============================================================================

-- Authenticate as Alice (40000000-0000-0000-0000-000000000001)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- 53. Alice toggles public profile OFF
SELECT ok(
  (public.update_own_public_profile_settings(false, false, false, 'alice-showcase-2026', 'Headline', 'Tagline')->>'success')::boolean,
  'Alice successfully disables public profile'
);

-- Switch to anon: verify immediate revocation
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '{"role": "anon"}';

-- 54. get_public_student_profile immediately returns 0 rows
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_student_profile('alice-showcase-2026')),
  0,
  'Public profile immediately returns 0 rows after disable'
);

-- 55. Batch page immediately excludes Alice (returns only Bob)
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_batch_page('2026')),
  1,
  'Batch page immediately omits disabled student'
);

-- Switch back to Alice and re-enable
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- 56. Alice re-enables public profile
SELECT ok(
  (public.update_own_public_profile_settings(true, true, true, 'alice-showcase-2026', 'Headline', 'Tagline')->>'success')::boolean,
  'Alice successfully re-enables public profile'
);

-- Switch to anon: verify immediate reappearance
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '{"role": "anon"}';

-- 57. Alice is immediately visible again
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_student_profile('alice-showcase-2026')),
  1,
  'Public profile immediately resolves after re-enable'
);

RESET ROLE;

-- ============================================================================
-- Section 8: Slug Invariants & Super Admin Recovery (Tests 58 - 64)
-- ============================================================================

-- As Alice: attempt to change slug to something else
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- 58. Slug immutability: changing slug throws exception
SELECT throws_ok(
  $$SELECT public.update_own_public_profile_settings(true, true, true, 'alice-new-slug-2026')$$,
  'Public profile slug cannot be changed once assigned',
  'Changing slug after assignment is rejected (immutable normal use)'
);

RESET ROLE;

-- Authenticate as Charlie (40000000-0000-0000-0000-000000000003) who has no slug
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "40000000-0000-0000-0000-000000000003", "role": "authenticated"}';

-- 59. Slug validation: invalid short slug throws exception
SELECT throws_ok(
  $$SELECT public.update_own_public_profile_settings(true, false, false, 'ab')$$,
  'Invalid slug format: must be 3-63 lowercase alphanumeric characters or hyphens, starting with a letter or digit',
  'Invalid slug format is rejected'
);

-- 60. Opt-in requirement: enabling public profile without a slug throws exception
SELECT throws_ok(
  $$SELECT public.update_own_public_profile_settings(true, false, false, NULL)$$,
  'Cannot enable public profile without specifying a valid slug',
  'Enabling public profile without a slug is rejected'
);

RESET ROLE;

-- As Super Admin (00000000-0000-0000-0000-000000000001): reassign Alice's slug
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- 61. Super Admin reassigns slug with reason
SELECT ok(
  (public.admin_reassign_profile_slug(
    '40000000-0000-0000-0000-000000000001',
    'alice-recovered-2026',
    'Legal name and portfolio alignment correction'
  )->>'success')::boolean,
  'Super Admin successfully reassigns profile slug'
);

-- 62. Audit log entry recorded
SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs WHERE action = 'PROFILE_SLUG_REASSIGNED' AND entity_id = '40000000-0000-0000-0000-000000000001'),
  1,
  'Audit log entry recorded for slug reassignment'
);

RESET ROLE;

-- 63. Anonymous user resolves Alice under new slug
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '{"role": "anon"}';

SELECT is(
  (SELECT count(*)::integer FROM public.get_public_student_profile('alice-recovered-2026')),
  1,
  'New slug immediately resolves Alice profile'
);

RESET ROLE;

-- Non-admin (Coordinator: 30000000-0000-0000-0000-000000000001) attempts slug reassignment
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- 64. Coordinator reassign slug is rejected
SELECT throws_ok(
  $$SELECT public.admin_reassign_profile_slug('40000000-0000-0000-0000-000000000001', 'alice-hacked', 'Unauthorized')$$,
  'Forbidden: only Super Admins can reassign public profile slugs',
  'Non-Super Admin cannot reassign profile slugs'
);

RESET ROLE;

-- ============================================================================
-- Section 9: Staff Public Visibility Audit View Scoping (Test 65)
-- ============================================================================

-- As Coordinator Bob (30000000-0000-0000-0000-000000000001) scoped to BARCH 2026:
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- 65. Coordinator sees only in-scope students (BARCH 2026) in audit view, MPLAN 2026 excluded
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.v_staff_student_public_profiles
    WHERE program_code = 'MPLAN'
  ),
  'Coordinator cannot see out-of-scope MPLAN students in v_staff_student_public_profiles'
);

RESET ROLE;

-- ============================================================================
-- Section 10: Canonical Avatar Storage Path & Visibility Tests (Tests 72 - 79)
-- ============================================================================

-- Reset role to service/postgres to invoke internal helper _get_public_avatar_storage_path
RESET ROLE;

-- 72. Alice has public profile, verified academics, active status, and photo -> resolves photo path
-- Note: Alice was reassigned to 'alice-recovered-2026' in Section 8 Test 61
SELECT is(
  public._get_public_avatar_storage_path('alice-recovered-2026'),
  '40000000-0000-0000-0000-000000000001/photo_v1.jpg',
  'Opted-in student with photo resolves registered avatar storage path under current slug'
);

-- 73. Reassigned old slug returns NULL (no stale alias)
SELECT is(
  public._get_public_avatar_storage_path('alice-showcase-2026'),
  NULL,
  'Old slug returns NULL after Super Admin slug reassignment'
);

-- 74. Unknown slug returns NULL
SELECT is(
  public._get_public_avatar_storage_path('non-existent-student-slug'),
  NULL,
  'Unknown slug returns NULL'
);

-- 75. Private student Dave (opted-out) returns NULL
SELECT is(
  public._get_public_avatar_storage_path('dave-showcase-2026'),
  NULL,
  'Private student avatar path returns NULL'
);

-- 76. Student Bob (opted-in, but no photo registered) returns NULL
SELECT is(
  public._get_public_avatar_storage_path('bob-showcase-2026'),
  NULL,
  'Opted-in student without photo returns NULL'
);

-- 77. Inactive student returns NULL even if opted-in with photo
UPDATE profiles SET is_active = false WHERE id = '40000000-0000-0000-0000-000000000001';

SELECT is(
  public._get_public_avatar_storage_path('alice-recovered-2026'),
  NULL,
  'Inactive student avatar path returns NULL'
);

UPDATE profiles SET is_active = true WHERE id = '40000000-0000-0000-0000-000000000001';

-- 78. Student with ALUMNI lifecycle returns NULL (Phase 10 owns alumni showcase)
UPDATE profiles SET student_lifecycle_status = 'ALUMNI' WHERE id = '40000000-0000-0000-0000-000000000001';

SELECT is(
  public._get_public_avatar_storage_path('alice-recovered-2026'),
  NULL,
  'ALUMNI student avatar path returns NULL in Phase 9'
);

UPDATE profiles SET student_lifecycle_status = 'STUDENT_ACTIVE' WHERE id = '40000000-0000-0000-0000-000000000001';

-- 79. Student with unverified academic record returns NULL
UPDATE academic_records SET verification_status = 'UNVERIFIED' WHERE profile_id = '40000000-0000-0000-0000-000000000001';

SELECT is(
  public._get_public_avatar_storage_path('alice-recovered-2026'),
  NULL,
  'Student with unverified academic record returns NULL'
);

UPDATE academic_records SET verification_status = 'VERIFIED' WHERE profile_id = '40000000-0000-0000-0000-000000000001';

SELECT * FROM finish();
ROLLBACK;
