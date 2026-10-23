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
import { NextRequest } from "next/server";
import type { Database } from "../src/types/database";
import { sanitizeCsvCell, generateCsv } from "../src/lib/csv";
import { GET } from "../src/app/api/staff/export/route";

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

interface DriveStat {
  year: number;
  placement_drives: number;
  internship_drives: number;
  total_drives: number;
}

interface ConversionStat {
  drive_id: string;
  drive_title: string;
  company_name: string;
  drive_type: string;
  drive_status: string;
  published_year: number;
  total_applied: number;
  total_selected: number;
  conversion_pct: number;
}

interface RepeatRecruiter {
  company_id: string;
  company_name: string;
  years_recruited: number;
  first_year: number;
  latest_year: number;
  total_drives: number;
}

interface InternshipConversion {
  total_internship_selected: number;
  converted_to_placement: number;
  conversion_rate_pct: number;
}

interface ExportPayload {
  export_type: string;
  row_count: number;
  data: Record<string, unknown>[];
}

interface AuditMetadata {
  export_type?: string;
  row_count?: number;
  filter_summary?: {
    batch?: string;
    drive_type?: string;
    [key: string]: unknown;
  };
  data?: unknown;
  csv?: unknown;
}

test("Phase 12 — Exports & Basic Operational Analytics Integration Suite", async (t) => {
  // ==========================================================================
  // Unit Test Suite: CSV Sanitization & Formula Injection Neutralization
  // ==========================================================================
  await t.test("CSV Sanitization and Formula Injection Neutralization", () => {
    // 1. Formula triggers neutralized by single-quote prefix
    assert.equal(sanitizeCsvCell("=1+1"), `"'=1+1"`);
    assert.equal(
      sanitizeCsvCell("+cmd|' /C calc'!A0"),
      `"'+cmd|' /C calc'!A0"`
    );
    assert.equal(sanitizeCsvCell("-5+2"), `"'-5+2"`);
    assert.equal(sanitizeCsvCell("@SUM(A1:A10)"), `"'@SUM(A1:A10)"`);
    assert.equal(sanitizeCsvCell("\tleadingTab"), `"'\tleadingTab"`);
    assert.equal(sanitizeCsvCell("\rleadingReturn"), `"'\rleadingReturn"`);

    // 1b. Leading whitespace before formula triggers is also strictly neutralized
    assert.equal(sanitizeCsvCell(" =SUM(1,1)"), `"' =SUM(1,1)"`);
    assert.equal(sanitizeCsvCell("  +cmd"), `"'  +cmd"`);
    assert.equal(sanitizeCsvCell("   -1+2"), `"'   -1+2"`);
    assert.equal(sanitizeCsvCell("  @evil"), `"'  @evil"`);

    // 2. Normal text, numbers, nulls
    assert.equal(
      sanitizeCsvCell("Foster and Partners"),
      `"Foster and Partners"`
    );
    assert.equal(sanitizeCsvCell(2026), `"2026"`);
    assert.equal(sanitizeCsvCell(true), `"true"`);
    assert.equal(sanitizeCsvCell(null), `""`);
    assert.equal(sanitizeCsvCell(undefined), `""`);

    // 3. RFC 4180 Quotes escaping
    assert.equal(sanitizeCsvCell('Hello "World"'), `"Hello ""World"""`);

    // 4. Full CSV generation with CRLF
    const headers = ["Name", "Formula", "Quotes"];
    const rows = [
      ["Alice", "=SUM(A1:B1)", 'Test "1"'],
      ["Bob", "-100", "Normal"],
    ];
    const csv = generateCsv(headers, rows);
    const expected =
      `"Name","Formula","Quotes"\r\n` +
      `"Alice","'=SUM(A1:B1)","Test ""1"""\r\n` +
      `"Bob","'-100","Normal"\r\n`;
    assert.equal(csv, expected);
  });

  // ==========================================================================
  // Database Setup: Program Lookup & Actor Provisioning
  // ==========================================================================
  const { data: barchProg } = await admin
    .from("academic_programs")
    .select("id, code")
    .eq("code", "BARCH")
    .single();

  assert.ok(barchProg, "BARCH academic program must exist");

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

    if (isActive) {
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
    }

    await admin.from("profiles").upsert({
      id: user.id,
      role,
      display_name: email.split("@")[0] || "User",
      is_active: isActive,
      coordinator_slot: slot || null,
      student_lifecycle_status:
        role === "STUDENT" ? lifecycle || "STUDENT_ACTIVE" : null,
    });

    return user.id;
  }

  const adminId = await setupUser("phase12_admin@vnit.test", "SUPER_ADMIN");
  const secId = await setupUser("phase12_sec@vnit.test", "TNP_SECRETARY");
  const coordId = await setupUser(
    "phase12_coord@vnit.test",
    "TNP_COORDINATOR",
    "SLOT_1"
  );
  const stud1Id = await setupUser(
    "phase12_stud1@vnit.test",
    "STUDENT",
    undefined,
    "STUDENT_ACTIVE"
  );
  const stud2Id = await setupUser(
    "phase12_stud2@vnit.test",
    "STUDENT",
    undefined,
    "STUDENT_ACTIVE"
  );
  const stud3Id = await setupUser(
    "phase12_stud3@vnit.test",
    "STUDENT",
    undefined,
    "STUDENT_ACTIVE"
  );
  const recruiterId = await setupUser(
    "phase12_recruiter@vnit.test",
    "RECRUITER"
  );
  const deactSecId = await setupUser(
    "phase12_deact_sec@vnit.test",
    "TNP_SECRETARY",
    undefined,
    undefined,
    false
  );

  // Helper client sign-in
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

  const cAdmin = await createClientForUser("phase12_admin@vnit.test");
  const cSec = await createClientForUser("phase12_sec@vnit.test");
  const cCoord = await createClientForUser("phase12_coord@vnit.test");
  const cStud1 = await createClientForUser("phase12_stud1@vnit.test");
  const cRecruiter = await createClientForUser("phase12_recruiter@vnit.test");
  const cDeactSec = await createClientForUser("phase12_deact_sec@vnit.test");

  // Roster & Academic records
  await admin.from("student_roster").upsert([
    {
      institutional_id: "BT22ARC091",
      full_name: "Student 12 One",
      institutional_email: "phase12_stud1@vnit.test",
      program_id: barchProg.id,
      batch: "2026",
      is_active: true,
      claimed_by: stud1Id,
    },
    {
      institutional_id: "BT22ARC092",
      full_name: "Student 12 Two",
      institutional_email: "phase12_stud2@vnit.test",
      program_id: barchProg.id,
      batch: "2026",
      is_active: true,
      claimed_by: stud2Id,
    },
    {
      institutional_id: "BT22ARC093",
      full_name: "Student 12 Three",
      institutional_email: "phase12_stud3@vnit.test",
      program_id: barchProg.id,
      batch: "2026",
      is_active: true,
      claimed_by: stud3Id,
    },
  ]);

  await admin.from("academic_records").upsert([
    {
      profile_id: stud1Id,
      program_id: barchProg.id,
      batch: "2026",
      cgpa: 8.75,
      active_backlogs: 0,
      verification_status: "VERIFIED",
      verified_by: adminId,
      verified_at: new Date().toISOString(),
    },
    {
      profile_id: stud2Id,
      program_id: barchProg.id,
      batch: "2026",
      cgpa: 7.9,
      active_backlogs: 0,
      verification_status: "VERIFIED",
      verified_by: adminId,
      verified_at: new Date().toISOString(),
    },
    {
      profile_id: stud3Id,
      program_id: barchProg.id,
      batch: "2026",
      cgpa: 9.1,
      active_backlogs: 0,
      verification_status: "VERIFIED",
      verified_by: adminId,
      verified_at: new Date().toISOString(),
    },
  ]);

  // Drives setup & initial cleanup:
  const drive2025Id = "71000000-0000-0000-0000-000000000001";
  const drive2026Id = "71000000-0000-0000-0000-000000000002";
  const driveInternId = "71000000-0000-0000-0000-000000000003";
  const driveDraftId = "71000000-0000-0000-0000-000000000004";

  await admin.from("alumni_profiles").delete().eq("profile_id", stud1Id);
  await admin
    .from("applications")
    .delete()
    .in("drive_id", [drive2025Id, drive2026Id, driveInternId, driveDraftId]);
  await admin
    .from("placement_drives")
    .delete()
    .in("id", [drive2025Id, drive2026Id, driveInternId, driveDraftId]);
  await admin
    .from("companies")
    .delete()
    .in("normalized_name", [
      "foster and partners nodetest",
      "gensler nodetest",
    ]);

  // Companies
  const { data: compFoster, error: compFosterErr } = await admin
    .from("companies")
    .insert({
      name: "Foster and Partners NodeTest",
      normalized_name: "FOSTER AND PARTNERS NODETEST",
      website: "https://foster-nodetest.test",
      created_by: adminId,
    })
    .select("id")
    .single();
  assert.ifError(compFosterErr);

  const { data: compGensler, error: compGenslerErr } = await admin
    .from("companies")
    .insert({
      name: "Gensler NodeTest",
      normalized_name: "GENSLER NODETEST",
      website: "https://gensler-nodetest.test",
      created_by: adminId,
    })
    .select("id")
    .single();
  assert.ifError(compGenslerErr);

  assert.ok(compFoster);
  assert.ok(compGensler);

  // Drive 1: Placement 2025 (CLOSED)
  await admin.from("placement_drives").insert({
    id: drive2025Id,
    company_id: compFoster.id,
    title: "Foster 2025 Campus Drive",
    drive_type: "PLACEMENT",
    status: "DRAFT",
    application_deadline: "2025-03-01T18:00:00Z",
    created_by: adminId,
  });
  await admin
    .from("placement_drives")
    .update({
      status: "PUBLISHED",
      published_by: adminId,
      published_at: "2025-02-01T10:00:00Z",
    })
    .eq("id", drive2025Id);
  await admin
    .from("placement_drives")
    .update({
      status: "CLOSED",
      closed_by: adminId,
      closed_at: "2025-03-15T10:00:00Z",
    })
    .eq("id", drive2025Id);

  // Drive 2: Placement 2026 (CLOSED)
  await admin.from("placement_drives").insert({
    id: drive2026Id,
    company_id: compFoster.id,
    title: "Foster 2026 Campus Drive",
    drive_type: "PLACEMENT",
    status: "DRAFT",
    application_deadline: "2026-03-01T18:00:00Z",
    created_by: adminId,
  });
  await admin
    .from("placement_drives")
    .update({
      status: "PUBLISHED",
      published_by: adminId,
      published_at: "2026-02-01T10:00:00Z",
    })
    .eq("id", drive2026Id);
  await admin
    .from("placement_drives")
    .update({
      status: "CLOSED",
      closed_by: adminId,
      closed_at: "2026-03-15T10:00:00Z",
    })
    .eq("id", drive2026Id);

  // Drive 3: Internship 2026 (CLOSED)
  await admin.from("placement_drives").insert({
    id: driveInternId,
    company_id: compGensler.id,
    title: "Gensler 2026 Internship Program",
    drive_type: "INTERNSHIP",
    status: "DRAFT",
    application_deadline: "2026-04-01T18:00:00Z",
    created_by: adminId,
  });
  await admin
    .from("placement_drives")
    .update({
      status: "PUBLISHED",
      published_by: adminId,
      published_at: "2026-03-01T10:00:00Z",
    })
    .eq("id", driveInternId);
  await admin
    .from("placement_drives")
    .update({
      status: "CLOSED",
      closed_by: adminId,
      closed_at: "2026-04-10T10:00:00Z",
    })
    .eq("id", driveInternId);

  // Drive 4: Draft Drive 2026 (DRAFT)
  await admin.from("placement_drives").insert({
    id: driveDraftId,
    company_id: compGensler.id,
    title: "Gensler 2026 Draft Drive",
    drive_type: "PLACEMENT",
    status: "DRAFT",
    application_deadline: "2026-05-01T18:00:00Z",
    created_by: adminId,
  });

  // Applications setup:
  // Drive 2026:
  // - stud1: SELECTED
  // - stud2: WITHDRAWN
  // - stud3: APPLIED
  const { error: insErr1 } = await admin.from("applications").insert([
    {
      drive_id: drive2026Id,
      student_id: stud1Id,
      status: "APPLIED",
    },
    {
      drive_id: drive2026Id,
      student_id: stud2Id,
      status: "APPLIED",
    },
    {
      drive_id: drive2026Id,
      student_id: stud3Id,
      status: "APPLIED",
    },
  ]);
  assert.ifError(insErr1);

  const { error: upErr1 } = await admin
    .from("applications")
    .update({ status: "SELECTED" })
    .match({ drive_id: drive2026Id, student_id: stud1Id });
  assert.ifError(upErr1);

  const { error: upErr2 } = await admin
    .from("applications")
    .update({ status: "WITHDRAWN" })
    .match({ drive_id: drive2026Id, student_id: stud2Id });
  assert.ifError(upErr2);

  // Drive Intern 2026:
  // - stud1: SELECTED (has both internship and placement)
  const { error: insErr2 } = await admin.from("applications").insert({
    drive_id: driveInternId,
    student_id: stud1Id,
    status: "APPLIED",
  });
  assert.ifError(insErr2);

  const { error: upErr3 } = await admin
    .from("applications")
    .update({ status: "SELECTED" })
    .match({ drive_id: driveInternId, student_id: stud1Id });
  assert.ifError(upErr3);

  // Alumni profile
  await admin.from("alumni_profiles").delete().eq("profile_id", stud1Id);
  const { error: alumErr } = await admin.from("alumni_profiles").upsert(
    {
      profile_id: stud1Id,
      graduation_year: 2026,
      program_id: barchProg.id,
      current_organization: null,
      company_id: compFoster.id,
      current_role: "Architectural Designer",
      professional_domain: "Architecture",
      city: "Mumbai",
      country: "India",
      willing_to_mentor: true,
      willing_to_refer: true,
      willing_to_support_placement: true,
      public_alumni_enabled: true,
      consent_recorded_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" }
  );
  assert.ifError(alumErr);

  // ==========================================================================
  // Test 1: Authoritative Operational Statistics RPCs
  // ==========================================================================
  await t.test(
    "Operational Statistics RPCs (Super Admin & Secretary Allowed)",
    async () => {
      // 1. Drive Statistics excludes DRAFT drives
      const { data: driveStats, error: driveErr } = await cAdmin.rpc(
        "get_staff_drive_statistics",
        { p_from_year: 2025, p_to_year: 2026 }
      );
      assert.ifError(driveErr);
      assert.ok(Array.isArray(driveStats));

      const stat2026 = (driveStats as DriveStat[]).find((s) => s.year === 2026);
      assert.ok(stat2026, "2026 stats must be present");
      // Draft drive (driveDraftId) must NOT be counted in total_drives
      assert.equal(stat2026.placement_drives, 1);
      assert.equal(stat2026.internship_drives, 1);
      assert.equal(stat2026.total_drives, 2);

      // 2. Conversion Statistics excludes WITHDRAWN from denominator
      const { data: convStats, error: convErr } = await cSec.rpc(
        "get_staff_conversion_statistics",
        { p_year: 2026, p_limit: 50 }
      );
      assert.ifError(convErr);
      assert.ok(Array.isArray(convStats));

      const fosterConv = (convStats as ConversionStat[]).find(
        (c) => c.drive_id === drive2026Id
      );
      assert.ok(fosterConv, "Foster 2026 conversion stats must exist");
      // 3 applied, 1 withdrawn => effective applied = 2
      assert.equal(fosterConv.total_applied, 2);
      assert.equal(fosterConv.total_selected, 1);
      // conversion percentage = round((1 / (3 - 1)) * 100, 2) = 50.00
      assert.equal(Number(fosterConv.conversion_pct), 50);

      // 3. Repeat Recruiters (closed/archived placement drives across >1 distinct year)
      const { data: repeatRecs, error: repErr } = await cAdmin.rpc(
        "get_staff_repeat_recruiters"
      );
      assert.ifError(repErr);
      assert.ok(Array.isArray(repeatRecs));

      const fosterRepeat = (repeatRecs as RepeatRecruiter[]).find(
        (r) => r.company_id === compFoster.id
      );
      assert.ok(
        fosterRepeat,
        "Foster and Partners must be identified as repeat recruiter"
      );
      assert.equal(fosterRepeat.years_recruited, 2);
      assert.equal(fosterRepeat.first_year, 2025);
      assert.equal(fosterRepeat.latest_year, 2026);

      // 4. Internship-to-Placement Conversion
      const { data: internConv, error: internErr } = await cSec.rpc(
        "get_staff_internship_placement_conversion"
      );
      assert.ifError(internErr);
      assert.ok(Array.isArray(internConv));

      const conv = (internConv as InternshipConversion[])[0];
      assert.ok(conv, "Internship-to-placement summary must exist");
      assert.equal(conv.total_internship_selected, 1);
      assert.equal(conv.converted_to_placement, 1);
      // Student 1 had both internship and placement
      assert.equal(Number(conv.conversion_rate_pct), 100);
    }
  );

  // ==========================================================================
  // Test 2: Bounded Data Exports & Privacy Projection
  // ==========================================================================
  await t.test(
    "Bounded Data Exports Projections and Privacy Enforcement",
    async () => {
      // 1. APPLICATIONS export
      const { data: appExport, error: appErr } = await cAdmin.rpc(
        "get_staff_export_data",
        {
          p_export_type: "APPLICATIONS",
          p_filters: { drive_id: drive2026Id },
        }
      );
      assert.ifError(appErr);
      const appPayload = appExport as unknown as ExportPayload;
      assert.equal(appPayload.export_type, "APPLICATIONS");
      assert.equal(appPayload.row_count, 3);
      const firstApp = appPayload.data[0]!;
      assert.ok(firstApp);
      assert.equal(firstApp.application_id, undefined);
      assert.ok(firstApp.student_name);
      assert.ok(firstApp.roll_number);
      assert.ok(firstApp.institutional_email);
      // Strict privacy: no CGPA, active backlogs, phone, or raw internal UUIDs
      assert.equal(firstApp.cgpa, undefined);
      assert.equal(firstApp.active_backlogs, undefined);
      assert.equal(firstApp.phone, undefined);

      // Verify zero UUID-shaped internal identifiers appear anywhere in the export row
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const [key, val] of Object.entries(firstApp)) {
        assert.ok(
          !uuidRegex.test(String(val)),
          `Field ${key} must not contain raw UUID: ${val}`
        );
      }

      // 2. DRIVE_RESULTS export
      const { data: driveExport, error: driveResErr } = await cSec.rpc(
        "get_staff_export_data",
        {
          p_export_type: "DRIVE_RESULTS",
          p_filters: { year: 2026 },
        }
      );
      assert.ifError(driveResErr);
      const drivePayload = driveExport as unknown as ExportPayload;
      assert.equal(drivePayload.export_type, "DRIVE_RESULTS");
      assert.ok(drivePayload.row_count >= 1);

      // 3. PLACEMENT_OUTCOMES export
      const { data: placeExport, error: placeErr } = await cAdmin.rpc(
        "get_staff_export_data",
        {
          p_export_type: "PLACEMENT_OUTCOMES",
          p_filters: { batch: "2026" },
        }
      );
      assert.ifError(placeErr);
      const placePayload = placeExport as unknown as ExportPayload;
      assert.equal(placePayload.export_type, "PLACEMENT_OUTCOMES");
      assert.ok(placePayload.row_count >= 1);

      // 4. INTERNSHIP_OUTCOMES export
      const { data: internExport, error: internResErr } = await cSec.rpc(
        "get_staff_export_data",
        {
          p_export_type: "INTERNSHIP_OUTCOMES",
          p_filters: { batch: "2026" },
        }
      );
      assert.ifError(internResErr);
      const internPayload = internExport as unknown as ExportPayload;
      assert.equal(internPayload.export_type, "INTERNSHIP_OUTCOMES");
      assert.ok(internPayload.row_count >= 1);

      // 5. ALUMNI_INDUSTRY export
      const { data: alumExport, error: alumErr } = await cAdmin.rpc(
        "get_staff_export_data",
        {
          p_export_type: "ALUMNI_INDUSTRY",
          p_filters: { batch: "2026" },
        }
      );
      assert.ifError(alumErr);
      const alumPayload = alumExport as unknown as ExportPayload;
      assert.equal(alumPayload.export_type, "ALUMNI_INDUSTRY");
      assert.ok(alumPayload.row_count >= 1);

      // 6. Invalid export type rejection
      const { error: invalidErr } = await cAdmin.rpc("get_staff_export_data", {
        p_export_type: "INVALID_EXPORT_TYPE",
        p_filters: {},
      });
      assert.ok(invalidErr);
      assert.equal(invalidErr.code, "22023");
    }
  );

  // ==========================================================================
  // Test 3: Hard 1,000-Row Export Limit Enforcement
  // ==========================================================================
  await t.test(
    "Hard 1000-Row Limit Clean Rejection (SQLSTATE 22023)",
    async () => {
      // Generate 1005 dummy companies to exceed the 1000 row hard cap
      const dummyCompanies = [];
      for (let i = 1; i <= 1005; i++) {
        dummyCompanies.push({
          name: `Cap Test Company ${i.toString().padStart(4, "0")}`,
          normalized_name: `cap test company ${i.toString().padStart(4, "0")}`,
          website: `https://captest${i}.test`,
          created_by: adminId,
        });
      }

      const { error: insertErr } = await admin
        .from("companies")
        .insert(dummyCompanies);
      assert.ifError(insertErr);

      try {
        // get_staff_export_data('COMPANIES') must raise 22023 exceeding 1000 rows
        const { error: capErr } = await cAdmin.rpc("get_staff_export_data", {
          p_export_type: "COMPANIES",
          p_filters: {},
        });

        assert.ok(capErr, "Export of over 1000 rows must fail with exception");
        assert.equal(capErr.code, "22023");
        assert.match(
          capErr.message,
          /Export row limit exceeded: query matches \d+ rows, maximum allowed is 1000/
        );
      } finally {
        // Clean up dummy companies
        await admin
          .from("companies")
          .delete()
          .like("name", "Cap Test Company %");
      }
    }
  );

  // ==========================================================================
  // Test 4: Export Audit Logging Atomicity & Privacy
  // ==========================================================================
  await t.test("Sanitized DATA_EXPORT_REQUESTED Audit Logging", async () => {
    const { error: auditErr } = await cAdmin.rpc("record_export_audit", {
      p_export_type: "APPLICATIONS",
      p_filter_summary: { batch: "2026", drive_type: "PLACEMENT" },
      p_row_count: 42,
    });
    assert.ifError(auditErr);

    const { data: auditEntry, error: logErr } = await admin
      .from("audit_logs")
      .select("action, actor_id, metadata")
      .eq("action", "DATA_EXPORT_REQUESTED")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    assert.ifError(logErr);
    assert.ok(auditEntry);
    assert.equal(auditEntry.actor_id, adminId);
    const meta = auditEntry.metadata as AuditMetadata;
    assert.equal(meta?.export_type, "APPLICATIONS");
    assert.equal(meta?.row_count, 42);
    assert.equal(meta?.filter_summary?.batch, "2026");

    // Ensure raw data or payload is never in metadata
    assert.equal(meta?.data, undefined);
    assert.equal(meta?.csv, undefined);
  });

  // ==========================================================================
  // Test 5: Role-Based Authority Boundary Enforcements
  // ==========================================================================
  await t.test(
    "Authority Boundary Enforcements (Coordinator, Student, Recruiter, Inactive, Anon Denied)",
    async () => {
      // 1. Coordinator Denied (42501)
      const { error: errCoordStats } = await cCoord.rpc(
        "get_staff_drive_statistics"
      );
      assert.ok(errCoordStats);
      assert.equal(errCoordStats.code, "42501");

      const { error: errCoordConv } = await cCoord.rpc(
        "get_staff_conversion_statistics"
      );
      assert.ok(errCoordConv);
      assert.equal(errCoordConv.code, "42501");

      const { error: errCoordRepeat } = await cCoord.rpc(
        "get_staff_repeat_recruiters"
      );
      assert.ok(errCoordRepeat);
      assert.equal(errCoordRepeat.code, "42501");

      const { error: errCoordExport } = await cCoord.rpc(
        "get_staff_export_data",
        {
          p_export_type: "APPLICATIONS",
        }
      );
      assert.ok(errCoordExport);
      assert.equal(errCoordExport.code, "42501");

      const { error: errCoordAudit } = await cCoord.rpc("record_export_audit", {
        p_export_type: "APPLICATIONS",
        p_filter_summary: {},
        p_row_count: 1,
      });
      assert.ok(errCoordAudit);
      assert.equal(errCoordAudit.code, "42501");

      // 2. Student Denied (42501)
      const { error: errStudStats } = await cStud1.rpc(
        "get_staff_drive_statistics"
      );
      assert.ok(errStudStats);
      assert.equal(errStudStats.code, "42501");

      const { error: errStudExport } = await cStud1.rpc(
        "get_staff_export_data",
        {
          p_export_type: "APPLICATIONS",
        }
      );
      assert.ok(errStudExport);
      assert.equal(errStudExport.code, "42501");

      // 3. Recruiter Denied (42501)
      const { error: errRecStats } = await cRecruiter.rpc(
        "get_staff_drive_statistics"
      );
      assert.ok(errRecStats);
      assert.equal(errRecStats.code, "42501");

      const { error: errRecExport } = await cRecruiter.rpc(
        "get_staff_export_data",
        {
          p_export_type: "APPLICATIONS",
        }
      );
      assert.ok(errRecExport);
      assert.equal(errRecExport.code, "42501");

      // 4. Inactive Staff Denied (42501)
      const { error: errDeactStats } = await cDeactSec.rpc(
        "get_staff_drive_statistics"
      );
      assert.ok(errDeactStats);
      assert.equal(errDeactStats.code, "42501");

      const { error: errDeactExport } = await cDeactSec.rpc(
        "get_staff_export_data",
        {
          p_export_type: "APPLICATIONS",
        }
      );
      assert.ok(errDeactExport);
      assert.equal(errDeactExport.code, "42501");

      // 5. Anonymous Denied (42501)
      const { error: errAnonStats } = await anon.rpc(
        "get_staff_drive_statistics"
      );
      assert.ok(errAnonStats);
      assert.equal(errAnonStats.code, "42501");

      const { error: errAnonConv } = await anon.rpc(
        "get_staff_conversion_statistics"
      );
      assert.ok(errAnonConv);
      assert.equal(errAnonConv.code, "42501");

      const { error: errAnonRepeat } = await anon.rpc(
        "get_staff_repeat_recruiters"
      );
      assert.ok(errAnonRepeat);
      assert.equal(errAnonRepeat.code, "42501");

      const { error: errAnonExport } = await anon.rpc("get_staff_export_data", {
        p_export_type: "APPLICATIONS",
      });
      assert.ok(errAnonExport);
      assert.equal(errAnonExport.code, "42501");

      const { error: errAnonAudit } = await anon.rpc("record_export_audit", {
        p_export_type: "APPLICATIONS",
        p_filter_summary: {},
        p_row_count: 0,
      });
      assert.ok(errAnonAudit);
      assert.equal(errAnonAudit.code, "42501");
    }
  );

  // ==========================================================================
  // Test 6: HTTP Route Handler Validation & Endpoint Security
  // ==========================================================================
  await t.test(
    "HTTP Route Handler Parameter Validation & Endpoint Boundary",
    async () => {
      // 1. Missing type parameter returns 400 Bad Request
      const reqMissing = new NextRequest(
        "http://localhost:3000/api/staff/export"
      );
      const resMissing = await GET(reqMissing);
      assert.equal(resMissing.status, 400);
      const bodyMissing = await resMissing.json();
      assert.equal(bodyMissing.error, "Missing export type parameter");

      // 2. Unauthenticated request returns 400 with Authentication required
      const reqUnauth = new NextRequest(
        "http://localhost:3000/api/staff/export?type=APPLICATIONS"
      );
      const resUnauth = await GET(reqUnauth);
      assert.equal(resUnauth.status, 400);
      const bodyUnauth = await resUnauth.json();
      assert.equal(bodyUnauth.error, "Authentication required");
    }
  );

  // ==========================================================================
  // Suite Teardown & Invariant Restoration
  // ==========================================================================
  t.after(async () => {
    // 1. Deactivate test actors
    await admin
      .from("profiles")
      .update({ is_active: false })
      .in("id", [
        adminId,
        secId,
        coordId,
        stud1Id,
        stud2Id,
        stud3Id,
        recruiterId,
        deactSecId,
      ]);

    // 2. Reactivate canonical seed super admin
    await admin
      .from("profiles")
      .update({ is_active: true })
      .eq("id", "00000000-0000-0000-0000-000000000001");

    // Clean up alumni profiles
    await admin.from("alumni_profiles").delete().eq("profile_id", stud1Id);

    // 3. Clean up test applications & drives
    await admin
      .from("applications")
      .delete()
      .in("drive_id", [drive2025Id, drive2026Id, driveInternId, driveDraftId]);

    await admin
      .from("placement_drives")
      .delete()
      .in("id", [drive2025Id, drive2026Id, driveInternId, driveDraftId]);

    // 4. Clean up test companies
    await admin
      .from("companies")
      .delete()
      .in("id", [compFoster.id, compGensler.id]);

    // 5. Clean up student roster & academic records
    await admin
      .from("student_roster")
      .delete()
      .in("institutional_id", ["BT22ARC091", "BT22ARC092", "BT22ARC093"]);
  });
});
