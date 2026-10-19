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
import { RolesForm } from "./RolesForm";

export const instant = false;

export const metadata: Metadata = {
  title: "Role Management",
  description: "Super Admin staff role and coordinator slot management.",
};

export default async function AdminRolesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/admin/roles");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, display_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "SUPER_ADMIN" || !profile.is_active) {
    redirect("/unauthorized");
  }

  // Fetch all staff profiles
  const { data: staffList } = await supabase
    .from("profiles")
    .select("id, display_name, role, coordinator_slot, is_active")
    .in("role", ["SUPER_ADMIN", "TNP_SECRETARY", "TNP_COORDINATOR"])
    .eq("is_active", true);

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="warning" size="sm">
                  SUPER_ADMIN
                </Badge>
                <Badge variant="default" size="sm">
                  Role Administration
                </Badge>
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                Staff Role & Slot Management
              </Heading>
              <Text variant="secondary" className="text-sm">
                Authoritative assignment of Secretary and Coordinator slots via
                protected procedure.
              </Text>
            </div>

            <form action={submitSignOut}>
              <Button type="submit" variant="secondary" size="sm">
                Sign Out
              </Button>
            </form>
          </div>

          <Card padding="lg" className="border-[var(--color-border)] shadow-sm">
            <RolesForm staffProfiles={staffList || []} />
          </Card>
        </div>
      </Container>
    </div>
  );
}
