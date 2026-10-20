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
import type { UserRole } from "../src/types/enums";

interface RpcResponse {
  success?: boolean;
  profile_completeness?: number;
  verification_status?: string;
  document_id?: string;
  storage_path?: string;
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test("Phase 4 Student Profiles, Completeness, Resumes & Verification Suite", async (t) => {
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

  const studentEmail = "integration_phase4_student@vnit.test";
  const studentBEmail = "integration_phase4_student_b@vnit.test";
  const secEmail = "integration_phase4_sec@vnit.test";
  const coordEmail = "integration_phase4_coord@vnit.test";
  const adminEmail = "integration_phase4_admin@vnit.test";
  const recruiterEmail = "integration_phase4_recruiter@company.test";
  const testPassword = "Password1234!";

  // Helper to create or get authenticated user
  async function setupUser(
    email: string,
    role: string,
    slot?: "SLOT_1" | "SLOT_2"
  ) {
    const { data: existingUser } = await admin.auth.admin.listUsers();
    let user = existingUser?.users?.find((u) => u.email === email);

    if (!user) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password: testPassword,
        email_confirm: true,
      });
      assert.ifError(error);
      user = created.user;
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

    // Upsert profile
    await admin.from("profiles").upsert(
      {
        id: user.id,
        role: role as UserRole,
        display_name: email.split("@")[0] || "User",
        is_active: true,
        coordinator_slot: slot || null,
        student_lifecycle_status: role === "STUDENT" ? "STUDENT_ACTIVE" : null,
      },
      { onConflict: "id" }
    );

    // Sign in to obtain access token
    const anon = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: sessionData, error: loginErr } =
      await anon.auth.signInWithPassword({
        email,
        password: testPassword,
      });
    assert.ifError(loginErr);

    const client = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      },
    });

    return { id: user.id, client };
  }

  const studentUser = await setupUser(studentEmail, "STUDENT");
  const studentBUser = await setupUser(studentBEmail, "STUDENT");
  const secUser = await setupUser(secEmail, "TNP_SECRETARY");
  const coordUser = await setupUser(coordEmail, "TNP_COORDINATOR", "SLOT_1");
  const recruiterUser = await setupUser(recruiterEmail, "RECRUITER");

  // Deactivate default seed admin temporarily to avoid uq_active_super_admin collision
  await admin
    .from("profiles")
    .update({ is_active: false })
    .eq("id", "00000000-0000-0000-0000-000000000001");

  const adminUser = await setupUser(adminEmail, "SUPER_ADMIN");

  // Setup Student A (BARCH 2026)
  await admin.from("student_profiles").upsert(
    {
      profile_id: studentUser.id,
      profile_completeness: 20,
    },
    { onConflict: "profile_id" }
  );

  await admin.from("academic_records").upsert(
    {
      profile_id: studentUser.id,
      program_id: barch.id,
      batch: "2026",
      cgpa: 8.45,
      active_backlogs: 0,
      verification_status: "UNVERIFIED",
    },
    { onConflict: "profile_id" }
  );

  // Setup Student B (MPLAN 2027)
  await admin.from("student_profiles").upsert(
    {
      profile_id: studentBUser.id,
      profile_completeness: 20,
    },
    { onConflict: "profile_id" }
  );

  await admin.from("academic_records").upsert(
    {
      profile_id: studentBUser.id,
      program_id: mplan.id,
      batch: "2027",
      cgpa: 9.1,
      active_backlogs: 0,
      verification_status: "UNVERIFIED",
    },
    { onConflict: "profile_id" }
  );

  // Coordinator Scope: BARCH 2026 only
  await admin.from("coordinator_student_scopes").upsert(
    {
      coordinator_id: coordUser.id,
      program_id: barch.id,
      batch: "2026",
      granted_by: adminUser.id,
    },
    { onConflict: "coordinator_id,program_id,batch" }
  );

  // Clean prior test documents and reset student profile fields for deterministic idempotency
  await admin
    .from("documents")
    .delete()
    .in("owner_id", [studentUser.id, studentBUser.id]);

  await admin
    .from("student_profiles")
    .update({
      phone: null,
      bio: null,
      public_headline: null,
      public_tagline: null,
      linkedin_url: null,
      portfolio_url: null,
      profile_photo_path: null,
      profile_completeness: 20,
    })
    .eq("profile_id", studentUser.id);

  // 1. Profile Mutation & Deterministic Completeness
  await t.test(
    "1. Student updates profile fields and completeness updates deterministically",
    async () => {
      const { data, error } = await studentUser.client.rpc(
        "update_own_student_profile",
        {
          p_bio: "Passionate architect focusing on bioclimatic design.",
          p_public_headline: "Junior Architect & Computational Designer",
          p_public_tagline: "Building sustainable vernacular spaces",
          p_phone: "+91 99887 76655",
          p_linkedin_url: "https://linkedin.com/in/integration-student",
          p_portfolio_url: "https://portfolio.test/integration",
          p_other_links: [],
        }
      );

      assert.ifError(error);
      const res1 = data as unknown as RpcResponse;
      assert.equal(res1.success, true);
      // Base (20) + Phone (15) + Bio/Headline (15) + LinkedIn (15) + Portfolio (10) = 75%
      assert.equal(res1.profile_completeness, 75);

      const { data: profile } = await studentUser.client
        .from("student_profiles")
        .select("profile_completeness, phone, bio")
        .eq("profile_id", studentUser.id)
        .single();

      assert.equal(profile?.profile_completeness, 75);
      assert.equal(profile?.phone, "+91 99887 76655");

      // Verify Phase 9 showcase fields remain strictly dormant (false / null)
      const { data: showcase } = await studentUser.client
        .from("student_profiles")
        .select(
          "public_profile_enabled, public_resume_enabled, public_portfolio_enabled, public_profile_slug"
        )
        .eq("profile_id", studentUser.id)
        .single();

      assert.equal(showcase?.public_profile_enabled, false);
      assert.equal(showcase?.public_resume_enabled, false);
      assert.equal(showcase?.public_portfolio_enabled, false);
      assert.equal(showcase?.public_profile_slug, null);
    }
  );

  await t.test(
    "2. Narrow profile procedure rejects invalid phone and malformed links",
    async () => {
      const { error: phoneErr } = await studentUser.client.rpc(
        "update_own_student_profile",
        {
          p_phone: "invalid_alpha",
        }
      );
      assert.ok(phoneErr, "Invalid phone should throw error");
      assert.match(phoneErr.message, /Invalid phone number format/);

      const { error: urlErr } = await studentUser.client.rpc(
        "update_own_student_profile",
        {
          p_linkedin_url: "not-a-url",
        }
      );
      assert.ok(urlErr, "Invalid LinkedIn URL should throw error");
      assert.match(urlErr.message, /LinkedIn URL must begin with http/);
    }
  );

  // 2. Photo Update & Completeness Recalculation
  await t.test(
    "3. Student updates profile photo and completeness advances to 85%",
    async () => {
      const photoPath = `${studentUser.id}/profile.jpg`;
      const { data, error } = await studentUser.client.rpc(
        "update_own_profile_photo",
        {
          p_storage_path: photoPath,
        }
      );

      assert.ifError(error);
      const res3 = data as unknown as RpcResponse;
      assert.equal(res3.success, true);
      assert.equal(res3.profile_completeness, 85);
    }
  );

  await t.test(
    "4. Photo update procedure rejects paths outside student folder",
    async () => {
      const foreignPath = `${studentBUser.id}/profile.jpg`;
      const { error } = await studentUser.client.rpc(
        "update_own_profile_photo",
        {
          p_storage_path: foreignPath,
        }
      );

      assert.ok(error, "Path outside student folder must be rejected");
      assert.match(error.message, /must reside in student folder/);
    }
  );

  // 3. Transactional Resume Registration & Uniqueness
  await t.test(
    "5. Student registers initial resume; completeness reaches 100%",
    async () => {
      const resume1Path = `${studentUser.id}/resume_v1.pdf`;
      const { data, error } = await studentUser.client.rpc(
        "register_student_resume",
        {
          p_storage_path: resume1Path,
          p_file_name: "Resume_v1.pdf",
          p_file_size_bytes: 1048576,
          p_mime_type: "application/pdf",
        }
      );

      assert.ifError(error);
      const res5 = data as unknown as RpcResponse;
      assert.equal(res5.success, true);
      assert.equal(res5.profile_completeness, 100);

      // Verify active resume
      const { data: docs } = await studentUser.client
        .from("documents")
        .select("id, storage_path, is_current")
        .eq("owner_id", studentUser.id)
        .eq("is_current", true);

      assert.equal(docs?.length, 1);
      assert.equal(docs?.[0]?.storage_path, resume1Path);
    }
  );

  await t.test(
    "6. Student registers replacement resume; prior resume is atomically superseded",
    async () => {
      const resume2Path = `${studentUser.id}/resume_v2.pdf`;
      const { data, error } = await studentUser.client.rpc(
        "register_student_resume",
        {
          p_storage_path: resume2Path,
          p_file_name: "Resume_v2.pdf",
          p_file_size_bytes: 1200000,
          p_mime_type: "application/pdf",
        }
      );

      assert.ifError(error);
      const res6 = data as unknown as RpcResponse;
      assert.equal(res6.success, true);

      // Exactly one current resume exists
      const { data: currentDocs } = await studentUser.client
        .from("documents")
        .select("id, storage_path, is_current")
        .eq("owner_id", studentUser.id)
        .eq("is_current", true);

      assert.equal(currentDocs?.length, 1);
      assert.equal(currentDocs?.[0]?.storage_path, resume2Path);

      // Prior resume is marked archived (is_current = false)
      const { data: allDocs } = await studentUser.client
        .from("documents")
        .select("id, storage_path, is_current")
        .eq("owner_id", studentUser.id);

      assert.equal(allDocs?.length, 2);
      const archived = allDocs?.find((d) => !d.is_current);
      assert.ok(archived, "Prior resume must be marked is_current = false");
      assert.match(archived.storage_path, /resume_v1\.pdf/);
    }
  );

  // 4. Scoped Staff Access Control on Resumes & Profiles
  await t.test(
    "7. Coordinator accesses in-scope student resume but is blocked from out-of-scope student",
    async () => {
      // Student A (BARCH 2026) is in-scope for Coordinator
      const { data: inScopeDocs, error: inScopeErr } = await coordUser.client
        .from("documents")
        .select("id, storage_path")
        .eq("owner_id", studentUser.id);

      assert.ifError(inScopeErr);
      assert.ok(
        inScopeDocs && inScopeDocs.length >= 1,
        "In-scope documents should be returned"
      );

      // Register a resume for Student B (MPLAN 2027 - out of coordinator scope)
      await admin.from("documents").insert({
        owner_id: studentBUser.id,
        document_type: "RESUME",
        storage_path: `${studentBUser.id}/resume_b.pdf`,
        file_name: "Resume_B.pdf",
        file_size_bytes: 800000,
        mime_type: "application/pdf",
        is_current: true,
      });

      // Coordinator attempts to read Student B's documents -> RLS filters to empty
      const { data: outOfScopeDocs } = await coordUser.client
        .from("documents")
        .select("id, storage_path")
        .eq("owner_id", studentBUser.id);

      assert.equal(
        outOfScopeDocs?.length,
        0,
        "Out-of-scope student documents must be empty for coordinator"
      );
    }
  );

  await t.test(
    "8. Recruiter has zero access to student documents, profiles, and academic records",
    async () => {
      const { data: docs } = await recruiterUser.client
        .from("documents")
        .select("id");
      assert.equal(docs?.length, 0, "Recruiter cannot access any documents");

      const { data: profiles } = await recruiterUser.client
        .from("student_profiles")
        .select("id");
      assert.equal(
        profiles?.length,
        0,
        "Recruiter cannot access any student profiles"
      );

      const { data: academics } = await recruiterUser.client
        .from("academic_records")
        .select("id");
      assert.equal(
        academics?.length,
        0,
        "Recruiter cannot access any academic records"
      );
    }
  );

  // 5. Academic Verification & Correction
  await t.test(
    "9. Coordinator and Student cannot verify or correct academic records",
    async () => {
      const { error: coordErr } = await coordUser.client.rpc(
        "verify_student_academic_record",
        {
          p_target_profile_id: studentUser.id,
          p_cgpa: 8.5,
          p_active_backlogs: 0,
        }
      );
      assert.ok(coordErr, "Coordinator verification must be rejected");
      assert.match(
        coordErr.message,
        /Unauthorized: Only TNP Secretary or Super Admin/
      );

      const { error: studErr } = await studentUser.client.rpc(
        "verify_student_academic_record",
        {
          p_target_profile_id: studentUser.id,
          p_cgpa: 8.5,
          p_active_backlogs: 0,
        }
      );
      assert.ok(studErr, "Student verification must be rejected");
      assert.match(
        studErr.message,
        /Unauthorized: Only TNP Secretary or Super Admin/
      );
    }
  );

  await t.test(
    "10. Super Admin verifies academic record and audit trail is sanitized",
    async () => {
      const { data, error } = await adminUser.client.rpc(
        "verify_student_academic_record",
        {
          p_target_profile_id: studentUser.id,
          p_cgpa: 8.75,
          p_active_backlogs: 0,
        }
      );

      assert.ifError(error);
      const res10 = data as unknown as RpcResponse;
      assert.equal(res10.success, true);
      assert.equal(res10.verification_status, "VERIFIED");

      // Verify academic record updated
      const { data: rec } = await admin
        .from("academic_records")
        .select("cgpa, active_backlogs, verification_status, verified_by")
        .eq("profile_id", studentUser.id)
        .single();

      assert.equal(Number(rec?.cgpa), 8.75);
      assert.equal(rec?.verification_status, "VERIFIED");
      assert.equal(rec?.verified_by, adminUser.id);

      // Verify audit log exists and does NOT contain raw CGPA
      const { data: logs } = await admin
        .from("audit_logs")
        .select("action, actor_id, metadata")
        .eq("action", "ACADEMIC_VERIFIED")
        .eq("actor_id", adminUser.id)
        .order("created_at", { ascending: false })
        .limit(1);

      assert.equal(logs?.length, 1);
      const meta = logs?.[0]?.metadata as Record<string, unknown>;
      assert.equal(meta.student_id, studentUser.id);
      assert.equal(meta.new_status, "VERIFIED");
      assert.equal(meta.cgpa, undefined, "Audit log must not contain raw CGPA");
      assert.equal(
        meta.active_backlogs,
        undefined,
        "Audit log must not contain raw backlogs"
      );
    }
  );

  await t.test(
    "11. TNP Secretary corrects academic record with mandatory justification reason",
    async () => {
      const correctionReason = "Official grade card verification by TNP office";
      const { data, error } = await secUser.client.rpc(
        "correct_student_academic_record",
        {
          p_target_profile_id: studentUser.id,
          p_cgpa: 8.9,
          p_active_backlogs: 0,
          p_reason: correctionReason,
        }
      );

      assert.ifError(error);
      const res11 = data as unknown as RpcResponse;
      assert.equal(res11.success, true);

      // Verify academic record updated
      const { data: rec } = await admin
        .from("academic_records")
        .select("cgpa, verification_status, verified_by")
        .eq("profile_id", studentUser.id)
        .single();

      assert.equal(Number(rec?.cgpa), 8.9);
      assert.equal(rec?.verified_by, secUser.id);

      // Verify audit log has mandatory reason and no raw academic metrics
      const { data: logs } = await admin
        .from("audit_logs")
        .select("action, actor_id, metadata")
        .eq("action", "ACADEMIC_CORRECTED")
        .eq("actor_id", secUser.id)
        .order("created_at", { ascending: false })
        .limit(1);

      assert.equal(logs?.length, 1);
      const meta = logs?.[0]?.metadata as Record<string, unknown>;
      assert.equal(meta.reason, correctionReason);
      assert.equal(meta.cgpa, undefined, "Audit log must not contain raw CGPA");
    }
  );

  await t.test(
    "12. Academic correction without sufficient justification is rejected",
    async () => {
      const { error } = await secUser.client.rpc(
        "correct_student_academic_record",
        {
          p_target_profile_id: studentUser.id,
          p_cgpa: 9.0,
          p_active_backlogs: 0,
          p_reason: "abc", // < 5 chars
        }
      );

      assert.ok(error, "Short justification must be rejected");
      assert.match(error.message, /min 5 characters/);
    }
  );

  // 6. Direct Storage API Bypasses & Row-Level Security
  await t.test(
    "13. Direct Storage API bypasses (raw upload, foreign folder upload, and delete) are strictly rejected",
    async () => {
      const pdfHeader = Buffer.from("%PDF-1.4 sample pdf content for testing");
      const jpegHeader = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      ]);

      // 1. Direct raw resume upload by student is denied (RLS forbids raw client INSERT)
      const { error: studARawResumeErr } = await studentUser.client.storage
        .from("resumes")
        .upload(`${studentUser.id}/raw_resume.pdf`, pdfHeader, {
          contentType: "application/pdf",
        });
      assert.ok(
        studARawResumeErr,
        "Student cannot raw-upload a resume through client (must use trusted server action)"
      );

      // 2. Direct raw profile photo upload by student is denied (RLS forbids raw client INSERT)
      const { error: studARawPhotoErr } = await studentUser.client.storage
        .from("profile-photos")
        .upload(`${studentUser.id}/raw_photo.jpg`, jpegHeader, {
          contentType: "image/jpeg",
        });
      assert.ok(
        studARawPhotoErr,
        "Student cannot raw-upload a photo through client (must use trusted server action)"
      );

      // 3. Student A upload into Student B folder is denied
      const { error: uploadForeignErr } = await studentUser.client.storage
        .from("resumes")
        .upload(`${studentBUser.id}/hacked.pdf`, pdfHeader, {
          contentType: "application/pdf",
        });
      assert.ok(
        uploadForeignErr,
        "Student A upload into Student B folder must be denied"
      );

      // 4. Coordinator cannot raw-upload into student folder
      const { error: coordUploadErr } = await coordUser.client.storage
        .from("resumes")
        .upload(`${studentUser.id}/coord.pdf`, pdfHeader, {
          contentType: "application/pdf",
        });
      assert.ok(coordUploadErr, "Coordinator cannot raw-upload resumes");

      // 5. Secretary cannot raw-upload into student folder
      const { error: secUploadErr } = await secUser.client.storage
        .from("resumes")
        .upload(`${studentUser.id}/sec.pdf`, pdfHeader, {
          contentType: "application/pdf",
        });
      assert.ok(secUploadErr, "Secretary cannot raw-upload resumes");

      // 6. Recruiter cannot raw-upload resumes
      const { error: recruiterUploadErr } = await recruiterUser.client.storage
        .from("resumes")
        .upload(`${recruiterUser.id}/test.pdf`, pdfHeader);
      assert.ok(recruiterUploadErr, "Recruiter cannot upload resumes");

      // 7. Anon cannot raw-upload resumes
      const anonClient = createClient<Database>(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: anonUploadErr } = await anonClient.storage
        .from("resumes")
        .upload("anon/test.pdf", pdfHeader);
      assert.ok(anonUploadErr, "Anon cannot upload resumes");

      // 8. Server-side / Admin client writes legitimate objects and orphan objects for test fixtures
      // Student A objects
      await admin.storage
        .from("resumes")
        .upload(`${studentUser.id}/resume_real.pdf`, pdfHeader, {
          contentType: "application/pdf",
          upsert: true,
        });
      await admin.storage
        .from("resumes")
        .upload(`${studentUser.id}/orphan_resume.pdf`, pdfHeader, {
          contentType: "application/pdf",
          upsert: true,
        });
      await admin.storage
        .from("profile-photos")
        .upload(`${studentUser.id}/photo_real.jpg`, jpegHeader, {
          contentType: "image/jpeg",
          upsert: true,
        });
      await admin.storage
        .from("profile-photos")
        .upload(`${studentUser.id}/orphan_photo.jpg`, jpegHeader, {
          contentType: "image/jpeg",
          upsert: true,
        });

      // Student B objects
      await admin.storage
        .from("resumes")
        .upload(`${studentBUser.id}/resume_real.pdf`, pdfHeader, {
          contentType: "application/pdf",
          upsert: true,
        });
      await admin.storage
        .from("profile-photos")
        .upload(`${studentBUser.id}/photo_real.jpg`, jpegHeader, {
          contentType: "image/jpeg",
          upsert: true,
        });

      // Register legitimate objects in database metadata
      await studentUser.client.rpc("register_student_resume", {
        p_storage_path: `${studentUser.id}/resume_real.pdf`,
        p_file_name: "resume_real.pdf",
        p_file_size_bytes: pdfHeader.length,
        p_mime_type: "application/pdf",
      });
      await studentUser.client.rpc("update_own_profile_photo", {
        p_storage_path: `${studentUser.id}/photo_real.jpg`,
      });

      await studentBUser.client.rpc("register_student_resume", {
        p_storage_path: `${studentBUser.id}/resume_real.pdf`,
        p_file_name: "resume_real.pdf",
        p_file_size_bytes: pdfHeader.length,
        p_mime_type: "application/pdf",
      });
      await studentBUser.client.rpc("update_own_profile_photo", {
        p_storage_path: `${studentBUser.id}/photo_real.jpg`,
      });

      // B. Student A read Student B resume -> denied
      const { data: foreignResume, error: readForeignErr } =
        await studentUser.client.storage
          .from("resumes")
          .download(`${studentBUser.id}/resume_real.pdf`);
      assert.ok(
        readForeignErr || !foreignResume,
        "Student A read Student B resume must be denied"
      );

      // C. Student A delete Student B resume -> denied / does not delete
      await studentUser.client.storage
        .from("resumes")
        .remove([`${studentBUser.id}/resume_real.pdf`]);

      const { data: stillExistsB } = await admin.storage
        .from("resumes")
        .download(`${studentBUser.id}/resume_real.pdf`);
      assert.ok(
        stillExistsB,
        "Student B resume must remain intact after Student A delete attempt"
      );

      // D. Student A cannot raw DELETE own current resume directly
      await studentUser.client.storage
        .from("resumes")
        .remove([`${studentUser.id}/resume_real.pdf`]);

      const { data: stillExistsA } = await admin.storage
        .from("resumes")
        .download(`${studentUser.id}/resume_real.pdf`);
      assert.ok(
        stillExistsA,
        "Student A own current resume must remain intact after raw delete attempt"
      );

      // E. Student A cannot raw DELETE own profile photo directly
      await studentUser.client.storage
        .from("profile-photos")
        .remove([`${studentUser.id}/photo_real.jpg`]);

      const { data: stillExistsPhotoA } = await admin.storage
        .from("profile-photos")
        .download(`${studentUser.id}/photo_real.jpg`);
      assert.ok(
        stillExistsPhotoA,
        "Student A own photo must remain intact after raw delete attempt"
      );

      // F. Student A cannot raw DELETE Student B's profile photo
      await studentUser.client.storage
        .from("profile-photos")
        .remove([`${studentBUser.id}/photo_real.jpg`]);

      const { data: stillExistsPhotoB } = await admin.storage
        .from("profile-photos")
        .download(`${studentBUser.id}/photo_real.jpg`);
      assert.ok(
        stillExistsPhotoB,
        "Student B photo must remain intact after Student A delete attempt"
      );

      // G. Coordinator cannot raw DELETE student resume
      await coordUser.client.storage
        .from("resumes")
        .remove([`${studentUser.id}/resume_real.pdf`]);

      const { data: stillExistsCoord } = await admin.storage
        .from("resumes")
        .download(`${studentUser.id}/resume_real.pdf`);
      assert.ok(
        stillExistsCoord,
        "Student resume must remain intact after Coordinator delete attempt"
      );

      // H. TNP Secretary cannot arbitrarily raw DELETE student resume
      await secUser.client.storage
        .from("resumes")
        .remove([`${studentUser.id}/resume_real.pdf`]);

      const { data: stillExistsSec } = await admin.storage
        .from("resumes")
        .download(`${studentUser.id}/resume_real.pdf`);
      assert.ok(
        stillExistsSec,
        "Student resume must remain intact after Secretary delete attempt"
      );
    }
  );

  await t.test(
    "14. Staff resume reads strictly bound to registered documents and coordinator scope",
    async () => {
      // 1. Coordinator in-scope REGISTERED resume read -> allowed
      const { data: inScopeResume, error: inScopeErr } =
        await coordUser.client.storage
          .from("resumes")
          .download(`${studentUser.id}/resume_real.pdf`);
      assert.ifError(inScopeErr);
      assert.ok(
        inScopeResume,
        "Coordinator can read registered in-scope student resume"
      );

      // 2. Coordinator in-scope UNREGISTERED ORPHAN resume read -> DENIED
      const { data: orphanResume, error: orphanErr } =
        await coordUser.client.storage
          .from("resumes")
          .download(`${studentUser.id}/orphan_resume.pdf`);
      assert.ok(
        orphanErr || !orphanResume,
        "Coordinator must NOT be able to read unregistered orphan resume blob"
      );

      // 3. Coordinator OUT-OF-SCOPE registered resume read -> DENIED
      const { data: outScopeResume, error: outScopeErr } =
        await coordUser.client.storage
          .from("resumes")
          .download(`${studentBUser.id}/resume_real.pdf`);
      assert.ok(
        outScopeErr || !outScopeResume,
        "Coordinator out-of-scope resume read must be denied"
      );

      // 4. Secretary read of registered resume -> allowed
      const { data: secResume, error: secErr } = await secUser.client.storage
        .from("resumes")
        .download(`${studentUser.id}/resume_real.pdf`);
      assert.ifError(secErr);
      assert.ok(secResume, "Secretary can read registered student resume");

      // 5. Secretary read of unregistered orphan resume -> DENIED
      const { data: secOrphanResume, error: secOrphanErr } =
        await secUser.client.storage
          .from("resumes")
          .download(`${studentUser.id}/orphan_resume.pdf`);
      assert.ok(
        secOrphanErr || !secOrphanResume,
        "Secretary cannot read unregistered orphan resume blob"
      );

      // 6. Recruiter resume read -> denied
      const { data: recruiterResume, error: recruiterErr } =
        await recruiterUser.client.storage
          .from("resumes")
          .download(`${studentUser.id}/resume_real.pdf`);
      assert.ok(
        recruiterErr || !recruiterResume,
        "Recruiter resume read must be denied"
      );

      // 7. Anon resume read -> denied
      const anonClient = createClient<Database>(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: anonResume, error: anonErr } = await anonClient.storage
        .from("resumes")
        .download(`${studentUser.id}/resume_real.pdf`);
      assert.ok(anonErr || !anonResume, "Anon resume read must be denied");
    }
  );

  await t.test(
    "15. Staff profile photo reads strictly bound to active registered photo and coordinator scope",
    async () => {
      // 1. Coordinator in-scope ACTIVE REGISTERED photo read -> allowed
      const { data: inScopePhoto, error: inScopePhotoErr } =
        await coordUser.client.storage
          .from("profile-photos")
          .download(`${studentUser.id}/photo_real.jpg`);
      assert.ifError(inScopePhotoErr);
      assert.ok(
        inScopePhoto,
        "Coordinator can read active registered in-scope student photo"
      );

      // 2. Coordinator in-scope UNREGISTERED ORPHAN photo read -> DENIED
      const { data: orphanPhoto, error: orphanPhotoErr } =
        await coordUser.client.storage
          .from("profile-photos")
          .download(`${studentUser.id}/orphan_photo.jpg`);
      assert.ok(
        orphanPhotoErr || !orphanPhoto,
        "Coordinator must NOT be able to read unregistered orphan photo blob"
      );

      // 3. Coordinator OUT-OF-SCOPE active photo read -> DENIED
      const { data: outScopePhoto, error: outScopePhotoErr } =
        await coordUser.client.storage
          .from("profile-photos")
          .download(`${studentBUser.id}/photo_real.jpg`);
      assert.ok(
        outScopePhotoErr || !outScopePhoto,
        "Coordinator out-of-scope photo read must be denied"
      );

      // 4. Photo replacement test: Student replaces photo -> Old photo can no longer be read by staff
      // Upload new photo via admin
      const jpegHeader = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      ]);
      await admin.storage
        .from("profile-photos")
        .upload(`${studentUser.id}/photo_v2.jpg`, jpegHeader, {
          contentType: "image/jpeg",
          upsert: true,
        });

      // Update student_profiles to photo_v2
      await studentUser.client.rpc("update_own_profile_photo", {
        p_storage_path: `${studentUser.id}/photo_v2.jpg`,
      });

      // Coordinator can read new photo
      const { data: newPhoto, error: newPhotoErr } =
        await coordUser.client.storage
          .from("profile-photos")
          .download(`${studentUser.id}/photo_v2.jpg`);
      assert.ifError(newPhotoErr);
      assert.ok(newPhoto, "Coordinator can read new active photo");

      // Coordinator attempt to read superseded old photo_real.jpg -> DENIED (no longer in profile_photo_path)
      const { data: oldPhoto, error: oldPhotoErr } =
        await coordUser.client.storage
          .from("profile-photos")
          .download(`${studentUser.id}/photo_real.jpg`);
      assert.ok(
        oldPhotoErr || !oldPhoto,
        "Coordinator cannot read superseded/abandoned photo after state change"
      );

      // 5. Recruiter profile-photo read -> denied
      const { data: recruiterPhoto, error: recruiterPhotoErr } =
        await recruiterUser.client.storage
          .from("profile-photos")
          .download(`${studentUser.id}/photo_v2.jpg`);
      assert.ok(
        recruiterPhotoErr || !recruiterPhoto,
        "Recruiter profile-photo read must be denied"
      );

      // 6. Anon photo read -> denied
      const anonClient = createClient<Database>(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: anonPhoto, error: anonPhotoErr } = await anonClient.storage
        .from("profile-photos")
        .download(`${studentUser.id}/photo_v2.jpg`);
      assert.ok(anonPhotoErr || !anonPhoto, "Anon photo read must be denied");
    }
  );

  // 7. Staff Directory Authorization & Lookahead Pagination
  await t.test(
    "16. Staff directory query strictly scopes students and limits lookahead to 21 rows",
    async () => {
      // Coordinator Bob queries student directory
      const { data: directory, error } = await coordUser.client
        .from("profiles")
        .select(
          `
          id,
          display_name,
          academic_records!academic_records_profile_id_fkey!inner (
            batch,
            program_id
          )
        `
        )
        .eq("role", "STUDENT")
        .order("created_at", { ascending: false })
        .limit(21);

      assert.ifError(error);
      const studentIds = (directory || []).map((s) => s.id);

      // In-scope student (Alice / BARCH 2026) must appear
      assert.ok(
        studentIds.includes(studentUser.id),
        "In-scope student Alice must be present in directory"
      );

      // Out-of-scope student (Charlie / MPLAN 2027) must NEVER appear
      assert.equal(
        studentIds.includes(studentBUser.id),
        false,
        "Out-of-scope student Charlie must NEVER appear in coordinator directory"
      );
    }
  );

  // 8. Documents Table Direct Mutation Prevention
  await t.test(
    "17. Direct INSERT, UPDATE, and DELETE on documents table are completely revoked",
    async () => {
      // Direct INSERT attempt
      const { error: insertErr } = await studentUser.client
        .from("documents")
        .insert({
          owner_id: studentUser.id,
          document_type: "RESUME",
          storage_path: `${studentUser.id}/forged.pdf`,
          file_name: "forged.pdf",
          file_size_bytes: 1024,
          mime_type: "application/pdf",
        });
      assert.ok(insertErr, "Direct INSERT on documents must fail");
      assert.match(insertErr.message, /permission denied/);

      // Direct UPDATE attempt
      const { error: updateErr } = await studentUser.client
        .from("documents")
        .update({ is_current: false })
        .eq("owner_id", studentUser.id);
      assert.ok(updateErr, "Direct UPDATE on documents must fail");
      assert.match(updateErr.message, /permission denied/);

      // Direct DELETE attempt
      const { error: deleteErr } = await studentUser.client
        .from("documents")
        .delete()
        .eq("owner_id", studentUser.id);
      assert.ok(deleteErr, "Direct DELETE on documents must fail");
      assert.match(deleteErr.message, /permission denied/);
    }
  );

  // Clean teardown and restore seed admin to active state
  t.after(async () => {
    // Clean up created storage objects
    await admin.storage
      .from("resumes")
      .remove([
        `${studentUser.id}/resume_real.pdf`,
        `${studentBUser.id}/resume_real.pdf`,
      ]);
    await admin.storage
      .from("profile-photos")
      .remove([
        `${studentUser.id}/photo_real.jpg`,
        `${studentBUser.id}/photo_real.jpg`,
      ]);

    // Deactivate test users so partial unique indexes aren't blocked for subsequent test runs
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
