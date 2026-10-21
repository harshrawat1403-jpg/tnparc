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

interface DriveRpcResult {
  success?: boolean;
  drive_id?: string;
  status?: string;
  access_id?: string;
  batches_count?: number;
}

interface EligibilityResult {
  academic_result: string;
  is_available: boolean;
  reason_codes: string[];
}

test("Phase 7 Placement Drives, Authoritative Eligibility & Recruiter Isolation Suite", async (t) => {
  // --------------------------------------------------------------------------
  // Setup Fixture Identifiers & Accounts
  // --------------------------------------------------------------------------
  const adminId = "10000000-0000-0000-0000-000000000001";
  const secId = "20000000-0000-0000-0000-000000000001";
  const coordId = "30000000-0000-0000-0000-000000000001";

  // Students
  const sAliceId = "40000000-0000-0000-0000-000000000001"; // BARCH 2026, 8.5 CGPA, 0 backlogs (PASS)
  const sBobId = "40000000-0000-0000-0000-000000000002"; // MPLAN 2026, 7.5 CGPA, 0 backlogs (Wrong Program)
  const sCharlieId = "40000000-0000-0000-0000-000000000003"; // BARCH 2025, 9.0 CGPA, 0 backlogs (Wrong Batch)
  const sDaveId = "40000000-0000-0000-0000-000000000004"; // BARCH 2026, 5.5 CGPA, 3 backlogs (Fail CGPA + Backlog)
  const sEveId = "40000000-0000-0000-0000-000000000005"; // BARCH 2026, UNVERIFIED (Undetermined)
  const sFrankId = "40000000-0000-0000-0000-000000000006"; // BARCH 2026, Missing Academics (Undetermined)
  const sGraceId = "40000000-0000-0000-0000-000000000007"; // BARCH 2026, GRADUATED (Undetermined)
  const sHenryId = "40000000-0000-0000-0000-000000000008"; // PHD 2026, Non-placement eligible (Fail Program)
  const sIvyId = "40000000-0000-0000-0000-000000000009"; // BARCH 2026, Prior Selected Placement (Fail Placed)
  const sJackId = "40000000-0000-0000-0000-000000000010"; // BARCH 2026, Prior Selected Internship (Pass)
  const sBoundaryId = "40000000-0000-0000-0000-000000000011"; // BARCH 2026, Boundary Student
  const sInactiveId = "40000000-0000-0000-0000-000000000012"; // Inactive student
  const sAlumniId = "40000000-0000-0000-0000-000000000013"; // ALUMNI lifecycle

  // Recruiters
  const rAcmeId = "50000000-0000-0000-0000-000000000001"; // Acme Recruiter (active)
  const rGlobexId = "50000000-0000-0000-0000-000000000002"; // Globex Recruiter (active)
  const rInactId = "50000000-0000-0000-0000-000000000003"; // Inactive Contact Recruiter

  // Companies & Contacts
  const companyAcmeId = "60000000-0000-0000-0000-000000000001";
  const companyArchId = "60000000-0000-0000-0000-000000000002";
  const companyGlobexId = "60000000-0000-0000-0000-000000000003";

  const contactAcmeId = "70000000-0000-0000-0000-000000000001";
  const contactGlobexId = "70000000-0000-0000-0000-000000000002";
  const contactInactId = "70000000-0000-0000-0000-000000000003";

  // Academic programs
  const { data: barchProg } = await admin
    .from("academic_programs")
    .select("id")
    .eq("code", "BARCH")
    .single();
  const { data: mplanProg } = await admin
    .from("academic_programs")
    .select("id")
    .eq("code", "MPLAN")
    .single();
  const { data: phdProg } = await admin
    .from("academic_programs")
    .select("id")
    .eq("code", "PHD")
    .single();

  assert.ok(barchProg?.id);
  assert.ok(mplanProg?.id);
  assert.ok(phdProg?.id);

  // Seed / ensure auth users
  const usersToSeed = [
    { id: adminId, email: "phase7_admin@vnit.test" },
    { id: secId, email: "phase7_sec@vnit.test" },
    { id: coordId, email: "phase7_coord@vnit.test" },
    { id: sAliceId, email: "phase7_alice@vnit.test" },
    { id: sBobId, email: "phase7_bob@vnit.test" },
    { id: sCharlieId, email: "phase7_charlie@vnit.test" },
    { id: sDaveId, email: "phase7_dave@vnit.test" },
    { id: sEveId, email: "phase7_eve@vnit.test" },
    { id: sFrankId, email: "phase7_frank@vnit.test" },
    { id: sGraceId, email: "phase7_grace@vnit.test" },
    { id: sHenryId, email: "phase7_henry@vnit.test" },
    { id: sIvyId, email: "phase7_ivy@vnit.test" },
    { id: sJackId, email: "phase7_jack@vnit.test" },
    { id: sBoundaryId, email: "phase7_boundary@vnit.test" },
    { id: sInactiveId, email: "phase7_inactive@vnit.test" },
    { id: sAlumniId, email: "phase7_alumni@vnit.test" },
    { id: rAcmeId, email: "phase7_recruiter@acme.test" },
    { id: rGlobexId, email: "phase7_recruiter@globex.test" },
    { id: rInactId, email: "phase7_inactive@acme.test" },
  ];

  for (const u of usersToSeed) {
    const { error: createErr } = await admin.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password: "TestPassword123!",
      email_confirm: true,
    });
    if (createErr) {
      await admin.auth.admin.updateUserById(u.id, {
        password: "TestPassword123!",
      });
    }
  }

  // Deactivate existing active staff to avoid unique slot / role constraint conflicts
  await admin
    .from("profiles")
    .update({ is_active: false })
    .in("role", ["SUPER_ADMIN", "TNP_SECRETARY", "TNP_COORDINATOR"]);

  // Seed / ensure profiles
  const { error: profErr } = await admin.from("profiles").upsert([
    {
      id: adminId,
      role: "SUPER_ADMIN",
      display_name: "Super Admin",
      is_active: true,
    },
    {
      id: secId,
      role: "TNP_SECRETARY",
      display_name: "Secretary Jane",
      is_active: true,
    },
    {
      id: coordId,
      role: "TNP_COORDINATOR",
      display_name: "Coordinator Bob",
      is_active: true,
      coordinator_slot: "SLOT_1",
    },
    {
      id: sAliceId,
      role: "STUDENT",
      display_name: "Alice Architect",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    {
      id: sBobId,
      role: "STUDENT",
      display_name: "Bob Planner",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    {
      id: sCharlieId,
      role: "STUDENT",
      display_name: "Charlie Senior",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    {
      id: sDaveId,
      role: "STUDENT",
      display_name: "Dave Struggling",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    {
      id: sEveId,
      role: "STUDENT",
      display_name: "Eve Unverified",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    {
      id: sFrankId,
      role: "STUDENT",
      display_name: "Frank NoRecord",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    {
      id: sGraceId,
      role: "STUDENT",
      display_name: "Grace Graduated",
      is_active: true,
      student_lifecycle_status: "STUDENT_GRADUATED",
    },
    {
      id: sHenryId,
      role: "STUDENT",
      display_name: "Henry Doctoral",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    {
      id: sIvyId,
      role: "STUDENT",
      display_name: "Ivy Placed",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    {
      id: sJackId,
      role: "STUDENT",
      display_name: "Jack Interned",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    {
      id: sBoundaryId,
      role: "STUDENT",
      display_name: "Boundary Student",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    {
      id: sInactiveId,
      role: "STUDENT",
      display_name: "Inactive Student",
      is_active: false,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    {
      id: sAlumniId,
      role: "STUDENT",
      display_name: "Alumni Student",
      is_active: true,
      student_lifecycle_status: "ALUMNI",
    },
    {
      id: rAcmeId,
      role: "RECRUITER",
      display_name: "Acme Recruiter",
      is_active: true,
    },
    {
      id: rGlobexId,
      role: "RECRUITER",
      display_name: "Globex Recruiter",
      is_active: true,
    },
    {
      id: rInactId,
      role: "RECRUITER",
      display_name: "Inactive Recruiter",
      is_active: true,
    },
  ]);
  assert.ifError(profErr);

  // Seed academic records
  const { error: acadErr } = await admin.from("academic_records").upsert(
    [
      {
        profile_id: sAliceId,
        program_id: barchProg.id,
        batch: "2026",
        cgpa: 8.5,
        active_backlogs: 0,
        verification_status: "VERIFIED",
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      },
      {
        profile_id: sBobId,
        program_id: mplanProg.id,
        batch: "2026",
        cgpa: 7.5,
        active_backlogs: 0,
        verification_status: "VERIFIED",
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      },
      {
        profile_id: sCharlieId,
        program_id: barchProg.id,
        batch: "2025",
        cgpa: 9.0,
        active_backlogs: 0,
        verification_status: "VERIFIED",
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      },
      {
        profile_id: sDaveId,
        program_id: barchProg.id,
        batch: "2026",
        cgpa: 5.5,
        active_backlogs: 3,
        verification_status: "VERIFIED",
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      },
      {
        profile_id: sEveId,
        program_id: barchProg.id,
        batch: "2026",
        cgpa: 8.0,
        active_backlogs: 0,
        verification_status: "UNVERIFIED",
      },
      {
        profile_id: sGraceId,
        program_id: barchProg.id,
        batch: "2026",
        cgpa: 8.8,
        active_backlogs: 0,
        verification_status: "VERIFIED",
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      },
      {
        profile_id: sHenryId,
        program_id: phdProg.id,
        batch: "2026",
        cgpa: 8.2,
        active_backlogs: 0,
        verification_status: "VERIFIED",
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      },
      {
        profile_id: sIvyId,
        program_id: barchProg.id,
        batch: "2026",
        cgpa: 8.5,
        active_backlogs: 0,
        verification_status: "VERIFIED",
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      },
      {
        profile_id: sJackId,
        program_id: barchProg.id,
        batch: "2026",
        cgpa: 8.5,
        active_backlogs: 0,
        verification_status: "VERIFIED",
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      },
      {
        profile_id: sBoundaryId,
        program_id: barchProg.id,
        batch: "2026",
        cgpa: 7.0,
        active_backlogs: 1,
        verification_status: "VERIFIED",
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      },
    ],
    { onConflict: "profile_id" }
  );
  assert.ifError(acadErr);

  // Seed companies
  const { error: compErr } = await admin.from("companies").upsert([
    {
      id: companyAcmeId,
      name: "Acme Architecture Studio",
      normalized_name: "acme architecture studio",
      website: "https://acme-studio.test",
      is_archived: false,
      created_by: adminId,
    },
    {
      id: companyArchId,
      name: "Archived Beta Corp",
      normalized_name: "archived beta corp",
      website: "https://beta.test",
      is_archived: true,
      created_by: adminId,
    },
    {
      id: companyGlobexId,
      name: "Globex Planning Associates",
      normalized_name: "globex planning associates",
      website: "https://globex-planning.test",
      is_archived: false,
      created_by: adminId,
    },
  ]);
  assert.ifError(compErr);

  // Seed recruiter contacts
  const { error: contErr } = await admin.from("recruiter_contacts").upsert([
    {
      id: contactAcmeId,
      company_id: companyAcmeId,
      full_name: "Alice Contact",
      email: "phase7_recruiter@acme.test",
      is_active: true,
      created_by: adminId,
    },
    {
      id: contactGlobexId,
      company_id: companyGlobexId,
      full_name: "Greg Contact",
      email: "phase7_recruiter@globex.test",
      is_active: true,
      created_by: adminId,
    },
    {
      id: contactInactId,
      company_id: companyAcmeId,
      full_name: "Inactive Contact",
      email: "phase7_inactive@acme.test",
      is_active: false,
      created_by: adminId,
    },
  ]);
  assert.ifError(contErr);

  // Seed recruiter profiles
  const { error: rpErr } = await admin.from("recruiter_profiles").upsert(
    [
      {
        profile_id: rAcmeId,
        company_id: companyAcmeId,
        recruiter_contact_id: contactAcmeId,
      },
      {
        profile_id: rGlobexId,
        company_id: companyGlobexId,
        recruiter_contact_id: contactGlobexId,
      },
      {
        profile_id: rInactId,
        company_id: companyAcmeId,
        recruiter_contact_id: contactInactId,
      },
    ],
    { onConflict: "profile_id" }
  );
  assert.ifError(rpErr);

  // Client sessions
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

  const clientAdmin = await createClientForUser("phase7_admin@vnit.test");
  const clientSec = await createClientForUser("phase7_sec@vnit.test");
  const clientCoord = await createClientForUser("phase7_coord@vnit.test");
  const clientAlice = await createClientForUser("phase7_alice@vnit.test");
  const clientBob = await createClientForUser("phase7_bob@vnit.test");
  const clientCharlie = await createClientForUser("phase7_charlie@vnit.test");
  const clientDave = await createClientForUser("phase7_dave@vnit.test");
  const clientEve = await createClientForUser("phase7_eve@vnit.test");
  const clientFrank = await createClientForUser("phase7_frank@vnit.test");
  const clientGrace = await createClientForUser("phase7_grace@vnit.test");
  const clientHenry = await createClientForUser("phase7_henry@vnit.test");
  const clientIvy = await createClientForUser("phase7_ivy@vnit.test");
  const clientJack = await createClientForUser("phase7_jack@vnit.test");
  const clientBoundary = await createClientForUser("phase7_boundary@vnit.test");
  const clientRecAcme = await createClientForUser("phase7_recruiter@acme.test");
  const clientRecGlobex = await createClientForUser(
    "phase7_recruiter@globex.test"
  );

  const anonClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Track drive IDs
  let mainDriveId: string = "";

  // ==========================================================================
  // Section 1: Drive Creation & Management
  // ==========================================================================
  await t.test(
    "1.1 Coordinator can create placement drive in DRAFT state",
    async () => {
      const { data, error } = await clientCoord.rpc("create_placement_drive", {
        p_company_id: companyAcmeId,
        p_title: "Acme Principal Architect 2026",
        p_drive_type: "PLACEMENT",
        p_description: "Campus placement drive for architecture graduates",
        p_location: "Nagpur HQ",
        p_application_deadline: new Date(
          Date.now() + 30 * 86400000
        ).toISOString(),
        p_package_lpa: 14.5,
        p_compensation_details: "14.5 LPA fixed CTC",
        p_requirements_info: "Portfolio submission required",
      });

      assert.ifError(error);
      const res = data as unknown as DriveRpcResult;
      assert.ok(res.drive_id);
      mainDriveId = res.drive_id;

      // Verify initial DRAFT state and auto-created eligibility row
      const { data: driveRow } = await admin
        .from("placement_drives")
        .select("status, company_id, title, drive_type")
        .eq("id", mainDriveId)
        .single();

      assert.equal(driveRow?.status, "DRAFT");
      assert.equal(driveRow?.company_id, companyAcmeId);
      assert.equal(driveRow?.drive_type, "PLACEMENT");

      const { data: eligRow } = await admin
        .from("drive_eligibility")
        .select("minimum_cgpa, maximum_active_backlogs")
        .eq("drive_id", mainDriveId)
        .single();

      assert.ok(eligRow);
      assert.equal(eligRow?.minimum_cgpa, 0.0);
      assert.equal(eligRow?.maximum_active_backlogs, 0);
    }
  );

  await t.test(
    "1.2 Creation rejected for archived companies, empty title, and negative package",
    async () => {
      // Archived company rejected
      const { error: errArch } = await clientCoord.rpc(
        "create_placement_drive",
        {
          p_company_id: companyArchId,
          p_title: "Archived Company Drive",
          p_drive_type: "PLACEMENT",
        }
      );
      assert.ok(errArch?.message.includes("archived company"));

      // Empty title rejected
      const { error: errTitle } = await clientCoord.rpc(
        "create_placement_drive",
        {
          p_company_id: companyAcmeId,
          p_title: "   ",
          p_drive_type: "PLACEMENT",
        }
      );
      assert.ok(errTitle?.message.includes("Drive title cannot be empty"));

      // Negative package rejected
      const { error: errPkg } = await clientCoord.rpc(
        "create_placement_drive",
        {
          p_company_id: companyAcmeId,
          p_title: "Negative Package Drive",
          p_drive_type: "PLACEMENT",
          p_package_lpa: -5.0,
        }
      );
      assert.ok(errPkg?.message.includes("Package LPA must be between"));
    }
  );

  await t.test(
    "1.3 Coordinator can update DRAFT drive; unauthorized roles rejected",
    async () => {
      const { error: updateErr } = await clientCoord.rpc(
        "update_placement_drive",
        {
          p_drive_id: mainDriveId,
          p_title: "Acme Principal Architect 2026 (Updated)",
          p_package_lpa: 15.0,
        }
      );
      assert.ifError(updateErr);

      // Verify update
      const { data: updatedRow } = await admin
        .from("placement_drives")
        .select("title, package_lpa")
        .eq("id", mainDriveId)
        .single();
      assert.equal(
        updatedRow?.title,
        "Acme Principal Architect 2026 (Updated)"
      );
      assert.equal(updatedRow?.package_lpa, 15.0);

      // Student update rejected
      const { error: studentErr } = await clientAlice.rpc(
        "update_placement_drive",
        {
          p_drive_id: mainDriveId,
          p_title: "Hacked by Student",
        }
      );
      assert.ok(studentErr?.message.includes("Unauthorized"));

      // Recruiter update rejected
      const { error: recErr } = await clientRecAcme.rpc(
        "update_placement_drive",
        {
          p_drive_id: mainDriveId,
          p_title: "Hacked by Recruiter",
        }
      );
      assert.ok(recErr?.message.includes("Unauthorized"));
    }
  );

  await t.test(
    "1.4 Direct SQL mutations on placement_drives table are strictly blocked",
    async () => {
      // Direct INSERT blocked for staff/students
      const { error: insErr } = await clientCoord
        .from("placement_drives")
        .insert({
          company_id: companyAcmeId,
          title: "Direct SQL Insert Attempt",
          drive_type: "PLACEMENT",
          created_by: coordId,
        });
      assert.ok(insErr);

      // Direct UPDATE blocked
      const { error: updErr } = await clientCoord
        .from("placement_drives")
        .update({ title: "Direct SQL Update Attempt" })
        .eq("id", mainDriveId);
      assert.ok(updErr);

      // Direct DELETE blocked
      const { error: delErr } = await clientAdmin
        .from("placement_drives")
        .delete()
        .eq("id", mainDriveId);
      assert.ok(delErr);
    }
  );

  // ==========================================================================
  // Section 2: Eligibility Configuration & Cohort Targeting
  // ==========================================================================
  await t.test(
    "2.1 Coordinator configures eligibility thresholds and cohort targeting",
    async () => {
      // Configure thresholds: Min CGPA 7.00, Max backlogs 0, exclude placed = true
      const { error: critErr } = await clientCoord.rpc(
        "configure_drive_eligibility",
        {
          p_drive_id: mainDriveId,
          p_minimum_cgpa: 7.0,
          p_maximum_active_backlogs: 0,
          p_exclude_previously_selected_placement: true,
          p_informational_requirements:
            "Proficiency in AutoCAD and Revit required",
        }
      );
      assert.ifError(critErr);

      // Configure eligible cohorts: Target BARCH 2026 only
      const { error: batchErr } = await clientCoord.rpc(
        "configure_drive_eligible_batches",
        {
          p_drive_id: mainDriveId,
          p_batches: [{ program_id: barchProg.id, batch: "2026" }],
        }
      );
      assert.ifError(batchErr);

      // Verify persisted rows
      const { data: batches } = await admin
        .from("drive_eligible_batches")
        .select("program_id, batch")
        .eq("drive_id", mainDriveId);

      assert.ok(batches);
      assert.equal(batches.length, 1);
      assert.equal(batches[0]!.batch, "2026");
    }
  );

  await t.test(
    "2.2 Students and Recruiters cannot configure criteria or cohorts",
    async () => {
      const { error: sCritErr } = await clientAlice.rpc(
        "configure_drive_eligibility",
        {
          p_drive_id: mainDriveId,
          p_minimum_cgpa: 0.0,
          p_maximum_active_backlogs: 10,
        }
      );
      assert.ok(sCritErr?.message.includes("Unauthorized"));

      const { error: rBatchErr } = await clientRecAcme.rpc(
        "configure_drive_eligible_batches",
        {
          p_drive_id: mainDriveId,
          p_batches: [],
        }
      );
      assert.ok(rBatchErr?.message.includes("Unauthorized"));
    }
  );

  // ==========================================================================
  // Section 3: Publishing, Deadline Boundaries, Freezing & Lifecycle
  // ==========================================================================
  await t.test(
    "3.1 Drive deadline boundary validation on publication",
    async () => {
      // Create draft drive without deadline
      const { data: noDlData } = await clientCoord.rpc(
        "create_placement_drive",
        {
          p_company_id: companyAcmeId,
          p_title: "No Deadline Draft",
          p_drive_type: "PLACEMENT",
        }
      );
      const noDlDriveId = (noDlData as unknown as DriveRpcResult).drive_id!;

      await clientCoord.rpc("configure_drive_eligible_batches", {
        p_drive_id: noDlDriveId,
        p_batches: [{ program_id: barchProg.id, batch: "2026" }],
      });

      // 1. Publishing with NULL deadline fails
      const { error: nullDlErr } = await clientSec.rpc(
        "publish_placement_drive",
        {
          p_drive_id: noDlDriveId,
        }
      );
      assert.ok(
        nullDlErr?.message.includes("deadline must be set") ||
          nullDlErr?.message.includes("deadline is required")
      );

      // 2. Publishing with past deadline fails
      await admin
        .from("placement_drives")
        .update({
          application_deadline: new Date(Date.now() - 3600000).toISOString(),
        })
        .eq("id", noDlDriveId);

      const { error: pastDlErr } = await clientSec.rpc(
        "publish_placement_drive",
        {
          p_drive_id: noDlDriveId,
        }
      );
      assert.ok(pastDlErr?.message.includes("deadline must be in the future"));
    }
  );

  await t.test(
    "3.2 Coordinator CANNOT publish drives; Secretary CAN publish",
    async () => {
      // Coordinator publication rejected
      const { error: coordPubErr } = await clientCoord.rpc(
        "publish_placement_drive",
        {
          p_drive_id: mainDriveId,
        }
      );
      assert.ok(
        coordPubErr?.message.includes(
          "Unauthorized: Only Super Admin or TNP Secretary"
        )
      );

      // Secretary publication succeeds
      const { data: pubData, error: secPubErr } = await clientSec.rpc(
        "publish_placement_drive",
        {
          p_drive_id: mainDriveId,
        }
      );
      assert.ifError(secPubErr);
      const pubRes = pubData as unknown as DriveRpcResult;
      assert.equal(pubRes.status, "PUBLISHED");

      // Verify publisher metadata set
      const { data: publishedRow } = await admin
        .from("placement_drives")
        .select("status, published_by, published_at")
        .eq("id", mainDriveId)
        .single();

      assert.equal(publishedRow?.status, "PUBLISHED");
      assert.equal(publishedRow?.published_by, secId);
      assert.ok(publishedRow?.published_at);
    }
  );

  await t.test(
    "3.3 Post-publish freeze: updating drive details, criteria, or batches on PUBLISHED drive is rejected",
    async () => {
      // Update details rejected
      const { error: editErr } = await clientSec.rpc("update_placement_drive", {
        p_drive_id: mainDriveId,
        p_title: "Renamed After Publish",
      });
      assert.ok(editErr?.message.includes("only DRAFT drives can be edited"));

      // Criteria update rejected
      const { error: critErr } = await clientSec.rpc(
        "configure_drive_eligibility",
        {
          p_drive_id: mainDriveId,
          p_minimum_cgpa: 5.0,
          p_maximum_active_backlogs: 0,
        }
      );
      assert.ok(
        critErr?.message.includes("only DRAFT drives can be configured")
      );

      // Batches update rejected
      const { error: batchErr } = await clientSec.rpc(
        "configure_drive_eligible_batches",
        {
          p_drive_id: mainDriveId,
          p_batches: [{ program_id: barchProg.id, batch: "2025" }],
        }
      );
      assert.ok(
        batchErr?.message.includes("only DRAFT drives can be configured")
      );
    }
  );

  await t.test(
    "3.4 Concurrency races: publish/publish and edit/publish race resolution",
    async () => {
      // Create a fresh draft drive for race testing
      const { data: raceData } = await clientCoord.rpc(
        "create_placement_drive",
        {
          p_company_id: companyAcmeId,
          p_title: "Concurrency Race Test Drive",
          p_drive_type: "PLACEMENT",
          p_application_deadline: new Date(
            Date.now() + 10 * 86400000
          ).toISOString(),
        }
      );
      const raceDriveId = (raceData as unknown as DriveRpcResult).drive_id!;

      await clientCoord.rpc("configure_drive_eligible_batches", {
        p_drive_id: raceDriveId,
        p_batches: [{ program_id: barchProg.id, batch: "2026" }],
      });

      // Concurrent publish + publish
      const [pub1, pub2] = await Promise.allSettled([
        clientSec.rpc("publish_placement_drive", { p_drive_id: raceDriveId }),
        clientAdmin.rpc("publish_placement_drive", { p_drive_id: raceDriveId }),
      ]);

      const successCount = [pub1, pub2].filter(
        (r) => r.status === "fulfilled" && !r.value.error
      ).length;
      const errorCount = [pub1, pub2].filter(
        (r) => r.status === "fulfilled" && r.value.error
      ).length;

      assert.equal(
        successCount,
        1,
        "Exactly one publish transaction must succeed"
      );
      assert.equal(
        errorCount,
        1,
        "Competing publish must fail because status is already PUBLISHED"
      );

      // Verify post-publication edit is blocked
      const { error: lateEditErr } = await clientCoord.rpc(
        "update_placement_drive",
        {
          p_drive_id: raceDriveId,
          p_title: "Post Race Edit Attempt",
        }
      );
      assert.ok(
        lateEditErr?.message.includes("only DRAFT drives can be edited")
      );
    }
  );

  await t.test(
    "3.5 Drive Lifecycle: PUBLISHED -> CLOSED -> ARCHIVED (terminal state enforced)",
    async () => {
      // Create separate drive for lifecycle test
      const { data: lcData } = await clientCoord.rpc("create_placement_drive", {
        p_company_id: companyGlobexId,
        p_title: "Globex Lifecycle Test Drive",
        p_drive_type: "INTERNSHIP",
        p_application_deadline: new Date(Date.now() + 86400000).toISOString(),
      });
      const lcDriveId = (lcData as unknown as DriveRpcResult).drive_id!;

      await clientCoord.rpc("configure_drive_eligible_batches", {
        p_drive_id: lcDriveId,
        p_batches: [{ program_id: mplanProg.id, batch: "2026" }],
      });

      // 1. DRAFT -> ARCHIVED directly is rejected
      const { error: invalidArchErr } = await clientSec.rpc(
        "archive_placement_drive",
        {
          p_drive_id: lcDriveId,
        }
      );
      assert.ok(invalidArchErr?.message.includes("expected CLOSED"));

      // 2. DRAFT -> PUBLISHED
      const { error: pubErr } = await clientSec.rpc("publish_placement_drive", {
        p_drive_id: lcDriveId,
      });
      assert.ifError(pubErr);

      // 3. PUBLISHED -> CLOSED
      const { error: closeErr } = await clientSec.rpc("close_placement_drive", {
        p_drive_id: lcDriveId,
      });
      assert.ifError(closeErr);

      const { data: closedRow } = await admin
        .from("placement_drives")
        .select("status, closed_by, closed_at")
        .eq("id", lcDriveId)
        .single();
      assert.equal(closedRow?.status, "CLOSED");
      assert.equal(closedRow?.closed_by, secId);
      assert.ok(closedRow?.closed_at);

      // 4. CLOSED -> ARCHIVED
      const { error: archErr } = await clientSec.rpc(
        "archive_placement_drive",
        {
          p_drive_id: lcDriveId,
        }
      );
      assert.ifError(archErr);

      const { data: archRow } = await admin
        .from("placement_drives")
        .select("status, archived_by, archived_at")
        .eq("id", lcDriveId)
        .single();
      assert.equal(archRow?.status, "ARCHIVED");
      assert.equal(archRow?.archived_by, secId);
      assert.ok(archRow?.archived_at);

      // 5. Terminal state: ARCHIVED cannot transition to CLOSED or PUBLISHED
      const { error: rePubErr } = await clientSec.rpc(
        "publish_placement_drive",
        {
          p_drive_id: lcDriveId,
        }
      );
      assert.ok(rePubErr?.message.includes("expected DRAFT"));

      const { error: reCloseErr } = await clientSec.rpc(
        "close_placement_drive",
        {
          p_drive_id: lcDriveId,
        }
      );
      assert.ok(reCloseErr?.message.includes("expected PUBLISHED"));
    }
  );

  // ==========================================================================
  // Section 4: Authoritative Student Eligibility Engine Matrix & Boundaries
  // ==========================================================================
  await t.test(
    "4.1 Alice (BARCH 2026, 8.5 CGPA, 0 backlogs) evaluates PASS, empty reason_codes",
    async () => {
      const { data, error } = await clientAlice.rpc(
        "get_my_drive_eligibility",
        {
          p_drive_id: mainDriveId,
        }
      );
      assert.ifError(error);
      const res = (data as unknown as EligibilityResult[])?.[0];
      assert.equal(res?.academic_result, "PASS");
      assert.equal(res?.is_available, true);
      assert.deepEqual(res?.reason_codes, []);
    }
  );

  await t.test(
    "4.2 Bob (MPLAN 2026, wrong program) evaluates FAIL, COURSE_NOT_ELIGIBLE (DB-driven)",
    async () => {
      const { data, error } = await clientBob.rpc("get_my_drive_eligibility", {
        p_drive_id: mainDriveId,
      });
      assert.ifError(error);
      const res = (data as unknown as EligibilityResult[])?.[0];
      assert.equal(res?.academic_result, "FAIL");
      assert.ok(res?.reason_codes.includes("COURSE_NOT_ELIGIBLE"));
    }
  );

  await t.test(
    "4.3 Charlie (BARCH 2025, wrong batch) evaluates FAIL, BATCH_NOT_ELIGIBLE (DB-driven)",
    async () => {
      const { data, error } = await clientCharlie.rpc(
        "get_my_drive_eligibility",
        {
          p_drive_id: mainDriveId,
        }
      );
      assert.ifError(error);
      const res = (data as unknown as EligibilityResult[])?.[0];
      assert.equal(res?.academic_result, "FAIL");
      assert.ok(res?.reason_codes.includes("BATCH_NOT_ELIGIBLE"));
    }
  );

  await t.test(
    "4.4 Eligibility threshold boundaries: CGPA and active backlogs exact comparisons",
    async () => {
      // Main drive criteria: min CGPA 7.00, max backlogs 0
      // 1. Boundary Student at CGPA 7.00 and 0 backlogs -> PASS
      await admin
        .from("academic_records")
        .update({ cgpa: 7.0, active_backlogs: 0 })
        .eq("profile_id", sBoundaryId);

      const { data: passData } = await clientBoundary.rpc(
        "get_my_drive_eligibility",
        { p_drive_id: mainDriveId }
      );
      const passRes = (passData as unknown as EligibilityResult[])?.[0];
      assert.equal(passRes?.academic_result, "PASS");
      assert.deepEqual(passRes?.reason_codes, []);

      // 2. CGPA just below minimum (6.99 < 7.00) -> FAIL with CGPA_BELOW_MINIMUM
      await admin
        .from("academic_records")
        .update({ cgpa: 6.99, active_backlogs: 0 })
        .eq("profile_id", sBoundaryId);

      const { data: failCgpaData } = await clientBoundary.rpc(
        "get_my_drive_eligibility",
        { p_drive_id: mainDriveId }
      );
      const failCgpaRes = (failCgpaData as unknown as EligibilityResult[])?.[0];
      assert.equal(failCgpaRes?.academic_result, "FAIL");
      assert.ok(failCgpaRes?.reason_codes.includes("CGPA_BELOW_MINIMUM"));

      // 3. Backlog boundary: drive with max backlogs = 1
      await admin
        .from("drive_eligibility")
        .update({ maximum_active_backlogs: 1 })
        .eq("drive_id", mainDriveId);

      // Student with active_backlogs == 1 -> PASS
      await admin
        .from("academic_records")
        .update({ cgpa: 7.0, active_backlogs: 1 })
        .eq("profile_id", sBoundaryId);

      const { data: passBacklogData } = await clientBoundary.rpc(
        "get_my_drive_eligibility",
        { p_drive_id: mainDriveId }
      );
      const passBacklogRes = (
        passBacklogData as unknown as EligibilityResult[]
      )?.[0];
      assert.equal(passBacklogRes?.academic_result, "PASS");
      assert.deepEqual(passBacklogRes?.reason_codes, []);

      // Student with active_backlogs = 2 (> 1) -> FAIL with ACTIVE_BACKLOG_LIMIT_EXCEEDED
      await admin
        .from("academic_records")
        .update({ cgpa: 7.0, active_backlogs: 2 })
        .eq("profile_id", sBoundaryId);

      const { data: failBacklogData } = await clientBoundary.rpc(
        "get_my_drive_eligibility",
        { p_drive_id: mainDriveId }
      );
      const failBacklogRes = (
        failBacklogData as unknown as EligibilityResult[]
      )?.[0];
      assert.equal(failBacklogRes?.academic_result, "FAIL");
      assert.ok(
        failBacklogRes?.reason_codes.includes("ACTIVE_BACKLOG_LIMIT_EXCEEDED")
      );

      // Restore drive backlogs threshold to 0
      await admin
        .from("drive_eligibility")
        .update({ maximum_active_backlogs: 0 })
        .eq("drive_id", mainDriveId);
    }
  );

  await t.test(
    "4.5 Reason-code determinism: Dave produces strictly ordered failure array",
    async () => {
      const { data, error } = await clientDave.rpc("get_my_drive_eligibility", {
        p_drive_id: mainDriveId,
      });
      assert.ifError(error);
      const res = (data as unknown as EligibilityResult[])?.[0];
      assert.equal(res?.academic_result, "FAIL");

      // Verify exact canonical sequence: CGPA_BELOW_MINIMUM then ACTIVE_BACKLOG_LIMIT_EXCEEDED
      assert.deepEqual(res?.reason_codes, [
        "CGPA_BELOW_MINIMUM",
        "ACTIVE_BACKLOG_LIMIT_EXCEEDED",
      ]);
    }
  );

  await t.test(
    "4.6 Eve (unverified) and Frank (missing) evaluate UNDETERMINED",
    async () => {
      const { data: eveData } = await clientEve.rpc(
        "get_my_drive_eligibility",
        { p_drive_id: mainDriveId }
      );
      const eveRes = (eveData as unknown as EligibilityResult[])?.[0];
      assert.equal(eveRes?.academic_result, "UNDETERMINED");
      assert.ok(eveRes?.reason_codes.includes("ACADEMIC_UNVERIFIED"));

      const { data: frankData } = await clientFrank.rpc(
        "get_my_drive_eligibility",
        { p_drive_id: mainDriveId }
      );
      const frankRes = (frankData as unknown as EligibilityResult[])?.[0];
      assert.equal(frankRes?.academic_result, "UNDETERMINED");
      assert.ok(frankRes?.reason_codes.includes("ACADEMIC_DATA_UNAVAILABLE"));
    }
  );

  await t.test(
    "4.7 Student lifecycle & role output: Inactive, Graduated, Alumni, and Non-student roles",
    async () => {
      // 1. STUDENT_GRADUATED (Grace) -> UNDETERMINED, NOT_A_STUDENT
      const { data: graceData } = await clientGrace.rpc(
        "get_my_drive_eligibility",
        { p_drive_id: mainDriveId }
      );
      const graceRes = (graceData as unknown as EligibilityResult[])?.[0];
      assert.equal(graceRes?.academic_result, "UNDETERMINED");
      assert.equal(graceRes?.is_available, false);
      assert.deepEqual(graceRes?.reason_codes, ["NOT_A_STUDENT"]);

      // 2. Inactive student -> UNDETERMINED, NOT_A_STUDENT
      const { data: inactData } = await admin.rpc(
        "_evaluate_eligibility_for_student",
        {
          p_student_id: sInactiveId,
          p_drive_id: mainDriveId,
        }
      );
      const inactRes = (inactData as unknown as EligibilityResult[])?.[0];
      assert.equal(inactRes?.academic_result, "UNDETERMINED");
      assert.equal(inactRes?.is_available, false);
      assert.deepEqual(inactRes?.reason_codes, ["NOT_A_STUDENT"]);

      // 3. ALUMNI lifecycle -> UNDETERMINED, NOT_A_STUDENT
      const { data: alumniData } = await admin.rpc(
        "_evaluate_eligibility_for_student",
        {
          p_student_id: sAlumniId,
          p_drive_id: mainDriveId,
        }
      );
      const alumniRes = (alumniData as unknown as EligibilityResult[])?.[0];
      assert.equal(alumniRes?.academic_result, "UNDETERMINED");
      assert.equal(alumniRes?.is_available, false);
      assert.deepEqual(alumniRes?.reason_codes, ["NOT_A_STUDENT"]);

      // 4. Non-student role (RECRUITER) -> UNDETERMINED, NOT_A_STUDENT
      const { data: recData } = await clientRecAcme.rpc(
        "get_my_drive_eligibility",
        { p_drive_id: mainDriveId }
      );
      const recRes = (recData as unknown as EligibilityResult[])?.[0];
      assert.equal(recRes?.academic_result, "UNDETERMINED");
      assert.equal(recRes?.is_available, false);
      assert.deepEqual(recRes?.reason_codes, ["NOT_A_STUDENT"]);
    }
  );

  await t.test(
    "4.8 Henry (PHD program, placement_eligible = false) evaluates FAIL, COURSE_NOT_ELIGIBLE",
    async () => {
      const { data } = await clientHenry.rpc("get_my_drive_eligibility", {
        p_drive_id: mainDriveId,
      });
      const res = (data as unknown as EligibilityResult[])?.[0];
      assert.equal(res?.academic_result, "FAIL");
      assert.ok(res?.reason_codes.includes("COURSE_NOT_ELIGIBLE"));
    }
  );

  await t.test(
    "4.9 Prior-placement exclusion complete matrix (5 combinations)",
    async () => {
      // Create a prior placement drive
      const { data: priorPData } = await clientSec.rpc(
        "create_placement_drive",
        {
          p_company_id: companyAcmeId,
          p_title: "Prior Placement Drive",
          p_drive_type: "PLACEMENT",
        }
      );
      const priorPDriveId = (priorPData as unknown as DriveRpcResult).drive_id!;

      // Create a prior internship drive
      const { data: priorIData } = await clientSec.rpc(
        "create_placement_drive",
        {
          p_company_id: companyAcmeId,
          p_title: "Prior Internship Drive",
          p_drive_type: "INTERNSHIP",
        }
      );
      const priorIDriveId = (priorIData as unknown as DriveRpcResult).drive_id!;

      // Setup applications:
      // Ivy: SELECTED on PLACEMENT
      await admin.from("applications").insert({
        student_id: sIvyId,
        drive_id: priorPDriveId,
        status: "SELECTED",
      });

      // Jack: SELECTED on INTERNSHIP
      await admin.from("applications").insert({
        student_id: sJackId,
        drive_id: priorIDriveId,
        status: "SELECTED",
      });

      // Case 1: Target PLACEMENT, exclusion true, prior PLACEMENT (Ivy) -> FAIL
      const { data: c1Data } = await clientIvy.rpc("get_my_drive_eligibility", {
        p_drive_id: mainDriveId,
      });
      const c1Res = (c1Data as unknown as EligibilityResult[])?.[0];
      assert.equal(c1Res?.academic_result, "FAIL");
      assert.ok(c1Res?.reason_codes.includes("PREVIOUSLY_SELECTED_PLACEMENT"));

      // Case 2: Target PLACEMENT, exclusion false, prior PLACEMENT (Ivy) -> PASS
      await admin
        .from("drive_eligibility")
        .update({ exclude_previously_selected_placement: false })
        .eq("drive_id", mainDriveId);

      const { data: c2Data } = await clientIvy.rpc("get_my_drive_eligibility", {
        p_drive_id: mainDriveId,
      });
      const c2Res = (c2Data as unknown as EligibilityResult[])?.[0];
      assert.equal(c2Res?.academic_result, "PASS");
      assert.deepEqual(c2Res?.reason_codes, []);

      // Restore exclusion true on main drive
      await admin
        .from("drive_eligibility")
        .update({ exclude_previously_selected_placement: true })
        .eq("drive_id", mainDriveId);

      // Case 3: Target INTERNSHIP, exclusion true, prior PLACEMENT (Ivy) -> FAIL
      const { data: targetIntData } = await clientSec.rpc(
        "create_placement_drive",
        {
          p_company_id: companyAcmeId,
          p_title: "Target Internship Drive",
          p_drive_type: "INTERNSHIP",
          p_application_deadline: new Date(
            Date.now() + 10 * 86400000
          ).toISOString(),
        }
      );
      const targetIntDriveId = (targetIntData as unknown as DriveRpcResult)
        .drive_id!;

      await clientSec.rpc("configure_drive_eligibility", {
        p_drive_id: targetIntDriveId,
        p_minimum_cgpa: 7.0,
        p_maximum_active_backlogs: 0,
        p_exclude_previously_selected_placement: true,
      });
      await clientSec.rpc("configure_drive_eligible_batches", {
        p_drive_id: targetIntDriveId,
        p_batches: [{ program_id: barchProg.id, batch: "2026" }],
      });
      await clientSec.rpc("publish_placement_drive", {
        p_drive_id: targetIntDriveId,
      });

      const { data: c3Data } = await clientIvy.rpc("get_my_drive_eligibility", {
        p_drive_id: targetIntDriveId,
      });
      const c3Res = (c3Data as unknown as EligibilityResult[])?.[0];
      assert.equal(c3Res?.academic_result, "FAIL");
      assert.ok(c3Res?.reason_codes.includes("PREVIOUSLY_SELECTED_PLACEMENT"));

      // Case 4: Target INTERNSHIP, exclusion true, prior INTERNSHIP only (Jack) -> PASS
      const { data: c4Data } = await clientJack.rpc(
        "get_my_drive_eligibility",
        {
          p_drive_id: targetIntDriveId,
        }
      );
      const c4Res = (c4Data as unknown as EligibilityResult[])?.[0];
      assert.equal(c4Res?.academic_result, "PASS");
      assert.deepEqual(c4Res?.reason_codes, []);

      // Case 5: Target INTERNSHIP, exclusion false, prior PLACEMENT (Ivy) -> PASS
      await admin
        .from("drive_eligibility")
        .update({ exclude_previously_selected_placement: false })
        .eq("drive_id", targetIntDriveId);

      const { data: c5Data } = await clientIvy.rpc("get_my_drive_eligibility", {
        p_drive_id: targetIntDriveId,
      });
      const c5Res = (c5Data as unknown as EligibilityResult[])?.[0];
      assert.equal(c5Res?.academic_result, "PASS");
      assert.deepEqual(c5Res?.reason_codes, []);
    }
  );

  await t.test(
    "4.10 Availability contract across all 5 drive states",
    async () => {
      // 1. DRAFT state: Alice is PASS, is_available = false, reason_codes = []
      const { data: dDraftData } = await clientSec.rpc(
        "create_placement_drive",
        {
          p_company_id: companyAcmeId,
          p_title: "Draft State Test Drive",
          p_drive_type: "PLACEMENT",
        }
      );
      const dDraftId = (dDraftData as unknown as DriveRpcResult).drive_id!;
      await clientSec.rpc("configure_drive_eligibility", {
        p_drive_id: dDraftId,
        p_minimum_cgpa: 7.0,
        p_maximum_active_backlogs: 0,
      });
      await clientSec.rpc("configure_drive_eligible_batches", {
        p_drive_id: dDraftId,
        p_batches: [{ program_id: barchProg.id, batch: "2026" }],
      });

      const { data: draftEval } = await clientAlice.rpc(
        "get_my_drive_eligibility",
        { p_drive_id: dDraftId }
      );
      const draftRes = (draftEval as unknown as EligibilityResult[])?.[0];
      assert.equal(draftRes?.academic_result, "PASS");
      assert.equal(draftRes?.is_available, false);
      assert.deepEqual(draftRes?.reason_codes, []);

      // 2. PUBLISHED + future deadline: Alice is PASS, is_available = true, reason_codes = []
      const { data: pubEval } = await clientAlice.rpc(
        "get_my_drive_eligibility",
        { p_drive_id: mainDriveId }
      );
      const pubRes = (pubEval as unknown as EligibilityResult[])?.[0];
      assert.equal(pubRes?.academic_result, "PASS");
      assert.equal(pubRes?.is_available, true);
      assert.deepEqual(pubRes?.reason_codes, []);

      // 3. PUBLISHED + deadline passed: Alice is PASS, is_available = false, reason_codes = ['DEADLINE_PASSED']
      await admin
        .from("placement_drives")
        .update({
          application_deadline: new Date(Date.now() - 3600000).toISOString(),
        })
        .eq("id", mainDriveId);

      const { data: pastEval } = await clientAlice.rpc(
        "get_my_drive_eligibility",
        { p_drive_id: mainDriveId }
      );
      const pastRes = (pastEval as unknown as EligibilityResult[])?.[0];
      assert.equal(pastRes?.academic_result, "PASS");
      assert.equal(pastRes?.is_available, false);
      assert.deepEqual(pastRes?.reason_codes, ["DEADLINE_PASSED"]);

      // Restore deadline to future
      await admin
        .from("placement_drives")
        .update({
          application_deadline: new Date(
            Date.now() + 30 * 86400000
          ).toISOString(),
        })
        .eq("id", mainDriveId);

      // 4. CLOSED state: is_available = false, academic_result remains PASS, reason_codes = []
      const { data: dClosedData } = await clientSec.rpc(
        "create_placement_drive",
        {
          p_company_id: companyAcmeId,
          p_title: "Closed State Test Drive",
          p_drive_type: "PLACEMENT",
          p_application_deadline: new Date(Date.now() + 86400000).toISOString(),
        }
      );
      const dClosedId = (dClosedData as unknown as DriveRpcResult).drive_id!;
      await clientSec.rpc("configure_drive_eligible_batches", {
        p_drive_id: dClosedId,
        p_batches: [{ program_id: barchProg.id, batch: "2026" }],
      });
      await clientSec.rpc("publish_placement_drive", { p_drive_id: dClosedId });
      await clientSec.rpc("close_placement_drive", { p_drive_id: dClosedId });

      const { data: closedEval } = await clientAlice.rpc(
        "get_my_drive_eligibility",
        { p_drive_id: dClosedId }
      );
      const closedRes = (closedEval as unknown as EligibilityResult[])?.[0];
      assert.equal(closedRes?.academic_result, "PASS");
      assert.equal(closedRes?.is_available, false);
      assert.deepEqual(closedRes?.reason_codes, []);

      // 5. ARCHIVED state: is_available = false, academic_result remains PASS, reason_codes = []
      await clientSec.rpc("archive_placement_drive", { p_drive_id: dClosedId });
      const { data: archEval } = await clientAlice.rpc(
        "get_my_drive_eligibility",
        { p_drive_id: dClosedId }
      );
      const archRes = (archEval as unknown as EligibilityResult[])?.[0];
      assert.equal(archRes?.academic_result, "PASS");
      assert.equal(archRes?.is_available, false);
      assert.deepEqual(archRes?.reason_codes, []);
    }
  );

  await t.test(
    "4.11 Zero influence of skills/evidence/resume on drive eligibility",
    async () => {
      // Alice has verified skills and claims; Dave has none. Neither changes their drive eligibility criteria.
      const { data: aliceRes } = await clientAlice.rpc(
        "get_my_drive_eligibility",
        { p_drive_id: mainDriveId }
      );
      assert.equal(
        (aliceRes as unknown as EligibilityResult[])?.[0]?.academic_result,
        "PASS"
      );
    }
  );

  await t.test(
    "4.12 Private evaluator _evaluate_eligibility_for_student direct execution rejected",
    async () => {
      // Direct call by anonymous
      const { error: anonErr } = await anonClient.rpc(
        "_evaluate_eligibility_for_student" as unknown as "get_my_drive_eligibility",
        {
          p_student_id: sAliceId,
          p_drive_id: mainDriveId,
        } as unknown as { p_drive_id: string }
      );
      assert.ok(anonErr, "Anon must be denied access to private evaluator");

      // Direct call by Student
      const { error: studErr } = await clientAlice.rpc(
        "_evaluate_eligibility_for_student" as unknown as "get_my_drive_eligibility",
        {
          p_student_id: sAliceId,
          p_drive_id: mainDriveId,
        } as unknown as { p_drive_id: string }
      );
      assert.ok(studErr, "Student must be denied access to private evaluator");

      // Direct call by Recruiter
      const { error: recErr } = await clientRecAcme.rpc(
        "_evaluate_eligibility_for_student" as unknown as "get_my_drive_eligibility",
        {
          p_student_id: sAliceId,
          p_drive_id: mainDriveId,
        } as unknown as { p_drive_id: string }
      );
      assert.ok(recErr, "Recruiter must be denied access to private evaluator");

      // Direct call by Coordinator
      const { error: coordErr } = await clientCoord.rpc(
        "_evaluate_eligibility_for_student" as unknown as "get_my_drive_eligibility",
        {
          p_student_id: sAliceId,
          p_drive_id: mainDriveId,
        } as unknown as { p_drive_id: string }
      );
      assert.ok(
        coordErr,
        "Coordinator must be denied access to private evaluator"
      );

      // Direct call by Secretary
      const { error: secErr } = await clientSec.rpc(
        "_evaluate_eligibility_for_student" as unknown as "get_my_drive_eligibility",
        {
          p_student_id: sAliceId,
          p_drive_id: mainDriveId,
        } as unknown as { p_drive_id: string }
      );
      assert.ok(secErr, "Secretary must be denied access to private evaluator");

      // Direct call by Super Admin
      const { error: adminErr } = await clientAdmin.rpc(
        "_evaluate_eligibility_for_student" as unknown as "get_my_drive_eligibility",
        {
          p_student_id: sAliceId,
          p_drive_id: mainDriveId,
        } as unknown as { p_drive_id: string }
      );
      assert.ok(
        adminErr,
        "Super Admin client must be denied direct call to private evaluator"
      );
    }
  );

  // ==========================================================================
  // Section 5: Recruiter Grants, Isolation & Confidentiality Shield
  // ==========================================================================
  // Clear any existing grants so tests operate from clean baseline
  await admin
    .from("recruiter_drive_access")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  await t.test(
    "5.1 Recruiter with NO grant sees 0 drives in v_recruiter_granted_drives",
    async () => {
      const { data: recDrives, error } = await clientRecAcme
        .from("v_recruiter_granted_drives")
        .select("*");

      assert.ifError(error);
      assert.equal(recDrives?.length, 0);
    }
  );

  let acmeGrantAccessId: string = "";

  await t.test(
    "5.2 Coordinator cannot grant recruiter access; Secretary CAN grant access",
    async () => {
      // Coordinator grant rejected
      const { error: coordGrantErr } = await clientCoord.rpc(
        "grant_recruiter_drive_access",
        {
          p_drive_id: mainDriveId,
          p_recruiter_profile_id: rAcmeId,
        }
      );
      assert.ok(
        coordGrantErr?.message.includes(
          "Unauthorized: Only Super Admin or TNP Secretary"
        )
      );

      // Secretary grants access to Acme recruiter
      const { data: grantData, error: grantErr } = await clientSec.rpc(
        "grant_recruiter_drive_access",
        {
          p_drive_id: mainDriveId,
          p_recruiter_profile_id: rAcmeId,
          p_expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
        }
      );

      assert.ifError(grantErr);
      acmeGrantAccessId = (grantData as unknown as DriveRpcResult).access_id!;

      // Recruiter now sees exactly 1 granted drive
      const { data: recDrives, error: readErr } = await clientRecAcme
        .from("v_recruiter_granted_drives")
        .select("*");

      assert.ifError(readErr);
      assert.ok(recDrives);
      assert.equal(recDrives.length, 1);
      assert.equal(
        recDrives[0]!.title,
        "Acme Principal Architect 2026 (Updated)"
      );
      assert.equal(recDrives[0]!.company_name, "Acme Architecture Studio");
    }
  );

  await t.test(
    "5.3 Cross-company grant succeeds & base-table companies isolation is enforced",
    async () => {
      // Frozen architecture does not restrict recruiter company == drive company
      const { data: globexRecProf } = await admin
        .from("recruiter_profiles")
        .select("id")
        .eq("profile_id", rGlobexId)
        .single();

      const { data: crossGrantData, error: crossErr } = await clientAdmin.rpc(
        "grant_recruiter_drive_access",
        {
          p_drive_id: mainDriveId, // Acme drive
          p_recruiter_profile_id: globexRecProf!.id, // Globex recruiter
        }
      );
      assert.ifError(crossErr);
      assert.ok((crossGrantData as unknown as DriveRpcResult).access_id);

      // 1. Globex recruiter can view granted Acme drive in v_recruiter_granted_drives projection
      const { data: globexDrives, error: gReadErr } = await clientRecGlobex
        .from("v_recruiter_granted_drives")
        .select("*");

      assert.ifError(gReadErr);
      assert.ok(globexDrives);
      assert.equal(globexDrives.length, 1);
      assert.equal(globexDrives[0]!.company_name, "Acme Architecture Studio");
      assert.equal(
        globexDrives[0]!.company_website,
        "https://acme-studio.test"
      );

      // 2. Globex recruiter direct SELECT on own company base row is ALLOWED
      const { data: ownComp, error: ownErr } = await clientRecGlobex
        .from("companies")
        .select("*")
        .eq("id", companyGlobexId);
      assert.ifError(ownErr);
      assert.equal(ownComp?.length, 1);
      assert.equal(ownComp[0]?.name, "Globex Planning Associates");

      // 3. Globex recruiter direct SELECT on granted drive's company base row is DENIED (0 rows)
      const { data: grantedComp, error: grantedErr } = await clientRecGlobex
        .from("companies")
        .select("*")
        .eq("id", companyAcmeId);
      assert.ifError(grantedErr);
      assert.equal(
        grantedComp?.length,
        0,
        "Recruiter must not directly select granted company CRM base row"
      );

      // 4. Globex recruiter direct SELECT on unrelated company base row is DENIED (0 rows)
      const { data: unrelComp, error: unrelErr } = await clientRecGlobex
        .from("companies")
        .select("*")
        .eq("id", companyArchId);
      assert.ifError(unrelErr);
      assert.equal(
        unrelComp?.length,
        0,
        "Recruiter must not directly select unrelated company base row"
      );

      // 5. Symmetric check: Acme recruiter can direct SELECT own company base row, but 0 for others
      const { data: acmeOwn } = await clientRecAcme
        .from("companies")
        .select("*")
        .eq("id", companyAcmeId);
      assert.equal(acmeOwn?.length, 1);

      const { data: acmeOther } = await clientRecAcme
        .from("companies")
        .select("*")
        .eq("id", companyGlobexId);
      assert.equal(acmeOther?.length, 0);
    }
  );

  await t.test(
    "5.4 Revoking grant immediately terminates recruiter drive visibility",
    async () => {
      const { error: revErr } = await clientSec.rpc(
        "revoke_recruiter_drive_access",
        {
          p_access_id: acmeGrantAccessId,
        }
      );
      assert.ifError(revErr);

      // After revocation, Acme recruiter sees 0 drives
      const { data: recDrives } = await clientRecAcme
        .from("v_recruiter_granted_drives")
        .select("*");
      assert.equal(recDrives?.length, 0);
    }
  );

  await t.test(
    "5.5 Grant uniqueness & re-grant semantics: Re-granting un-revokes without collision",
    async () => {
      // Re-granting same recruiter + drive succeeds and clears revocation
      const { data: regrantData, error: regrantErr } = await clientSec.rpc(
        "grant_recruiter_drive_access",
        {
          p_drive_id: mainDriveId,
          p_recruiter_profile_id: rAcmeId,
        }
      );
      assert.ifError(regrantErr);
      assert.ok((regrantData as unknown as DriveRpcResult).access_id);

      // Verify revoked_at is cleared
      const { data: grantRow } = await admin
        .from("recruiter_drive_access")
        .select("revoked_at, revoked_by")
        .eq("id", acmeGrantAccessId)
        .single();

      assert.equal(grantRow?.revoked_at, null);
      assert.equal(grantRow?.revoked_by, null);

      // Recruiter sees drive again
      const { data: recDrives } = await clientRecAcme
        .from("v_recruiter_granted_drives")
        .select("*");
      assert.equal(recDrives?.length, 1);
    }
  );

  await t.test(
    "5.6 Recruiter grant expiry boundaries: NULL, future, past, revoked",
    async () => {
      // 1. NULL expiry -> visible (indefinite validity)
      await admin
        .from("recruiter_drive_access")
        .update({ expires_at: null, revoked_at: null })
        .eq("id", acmeGrantAccessId);

      const { data: dNull } = await clientRecAcme
        .from("v_recruiter_granted_drives")
        .select("*");
      assert.equal(dNull?.length, 1, "NULL expiry must allow visibility");

      // 2. Future expiry -> visible
      await admin
        .from("recruiter_drive_access")
        .update({
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          revoked_at: null,
        })
        .eq("id", acmeGrantAccessId);

      const { data: dFuture } = await clientRecAcme
        .from("v_recruiter_granted_drives")
        .select("*");
      assert.equal(dFuture?.length, 1, "Future expiry must allow visibility");

      // 3. Past expiry -> invisible (0 rows)
      await admin
        .from("recruiter_drive_access")
        .update({
          expires_at: new Date(Date.now() - 3600000).toISOString(),
          revoked_at: null,
        })
        .eq("id", acmeGrantAccessId);

      const { data: dPast } = await clientRecAcme
        .from("v_recruiter_granted_drives")
        .select("*");
      assert.equal(dPast?.length, 0, "Past expiry must hide drive");

      // 4. Revoked -> invisible (0 rows)
      await admin
        .from("recruiter_drive_access")
        .update({
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          revoked_at: new Date().toISOString(),
        })
        .eq("id", acmeGrantAccessId);

      const { data: dRevoked } = await clientRecAcme
        .from("v_recruiter_granted_drives")
        .select("*");
      assert.equal(dRevoked?.length, 0, "Revoked grant must hide drive");

      // Restore active unexpired grant for remaining tests
      await admin
        .from("recruiter_drive_access")
        .update({
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          revoked_at: null,
          revoked_by: null,
        })
        .eq("id", acmeGrantAccessId);
    }
  );

  await t.test(
    "5.7 Recruiter Confidentiality Shield across all 9 actual repository tables",
    async () => {
      // 1. student_roster
      const { data: roster } = await clientRecAcme
        .from("student_roster")
        .select("*");
      assert.equal(roster?.length, 0);

      // 2. profiles (student role)
      const { data: profiles } = await clientRecAcme
        .from("profiles")
        .select("*")
        .eq("role", "STUDENT");
      assert.equal(profiles?.length, 0);

      // 3. academic_records
      const { data: academics } = await clientRecAcme
        .from("academic_records")
        .select("*");
      assert.equal(academics?.length, 0);

      // 4. documents
      const { data: documents } = await clientRecAcme
        .from("documents")
        .select("*");
      assert.equal(documents?.length, 0);

      // 5. student_skills
      const { data: studentSkills } = await clientRecAcme
        .from("student_skills")
        .select("*");
      assert.equal(studentSkills?.length, 0);

      // 6. student_skill_evidence
      const { data: skillEvidence } = await clientRecAcme
        .from("student_skill_evidence")
        .select("*");
      assert.equal(skillEvidence?.length, 0);

      // 7. applications
      const { data: apps } = await clientRecAcme
        .from("applications")
        .select("*");
      assert.equal(apps?.length, 0);

      // 8. application_status_history
      const { data: history } = await clientRecAcme
        .from("application_status_history")
        .select("*");
      assert.equal(history?.length, 0);

      // 9. audit_logs
      const { data: logs } = await clientRecAcme.from("audit_logs").select("*");
      assert.equal(logs?.length, 0);
    }
  );

  await t.test(
    "5.8 Recruiter cannot generate signed URLs for student documents or skill evidence",
    async () => {
      // Storage access check for student resumes bucket
      const { data: resumeUrl, error: resumeErr } = await clientRecAcme.storage
        .from("resumes")
        .createSignedUrl(`${sAliceId}/resume.pdf`, 60);

      assert.ok(
        resumeErr || !resumeUrl?.signedUrl,
        "Recruiter must not receive signed resume download URLs"
      );

      // Storage access check for student skill evidence bucket
      const { data: evidenceUrl, error: evidenceErr } =
        await clientRecAcme.storage
          .from("skill-evidence")
          .createSignedUrl(`${sAliceId}/evidence.pdf`, 60);

      assert.ok(
        evidenceErr || !evidenceUrl?.signedUrl,
        "Recruiter must not receive signed evidence download URLs"
      );
    }
  );

  await t.test(
    "5.9 Student View Isolation: Student sees only PUBLISHED drives",
    async () => {
      const { data: studentDrives, error } = await clientAlice
        .from("v_student_published_drives")
        .select("*");

      assert.ifError(error);
      assert.ok(studentDrives && studentDrives.length > 0);
      for (const d of studentDrives) {
        assert.equal(d.status, "PUBLISHED");
      }

      // Direct select on recruiter_drive_access returns 0 rows for student
      const { data: grants } = await clientAlice
        .from("recruiter_drive_access")
        .select("*");
      assert.equal(grants?.length, 0);
    }
  );

  // --------------------------------------------------------------------------
  // Teardown: Restore default seed admin active status
  // --------------------------------------------------------------------------
  await admin
    .from("profiles")
    .update({ is_active: true })
    .eq("id", "00000000-0000-0000-0000-000000000001");
});
