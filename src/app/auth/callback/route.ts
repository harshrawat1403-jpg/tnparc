import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      // Trigger authenticated student provisioning (idempotent)
      await supabase.rpc("provision_student_account");

      // Resolve profile role for appropriate destination
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role === "STUDENT") {
          return NextResponse.redirect(
            new URL("/student/dashboard", request.url)
          );
        } else if (
          profile?.role === "TNP_COORDINATOR" ||
          profile?.role === "TNP_SECRETARY"
        ) {
          return NextResponse.redirect(
            new URL("/staff/dashboard", request.url)
          );
        } else if (profile?.role === "SUPER_ADMIN") {
          return NextResponse.redirect(new URL("/admin/roles", request.url));
        } else if (profile?.role === "RECRUITER") {
          return NextResponse.redirect(
            new URL("/recruiter/dashboard", request.url)
          );
        }
      }

      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=auth_callback_failed", request.url)
  );
}
