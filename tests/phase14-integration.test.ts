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
import { GET as handleAvatarGet } from "../src/app/api/public/avatar/[slug]/route";

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

test("Phase 14 — Test Hardening Integration Suite", async (t) => {
  // 1. Academic Program Lookup
  const { data: barchProg } = await admin
    .from("academic_programs")
    .select("id, code, display_name")
    .eq("code", "BARCH")
    .single();

  assert.ok(barchProg, "BARCH academic program must exist");
  const programId = barchProg.id;

  // Track created test entities for guaranteed clean teardown
  let extraAnnouncementId: string | null = null;
  let extraActiveStudentId: string | null = null;

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
    lifecycle?: "STUDENT_ACTIVE" | "STUDENT_GRADUATED" | "ALUMNI",
    displayName?: string
  ): Promise<string> {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
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

    assert.ok(user?.id);

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
      display_name: displayName || email.split("@")[0] || "User",
      is_active: true,
      coordinator_slot: slot || null,
      student_lifecycle_status:
        role === "STUDENT" ? lifecycle || "STUDENT_ACTIVE" : null,
    });
    assert.ifError(upsertErr);

    return user.id;
  }

  // Provision test users
  const adminId = await setupUser("phase14_admin@vnit.test", "SUPER_ADMIN");
  const secId = await setupUser("phase14_sec@vnit.test", "TNP_SECRETARY");
  const coordId = await setupUser(
    "phase14_coord@vnit.test",
    "TNP_COORDINATOR",
    "SLOT_1"
  );
  const studId = await setupUser(
    "phase14_student@vnit.test",
    "STUDENT",
    undefined,
    "STUDENT_ACTIVE",
    "Phase 14 Hardened Student"
  );
  const recruiterId = await setupUser(
    "phase14_recruiter@vnit.test",
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

  const cAdmin = await createClientForUser("phase14_admin@vnit.test");
  const cSec = await createClientForUser("phase14_sec@vnit.test");
  const cCoord = await createClientForUser("phase14_coord@vnit.test");
  const cStudent = await createClientForUser("phase14_student@vnit.test");
  const cRecruiter = await createClientForUser("phase14_recruiter@vnit.test");

  // Setup Company & Recruiter contact / profile
  const { data: comp, error: compErr } = await admin
    .from("companies")
    .upsert({
      name: "Phase 14 Test Hardened Corp",
      normalized_name: "phase 14 test hardened corp",
      created_by: adminId,
    })
    .select("id")
    .single();
  assert.ifError(compErr);
  const compId = comp.id;

  const { data: recContact, error: contactErr } = await admin
    .from("recruiter_contacts")
    .upsert({
      company_id: compId,
      full_name: "Phase 14 Contact",
      email: "phase14_recruiter@vnit.test",
      is_active: true,
      created_by: adminId,
    })
    .select("id")
    .single();
  assert.ifError(contactErr);

  await admin.from("recruiter_profiles").upsert({
    profile_id: recruiterId,
    company_id: compId,
    recruiter_contact_id: recContact.id,
  });

  // Setup Student Roster & Academic Record
  await admin.from("student_roster").upsert(
    {
      program_id: programId,
      batch: "2026",
      institutional_id: "P14-NODE-001",
      full_name: "Phase 14 Hardened Student",
      institutional_email: "phase14_student@vnit.test",
      is_active: true,
      claimed_by: studId,
    },
    { onConflict: "institutional_email" }
  );

  await admin.from("academic_records").upsert(
    {
      profile_id: studId,
      program_id: programId,
      batch: "2026",
      cgpa: 9.35,
      active_backlogs: 0,
      verification_status: "VERIFIED",
      verified_by: adminId,
      verified_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" }
  );

  // Upload synthetic JPEG profile photo for student
  const photoBuffer = Buffer.from(
    "\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9",
    "binary"
  );
  await admin.storage
    .from("profile-photos")
    .upload(`${studId}/avatar_p14.jpg`, photoBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  const studentSlug = "alice-p14-hardened";

  await admin.from("student_profiles").upsert(
    {
      profile_id: studId,
      public_profile_enabled: true,
      public_resume_enabled: true,
      public_portfolio_enabled: true,
      public_profile_slug: studentSlug,
      public_headline: "Software Engineer in Hardening",
      public_tagline: "Resilient systems and rock-solid validation.",
      portfolio_url: "https://alice.hardened.dev",
      profile_photo_path: `${studId}/avatar_p14.jpg`,
      phone: "+919876543210",
    },
    { onConflict: "profile_id" }
  );

  // Create Placement Drive
  const { data: drive, error: driveErr } = await admin
    .from("placement_drives")
    .insert({
      company_id: compId,
      title: "Phase 14 Hardened Placement Drive",
      drive_type: "PLACEMENT",
      status: "DRAFT",
      application_deadline: new Date(Date.now() + 86400000 * 30).toISOString(),
      created_by: adminId,
    })
    .select("id")
    .single();
  assert.ifError(driveErr);
  const driveId = drive.id;

  // Publish drive
  const { error: pubErr } = await admin
    .from("placement_drives")
    .update({
      status: "PUBLISHED",
      published_by: adminId,
      published_at: new Date().toISOString(),
    })
    .eq("id", driveId);
  assert.ifError(pubErr);

  // Student applies and is selected
  const { error: appErr } = await admin.from("applications").insert({
    student_id: studId,
    drive_id: driveId,
    status: "SELECTED",
  });
  assert.ifError(appErr);

  // ==========================================================================
  // Section 1: Alumni Complete Lifecycle & Identity Preservation Suite
  // ==========================================================================
  await t.test(
    "1.1 State 1 (STUDENT_ACTIVE): Identity, Public Showcase, and Conversion Analytics",
    async () => {
      const { data: prof, error: profErr } = await admin
        .from("profiles")
        .select("id, role, student_lifecycle_status")
        .eq("id", studId)
        .single();
      assert.ifError(profErr);
      assert.equal(prof.id, studId, "Profile ID matches test student");
      assert.equal(prof.student_lifecycle_status, "STUDENT_ACTIVE");

      // Public profile is accessible
      const { data: pubProf, error: pubErr } = await anon.rpc(
        "get_public_student_profile",
        { p_slug: studentSlug }
      );
      assert.ifError(pubErr);
      assert.equal(pubProf?.length, 1);
      const studentData = pubProf?.[0];
      assert.ok(studentData);
      assert.equal(studentData.name, "Phase 14 Hardened Student");
      assert.equal(studentData.portfolio_available, true);
      assert.equal(studentData.portfolio_url, "https://alice.hardened.dev");

      // Avatar endpoint returns 200
      const req = new NextRequest(
        `http://localhost:3000/api/public/avatar/${studentSlug}`
      );
      const res = await handleAvatarGet(req, {
        params: Promise.resolve({ slug: studentSlug }),
      });
      assert.equal(res.status, 200);

      // Phase 12 Conversion Statistics records placement
      const currentYear = new Date().getFullYear();
      const { data: stats, error: statsErr } = await cSec.rpc(
        "get_staff_conversion_statistics",
        { p_year: currentYear, p_limit: 50 }
      );
      assert.ifError(statsErr);
      const driveStat = stats?.find((s) => s.drive_id === driveId);
      assert.ok(driveStat, "Drive appears in conversion statistics");
      assert.equal(driveStat.total_applied, 1);
      assert.equal(driveStat.total_selected, 1);
      assert.equal(driveStat.conversion_pct, 100);
    }
  );

  await t.test(
    "1.2 Invalid direct transition STUDENT_ACTIVE -> ALUMNI is strictly forbidden",
    async () => {
      // Direct call to convert_student_to_alumni without graduating first
      const { error } = await cSec.rpc("convert_student_to_alumni", {
        p_student_id: studId,
        p_current_organization: "Tech Corp",
        p_current_role: "Software Engineer",
      });
      assert.ok(error, "Direct conversion to alumni must be rejected");
      assert.ok(
        error.message.includes(
          "Student must be graduated before converting to alumni"
        )
      );
    }
  );

  await t.test(
    "1.3 State 2 (STUDENT_GRADUATED): Graduation transition and identity preservation",
    async () => {
      // Graduate student via mark_student_graduated
      const { error: gradErr } = await cSec.rpc("mark_student_graduated", {
        p_student_id: studId,
        p_reason: "Eligible for graduation after completing BARCH curriculum",
      });
      assert.ifError(gradErr);

      // Verify profile identity preserved
      const { data: prof, error: profErr } = await admin
        .from("profiles")
        .select("id, role, student_lifecycle_status")
        .eq("id", studId)
        .single();
      assert.ifError(profErr);
      assert.equal(prof.id, studId, "Profile ID remains identical");
      assert.equal(prof.student_lifecycle_status, "STUDENT_GRADUATED");

      // Verify auth user identity preserved
      const { data: authUser, error: authErr } =
        await admin.auth.admin.getUserById(studId);
      assert.ifError(authErr);
      assert.equal(authUser.user?.id, studId, "Auth user ID remains identical");

      // Student is STILL visible in public showcase while STUDENT_GRADUATED
      const { data: pubProf, error: pubErr } = await anon.rpc(
        "get_public_student_profile",
        { p_slug: studentSlug }
      );
      assert.ifError(pubErr);
      assert.equal(pubProf?.length, 1);

      // Avatar endpoint still returns 200
      const req = new NextRequest(
        `http://localhost:3000/api/public/avatar/${studentSlug}`
      );
      const res = await handleAvatarGet(req, {
        params: Promise.resolve({ slug: studentSlug }),
      });
      assert.equal(res.status, 200);
    }
  );

  await t.test(
    "1.4 State 3 (ALUMNI): Transition to alumni, identity preservation, and showcase exclusion",
    async () => {
      // Transition from STUDENT_GRADUATED to ALUMNI
      const { error: alumniErr } = await cSec.rpc("convert_student_to_alumni", {
        p_student_id: studId,
        p_company_id: compId,
        p_current_role: "Lead Infrastructure Architect",
        p_reason: "Transition to alumni following BARCH graduation",
      });
      assert.ifError(alumniErr);

      // Verify profile identity preserved
      const { data: prof, error: profErr } = await admin
        .from("profiles")
        .select("id, role, student_lifecycle_status")
        .eq("id", studId)
        .single();
      assert.ifError(profErr);
      assert.equal(prof.id, studId, "Profile ID strictly preserved");
      assert.equal(prof.student_lifecycle_status, "ALUMNI");

      // Verify auth user preserved
      const { data: authUser } = await admin.auth.admin.getUserById(studId);
      assert.equal(authUser.user?.id, studId, "Auth ID strictly preserved");

      // Public student showcase MUST NOT return alumni
      const { data: pubProf } = await anon.rpc("get_public_student_profile", {
        p_slug: studentSlug,
      });
      assert.equal(
        pubProf?.length,
        0,
        "Alumni is excluded from get_public_student_profile"
      );

      // Public batch directory MUST NOT include alumni
      const { data: batchPage } = await anon.rpc("get_public_batch_page", {
        p_program_code: "BARCH",
        p_batch: "2026",
      });
      const inBatch = batchPage?.find(
        (s: { slug: string }) => s.slug === studentSlug
      );
      assert.equal(inBatch, undefined, "Alumni is excluded from batch page");

      // Avatar endpoint MUST immediately return HTTP 404 for alumni
      const req = new NextRequest(
        `http://localhost:3000/api/public/avatar/${studentSlug}`
      );
      const res = await handleAvatarGet(req, {
        params: Promise.resolve({ slug: studentSlug }),
      });
      assert.equal(res.status, 404, "Avatar endpoint returns 404 for alumni");
    }
  );

  await t.test(
    "1.5 Historical Placement Preservation: Conversion stats continue counting alumni placement",
    async () => {
      // Even though student is now ALUMNI, their historical placement must not disappear
      const currentYear = new Date().getFullYear();
      const { data: stats, error: statsErr } = await cSec.rpc(
        "get_staff_conversion_statistics",
        { p_year: currentYear, p_limit: 50 }
      );
      assert.ifError(statsErr);
      const driveStat = stats?.find((s) => s.drive_id === driveId);
      assert.ok(driveStat, "Drive stats exist");
      assert.equal(
        driveStat.total_applied,
        1,
        "Applied count preserved after alumni transition"
      );
      assert.equal(
        driveStat.total_selected,
        1,
        "Selected count preserved after alumni transition"
      );
      assert.equal(
        driveStat.conversion_pct,
        100,
        "Conversion rate preserved after alumni transition"
      );
    }
  );

  // ==========================================================================
  // Section 2: Alumni Consent & Projection Privacy Suite
  // ==========================================================================
  await t.test(
    "2.1 Public Alumni Directory: Consent gating and projection privacy",
    async () => {
      // 1. By default after conversion, public_alumni_enabled = false
      const { data: hiddenAlumni, error: hErr } = await anon.rpc(
        "get_public_alumni_directory",
        { p_graduation_year: 2026 }
      );
      assert.ifError(hErr);
      const foundHidden = hiddenAlumni?.find(
        (a: { name: string }) => a.name === "Phase 14 Hardened Student"
      );
      assert.equal(
        foundHidden,
        undefined,
        "Unconsented alumni is excluded from directory"
      );

      // 2. Grant explicit consent
      const { error: optInErr } = await admin
        .from("alumni_profiles")
        .update({
          public_alumni_enabled: true,
          consent_recorded_at: new Date().toISOString(),
          professional_domain: "Cloud Architecture",
          city: "Pune",
          country: "India",
        })
        .eq("profile_id", studId);
      assert.ifError(optInErr);

      // 3. Now directory exposes the alumni record
      const { data: visibleAlumni, error: vErr } = await anon.rpc(
        "get_public_alumni_directory",
        { p_graduation_year: 2026 }
      );
      assert.ifError(vErr);
      const foundVisible = visibleAlumni?.find(
        (a: { name: string }) => a.name === "Phase 14 Hardened Student"
      );
      assert.ok(foundVisible, "Consented alumni appears in directory");
      assert.equal(foundVisible.graduation_year, 2026);
      assert.equal(
        foundVisible.current_employer,
        "Phase 14 Test Hardened Corp"
      );
      assert.equal(foundVisible.designation, "Lead Infrastructure Architect");
      assert.equal(foundVisible.professional_domain, "Cloud Architecture");

      // Verify strict projection: NO internal private fields exposed
      assert.equal(
        (foundVisible as Record<string, unknown>).phone,
        undefined,
        "Phone must never be in alumni directory"
      );
      assert.equal(
        (foundVisible as Record<string, unknown>).email,
        undefined,
        "Email must never be in alumni directory"
      );
      assert.equal(
        (foundVisible as Record<string, unknown>).cgpa,
        undefined,
        "CGPA must never be in alumni directory"
      );
      assert.equal(
        (foundVisible as Record<string, unknown>).profile_id,
        undefined,
        "Internal profile UUID must not be exposed"
      );
    }
  );

  await t.test(
    "2.2 Company Linkage Mutual Exclusivity: chk_company_or_org constraint",
    async () => {
      // Attempting to set both company_id AND current_organization must fail
      const { error } = await admin
        .from("alumni_profiles")
        .update({
          company_id: compId,
          current_organization: "Conflicting External Inc",
        })
        .eq("profile_id", studId);
      assert.ok(
        error,
        "Setting both company_id and current_organization must violate chk_company_or_org"
      );
      assert.equal(error.code, "23514");
    }
  );

  // ==========================================================================
  // Section 3: Cross-Phase Regression Hardening Suite
  // ==========================================================================
  await t.test(
    "3.1 Audited Published Drive Correction: Authority and Audit Logging",
    async () => {
      // A. Super Admin can execute correction with valid reason
      const { error: adminCorrErr } = await cAdmin.rpc(
        "correct_published_drive",
        {
          p_drive_id: driveId,
          p_reason:
            "Correcting published drive title for Phase 14 certification",
          p_title: "Phase 14 Hardened Placement Drive (Corrected)",
        }
      );
      assert.ifError(adminCorrErr);

      // Verify title updated
      const { data: updatedDrive } = await admin
        .from("placement_drives")
        .select("title")
        .eq("id", driveId)
        .single();
      assert.equal(
        updatedDrive?.title,
        "Phase 14 Hardened Placement Drive (Corrected)"
      );

      // Verify audit row recorded
      const { data: auditRow } = await admin
        .from("audit_logs")
        .select("action, entity_id, metadata")
        .eq("action", "DRIVE_CORRECTED_PUBLISHED")
        .eq("entity_id", driveId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      assert.ok(auditRow, "DRIVE_CORRECTED_PUBLISHED audit log must exist");

      // B. TNP Secretary can execute correction
      const { error: secCorrErr } = await cSec.rpc("correct_published_drive", {
        p_drive_id: driveId,
        p_reason: "Secretary updating placement drive notes for clarity",
        p_title: "Phase 14 Hardened Placement Drive (Sec Updated)",
      });
      assert.ifError(secCorrErr);

      // C. TNP Coordinator is denied (42501)
      const { error: coordCorrErr } = await cCoord.rpc(
        "correct_published_drive",
        {
          p_drive_id: driveId,
          p_reason: "Unauthorized attempt to correct published drive",
          p_title: "Hacked Drive",
        }
      );
      assert.ok(coordCorrErr);
      assert.equal(coordCorrErr.code, "42501");

      // D. Student is denied (42501)
      const { error: studCorrErr } = await cStudent.rpc(
        "correct_published_drive",
        {
          p_drive_id: driveId,
          p_reason: "Student attempting to edit published drive",
          p_title: "Student Drive",
        }
      );
      assert.ok(studCorrErr);
      assert.equal(studCorrErr.code, "42501");

      // D2. Recruiter is denied (42501)
      const { error: recCorrErr } = await cRecruiter.rpc(
        "correct_published_drive",
        {
          p_drive_id: driveId,
          p_reason: "Recruiter attempting to edit published drive",
          p_title: "Recruiter Drive",
        }
      );
      assert.ok(recCorrErr);
      assert.equal(recCorrErr.code, "42501");

      // E. Reason shorter than 5 chars is rejected (22023)
      const { error: shortReasonErr } = await cAdmin.rpc(
        "correct_published_drive",
        {
          p_drive_id: driveId,
          p_reason: "Fix",
          p_title: "Valid Title",
        }
      );
      assert.ok(shortReasonErr);
      assert.equal(shortReasonErr.code, "22023");
    }
  );

  await t.test(
    "3.2 Announcements Audience Hardening: Active Student isolation",
    async () => {
      // 1. Post announcement for active STUDENTS
      const { data: ann, error: annErr } = await admin
        .from("announcements")
        .insert({
          title: "Campus Drive Alert",
          body: "Eligible active students please report to hall A.",
          audience: "STUDENTS",
          status: "PUBLISHED",
          published_at: new Date().toISOString(),
          created_by: adminId,
        })
        .select("id")
        .single();
      assert.ifError(annErr);
      assert.ok(ann?.id);
      extraAnnouncementId = ann.id;

      // 2. Active student can read announcement
      extraActiveStudentId = await setupUser(
        "phase14_active2@vnit.test",
        "STUDENT",
        undefined,
        "STUDENT_ACTIVE"
      );
      const cActive = await createClientForUser("phase14_active2@vnit.test");
      const { data: activeAnns, error: aErr } = await cActive
        .from("announcements")
        .select("id, title")
        .eq("id", ann.id);
      assert.ifError(aErr);
      assert.equal(activeAnns?.length, 1);

      // 3. Graduated student and alumni cannot read student announcement
      const { data: alumniAnns, error: alErr } = await cStudent
        .from("announcements")
        .select("id, title")
        .eq("id", ann.id);
      assert.ifError(alErr);
      assert.equal(
        alumniAnns?.length,
        0,
        "Alumni cannot read active student announcements"
      );
    }
  );

  await t.test("3.3 Staff Export Authorization and Audit Logging", async () => {
    // 1. Secretary can record export audit
    const { error: secAuditErr } = await cSec.rpc("record_export_audit", {
      p_export_type: "STUDENTS",
      p_filter_summary: { batch: "2026" },
      p_row_count: 10,
    });
    assert.ifError(secAuditErr);

    // 2. Coordinator is denied (42501)
    const { error: coordAuditErr } = await cCoord.rpc("record_export_audit", {
      p_export_type: "STUDENTS",
      p_filter_summary: {},
      p_row_count: 5,
    });
    assert.ok(coordAuditErr);
    assert.equal(coordAuditErr.code, "42501");

    // 3. Student is denied (42501)
    const { error: studAuditErr } = await cStudent.rpc("record_export_audit", {
      p_export_type: "STUDENTS",
      p_filter_summary: {},
      p_row_count: 5,
    });
    assert.ok(studAuditErr);
    assert.equal(studAuditErr.code, "42501");

    // 4. Anonymous caller is denied (42501)
    const { error: anonAuditErr } = await anon.rpc("record_export_audit", {
      p_export_type: "STUDENTS",
      p_filter_summary: {},
      p_row_count: 5,
    });
    assert.ok(anonAuditErr);
    assert.equal(anonAuditErr.code, "42501");
  });

  await t.test(
    "3.4 Audit Log Viewer Authority: Full vs Operational Scoping",
    async () => {
      // Super Admin reads all audit logs via get_audit_log_page
      const { data: adminLogs, error: adminErr } = await cAdmin.rpc(
        "get_audit_log_page",
        { p_limit: 50 }
      );
      assert.ifError(adminErr);
      assert.ok(Array.isArray(adminLogs));
      assert.ok(adminLogs.length > 0);

      // TNP Secretary reads operational audit logs
      const { data: secLogs, error: secErr } = await cSec.rpc(
        "get_audit_log_page",
        { p_limit: 50 }
      );
      assert.ifError(secErr);
      assert.ok(Array.isArray(secLogs));

      // Coordinator is denied from get_audit_log_page (42501)
      const { error: coordErr } = await cCoord.rpc("get_audit_log_page", {
        p_limit: 50,
      });
      assert.ok(coordErr);
      assert.equal(coordErr.code, "42501");

      // Student is denied (42501)
      const { error: studErr } = await cStudent.rpc("get_audit_log_page", {
        p_limit: 50,
      });
      assert.ok(studErr);
      assert.equal(studErr.code, "42501");

      // Anon is denied (42501)
      const { error: anonErr } = await anon.rpc("get_audit_log_page", {
        p_limit: 50,
      });
      assert.ok(anonErr);
      assert.equal(anonErr.code, "42501");
    }
  );

  // ==========================================================================
  // Section 4: Cleanup & Canonical State Restoration
  // ==========================================================================
  t.after(async () => {
    // Clean up applications, drives, alumni, student records
    await admin.from("applications").delete().eq("drive_id", driveId);
    await admin.from("placement_drives").delete().eq("id", driveId);
    await admin.from("alumni_profiles").delete().eq("profile_id", studId);
    await admin.from("student_profiles").delete().eq("profile_id", studId);
    await admin.from("academic_records").delete().eq("profile_id", studId);
    await admin
      .from("student_roster")
      .delete()
      .eq("institutional_email", "phase14_student@vnit.test");
    await admin.storage
      .from("profile-photos")
      .remove([`${studId}/avatar_p14.jpg`]);
    await admin.from("recruiter_profiles").delete().eq("company_id", compId);
    await admin.from("recruiter_contacts").delete().eq("company_id", compId);
    await admin.from("companies").delete().eq("id", compId);

    if (extraAnnouncementId) {
      await admin.from("announcements").delete().eq("id", extraAnnouncementId);
    }
    if (extraActiveStudentId) {
      await admin.from("profiles").delete().eq("id", extraActiveStudentId);
    }

    // Deactivate test actors
    await admin
      .from("profiles")
      .update({ is_active: false })
      .in("id", [adminId, secId, coordId, studId, recruiterId]);

    // Reactivate canonical seed super admin
    await admin
      .from("profiles")
      .update({ is_active: true })
      .eq("id", "00000000-0000-0000-0000-000000000001");
  });
});
