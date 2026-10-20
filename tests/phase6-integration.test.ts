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

interface RpcCompanyResponse {
  success?: boolean;
  company_id?: string;
  is_archived?: boolean;
}

interface RpcContactResponse {
  success?: boolean;
  contact_id?: string;
  is_active?: boolean;
}

interface RpcInvitationResponse {
  success?: boolean;
  invitation_id?: string;
  status?: string;
}

interface RpcAcceptResponse {
  success?: boolean;
  company_id?: string;
  company_name?: string;
  contact_id?: string;
  profile_id?: string;
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test("Phase 6 Companies, Recruiters, Invitation Workflow & Isolation Suite", async (t) => {
  const adminEmail = "integration_phase4_admin@vnit.test";
  const secEmail = "integration_phase4_sec@vnit.test";
  const coordEmail = "integration_phase4_coord@vnit.test";
  const studentEmail = "integration_phase4_student@vnit.test";
  const testPassword = "Password1234!";

  // Dedicated recruiter emails for Phase 6
  const recruiterAEmail = "phase6_recruiter_alpha@company-alpha.test";
  const recruiterA2Email = "phase6_recruiter_alpha2@company-alpha.test";
  const recruiterBEmail = "phase6_recruiter_beta@company-beta.test";
  const recruiterMismatchEmail = "phase6_recruiter_mismatch@company-gamma.test";
  const recruiterRevokedEmail = "phase6_recruiter_revoked@company-alpha.test";
  const recruiterCaseBEmail = "phase6_recruiter_case_b@company-alpha.test";

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
  const studentUser = await getAuthenticatedClient(studentEmail);

  // Deactivate default seed admin to avoid uq_active_super_admin conflict
  await admin
    .from("profiles")
    .update({ is_active: false })
    .eq("id", "00000000-0000-0000-0000-000000000001");

  // Deactivate any existing active secretary and slot_1 coordinator
  await admin
    .from("profiles")
    .update({ is_active: false })
    .eq("role", "TNP_SECRETARY");

  await admin
    .from("profiles")
    .update({ is_active: false })
    .eq("coordinator_slot", "SLOT_1");

  // Upsert test users with their authoritative roles
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
      id: studentUser.id,
      role: "STUDENT",
      display_name: studentEmail.split("@")[0] || "StudentA",
      is_active: true,
      student_lifecycle_status: "STUDENT_ACTIVE",
    },
    { onConflict: "id" }
  );

  // Clean up any test companies/contacts/invitations/profiles from prior test runs
  const { data: existingCompanies } = await admin
    .from("companies")
    .select("id")
    .in("normalized_name", [
      "alpha studio vnit",
      "alpha studio international",
      "beta urban planners",
    ]);

  if (existingCompanies && existingCompanies.length > 0) {
    const compIds = existingCompanies.map((c) => c.id);
    await admin.from("recruiter_profiles").delete().in("company_id", compIds);
    const { data: contactsToDel } = await admin
      .from("recruiter_contacts")
      .select("id")
      .in("company_id", compIds);

    if (contactsToDel && contactsToDel.length > 0) {
      const contactIds = contactsToDel.map((c) => c.id);
      await admin
        .from("recruiter_invitations")
        .delete()
        .in("recruiter_contact_id", contactIds);
      await admin.from("recruiter_contacts").delete().in("id", contactIds);
    }
    await admin.from("companies").delete().in("id", compIds);
  }

  // Also remove recruiter test profiles/contacts if previously created
  const testRecEmails = [
    recruiterAEmail.toLowerCase(),
    recruiterA2Email.toLowerCase(),
    recruiterRevokedEmail.toLowerCase(),
    recruiterCaseBEmail.toLowerCase(),
  ];
  const { data: existingRecruiters } = await admin
    .from("recruiter_contacts")
    .select("id")
    .in("email", testRecEmails);

  if (existingRecruiters && existingRecruiters.length > 0) {
    const cIds = existingRecruiters.map((c) => c.id);
    await admin
      .from("recruiter_profiles")
      .delete()
      .in("recruiter_contact_id", cIds);
    await admin
      .from("recruiter_invitations")
      .delete()
      .in("recruiter_contact_id", cIds);
    await admin.from("recruiter_contacts").delete().in("id", cIds);
  }

  let companyAId: string = "";
  let companyBId: string = "";
  let contactAId: string = "";
  let contactBId: string = "";

  // --------------------------------------------------------------------------
  // 1. Company Management Tests
  // --------------------------------------------------------------------------
  await t.test(
    "1.1 Super Admin creates company Alpha Studio successfully",
    async () => {
      const { data, error } = (await adminUser.client.rpc("create_company", {
        p_name: "Alpha Studio VNIT",
        p_website: "https://alphastudio.example.com",
        p_description: "Premier architecture and planning consultancy",
      })) as { data: RpcCompanyResponse | null; error: unknown };

      assert.ifError(error);
      assert.ok(data?.company_id);
      companyAId = data.company_id;

      // Verify in db
      const { data: comp } = await admin
        .from("companies")
        .select("name, normalized_name, is_archived")
        .eq("id", companyAId)
        .single();

      assert.equal(comp?.name, "Alpha Studio VNIT");
      assert.equal(comp?.normalized_name, "alpha studio vnit");
      assert.equal(comp?.is_archived, false);
    }
  );

  await t.test(
    "1.2 Secretary creates second company Beta Labs successfully",
    async () => {
      const { data, error } = (await secUser.client.rpc("create_company", {
        p_name: "Beta Urban Planners",
        p_website: "https://betaplanners.example.com",
        p_description: "Urban infrastructure analytics",
      })) as { data: RpcCompanyResponse | null; error: unknown };

      assert.ifError(error);
      assert.ok(data?.company_id);
      companyBId = data.company_id;
    }
  );

  await t.test("1.3 Normalized duplicate company name rejection", async () => {
    const { error } = await secUser.client.rpc("create_company", {
      p_name: "   ALPHA STUDIO VNIT   ",
      p_website: undefined,
      p_description: undefined,
    });

    assert.ok(error, "Duplicate normalized company name must be rejected");
    assert.ok(
      (error as { message: string }).message.includes("already exists") ||
        (error as { code: string }).code === "23505",
      `Expected duplicate message, got: ${(error as { message: string }).message}`
    );
  });

  await t.test("1.4 Secretary updates company details", async () => {
    const { data, error } = (await secUser.client.rpc("update_company", {
      p_company_id: companyAId,
      p_name: "Alpha Studio International",
      p_website: "https://alphastudio.org",
      p_description: "Updated description for Alpha Studio",
    })) as { data: RpcCompanyResponse | null; error: unknown };

    assert.ifError(error);
    assert.equal(data?.company_id, companyAId);

    // Verify name in db
    const { data: comp } = await admin
      .from("companies")
      .select("name")
      .eq("id", companyAId)
      .single();
    assert.equal(comp?.name, "Alpha Studio International");
  });

  await t.test(
    "1.5 Coordinator cannot create, update, or archive companies",
    async () => {
      const { error: createErr } = await coordUser.client.rpc(
        "create_company",
        {
          p_name: "Unauthorized Company",
          p_website: undefined,
          p_description: undefined,
        }
      );
      assert.ok(createErr, "Coordinator must not create companies");

      const { error: updateErr } = await coordUser.client.rpc(
        "update_company",
        {
          p_company_id: companyAId,
          p_name: "Hacked Name",
          p_website: undefined,
          p_description: undefined,
        }
      );
      assert.ok(updateErr, "Coordinator must not update companies");

      const { error: archiveErr } = await coordUser.client.rpc(
        "archive_company",
        {
          p_company_id: companyAId,
        }
      );
      assert.ok(archiveErr, "Coordinator must not archive companies");
    }
  );

  await t.test(
    "1.6 Student cannot create, update, or archive companies",
    async () => {
      const { error: createErr } = await studentUser.client.rpc(
        "create_company",
        {
          p_name: "Student Company",
          p_website: undefined,
          p_description: undefined,
        }
      );
      assert.ok(createErr, "Student must not create companies");
    }
  );

  await t.test("1.7 Super Admin archives and reactivates company", async () => {
    const { data: archData, error: archErr } = (await adminUser.client.rpc(
      "archive_company",
      { p_company_id: companyBId }
    )) as { data: RpcCompanyResponse | null; error: unknown };

    assert.ifError(archErr);
    assert.equal(archData?.is_archived, true);

    const { data: reactData, error: reactErr } = (await adminUser.client.rpc(
      "reactivate_company",
      { p_company_id: companyBId }
    )) as { data: RpcCompanyResponse | null; error: unknown };

    assert.ifError(reactErr);
    assert.equal(reactData?.is_archived, false);
  });

  // --------------------------------------------------------------------------
  // 2. Recruiter Contact Management Tests
  // --------------------------------------------------------------------------
  await t.test(
    "2.1 Super Admin creates recruiter contact under Alpha Studio",
    async () => {
      const { data, error } = (await adminUser.client.rpc(
        "create_recruiter_contact",
        {
          p_company_id: companyAId,
          p_full_name: "Alice Recruiter Alpha",
          p_email: recruiterAEmail,
          p_phone: "+91-9876543210",
          p_designation: "Talent Acquisition Lead",
        }
      )) as { data: RpcContactResponse | null; error: unknown };

      assert.ifError(error);
      assert.ok(data?.contact_id);
      contactAId = data.contact_id;

      // Verify contact in database
      const { data: contact } = await admin
        .from("recruiter_contacts")
        .select("full_name, email, is_active")
        .eq("id", contactAId)
        .single();

      assert.equal(contact?.full_name, "Alice Recruiter Alpha");
      assert.equal(contact?.email, recruiterAEmail.toLowerCase());
      assert.equal(contact?.is_active, true);
    }
  );

  await t.test(
    "2.2 Secretary creates recruiter contact under Beta Labs",
    async () => {
      const { data, error } = (await secUser.client.rpc(
        "create_recruiter_contact",
        {
          p_company_id: companyBId,
          p_full_name: "Bob Recruiter Beta",
          p_email: recruiterBEmail,
          p_phone: "+91-9876543211",
          p_designation: "HR Director",
        }
      )) as { data: RpcContactResponse | null; error: unknown };

      assert.ifError(error);
      assert.ok(data?.contact_id);
      contactBId = data.contact_id;
    }
  );

  await t.test(
    "2.3 Duplicate normalized email is rejected across contacts",
    async () => {
      const { error } = await secUser.client.rpc("create_recruiter_contact", {
        p_company_id: companyBId,
        p_full_name: "Duplicate Alice",
        p_email: `   ${recruiterAEmail.toUpperCase()}   `,
        p_phone: undefined,
        p_designation: undefined,
      });

      assert.ok(error, "Duplicate contact email must be rejected");
      assert.ok(
        (error as { message: string }).message.includes("already registered") ||
          (error as { code: string }).code === "23505",
        `Expected duplicate email error, got: ${(error as { message: string }).message}`
      );
    }
  );

  await t.test(
    "2.4 Contact creation blocked under archived company",
    async () => {
      // Archive company B
      await adminUser.client.rpc("archive_company", {
        p_company_id: companyBId,
      });

      const { error } = await secUser.client.rpc("create_recruiter_contact", {
        p_company_id: companyBId,
        p_full_name: "Rejected Contact",
        p_email: "archived_contact_test@company.test",
        p_phone: undefined,
        p_designation: undefined,
      });

      assert.ok(error, "Cannot add contacts to archived company");
      assert.ok(
        (error as { message: string }).message.includes("archived company"),
        `Expected archived company error, got: ${(error as { message: string }).message}`
      );

      // Reactivate company B for subsequent tests
      await adminUser.client.rpc("reactivate_company", {
        p_company_id: companyBId,
      });
    }
  );

  await t.test(
    "2.5 Coordinator cannot create, update, or deactivate recruiter contacts",
    async () => {
      const { error: createErr } = await coordUser.client.rpc(
        "create_recruiter_contact",
        {
          p_company_id: companyAId,
          p_full_name: "Unauthorized Contact",
          p_email: "coord_contact@test.com",
          p_phone: undefined,
          p_designation: undefined,
        }
      );
      assert.ok(createErr, "Coordinator must not create recruiter contacts");

      const { error: deactErr } = await coordUser.client.rpc(
        "deactivate_recruiter_contact",
        {
          p_contact_id: contactAId,
        }
      );
      assert.ok(deactErr, "Coordinator must not deactivate recruiter contacts");
    }
  );

  await t.test(
    "2.6 Deactivating contact blocks invitation creation",
    async () => {
      // Deactivate contact A
      const { error: deactErr } = await secUser.client.rpc(
        "deactivate_recruiter_contact",
        {
          p_contact_id: contactAId,
        }
      );
      assert.ifError(deactErr);

      // Attempt invitation
      const { error: invErr } = await secUser.client.rpc(
        "create_recruiter_invitation",
        {
          p_contact_id: contactAId,
        }
      );
      assert.ok(invErr, "Cannot invite inactive recruiter contact");
      assert.ok(
        (invErr as { message: string }).message.includes("inactive"),
        `Expected inactive contact error, got: ${(invErr as { message: string }).message}`
      );

      // Reactivate contact A
      const { error: reactErr } = await secUser.client.rpc(
        "reactivate_recruiter_contact",
        {
          p_contact_id: contactAId,
        }
      );
      assert.ifError(reactErr);
    }
  );

  // --------------------------------------------------------------------------
  // 3. Recruiter Invitation Lifecycle Tests
  // --------------------------------------------------------------------------
  let invitationAId: string = "";

  await t.test(
    "3.1 Super Admin sends invitation to contact A (7-day expiry verified)",
    async () => {
      const { data, error } = (await adminUser.client.rpc(
        "create_recruiter_invitation",
        { p_contact_id: contactAId }
      )) as { data: RpcInvitationResponse | null; error: unknown };

      assert.ifError(error);
      assert.ok(data?.invitation_id);
      invitationAId = data.invitation_id;

      // Verify invitation in DB
      const { data: inv } = await admin
        .from("recruiter_invitations")
        .select(
          "status, invited_at, expires_at, recruiter_contact_id, invited_by"
        )
        .eq("id", invitationAId)
        .single();

      assert.equal(inv?.status, "PENDING");
      assert.equal(inv?.recruiter_contact_id, contactAId);
      assert.equal(inv?.invited_by, adminUser.id);

      const invitedAt = new Date(inv!.invited_at).getTime();
      const expiresAt = new Date(inv!.expires_at).getTime();
      const diffDays = Math.round(
        (expiresAt - invitedAt) / (1000 * 60 * 60 * 24)
      );
      assert.equal(
        diffDays,
        7,
        "Invitation must expire exactly 7 days from invited_at"
      );
    }
  );

  await t.test("3.2 Duplicate pending invitation is rejected", async () => {
    const { error } = await secUser.client.rpc("create_recruiter_invitation", {
      p_contact_id: contactAId,
    });

    assert.ok(
      error,
      "Cannot create second pending invitation for same contact"
    );
    assert.ok(
      (error as { message: string }).message.includes(
        "pending invitation already exists"
      ) || (error as { message: string }).message.includes("active pending"),
      `Expected active pending error, got: ${(error as { message: string }).message}`
    );
  });

  await t.test(
    "3.3 Coordinator cannot create or revoke invitations",
    async () => {
      const { error: invErr } = await coordUser.client.rpc(
        "create_recruiter_invitation",
        {
          p_contact_id: contactBId,
        }
      );
      assert.ok(invErr, "Coordinator must not invite contacts");

      const { error: revErr } = await coordUser.client.rpc(
        "revoke_recruiter_invitation",
        {
          p_invitation_id: invitationAId,
        }
      );
      assert.ok(revErr, "Coordinator must not revoke invitations");
    }
  );

  await t.test(
    "3.4 Secretary revokes invitation and re-inviting succeeds",
    async () => {
      // Revoke invitation
      const { data: revData, error: revErr } = (await secUser.client.rpc(
        "revoke_recruiter_invitation",
        { p_invitation_id: invitationAId }
      )) as { data: RpcInvitationResponse | null; error: unknown };

      assert.ifError(revErr);
      assert.equal(revData?.status, "REVOKED");

      // Verify in db
      const { data: inv } = await admin
        .from("recruiter_invitations")
        .select("status, revoked_by, revoked_at")
        .eq("id", invitationAId)
        .single();

      assert.equal(inv?.status, "REVOKED");
      assert.equal(inv?.revoked_by, secUser.id);
      assert.ok(inv?.revoked_at);

      // Re-invite contact A
      const { data: newInv, error: newInvErr } = (await secUser.client.rpc(
        "create_recruiter_invitation",
        { p_contact_id: contactAId }
      )) as { data: RpcInvitationResponse | null; error: unknown };

      assert.ifError(newInvErr);
      assert.ok(newInv?.invitation_id);
      invitationAId = newInv.invitation_id;
    }
  );

  await t.test(
    "3.5 Expired pending invitation is superseded on re-invitation",
    async () => {
      // Simulate expired invitation by shifting invited_at and expires_at backwards in db
      const eightDaysAgo = new Date(
        Date.now() - 8 * 24 * 60 * 60 * 1000
      ).toISOString();
      const oneDayAgo = new Date(
        Date.now() - 1 * 24 * 60 * 60 * 1000
      ).toISOString();

      const { error: updateErr } = await admin
        .from("recruiter_invitations")
        .update({
          invited_at: eightDaysAgo,
          expires_at: oneDayAgo,
        })
        .eq("id", invitationAId);

      assert.ifError(updateErr);

      // Now re-inviting contact A should supersede the expired one
      const { data: freshInv, error: freshErr } = (await secUser.client.rpc(
        "create_recruiter_invitation",
        { p_contact_id: contactAId }
      )) as { data: RpcInvitationResponse | null; error: unknown };

      assert.ifError(freshErr);
      assert.ok(freshInv?.invitation_id);
      assert.notEqual(freshInv.invitation_id, invitationAId);

      // Old invitation must now be marked EXPIRED
      const { data: oldInv } = await admin
        .from("recruiter_invitations")
        .select("status")
        .eq("id", invitationAId)
        .single();

      assert.equal(oldInv?.status, "EXPIRED");
      invitationAId = freshInv.invitation_id;
    }
  );

  await t.test(
    "3.6 Compensating rollback cleans up DB row if downstream auth delivery fails",
    async () => {
      // 1. Create a transient contact
      const { data: transContact, error: transErr } = (await secUser.client.rpc(
        "create_recruiter_contact",
        {
          p_company_id: companyBId,
          p_full_name: "Transient Recruiter",
          p_email: "transient_recruiter@company-beta.test",
          p_phone: undefined,
          p_designation: undefined,
        }
      )) as { data: RpcContactResponse | null; error: unknown };
      assert.ifError(transErr);
      const transContactId = transContact!.contact_id!;

      // 2. Create pending invitation
      const { data: invRes, error: invErr } = (await secUser.client.rpc(
        "create_recruiter_invitation",
        { p_contact_id: transContactId }
      )) as { data: RpcInvitationResponse | null; error: unknown };
      assert.ifError(invErr);
      const transientInvId = invRes!.invitation_id!;

      // 3. Simulate downstream delivery failure -> execute compensating revoke
      const { data: compRevData, error: compRevErr } =
        (await secUser.client.rpc("revoke_recruiter_invitation", {
          p_invitation_id: transientInvId,
        })) as { data: RpcInvitationResponse | null; error: unknown };
      assert.ifError(compRevErr);
      assert.equal(compRevData?.status, "REVOKED");

      // 4. Verify no pending invitation exists and contact can be safely re-invited
      const { data: pendingCheck } = await admin
        .from("recruiter_invitations")
        .select("id")
        .eq("recruiter_contact_id", transContactId)
        .eq("status", "PENDING");
      assert.equal(
        pendingCheck?.length,
        0,
        "No pending invitation should remain after compensation"
      );

      // 5. Verify retry succeeds
      const { data: retryInv, error: retryErr } = (await secUser.client.rpc(
        "create_recruiter_invitation",
        { p_contact_id: transContactId }
      )) as { data: RpcInvitationResponse | null; error: unknown };
      assert.ifError(retryErr);
      assert.ok(retryInv?.invitation_id);
    }
  );

  await t.test(
    "3.7 Concurrent invitation creation race: exactly one succeeds, other fails safely",
    async () => {
      // 1. Create a transient contact
      const { data: concContact, error: concErr } = (await secUser.client.rpc(
        "create_recruiter_contact",
        {
          p_company_id: companyBId,
          p_full_name: "Concurrent Recruiter",
          p_email: "concurrent_recruiter@company-beta.test",
          p_phone: undefined,
          p_designation: undefined,
        }
      )) as { data: RpcContactResponse | null; error: unknown };
      assert.ifError(concErr);
      const concContactId = concContact!.contact_id!;

      // 2. Fire two invitation creations concurrently
      const results = await Promise.allSettled([
        secUser.client.rpc("create_recruiter_invitation", {
          p_contact_id: concContactId,
        }),
        secUser.client.rpc("create_recruiter_invitation", {
          p_contact_id: concContactId,
        }),
      ]);

      const fulfilled = results.filter(
        (r) =>
          r.status === "fulfilled" && !(r.value as { error: unknown }).error
      );
      const rejected = results.filter(
        (r) =>
          r.status === "rejected" ||
          (r.status === "fulfilled" &&
            Boolean((r.value as { error: unknown }).error))
      );

      assert.equal(
        fulfilled.length,
        1,
        "Exactly one concurrent invitation must succeed"
      );
      assert.equal(
        rejected.length,
        1,
        "The second concurrent invitation must fail safely"
      );
    }
  );

  // --------------------------------------------------------------------------
  // 4. Recruiter Acceptance & Identity Binding Tests
  // --------------------------------------------------------------------------
  await t.test(
    "4.1 Institutional user (STUDENT) cannot accept recruiter invitation",
    async () => {
      const { error } = await studentUser.client.rpc(
        "accept_recruiter_invitation"
      );
      assert.ok(error, "Student profile cannot accept recruiter invitation");
      assert.ok(
        (error as { message: string }).message.includes("institutional role") ||
          (error as { message: string }).message.includes("conflicting role"),
        `Expected institutional role conflict, got: ${(error as { message: string }).message}`
      );
    }
  );

  await t.test(
    "4.2 Non-matching email caller cannot accept recruiter invitation",
    async () => {
      const mismatchUser = await getAuthenticatedClient(recruiterMismatchEmail);
      const { error } = await mismatchUser.client.rpc(
        "accept_recruiter_invitation"
      );
      assert.ok(error, "Uninvited email cannot accept invitation");
      assert.ok(
        (error as { message: string }).message.includes(
          "No recruiter contact found"
        ) ||
          (error as { message: string }).message.includes(
            "No pending recruiter invitation"
          ),
        `Expected no contact or no pending invitation error, got: ${(error as { message: string }).message}`
      );
    }
  );

  let recruiterAUser: {
    id: string;
    client: ReturnType<typeof createClient<Database>>;
  };

  await t.test(
    "4.2b Unconfirmed invitation (delivery_confirmed_at IS NULL) cannot be accepted (unsent-pending protection)",
    async () => {
      recruiterAUser = await getAuthenticatedClient(recruiterAEmail);

      const { error } = await recruiterAUser.client.rpc(
        "accept_recruiter_invitation"
      );
      assert.ok(
        error,
        "Acceptance must fail if onboarding delivery is not confirmed"
      );
      assert.ok(
        (error as { message: string }).message.includes(
          "onboarding delivery has not been confirmed"
        ),
        `Expected unconfirmed delivery error, got: ${(error as { message: string }).message}`
      );
    }
  );

  await t.test(
    "4.3 Valid recruiter signs in and accepts invitation atomically once delivery is confirmed",
    async () => {
      recruiterAUser = await getAuthenticatedClient(recruiterAEmail);

      // Trusted server marks invitation delivery confirmed
      const { error: confErr } = await admin.rpc(
        "mark_invitation_delivery_confirmed",
        { p_invitation_id: invitationAId }
      );
      assert.ifError(confErr);

      const { data, error } = (await recruiterAUser.client.rpc(
        "accept_recruiter_invitation"
      )) as { data: RpcAcceptResponse | null; error: unknown };

      assert.ifError(error);
      assert.equal(data?.company_name, "Alpha Studio International");
      assert.equal(data?.company_id, companyAId);
      assert.equal(data?.contact_id, contactAId);

      // Verify profiles.role upgraded to RECRUITER
      const { data: prof } = await admin
        .from("profiles")
        .select("role, is_active, display_name")
        .eq("id", recruiterAUser.id)
        .single();

      assert.equal(prof?.role, "RECRUITER");
      assert.equal(prof?.is_active, true);
      assert.equal(prof?.display_name, "Alice Recruiter Alpha");

      // Verify recruiter_profiles binding row
      const { data: recProf } = await admin
        .from("recruiter_profiles")
        .select("profile_id, recruiter_contact_id, company_id")
        .eq("profile_id", recruiterAUser.id)
        .single();

      assert.equal(recProf?.recruiter_contact_id, contactAId);
      assert.equal(recProf?.company_id, companyAId);

      // Verify recruiter_invitations row is ACCEPTED
      const { data: inv } = await admin
        .from("recruiter_invitations")
        .select("status, accepted_at")
        .eq("id", invitationAId)
        .single();

      assert.equal(inv?.status, "ACCEPTED");
      assert.ok(inv?.accepted_at);
    }
  );

  await t.test(
    "4.4 Replay attack: calling accept_recruiter_invitation again fails",
    async () => {
      const { error } = await recruiterAUser.client.rpc(
        "accept_recruiter_invitation"
      );
      assert.ok(error, "Second acceptance must be rejected");
      assert.ok(
        (error as { message: string }).message.includes("bound") ||
          (error as { message: string }).message.includes("already accepted") ||
          (error as { message: string }).message.includes(
            "No pending recruiter invitation"
          ),
        `Expected already bound error, got: ${(error as { message: string }).message}`
      );
    }
  );

  await t.test(
    "4.5 Contact cannot be invited again once bound to an active profile",
    async () => {
      const { error } = await secUser.client.rpc(
        "create_recruiter_invitation",
        {
          p_contact_id: contactAId,
        }
      );

      assert.ok(error, "Bound recruiter contact cannot be re-invited");
      assert.ok(
        (error as { message: string }).message.includes("bound") ||
          (error as { message: string }).message.includes("already accepted"),
        `Expected already bound error, got: ${(error as { message: string }).message}`
      );
    }
  );

  await t.test(
    "4.6 Revoked invitation cannot be accepted even by authenticated valid contact",
    async () => {
      // 1. Create contact
      const { data: revContact, error: revCErr } = (await secUser.client.rpc(
        "create_recruiter_contact",
        {
          p_company_id: companyAId,
          p_full_name: "Revoked Recruiter",
          p_email: recruiterRevokedEmail,
          p_phone: undefined,
          p_designation: undefined,
        }
      )) as { data: RpcContactResponse | null; error: unknown };
      assert.ifError(revCErr);
      const revContactId = revContact!.contact_id!;

      // 2. Create invitation
      const { data: revInv, error: revIErr } = (await secUser.client.rpc(
        "create_recruiter_invitation",
        { p_contact_id: revContactId }
      )) as { data: RpcInvitationResponse | null; error: unknown };
      assert.ifError(revIErr);
      const revInvId = revInv!.invitation_id!;

      // 3. Revoke invitation
      const { error: revErr } = await secUser.client.rpc(
        "revoke_recruiter_invitation",
        { p_invitation_id: revInvId }
      );
      assert.ifError(revErr);

      // 4. Authenticate caller with that email
      const revokedUser = await getAuthenticatedClient(recruiterRevokedEmail);

      // 5. Attempt accept_recruiter_invitation
      const { error: acceptErr } = await revokedUser.client.rpc(
        "accept_recruiter_invitation"
      );
      assert.ok(acceptErr, "Revoked invitation must not be accepted");
      assert.ok(
        (acceptErr as { message: string }).message.includes("No pending") ||
          (acceptErr as { message: string }).message.includes("revoked"),
        `Expected no pending or revoked error, got: ${(acceptErr as { message: string }).message}`
      );
    }
  );

  await t.test(
    "4.7 Case B: Existing auth user with no application profile accepts invitation successfully",
    async () => {
      // 1. Pre-create auth user directly (no row in profiles table)
      const freshCaseBEmail = `phase6_case_b_${Date.now()}@company-alpha.test`;
      const caseBUser = await getAuthenticatedClient(freshCaseBEmail);

      const { data: noProfCheck } = await admin
        .from("profiles")
        .select("id")
        .eq("id", caseBUser.id)
        .maybeSingle();
      assert.equal(
        noProfCheck,
        null,
        "Precondition: auth user must have no profile row"
      );

      // 2. Staff creates recruiter contact for this email
      const { data: caseBContact, error: cErr } = (await secUser.client.rpc(
        "create_recruiter_contact",
        {
          p_company_id: companyAId,
          p_full_name: "Case B Recruiter",
          p_email: freshCaseBEmail,
          p_phone: "+91-9999888877",
          p_designation: "Principal Partner",
        }
      )) as { data: RpcContactResponse | null; error: unknown };
      assert.ifError(cErr);
      const caseBContactId = caseBContact!.contact_id!;

      // 3. Staff creates invitation
      const { data: caseBInv, error: invErr } = (await secUser.client.rpc(
        "create_recruiter_invitation",
        { p_contact_id: caseBContactId }
      )) as { data: RpcInvitationResponse | null; error: unknown };
      assert.ifError(invErr);
      assert.ok(caseBInv?.invitation_id);

      // Trusted server marks delivery confirmed
      const { error: confErr } = await admin.rpc(
        "mark_invitation_delivery_confirmed",
        { p_invitation_id: caseBInv.invitation_id }
      );
      assert.ifError(confErr);

      // 4. Case B user calls accept_recruiter_invitation
      const { data: acceptData, error: acceptErr } =
        (await caseBUser.client.rpc("accept_recruiter_invitation")) as {
          data: RpcAcceptResponse | null;
          error: unknown;
        };

      assert.ifError(acceptErr);
      assert.equal(acceptData?.company_id, companyAId);
      assert.equal(acceptData?.contact_id, caseBContactId);

      // 5. Verify profiles row now exists with RECRUITER role
      const { data: newProf } = await admin
        .from("profiles")
        .select("role, is_active, display_name")
        .eq("id", caseBUser.id)
        .single();
      assert.equal(newProf?.role, "RECRUITER");
      assert.equal(newProf?.is_active, true);
      assert.equal(newProf?.display_name, "Case B Recruiter");

      // 6. Verify recruiter_profiles binding
      const { data: recProf } = await admin
        .from("recruiter_profiles")
        .select("company_id, recruiter_contact_id")
        .eq("profile_id", caseBUser.id)
        .single();
      assert.equal(recProf?.company_id, companyAId);
      assert.equal(recProf?.recruiter_contact_id, caseBContactId);
    }
  );

  await t.test(
    "4.8 Generic Auth failure with compensation failure leaves unconfirmed PENDING row: acceptance still denied",
    async () => {
      const unconfirmedEmail = `phase6_unconfirmed_${Date.now()}@company-alpha.test`;
      // 1. Create contact
      const { data: uContact, error: uErr } = (await secUser.client.rpc(
        "create_recruiter_contact",
        {
          p_company_id: companyAId,
          p_full_name: "Unconfirmed Recruiter",
          p_email: unconfirmedEmail,
          p_phone: undefined,
          p_designation: undefined,
        }
      )) as { data: RpcContactResponse | null; error: unknown };
      assert.ifError(uErr);
      const uContactId = uContact!.contact_id!;

      // 2. Create DB invitation (status = PENDING, delivery_confirmed_at = NULL)
      const { error: uInvErr } = (await secUser.client.rpc(
        "create_recruiter_invitation",
        { p_contact_id: uContactId }
      )) as { data: RpcInvitationResponse | null; error: unknown };
      assert.ifError(uInvErr);

      // 3. User authenticates
      const uUser = await getAuthenticatedClient(unconfirmedEmail);

      // 4. Acceptance attempted against unconfirmed PENDING row
      const { error: acceptErr } = await uUser.client.rpc(
        "accept_recruiter_invitation"
      );
      assert.ok(
        acceptErr,
        "Acceptance must fail on unconfirmed pending invitation"
      );
      assert.ok(
        (acceptErr as { message: string }).message.includes(
          "onboarding delivery has not been confirmed"
        ),
        `Expected unconfirmed delivery error, got: ${(acceptErr as { message: string }).message}`
      );
    }
  );

  // --------------------------------------------------------------------------
  // 5. RLS Isolation & Recruiter Boundary Tests
  // --------------------------------------------------------------------------
  await t.test(
    "5.1 Recruiter can read own company and own contact only",
    async () => {
      // Companies query
      const { data: companies, error: compErr } = await recruiterAUser.client
        .from("companies")
        .select("id, name");

      assert.ifError(compErr);
      assert.equal(
        companies?.length,
        1,
        "Recruiter must see exactly 1 company (own)"
      );
      assert.equal(companies?.[0]?.id, companyAId);

      // Recruiter contacts query
      const { data: contacts, error: contErr } = await recruiterAUser.client
        .from("recruiter_contacts")
        .select("id, full_name");

      assert.ifError(contErr);
      assert.equal(
        contacts?.length,
        1,
        "Recruiter must see only contacts from own company"
      );
      assert.equal(contacts?.[0]?.id, contactAId);

      // Recruiter profile query
      const { data: recProfiles, error: recProfErr } =
        await recruiterAUser.client
          .from("recruiter_profiles")
          .select("id, company_id, recruiter_contact_id");

      assert.ifError(recProfErr);
      assert.equal(recProfiles?.length, 1, "Recruiter must see own profile");
      assert.equal(recProfiles?.[0]?.company_id, companyAId);
    }
  );

  await t.test(
    "5.1b Recruiter cannot see other recruiter contacts at the SAME company (contact privacy)",
    async () => {
      // 1. Create a second contact under Company A
      const { data: contactA2, error: c2Err } = (await secUser.client.rpc(
        "create_recruiter_contact",
        {
          p_company_id: companyAId,
          p_full_name: "Aaron Second Recruiter",
          p_email: recruiterA2Email,
          p_phone: "+91-9876500000",
          p_designation: "Technical Sourcer",
        }
      )) as { data: RpcContactResponse | null; error: unknown };
      assert.ifError(c2Err);
      const contactA2Id = contactA2!.contact_id!;

      // 2. Recruiter A queries recruiter_contacts list
      const { data: contacts, error: contErr } = await recruiterAUser.client
        .from("recruiter_contacts")
        .select("id, full_name, email, phone");

      assert.ifError(contErr);
      assert.equal(
        contacts?.length,
        1,
        "Recruiter must see only their own contact, never other contacts at the same company"
      );
      assert.equal(contacts?.[0]?.id, contactAId);

      // 3. Recruiter A attempts direct query for contact A2 by id
      const { data: a2Query } = await recruiterAUser.client
        .from("recruiter_contacts")
        .select("id, email, phone")
        .eq("id", contactA2Id);

      assert.equal(
        a2Query?.length || 0,
        0,
        "Direct query for colleague contact must return 0 rows"
      );
    }
  );

  await t.test(
    "5.1c Recruiter receives 0 rows from recruiter_invitations table directly",
    async () => {
      const { data: invitations, error: invErr } = await recruiterAUser.client
        .from("recruiter_invitations")
        .select("*");

      assert.ifError(invErr);
      assert.equal(
        invitations?.length || 0,
        0,
        "Recruiter must receive 0 rows from direct recruiter_invitations query"
      );
    }
  );

  await t.test(
    "5.2 Recruiter cannot mutate companies or contacts directly",
    async () => {
      // Direct company update
      const { error: updateCompErr } = await recruiterAUser.client
        .from("companies")
        .update({ name: "Malicious Company Rename" })
        .eq("id", companyAId);

      assert.ok(
        updateCompErr,
        "Recruiter direct company update must fail RLS/grant"
      );

      // Direct contact update
      const { error: updateContErr } = await recruiterAUser.client
        .from("recruiter_contacts")
        .update({ full_name: "Hacked Contact" })
        .eq("id", contactAId);

      assert.ok(
        updateContErr,
        "Recruiter direct contact update must fail RLS/grant"
      );
    }
  );

  await t.test(
    "5.2b Browser/recruiter cannot mark invitation ready or execute admin helpers directly",
    async () => {
      // Direct call to mark_invitation_delivery_confirmed by authenticated recruiter
      const { error: rpcErr } = await recruiterAUser.client.rpc(
        "mark_invitation_delivery_confirmed",
        { p_invitation_id: invitationAId }
      );
      assert.ok(
        rpcErr,
        "Recruiter must not execute mark_invitation_delivery_confirmed"
      );

      // Direct call to is_admin_or_secretary by authenticated recruiter
      const { error: helperErr } = await recruiterAUser.client.rpc(
        "is_admin_or_secretary"
      );
      assert.ok(
        helperErr,
        "Recruiter must not execute is_admin_or_secretary helper directly"
      );

      // Direct UPDATE on recruiter_invitations table
      const { error: updateErr } = await recruiterAUser.client
        .from("recruiter_invitations")
        .update({ delivery_confirmed_at: new Date().toISOString() })
        .eq("id", invitationAId);
      assert.ok(
        updateErr,
        "Direct UPDATE on recruiter_invitations must fail RLS/grants"
      );
    }
  );

  await t.test(
    "5.3 Recruiter has ZERO access to student private data (Confidentiality Shield)",
    async () => {
      // Student profiles query
      const { data: studentProfiles } = await recruiterAUser.client
        .from("student_profiles")
        .select("*");
      assert.equal(
        studentProfiles?.length || 0,
        0,
        "Recruiter must receive 0 student_profiles rows"
      );

      // Student academic records query
      const { data: academicRecords } = await recruiterAUser.client
        .from("academic_records")
        .select("*");
      assert.equal(
        academicRecords?.length || 0,
        0,
        "Recruiter must receive 0 academic_records rows"
      );

      // Student documents / resumes query
      const { data: resumes } = await recruiterAUser.client
        .from("documents")
        .select("*");
      assert.equal(
        resumes?.length || 0,
        0,
        "Recruiter must receive 0 documents rows"
      );

      // Student skills query
      const { data: skills } = await recruiterAUser.client
        .from("student_skills")
        .select("*");
      assert.equal(
        skills?.length || 0,
        0,
        "Recruiter must receive 0 student_skills rows"
      );

      // Student skill evidence query
      const { data: evidence } = await recruiterAUser.client
        .from("student_skill_evidence")
        .select("*");
      assert.equal(
        evidence?.length || 0,
        0,
        "Recruiter must receive 0 student_skill_evidence rows"
      );

      // Audit logs query
      const { data: auditLogs } = await recruiterAUser.client
        .from("audit_logs")
        .select("*");
      assert.equal(
        auditLogs?.length || 0,
        0,
        "Recruiter must receive 0 audit_logs rows"
      );

      // Profiles query filtered for students
      const { data: studentUserProfiles } = await recruiterAUser.client
        .from("profiles")
        .select("id, role")
        .eq("role", "STUDENT");
      assert.equal(
        studentUserProfiles?.length || 0,
        0,
        "Recruiter must receive 0 student user profiles"
      );
    }
  );

  await t.test(
    "5.4 Student has ZERO access to CRM tables (default-deny)",
    async () => {
      // Student queries companies
      const { data: companies } = await studentUser.client
        .from("companies")
        .select("*");
      assert.equal(
        companies?.length || 0,
        0,
        "Student must receive 0 companies rows"
      );

      // Student queries recruiter_contacts
      const { data: contacts } = await studentUser.client
        .from("recruiter_contacts")
        .select("*");
      assert.equal(
        contacts?.length || 0,
        0,
        "Student must receive 0 recruiter_contacts rows"
      );

      // Student queries recruiter_invitations
      const { data: invitations } = await studentUser.client
        .from("recruiter_invitations")
        .select("*");
      assert.equal(
        invitations?.length || 0,
        0,
        "Student must receive 0 recruiter_invitations rows"
      );

      // Student queries recruiter_profiles
      const { data: profiles } = await studentUser.client
        .from("recruiter_profiles")
        .select("*");
      assert.equal(
        profiles?.length || 0,
        0,
        "Student must receive 0 recruiter_profiles rows"
      );
    }
  );

  // --------------------------------------------------------------------------
  // 6. Phase 7 Default-Deny Preservation Tests
  // --------------------------------------------------------------------------
  await t.test(
    "6.1 Phase 7 placement drives and applications are default-deny for all roles",
    async () => {
      // Recruiter queries placement_drives
      const { data: recDrives } = await recruiterAUser.client
        .from("placement_drives")
        .select("*");
      assert.equal(
        recDrives?.length || 0,
        0,
        "Recruiter must receive 0 placement_drives rows"
      );

      // Recruiter queries applications
      const { data: recApps } = await recruiterAUser.client
        .from("applications")
        .select("*");
      assert.equal(
        recApps?.length || 0,
        0,
        "Recruiter must receive 0 applications rows"
      );

      // Student queries placement_drives
      const { data: stuDrives } = await studentUser.client
        .from("placement_drives")
        .select("*");
      assert.equal(
        stuDrives?.length || 0,
        0,
        "Student must receive 0 placement_drives rows"
      );

      // Student queries applications
      const { data: stuApps } = await studentUser.client
        .from("applications")
        .select("*");
      assert.equal(
        stuApps?.length || 0,
        0,
        "Student must receive 0 applications rows"
      );
    }
  );
});
