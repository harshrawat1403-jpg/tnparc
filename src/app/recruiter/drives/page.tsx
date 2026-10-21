import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export const instant = false;

export const metadata: Metadata = {
  title: "Assigned Drives | Recruiter Portal",
  description:
    "View placement and internship drives granted access by the TNP Cell.",
};

export default async function RecruiterDrivesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/recruiter/drives");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const isRecruiter =
    profile && profile.role === "RECRUITER" && profile.is_active;

  if (!isRecruiter) {
    redirect("/unauthorized");
  }

  // Fetch granted drives via safe projection view (RLS enforced)
  const { data: drives, error } = await supabase
    .from("v_recruiter_granted_drives")
    .select("*")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Error fetching recruiter granted drives:", error);
  }

  const driveList = drives || [];

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="pb-6 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/recruiter/dashboard"
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                &larr; Recruiter Dashboard
              </Link>
            </div>
            <Heading level={1} className="text-2xl font-bold">
              Assigned Placement Drives
            </Heading>
            <Text className="text-sm text-[var(--color-text-secondary)] mt-1">
              Drives for your company where the Training &amp; Placement cell
              has granted your account explicit access.
            </Text>
          </div>

          {/* Drives List */}
          {driveList.length === 0 ? (
            <Card className="p-8 text-center text-[var(--color-text-secondary)]">
              No placement drives have been granted access to your account yet.
              The placement cell will grant access once a drive is published.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {driveList.map((drive) => {
                const isDeadlinePassed = !drive.is_open;

                return (
                  <Link
                    key={drive.id}
                    href={`/recruiter/drives/${drive.id}`}
                    className="group block"
                  >
                    <Card className="p-5 h-full flex flex-col justify-between hover:border-[var(--color-primary)] transition-all">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <Badge
                            variant={
                              drive.drive_type === "PLACEMENT"
                                ? "info"
                                : "default"
                            }
                          >
                            {drive.drive_type}
                          </Badge>

                          <Badge
                            variant={drive.is_open ? "success" : "warning"}
                          >
                            {drive.is_open ? "OPEN" : "DEADLINE PASSED"}
                          </Badge>
                        </div>

                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                          {drive.title}
                        </h3>

                        <Text className="text-xs text-[var(--color-text-secondary)] mt-0.5 font-medium">
                          {drive.company_name}
                        </Text>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-[var(--color-text-secondary)]">
                          {drive.location && <span>📍 {drive.location}</span>}
                          {drive.package_lpa !== null && (
                            <span className="font-semibold text-[var(--color-text-primary)]">
                              💰 {drive.package_lpa} LPA
                            </span>
                          )}
                          {drive.stipend_monthly !== null && (
                            <span className="font-semibold text-[var(--color-text-primary)]">
                              💵 ₹{drive.stipend_monthly.toLocaleString()}/mo
                            </span>
                          )}
                        </div>

                        {drive.description && (
                          <p className="text-xs text-[var(--color-text-secondary)] mt-3 line-clamp-2">
                            {drive.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-4 mt-4 border-t border-[var(--color-border)] flex flex-col gap-1 text-xs">
                        {drive.application_deadline && (
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--color-text-secondary)]">
                              Deadline:
                            </span>
                            <span
                              className={
                                isDeadlinePassed
                                  ? "text-red-500 font-medium"
                                  : "font-medium"
                              }
                            >
                              {new Date(
                                drive.application_deadline
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        )}

                        {drive.expires_at && (
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--color-text-secondary)]">
                              Access Grant Expiry:
                            </span>
                            <span className="font-medium">
                              {new Date(drive.expires_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}

                        <div className="mt-2 text-right">
                          <span className="text-[var(--color-primary)] font-medium group-hover:underline">
                            View Drive Details &rarr;
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
