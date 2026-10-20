import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AcceptInvitationClient } from "./AcceptInvitationClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Accept Recruiter Invitation | VNIT T&P Portal",
  description: "Complete your recruiter portal onboarding and account binding.",
};

export default async function AcceptInvitationPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is not authenticated yet, direct them to check their email or sign in
  if (!user) {
    return (
      <div className="py-16">
        <Container size="sm">
          <Card padding="lg" className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 text-[var(--color-primary)] flex items-center justify-center mx-auto text-xl font-bold">
              ✉
            </div>
            <Heading level={2} className="text-xl font-bold">
              Recruiter Invitation Acceptance
            </Heading>
            <Text variant="secondary" className="text-sm leading-relaxed">
              To accept a portal invitation, please follow the personalized
              secure link sent to your official corporate email address and set
              your account password.
            </Text>
            <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-center gap-3">
              <Link href="/login">
                <Button variant="primary" size="sm">
                  Sign In to Existing Account
                </Button>
              </Link>
            </div>
          </Card>
        </Container>
      </div>
    );
  }

  // Check if caller already has an accepted recruiter profile
  const { data: existingProfile } = await supabase
    .from("recruiter_profiles")
    .select("id, company:companies(name)")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (existingProfile) {
    redirect("/recruiter/dashboard");
  }

  // Inspect caller's current profile role to detect role conflicts
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile && profile.role !== "RECRUITER") {
    return (
      <div className="py-16">
        <Container size="sm">
          <Card padding="lg" className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto text-xl font-bold">
              ✕
            </div>
            <Heading
              level={2}
              className="text-xl font-bold text-red-600 dark:text-red-400"
            >
              Account Role Conflict
            </Heading>
            <Text variant="secondary" className="text-sm leading-relaxed">
              Your authenticated session is currently associated with role{" "}
              <strong>{profile.role}</strong>. Institutional accounts cannot be
              converted to recruiter profiles. Please sign out and accept the
              invitation using your dedicated recruiter credentials.
            </Text>
            <div className="pt-4 border-t border-[var(--color-border)]">
              <Link href="/login">
                <Button variant="secondary" size="sm">
                  Sign Out & Return
                </Button>
              </Link>
            </div>
          </Card>
        </Container>
      </div>
    );
  }

  // Look up matching contact and pending invitation by user's email
  const cleanEmail = (user.email || "").toLowerCase().trim();
  const { data: contact } = await supabase
    .from("recruiter_contacts")
    .select(
      `
      id,
      full_name,
      email,
      designation,
      is_active,
      company:companies (id, name, is_archived)
    `
    )
    .eq("email", cleanEmail)
    .maybeSingle();

  return (
    <div className="py-16">
      <Container size="sm">
        <AcceptInvitationClient
          userEmail={user.email || ""}
          contact={contact}
        />
      </Container>
    </div>
  );
}
