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
import type { Database, Json } from "../src/types/database";
import {
  normalizeError,
  sanitizeErrorMessage,
  createSafeErrorResponse,
} from "../src/lib/errors";

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

test("Phase 13 — Reliability, Errors, and Audit Refinement Integration Suite", async (t) => {
  // ==========================================================================
  // 1. Centralized Error Normalization & Sanitization Unit Tests
  // ==========================================================================
  await t.test("Error Normalization & Sanitization Unit Suite", () => {
    // 1. Authorization / Permission Denied (42501)
    const err42501 = normalizeError({
      code: "42501",
      message:
        'permission denied for table placement_drives; violates row-level security policy "Staff view only"',
    });
    assert.equal(err42501.category, "FORBIDDEN");
    assert.equal(err42501.statusCode, 403);
    assert.equal(
      err42501.message,
      "You do not have permission to perform this action."
    );
    assert.ok(!err42501.message.includes("42501"));
    assert.ok(!err42501.message.includes("placement_drives"));
    assert.ok(!err42501.message.includes("row-level security"));

    // 2. Not Found (P0002 / PGRST116 / 02000)
    const errP0002 = normalizeError({
      code: "P0002",
      message: "record not found in table applications where id = 123",
    });
    assert.equal(errP0002.category, "NOT_FOUND");
    assert.equal(errP0002.statusCode, 404);
    assert.equal(
      errP0002.message,
      "This record is no longer available or does not exist."
    );
    assert.ok(!errP0002.message.includes("applications"));

    const errPGRST = normalizeError({
      code: "PGRST116",
      message: "JSON object requested, multiple (or no) rows returned",
    });
    assert.equal(errPGRST.category, "NOT_FOUND");
    assert.equal(errPGRST.statusCode, 404);

    // 3. Unique Constraint Violation (23505)
    const err23505 = normalizeError({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "uq_company_normalized_name"',
    });
    assert.equal(err23505.category, "CONFLICT");
    assert.equal(err23505.statusCode, 409);
    assert.equal(
      err23505.message,
      "A record with this information already exists."
    );
    assert.ok(!err23505.message.includes("uq_company_normalized_name"));

    // 4. Foreign Key Violation (23503)
    const err23503 = normalizeError({
      code: "23503",
      message:
        'insert or update on table "applications" violates foreign key constraint "fk_drive"',
    });
    assert.equal(err23503.category, "CONFLICT");
    assert.equal(err23503.statusCode, 409);
    assert.equal(
      err23503.message,
      "This operation references an unavailable or invalid record."
    );
    assert.ok(!err23503.message.includes("fk_drive"));

    // 5. Privacy Check Constraint Violation (23514)
    const errPrivacy = normalizeError({
      code: "23514",
      message:
        'Audit metadata violates privacy policy: forbidden key "cgpa" detected',
    });
    assert.equal(errPrivacy.category, "VALIDATION_ERROR");
    assert.equal(errPrivacy.statusCode, 400);
    assert.equal(
      errPrivacy.message,
      "The submitted data violates institutional privacy constraints."
    );
    assert.ok(!errPrivacy.message.includes("cgpa"));

    // 6. Generic Check Constraint (23514)
    const errCheck = normalizeError({
      code: "23514",
      message:
        'new row for relation "placement_drives" violates check constraint "chk_positive_package"',
    });
    assert.equal(errCheck.category, "VALIDATION_ERROR");
    assert.equal(errCheck.statusCode, 400);
    assert.equal(
      errCheck.message,
      "The submitted information does not meet the required format or constraints."
    );
    assert.ok(!errCheck.message.includes("chk_positive_package"));

    // 7. Bounded Parameter / Row Count Limit (22023)
    const err22023Export = normalizeError({
      code: "22023",
      message: "Export row count exceeds maximum allowed limit of 1000 rows",
    });
    assert.equal(err22023Export.category, "VALIDATION_ERROR");
    assert.equal(err22023Export.statusCode, 400);
    assert.ok(err22023Export.message.includes("1000 rows"));

    // 8. Concurrency / Serialization Failure (40001 / 55P03)
    const errConcurrency = normalizeError({
      code: "40001",
      message:
        "could not serialize access due to concurrent update on relation applications",
    });
    assert.equal(errConcurrency.category, "CONFLICT");
    assert.equal(errConcurrency.statusCode, 409);
    assert.ok(
      errConcurrency.message.includes("modified concurrently by another user")
    );

    // 9. Network / Transient Failure
    const errNetwork = normalizeError(
      new Error("fetch failed: ECONNREFUSED 127.0.0.1:54321")
    );
    assert.equal(errNetwork.category, "TEMPORARY_FAILURE");
    assert.equal(errNetwork.statusCode, 503);

    // 10. Sanitizer & JSON API Response Helper
    const sanitizedMsg = sanitizeErrorMessage({
      code: "42501",
      message: "violates row-level security policy on table users",
    });
    assert.equal(
      sanitizedMsg,
      "You do not have permission to perform this action."
    );

    const apiResp = createSafeErrorResponse({
      code: "23505",
      message: "duplicate key",
    });
    assert.equal(apiResp.status, 409);
    assert.equal(apiResp.response.category, "CONFLICT");
    assert.equal(
      apiResp.response.error,
      "A record with this information already exists."
    );
  });

  // ==========================================================================
  // 2. Integration Setup: Auth Clients & Test Fixtures
  // ==========================================================================
  async function setupUser(
    email: string,
    role:
      | "SUPER_ADMIN"
      | "TNP_SECRETARY"
      | "TNP_COORDINATOR"
      | "STUDENT"
      | "RECRUITER",
    slot?: "SLOT_1" | "SLOT_2",
    lifecycle?: "STUDENT_ACTIVE" | "STUDENT_GRADUATED" | "ALUMNI",
    isActive = true
  ): Promise<string> {
    const { data: listData } = await admin.auth.admin.listUsers({
      perPage: 1000,
    });
    let user = listData?.users?.find((u) => u.email === email);

    if (user) {
      await admin.auth.admin.updateUserById(user.id, {
        password: "TestPassword123!",
      });
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: "TestPassword123!",
        email_confirm: true,
      });
      if (error && error.message.includes("already been registered")) {
        const { data: retryList } = await admin.auth.admin.listUsers({
          perPage: 1000,
        });
        user = retryList?.users?.find((u) => u.email === email);
      } else {
        assert.ifError(error);
        user = data.user;
      }
    }

    assert.ok(user?.id);
    const userId = user.id;

    if (role === "SUPER_ADMIN" && isActive) {
      await admin
        .from("profiles")
        .update({ is_active: false })
        .eq("role", "SUPER_ADMIN");
    }
    if (role === "TNP_SECRETARY" && isActive) {
      await admin
        .from("profiles")
        .update({ is_active: false })
        .eq("role", "TNP_SECRETARY");
    }
    if (role === "TNP_COORDINATOR" && slot && isActive) {
      await admin
        .from("profiles")
        .update({ is_active: false })
        .eq("coordinator_slot", slot);
    }

    const { error: upsertErr } = await admin.from("profiles").upsert({
      id: userId,
      role,
      display_name: email.split("@")[0] || "User",
      is_active: isActive,
      coordinator_slot: slot || null,
      student_lifecycle_status:
        role === "STUDENT" ? lifecycle || "STUDENT_ACTIVE" : null,
    });
    assert.ifError(upsertErr);

    return userId;
  }

  const adminId = await setupUser("phase13_admin@vnit.test", "SUPER_ADMIN");
  const secId = await setupUser("phase13_sec@vnit.test", "TNP_SECRETARY");
  await setupUser("phase13_coord@vnit.test", "TNP_COORDINATOR", "SLOT_1");
  const studId = await setupUser(
    "phase13_stud@vnit.test",
    "STUDENT",
    undefined,
    "STUDENT_ACTIVE"
  );
  await setupUser("phase13_recruiter@vnit.test", "RECRUITER");

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

  const cAdmin = await createClientForUser("phase13_admin@vnit.test");
  const cSec = await createClientForUser("phase13_sec@vnit.test");
  const cCoord = await createClientForUser("phase13_coord@vnit.test");
  const cStud = await createClientForUser("phase13_stud@vnit.test");
  const cRecruiter = await createClientForUser("phase13_recruiter@vnit.test");

  // Create seed audit records for verification
  await admin.from("audit_logs").insert([
    {
      actor_id: adminId,
      action: "BOOTSTRAP_SUPER_ADMIN",
      entity_type: "system",
      entity_id: adminId,
      metadata: { event: "node_test_bootstrap" },
    },
    {
      actor_id: adminId,
      action: "ROLE_ASSIGNED",
      entity_type: "profile",
      entity_id: secId,
      metadata: { target_role: "TNP_SECRETARY" },
    },
    {
      actor_id: secId,
      action: "DRIVE_PUBLISHED",
      entity_type: "placement_drive",
      metadata: { title: "Phase 13 Verification Drive" },
    },
    {
      actor_id: secId,
      action: "DATA_EXPORT_REQUESTED",
      entity_type: "export",
      metadata: { export_type: "COMPANIES", row_count: 5 },
    },
  ]);

  // ==========================================================================
  // 3. Enumeration Protection Tests (Non-existent / Unauthorized = uniform 404 / 0 rows)
  // ==========================================================================
  await t.test("Resource Enumeration Protection", async () => {
    // A. Student querying for draft placement drives receives zero rows (no leak of existence)
    const { data: studentDrafts } = await cStud
      .from("v_student_published_drives")
      .select("id")
      .eq("status", "DRAFT");
    assert.equal(
      studentDrafts?.length || 0,
      0,
      "Students cannot discover or enumerate DRAFT drives"
    );

    // B. Recruiter querying for ungranted drives receives zero rows
    const fakeDriveId = "00000000-0000-0000-0000-999999999999";
    const { data: recDrive } = await cRecruiter
      .from("v_recruiter_granted_drives")
      .select("id")
      .eq("id", fakeDriveId);
    assert.equal(
      recDrive?.length || 0,
      0,
      "Recruiters cannot query or confirm existence of ungranted drives"
    );

    // C. Student querying for another student's applications receives zero rows
    const { data: otherApps } = await cStud
      .from("v_student_applications")
      .select("application_id")
      .neq("student_id", studId);
    assert.equal(
      otherApps?.length || 0,
      0,
      "Students cannot view or enumerate applications of other students"
    );
  });

  // ==========================================================================
  // 4. Audit Log Viewer Procedure (get_audit_log_page) Tests
  // ==========================================================================
  await t.test("Audit Log Viewer Procedure Authority & Scoping", async () => {
    // A. Anonymous caller denied
    const { error: anonErr } = await anon.rpc("get_audit_log_page", {
      p_limit: 50,
      p_offset: 0,
    });
    assert.ok(anonErr);
    assert.equal(anonErr.code, "42501");

    // B. Student caller denied
    const { error: studErr } = await cStud.rpc("get_audit_log_page", {
      p_limit: 50,
      p_offset: 0,
    });
    assert.ok(studErr);
    assert.equal(studErr.code, "42501");

    // C. Recruiter caller denied
    const { error: recErr } = await cRecruiter.rpc("get_audit_log_page", {
      p_limit: 50,
      p_offset: 0,
    });
    assert.ok(recErr);
    assert.equal(recErr.code, "42501");

    // D. Coordinator caller denied
    const { error: coordErr } = await cCoord.rpc("get_audit_log_page", {
      p_limit: 50,
      p_offset: 0,
    });
    assert.ok(coordErr);
    assert.equal(coordErr.code, "42501");

    // E. Super Admin succeeds and sees administrative records
    const { data: adminLogs, error: adminErr } = await cAdmin.rpc(
      "get_audit_log_page",
      { p_limit: 50, p_offset: 0 }
    );
    assert.ifError(adminErr);
    assert.ok(adminLogs && adminLogs.length > 0);

    const hasBootstrap = adminLogs.some(
      (l) => l.action === "BOOTSTRAP_SUPER_ADMIN"
    );
    assert.ok(hasBootstrap, "Super Admin sees BOOTSTRAP_SUPER_ADMIN");

    const hasRoleAssign = adminLogs.some((l) => l.action === "ROLE_ASSIGNED");
    assert.ok(hasRoleAssign, "Super Admin sees ROLE_ASSIGNED");

    // F. TNP Secretary succeeds, but strictly operational subset
    const { data: secLogs, error: secErr } = await cSec.rpc(
      "get_audit_log_page",
      { p_limit: 50, p_offset: 0 }
    );
    assert.ifError(secErr);
    assert.ok(secLogs && secLogs.length > 0);

    // Secretary strictly does NOT see BOOTSTRAP_SUPER_ADMIN, ROLE_ASSIGNED, etc.
    const secForbiddenActions = secLogs.filter((l) =>
      [
        "BOOTSTRAP_SUPER_ADMIN",
        "ROLE_ASSIGNED",
        "ROLE_REMOVED",
        "SYSTEM_CONFIG",
      ].includes(l.action)
    );
    assert.equal(
      secForbiddenActions.length,
      0,
      "TNP Secretary strictly excludes administrative/security audit records"
    );

    // G. Secretary explicit query for BOOTSTRAP_SUPER_ADMIN returns 0 rows
    const { data: secBootstrapFilter, error: filterErr } = await cSec.rpc(
      "get_audit_log_page",
      { p_limit: 50, p_offset: 0, p_action: "BOOTSTRAP_SUPER_ADMIN" }
    );
    assert.ifError(filterErr);
    assert.equal(
      secBootstrapFilter?.length || 0,
      0,
      "Secretary explicitly requesting BOOTSTRAP_SUPER_ADMIN receives 0 rows"
    );

    // H. Bounded pagination & Windowed total_count
    const { data: boundedLogs } = await cAdmin.rpc("get_audit_log_page", {
      p_limit: 2,
      p_offset: 0,
    });
    assert.equal(boundedLogs?.length, 2, "Limit 2 returns exactly 2 records");
    assert.ok(
      Number(boundedLogs?.[0]?.total_count || 0) >= 4,
      "total_count reflects overall matching records"
    );
  });

  // ==========================================================================
  // 5. Audit Metadata Privacy Trigger Defense-in-Depth Tests
  // ==========================================================================
  await t.test("Audit Metadata Privacy Trigger Defense-in-Depth", async () => {
    // A. Direct INSERT by authenticated user is denied by RLS
    const { error: directInsertErr } = await cAdmin.from("audit_logs").insert({
      actor_id: adminId,
      action: "DIRECT_TEST",
      entity_type: "test",
      metadata: {},
    });
    assert.ok(directInsertErr);
    assert.equal(directInsertErr.code, "42501");

    // B. Direct UPDATE on audit_logs is denied
    const { error: directUpdateErr } = await cAdmin
      .from("audit_logs")
      .update({ action: "TAMPER" })
      .eq("actor_id", adminId);
    assert.ok(directUpdateErr);
    assert.equal(directUpdateErr.code, "42501");

    // C. Direct DELETE on audit_logs is denied
    const { error: directDeleteErr } = await cAdmin
      .from("audit_logs")
      .delete()
      .eq("actor_id", adminId);
    assert.ok(directDeleteErr);
    assert.equal(directDeleteErr.code, "42501");

    // D. Service role insert with forbidden key "cgpa" is rejected by trigger (23514)
    const { error: cgpaErr } = await admin.from("audit_logs").insert({
      actor_id: adminId,
      action: "TEST_REJECT",
      entity_type: "test",
      metadata: { cgpa: 9.2 },
    });
    assert.ok(cgpaErr);
    assert.equal(cgpaErr.code, "23514");

    // E. Service role insert with forbidden key "token" is rejected by trigger (23514)
    const { error: tokenErr } = await admin.from("audit_logs").insert({
      actor_id: adminId,
      action: "TEST_REJECT",
      entity_type: "test",
      metadata: { token: "secret_123" },
    });
    assert.ok(tokenErr);
    assert.equal(tokenErr.code, "23514");

    // E2. Nested forbidden key detection (academic.cgpa)
    const { error: nestedCgpaErr } = await admin.from("audit_logs").insert({
      actor_id: adminId,
      action: "TEST_REJECT",
      entity_type: "test",
      metadata: { academic: { cgpa: 8.2 } },
    });
    assert.ok(nestedCgpaErr);
    assert.equal(nestedCgpaErr.code, "23514");

    // E3. Nested forbidden key detection (credentials.token)
    const { error: nestedTokenErr } = await admin.from("audit_logs").insert({
      actor_id: adminId,
      action: "TEST_REJECT",
      entity_type: "test",
      metadata: { credentials: { token: "secret_val" } },
    });
    assert.ok(nestedTokenErr);
    assert.equal(nestedTokenErr.code, "23514");

    // E4. Nested forbidden key in array element
    const { error: arrayTokenErr } = await admin.from("audit_logs").insert({
      actor_id: adminId,
      action: "TEST_REJECT",
      entity_type: "test",
      metadata: { items: [{ token: "nested_in_array" }] },
    });
    assert.ok(arrayTokenErr);
    assert.equal(arrayTokenErr.code, "23514");

    // E5. Case-variant key rejection (uppercase CGPA)
    const { error: upperCgpaErr } = await admin.from("audit_logs").insert({
      actor_id: adminId,
      action: "TEST_REJECT",
      entity_type: "test",
      metadata: { CGPA: 8.5 },
    });
    assert.ok(upperCgpaErr);
    assert.equal(upperCgpaErr.code, "23514");

    // E6. Case-variant key rejection (titlecase Token)
    const { error: titleTokenErr } = await admin.from("audit_logs").insert({
      actor_id: adminId,
      action: "TEST_REJECT",
      entity_type: "test",
      metadata: { Token: "bearer_xyz" },
    });
    assert.ok(titleTokenErr);
    assert.equal(titleTokenErr.code, "23514");

    // E7. Metadata with >500 nodes is rejected fail-closed (23514)
    const largeObj: Record<string, string | number> = {};
    for (let i = 0; i < 520; i++) {
      largeObj[`key_${i}`] = i;
    }
    largeObj["token"] = "after_threshold_secret";
    const { error: complexityErr } = await admin.from("audit_logs").insert({
      actor_id: adminId,
      action: "TEST_REJECT",
      entity_type: "test",
      metadata: largeObj,
    });
    assert.ok(complexityErr);
    assert.equal(complexityErr.code, "23514");

    // E8. Metadata >32KB is rejected fail-closed (23514)
    const largeBlob = "A".repeat(33000);
    const { error: sizeErr } = await admin.from("audit_logs").insert({
      actor_id: adminId,
      action: "TEST_REJECT",
      entity_type: "test",
      metadata: { blob: largeBlob },
    });
    assert.ok(sizeErr);
    assert.equal(sizeErr.code, "23514");

    // E9. Explicit Sanitizer Test Cases across top-level, nested object, nested array, mixed casing
    const explicitSanitizerCases: Array<{ name: string; metadata: unknown }> = [
      // 1. Top-level
      { name: "top-level snapshot_cgpa", metadata: { snapshot_cgpa: 9.0 } },
      {
        name: "top-level snapshot_backlogs",
        metadata: { snapshot_backlogs: 0 },
      },
      { name: "top-level JWT", metadata: { JWT: "eyJhbGciOi..." } },
      { name: "top-level OTP", metadata: { OTP: "123456" } },
      {
        name: "top-level invitation_URL",
        metadata: { invitation_URL: "https://example.com/invite" },
      },
      {
        name: "top-level signed_url",
        metadata: { signed_url: "https://example.com/s" },
      },
      {
        name: "top-level signed_document_url",
        metadata: { signed_document_url: "https://example.com/doc" },
      },
      {
        name: "top-level resume_content",
        metadata: { resume_content: "base64content" },
      },
      {
        name: "top-level access_token",
        metadata: { access_token: "secret_access" },
      },
      {
        name: "top-level refresh_token",
        metadata: { refresh_token: "secret_refresh" },
      },

      // 2. Nested object
      {
        name: "nested object snapshot_cgpa",
        metadata: { student: { snapshot_cgpa: 8.5 } },
      },
      {
        name: "nested object snapshot_backlogs",
        metadata: { student: { snapshot_backlogs: 1 } },
      },
      { name: "nested object JWT", metadata: { auth: { JWT: "eyJ..." } } },
      { name: "nested object OTP", metadata: { security: { OTP: "654321" } } },
      {
        name: "nested object invitation_URL",
        metadata: { invite: { invitation_URL: "https://..." } },
      },
      {
        name: "nested object signed_url",
        metadata: { docs: { signed_url: "https://..." } },
      },
      {
        name: "nested object signed_document_url",
        metadata: { storage: { signed_document_url: "https://..." } },
      },
      {
        name: "nested object resume_content",
        metadata: { file: { resume_content: "pdf" } },
      },
      {
        name: "nested object access_token",
        metadata: { session: { access_token: "tok" } },
      },
      {
        name: "nested object refresh_token",
        metadata: { session: { refresh_token: "tok" } },
      },

      // 3. Nested array
      {
        name: "nested array snapshot_cgpa",
        metadata: { history: [{ snapshot_cgpa: 8.0 }] },
      },
      {
        name: "nested array snapshot_backlogs",
        metadata: { records: [{ snapshot_backlogs: 0 }] },
      },
      { name: "nested array JWT", metadata: { tokens: [{ JWT: "jwt_val" }] } },
      { name: "nested array OTP", metadata: { attempts: [{ OTP: "999999" }] } },
      {
        name: "nested array invitation_URL",
        metadata: { links: [{ invitation_URL: "https://..." }] },
      },
      {
        name: "nested array signed_url",
        metadata: { attachments: [{ signed_url: "https://..." }] },
      },
      {
        name: "nested array signed_document_url",
        metadata: { files: [{ signed_document_url: "https://..." }] },
      },
      {
        name: "nested array resume_content",
        metadata: { uploads: [{ resume_content: "blob" }] },
      },
      {
        name: "nested array access_token",
        metadata: { auth_list: [{ access_token: "xyz" }] },
      },
      {
        name: "nested array refresh_token",
        metadata: { auth_list: [{ refresh_token: "abc" }] },
      },

      // 4. Mixed casing
      { name: "mixed casing Snapshot_CGPA", metadata: { Snapshot_CGPA: 7.9 } },
      {
        name: "mixed casing Snapshot_Backlogs",
        metadata: { Snapshot_Backlogs: 0 },
      },
      { name: "mixed casing jWt", metadata: { jWt: "token" } },
      { name: "mixed casing OtP", metadata: { OtP: "111222" } },
      {
        name: "mixed casing Invitation_Url",
        metadata: { Invitation_Url: "https://..." },
      },
      {
        name: "mixed casing Signed_Url",
        metadata: { Signed_Url: "https://..." },
      },
      {
        name: "mixed casing Signed_Document_URL",
        metadata: { Signed_Document_URL: "https://..." },
      },
      {
        name: "mixed casing Resume_Content",
        metadata: { Resume_Content: "data" },
      },
      { name: "mixed casing Access_Token", metadata: { Access_Token: "at" } },
      { name: "mixed casing Refresh_Token", metadata: { Refresh_Token: "rt" } },
    ];

    for (const tc of explicitSanitizerCases) {
      const { error: tcErr } = await admin.from("audit_logs").insert({
        actor_id: adminId,
        action: "TEST_REJECT",
        entity_type: "test",
        metadata: tc.metadata as NonNullable<Json>,
      });
      assert.ok(tcErr, `Expected error for ${tc.name}`);
      assert.equal(tcErr.code, "23514", `Expected 23514 for ${tc.name}`);
    }

    // F. Service role insert with clean metadata succeeds
    const { error: cleanErr } = await admin.from("audit_logs").insert({
      actor_id: adminId,
      action: "TEST_CLEAN",
      entity_type: "test",
      metadata: { note: "Clean metadata verified" },
    });
    assert.ifError(cleanErr);
  });

  // ==========================================================================
  // 6. Audited Published Drive Correction Suite (DRIVE_CORRECTED_PUBLISHED)
  // ==========================================================================
  await t.test("Audited Published Drive Correction Suite", async () => {
    let compId: string | null = null;
    const testDriveId = "70000000-0000-0000-0000-000000000099";
    try {
      // 1. Create a company and published placement drive for correction testing
      const { data: comp } = await admin
        .from("companies")
        .insert({
          name: "Phase 13 Tech Corp",
          normalized_name: "phase 13 tech corp",
          created_by: adminId,
        })
        .select("id")
        .single();
      assert.ok(comp?.id);
      compId = comp.id;

      const publishedAtTimestamp = new Date(
        Date.now() - 86400000
      ).toISOString();
      await admin.from("placement_drives").insert({
        id: testDriveId,
        company_id: comp.id,
        title: "Initial Published Title",
        drive_type: "PLACEMENT",
        status: "DRAFT",
        application_deadline: new Date(Date.now() + 864000000).toISOString(),
        created_by: adminId,
      });
      await admin
        .from("placement_drives")
        .update({
          status: "PUBLISHED",
          published_by: adminId,
          published_at: publishedAtTimestamp,
        })
        .eq("id", testDriveId);

      // 2. Anonymous / Student / Recruiter / Coordinator denied (42501)
      const { error: anonErr } = await anon.rpc("correct_published_drive", {
        p_drive_id: testDriveId,
        p_reason: "Anon correction attempt",
      });
      assert.ok(anonErr);
      assert.equal(anonErr.code, "42501");

      const { error: studErr } = await cStud.rpc("correct_published_drive", {
        p_drive_id: testDriveId,
        p_reason: "Student correction attempt",
      });
      assert.ok(studErr);
      assert.equal(studErr.code, "42501");

      const { error: recErr } = await cRecruiter.rpc(
        "correct_published_drive",
        {
          p_drive_id: testDriveId,
          p_reason: "Recruiter correction attempt",
        }
      );
      assert.ok(recErr);
      assert.equal(recErr.code, "42501");

      const { error: coordErr } = await cCoord.rpc("correct_published_drive", {
        p_drive_id: testDriveId,
        p_reason: "Coordinator correction attempt",
      });
      assert.ok(coordErr);
      assert.equal(coordErr.code, "42501");

      // 3. Short reason rejected with 22023
      const { error: shortReasonErr } = await cSec.rpc(
        "correct_published_drive",
        {
          p_drive_id: testDriveId,
          p_reason: "bad",
        }
      );
      assert.ok(shortReasonErr);
      assert.equal(shortReasonErr.code, "22023");

      // 4. Secretary successfully corrects published drive
      const newDeadline = new Date(Date.now() + 1200000000).toISOString();
      const { data: secCorrectRes, error: secCorrectErr } = await cSec.rpc(
        "correct_published_drive",
        {
          p_drive_id: testDriveId,
          p_reason: "Extended application deadline per recruiter request",
          p_title: "Corrected Drive Title by Secretary",
          p_application_deadline: newDeadline,
          p_location: "Nagpur Hybrid",
        }
      );
      assert.ifError(secCorrectErr);
      assert.ok(secCorrectRes);

      // 5. Verify database state: status remains PUBLISHED, published_at is preserved
      const { data: driveAfterSec } = await admin
        .from("placement_drives")
        .select("status, title, published_at, application_deadline, location")
        .eq("id", testDriveId)
        .single();

      assert.equal(driveAfterSec?.status, "PUBLISHED");
      assert.equal(driveAfterSec?.title, "Corrected Drive Title by Secretary");
      assert.ok(driveAfterSec?.published_at);
      assert.equal(
        new Date(driveAfterSec.published_at).getTime(),
        new Date(publishedAtTimestamp).getTime()
      );
      assert.equal(driveAfterSec?.location, "Nagpur Hybrid");

      // 6. Super Admin successfully corrects published drive
      const { error: adminCorrectErr } = await cAdmin.rpc(
        "correct_published_drive",
        {
          p_drive_id: testDriveId,
          p_reason: "Super Admin updated description and package details",
          p_title: "Final Corrected Drive Title",
          p_package_lpa: 15.5,
          p_description: "Updated software architect role",
        }
      );
      assert.ifError(adminCorrectErr);

      // 7. Audit log check: DRIVE_CORRECTED_PUBLISHED recorded
      const { data: auditLogs } = await admin
        .from("audit_logs")
        .select("action, entity_type, entity_id, metadata")
        .eq("action", "DRIVE_CORRECTED_PUBLISHED")
        .eq("entity_id", testDriveId);

      assert.ok(auditLogs && auditLogs.length >= 2);
      const lastLog = auditLogs[auditLogs.length - 1];
      assert.equal(lastLog?.action, "DRIVE_CORRECTED_PUBLISHED");
      assert.equal(lastLog?.entity_type, "placement_drive");
      assert.ok(
        typeof lastLog?.metadata === "object" && lastLog.metadata !== null
      );

      // 8. Both Super Admin and Secretary see the event in get_audit_log_page
      const { data: secAuditView } = await cSec.rpc("get_audit_log_page", {
        p_limit: 10,
        p_offset: 0,
        p_action: "DRIVE_CORRECTED_PUBLISHED",
      });
      assert.ok(secAuditView && secAuditView.length > 0);
      assert.equal(secAuditView[0]?.action, "DRIVE_CORRECTED_PUBLISHED");

      const { data: adminAuditView } = await cAdmin.rpc("get_audit_log_page", {
        p_limit: 10,
        p_offset: 0,
        p_action: "DRIVE_CORRECTED_PUBLISHED",
      });
      assert.ok(adminAuditView && adminAuditView.length > 0);
      assert.equal(adminAuditView[0]?.action, "DRIVE_CORRECTED_PUBLISHED");
    } finally {
      await admin.from("audit_logs").delete().eq("entity_id", testDriveId);
      await admin.from("placement_drives").delete().eq("id", testDriveId);
      if (compId) {
        await admin.from("companies").delete().eq("id", compId);
      }
    }
  });

  // ==========================================================================
  // Teardown: Restore Seed Super Admin
  // ==========================================================================
  t.after(async () => {
    await admin
      .from("profiles")
      .update({ is_active: false })
      .eq("role", "SUPER_ADMIN");
    await admin.from("profiles").upsert({
      id: "00000000-0000-0000-0000-000000000001",
      role: "SUPER_ADMIN",
      display_name: "Super Admin",
      is_active: true,
      coordinator_slot: null,
      student_lifecycle_status: null,
    });
  });
});
