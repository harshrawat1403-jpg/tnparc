import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitSignOut } from "@/lib/actions/auth";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const instant = false;

export const metadata: Metadata = {
  title: "Recruiter Dashboard",
  description: "Recruiter portal shell for verified industry partners.",
};

export default async function RecruiterDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/recruiter/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "RECRUITER" || !profile.is_active) {
    redirect("/unauthorized");
  }

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default" size="sm">
                  Industry Portal
                </Badge>
                <Badge variant="warning" size="sm">
                  RECRUITER
                </Badge>
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                Recruiter Portal: {profile.display_name}
              </Heading>
              <Text variant="secondary" className="text-sm">
                Department of Architecture & Planning — VNIT Nagpur
              </Text>
            </div>

            <form action={submitSignOut}>
              <Button type="submit" variant="secondary" size="sm">
                Sign Out
              </Button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card padding="md">
              <Heading level={3} className="text-base mb-1">
                Phase 3 RBAC Foundation Active
              </Heading>
              <Text variant="secondary" className="text-xs mb-3">
                Default-deny data access enforced via PostgreSQL RLS.
              </Text>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Recruiter invitations, company linkage, and drive management
                workflows will activate in Phase 6. Student resumes and internal
                applicant data are strictly blocked under Phase 3 RLS policies.
              </p>
            </Card>

            <Card padding="md">
              <Heading level={3} className="text-base mb-1">
                Session Identity
              </Heading>
              <Text variant="secondary" className="text-xs mb-3">
                Authenticated session details.
              </Text>
              <div className="text-xs space-y-1 text-[var(--color-text-secondary)]">
                <p>
                  User ID:{" "}
                  <span className="font-mono">{user.id.slice(0, 8)}...</span>
                </p>
                <p>
                  Role:{" "}
                  <strong className="text-[var(--color-text)]">
                    RECRUITER
                  </strong>
                </p>
                <p>
                  Status:{" "}
                  <span className="text-emerald-600 font-medium">Active</span>
                </p>
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}
