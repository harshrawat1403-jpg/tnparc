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
import { AdminRecoveryClient } from "./AdminRecoveryClient";
import type { StaffApplicationItem } from "@/app/staff/applications/StaffApplicationsClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Super Admin Terminal Recovery | Admin Portal",
  description:
    "Authoritatively correct terminal application states with append-only audit enforcement.",
};

export default async function AdminTerminalRecoveryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/admin/recovery");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, is_active")
    .eq("id", user.id)
    .single();

  const isSuperAdmin =
    profile && profile.is_active && profile.role === "SUPER_ADMIN";

  if (!isSuperAdmin) {
    redirect("/unauthorized");
  }

  // Fetch terminal applications from safe staff view
  const { data: terminalApps = [] } = await supabase
    .from("v_staff_applications")
    .select("*")
    .in("application_status", ["SELECTED", "REJECTED", "WITHDRAWN"])
    .order("applied_at", { ascending: false });

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="danger" size="sm">
                  Super Admin
                </Badge>
                <Badge variant="warning" size="sm">
                  Authoritative Recovery
                </Badge>
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                Terminal Status Correction Portal
              </Heading>
              <Text variant="secondary" className="text-sm">
                Reverse terminal states (SELECTED, REJECTED, WITHDRAWN) to
                immediate prior non-terminal states with mandatory justification
                reasons.
              </Text>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/staff/applications">
                <Button variant="secondary" size="sm">
                  &larr; Staff Applications
                </Button>
              </Link>
            </div>
          </div>

          <AdminRecoveryClient
            terminalApplications={
              (terminalApps as StaffApplicationItem[]) || []
            }
          />
        </div>
      </Container>
    </div>
  );
}
