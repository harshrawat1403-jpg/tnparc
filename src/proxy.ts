import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 Request Interception (Proxy)
 * Handles session token refresh and role-based route boundary enforcement.
 * Note: Database RLS remains the authoritative security boundary.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const { supabaseResponse, user, profile } = await updateSession(request);

  const isStudentRoute = pathname.startsWith("/student");
  const isStaffRoute = pathname.startsWith("/staff");
  const isAdminRoute = pathname.startsWith("/admin");
  const isRecruiterRoute = pathname.startsWith("/recruiter");
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password";

  // 1. Unauthenticated requests to protected route groups
  if (isStudentRoute || isStaffRoute || isAdminRoute || isRecruiterRoute) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Deactivated account check
    if (profile && !profile.is_active) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "account_deactivated");
      return NextResponse.redirect(loginUrl);
    }

    // Role-specific routing verification
    if (isStudentRoute) {
      if (
        profile?.role !== "STUDENT" ||
        profile?.student_lifecycle_status !== "STUDENT_ACTIVE"
      ) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    } else if (isStaffRoute) {
      if (
        !profile ||
        !["TNP_COORDINATOR", "TNP_SECRETARY", "SUPER_ADMIN"].includes(
          profile.role
        )
      ) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    } else if (isAdminRoute) {
      if (profile?.role !== "SUPER_ADMIN") {
        if (
          profile &&
          ["TNP_COORDINATOR", "TNP_SECRETARY"].includes(profile.role)
        ) {
          return NextResponse.redirect(
            new URL("/staff/dashboard", request.url)
          );
        }
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    } else if (isRecruiterRoute) {
      if (profile?.role !== "RECRUITER") {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    }
  }

  // 2. Authenticated active users navigating to auth pages are redirected to their home dashboard
  if (isAuthPage && user && profile && profile.is_active) {
    if (profile.role === "STUDENT") {
      if (profile.student_lifecycle_status === "STUDENT_ACTIVE") {
        return NextResponse.redirect(
          new URL("/student/dashboard", request.url)
        );
      }
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    } else if (
      profile.role === "TNP_COORDINATOR" ||
      profile.role === "TNP_SECRETARY"
    ) {
      return NextResponse.redirect(new URL("/staff/dashboard", request.url));
    } else if (profile.role === "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/admin/roles", request.url));
    } else if (profile.role === "RECRUITER") {
      return NextResponse.redirect(
        new URL("/recruiter/dashboard", request.url)
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
