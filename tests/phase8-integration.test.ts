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

interface DriveCreateRpcResult {
  success: boolean;
  drive_id: string;
}

interface ApplyRpcResult {
  success: boolean;
  application_id: string;
  status?: string;
  transition_sequence?: number;
}

interface WithdrawRpcResult {
  success: boolean;
  status: string;
  application_id?: string;
  transition_sequence?: number;
}

interface TransitionRpcResult {
  success: boolean;
  previous_status: string;
  new_status: string;
  application_id?: string;
  transition_sequence?: number;
}

interface CorrectRpcResult {
  success: boolean;
  restored_status: string;
  previous_status?: string;
  application_id?: string;
  transition_sequence?: number;
}

interface EligibilityRpcResult {
  drive_id: string;
  is_eligible: boolean;
  academic_result: string;
  reason_codes: string[];
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test("Phase 8 Applications, Status Machine, Append-Only History & Admin Recovery Suite", async (t) => {
  // --------------------------------------------------------------------------
  // Setup Fixture Identifiers & Accounts
  // --------------------------------------------------------------------------
  const adminId = "10000000-0000-0000-0000-000000000001";
  const coordId = "30000000-0000-0000-0000-000000000001";

  // Students
  const sAliceId = "40000000-0000-0000-0000-000000000001"; // BARCH 2026, 8.5 CGPA, 0 backlogs (PASS)
  const sJackId = "40000000-0000-0000-0000-000000000010"; // BARCH 2026, Prior Selected Internship

  // Companies
  const companyAcmeId = "60000000-0000-0000-0000-000000000001";

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

  // Seed Coordinator student scope for BARCH 2026
  await admin.from("coordinator_student_scopes").upsert(
    {
      coordinator_id: coordId,
      program_id: barchProg.id,
      batch: "2026",
      granted_by: adminId,
    },
    { onConflict: "coordinator_id,program_id,batch" }
  );

  // Authenticate helper
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
  const clientIvy = await createClientForUser("phase7_ivy@vnit.test");
  const clientJack = await createClientForUser("phase7_jack@vnit.test");
  const clientRecAcme = await createClientForUser("phase7_recruiter@acme.test");

  const anonClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Track drive IDs for test assertions
  let pubDriveId: string = "";
  let draftDriveId: string = "";
  let closedDriveId: string = "";
  let archivedDriveId: string = "";
  let expiredDriveId: string = "";
  let secondDriveId: string = "";

  // Set up Drives & Eligibility via Secretary / Coordinator
  const setupDrives = async () => {
    // 1. Main Published Drive (Open for 30 days)
    const { data: d1 } = await clientCoord.rpc("create_placement_drive", {
      p_company_id: companyAcmeId,
      p_title: "Phase 8 Main Architecture Drive 2026",
      p_drive_type: "PLACEMENT",
      p_application_deadline: new Date(
        Date.now() + 30 * 86400000
      ).toISOString(),
    });
    pubDriveId = (d1 as unknown as DriveCreateRpcResult).drive_id;

    await clientCoord.rpc("configure_drive_eligibility", {
      p_drive_id: pubDriveId,
      p_minimum_cgpa: 7.0,
      p_maximum_active_backlogs: 0,
      p_exclude_previously_selected_placement: true,
    });
    await clientCoord.rpc("configure_drive_eligible_batches", {
      p_drive_id: pubDriveId,
      p_batches: [{ program_id: barchProg.id, batch: "2026" }],
    });
    await clientSec.rpc("publish_placement_drive", { p_drive_id: pubDriveId });

    // 2. Draft Drive
    const { data: d2 } = await clientCoord.rpc("create_placement_drive", {
      p_company_id: companyAcmeId,
      p_title: "Phase 8 Draft Only Drive",
      p_drive_type: "PLACEMENT",
      p_application_deadline: new Date(
        Date.now() + 30 * 86400000
      ).toISOString(),
    });
    draftDriveId = (d2 as unknown as DriveCreateRpcResult).drive_id;
    await clientCoord.rpc("configure_drive_eligibility", {
      p_drive_id: draftDriveId,
      p_minimum_cgpa: 6.0,
      p_maximum_active_backlogs: 1,
    });
    await clientCoord.rpc("configure_drive_eligible_batches", {
      p_drive_id: draftDriveId,
      p_batches: [{ program_id: barchProg.id, batch: "2026" }],
    });

    // 3. Closed Drive
    const { data: d3 } = await clientCoord.rpc("create_placement_drive", {
      p_company_id: companyAcmeId,
      p_title: "Phase 8 Closed Drive",
      p_drive_type: "PLACEMENT",
      p_application_deadline: new Date(
        Date.now() + 10 * 86400000
      ).toISOString(),
    });
    closedDriveId = (d3 as unknown as DriveCreateRpcResult).drive_id;
    await clientCoord.rpc("configure_drive_eligibility", {
      p_drive_id: closedDriveId,
      p_minimum_cgpa: 6.0,
      p_maximum_active_backlogs: 1,
    });
    await clientCoord.rpc("configure_drive_eligible_batches", {
      p_drive_id: closedDriveId,
      p_batches: [{ program_id: barchProg.id, batch: "2026" }],
    });
    await clientSec.rpc("publish_placement_drive", {
      p_drive_id: closedDriveId,
    });
    await clientSec.rpc("close_placement_drive", { p_drive_id: closedDriveId });

    // 4. Archived Drive
    const { data: d4 } = await clientCoord.rpc("create_placement_drive", {
      p_company_id: companyAcmeId,
      p_title: "Phase 8 Archived Drive",
      p_drive_type: "PLACEMENT",
      p_application_deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
    });
    archivedDriveId = (d4 as unknown as DriveCreateRpcResult).drive_id;
    await clientCoord.rpc("configure_drive_eligibility", {
      p_drive_id: archivedDriveId,
      p_minimum_cgpa: 6.0,
      p_maximum_active_backlogs: 1,
    });
    await clientCoord.rpc("configure_drive_eligible_batches", {
      p_drive_id: archivedDriveId,
      p_batches: [{ program_id: barchProg.id, batch: "2026" }],
    });
    await clientSec.rpc("publish_placement_drive", {
      p_drive_id: archivedDriveId,
    });
    await clientSec.rpc("close_placement_drive", {
      p_drive_id: archivedDriveId,
    });
    await clientAdmin.rpc("archive_placement_drive", {
      p_drive_id: archivedDriveId,
    });

    // 5. Expired Drive (Published with past deadline)
    // Directly update deadline in DB as admin
    const { data: d5 } = await clientCoord.rpc("create_placement_drive", {
      p_company_id: companyAcmeId,
      p_title: "Phase 8 Expired Drive",
      p_drive_type: "PLACEMENT",
      p_application_deadline: new Date(Date.now() + 86400000).toISOString(),
    });
    expiredDriveId = (d5 as unknown as DriveCreateRpcResult).drive_id;
    await clientCoord.rpc("configure_drive_eligibility", {
      p_drive_id: expiredDriveId,
      p_minimum_cgpa: 6.0,
      p_maximum_active_backlogs: 1,
    });
    await clientCoord.rpc("configure_drive_eligible_batches", {
      p_drive_id: expiredDriveId,
      p_batches: [{ program_id: barchProg.id, batch: "2026" }],
    });
    await clientSec.rpc("publish_placement_drive", {
      p_drive_id: expiredDriveId,
    });
    // Backdate deadline
    await admin
      .from("placement_drives")
      .update({
        application_deadline: new Date(Date.now() - 3600000).toISOString(),
      })
      .eq("id", expiredDriveId);

    // 6. Second Exclusive Placement Drive (for downstream reactive testing)
    const { data: d6 } = await clientCoord.rpc("create_placement_drive", {
      p_company_id: companyAcmeId,
      p_title: "Phase 8 Second Exclusive Placement Drive 2026",
      p_drive_type: "PLACEMENT",
      p_application_deadline: new Date(
        Date.now() + 30 * 86400000
      ).toISOString(),
    });
    secondDriveId = (d6 as unknown as DriveCreateRpcResult).drive_id;
    await clientCoord.rpc("configure_drive_eligibility", {
      p_drive_id: secondDriveId,
      p_minimum_cgpa: 7.0,
      p_maximum_active_backlogs: 0,
      p_exclude_previously_selected_placement: true,
    });
    await clientCoord.rpc("configure_drive_eligible_batches", {
      p_drive_id: secondDriveId,
      p_batches: [{ program_id: barchProg.id, batch: "2026" }],
    });
    await clientSec.rpc("publish_placement_drive", {
      p_drive_id: secondDriveId,
    });
  };

  await setupDrives();

  // Track Alice & Jack application IDs
  let aliceAppId: string = "";
  let jackAppId: string = "";

  // ==========================================================================
  // Section 1: Application Submission & Eligibility Boundary Matrix
  // ==========================================================================
  await t.test(
    "1.0a Student direct execution of private _evaluate_eligibility_for_student is denied",
    async () => {
      const { error } = await clientAlice.rpc(
        "_evaluate_eligibility_for_student" as unknown as "apply_to_drive",
        {
          p_student_id: sAliceId,
          p_drive_id: pubDriveId,
        } as unknown as { p_drive_id: string }
      );
      assert.ok(error);
      assert.match(error.message, /permission denied|not find|function/i);
    }
  );

  await t.test(
    "1.0b Student cannot spoof identity or apply on behalf of another student",
    async () => {
      // 1. PostgREST strictly rejects any attempt to inject extraneous student_id parameter
      const { error: spoofErr } = await clientBob.rpc("apply_to_drive", {
        p_drive_id: pubDriveId,
        p_student_id: sAliceId,
      } as unknown as { p_drive_id: string });
      assert.ok(spoofErr);
      assert.match(
        spoofErr.message,
        /Could not find the function public\.apply_to_drive.*p_student_id|not find.*schema cache/i
      );

      // 2. Legitimate call by Bob evaluates Bob's auth.uid() rather than any other student
      const { error: bobErr } = await clientBob.rpc("apply_to_drive", {
        p_drive_id: pubDriveId,
      });
      assert.ok(bobErr);
      assert.match(
        bobErr.message,
        /student does not meet eligibility criteria/i
      );
    }
  );

  await t.test("1.1 Anonymous call to apply_to_drive is rejected", async () => {
    const { error } = await anonClient.rpc("apply_to_drive", {
      p_drive_id: pubDriveId,
    });
    assert.ok(error);
  });

  await t.test("1.2 Recruiter call to apply_to_drive is rejected", async () => {
    const { error } = await clientRecAcme.rpc("apply_to_drive", {
      p_drive_id: pubDriveId,
    });
    assert.ok(error);
    assert.match(
      error.message,
      /Unauthorized: Only active students can apply/i
    );
  });

  await t.test(
    "1.3 Coordinator call to apply_to_drive is rejected",
    async () => {
      const { error } = await clientCoord.rpc("apply_to_drive", {
        p_drive_id: pubDriveId,
      });
      assert.ok(error);
      assert.match(
        error.message,
        /Unauthorized: Only active students can apply/i
      );
    }
  );

  await t.test("1.4 Apply to non-existent drive fails", async () => {
    const { error } = await clientAlice.rpc("apply_to_drive", {
      p_drive_id: "00000000-0000-0000-0000-000000000000",
    });
    assert.ok(error);
    assert.match(error.message, /Placement drive not found/i);
  });

  await t.test("1.5 Student apply to DRAFT drive fails", async () => {
    const { error } = await clientAlice.rpc("apply_to_drive", {
      p_drive_id: draftDriveId,
    });
    assert.ok(error);
    assert.match(error.message, /Cannot apply: drive status is DRAFT/i);
  });

  await t.test("1.6 Student apply to CLOSED drive fails", async () => {
    const { error } = await clientAlice.rpc("apply_to_drive", {
      p_drive_id: closedDriveId,
    });
    assert.ok(error);
    assert.match(error.message, /Cannot apply: drive status is CLOSED/i);
  });

  await t.test("1.7 Student apply to ARCHIVED drive fails", async () => {
    const { error } = await clientAlice.rpc("apply_to_drive", {
      p_drive_id: archivedDriveId,
    });
    assert.ok(error);
    assert.match(error.message, /Cannot apply: drive status is ARCHIVED/i);
  });

  await t.test(
    "1.8 Student apply to expired PUBLISHED drive fails",
    async () => {
      const { error } = await clientAlice.rpc("apply_to_drive", {
        p_drive_id: expiredDriveId,
      });
      assert.ok(error);
      assert.match(
        error.message,
        /Cannot apply: drive application deadline has passed/i
      );
    }
  );

  await t.test(
    "1.8b Strict deadline equality: apply at or after deadline is rejected",
    async () => {
      const { data: dDeadline } = await clientCoord.rpc(
        "create_placement_drive",
        {
          p_company_id: companyAcmeId,
          p_title: "Phase 8 Deadline Boundary Apply Test Drive",
          p_drive_type: "PLACEMENT",
          p_application_deadline: new Date(Date.now() + 86400000).toISOString(),
        }
      );
      const bDriveId = (dDeadline as unknown as DriveCreateRpcResult).drive_id;
      await clientCoord.rpc("configure_drive_eligibility", {
        p_drive_id: bDriveId,
        p_minimum_cgpa: 6.0,
        p_maximum_active_backlogs: 1,
      });
      await clientCoord.rpc("configure_drive_eligible_batches", {
        p_drive_id: bDriveId,
        p_batches: [{ program_id: barchProg.id, batch: "2026" }],
      });
      await clientSec.rpc("publish_placement_drive", { p_drive_id: bDriveId });

      // Backdate deadline to just 1 second in the past
      await admin
        .from("placement_drives")
        .update({
          application_deadline: new Date(Date.now() - 1000).toISOString(),
        })
        .eq("id", bDriveId);

      const { error } = await clientAlice.rpc("apply_to_drive", {
        p_drive_id: bDriveId,
      });
      assert.ok(error);
      assert.match(
        error.message,
        /Cannot apply: drive application deadline has passed/i
      );
    }
  );

  await t.test(
    "1.9 Ineligible Bob (wrong program: MPLAN) apply is rejected",
    async () => {
      const { error } = await clientBob.rpc("apply_to_drive", {
        p_drive_id: pubDriveId,
      });
      assert.ok(error);
      assert.match(
        error.message,
        /student does not meet eligibility criteria/i
      );
    }
  );

  await t.test(
    "1.10 Ineligible Charlie (wrong batch: 2025) apply is rejected",
    async () => {
      const { error } = await clientCharlie.rpc("apply_to_drive", {
        p_drive_id: pubDriveId,
      });
      assert.ok(error);
      assert.match(
        error.message,
        /student does not meet eligibility criteria/i
      );
    }
  );

  await t.test(
    "1.11 Ineligible Dave (5.5 CGPA, 3 backlogs) apply is rejected",
    async () => {
      const { error } = await clientDave.rpc("apply_to_drive", {
        p_drive_id: pubDriveId,
      });
      assert.ok(error);
      assert.match(
        error.message,
        /student does not meet eligibility criteria/i
      );
    }
  );

  await t.test(
    "1.12 Undetermined Eve (UNVERIFIED academic record) apply is rejected",
    async () => {
      const { error } = await clientEve.rpc("apply_to_drive", {
        p_drive_id: pubDriveId,
      });
      assert.ok(error);
      assert.match(
        error.message,
        /student does not meet eligibility criteria/i
      );
    }
  );

  await t.test(
    "1.13 Undetermined Frank (missing academic record) apply is rejected",
    async () => {
      const { error } = await clientFrank.rpc("apply_to_drive", {
        p_drive_id: pubDriveId,
      });
      assert.ok(error);
      assert.match(
        error.message,
        /student does not meet eligibility criteria/i
      );
    }
  );

  await t.test(
    "1.14 Ineligible Ivy (prior SELECTED on placement) apply is rejected",
    async () => {
      const { error } = await clientIvy.rpc("apply_to_drive", {
        p_drive_id: pubDriveId,
      });
      assert.ok(error);
      assert.match(
        error.message,
        /student does not meet eligibility criteria/i
      );
    }
  );

  await t.test(
    "1.15 Eligible Jack (prior internship, not placement) apply SUCCEEDS",
    async () => {
      const { data, error } = await clientJack.rpc("apply_to_drive", {
        p_drive_id: pubDriveId,
      });
      assert.ifError(error);
      const res = data as unknown as ApplyRpcResult;
      assert.ok(res?.success);
      jackAppId = res.application_id;
      assert.ok(jackAppId);
    }
  );

  await t.test(
    "1.16 Eligible Alice (BARCH 2026, 8.5 CGPA, 0 backlogs) apply SUCCEEDS",
    async () => {
      const { data, error } = await clientAlice.rpc("apply_to_drive", {
        p_drive_id: pubDriveId,
      });
      assert.ifError(error);
      const res = data as unknown as ApplyRpcResult;
      assert.ok(res?.success);
      aliceAppId = res.application_id;
      assert.ok(aliceAppId);
    }
  );

  await t.test(
    "1.17 Authoritative snapshot captured from academic_records",
    async () => {
      const { data, error } = await admin
        .from("applications")
        .select("status, snapshot_cgpa, snapshot_backlogs")
        .eq("id", aliceAppId)
        .single();
      assert.ifError(error);
      assert.equal(data.status, "APPLIED");
      assert.equal(Number(data.snapshot_cgpa), 8.5);
      assert.equal(data.snapshot_backlogs, 0);
    }
  );

  await t.test(
    "1.18 Initial history row appended with transition_sequence 1 and status APPLIED",
    async () => {
      const { data, error } = await admin
        .from("application_status_history")
        .select(
          "transition_sequence, previous_status, new_status, changed_by, is_terminal_correction"
        )
        .eq("application_id", aliceAppId)
        .single();
      assert.ifError(error);
      assert.equal(data.transition_sequence, 1);
      assert.equal(data.previous_status, null);
      assert.equal(data.new_status, "APPLIED");
      assert.equal(data.changed_by, sAliceId);
      assert.equal(data.is_terminal_correction, false);

      const { data: appData } = await admin
        .from("applications")
        .select("current_sequence")
        .eq("id", aliceAppId)
        .single();
      assert.equal(appData?.current_sequence, 1);
    }
  );

  await t.test(
    "1.19 Audit log entry APPLICATION_SUBMITTED recorded",
    async () => {
      const { data, error } = await admin
        .from("audit_logs")
        .select("action, entity_type, entity_id")
        .eq("entity_id", aliceAppId)
        .eq("action", "APPLICATION_SUBMITTED")
        .single();
      assert.ifError(error);
      assert.equal(data.action, "APPLICATION_SUBMITTED");
      assert.equal(data.entity_type, "application");
    }
  );

  await t.test(
    "1.20 Duplicate apply attempt by Alice is safely rejected",
    async () => {
      const { error } = await clientAlice.rpc("apply_to_drive", {
        p_drive_id: pubDriveId,
      });
      assert.ok(error);
      assert.match(error.message, /already submitted an application/i);
    }
  );

  // ==========================================================================
  // Section 2: Student Application Withdrawal Workflow & IDOR Shield
  // ==========================================================================
  await t.test(
    "2.1 Cross-student withdrawal IDOR attack rejected",
    async () => {
      const { error } = await clientJack.rpc("withdraw_application", {
        p_application_id: aliceAppId,
        p_reason: "Malicious attempt to cancel peer application",
      });
      assert.ok(error);
      assert.match(
        error.message,
        /Unauthorized: You can only withdraw your own applications/i
      );
    }
  );

  await t.test(
    "2.2 Alice withdraws own application before deadline succeeds",
    async () => {
      const { data, error } = await clientAlice.rpc("withdraw_application", {
        p_application_id: aliceAppId,
        p_reason: "Pursuing higher studies preparation",
      });
      assert.ifError(error);
      const res = data as unknown as WithdrawRpcResult;
      assert.ok(res?.success);
      assert.equal(res.status, "WITHDRAWN");
      assert.equal(res.transition_sequence, 2);
    }
  );

  await t.test(
    "2.3 Application row status is updated to WITHDRAWN",
    async () => {
      const { data, error } = await admin
        .from("applications")
        .select("status, current_sequence")
        .eq("id", aliceAppId)
        .single();
      assert.ifError(error);
      assert.equal(data.status, "WITHDRAWN");
      assert.equal(data.current_sequence, 2);
    }
  );

  await t.test(
    "2.4 History ledger updated with WITHDRAWN entry and sequence 2",
    async () => {
      const { data, error } = await admin
        .from("application_status_history")
        .select(
          "transition_sequence, previous_status, new_status, reason, is_terminal_correction"
        )
        .eq("application_id", aliceAppId)
        .order("transition_sequence", { ascending: false })
        .limit(1)
        .single();
      assert.ifError(error);
      assert.equal(data.transition_sequence, 2);
      assert.equal(data.previous_status, "APPLIED");
      assert.equal(data.new_status, "WITHDRAWN");
      assert.equal(data.reason, "Pursuing higher studies preparation");
      assert.equal(data.is_terminal_correction, false);
    }
  );

  await t.test(
    "2.4b Withdrawal reason is optional (omitted reason stores null)",
    async () => {
      // Create a test application for Jack on a temporary drive to test optional withdrawal reason
      const { data: dOpt } = await clientCoord.rpc("create_placement_drive", {
        p_company_id: companyAcmeId,
        p_title: "Phase 8 Optional Withdrawal Reason Test Drive",
        p_drive_type: "PLACEMENT",
        p_application_deadline: new Date(Date.now() + 86400000).toISOString(),
      });
      const optDriveId = (dOpt as unknown as DriveCreateRpcResult).drive_id;
      await clientCoord.rpc("configure_drive_eligibility", {
        p_drive_id: optDriveId,
        p_minimum_cgpa: 6.0,
        p_maximum_active_backlogs: 1,
      });
      await clientCoord.rpc("configure_drive_eligible_batches", {
        p_drive_id: optDriveId,
        p_batches: [{ program_id: barchProg.id, batch: "2026" }],
      });
      await clientSec.rpc("publish_placement_drive", {
        p_drive_id: optDriveId,
      });

      const { data: appRes } = await clientJack.rpc("apply_to_drive", {
        p_drive_id: optDriveId,
      });
      const tempAppId = (appRes as unknown as ApplyRpcResult).application_id;

      // Withdraw with no reason
      const { data: wRes, error: wErr } = await clientJack.rpc(
        "withdraw_application",
        {
          p_application_id: tempAppId,
        }
      );
      assert.ifError(wErr);
      const wObj = wRes as unknown as WithdrawRpcResult;
      assert.equal(wObj.status, "WITHDRAWN");

      const { data: hRow } = await admin
        .from("application_status_history")
        .select("reason")
        .eq("application_id", tempAppId)
        .order("transition_sequence", { ascending: false })
        .limit(1)
        .single();
      assert.equal(hRow?.reason, null);
    }
  );

  await t.test(
    "2.5 Re-apply after withdrawal is rejected (UNIQUE invariant preserved)",
    async () => {
      const { error } = await clientAlice.rpc("apply_to_drive", {
        p_drive_id: pubDriveId,
      });
      assert.ok(error);
      assert.match(
        error.message,
        /already submitted an application for this drive/i
      );
    }
  );

  await t.test(
    "2.6 Second withdrawal on already WITHDRAWN application fails",
    async () => {
      const { error } = await clientAlice.rpc("withdraw_application", {
        p_application_id: aliceAppId,
        p_reason: "Second withdrawal",
      });
      assert.ok(error);
      assert.match(error.message, /application is in WITHDRAWN status/i);
    }
  );

  // ==========================================================================
  // Section 3: Staff Status Transitions & State Machine Enforcement
  // ==========================================================================
  await t.test("3.1 Student cannot transition application status", async () => {
    const { error } = await clientAlice.rpc("transition_application_status", {
      p_application_id: jackAppId,
      p_new_status: "SHORTLISTED",
    });
    assert.ok(error);
    assert.match(
      error.message,
      /Unauthorized: Only active staff can update application status/i
    );
  });

  await t.test(
    "3.2 Recruiter cannot transition application status",
    async () => {
      const { error } = await clientRecAcme.rpc(
        "transition_application_status",
        {
          p_application_id: jackAppId,
          p_new_status: "SHORTLISTED",
        }
      );
      assert.ok(error);
      assert.match(
        error.message,
        /Unauthorized: Only active staff can update application status/i
      );
    }
  );

  await t.test(
    "3.3 In-scope Coordinator shortlists Jack: APPLIED -> SHORTLISTED",
    async () => {
      const { data, error } = await clientCoord.rpc(
        "transition_application_status",
        {
          p_application_id: jackAppId,
          p_new_status: "SHORTLISTED",
          p_reason: "Design portfolio review cleared",
        }
      );
      assert.ifError(error);
      const res = data as unknown as TransitionRpcResult;
      assert.ok(res?.success);
      assert.equal(res.new_status, "SHORTLISTED");
    }
  );

  await t.test("3.4 Student cannot withdraw once SHORTLISTED", async () => {
    const { error } = await clientJack.rpc("withdraw_application", {
      p_application_id: jackAppId,
      p_reason: "Attempt to withdraw shortlisted app",
    });
    assert.ok(error);
    assert.match(error.message, /only APPLIED applications can be withdrawn/i);
  });

  await t.test(
    "3.5 Coordinator CANNOT transition SHORTLISTED -> INTERVIEW (Secretary/Admin only)",
    async () => {
      const { error } = await clientCoord.rpc("transition_application_status", {
        p_application_id: jackAppId,
        p_new_status: "INTERVIEW",
      });
      assert.ok(error);
      assert.match(
        error.message,
        /Only Super Admin or TNP Secretary can move applications to INTERVIEW/i
      );
    }
  );

  await t.test(
    "3.6 Secretary transitions SHORTLISTED -> INTERVIEW",
    async () => {
      const { data, error } = await clientSec.rpc(
        "transition_application_status",
        {
          p_application_id: jackAppId,
          p_new_status: "INTERVIEW",
          p_reason: "Round 1 Technical Interview scheduled",
        }
      );
      assert.ifError(error);
      const res = data as unknown as TransitionRpcResult;
      assert.ok(res?.success);
      assert.equal(res.new_status, "INTERVIEW");
    }
  );

  await t.test(
    "3.7 Illegal backwards transition: INTERVIEW -> SHORTLISTED is rejected",
    async () => {
      const { error } = await clientSec.rpc("transition_application_status", {
        p_application_id: jackAppId,
        p_new_status: "SHORTLISTED",
      });
      assert.ok(error);
      assert.match(
        error.message,
        /Illegal application status transition from INTERVIEW to SHORTLISTED/i
      );
    }
  );

  await t.test(
    "3.8 Coordinator CANNOT decide INTERVIEW outcome (neither SELECTED nor REJECTED)",
    async () => {
      const { error: errSel } = await clientCoord.rpc(
        "transition_application_status",
        {
          p_application_id: jackAppId,
          p_new_status: "SELECTED",
        }
      );
      assert.ok(errSel);
      assert.match(
        errSel.message,
        /Only Super Admin or TNP Secretary can decide INTERVIEW outcomes/i
      );

      const { error: errRej } = await clientCoord.rpc(
        "transition_application_status",
        {
          p_application_id: jackAppId,
          p_new_status: "REJECTED",
        }
      );
      assert.ok(errRej);
      assert.match(
        errRej.message,
        /Only Super Admin or TNP Secretary can decide INTERVIEW outcomes/i
      );
    }
  );

  await t.test(
    "3.8b Secretary selects candidate: INTERVIEW -> SELECTED (with transition_sequence advancing)",
    async () => {
      const { data, error } = await clientSec.rpc(
        "transition_application_status",
        {
          p_application_id: jackAppId,
          p_new_status: "SELECTED",
          p_reason: "Final offer extended by Acme Labs",
        }
      );
      assert.ifError(error);
      const res = data as unknown as TransitionRpcResult;
      assert.ok(res?.success);
      assert.equal(res.new_status, "SELECTED");
      assert.ok(res.transition_sequence && res.transition_sequence >= 4);
    }
  );

  await t.test(
    "3.8c In-scope Coordinator can transition APPLIED -> REJECTED and SHORTLISTED -> REJECTED",
    async () => {
      // Create a temporary drive and application to test coordinator rejection paths
      const { data: dRej } = await clientCoord.rpc("create_placement_drive", {
        p_company_id: companyAcmeId,
        p_title: "Phase 8 Coordinator Rejection Test Drive",
        p_drive_type: "PLACEMENT",
        p_application_deadline: new Date(Date.now() + 86400000).toISOString(),
      });
      const rejDriveId = (dRej as unknown as DriveCreateRpcResult).drive_id;
      await clientCoord.rpc("configure_drive_eligibility", {
        p_drive_id: rejDriveId,
        p_minimum_cgpa: 6.0,
        p_maximum_active_backlogs: 1,
      });
      await clientCoord.rpc("configure_drive_eligible_batches", {
        p_drive_id: rejDriveId,
        p_batches: [{ program_id: barchProg.id, batch: "2026" }],
      });
      await clientSec.rpc("publish_placement_drive", {
        p_drive_id: rejDriveId,
      });

      // Alice applies
      const { data: appData } = await clientAlice.rpc("apply_to_drive", {
        p_drive_id: rejDriveId,
      });
      const testAppId = (appData as unknown as ApplyRpcResult).application_id;

      // 1. Coordinator rejects directly from APPLIED: APPLIED -> REJECTED
      const { data: rej1, error: rej1Err } = await clientCoord.rpc(
        "transition_application_status",
        {
          p_application_id: testAppId,
          p_new_status: "REJECTED",
          p_reason: "Did not meet specific portfolio requirements",
        }
      );
      assert.ifError(rej1Err);
      assert.equal(
        (rej1 as unknown as TransitionRpcResult).new_status,
        "REJECTED"
      );

      // Super Admin restores to APPLIED
      await clientAdmin.rpc("correct_terminal_status", {
        p_application_id: testAppId,
        p_reason: "Correction for test progression",
      });

      // Coordinator shortlists: APPLIED -> SHORTLISTED
      await clientCoord.rpc("transition_application_status", {
        p_application_id: testAppId,
        p_new_status: "SHORTLISTED",
      });

      // 2. Coordinator rejects from SHORTLISTED: SHORTLISTED -> REJECTED
      const { data: rej2, error: rej2Err } = await clientCoord.rpc(
        "transition_application_status",
        {
          p_application_id: testAppId,
          p_new_status: "REJECTED",
          // Test optional reason (omitted reason)
        }
      );
      assert.ifError(rej2Err);
      assert.equal(
        (rej2 as unknown as TransitionRpcResult).new_status,
        "REJECTED"
      );

      const { data: hRow } = await admin
        .from("application_status_history")
        .select("reason")
        .eq("application_id", testAppId)
        .order("transition_sequence", { ascending: false })
        .limit(1)
        .single();
      assert.equal(hRow?.reason, null);
    }
  );

  await t.test(
    "3.8d Out-of-scope Coordinator cannot transition or view student application",
    async () => {
      // Bob is MPLAN 2026 (out of scope for coord who covers BARCH 2026)
      // Create MPLAN drive
      const { data: dMplan } = await clientSec.rpc("create_placement_drive", {
        p_company_id: companyAcmeId,
        p_title: "Phase 8 Out Of Scope Coord Test Drive",
        p_drive_type: "PLACEMENT",
        p_application_deadline: new Date(Date.now() + 86400000).toISOString(),
      });
      const mplanDriveId = (dMplan as unknown as DriveCreateRpcResult).drive_id;
      await clientSec.rpc("configure_drive_eligibility", {
        p_drive_id: mplanDriveId,
        p_minimum_cgpa: 6.0,
        p_maximum_active_backlogs: 1,
      });
      await clientSec.rpc("configure_drive_eligible_batches", {
        p_drive_id: mplanDriveId,
        p_batches: [{ program_id: mplanProg.id, batch: "2026" }],
      });
      await clientSec.rpc("publish_placement_drive", {
        p_drive_id: mplanDriveId,
      });

      // Bob applies
      const { data: bAppData } = await clientBob.rpc("apply_to_drive", {
        p_drive_id: mplanDriveId,
      });
      const bAppId = (bAppData as unknown as ApplyRpcResult).application_id;

      // Coord attempts transition on out-of-scope Bob
      const { error: oosErr } = await clientCoord.rpc(
        "transition_application_status",
        {
          p_application_id: bAppId,
          p_new_status: "SHORTLISTED",
        }
      );
      assert.ok(oosErr);
      assert.match(
        oosErr.message,
        /Student is outside assigned coordinator scope/i
      );

      // Coord reading v_staff_applications sees 0 rows for Bob
      const { data: oosRows } = await clientCoord
        .from("v_staff_applications")
        .select("*")
        .eq("application_id", bAppId);
      assert.equal(oosRows?.length, 0);
    }
  );

  await t.test(
    "3.10 Normal staff transition out of terminal state SELECTED is rejected",
    async () => {
      const { error } = await clientSec.rpc("transition_application_status", {
        p_application_id: jackAppId,
        p_new_status: "REJECTED",
      });
      assert.ok(error);
      assert.match(error.message, /application is in terminal state SELECTED/i);
    }
  );

  // ==========================================================================
  // Section 4: Super Admin Terminal Status Correction & Dynamic Downstream Impact
  // ==========================================================================
  await t.test("4.1 Student cannot call correct_terminal_status", async () => {
    const { error } = await clientJack.rpc("correct_terminal_status", {
      p_application_id: jackAppId,
      p_reason: "Self recovery attempt",
    });
    assert.ok(error);
    assert.match(
      error.message,
      /Unauthorized: Only Super Admin can perform terminal status correction/i
    );
  });

  await t.test(
    "4.2 Coordinator cannot call correct_terminal_status",
    async () => {
      const { error } = await clientCoord.rpc("correct_terminal_status", {
        p_application_id: jackAppId,
        p_reason: "Coordinator recovery attempt",
      });
      assert.ok(error);
      assert.match(
        error.message,
        /Unauthorized: Only Super Admin can perform terminal status correction/i
      );
    }
  );

  await t.test(
    "4.3 Secretary cannot call correct_terminal_status",
    async () => {
      const { error } = await clientSec.rpc("correct_terminal_status", {
        p_application_id: jackAppId,
        p_reason: "Secretary recovery attempt",
      });
      assert.ok(error);
      assert.match(
        error.message,
        /Unauthorized: Only Super Admin can perform terminal status correction/i
      );
    }
  );

  await t.test(
    "4.4 Super Admin call with empty or whitespace reason is rejected",
    async () => {
      const { error } = await clientAdmin.rpc("correct_terminal_status", {
        p_application_id: jackAppId,
        p_reason: "   ",
      });
      assert.ok(error);
      assert.match(
        error.message,
        /Correction reason is required and cannot be empty/i
      );
    }
  );

  await t.test(
    "4.5 Super Admin corrects SELECTED -> derives previous non-terminal state INTERVIEW",
    async () => {
      const { data, error } = await clientAdmin.rpc("correct_terminal_status", {
        p_application_id: jackAppId,
        p_reason: "Company administrative discrepancy in offer letter",
      });
      assert.ifError(error);
      const res = data as unknown as CorrectRpcResult;
      assert.ok(res?.success);
      assert.equal(res.restored_status, "INTERVIEW");
    }
  );

  await t.test(
    "4.6 Jack application row status restored to INTERVIEW",
    async () => {
      const { data, error } = await admin
        .from("applications")
        .select("status")
        .eq("id", jackAppId)
        .single();
      assert.ifError(error);
      assert.equal(data.status, "INTERVIEW");
    }
  );

  await t.test(
    "4.7 History row recorded with is_terminal_correction = true",
    async () => {
      const { data, error } = await admin
        .from("application_status_history")
        .select(
          "transition_sequence, previous_status, new_status, is_terminal_correction, reason"
        )
        .eq("application_id", jackAppId)
        .order("transition_sequence", { ascending: false })
        .limit(1)
        .single();
      assert.ifError(error);
      assert.equal(data.previous_status, "SELECTED");
      assert.equal(data.new_status, "INTERVIEW");
      assert.equal(data.is_terminal_correction, true);
      assert.equal(
        data.reason,
        "Company administrative discrepancy in offer letter"
      );
    }
  );

  await t.test(
    "4.8 Second correction fails because application is now non-terminal",
    async () => {
      const { error } = await clientAdmin.rpc("correct_terminal_status", {
        p_application_id: jackAppId,
        p_reason: "Second correction",
      });
      assert.ok(error);
      assert.match(
        error.message,
        /application is in non-terminal state INTERVIEW/i
      );
    }
  );

  await t.test(
    "4.9 Super Admin can correct WITHDRAWN (Alice) back to APPLIED with next transition_sequence",
    async () => {
      const { data, error } = await clientAdmin.rpc("correct_terminal_status", {
        p_application_id: aliceAppId,
        p_reason: "Student mistakenly withdrew; verified by academic office",
      });
      assert.ifError(error);
      const res = data as unknown as CorrectRpcResult;
      assert.ok(res?.success);
      assert.equal(res.restored_status, "APPLIED");
      assert.equal(res.transition_sequence, 3);
    }
  );

  await t.test(
    "4.10 Alice status restored to APPLIED in applications table with sequence 3",
    async () => {
      const { data, error } = await admin
        .from("applications")
        .select("status, current_sequence")
        .eq("id", aliceAppId)
        .single();
      assert.ifError(error);
      assert.equal(data.status, "APPLIED");
      assert.equal(data.current_sequence, 3);
    }
  );

  await t.test(
    "4.11 Rapid multiple transitions maintain deterministic sequence order regardless of timestamp resolution",
    async () => {
      const { data: dRapid } = await clientCoord.rpc("create_placement_drive", {
        p_company_id: companyAcmeId,
        p_title: "Phase 8 Rapid Transition Sequence Test Drive",
        p_drive_type: "PLACEMENT",
        p_application_deadline: new Date(Date.now() + 86400000).toISOString(),
      });
      const rapidDriveId = (dRapid as unknown as DriveCreateRpcResult).drive_id;
      await clientCoord.rpc("configure_drive_eligibility", {
        p_drive_id: rapidDriveId,
        p_minimum_cgpa: 6.0,
        p_maximum_active_backlogs: 1,
      });
      await clientCoord.rpc("configure_drive_eligible_batches", {
        p_drive_id: rapidDriveId,
        p_batches: [{ program_id: barchProg.id, batch: "2026" }],
      });
      await clientSec.rpc("publish_placement_drive", {
        p_drive_id: rapidDriveId,
      });

      const { data: rApp } = await clientJack.rpc("apply_to_drive", {
        p_drive_id: rapidDriveId,
      });
      const rapidAppId = (rApp as unknown as ApplyRpcResult).application_id;

      // Sequential fast transitions
      await clientCoord.rpc("transition_application_status", {
        p_application_id: rapidAppId,
        p_new_status: "SHORTLISTED",
      });
      await clientSec.rpc("transition_application_status", {
        p_application_id: rapidAppId,
        p_new_status: "INTERVIEW",
      });
      await clientSec.rpc("transition_application_status", {
        p_application_id: rapidAppId,
        p_new_status: "REJECTED",
      });
      await clientAdmin.rpc("correct_terminal_status", {
        p_application_id: rapidAppId,
        p_reason: "Rapid correction back to interview",
      });
      await clientSec.rpc("transition_application_status", {
        p_application_id: rapidAppId,
        p_new_status: "SELECTED",
      });

      // Verify sequence order 1, 2, 3, 4, 5, 6
      const { data: hRows, error: hErr } = await admin
        .from("application_status_history")
        .select("transition_sequence, previous_status, new_status")
        .eq("application_id", rapidAppId)
        .order("transition_sequence", { ascending: true });

      assert.ifError(hErr);
      assert.equal(hRows?.length, 6);
      const sequences = hRows?.map((r) => Number(r.transition_sequence));
      assert.deepEqual(sequences, [1, 2, 3, 4, 5, 6]);

      // Verify UNIQUE constraint on (application_id, transition_sequence)
      const { error: dupErr } = await admin
        .from("application_status_history")
        .insert({
          application_id: rapidAppId,
          transition_sequence: 1,
          new_status: "APPLIED",
          changed_by: adminId,
        });
      assert.ok(
        dupErr,
        "Duplicate transition_sequence must violate UNIQUE constraint"
      );
    }
  );

  // ==========================================================================
  // Section 5: Reactive Selected Placement Impact (Dynamic Downstream Evaluator)
  // ==========================================================================
  await t.test(
    "5.1 Alice is currently APPLIED on drive 1. Evaluator on second drive returns PASS",
    async () => {
      const { data, error } = await clientAlice.rpc(
        "get_my_drive_eligibility",
        {
          p_drive_id: secondDriveId,
        }
      );
      assert.ifError(error);
      const rows = data as unknown as EligibilityRpcResult[];
      const row = rows?.[0];
      assert.ok(row);
      assert.equal(row.academic_result, "PASS");
      assert.deepEqual(row.reason_codes, []);
    }
  );

  await t.test("5.2 Move Alice through to SELECTED on drive 1", async () => {
    await clientCoord.rpc("transition_application_status", {
      p_application_id: aliceAppId,
      p_new_status: "SHORTLISTED",
    });
    await clientSec.rpc("transition_application_status", {
      p_application_id: aliceAppId,
      p_new_status: "INTERVIEW",
    });
    const { data } = await clientSec.rpc("transition_application_status", {
      p_application_id: aliceAppId,
      p_new_status: "SELECTED",
    });
    const res = data as unknown as TransitionRpcResult;
    assert.equal(res.new_status, "SELECTED");
  });

  await t.test(
    "5.3 Now Alice evaluates on second exclusive drive: FAIL, PREVIOUSLY_SELECTED_PLACEMENT",
    async () => {
      const { data, error } = await clientAlice.rpc(
        "get_my_drive_eligibility",
        {
          p_drive_id: secondDriveId,
        }
      );
      assert.ifError(error);
      const rows = data as unknown as EligibilityRpcResult[];
      const row = rows?.[0];
      assert.ok(row);
      assert.equal(row.academic_result, "FAIL");
      assert.ok(row.reason_codes.includes("PREVIOUSLY_SELECTED_PLACEMENT"));
    }
  );

  await t.test(
    "5.4 Super Admin corrects Alice SELECTED -> INTERVIEW",
    async () => {
      const { data, error } = await clientAdmin.rpc("correct_terminal_status", {
        p_application_id: aliceAppId,
        p_reason: "Offer rescinded due to business changes",
      });
      assert.ifError(error);
      const res = data as unknown as CorrectRpcResult;
      assert.equal(res.restored_status, "INTERVIEW");
    }
  );

  await t.test(
    "5.5 Immediately re-evaluating Alice on second drive returns PASS again without stale cache",
    async () => {
      const { data, error } = await clientAlice.rpc(
        "get_my_drive_eligibility",
        {
          p_drive_id: secondDriveId,
        }
      );
      assert.ifError(error);
      const rows = data as unknown as EligibilityRpcResult[];
      const row = rows?.[0];
      assert.ok(row);
      assert.equal(row.academic_result, "PASS");
      assert.deepEqual(row.reason_codes, []);
    }
  );

  // ==========================================================================
  // Section 6: Append-Only Trigger & Recruiter Confidentiality Shield
  // ==========================================================================
  await t.test(
    "6.1 Direct UPDATE on application_status_history is blocked by trigger",
    async () => {
      const { error } = await admin
        .from("application_status_history")
        .update({ reason: "Tampered reason" })
        .eq("application_id", aliceAppId);
      assert.ok(error);
      assert.match(
        error.message,
        /This table is append-only: UPDATE operation is not permitted/i
      );
    }
  );

  await t.test(
    "6.2 Direct DELETE on application_status_history is blocked by trigger",
    async () => {
      const { error } = await admin
        .from("application_status_history")
        .delete()
        .eq("application_id", aliceAppId);
      assert.ok(error);
      assert.match(
        error.message,
        /This table is append-only: DELETE operation is not permitted/i
      );
    }
  );

  await t.test(
    "6.3 Recruiter receives 0 rows from applications base table",
    async () => {
      const { data, error } = await clientRecAcme
        .from("applications")
        .select("*");
      assert.ifError(error);
      assert.equal(data.length, 0);
    }
  );

  await t.test(
    "6.4 Recruiter receives 0 rows from application_status_history base table",
    async () => {
      const { data, error } = await clientRecAcme
        .from("application_status_history")
        .select("*");
      assert.ifError(error);
      assert.equal(data.length, 0);
    }
  );

  await t.test(
    "6.5 Recruiter receives 0 rows from v_staff_applications view",
    async () => {
      const { data, error } = await clientRecAcme
        .from("v_staff_applications")
        .select("*");
      assert.ifError(error);
      assert.equal(data.length, 0);
    }
  );

  await t.test(
    "6.6 Recruiter receives 0 rows from v_staff_application_history view",
    async () => {
      const { data, error } = await clientRecAcme
        .from("v_staff_application_history")
        .select("*");
      assert.ifError(error);
      assert.equal(data.length, 0);
    }
  );

  await t.test(
    "6.7 Recruiter receives 0 rows from v_student_applications view",
    async () => {
      const { data, error } = await clientRecAcme
        .from("v_student_applications")
        .select("*");
      assert.ifError(error);
      assert.equal(data.length, 0);
    }
  );

  await t.test(
    "6.8 Recruiter receives 0 rows from v_student_application_timeline view",
    async () => {
      const { data, error } = await clientRecAcme
        .from("v_student_application_timeline")
        .select("*");
      assert.ifError(error);
      assert.equal(data.length, 0);
    }
  );

  await t.test(
    "6.9 Direct INSERT into application_status_history is denied across all roles",
    async () => {
      // 1. Anon direct INSERT
      const { error: errAnon } = await anonClient
        .from("application_status_history")
        .insert({
          application_id: aliceAppId,
          new_status: "APPLIED",
          changed_by: sAliceId,
        });
      assert.ok(errAnon, "Anon direct insert must be denied");

      // 2. Student Alice direct INSERT
      const { error: errStud } = await clientAlice
        .from("application_status_history")
        .insert({
          application_id: aliceAppId,
          new_status: "APPLIED",
          changed_by: sAliceId,
        });
      assert.ok(errStud, "Student direct insert must be denied");

      // 3. Recruiter direct INSERT
      const { error: errRec } = await clientRecAcme
        .from("application_status_history")
        .insert({
          application_id: aliceAppId,
          new_status: "APPLIED",
          changed_by: sAliceId,
        });
      assert.ok(errRec, "Recruiter direct insert must be denied");

      // 4. Coordinator direct INSERT
      const { error: errCoord } = await clientCoord
        .from("application_status_history")
        .insert({
          application_id: aliceAppId,
          new_status: "SHORTLISTED",
          changed_by: coordId,
        });
      assert.ok(errCoord, "Coordinator direct insert must be denied");

      // 5. Secretary direct INSERT
      const { error: errSec } = await clientSec
        .from("application_status_history")
        .insert({
          application_id: aliceAppId,
          new_status: "INTERVIEW",
          changed_by: sAliceId,
        });
      assert.ok(errSec, "Secretary direct insert must be denied");

      // 6. Super Admin direct INSERT
      const { error: errAdmin } = await clientAdmin
        .from("application_status_history")
        .insert({
          application_id: aliceAppId,
          new_status: "INTERVIEW",
          changed_by: adminId,
        });
      assert.ok(errAdmin, "Super Admin direct insert must be denied");
    }
  );

  // ==========================================================================
  // Section 7: Safe Domain Views & Student Timeline Sanitization
  // ==========================================================================
  await t.test(
    "7.1 Student can read own applications in v_student_applications",
    async () => {
      const { data, error } = await clientAlice
        .from("v_student_applications")
        .select("*");
      assert.ifError(error);
      assert.ok(data && data.length >= 1);
      const app = data.find((a) => a.application_id === aliceAppId);
      assert.ok(app);
      assert.equal(app.drive_title, "Phase 8 Main Architecture Drive 2026");
    }
  );

  await t.test(
    "7.2 Student CANNOT read other student applications in v_student_applications",
    async () => {
      const { data, error } = await clientAlice
        .from("v_student_applications")
        .select("*")
        .eq("student_id", sJackId);
      assert.ifError(error);
      assert.equal(data?.length, 0);
    }
  );

  await t.test(
    "7.3 Student timeline v_student_application_timeline hides staff ID and internal reasons",
    async () => {
      const { data, error } = await clientAlice
        .from("v_student_application_timeline")
        .select("*")
        .eq("application_id", aliceAppId);
      assert.ifError(error);
      assert.ok(data && data.length >= 1);
      const event = data[0] as unknown as Record<string, unknown>;
      // Verify column projection: changed_by and reason do NOT exist in student timeline
      assert.equal(event.changed_by, undefined);
      assert.equal(event.reason, undefined);
      assert.ok(event.new_status);
      assert.ok(event.created_at);
    }
  );

  await t.test(
    "7.4 Staff view v_staff_applications allows Coordinator to read in-scope student",
    async () => {
      const { data, error } = await clientCoord
        .from("v_staff_applications")
        .select("*")
        .eq("application_id", aliceAppId);
      assert.ifError(error);
      assert.equal(data?.length, 1);
      const appRow = data?.[0];
      assert.ok(appRow);
      assert.equal(appRow.student_name, "Alice Architect");
      assert.equal(appRow.program_code, "BARCH");
      assert.equal(appRow.student_batch, "2026");
    }
  );

  await t.test(
    "7.5 Staff view v_staff_application_history exposes audit details to authorized staff",
    async () => {
      const { data, error } = await clientCoord
        .from("v_staff_application_history")
        .select("*")
        .eq("application_id", aliceAppId);
      assert.ifError(error);
      assert.ok(data && data.length >= 1);
      const hist = data[0];
      assert.ok(hist);
      assert.ok(hist.changed_by_name);
      assert.ok(hist.changed_by_role);
    }
  );

  // ==========================================================================
  // Section 8: Concurrency & Race Conditions
  // ==========================================================================
  await t.test(
    "8.1 Concurrent duplicate apply race condition is safely resolved by DB locks",
    async () => {
      // Create a new fresh third drive to test concurrency
      const { data: dFresh } = await clientCoord.rpc("create_placement_drive", {
        p_company_id: companyAcmeId,
        p_title: "Phase 8 Concurrency Test Drive",
        p_drive_type: "PLACEMENT",
        p_application_deadline: new Date(
          Date.now() + 30 * 86400000
        ).toISOString(),
      });
      const freshDriveId = (dFresh as unknown as DriveCreateRpcResult).drive_id;
      await clientCoord.rpc("configure_drive_eligibility", {
        p_drive_id: freshDriveId,
        p_minimum_cgpa: 7.0,
        p_maximum_active_backlogs: 0,
      });
      await clientCoord.rpc("configure_drive_eligible_batches", {
        p_drive_id: freshDriveId,
        p_batches: [{ program_id: barchProg.id, batch: "2026" }],
      });
      await clientSec.rpc("publish_placement_drive", {
        p_drive_id: freshDriveId,
      });

      // Alice fires two applications simultaneously in parallel
      const [res1, res2] = await Promise.allSettled([
        clientAlice.rpc("apply_to_drive", { p_drive_id: freshDriveId }),
        clientAlice.rpc("apply_to_drive", { p_drive_id: freshDriveId }),
      ]);

      const successes = [res1, res2].filter(
        (r) => r.status === "fulfilled" && !r.value.error
      );
      const failures = [res1, res2].filter(
        (r) => r.status === "fulfilled" && r.value.error
      );

      assert.equal(successes.length, 1, "Exactly one apply succeeded");
      assert.equal(failures.length, 1, "Exactly one apply rejected duplicate");

      // Verify exactly one application row exists in DB
      const { data: rows } = await admin
        .from("applications")
        .select("id")
        .eq("student_id", sAliceId)
        .eq("drive_id", freshDriveId);
      assert.equal(rows?.length, 1);
    }
  );

  await t.test(
    "8.2 Concurrent apply vs drive close race condition",
    async () => {
      // Create fresh drive for apply vs close race
      const { data: dClose } = await clientCoord.rpc("create_placement_drive", {
        p_company_id: companyAcmeId,
        p_title: "Phase 8 Concurrency Apply vs Close Drive",
        p_drive_type: "PLACEMENT",
        p_application_deadline: new Date(
          Date.now() + 30 * 86400000
        ).toISOString(),
      });
      const closeDriveId = (dClose as unknown as DriveCreateRpcResult).drive_id;
      await clientCoord.rpc("configure_drive_eligibility", {
        p_drive_id: closeDriveId,
        p_minimum_cgpa: 6.0,
        p_maximum_active_backlogs: 1,
      });
      await clientCoord.rpc("configure_drive_eligible_batches", {
        p_drive_id: closeDriveId,
        p_batches: [{ program_id: barchProg.id, batch: "2026" }],
      });
      await clientSec.rpc("publish_placement_drive", {
        p_drive_id: closeDriveId,
      });

      // Alice applies while Secretary simultaneously closes drive
      const [applyRes, closeRes] = await Promise.allSettled([
        clientAlice.rpc("apply_to_drive", { p_drive_id: closeDriveId }),
        clientSec.rpc("close_placement_drive", { p_drive_id: closeDriveId }),
      ]);

      assert.equal(closeRes.status, "fulfilled");
      assert.ifError(
        (closeRes as PromiseFulfilledResult<{ error: unknown }>).value.error
      );

      // Verify DB consistency: drive is CLOSED
      const { data: driveRow } = await admin
        .from("placement_drives")
        .select("status")
        .eq("id", closeDriveId)
        .single();
      assert.equal(driveRow?.status, "CLOSED");

      // Check whether apply succeeded before close or was rejected after close
      const { data: appRows } = await admin
        .from("applications")
        .select("id, status")
        .eq("drive_id", closeDriveId);

      if (
        applyRes.status === "fulfilled" &&
        !(applyRes.value as { error?: unknown }).error
      ) {
        // Apply won race: application created before close
        assert.equal(appRows?.length, 1);
        assert.equal(appRows?.[0]?.status, "APPLIED");
      } else {
        // Close won race: apply rejected
        assert.equal(appRows?.length, 0);
      }
    }
  );

  await t.test(
    "8.3 Concurrent withdrawal vs staff shortlisting race condition",
    async () => {
      // Get fresh application from the concurrency drive
      const { data: appRow } = await admin
        .from("applications")
        .select("id")
        .eq("student_id", sAliceId)
        .order("applied_at", { ascending: false })
        .limit(1)
        .single();

      assert.ok(appRow?.id);

      // Simultaneously: Alice withdraws AND Coordinator shortlists
      const [resW, resS] = await Promise.allSettled([
        clientAlice.rpc("withdraw_application", {
          p_application_id: appRow.id,
          p_reason: "Concurrent withdraw test",
        }),
        clientCoord.rpc("transition_application_status", {
          p_application_id: appRow.id,
          p_new_status: "SHORTLISTED",
          p_reason: "Concurrent shortlist test",
        }),
      ]);

      // Exactly one must succeed, the other rejected by authoritative row state
      const fulfilledSuccesses = [resW, resS].filter(
        (r) =>
          r.status === "fulfilled" && !(r.value as { error?: unknown }).error
      );
      const fulfilledFailures = [resW, resS].filter(
        (r) =>
          r.status === "fulfilled" && (r.value as { error?: unknown }).error
      );
      assert.equal(
        fulfilledSuccesses.length,
        1,
        "Exactly one mutation must succeed under lock"
      );
      assert.equal(
        fulfilledFailures.length,
        1,
        "The loser rechecks authoritative state and is rejected"
      );

      // Check DB state: status matches latest transition_sequence history row
      const { data: finalApp } = await admin
        .from("applications")
        .select("status, current_sequence")
        .eq("id", appRow.id)
        .single();

      assert.ok(finalApp);
      assert.ok(
        finalApp.status === "WITHDRAWN" || finalApp.status === "SHORTLISTED",
        `Final status must be valid deterministic state, got: ${finalApp.status}`
      );
      assert.equal(finalApp.current_sequence, 2);

      const { data: latestHistory } = await admin
        .from("application_status_history")
        .select("new_status, transition_sequence")
        .eq("application_id", appRow.id)
        .order("transition_sequence", { ascending: false })
        .limit(1)
        .single();

      assert.equal(finalApp.status, latestHistory?.new_status);
      assert.equal(
        finalApp.current_sequence,
        latestHistory?.transition_sequence
      );
    }
  );

  await t.test(
    "8.4 Concurrent staff transitions race condition (two staff transition from APPLIED to SHORTLISTED)",
    async () => {
      // Create fresh drive and application for staff/staff race
      const { data: dStaffRace } = await clientCoord.rpc(
        "create_placement_drive",
        {
          p_company_id: companyAcmeId,
          p_title: "Phase 8 Staff Concurrency Race Drive",
          p_drive_type: "PLACEMENT",
          p_application_deadline: new Date(
            Date.now() + 30 * 86400000
          ).toISOString(),
        }
      );
      const staffRaceDriveId = (dStaffRace as unknown as DriveCreateRpcResult)
        .drive_id;
      await clientCoord.rpc("configure_drive_eligibility", {
        p_drive_id: staffRaceDriveId,
        p_minimum_cgpa: 6.0,
        p_maximum_active_backlogs: 1,
      });
      await clientCoord.rpc("configure_drive_eligible_batches", {
        p_drive_id: staffRaceDriveId,
        p_batches: [{ program_id: barchProg.id, batch: "2026" }],
      });
      await clientSec.rpc("publish_placement_drive", {
        p_drive_id: staffRaceDriveId,
      });

      const { data: aApp } = await clientAlice.rpc("apply_to_drive", {
        p_drive_id: staffRaceDriveId,
      });
      const raceAppId = (aApp as unknown as ApplyRpcResult).application_id;

      // Simultaneously: Secretary AND Coordinator try to transition APPLIED -> SHORTLISTED
      const [resSec, resCoord] = await Promise.allSettled([
        clientSec.rpc("transition_application_status", {
          p_application_id: raceAppId,
          p_new_status: "SHORTLISTED",
          p_reason: "Secretary shortlist attempt",
        }),
        clientCoord.rpc("transition_application_status", {
          p_application_id: raceAppId,
          p_new_status: "SHORTLISTED",
          p_reason: "Coordinator shortlist attempt",
        }),
      ]);

      const successes = [resSec, resCoord].filter(
        (r) =>
          r.status === "fulfilled" && !(r.value as { error?: unknown }).error
      );
      const failures = [resSec, resCoord].filter(
        (r) =>
          r.status === "fulfilled" && (r.value as { error?: unknown }).error
      );

      assert.equal(
        successes.length,
        1,
        "Exactly one staff transition succeeds"
      );
      assert.equal(
        failures.length,
        1,
        "Second staff rechecks status under lock and is rejected (already shortlisted)"
      );

      const { data: appRow } = await admin
        .from("applications")
        .select("status, current_sequence")
        .eq("id", raceAppId)
        .single();
      assert.equal(appRow?.status, "SHORTLISTED");
      assert.equal(appRow?.current_sequence, 2);

      const { data: historyRows } = await admin
        .from("application_status_history")
        .select("transition_sequence, new_status")
        .eq("application_id", raceAppId)
        .order("transition_sequence", { ascending: true });
      assert.equal(
        historyRows?.length,
        2,
        "No duplicate history entries created"
      );
      assert.equal(historyRows?.[1]?.transition_sequence, 2);
    }
  );

  await t.test(
    "8.5 Concurrent terminal corrections race condition (two Super Admins correct same terminal application)",
    async () => {
      // Use the application from test 8.4: move to INTERVIEW, then SELECTED (terminal)
      const { data: appToTerminal } = await admin
        .from("applications")
        .select("id")
        .eq("student_id", sAliceId)
        .eq("status", "SHORTLISTED")
        .order("applied_at", { ascending: false })
        .limit(1)
        .single();

      assert.ok(appToTerminal?.id);
      const termAppId = appToTerminal.id;

      await clientSec.rpc("transition_application_status", {
        p_application_id: termAppId,
        p_new_status: "INTERVIEW",
      });
      await clientSec.rpc("transition_application_status", {
        p_application_id: termAppId,
        p_new_status: "SELECTED",
      });

      // Now termAppId is in SELECTED. Simultaneously, two admin calls attempt correction:
      const [cor1, cor2] = await Promise.allSettled([
        clientAdmin.rpc("correct_terminal_status", {
          p_application_id: termAppId,
          p_reason: "Admin 1 correction",
        }),
        clientAdmin.rpc("correct_terminal_status", {
          p_application_id: termAppId,
          p_reason: "Admin 2 correction",
        }),
      ]);

      const successes = [cor1, cor2].filter(
        (r) =>
          r.status === "fulfilled" && !(r.value as { error?: unknown }).error
      );
      const failures = [cor1, cor2].filter(
        (r) =>
          r.status === "fulfilled" && (r.value as { error?: unknown }).error
      );

      assert.equal(
        successes.length,
        1,
        "Exactly one correction succeeds under row lock"
      );
      assert.equal(
        failures.length,
        1,
        "Second correction sees non-terminal status under lock and is rejected"
      );

      // Verify DB state: status matches restored status (INTERVIEW)
      const { data: finalApp } = await admin
        .from("applications")
        .select("status, current_sequence")
        .eq("id", termAppId)
        .single();
      assert.equal(finalApp?.status, "INTERVIEW");

      // Verify exactly one correction history row with is_terminal_correction = true
      const { data: corHistory } = await admin
        .from("application_status_history")
        .select("transition_sequence, is_terminal_correction, new_status")
        .eq("application_id", termAppId)
        .eq("is_terminal_correction", true);

      assert.equal(
        corHistory?.length,
        1,
        "Exactly one correction history row exists"
      );
      assert.equal(corHistory?.[0]?.new_status, "INTERVIEW");
    }
  );
});
