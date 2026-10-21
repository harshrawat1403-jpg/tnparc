import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  StaffApplicationsClient,
  type StaffApplicationItem,
} from "./StaffApplicationsClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Application Workflow & Review | Staff Portal",
  description:
    "Review candidate applications, manage status transitions, and audit eligibility snapshots.",
};

export default async function StaffApplicationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/applications");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, is_active, coordinator_slot")
    .eq("id", user.id)
    .single();

  const isStaff =
    profile &&
    profile.is_active &&
    ["TNP_COORDINATOR", "TNP_SECRETARY", "SUPER_ADMIN"].includes(profile.role);

  if (!isStaff) {
    redirect("/unauthorized");
  }

  // Fetch scoped applications from safe staff view
  const { data: applications = [] } = await supabase
    .from("v_staff_applications")
    .select("*")
    .order("applied_at", { ascending: false });

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default" size="sm">
                  Staff Portal
                </Badge>
                <Badge variant="warning" size="sm">
                  {profile.role}
                </Badge>
                {profile.coordinator_slot && (
                  <Badge variant="info" size="sm">
                    {profile.coordinator_slot}
                  </Badge>
                )}
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                Application Review &amp; Status Machine
              </Heading>
              <Text variant="secondary" className="text-sm">
                Manage candidate shortlists, interview outcomes, and final
                selections with append-only audit enforcement.
              </Text>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/staff/drives">
                <Button variant="secondary" size="sm">
                  &larr; View Drives
                </Button>
              </Link>
              {profile.role === "SUPER_ADMIN" && (
                <Link href="/admin/recovery">
                  <Button variant="destructive" size="sm">
                    Terminal Recovery Portal &rarr;
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <StaffApplicationsClient
            applications={(applications as StaffApplicationItem[]) || []}
            userRole={
              profile.role as
                "SUPER_ADMIN" | "TNP_SECRETARY" | "TNP_COORDINATOR"
            }
          />
        </div>
      </Container>
    </div>
  );
}
