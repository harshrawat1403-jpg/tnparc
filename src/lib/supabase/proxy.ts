import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export interface SessionResolutionResult {
  supabaseResponse: NextResponse;
  user: { id: string; email?: string } | null;
  profile: {
    role: Database["public"]["Enums"]["user_role"];
    is_active: boolean;
    coordinator_slot: Database["public"]["Enums"]["coordinator_slot"] | null;
    student_lifecycle_status:
      Database["public"]["Enums"]["student_lifecycle_status"] | null;
  } | null;
}

/**
 * Updates session tokens across request/response headers for Next.js 16 Proxy / Middleware.
 * Queries fresh profiles.role and is_active from PostgreSQL (never trusts stale JWT claims).
 */
export async function updateSession(
  request: NextRequest
): Promise<SessionResolutionResult> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { supabaseResponse, user: null, profile: null };
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Verify auth session safely with getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role, is_active, coordinator_slot, student_lifecycle_status")
      .eq("id", user.id)
      .maybeSingle();

    profile = data;
  }

  return { supabaseResponse, user, profile };
}
