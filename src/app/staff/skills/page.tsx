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
import { SkillsCatalogClient } from "./SkillsCatalogClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Skills Catalog Management | Staff Portal",
  description: "Canonical departmental skills catalog management.",
};

export default async function StaffSkillsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/skills");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, display_name")
    .eq("id", user.id)
    .single();

  const isStaff =
    profile &&
    profile.is_active &&
    ["SUPER_ADMIN", "TNP_SECRETARY", "TNP_COORDINATOR"].includes(profile.role);

  if (!isStaff) {
    redirect("/unauthorized");
  }

  const canManage = ["SUPER_ADMIN", "TNP_SECRETARY"].includes(profile.role);

  // Fetch all skills (RLS policy allows staff to see both active and inactive)
  const { data: skills, error } = await supabase
    .from("skills")
    .select("id, name, category, description, is_active, created_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching skills catalog:", error);
  }

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/staff/dashboard"
                  className="text-xs text-[var(--color-text-secondary)] hover:underline"
                >
                  ← Staff Dashboard
                </Link>
                <span className="text-[var(--color-text-secondary)]">/</span>
                <Badge variant="default" size="sm">
                  Skills Management
                </Badge>
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                Department Skills Catalog
              </Heading>
              <Text variant="secondary" className="text-sm">
                Canonical architectural and planning skill declarations.
              </Text>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/staff/skills/reviews">
                <Button variant="secondary" size="sm">
                  Review Queue →
                </Button>
              </Link>
            </div>
          </div>

          {/* Client Catalog Component */}
          <SkillsCatalogClient
            initialSkills={skills || []}
            canManage={canManage}
          />
        </div>
      </Container>
    </div>
  );
}
