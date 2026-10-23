import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const instant = false;

export const metadata: Metadata = {
  title: "Announcements | Student Portal",
  description: "Official notices and placement announcements for students.",
};

export default async function StudentAnnouncementsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/student/announcements");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, student_lifecycle_status")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    profile.role !== "STUDENT" ||
    !profile.is_active ||
    profile.student_lifecycle_status !== "STUDENT_ACTIVE"
  ) {
    redirect("/unauthorized");
  }

  // Server-first load of visible student announcements
  const { data: announcements, error } = await supabase.rpc(
    "get_my_announcements",
    {
      p_limit: 50,
      p_offset: 0,
    }
  );

  if (error) {
    console.error("Error loading student announcements:", error.message);
  }

  const items = announcements || [];

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-neutral-200">
        <Container className="py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/student/dashboard"
              className="text-sm font-medium text-neutral-500 hover:text-neutral-900"
            >
              ← Back to Student Dashboard
            </Link>
            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
              Student Portal
            </span>
          </div>
        </Container>
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none">
        <Container className="py-8 space-y-6">
          <div>
            <Heading level={1} className="text-2xl font-bold text-neutral-900">
              Department Notices & Announcements
            </Heading>
            <Text className="text-sm text-neutral-600 mt-1">
              Official placement notifications, schedule updates, and
              departmental directives.
            </Text>
          </div>

          {items.length === 0 ? (
            <Card className="p-12 text-center">
              <Text className="text-neutral-500">
                There are no active announcements for you at this time.
              </Text>
            </Card>
          ) : (
            <div className="space-y-4">
              {items.map((a) => {
                const pubDate = a.published_at
                  ? new Date(a.published_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : null;

                const expDate = a.expires_at
                  ? new Date(a.expires_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : null;

                return (
                  <Card
                    key={a.id}
                    className="p-6 border border-neutral-200 shadow-sm"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Heading
                          level={2}
                          className="text-lg font-semibold text-neutral-900"
                        >
                          {a.title}
                        </Heading>
                        <Badge variant="info">
                          {a.audience === "ALL"
                            ? "Campus Notice"
                            : "Student Notice"}
                        </Badge>
                      </div>

                      <p className="text-sm text-neutral-700 whitespace-pre-line leading-relaxed">
                        {a.body}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 pt-3 border-t border-neutral-100">
                        {pubDate && <span>Posted: {pubDate}</span>}
                        {expDate && <span>Valid until: {expDate}</span>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Container>
      </main>
    </div>
  );
}
