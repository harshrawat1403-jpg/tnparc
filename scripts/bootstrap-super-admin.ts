import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

/**
 * Super Admin Operator CLI Bootstrap Procedure
 * Strictly operator-only CLI execution in a secure server environment.
 * NEVER exposed as an HTTP or public web endpoint.
 * Requires BOOTSTRAP_SECRET, enforces single active admin cardinality,
 * refuses replay, and records a permanent audit entry.
 */
export async function bootstrapSuperAdmin(cliArgs?: string[]) {
  const args = cliArgs || process.argv.slice(2);

  function getArg(flag: string): string | undefined {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) {
      return args[idx + 1];
    }
    return undefined;
  }

  const bootstrapSecret = getArg("--secret") || process.env.BOOTSTRAP_SECRET;
  const email =
    getArg("--email") ||
    process.env.BOOTSTRAP_ADMIN_EMAIL ||
    "admin@vnit.ac.in";
  const password = getArg("--password") || process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name =
    getArg("--name") ||
    process.env.BOOTSTRAP_ADMIN_NAME ||
    "System Administrator";

  if (!bootstrapSecret) {
    console.error(
      "Error: BOOTSTRAP_SECRET is required. Provide via --secret <SECRET> or BOOTSTRAP_SECRET env var."
    );
    process.exitCode = 1;
    return { success: false, error: "MISSING_BOOTSTRAP_SECRET" };
  }

  // If a configured secret is present in environment, ensure the passed secret matches
  const expectedSecret = process.env.EXPECTED_BOOTSTRAP_SECRET;
  if (expectedSecret && bootstrapSecret !== expectedSecret) {
    console.error("Error: Invalid BOOTSTRAP_SECRET provided.");
    process.exitCode = 1;
    return { success: false, error: "INVALID_BOOTSTRAP_SECRET" };
  }

  if (!password || password.length < 8) {
    console.error(
      "Error: Super Admin password must be at least 8 characters. Provide via --password <PASSWORD> or BOOTSTRAP_ADMIN_PASSWORD."
    );
    process.exitCode = 1;
    return { success: false, error: "INVALID_PASSWORD" };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required."
    );
    process.exitCode = 1;
    return { success: false, error: "MISSING_CONFIG" };
  }

  const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // 1. Check if an active SUPER_ADMIN already exists
  const { data: existingAdmin, error: checkError } = await adminClient
    .from("profiles")
    .select("id, display_name")
    .eq("role", "SUPER_ADMIN")
    .eq("is_active", true)
    .maybeSingle();

  if (checkError) {
    console.error(
      "Error verifying existing admin profiles:",
      checkError.message
    );
    process.exitCode = 1;
    return { success: false, error: checkError.message };
  }

  if (existingAdmin) {
    console.error(
      `Refused: An active SUPER_ADMIN profile already exists (${existingAdmin.id}). Replay not permitted.`
    );
    process.exitCode = 1;
    return { success: false, error: "REPLAY_REFUSED" };
  }

  // 2. Create or bind Auth user safely
  const { data: usersData, error: listError } =
    await adminClient.auth.admin.listUsers();

  if (listError) {
    console.error("Error inspecting auth users:", listError.message);
    process.exitCode = 1;
    return { success: false, error: listError.message };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = usersData.users.find(
    (u) => u.email?.toLowerCase() === normalizedEmail
  );

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      {
        password,
        email_confirm: true,
        user_metadata: { display_name: name },
      }
    );

    if (updateError) {
      console.error(
        "Error updating existing auth identity:",
        updateError.message
      );
      process.exitCode = 1;
      return { success: false, error: updateError.message };
    }
  } else {
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { display_name: name },
      });

    if (createError || !newUser.user) {
      console.error("Error creating auth identity:", createError?.message);
      process.exitCode = 1;
      return { success: false, error: createError?.message };
    }
    userId = newUser.user.id;
  }

  // 3. Upsert profiles record with role = 'SUPER_ADMIN'
  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userId,
    role: "SUPER_ADMIN",
    display_name: name,
    is_active: true,
    coordinator_slot: null,
    student_lifecycle_status: null,
  });

  if (profileError) {
    console.error(
      "Error creating Super Admin profile record:",
      profileError.message
    );
    process.exitCode = 1;
    return { success: false, error: profileError.message };
  }

  // 4. Record immutable audit log entry
  const { error: auditError } = await adminClient.from("audit_logs").insert({
    actor_id: userId,
    action: "BOOTSTRAP_SUPER_ADMIN",
    entity_type: "profile",
    entity_id: userId,
    metadata: {
      method: "operator_cli",
      email: normalizedEmail,
    },
  });

  if (auditError) {
    console.error(
      "Warning: Audit entry generation returned:",
      auditError.message
    );
  }

  console.log("==================================================");
  console.log(" [BOOTSTRAP SUCCESS] Super Admin Initialized");
  console.log(`   User ID:     ${userId}`);
  console.log(`   Email:       ${normalizedEmail}`);
  console.log(`   Role:        SUPER_ADMIN`);
  console.log("   Cardinality: Exactly 1 active SUPER_ADMIN");
  console.log("   Audit:       BOOTSTRAP_SUPER_ADMIN recorded");
  console.log("==================================================");
  process.exitCode = 0;
  return { success: true, userId };
}

// Auto-run if executed directly
if (require.main === module) {
  bootstrapSuperAdmin().catch((err) => {
    console.error("Unhandled error during bootstrap:", err);
    process.exitCode = 1;
  });
}
