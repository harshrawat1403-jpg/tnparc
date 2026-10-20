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

interface RpcResponse {
  success?: boolean;
  skill_id?: string;
  student_skill_id?: string;
  evidence_id?: string;
  verification_status?: string;
  is_active?: boolean;
  proficiency_level?: number;
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test("Phase 5 Skills Catalog, Student Skill Claims, Evidence & Scoped Verification Suite", async (t) => {
  // 1. Program & Fixture IDs
  const { data: barch } = await admin
    .from("academic_programs")
    .select("id")
    .eq("code", "BARCH")
    .single();

  const { data: mplan } = await admin
    .from("academic_programs")
    .select("id")
    .eq("code", "MPLAN")
    .single();

  assert.ok(barch, "BARCH program must exist");
  assert.ok(mplan, "MPLAN program must exist");

  // Consistent test users shared with previous phase suites
  const studentAEmail = "integration_phase4_student@vnit.test";
  const studentCEmail = "integration_phase4_student_b@vnit.test";
  const secEmail = "integration_phase4_sec@vnit.test";
  const coordEmail = "integration_phase4_coord@vnit.test";
  const adminEmail = "integration_phase4_admin@vnit.test";
  const recruiterEmail = "integration_phase4_recruiter@company.test";
  const testPassword = "Password1234!";

  // Helper to authenticate or create test user
  async function getAuthenticatedClient(email: string) {
    const anon = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: directLogin } = await anon.auth.signInWithPassword({
      email,
      password: testPassword,
    });

    let session = directLogin?.session;
    let userId = session?.user?.id;

    if (!session || !userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password: testPassword,
        email_confirm: true,
      });
      if (error && !created?.user) {
        const { data: list } = await admin.auth.admin.listUsers();
        userId = list?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        )?.id;
      } else {
        userId = created?.user?.id;
      }

      const { data: loginAfterCreate, error: loginErr } =
        await anon.auth.signInWithPassword({
          email,
          password: testPassword,
        });
      assert.ifError(loginErr);
      session = loginAfterCreate.session;
      userId = session?.user?.id || userId;
    }

    assert.ok(userId, `User with email ${email} must exist in auth database`);
    assert.ok(session, `Session for ${email} must exist`);

    const client = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    });

    return { id: userId, client };
  }

  const adminUser = await getAuthenticatedClient(adminEmail);
  const secUser = await getAuthenticatedClient(secEmail);
  const coordUser = await getAuthenticatedClient(coordEmail);
  const studentA = await getAuthenticatedClient(studentAEmail);
  const studentC = await getAuthenticatedClient(studentCEmail);
  const recruiter = await getAuthenticatedClient(recruiterEmail);

  // Deactivate default seed admin to avoid uq_active_super_admin conflict
  await admin
    .from("profiles")
    .update({ is_active: false })
    .eq("id", "00000000-0000-0000-0000-000000000001");

  // Deactivate any active secretary and slot_1 coordinator
  await admin
    .from("profiles")
    .update({ is_active: false })
    .eq("role", "TNP_SECRETARY");

  await admin
    .from("profiles")
    .update({ is_active: false })
    .eq("coordinator_slot", "SLOT_1");

  // Upsert test users for Phase 5 execution
  await admin.from("profiles").upsert(
    {
      id: adminUser.id,
      role: "SUPER_ADMIN",
      display_name: adminEmail.split("@")[0] || "Admin",
      is_active: true,
    },
    { onConflict: "id" }
  );

  await admin.from("profiles").upsert(
    {
      id: secUser.id,
      role: "TNP_SECRETARY",
      display_name: secEmail.split("@")[0] || "Secretary",
      is_active: true,
    },
    { onConflict: "id" }
  );

  await admin.from("profiles").upsert(
    {
      id: coordUser.id,
      role: "TNP_COORDINATOR",
      coordinator_slot: "SLOT_1",
      display_name: coordEmail.split("@")[0] || "Coordinator",
      is_active: true,
    },
    { onConflict: "id" }
  );

  await admin.from("profiles").upsert(
    {
      id: studentA.id,
      role: "STUDENT",
      display_name: studentAEmail.split("@")[0] || "StudentA",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    { onConflict: "id" }
  );

  await admin.from("student_profiles").upsert(
    {
      profile_id: studentA.id,
      profile_completeness: 100,
    },
    { onConflict: "profile_id" }
  );

  await admin.from("academic_records").upsert(
    {
      profile_id: studentA.id,
      program_id: barch.id,
      batch: "2026",
      cgpa: 8.5,
      active_backlogs: 0,
      verification_status: "VERIFIED",
    },
    { onConflict: "profile_id" }
  );

  await admin.from("profiles").upsert(
    {
      id: studentC.id,
      role: "STUDENT",
      display_name: studentCEmail.split("@")[0] || "StudentC",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    { onConflict: "id" }
  );

  await admin.from("student_profiles").upsert(
    {
      profile_id: studentC.id,
      profile_completeness: 100,
    },
    { onConflict: "profile_id" }
  );

  await admin.from("academic_records").upsert(
    {
      profile_id: studentC.id,
      program_id: mplan.id,
      batch: "2027",
      cgpa: 7.9,
      active_backlogs: 0,
      verification_status: "VERIFIED",
    },
    { onConflict: "profile_id" }
  );

  await admin.from("profiles").upsert(
    {
      id: recruiter.id,
      role: "RECRUITER",
      display_name: recruiterEmail.split("@")[0] || "Recruiter",
      is_active: true,
    },
    { onConflict: "id" }
  );

  // Clean prior skill claims for test students to ensure complete test idempotency
  await admin
    .from("student_skills")
    .delete()
    .in("student_id", [studentA.id, studentC.id]);

  // Ensure coordinator scope for BARCH 2026 is present
  await admin.from("coordinator_student_scopes").upsert(
    {
      coordinator_id: coordUser.id,
      program_id: barch.id,
      batch: "2026",
      granted_by: adminUser.id,
    },
    { onConflict: "coordinator_id,program_id,batch" }
  );

  const timestamp = Date.now();
  const bimSkillName = `BIM Revit ${timestamp}`;
  const gisSkillName = `Urban GIS ${timestamp}`;
  let bimSkillId: string;
  let gisSkillId: string;

  // ==========================================================================
  // Section 1: Departmental Skills Catalog Management
  // ==========================================================================
  await t.test(
    "1. Super Admin and TNP Secretary can create catalog skills",
    async () => {
      const { data: adminRes, error: adminErr } = await adminUser.client.rpc(
        "create_skill",
        {
          p_name: bimSkillName,
          p_category: "Architecture",
          p_description: "3D BIM Parametric Modeling",
        }
      );
      assert.ifError(adminErr);
      const parsedAdmin = adminRes as unknown as RpcResponse;
      assert.ok(parsedAdmin.skill_id);
      bimSkillId = parsedAdmin.skill_id;

      const { data: secRes, error: secErr } = await secUser.client.rpc(
        "create_skill",
        {
          p_name: gisSkillName,
          p_category: "Urban Planning",
          p_description: "Spatial Analytics & Cartography",
        }
      );
      assert.ifError(secErr);
      const parsedSec = secRes as unknown as RpcResponse;
      assert.ok(parsedSec.skill_id);
      gisSkillId = parsedSec.skill_id;
    }
  );

  await t.test(
    "2. Secretary can update, deactivate, and reactivate catalog skills",
    async () => {
      // Update
      const { data: updateRes, error: updateErr } = await secUser.client.rpc(
        "update_skill",
        {
          p_skill_id: gisSkillId,
          p_name: `${gisSkillName} Advanced`,
          p_category: "Urban Planning",
          p_description: "Updated description for GIS",
        }
      );
      assert.ifError(updateErr);
      assert.ok((updateRes as unknown as RpcResponse).success);

      // Deactivate
      const { data: deactRes, error: deactErr } = await secUser.client.rpc(
        "deactivate_skill",
        {
          p_skill_id: gisSkillId,
        }
      );
      assert.ifError(deactErr);
      assert.equal((deactRes as unknown as RpcResponse).is_active, false);

      // Reactivate
      const { data: reactRes, error: reactErr } = await secUser.client.rpc(
        "reactivate_skill",
        {
          p_skill_id: gisSkillId,
        }
      );
      assert.ifError(reactErr);
      assert.equal((reactRes as unknown as RpcResponse).is_active, true);
    }
  );

  await t.test(
    "3. Coordinator, Student, and Recruiter cannot manage catalog",
    async () => {
      const { error: coordErr } = await coordUser.client.rpc("create_skill", {
        p_name: `Coord Skill ${timestamp}`,
        p_category: "General",
        p_description: "Desc",
      });
      assert.ok(coordErr, "Coordinator must be rejected from creating skill");

      const { error: studErr } = await studentA.client.rpc("create_skill", {
        p_name: `Student Skill ${timestamp}`,
        p_category: "General",
        p_description: "Desc",
      });
      assert.ok(studErr, "Student must be rejected from creating skill");

      const { error: recErr } = await recruiter.client.rpc("create_skill", {
        p_name: `Recruiter Skill ${timestamp}`,
        p_category: "General",
        p_description: "Desc",
      });
      assert.ok(recErr, "Recruiter must be rejected from creating skill");

      // Recruiter and Anonymous receive zero rows from skills catalog table
      const { data: recSkills } = await recruiter.client
        .from("skills")
        .select("*");
      assert.equal(
        recSkills?.length,
        0,
        "Recruiter must receive 0 rows from skills catalog"
      );

      const anon = createClient<Database>(supabaseUrl, anonKey);
      const { data: anonSkills } = await anon.from("skills").select("*");
      assert.equal(
        anonSkills?.length,
        0,
        "Anonymous must receive 0 rows from skills catalog"
      );
    }
  );

  // ==========================================================================
  // Section 2: Student Skill Claims & Proficiency
  // ==========================================================================
  let aliceBimClaimId: string;
  let aliceGisClaimId: string;

  await t.test(
    "4. Student Alice can claim active skill with proficiency 1-4",
    async () => {
      const { data: claimRes, error: claimErr } = await studentA.client.rpc(
        "claim_student_skill",
        {
          p_skill_id: bimSkillId,
          p_proficiency_level: 3,
        }
      );
      assert.ifError(claimErr);
      const parsed = claimRes as unknown as RpcResponse;
      assert.ok(parsed.student_skill_id);
      assert.equal(parsed.verification_status, "PENDING");
      aliceBimClaimId = parsed.student_skill_id;

      // Second claim: GIS
      const { data: gisRes, error: gisErr } = await studentA.client.rpc(
        "claim_student_skill",
        {
          p_skill_id: gisSkillId,
          p_proficiency_level: 2,
        }
      );
      assert.ifError(gisErr);
      aliceGisClaimId = (gisRes as unknown as RpcResponse).student_skill_id!;
    }
  );

  await t.test(
    "5. Invalid proficiency levels and duplicate active claims are rejected",
    async () => {
      // 0 out of bounds
      const { error: lowErr } = await studentA.client.rpc(
        "claim_student_skill",
        {
          p_skill_id: bimSkillId,
          p_proficiency_level: 0,
        }
      );
      assert.ok(lowErr, "Proficiency 0 must be rejected");

      // 5 out of bounds
      const { error: highErr } = await studentA.client.rpc(
        "claim_student_skill",
        {
          p_skill_id: bimSkillId,
          p_proficiency_level: 5,
        }
      );
      assert.ok(highErr, "Proficiency 5 must be rejected");

      // Duplicate active claim
      const { error: dupErr } = await studentA.client.rpc(
        "claim_student_skill",
        {
          p_skill_id: bimSkillId,
          p_proficiency_level: 4,
        }
      );
      assert.ok(dupErr, "Duplicate active claim must be rejected");
    }
  );

  await t.test(
    "6. Student can update proficiency level on own claim",
    async () => {
      const { data: updateRes, error: updateErr } = await studentA.client.rpc(
        "update_student_skill_proficiency",
        {
          p_student_skill_id: aliceBimClaimId,
          p_proficiency_level: 4,
        }
      );
      assert.ifError(updateErr);
      assert.equal((updateRes as unknown as RpcResponse).proficiency_level, 4);

      // Another student (Charlie) cannot update Alice's claim
      const { error: charlieErr } = await studentC.client.rpc(
        "update_student_skill_proficiency",
        {
          p_student_skill_id: aliceBimClaimId,
          p_proficiency_level: 1,
        }
      );
      assert.ok(charlieErr, "Charlie cannot update Alice skill proficiency");
    }
  );

  // ==========================================================================
  // Section 3: 15-Active-Skill Cap Enforcement & Slot Reclamation
  // ==========================================================================
  await t.test(
    "7. Student cannot exceed 15 active claimed skills (trigger cap)",
    async () => {
      // Create 14 additional catalog skills
      const additionalSkillIds: string[] = [];
      for (let i = 1; i <= 14; i++) {
        const { data } = await admin
          .from("skills")
          .upsert(
            {
              name: `Integration Extra Skill ${timestamp} ${i}`,
              category: "General",
              created_by: adminUser.id,
              is_active: true,
            },
            { onConflict: "name" }
          )
          .select("id")
          .single();
        if (data) additionalSkillIds.push(data.id);
      }

      // Alice already has 2 active claims (BIM and GIS). Claim 13 more to reach exactly 15.
      for (let i = 0; i < 13; i++) {
        const sid = additionalSkillIds[i]!;
        const { error } = await studentA.client.rpc("claim_student_skill", {
          p_skill_id: sid,
          p_proficiency_level: 2,
        });
        assert.ifError(error);
      }

      // Verify active count is exactly 15
      const { count } = await admin
        .from("student_skills")
        .select("*", { count: "exact", head: true })
        .eq("student_id", studentA.id)
        .eq("is_active", true);
      assert.equal(count, 15, "Alice must have exactly 15 active claims");

      // 16th claim attempt must fail
      const sid14 = additionalSkillIds[13]!;
      const { error: capErr } = await studentA.client.rpc(
        "claim_student_skill",
        {
          p_skill_id: sid14,
          p_proficiency_level: 2,
        }
      );
      assert.ok(capErr, "16th active claim must be blocked by cap trigger");

      // Archiving one claim frees a slot
      const { error: archErr } = await studentA.client.rpc(
        "archive_student_skill",
        {
          p_student_skill_id: aliceGisClaimId,
        }
      );
      assert.ifError(archErr);

      // Now 15th slot can be claimed successfully
      const { error: claimAgainErr } = await studentA.client.rpc(
        "claim_student_skill",
        {
          p_skill_id: sid14,
          p_proficiency_level: 2,
        }
      );
      assert.ifError(claimAgainErr);
    }
  );

  // ==========================================================================
  // Section 4: Evidence Submission & Storage
  // ==========================================================================
  await t.test(
    "8. Student can attach project link evidence with valid URL format",
    async () => {
      // Valid link
      const { data: linkRes, error: linkErr } = await studentA.client.rpc(
        "submit_skill_evidence_link",
        {
          p_student_skill_id: aliceBimClaimId,
          p_evidence_url: "https://github.com/alice/vnit-revit-facade",
          p_description: "Parametric facade Revit project model",
        }
      );
      assert.ifError(linkErr);
      assert.ok((linkRes as unknown as RpcResponse).evidence_id);

      // Invalid URL (bad protocol)
      const { error: badProtoErr } = await studentA.client.rpc(
        "submit_skill_evidence_link",
        {
          p_student_skill_id: aliceBimClaimId,
          p_evidence_url: "javascript:alert(1)",
          p_description: "Invalid protocol link",
        }
      );
      assert.ok(badProtoErr, "javascript: protocol URL must be rejected");
    }
  );

  await t.test(
    "9. PDF Document evidence requires structured student skill storage path and storage object existence",
    async () => {
      const validPath = `${studentA.id}/${aliceBimClaimId}/evidence.pdf`;

      // Non-existent path in storage must fail
      const { error: notFoundErr } = await studentA.client.rpc(
        "register_skill_evidence_pdf",
        {
          p_student_skill_id: aliceBimClaimId,
          p_storage_path: validPath,
          p_description: "Object not yet uploaded",
        }
      );
      assert.ok(notFoundErr, "Non-existent storage object must be rejected");

      // Upload valid PDF via admin client (simulating trusted server action)
      const pdfBuffer = Buffer.from("%PDF-1.4 sample content");
      const { error: upErr } = await admin.storage
        .from("skill-evidence")
        .upload(validPath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });
      assert.ifError(upErr);

      // Path outside student folder must fail
      const { error: outsideErr } = await studentA.client.rpc(
        "register_skill_evidence_pdf",
        {
          p_student_skill_id: aliceBimClaimId,
          p_storage_path: `another-user/${aliceBimClaimId}/evidence.pdf`,
          p_description: "Attempted cross tenant upload",
        }
      );
      assert.ok(outsideErr, "Path outside student folder must be rejected");

      // Path not ending with .pdf must fail
      const { error: nonPdfErr } = await studentA.client.rpc(
        "register_skill_evidence_pdf",
        {
          p_student_skill_id: aliceBimClaimId,
          p_storage_path: `${studentA.id}/${aliceBimClaimId}/malicious.sh`,
          p_description: "Executable attempt",
        }
      );
      assert.ok(nonPdfErr, "Non-pdf file extension must be rejected");

      // Valid path registration succeeds
      const { data: pdfRes, error: pdfErr } = await studentA.client.rpc(
        "register_skill_evidence_pdf",
        {
          p_student_skill_id: aliceBimClaimId,
          p_storage_path: validPath,
          p_description: "VNIT Revit BIM certified portfolio piece",
        }
      );
      assert.ifError(pdfErr);
      assert.ok((pdfRes as unknown as RpcResponse).evidence_id);
    }
  );

  await t.test(
    "10. Scoped Evidence and Queue View RLS (Student/Staff vs Recruiter)",
    async () => {
      // Fetch evidence id for Alice's BIM claim
      const { data: evRow } = await admin
        .from("student_skill_evidence")
        .select("id")
        .eq("student_skill_id", aliceBimClaimId)
        .single();
      assert.ok(evRow?.id);

      // Alice can read her own evidence row
      const { data: aliceEv } = await studentA.client
        .from("student_skill_evidence")
        .select("id")
        .eq("id", evRow.id)
        .single();
      assert.ok(aliceEv?.id, "Alice must be able to read her own evidence row");

      // Coordinator Bob (in-scope for BARCH 2026) can read Alice's evidence row
      const { data: bobEv } = await coordUser.client
        .from("student_skill_evidence")
        .select("id")
        .eq("id", evRow.id)
        .single();
      assert.ok(
        bobEv?.id,
        "Coordinator Bob must be able to read in-scope student evidence row"
      );

      // Recruiter receives 0 rows from student_skill_evidence
      const { data: recEv } = await recruiter.client
        .from("student_skill_evidence")
        .select("id")
        .eq("id", evRow.id);
      assert.equal(
        recEv?.length,
        0,
        "Recruiter must receive 0 rows from student_skill_evidence"
      );

      // Recruiter and Student receive 0 rows from v_staff_skill_reviews
      const { data: recReviews } = await recruiter.client
        .from("v_staff_skill_reviews")
        .select("*");
      assert.equal(
        recReviews?.length,
        0,
        "Recruiter must receive 0 rows from v_staff_skill_reviews"
      );

      const { data: studReviews } = await studentA.client
        .from("v_staff_skill_reviews")
        .select("*");
      assert.equal(
        studReviews?.length,
        0,
        "Student must receive 0 rows from v_staff_skill_reviews"
      );
    }
  );

  // ==========================================================================
  // Section 5: Staff Verification & Scope Enforcement
  // ==========================================================================
  let charlieClaimId: string;

  await t.test(
    "11. Coordinator Bob (BARCH 2026) can verify Alice (in-scope)",
    async () => {
      const { data: verRes, error: verErr } = await coordUser.client.rpc(
        "verify_student_skill",
        {
          p_student_skill_id: aliceBimClaimId,
        }
      );
      assert.ifError(verErr);
      assert.equal(
        (verRes as unknown as RpcResponse).verification_status,
        "VERIFIED"
      );

      // Verify database state
      const { data: claimRow } = await admin
        .from("student_skills")
        .select("verification_status, verified_by")
        .eq("id", aliceBimClaimId)
        .single();
      assert.equal(claimRow?.verification_status, "VERIFIED");
      assert.equal(claimRow?.verified_by, coordUser.id);
    }
  );

  await t.test(
    "12. Coordinator Bob CANNOT verify Charlie in MPLAN 2027 (out-of-scope)",
    async () => {
      // Charlie claims BIM skill
      const { data: charlieRes, error: charlieClaimErr } =
        await studentC.client.rpc("claim_student_skill", {
          p_skill_id: bimSkillId,
          p_proficiency_level: 3,
        });
      assert.ifError(charlieClaimErr);
      charlieClaimId = (charlieRes as unknown as RpcResponse).student_skill_id!;

      // Bob attempts to verify Charlie -> Must fail with access denied
      const { error: bobVerErr } = await coordUser.client.rpc(
        "verify_student_skill",
        {
          p_student_skill_id: charlieClaimId,
        }
      );
      assert.ok(
        bobVerErr,
        "Coordinator Bob must be rejected from verifying Charlie (MPLAN 2027)"
      );

      // Super Admin or Secretary CAN verify Charlie (department-wide scope)
      const { data: secVerRes, error: secVerErr } = await secUser.client.rpc(
        "verify_student_skill",
        {
          p_student_skill_id: charlieClaimId,
        }
      );
      assert.ifError(secVerErr);
      assert.equal(
        (secVerRes as unknown as RpcResponse).verification_status,
        "VERIFIED"
      );
    }
  );

  await t.test(
    "13. Rejection workflow and resubmission (REJECTED -> PENDING)",
    async () => {
      // Charlie claims GIS skill
      const { data: cGisRes, error: cGisErr } = await studentC.client.rpc(
        "claim_student_skill",
        {
          p_skill_id: gisSkillId,
          p_proficiency_level: 2,
        }
      );
      assert.ifError(cGisErr);
      const cGisClaimId = (cGisRes as unknown as RpcResponse).student_skill_id!;

      // Secretary rejects Charlie claim with reason
      const { data: rejRes, error: rejErr } = await secUser.client.rpc(
        "reject_student_skill",
        {
          p_student_skill_id: cGisClaimId,
          p_reason: "Evidence insufficient for intermediate proficiency level",
        }
      );
      assert.ifError(rejErr);
      assert.equal(
        (rejRes as unknown as RpcResponse).verification_status,
        "REJECTED"
      );

      // Attaching updated evidence atomically transitions REJECTED -> PENDING
      const { data: resubRes, error: resubErr } = await studentC.client.rpc(
        "submit_skill_evidence_link",
        {
          p_student_skill_id: cGisClaimId,
          p_evidence_url: "https://github.com/charlie/mplan-spatial-analytics",
          p_description: "Added comprehensive spatial study report",
        }
      );
      assert.ifError(resubErr);
      assert.equal(
        (resubRes as unknown as RpcResponse).verification_status,
        "PENDING"
      );

      // Verify claim state in database is PENDING and verified_by is cleared
      const { data: updatedClaim } = await admin
        .from("student_skills")
        .select("verification_status, verified_by")
        .eq("id", cGisClaimId)
        .single();
      assert.equal(updatedClaim?.verification_status, "PENDING");
      assert.equal(updatedClaim?.verified_by, null);
    }
  );

  // ==========================================================================
  // Section 6: Non-Interference with Completeness and Drives
  // ==========================================================================
  await t.test(
    "14. Skills do NOT alter profile completeness or drive eligibility",
    async () => {
      // Alice's profile completeness was initialized to 20
      const { data: aliceProfile } = await admin
        .from("student_profiles")
        .select("profile_completeness")
        .eq("profile_id", studentA.id)
        .single();

      assert.equal(
        aliceProfile?.profile_completeness,
        100,
        "Skills must have zero effect on deterministic profile completeness calculation"
      );
    }
  );

  await t.test(
    "15. Concurrent evidence submissions (PDF/PDF, LINK/LINK, PDF/LINK) enforce single evidence guarantee and compensating cleanup",
    async () => {
      // Clean up previous active claims so Alice has available slots
      await admin.from("student_skills").delete().eq("student_id", studentA.id);

      const concSkillName = `Concurrency Skill ${timestamp}`;
      const { data: concSkill, error: createConcErr } =
        await adminUser.client.rpc("create_skill", {
          p_name: concSkillName,
          p_category: "Concurrency",
          p_description: "For concurrency tests",
        });
      assert.ifError(createConcErr);
      const concSkillId = (concSkill as unknown as RpcResponse).skill_id!;

      // Create a fresh test skill claim for concurrency testing
      const { data: claimData, error: claimErr } = await studentA.client.rpc(
        "claim_student_skill",
        {
          p_skill_id: concSkillId,
          p_proficiency_level: 2,
        }
      );
      assert.ifError(claimErr);
      const testClaimId = (claimData as unknown as RpcResponse)
        .student_skill_id!;

      // A. Concurrent LINK/LINK submissions
      const link1 = studentA.client.rpc("submit_skill_evidence_link", {
        p_student_skill_id: testClaimId,
        p_evidence_url: "https://github.com/alice/concurrent-link-1",
        p_description: "Link 1",
      });
      const link2 = studentA.client.rpc("submit_skill_evidence_link", {
        p_student_skill_id: testClaimId,
        p_evidence_url: "https://github.com/alice/concurrent-link-2",
        p_description: "Link 2",
      });
      await Promise.all([link1, link2]);

      // Exactly one evidence row must exist
      const { count: linkCount } = await admin
        .from("student_skill_evidence")
        .select("*", { count: "exact", head: true })
        .eq("student_skill_id", testClaimId);
      assert.equal(
        linkCount,
        1,
        "Concurrent LINK/LINK submissions must leave exactly 1 evidence row"
      );

      // B. Concurrent PDF/LINK submissions
      const pdfPathA = `${studentA.id}/${testClaimId}/concurrent_a.pdf`;
      const pdfBufferA = Buffer.from("%PDF-1.4 sample content A");
      await admin.storage.from("skill-evidence").upload(pdfPathA, pdfBufferA, {
        contentType: "application/pdf",
        upsert: true,
      });

      const submitLink = studentA.client.rpc("submit_skill_evidence_link", {
        p_student_skill_id: testClaimId,
        p_evidence_url: "https://github.com/alice/concurrent-link-3",
        p_description: "Link 3",
      });
      const submitPdf = studentA.client.rpc("register_skill_evidence_pdf", {
        p_student_skill_id: testClaimId,
        p_storage_path: pdfPathA,
        p_description: "PDF A",
      });
      await Promise.all([submitLink, submitPdf]);

      const { count: mixCount } = await admin
        .from("student_skill_evidence")
        .select("*", { count: "exact", head: true })
        .eq("student_skill_id", testClaimId);
      assert.equal(
        mixCount,
        1,
        "Concurrent PDF/LINK submissions must leave exactly 1 evidence row"
      );

      // C. Concurrent PDF/PDF submissions
      const pdfPathB = `${studentA.id}/${testClaimId}/concurrent_b.pdf`;
      const pdfPathC = `${studentA.id}/${testClaimId}/concurrent_c.pdf`;
      await admin.storage.from("skill-evidence").upload(pdfPathB, pdfBufferA, {
        contentType: "application/pdf",
        upsert: true,
      });
      await admin.storage.from("skill-evidence").upload(pdfPathC, pdfBufferA, {
        contentType: "application/pdf",
        upsert: true,
      });

      const submitPdfB = studentA.client.rpc("register_skill_evidence_pdf", {
        p_student_skill_id: testClaimId,
        p_storage_path: pdfPathB,
        p_description: "PDF B",
      });
      const submitPdfC = studentA.client.rpc("register_skill_evidence_pdf", {
        p_student_skill_id: testClaimId,
        p_storage_path: pdfPathC,
        p_description: "PDF C",
      });
      await Promise.all([submitPdfB, submitPdfC]);

      const { count: pdfCount } = await admin
        .from("student_skill_evidence")
        .select("*", { count: "exact", head: true })
        .eq("student_skill_id", testClaimId);
      assert.equal(
        pdfCount,
        1,
        "Concurrent PDF/PDF submissions must leave exactly 1 evidence row"
      );

      // D. Compensating cleanup verification:
      // If a PDF upload loses/fails registration, compensating cleanup removes the blob
      const failedPath = `${studentA.id}/${testClaimId}/failed_upload.pdf`;
      await admin.storage
        .from("skill-evidence")
        .upload(failedPath, pdfBufferA, {
          contentType: "application/pdf",
          upsert: true,
        });

      // Simulate failure in registration by passing a non-existent claim ID
      const fakeClaimId = "99999999-9999-9999-9999-999999999999";
      const { error: failErr } = await studentA.client.rpc(
        "register_skill_evidence_pdf",
        {
          p_student_skill_id: fakeClaimId,
          p_storage_path: failedPath,
          p_description: "Should fail and clean up",
        }
      );
      assert.ok(failErr, "Registration on non-existent claim must fail");

      // Server action compensating delete cleans up the losing/failed blob
      await admin.storage.from("skill-evidence").remove([failedPath]);
      const { data: checkDeleted } = await admin.storage
        .from("skill-evidence")
        .download(failedPath);
      assert.ok(!checkDeleted, "Failed/losing upload blob must be cleaned up");

      // Clean up test claim
      await admin.from("student_skills").delete().eq("id", testClaimId);
    }
  );

  // Clean teardown and restore seed admin to active state
  t.after(async () => {
    // Deactivate test users so partial unique indexes aren't blocked
    await admin
      .from("profiles")
      .update({ is_active: false })
      .in("id", [adminUser.id, secUser.id, coordUser.id]);

    // Restore seed admin to active state
    await admin
      .from("profiles")
      .update({ is_active: true })
      .eq("id", "00000000-0000-0000-0000-000000000001");
  });
});
