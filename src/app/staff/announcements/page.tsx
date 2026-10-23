import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { StaffAnnouncementsClient } from "./StaffAnnouncementsClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Announcement Management | TNP Staff",
  description:
    "Create, edit, publish, and archive institutional placement notices.",
};

export default async function StaffAnnouncementsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/announcements");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, display_name")
    .eq("id", user.id)
    .single();

  // Prompt 28: Coordinator hitting management route: denied / redirected / not-found, no draft enumeration.
  // Super Admin and TNP Secretary only.
  const isAuthorized =
    profile &&
    profile.is_active &&
    ["SUPER_ADMIN", "TNP_SECRETARY"].includes(profile.role);

  if (!isAuthorized) {
    redirect("/unauthorized");
  }

  // Load announcements for management
  const { data: announcements, error } = await supabase.rpc(
    "get_staff_announcements",
    {
      p_limit: 50,
      p_offset: 0,
    }
  );

  if (error) {
    console.error("Error loading staff announcements:", error.message);
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      {/* Navigation Bar */}
      <header className="bg-white border-b border-neutral-200">
        <Container className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/staff/dashboard"
                className="text-sm font-medium text-neutral-500 hover:text-neutral-900"
              >
                ← Back to Staff Dashboard
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-neutral-100 text-neutral-800 px-2.5 py-1 rounded-full font-semibold">
                {profile.role}
              </span>
            </div>
          </div>
        </Container>
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none">
        <Container className="py-8">
          <StaffAnnouncementsClient
            initialAnnouncements={announcements || []}
            userRole={profile.role}
          />
        </Container>
      </main>
    </div>
  );
}
