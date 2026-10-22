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
import { GET as handleAvatarGet } from "../src/app/api/public/avatar/[slug]/route";
import type { Database } from "../src/types/database";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface PublicProfileRecord {
  slug: string;
  name: string;
  program_code: string;
  program_name: string;
  graduation_batch: string;
  headline: string | null;
  tagline: string | null;
  has_photo: boolean;
  linkedin_url: string | null;
  portfolio_url: string | null;
  portfolio_available: boolean;
  resume_available: boolean;
  verified_skills: Array<{ name: string; category: string }>;
}

interface PublicBatchPageRecord {
  slug: string;
  name: string;
  program_code: string;
  program_name: string;
  graduation_batch: string;
  headline: string | null;
  tagline: string | null;
  has_photo: boolean;
  portfolio_available: boolean;
  portfolio_url: string | null;
  resume_available: boolean;
  top_skills: Array<{ name: string; category: string }>;
  total_count: number;
}

interface PublicBatchesRecord {
  batch: string;
  program_code: string;
  program_name: string;
  student_count: number;
}

interface UpdatePublicSettingsRpcResult {
  success: boolean;
  public_profile_enabled: boolean;
  public_profile_slug: string;
  public_resume_enabled: boolean;
  public_portfolio_enabled: boolean;
}

interface AdminReassignSlugRpcResult {
  success: boolean;
  old_slug: string;
  new_slug: string;
}

test("Phase 9 Public Batch Showcase & Student Privacy Directory Suite", async (t) => {
  // --------------------------------------------------------------------------
  // Setup Fixture Identifiers & Accounts
  // --------------------------------------------------------------------------
  const adminId = "10000000-0000-0000-0000-000000000001";
  const secId = "20000000-0000-0000-0000-000000000001";
  const coordId = "30000000-0000-0000-0000-000000000001";

  const sAliceId = "40000000-0000-0000-0000-000000000001"; // BARCH 2026, Verified
  const sBobId = "40000000-0000-0000-0000-000000000002"; // MPLAN 2026, Verified
  const sCharlieId = "40000000-0000-0000-0000-000000000003"; // BARCH 2025
  const sDaveId = "40000000-0000-0000-0000-000000000004"; // BARCH 2026, Private

  const rAcmeId = "50000000-0000-0000-0000-000000000001";
  const companyAcmeId = "60000000-0000-0000-0000-000000000001";
  const contactAcmeId = "70000000-0000-0000-0000-000000000001";

  // Academic programs lookup
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

  assert.ok(barchProg?.id);
  assert.ok(mplanProg?.id);

  // Seed / ensure auth users
  const usersToSeed = [
    { id: adminId, email: "phase7_admin@vnit.test" },
    { id: secId, email: "phase7_sec@vnit.test" },
    { id: coordId, email: "phase7_coord@vnit.test" },
    { id: sAliceId, email: "phase7_alice@vnit.test" },
    { id: sBobId, email: "phase7_bob@vnit.test" },
    { id: sCharlieId, email: "phase7_charlie@vnit.test" },
    { id: sDaveId, email: "phase7_dave@vnit.test" },
    { id: rAcmeId, email: "phase7_recruiter@acme.test" },
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
  await admin.from("profiles").upsert([
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
      display_name: "Student Alice",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    {
      id: sBobId,
      role: "STUDENT",
      display_name: "Student Bob",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    {
      id: sCharlieId,
      role: "STUDENT",
      display_name: "Student Charlie",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    {
      id: sDaveId,
      role: "STUDENT",
      display_name: "Student Dave",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    {
      id: rAcmeId,
      role: "RECRUITER",
      display_name: "Acme Recruiter",
      is_active: true,
    },
  ]);

  // Seed academic records
  await admin.from("academic_records").upsert(
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
    ],
    { onConflict: "profile_id" }
  );

  // Coordinator scope for BARCH 2026
  await admin.from("coordinator_student_scopes").upsert(
    {
      coordinator_id: coordId,
      program_id: barchProg.id,
      batch: "2026",
      granted_by: adminId,
    },
    { onConflict: "coordinator_id,program_id,batch" }
  );

  // Recruiter fixtures
  await admin.from("companies").upsert(
    {
      id: companyAcmeId,
      name: "Acme Architecture Studio",
      normalized_name: "acme architecture studio",
      website: "https://acme-studio.test",
      is_archived: false,
      created_by: adminId,
    },
    { onConflict: "id" }
  );

  await admin.from("recruiter_contacts").upsert(
    {
      id: contactAcmeId,
      company_id: companyAcmeId,
      full_name: "Alice Contact",
      email: "phase7_recruiter@acme.test",
      is_active: true,
      created_by: adminId,
    },
    { onConflict: "id" }
  );

  await admin.from("recruiter_profiles").upsert(
    {
      profile_id: rAcmeId,
      company_id: companyAcmeId,
      recruiter_contact_id: contactAcmeId,
    },
    { onConflict: "profile_id" }
  );

  // Ensure catalog skill and verified skill for Alice
  let { data: existingSkill } = await admin
    .from("skills")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!existingSkill) {
    const { data: newSkill } = await admin
      .from("skills")
      .insert({
        name: "Sustainable Design",
        category: "DESIGN",
        is_active: true,
        created_by: adminId,
      })
      .select("id")
      .single();
    existingSkill = newSkill;
  }

  if (existingSkill) {
    await admin.from("student_skills").upsert(
      {
        student_id: sAliceId,
        skill_id: existingSkill.id,
        proficiency_level: 3,
        verification_status: "VERIFIED",
        is_active: true,
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      },
      { onConflict: "student_id,skill_id" }
    );
  }

  // Seed / configure public student profiles via service admin
  const setupShowcaseFixtures = async () => {
    // Upload synthetic JPEG profile photo for Alice
    const photoBuffer = Buffer.from(
      "\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9",
      "binary"
    );
    await admin.storage
      .from("profile-photos")
      .upload(`${sAliceId}/photo_v1.jpg`, photoBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    // 1. Alice: Public, Resume On, Portfolio On, Slug: alice-arch-showcase
    await admin.from("student_profiles").upsert(
      {
        profile_id: sAliceId,
        public_profile_enabled: true,
        public_resume_enabled: true,
        public_portfolio_enabled: true,
        public_profile_slug: "alice-arch-showcase",
        public_headline: "Sustainable Architectural Designer",
        public_tagline:
          "Passionate about passive solar housing and parametric massing.",
        portfolio_url: "https://alice-designs.example.com",
        profile_photo_path: `${sAliceId}/photo_v1.jpg`,
      },
      { onConflict: "profile_id" }
    );

    // 2. Bob: Public, Resume Off, Portfolio Off, Slug: bob-plan-showcase
    await admin.from("student_profiles").upsert(
      {
        profile_id: sBobId,
        public_profile_enabled: true,
        public_resume_enabled: false,
        public_portfolio_enabled: false,
        public_profile_slug: "bob-plan-showcase",
        public_headline: "Regional Infrastructure Analyst",
        public_tagline:
          "Specializing in transit-oriented development and GIS modeling.",
        portfolio_url: "https://bob-portfolio-hidden.example.com",
      },
      { onConflict: "profile_id" }
    );

    // 3. Dave: Private (public_profile_enabled = false), Slug: dave-private-slug
    await admin.from("student_profiles").upsert(
      {
        profile_id: sDaveId,
        public_profile_enabled: false,
        public_resume_enabled: false,
        public_portfolio_enabled: false,
        public_profile_slug: "dave-private-slug",
      },
      { onConflict: "profile_id" }
    );

    // 4. Charlie: No slug initially
    await admin.from("student_profiles").upsert(
      {
        profile_id: sCharlieId,
        public_profile_enabled: false,
        public_resume_enabled: false,
        public_portfolio_enabled: false,
        public_profile_slug: null,
      },
      { onConflict: "profile_id" }
    );
  };

  await setupShowcaseFixtures();

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
  const clientRec = await createClientForUser("phase7_recruiter@acme.test");

  const anonClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ==========================================================================
  // Section 1: Anonymous Base Table Access Revocation & Zero-Leakage Audit
  // ==========================================================================
  await t.test(
    "1.1 Anonymous SELECT on student_profiles returns 0 rows",
    async () => {
      const { data, error } = await anonClient
        .from("student_profiles")
        .select("*");
      assert.ifError(error);
      assert.equal(data?.length, 0);
    }
  );

  await t.test(
    "1.2 Anonymous SELECT on academic_records returns 0 rows",
    async () => {
      const { data, error } = await anonClient
        .from("academic_records")
        .select("*");
      assert.ifError(error);
      assert.equal(data?.length, 0);
    }
  );

  await t.test(
    "1.3 Anonymous SELECT on student_roster returns 0 rows",
    async () => {
      const { data, error } = await anonClient
        .from("student_roster")
        .select("*");
      assert.ifError(error);
      assert.equal(data?.length, 0);
    }
  );

  await t.test("1.4 Anonymous SELECT on documents returns 0 rows", async () => {
    const { data, error } = await anonClient.from("documents").select("*");
    assert.ifError(error);
    assert.equal(data?.length, 0);
  });

  await t.test(
    "1.5 Anonymous SELECT on student_skills returns 0 rows",
    async () => {
      const { data, error } = await anonClient
        .from("student_skills")
        .select("*");
      assert.ifError(error);
      assert.equal(data?.length, 0);
    }
  );

  await t.test(
    "1.6 Anonymous SELECT on student_skill_evidence returns 0 rows",
    async () => {
      const { data, error } = await anonClient
        .from("student_skill_evidence")
        .select("*");
      assert.ifError(error);
      assert.equal(data?.length, 0);
    }
  );

  await t.test("1.7 Anonymous SELECT on audit_logs is denied", async () => {
    const { data, error } = await anonClient.from("audit_logs").select("*");
    assert.ok(error);
    assert.match(error.message, /permission denied/i);
    assert.equal(data, null);
  });

  await t.test("1.8 Anonymous SELECT on profiles returns 0 rows", async () => {
    const { data, error } = await anonClient.from("profiles").select("*");
    assert.ifError(error);
    assert.equal(data?.length, 0);
  });

  await t.test(
    "1.9 Anonymous SELECT on applications returns 0 rows",
    async () => {
      const { data, error } = await anonClient.from("applications").select("*");
      assert.ifError(error);
      assert.equal(data?.length, 0);
    }
  );

  await t.test(
    "1.10 Anonymous SELECT on application_status_history returns 0 rows",
    async () => {
      const { data, error } = await anonClient
        .from("application_status_history")
        .select("*");
      assert.ifError(error);
      assert.equal(data?.length, 0);
    }
  );

  // ==========================================================================
  // Section 2: Public Student Profile RPC (get_public_student_profile)
  // ==========================================================================
  await t.test(
    "2.1 Active opted-in slug resolves for anonymous user",
    async () => {
      const { data, error } = await anonClient.rpc(
        "get_public_student_profile",
        {
          p_slug: "alice-arch-showcase",
        }
      );
      assert.ifError(error);
      assert.ok(data);
      const rows = data as unknown as PublicProfileRecord[];
      assert.equal(rows.length, 1);
      const profile = rows[0]!;
      assert.equal(profile.slug, "alice-arch-showcase");
      assert.equal(profile.name, "Student Alice");
      assert.equal(profile.program_code, "BARCH");
      assert.equal(profile.graduation_batch, "2026");
      assert.equal(profile.headline, "Sustainable Architectural Designer");
      assert.equal(
        profile.tagline,
        "Passionate about passive solar housing and parametric massing."
      );
    }
  );

  await t.test(
    "2.2 Public profile exposes portfolio URL only when public_portfolio_enabled = true",
    async () => {
      // Alice has portfolio enabled
      const { data: dAlice } = await anonClient.rpc(
        "get_public_student_profile",
        {
          p_slug: "alice-arch-showcase",
        }
      );
      const alice = (dAlice as unknown as PublicProfileRecord[])[0]!;
      assert.equal(alice.portfolio_available, true);
      assert.equal(alice.portfolio_url, "https://alice-designs.example.com");

      // Bob has portfolio disabled
      const { data: dBob } = await anonClient.rpc(
        "get_public_student_profile",
        {
          p_slug: "bob-plan-showcase",
        }
      );
      const bob = (dBob as unknown as PublicProfileRecord[])[0]!;
      assert.equal(bob.portfolio_available, false);
      assert.equal(bob.portfolio_url, null);
    }
  );

  await t.test(
    "2.3 Public profile exposes resume indicator only (never signed URL or storage path)",
    async () => {
      // Alice has resume indicator enabled
      const { data: dAlice } = await anonClient.rpc(
        "get_public_student_profile",
        {
          p_slug: "alice-arch-showcase",
        }
      );
      const alice = (dAlice as unknown as PublicProfileRecord[])[0]!;
      assert.equal(alice.resume_available, true);

      // Assert that response composite has NO storage path or signed URL properties
      const rawKeys = Object.keys(alice);
      assert.ok(!rawKeys.includes("storage_path"));
      assert.ok(!rawKeys.includes("resume_url"));
      assert.ok(!rawKeys.includes("signed_url"));

      // Bob has resume indicator disabled
      const { data: dBob } = await anonClient.rpc(
        "get_public_student_profile",
        {
          p_slug: "bob-plan-showcase",
        }
      );
      const bob = (dBob as unknown as PublicProfileRecord[])[0]!;
      assert.equal(bob.resume_available, false);
    }
  );

  await t.test(
    "2.4 Public profile exposes verified skills only without proficiency or evidence",
    async () => {
      const { data } = await anonClient.rpc("get_public_student_profile", {
        p_slug: "alice-arch-showcase",
      });
      const alice = (data as unknown as PublicProfileRecord[])[0]!;
      assert.ok(Array.isArray(alice.verified_skills));

      // Every item in verified_skills contains only name and category
      for (const sk of alice.verified_skills) {
        assert.ok(sk.name);
        assert.ok(sk.category);
        const skKeys = Object.keys(sk);
        assert.ok(!skKeys.includes("proficiency_level"));
        assert.ok(!skKeys.includes("evidence_url"));
        assert.ok(!skKeys.includes("verification_status"));
      }
    }
  );

  await t.test(
    "2.5 Public profile payload contains zero private fields or raw UUIDs",
    async () => {
      const { data } = await anonClient.rpc("get_public_student_profile", {
        p_slug: "alice-arch-showcase",
      });
      const alice = (data as unknown as PublicProfileRecord[])[0]!;
      const keys = Object.keys(alice);

      // Critical privacy invariants: zero PII / operational data
      assert.ok(!keys.includes("profile_id"));
      assert.ok(!keys.includes("id"));
      assert.ok(!keys.includes("cgpa"));
      assert.ok(!keys.includes("active_backlogs"));
      assert.ok(!keys.includes("phone"));
      assert.ok(!keys.includes("email"));
      assert.ok(!keys.includes("institutional_email"));
      assert.ok(!keys.includes("verification_status"));
      assert.ok(!keys.includes("applications"));
      assert.ok(!keys.includes("profile_photo_path"));

      // String serialized payload check: student UUID must never appear
      const serialized = JSON.stringify(alice);
      assert.ok(!serialized.includes(sAliceId));
    }
  );

  await t.test(
    "2.6 Private student profile returns 0 rows (404 boundary)",
    async () => {
      const { data, error } = await anonClient.rpc(
        "get_public_student_profile",
        {
          p_slug: "dave-private-slug",
        }
      );
      assert.ifError(error);
      const rows = data as unknown as PublicProfileRecord[];
      assert.equal(rows.length, 0);
    }
  );

  await t.test("2.7 Non-existent slug returns 0 rows", async () => {
    const { data, error } = await anonClient.rpc("get_public_student_profile", {
      p_slug: "unknown-student-slug-404",
    });
    assert.ifError(error);
    const rows = data as unknown as PublicProfileRecord[];
    assert.equal(rows.length, 0);
  });

  await t.test(
    "2.8 Malformed slug input safely returns 0 rows without error",
    async () => {
      const { data, error } = await anonClient.rpc(
        "get_public_student_profile",
        {
          p_slug: "bad/slug/injection--",
        }
      );
      assert.ifError(error);
      const rows = data as unknown as PublicProfileRecord[];
      assert.equal(rows.length, 0);
    }
  );

  await t.test(
    "2.9 Case-insensitive slug query resolves successfully",
    async () => {
      const { data, error } = await anonClient.rpc(
        "get_public_student_profile",
        {
          p_slug: "ALICE-ARCH-SHOWCASE",
        }
      );
      assert.ifError(error);
      const rows = data as unknown as PublicProfileRecord[];
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.slug, "alice-arch-showcase");
    }
  );

  // ==========================================================================
  // Section 3: Batch Directory RPC (get_public_batch_page)
  // ==========================================================================
  await t.test(
    "3.1 Batch directory returns only opted-in students in batch 2026",
    async () => {
      const { data, error } = await anonClient.rpc("get_public_batch_page", {
        p_batch: "2026",
      });
      assert.ifError(error);
      const students = data as unknown as PublicBatchPageRecord[];

      // Expect Alice and Bob (opted in); Dave (private) is excluded
      assert.equal(students.length, 2);
      const slugs = students.map((s) => s.slug);
      assert.ok(slugs.includes("alice-arch-showcase"));
      assert.ok(slugs.includes("bob-plan-showcase"));
      assert.ok(!slugs.includes("dave-private-slug"));
    }
  );

  await t.test(
    "3.2 Batch directory ordering is strictly deterministic (name ASC, slug ASC)",
    async () => {
      const { data } = await anonClient.rpc("get_public_batch_page", {
        p_batch: "2026",
      });
      const students = data as unknown as PublicBatchPageRecord[];
      assert.equal(students.length, 2);
      assert.equal(students[0]!.name, "Student Alice");
      assert.equal(students[1]!.name, "Student Bob");
    }
  );

  await t.test(
    "3.3 Program filter BARCH returns only Architecture students",
    async () => {
      const { data } = await anonClient.rpc("get_public_batch_page", {
        p_batch: "2026",
        p_program_code: "BARCH",
      });
      const students = data as unknown as PublicBatchPageRecord[];
      assert.equal(students.length, 1);
      assert.equal(students[0]!.slug, "alice-arch-showcase");
      assert.equal(students[0]!.program_code, "BARCH");
    }
  );

  await t.test(
    "3.4 Program filter MPLAN returns only Urban Planning students",
    async () => {
      const { data } = await anonClient.rpc("get_public_batch_page", {
        p_batch: "2026",
        p_program_code: "MPLAN",
      });
      const students = data as unknown as PublicBatchPageRecord[];
      assert.equal(students.length, 1);
      assert.equal(students[0]!.slug, "bob-plan-showcase");
      assert.equal(students[0]!.program_code, "MPLAN");
    }
  );

  await t.test(
    "3.5 Portfolio filter returns only students with public portfolio enabled",
    async () => {
      const { data } = await anonClient.rpc("get_public_batch_page", {
        p_batch: "2026",
        p_has_portfolio: true,
      });
      const students = data as unknown as PublicBatchPageRecord[];
      assert.equal(students.length, 1);
      assert.equal(students[0]!.slug, "alice-arch-showcase");
    }
  );

  await t.test(
    "3.6 Search by name prefix/substring matches correctly",
    async () => {
      const { data } = await anonClient.rpc("get_public_batch_page", {
        p_batch: "2026",
        p_search: "Alice",
      });
      const students = data as unknown as PublicBatchPageRecord[];
      assert.equal(students.length, 1);
      assert.equal(students[0]!.slug, "alice-arch-showcase");
    }
  );

  await t.test(
    "3.7 Non-matching search returns empty list with total_count 0",
    async () => {
      const { data } = await anonClient.rpc("get_public_batch_page", {
        p_batch: "2026",
        p_search: "NonExistentStudentName",
      });
      const students = data as unknown as PublicBatchPageRecord[];
      assert.equal(students.length, 0);
    }
  );

  await t.test(
    "3.8 Cross-batch isolation: query for batch 2025 returns 0",
    async () => {
      const { data } = await anonClient.rpc("get_public_batch_page", {
        p_batch: "2025",
      });
      const students = data as unknown as PublicBatchPageRecord[];
      assert.equal(students.length, 0);
    }
  );

  await t.test("3.9 Page size limit is clamped between 1 and 24", async () => {
    // Requesting excessive limit 10000 returns no more than 24
    const { data } = await anonClient.rpc("get_public_batch_page", {
      p_batch: "2026",
      p_limit: 10000,
    });
    const students = data as unknown as PublicBatchPageRecord[];
    assert.ok(students.length <= 24);
  });

  // ==========================================================================
  // Section 4: Public Batches Summary RPC (get_public_batches)
  // ==========================================================================
  await t.test(
    "4.1 get_public_batches returns cohort summaries for batches with public students",
    async () => {
      const { data, error } = await anonClient.rpc("get_public_batches");
      assert.ifError(error);
      const batches = data as unknown as PublicBatchesRecord[];

      assert.ok(batches.length >= 2);
      const barch2026 = batches.find(
        (b) => b.batch === "2026" && b.program_code === "BARCH"
      );
      const mplan2026 = batches.find(
        (b) => b.batch === "2026" && b.program_code === "MPLAN"
      );

      assert.ok(barch2026);
      assert.equal(Number(barch2026.student_count), 1); // Alice
      assert.ok(mplan2026);
      assert.equal(Number(mplan2026.student_count), 1); // Bob
    }
  );

  // ==========================================================================
  // Section 5: Student Privacy Toggles & Immediate Revocation
  // ==========================================================================
  await t.test(
    "5.1 Alice disables public profile -> immediately hidden from RPC & directory",
    async () => {
      // Alice turns public profile OFF
      const { data: updateRes, error: updateErr } = await clientAlice.rpc(
        "update_own_public_profile_settings",
        {
          p_public_profile_enabled: false,
          p_public_resume_enabled: false,
          p_public_portfolio_enabled: false,
          p_public_profile_slug: "alice-arch-showcase",
        }
      );
      assert.ifError(updateErr);
      const res = updateRes as unknown as UpdatePublicSettingsRpcResult;
      assert.equal(res.public_profile_enabled, false);

      // Immediate check as anonymous user: individual profile returns 0 rows
      const { data: dProfile } = await anonClient.rpc(
        "get_public_student_profile",
        {
          p_slug: "alice-arch-showcase",
        }
      );
      assert.equal((dProfile as unknown as PublicProfileRecord[]).length, 0);

      // Immediate check as anonymous user: batch page excludes Alice (returns only Bob)
      const { data: dBatch } = await anonClient.rpc("get_public_batch_page", {
        p_batch: "2026",
      });
      const batchStudents = dBatch as unknown as PublicBatchPageRecord[];
      assert.equal(batchStudents.length, 1);
      assert.equal(batchStudents[0]!.slug, "bob-plan-showcase");

      // Alice turns public profile back ON
      const { error: reenableErr } = await clientAlice.rpc(
        "update_own_public_profile_settings",
        {
          p_public_profile_enabled: true,
          p_public_resume_enabled: true,
          p_public_portfolio_enabled: true,
          p_public_profile_slug: "alice-arch-showcase",
          p_public_headline: "Sustainable Architectural Designer",
        }
      );
      assert.ifError(reenableErr);

      // Immediately visible again
      const { data: dRestored } = await anonClient.rpc(
        "get_public_student_profile",
        {
          p_slug: "alice-arch-showcase",
        }
      );
      assert.equal((dRestored as unknown as PublicProfileRecord[]).length, 1);
    }
  );

  await t.test(
    "5.2 Slug immutability: student cannot change slug after initial assignment",
    async () => {
      // Alice attempts to alter her slug from alice-arch-showcase to alice-new-slug
      const { error } = await clientAlice.rpc(
        "update_own_public_profile_settings",
        {
          p_public_profile_enabled: true,
          p_public_resume_enabled: true,
          p_public_portfolio_enabled: true,
          p_public_profile_slug: "alice-new-slug",
        }
      );
      assert.ok(error);
      assert.match(
        error.message,
        /Public profile slug cannot be changed once assigned/i
      );
    }
  );

  await t.test(
    "5.3 Charlie assigns initial slug successfully adhering to format rules",
    async () => {
      // Charlie assigns slug for the first time
      const { data, error } = await clientCharlie.rpc(
        "update_own_public_profile_settings",
        {
          p_public_profile_enabled: true,
          p_public_resume_enabled: false,
          p_public_portfolio_enabled: false,
          p_public_profile_slug: "charlie-arch-2025",
          p_public_headline: "Landscape Architect",
        }
      );
      assert.ifError(error);
      const res = data as unknown as UpdatePublicSettingsRpcResult;
      assert.equal(res.public_profile_slug, "charlie-arch-2025");
      assert.equal(res.public_profile_enabled, true);

      // Attempting to change Charlie's slug now fails
      const { error: changeErr } = await clientCharlie.rpc(
        "update_own_public_profile_settings",
        {
          p_public_profile_enabled: true,
          p_public_resume_enabled: false,
          p_public_portfolio_enabled: false,
          p_public_profile_slug: "charlie-hacked-slug",
        }
      );
      assert.ok(changeErr);
      assert.match(
        changeErr.message,
        /Public profile slug cannot be changed once assigned/i
      );
    }
  );

  await t.test(
    "5.4 Invalid slug format rejected (too short, uppercase, or special characters)",
    async () => {
      // Unauthenticated or invalid slug on Bob (who already has a slug)
      const { error } = await clientBob.rpc(
        "update_own_public_profile_settings",
        {
          p_public_profile_enabled: true,
          p_public_resume_enabled: false,
          p_public_portfolio_enabled: false,
          p_public_profile_slug: "b!",
        }
      );
      assert.ok(error);
    }
  );

  // ==========================================================================
  // Section 6: Super Admin Slug Recovery (admin_reassign_profile_slug)
  // ==========================================================================
  await t.test(
    "6.1 Super Admin can reassign slug with mandatory audit reason",
    async () => {
      const { data, error } = await clientAdmin.rpc(
        "admin_reassign_profile_slug",
        {
          p_target_student_id: sAliceId,
          p_new_slug: "alice-arch-recovered",
          p_reason: "Legal name correction and portfolio URL realignment",
        }
      );
      assert.ifError(error);
      const res = data as unknown as AdminReassignSlugRpcResult;
      assert.equal(res.old_slug, "alice-arch-showcase");
      assert.equal(res.new_slug, "alice-arch-recovered");

      // Anonymous user now resolves Alice under new slug
      const { data: dAlice } = await anonClient.rpc(
        "get_public_student_profile",
        {
          p_slug: "alice-arch-recovered",
        }
      );
      assert.equal((dAlice as unknown as PublicProfileRecord[]).length, 1);

      // Old slug now returns 0 rows (retired)
      const { data: dOld } = await anonClient.rpc(
        "get_public_student_profile",
        {
          p_slug: "alice-arch-showcase",
        }
      );
      assert.equal((dOld as unknown as PublicProfileRecord[]).length, 0);

      // Verify audit log entry
      const { data: auditRows } = await admin
        .from("audit_logs")
        .select("*")
        .eq("action", "PROFILE_SLUG_REASSIGNED")
        .eq("entity_id", sAliceId);
      assert.ok(auditRows && auditRows.length >= 1);
    }
  );

  await t.test(
    "6.2 Non-Super Admin (Coordinator/Secretary/Student) cannot reassign slug",
    async () => {
      const { error: coordErr } = await clientCoord.rpc(
        "admin_reassign_profile_slug",
        {
          p_target_student_id: sAliceId,
          p_new_slug: "alice-coord-hack",
          p_reason: "Unauthorized attempt",
        }
      );
      assert.ok(coordErr);
      assert.match(
        coordErr.message,
        /Forbidden: only Super Admins can reassign public profile slugs/i
      );

      const { error: secErr } = await clientSec.rpc(
        "admin_reassign_profile_slug",
        {
          p_target_student_id: sAliceId,
          p_new_slug: "alice-sec-hack",
          p_reason: "Unauthorized attempt",
        }
      );
      assert.ok(secErr);
      assert.match(
        secErr.message,
        /Forbidden: only Super Admins can reassign public profile slugs/i
      );
    }
  );

  // ==========================================================================
  // Section 7: Staff Public Visibility Audit View Scoping
  // ==========================================================================
  await t.test(
    "7.1 Coordinator sees only in-scope students in v_staff_student_public_profiles",
    async () => {
      const { data, error } = await clientCoord
        .from("v_staff_student_public_profiles")
        .select("*");
      assert.ifError(error);
      assert.ok(data);

      // Coordinator is scoped only to BARCH 2026:
      // Should see Alice (BARCH 2026), Dave (BARCH 2026)
      // Should NOT see Bob (MPLAN 2026) or Charlie (BARCH 2025)
      for (const row of data) {
        assert.equal(row.program_code, "BARCH");
        assert.equal(row.batch, "2026");
      }
      const slugs = data.map((r) => r.public_profile_slug);
      assert.ok(slugs.includes("alice-arch-recovered"));
      assert.ok(!slugs.includes("bob-plan-showcase"));
    }
  );

  await t.test(
    "7.2 Secretary and Admin see all students in v_staff_student_public_profiles",
    async () => {
      const { data: secData, error: secErr } = await clientSec
        .from("v_staff_student_public_profiles")
        .select("*");
      assert.ifError(secErr);
      assert.ok(secData && secData.length >= 4);

      const { data: adminData, error: adminErr } = await clientAdmin
        .from("v_staff_student_public_profiles")
        .select("*");
      assert.ifError(adminErr);
      assert.ok(adminData && adminData.length >= 4);
    }
  );

  await t.test(
    "7.3 Recruiter and Student receive 0 rows from v_staff_student_public_profiles",
    async () => {
      const { data: recData, error: recErr } = await clientRec
        .from("v_staff_student_public_profiles")
        .select("*");
      assert.ifError(recErr);
      assert.equal(recData?.length, 0);

      const { data: studData, error: studErr } = await clientAlice
        .from("v_staff_student_public_profiles")
        .select("*");
      assert.ifError(studErr);
      assert.equal(studData?.length, 0);
    }
  );

  // ==========================================================================
  // Section 8: Authenticated User Does Not Get Widened Public Projection
  // ==========================================================================
  await t.test(
    "8.1 Recruiter and Student get identical narrow projection from public RPC",
    async () => {
      const { data: recData } = await clientRec.rpc(
        "get_public_student_profile",
        {
          p_slug: "alice-arch-recovered",
        }
      );
      const recAlice = (recData as unknown as PublicProfileRecord[])[0]!;

      const { data: anonData } = await anonClient.rpc(
        "get_public_student_profile",
        {
          p_slug: "alice-arch-recovered",
        }
      );
      const anonAlice = (anonData as unknown as PublicProfileRecord[])[0]!;

      // Assert identical keys and values
      assert.deepEqual(recAlice, anonAlice);
      assert.equal(recAlice.portfolio_available, true);
      assert.equal(recAlice.resume_available, true);
      // Recruiter cannot get CGPA or phone through public RPC
      assert.ok(!("cgpa" in recAlice));
      assert.ok(!("phone" in recAlice));
    }
  );

  // ==========================================================================
  // Section 9: Public Avatar Delivery & Strict Privacy Revocation
  // ==========================================================================
  await t.test(
    "9.1 Active opted-in student with photo resolves avatar via GET /api/public/avatar/[slug]",
    async () => {
      // Alice active slug at this point in test flow is alice-arch-recovered
      const req = new NextRequest(
        "http://localhost:3000/api/public/avatar/alice-arch-recovered"
      );
      const res = await handleAvatarGet(req, {
        params: Promise.resolve({ slug: "alice-arch-recovered" }),
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get("Content-Type"), "image/jpeg");
      assert.equal(
        res.headers.get("Cache-Control"),
        "no-cache, no-store, max-age=0, must-revalidate"
      );
      assert.equal(res.headers.get("Pragma"), "no-cache");
      assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");

      const body = await res.arrayBuffer();
      assert.ok(body.byteLength > 0);
    }
  );

  await t.test(
    "9.2 Anonymous caller cannot execute _get_public_avatar_storage_path RPC directly",
    async () => {
      const { data, error } = await anonClient.rpc(
        "_get_public_avatar_storage_path",
        { p_slug: "alice-arch-recovered" }
      );
      assert.ok(error);
      assert.equal(data, null);
    }
  );

  await t.test(
    "9.3 Authenticated student/recruiter cannot execute _get_public_avatar_storage_path RPC directly",
    async () => {
      const { data: dStud, error: eStud } = await clientAlice.rpc(
        "_get_public_avatar_storage_path",
        { p_slug: "alice-arch-recovered" }
      );
      assert.ok(eStud);
      assert.equal(dStud, null);

      const { data: dRec, error: eRec } = await clientRec.rpc(
        "_get_public_avatar_storage_path",
        { p_slug: "alice-arch-recovered" }
      );
      assert.ok(eRec);
      assert.equal(dRec, null);
    }
  );

  await t.test(
    "9.4 Unknown slug returns uniform 404 with no-cache headers",
    async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/public/avatar/non-existent-student-slug"
      );
      const res = await handleAvatarGet(req, {
        params: Promise.resolve({ slug: "non-existent-student-slug" }),
      });

      assert.equal(res.status, 404);
      assert.equal(
        res.headers.get("Cache-Control"),
        "no-cache, no-store, max-age=0, must-revalidate"
      );
      assert.equal(res.headers.get("Pragma"), "no-cache");
      const text = await res.text();
      assert.equal(text, "Not Found");
    }
  );

  await t.test(
    "9.5 Private student Dave returns uniform 404 with no-cache headers",
    async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/public/avatar/dave-private-slug"
      );
      const res = await handleAvatarGet(req, {
        params: Promise.resolve({ slug: "dave-private-slug" }),
      });

      assert.equal(res.status, 404);
      assert.equal(
        res.headers.get("Cache-Control"),
        "no-cache, no-store, max-age=0, must-revalidate"
      );
      const text = await res.text();
      assert.equal(text, "Not Found");
    }
  );

  await t.test(
    "9.6 Student Bob (opted-in without photo) returns uniform 404 with no-cache headers",
    async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/public/avatar/bob-plan-showcase"
      );
      const res = await handleAvatarGet(req, {
        params: Promise.resolve({ slug: "bob-plan-showcase" }),
      });

      assert.equal(res.status, 404);
      assert.equal(
        res.headers.get("Cache-Control"),
        "no-cache, no-store, max-age=0, must-revalidate"
      );
      const text = await res.text();
      assert.equal(text, "Not Found");
    }
  );

  await t.test("9.7 Profile disable immediately revokes avatar", async () => {
    // Alice disables public profile
    await clientAlice.rpc("update_own_public_profile_settings", {
      p_public_profile_enabled: false,
      p_public_resume_enabled: false,
      p_public_portfolio_enabled: false,
      p_public_profile_slug: "alice-arch-recovered",
    });

    // Avatar endpoint immediately returns 404
    const req = new NextRequest(
      "http://localhost:3000/api/public/avatar/alice-arch-recovered"
    );
    const res = await handleAvatarGet(req, {
      params: Promise.resolve({ slug: "alice-arch-recovered" }),
    });
    assert.equal(res.status, 404);

    // Alice re-enables public profile
    await clientAlice.rpc("update_own_public_profile_settings", {
      p_public_profile_enabled: true,
      p_public_resume_enabled: true,
      p_public_portfolio_enabled: true,
      p_public_profile_slug: "alice-arch-recovered",
    });

    // Avatar immediately resolves again (200)
    const resRestored = await handleAvatarGet(req, {
      params: Promise.resolve({ slug: "alice-arch-recovered" }),
    });
    assert.equal(resRestored.status, 200);
  });

  await t.test("9.8 Inactive student account returns uniform 404", async () => {
    // Deactivate Alice in profiles
    await admin
      .from("profiles")
      .update({ is_active: false })
      .eq("id", sAliceId);

    const req = new NextRequest(
      "http://localhost:3000/api/public/avatar/alice-arch-recovered"
    );
    const res = await handleAvatarGet(req, {
      params: Promise.resolve({ slug: "alice-arch-recovered" }),
    });
    assert.equal(res.status, 404);

    // Reactivate Alice
    await admin.from("profiles").update({ is_active: true }).eq("id", sAliceId);
    const resRestored = await handleAvatarGet(req, {
      params: Promise.resolve({ slug: "alice-arch-recovered" }),
    });
    assert.equal(resRestored.status, 200);
  });

  await t.test(
    "9.9 ALUMNI lifecycle state returns uniform 404 (Phase 10 owns alumni public showcase)",
    async () => {
      // Set Alice lifecycle to ALUMNI
      await admin
        .from("profiles")
        .update({ student_lifecycle_status: "ALUMNI" })
        .eq("id", sAliceId);

      const req = new NextRequest(
        "http://localhost:3000/api/public/avatar/alice-arch-recovered"
      );
      const res = await handleAvatarGet(req, {
        params: Promise.resolve({ slug: "alice-arch-recovered" }),
      });
      assert.equal(res.status, 404);

      // Restore to STUDENT_ACTIVE
      await admin
        .from("profiles")
        .update({ student_lifecycle_status: "STUDENT_ACTIVE" })
        .eq("id", sAliceId);
      const resRestored = await handleAvatarGet(req, {
        params: Promise.resolve({ slug: "alice-arch-recovered" }),
      });
      assert.equal(resRestored.status, 200);
    }
  );

  await t.test(
    "9.10 Unverified academic record returns uniform 404",
    async () => {
      // Set Alice verification_status to UNVERIFIED
      await admin
        .from("academic_records")
        .update({ verification_status: "UNVERIFIED" })
        .eq("profile_id", sAliceId);

      const req = new NextRequest(
        "http://localhost:3000/api/public/avatar/alice-arch-recovered"
      );
      const res = await handleAvatarGet(req, {
        params: Promise.resolve({ slug: "alice-arch-recovered" }),
      });
      assert.equal(res.status, 404);

      // Restore to VERIFIED
      await admin
        .from("academic_records")
        .update({ verification_status: "VERIFIED" })
        .eq("profile_id", sAliceId);
      const resRestored = await handleAvatarGet(req, {
        params: Promise.resolve({ slug: "alice-arch-recovered" }),
      });
      assert.equal(resRestored.status, 200);
    }
  );

  await t.test(
    "9.11 Super Admin slug reassignment: old slug returns 404, new slug returns 200",
    async () => {
      // Old slug before reassignment was alice-arch-showcase
      const reqOld = new NextRequest(
        "http://localhost:3000/api/public/avatar/alice-arch-showcase"
      );
      const resOld = await handleAvatarGet(reqOld, {
        params: Promise.resolve({ slug: "alice-arch-showcase" }),
      });
      assert.equal(resOld.status, 404);

      // Current reassigned slug is alice-arch-recovered
      const reqNew = new NextRequest(
        "http://localhost:3000/api/public/avatar/alice-arch-recovered"
      );
      const resNew = await handleAvatarGet(reqNew, {
        params: Promise.resolve({ slug: "alice-arch-recovered" }),
      });
      assert.equal(resNew.status, 200);
    }
  );

  await t.test(
    "9.12 Avatar endpoint rejects raw UUID and path traversal input with 404",
    async () => {
      // Attempting raw UUID query
      const reqUuid = new NextRequest(
        `http://localhost:3000/api/public/avatar/${sAliceId}`
      );
      const resUuid = await handleAvatarGet(reqUuid, {
        params: Promise.resolve({ slug: sAliceId }),
      });
      assert.equal(resUuid.status, 404);

      // Attempting path traversal
      const reqTrav = new NextRequest(
        "http://localhost:3000/api/public/avatar/..%2F..%2Fetc"
      );
      const resTrav = await handleAvatarGet(reqTrav, {
        params: Promise.resolve({ slug: "../../etc" }),
      });
      assert.equal(resTrav.status, 404);
    }
  );
});
