// Mock server-only in Node.js test environment
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as NodeModule;

import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anon = createClient<Database>(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test("Phase 11 — Announcements Integration Suite", async (t) => {
  // Helper to safely provision auth user and active profile
  async function setupUser(
    email: string,
    role:
      | "SUPER_ADMIN"
      | "TNP_SECRETARY"
      | "TNP_COORDINATOR"
      | "STUDENT"
      | "RECRUITER",
    slot?: "SLOT_1" | "SLOT_2",
    lifecycle?: "STUDENT_ACTIVE" | "STUDENT_GRADUATED" | "ALUMNI"
  ): Promise<string> {
    const { data: list } = await admin.auth.admin.listUsers();
    let user = list?.users?.find((u) => u.email === email);
    if (!user) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password: "TestPassword123!",
        email_confirm: true,
      });
      assert.ifError(error);
      user = created.user;
    } else {
      await admin.auth.admin.updateUserById(user.id, {
        password: "TestPassword123!",
        email_confirm: true,
      });
    }

    if (role === "SUPER_ADMIN") {
      await admin
        .from("profiles")
        .update({ is_active: false })
        .eq("role", "SUPER_ADMIN");
    }
    if (role === "TNP_SECRETARY") {
      await admin
        .from("profiles")
        .update({ is_active: false })
        .eq("role", "TNP_SECRETARY");
    }
    if (role === "TNP_COORDINATOR" && slot) {
      await admin
        .from("profiles")
        .update({ is_active: false })
        .eq("coordinator_slot", slot);
    }

    const { error: upsertErr } = await admin.from("profiles").upsert({
      id: user.id,
      role,
      display_name: email.split("@")[0] || "User",
      is_active: true,
      coordinator_slot: slot || null,
      student_lifecycle_status:
        role === "STUDENT" ? lifecycle || "STUDENT_ACTIVE" : null,
    });
    assert.ifError(upsertErr);

    return user.id;
  }

  // Provision distinct test actors
  const sAdminId = await setupUser("phase11_admin@vnit.test", "SUPER_ADMIN");
  const sSecId = await setupUser("phase11_sec@vnit.test", "TNP_SECRETARY");
  const sCoordId = await setupUser(
    "phase11_coord@vnit.test",
    "TNP_COORDINATOR",
    "SLOT_2"
  );
  const sActiveId = await setupUser(
    "phase11_active@vnit.test",
    "STUDENT",
    undefined,
    "STUDENT_ACTIVE"
  );
  const sGradId = await setupUser(
    "phase11_grad@vnit.test",
    "STUDENT",
    undefined,
    "STUDENT_GRADUATED"
  );
  const sAlumId = await setupUser(
    "phase11_alum@vnit.test",
    "STUDENT",
    undefined,
    "ALUMNI"
  );
  const recruiterId = await setupUser(
    "phase11_recruiter@vnit.test",
    "RECRUITER"
  );

  const createClientForUser = async (email: string) => {
    const client = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authErr } =
      await client.auth.signInWithPassword({
        email,
        password: "TestPassword123!",
      });
    assert.ifError(authErr);
    assert.ok(authData.session?.access_token);
    return client;
  };

  const cAdmin = await createClientForUser("phase11_admin@vnit.test");
  const cSec = await createClientForUser("phase11_sec@vnit.test");
  const cCoord = await createClientForUser("phase11_coord@vnit.test");
  const cActive = await createClientForUser("phase11_active@vnit.test");
  const cGrad = await createClientForUser("phase11_grad@vnit.test");
  const cAlum = await createClientForUser("phase11_alum@vnit.test");
  const cRecruiter = await createClientForUser("phase11_recruiter@vnit.test");

  // Clean existing test announcements
  await admin
    .from("announcements")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  // ==========================================================================
  // Test 1: Creation, Input Bounds & Authority Checks
  // ==========================================================================
  await t.test("Privileged Creation & Input Validations", async () => {
    // 1. Coordinator cannot create announcement
    const { error: errCoordCreate } = await cCoord.rpc("create_announcement", {
      p_title: "Unauthorized Coord",
      p_body: "Should fail",
      p_audience: "STAFF",
    });
    assert.ok(errCoordCreate, "Coordinator creation must be rejected");
    assert.equal(errCoordCreate.code, "42501");

    // 2. Student cannot create announcement
    const { error: errStudCreate } = await cActive.rpc("create_announcement", {
      p_title: "Unauthorized Student",
      p_body: "Should fail",
      p_audience: "STUDENTS",
    });
    assert.ok(errStudCreate, "Student creation must be rejected");
    assert.equal(errStudCreate.code, "42501");

    // 3. Recruiter cannot create announcement
    const { error: errRecCreate } = await cRecruiter.rpc(
      "create_announcement",
      {
        p_title: "Unauthorized Recruiter",
        p_body: "Should fail",
        p_audience: "RECRUITERS",
      }
    );
    assert.ok(errRecCreate, "Recruiter creation must be rejected");
    assert.equal(errRecCreate.code, "42501");

    // 4. Input bounds: empty title rejected
    const { error: errEmptyTitle } = await cAdmin.rpc("create_announcement", {
      p_title: "   ",
      p_body: "Valid body",
      p_audience: "ALL",
    });
    assert.ok(errEmptyTitle, "Empty title must be rejected");
    assert.equal(errEmptyTitle.code, "22023");

    // 5. Input bounds: title > 200 chars rejected
    const { error: errLongTitle } = await cAdmin.rpc("create_announcement", {
      p_title: "A".repeat(201),
      p_body: "Valid body",
      p_audience: "ALL",
    });
    assert.ok(errLongTitle, "Title > 200 chars must be rejected");
    assert.equal(errLongTitle.code, "22023");

    // 6. Input bounds: empty body rejected
    const { error: errEmptyBody } = await cAdmin.rpc("create_announcement", {
      p_title: "Valid Title",
      p_body: "   ",
      p_audience: "ALL",
    });
    assert.ok(errEmptyBody, "Empty body must be rejected");
    assert.equal(errEmptyBody.code, "22023");

    // 7. Input bounds: past expiry rejected
    const { error: errPastExp } = await cAdmin.rpc("create_announcement", {
      p_title: "Valid Title",
      p_body: "Valid body",
      p_audience: "ALL",
      p_expires_at: new Date(Date.now() - 3600000).toISOString(),
    });
    assert.ok(errPastExp, "Past expiry must be rejected");
    assert.equal(errPastExp.code, "22023");

    // 8. Super Admin creates valid announcement
    const { data: createdId, error: errAdminCreate } = await cAdmin.rpc(
      "create_announcement",
      {
        p_title: "Campus Placement Inauguration 2026",
        p_body: "Official kickoff meeting for all departments.",
        p_audience: "ALL",
      }
    );
    assert.ok(
      !errAdminCreate,
      `Admin creation failed: ${errAdminCreate?.message}`
    );
    assert.ok(createdId, "Created announcement returns valid UUID");

    // Verify row attributes
    const { data: row } = await admin
      .from("announcements")
      .select("*")
      .eq("id", createdId!)
      .single();
    assert.equal(row?.status, "DRAFT");
    assert.equal(row?.published_at, null);
    assert.equal(row?.created_by, sAdminId);

    // 9. Secretary also creates valid announcement
    const { data: secCreatedId, error: errSecCreate } = await cSec.rpc(
      "create_announcement",
      {
        p_title: "Secretary Operations Memo",
        p_body: "Instructions for placement coordinators.",
        p_audience: "STAFF",
      }
    );
    assert.ok(
      !errSecCreate,
      `Secretary creation failed: ${errSecCreate?.message}`
    );
    assert.ok(secCreatedId);
  });

  // ==========================================================================
  // Test 2: Draft Updating & Publication Immutability
  // ==========================================================================
  await t.test("Draft Updates & Publication Immutability", async () => {
    // Create fresh draft
    const { data: draftId } = await cAdmin.rpc("create_announcement", {
      p_title: "Draft to Edit",
      p_body: "Original draft body",
      p_audience: "ALL",
    });
    assert.ok(draftId);

    // 1. Super Admin updates draft
    const { error: errUpdate } = await cAdmin.rpc("update_draft_announcement", {
      p_announcement_id: draftId!,
      p_title: "Draft Edited Successfully",
      p_body: "Updated body with complete room allocation info.",
      p_audience: "STUDENTS",
    });
    assert.ok(!errUpdate, `Draft update failed: ${errUpdate?.message}`);

    const { data: updatedRow } = await admin
      .from("announcements")
      .select("*")
      .eq("id", draftId!)
      .single();
    assert.equal(updatedRow?.title, "Draft Edited Successfully");
    assert.equal(updatedRow?.audience, "STUDENTS");

    // 2. Publish the announcement
    const { error: errPublish } = await cAdmin.rpc("publish_announcement", {
      p_announcement_id: draftId!,
    });
    assert.ok(!errPublish, `Publish failed: ${errPublish?.message}`);

    const { data: pubRow } = await admin
      .from("announcements")
      .select("*")
      .eq("id", draftId!)
      .single();
    assert.equal(pubRow?.status, "PUBLISHED");
    assert.ok(pubRow?.published_at);

    // 3. Immutability: Editing a PUBLISHED announcement is strictly forbidden
    const { error: errEditPublished } = await cAdmin.rpc(
      "update_draft_announcement",
      {
        p_announcement_id: draftId!,
        p_title: "Illegal Post-Publish Edit",
        p_body: "Should be denied",
        p_audience: "STUDENTS",
      }
    );
    assert.ok(errEditPublished, "Editing published announcement must fail");
    assert.equal(errEditPublished.code, "22023");

    // 4. Re-publishing already published announcement fails cleanly
    const { error: errRepublish } = await cAdmin.rpc("publish_announcement", {
      p_announcement_id: draftId!,
    });
    assert.ok(errRepublish, "Re-publishing published announcement must fail");
    assert.equal(errRepublish.code, "22023");
  });

  // ==========================================================================
  // Test 3: Archiving Procedure & Idempotency
  // ==========================================================================
  await t.test("Archiving & Idempotency", async () => {
    // Create and publish announcement to archive
    const { data: annId } = await cAdmin.rpc("create_announcement", {
      p_title: "Announcement to Archive",
      p_body: "Notice about to be retired",
      p_audience: "ALL",
    });
    await cAdmin.rpc("publish_announcement", { p_announcement_id: annId! });

    // 1. Archive announcement
    const { data: archRes, error: errArch } = await cAdmin.rpc(
      "archive_announcement",
      {
        p_announcement_id: annId!,
      }
    );
    assert.ok(!errArch, `Archive failed: ${errArch?.message}`);
    const parsedArch = archRes as Record<string, unknown>;
    assert.equal(parsedArch.status, "ARCHIVED");

    // 2. Repeated archive is idempotent
    const { data: repArchRes, error: errRepArch } = await cAdmin.rpc(
      "archive_announcement",
      {
        p_announcement_id: annId!,
      }
    );
    assert.ok(!errRepArch, "Repeated archive must succeed idempotently");
    const parsedRep = repArchRes as Record<string, unknown>;
    assert.equal(parsedRep.already_archived, true);

    // 3. Cannot publish an ARCHIVED announcement
    const { error: errPubArch } = await cAdmin.rpc("publish_announcement", {
      p_announcement_id: annId!,
    });
    assert.ok(errPubArch, "Publishing an archived announcement must fail");
    assert.equal(errPubArch.code, "22023");
  });

  // ==========================================================================
  // Test 4: Audience Targeting & Lifecycle Isolation Matrix
  // ==========================================================================
  await t.test("Audience Targeting & Lifecycle Isolation Matrix", async () => {
    // Clean and setup targeted test notices
    await admin
      .from("announcements")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    // 1. ALL
    const { data: idAll } = await cAdmin.rpc("create_announcement", {
      p_title: "Notice for ALL Audience",
      p_body: "General campus circular",
      p_audience: "ALL",
    });
    await cAdmin.rpc("publish_announcement", { p_announcement_id: idAll! });

    // 2. STUDENTS
    const { data: idStud } = await cAdmin.rpc("create_announcement", {
      p_title: "Notice for STUDENTS Audience",
      p_body: "Drive test schedule for enrolled students",
      p_audience: "STUDENTS",
    });
    await cAdmin.rpc("publish_announcement", { p_announcement_id: idStud! });

    // 3. RECRUITERS
    const { data: idRec } = await cAdmin.rpc("create_announcement", {
      p_title: "Notice for RECRUITERS Audience",
      p_body: "Campus recruitment portal rules and dates",
      p_audience: "RECRUITERS",
    });
    await cAdmin.rpc("publish_announcement", { p_announcement_id: idRec! });

    // 4. STAFF
    const { data: idStaff } = await cAdmin.rpc("create_announcement", {
      p_title: "Notice for STAFF Audience",
      p_body: "Internal departmental circular",
      p_audience: "STAFF",
    });
    await cAdmin.rpc("publish_announcement", { p_announcement_id: idStaff! });

    // --- Assertions for STUDENT_ACTIVE ---
    const { data: feedActive } = await cActive.rpc("get_my_announcements");
    const activeTitles = (feedActive || []).map((a) => a.title);
    assert.ok(
      activeTitles.includes("Notice for ALL Audience"),
      "STUDENT_ACTIVE sees ALL"
    );
    assert.ok(
      activeTitles.includes("Notice for STUDENTS Audience"),
      "STUDENT_ACTIVE sees STUDENTS"
    );
    assert.ok(
      !activeTitles.includes("Notice for RECRUITERS Audience"),
      "STUDENT_ACTIVE cannot see RECRUITERS"
    );
    assert.ok(
      !activeTitles.includes("Notice for STAFF Audience"),
      "STUDENT_ACTIVE cannot see STAFF"
    );

    // --- Assertions for STUDENT_GRADUATED ---
    const { data: feedGrad } = await cGrad.rpc("get_my_announcements");
    const gradTitles = (feedGrad || []).map((a) => a.title);
    assert.ok(
      gradTitles.includes("Notice for ALL Audience"),
      "STUDENT_GRADUATED sees ALL"
    );
    assert.ok(
      !gradTitles.includes("Notice for STUDENTS Audience"),
      "STUDENT_GRADUATED cannot see STUDENTS placement notices"
    );
    assert.ok(
      !gradTitles.includes("Notice for RECRUITERS Audience"),
      "STUDENT_GRADUATED cannot see RECRUITERS"
    );
    assert.ok(
      !gradTitles.includes("Notice for STAFF Audience"),
      "STUDENT_GRADUATED cannot see STAFF"
    );

    // --- Assertions for ALUMNI ---
    const { data: feedAlum } = await cAlum.rpc("get_my_announcements");
    const alumTitles = (feedAlum || []).map((a) => a.title);
    assert.ok(
      alumTitles.includes("Notice for ALL Audience"),
      "ALUMNI sees ALL"
    );
    assert.ok(
      !alumTitles.includes("Notice for STUDENTS Audience"),
      "ALUMNI cannot see STUDENTS notices"
    );
    assert.ok(
      !alumTitles.includes("Notice for RECRUITERS Audience"),
      "ALUMNI cannot see RECRUITERS"
    );
    assert.ok(
      !alumTitles.includes("Notice for STAFF Audience"),
      "ALUMNI cannot see STAFF"
    );

    // --- Assertions for RECRUITER ---
    const { data: feedRec } = await cRecruiter.rpc("get_my_announcements");
    const recTitles = (feedRec || []).map((a) => a.title);
    assert.ok(
      recTitles.includes("Notice for ALL Audience"),
      "RECRUITER sees ALL"
    );
    assert.ok(
      recTitles.includes("Notice for RECRUITERS Audience"),
      "RECRUITER sees RECRUITERS"
    );
    assert.ok(
      !recTitles.includes("Notice for STUDENTS Audience"),
      "RECRUITER cannot see STUDENTS"
    );
    assert.ok(
      !recTitles.includes("Notice for STAFF Audience"),
      "RECRUITER cannot see STAFF"
    );

    // --- Assertions for COORDINATOR ---
    const { data: feedCoord } = await cCoord.rpc("get_my_announcements");
    const coordTitles = (feedCoord || []).map((a) => a.title);
    assert.ok(
      coordTitles.includes("Notice for ALL Audience"),
      "COORDINATOR sees ALL"
    );
    assert.ok(
      coordTitles.includes("Notice for STAFF Audience"),
      "COORDINATOR sees STAFF"
    );
    assert.ok(
      !coordTitles.includes("Notice for STUDENTS Audience"),
      "COORDINATOR cannot see STUDENTS"
    );
    assert.ok(
      !coordTitles.includes("Notice for RECRUITERS Audience"),
      "COORDINATOR cannot see RECRUITERS"
    );
  });

  // ==========================================================================
  // Test 5: Strict Expiry Semantics & Database Authority
  // ==========================================================================
  await t.test(
    "Expiry Semantics & Strict Database Authority Boundary",
    async () => {
      // 1. Notice with future expiry
      const { data: idFuture } = await cAdmin.rpc("create_announcement", {
        p_title: "Future Expiring Announcement",
        p_body: "Valid for 3 days",
        p_audience: "ALL",
        p_expires_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      });
      await cAdmin.rpc("publish_announcement", {
        p_announcement_id: idFuture!,
      });

      // 2. Direct seed of past-expired notice (bypass create validation to test visibility filter)
      const { data: pastAnn } = await admin
        .from("announcements")
        .insert({
          title: "Past Expired Announcement",
          body: "Expired yesterday",
          audience: "ALL",
          status: "PUBLISHED",
          published_at: new Date(Date.now() - 2 * 86400000).toISOString(),
          expires_at: new Date(Date.now() - 86400000).toISOString(),
          created_by: sAdminId,
        })
        .select()
        .single();
      assert.ok(pastAnn);

      const { data: feed } = await cActive.rpc("get_my_announcements");
      const feedTitles = (feed || []).map((a) => a.title);

      assert.ok(
        feedTitles.includes("Future Expiring Announcement"),
        "Notice with future expires_at must be visible"
      );
      assert.ok(
        !feedTitles.includes("Past Expired Announcement"),
        "Notice with past expires_at must NOT be visible"
      );

      // Verify status remains PUBLISHED (expiry controls visibility, not status mutation)
      const { data: checkPast } = await admin
        .from("announcements")
        .select("status")
        .eq("id", pastAnn.id)
        .single();
      assert.equal(
        checkPast?.status,
        "PUBLISHED",
        "Status remains PUBLISHED upon expiry"
      );
    }
  );

  // ==========================================================================
  // Test 6: Draft & Archived Feed Privacy
  // ==========================================================================
  await t.test("Draft and Archived Privacy in Ordinary Feeds", async () => {
    // 1. Unshared Draft
    const { data: secretDraftId } = await cAdmin.rpc("create_announcement", {
      p_title: "Confidential Draft Notice",
      p_body: "Draft content never to be read before publish",
      p_audience: "ALL",
    });
    assert.ok(secretDraftId);

    // 2. Archived Notice
    const { data: archivedId } = await cAdmin.rpc("create_announcement", {
      p_title: "Decommissioned Policy Notice",
      p_body: "Old circular",
      p_audience: "ALL",
    });
    await cAdmin.rpc("publish_announcement", {
      p_announcement_id: archivedId!,
    });
    await cAdmin.rpc("archive_announcement", {
      p_announcement_id: archivedId!,
    });

    // Ordinary student query
    const { data: studentFeed } = await cActive.rpc("get_my_announcements");
    const studentTitles = (studentFeed || []).map((a) => a.title);
    assert.ok(
      !studentTitles.includes("Confidential Draft Notice"),
      "Draft must NOT appear in student feed"
    );
    assert.ok(
      !studentTitles.includes("Decommissioned Policy Notice"),
      "Archived must NOT appear in student feed"
    );

    // Coordinator query
    const { data: coordFeed } = await cCoord.rpc("get_my_announcements");
    const coordTitles = (coordFeed || []).map((a) => a.title);
    assert.ok(
      !coordTitles.includes("Confidential Draft Notice"),
      "Draft must NOT appear in coordinator feed"
    );
    assert.ok(
      !coordTitles.includes("Decommissioned Policy Notice"),
      "Archived must NOT appear in coordinator feed"
    );

    // Coordinator cannot access staff management view
    const { error: errCoordMgmt } = await cCoord.rpc("get_staff_announcements");
    assert.ok(
      errCoordMgmt,
      "Coordinator must NOT access staff management view"
    );
    assert.equal(errCoordMgmt.code, "42501");

    // Secretary/Super Admin management view sees both
    const { data: mgmtList } = await cAdmin.rpc("get_staff_announcements");
    const mgmtTitles = (mgmtList || []).map((a) => a.title);
    assert.ok(
      mgmtTitles.includes("Confidential Draft Notice"),
      "Management view includes draft announcements"
    );
    assert.ok(
      mgmtTitles.includes("Decommissioned Policy Notice"),
      "Management view includes archived announcements"
    );
  });

  // ==========================================================================
  // Test 7: Direct Base Table Mutation Denials & No Deletion RPC
  // ==========================================================================
  await t.test("Direct Table Attack Denials & Missing Delete RPC", async () => {
    // 1. Direct INSERT denied
    const { error: errDirectInsert } = await cActive
      .from("announcements")
      .insert({
        title: "Malicious Direct Insert",
        body: "Pwned",
        audience: "ALL",
        created_by: sActiveId,
      });
    assert.ok(errDirectInsert, "Direct table INSERT must be denied");
    assert.equal(errDirectInsert.code, "42501");

    // 2. Direct UPDATE denied
    const { error: errDirectUpdate } = await cActive
      .from("announcements")
      .update({ title: "Malicious Update" })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    assert.ok(errDirectUpdate, "Direct table UPDATE must be denied");
    assert.equal(errDirectUpdate.code, "42501");

    // 3. Direct DELETE denied
    const { error: errDirectDelete } = await cActive
      .from("announcements")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    assert.ok(errDirectDelete, "Direct table DELETE must be denied");
    assert.equal(errDirectDelete.code, "42501");

    // 4. delete_announcement RPC does not exist
    const { error: errDeleteRpc } = await cAdmin.rpc(
      "delete_announcement" as unknown as "get_my_announcements",
      {
        p_announcement_id: "00000000-0000-0000-0000-000000000000",
      } as unknown as Record<string, never>
    );
    assert.ok(errDeleteRpc, "delete_announcement RPC must not exist");
    assert.ok(
      errDeleteRpc.code === "PGRST202" || errDeleteRpc.code === "42883",
      `Expected function not found (PGRST202 or 42883), got: ${errDeleteRpc.code}`
    );
  });

  // ==========================================================================
  // Test 8: Concurrency & Race Conditions
  // ==========================================================================
  await t.test("Concurrency & Row Locking", async () => {
    // 1. Simultaneous publish attempts: exactly one valid transition
    const { data: concDraftId } = await cAdmin.rpc("create_announcement", {
      p_title: "Concurrent Publish Draft",
      p_body: "Testing race condition between publish calls",
      p_audience: "ALL",
    });

    const [res1, res2] = await Promise.all([
      cAdmin.rpc("publish_announcement", { p_announcement_id: concDraftId! }),
      cAdmin.rpc("publish_announcement", { p_announcement_id: concDraftId! }),
    ]);

    const successes = [res1, res2].filter((r) => !r.error);
    const errors = [res1, res2].filter((r) => r.error);

    assert.equal(
      successes.length,
      1,
      "Exactly one publish attempt must succeed"
    );
    assert.equal(errors.length, 1, "The competing publish attempt must fail");
    assert.equal(
      errors[0]?.error?.code,
      "22023",
      "Losing publish attempt receives 22023"
    );

    // 2. Concurrent archive attempts: deterministic idempotency
    const [archRes1, archRes2] = await Promise.all([
      cAdmin.rpc("archive_announcement", { p_announcement_id: concDraftId! }),
      cAdmin.rpc("archive_announcement", { p_announcement_id: concDraftId! }),
    ]);

    assert.ok(!archRes1.error, `Archive 1 error: ${archRes1.error?.message}`);
    assert.ok(!archRes2.error, `Archive 2 error: ${archRes2.error?.message}`);
    const checkArch = await admin
      .from("announcements")
      .select("status")
      .eq("id", concDraftId!)
      .single();
    assert.equal(checkArch.data?.status, "ARCHIVED");
  });

  // ==========================================================================
  // Test 9: Anonymous Access Boundary
  // ==========================================================================
  await t.test("Anonymous Access Boundary", async () => {
    // Direct SELECT on base table returns 0 rows via RLS
    const { data: anonRows } = await anon.from("announcements").select("*");
    assert.equal(
      anonRows?.length,
      0,
      "Anonymous SELECT on announcements table must return 0 rows"
    );

    // Anonymous cannot call get_my_announcements
    const { error: errAnonFeed } = await anon.rpc("get_my_announcements");
    assert.ok(
      errAnonFeed,
      "Anonymous call to get_my_announcements must be denied"
    );
    assert.equal(errAnonFeed.code, "42501");

    // Anonymous cannot call get_staff_announcements
    const { error: errAnonStaff } = await anon.rpc("get_staff_announcements");
    assert.ok(
      errAnonStaff,
      "Anonymous call to get_staff_announcements must be denied"
    );
    assert.equal(errAnonStaff.code, "42501");
  });

  // Restore clean state after suite completion
  t.after(async () => {
    // 1. Deactivate all Phase 11 test actors so no role/slot constraints leak
    await admin
      .from("profiles")
      .update({ is_active: false })
      .in("id", [
        sAdminId,
        sSecId,
        sCoordId,
        sActiveId,
        sGradId,
        sAlumId,
        recruiterId,
      ]);

    // 2. Reactivate seed super admin
    await admin
      .from("profiles")
      .update({ is_active: true })
      .eq("id", "00000000-0000-0000-0000-000000000001");

    // 3. Clean up test announcements
    await admin
      .from("announcements")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
  });
});
