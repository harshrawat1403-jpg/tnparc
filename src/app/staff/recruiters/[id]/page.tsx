import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RecruiterDetailClient } from "./RecruiterDetailClient";

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: contact } = await supabase
    .from("recruiter_contacts")
    .select("full_name")
    .eq("id", id)
    .single();

  return {
    title: contact
      ? `${contact.full_name} | Staff Portal`
      : "Recruiter Contact Details",
    description:
      "Recruiter contact details, credentials, and invitation history.",
  };
}

export default async function RecruiterDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/staff/recruiters/${id}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
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

  // Fetch contact along with company info
  const { data: contact, error: contactErr } = await supabase
    .from("recruiter_contacts")
    .select(
      `
      id,
      company_id,
      full_name,
      email,
      phone,
      designation,
      is_active,
      created_at,
      updated_at,
      company:companies (id, name, is_archived, website)
    `
    )
    .eq("id", id)
    .single();

  if (contactErr || !contact) {
    notFound();
  }

  // Fetch bound recruiter_profile if accepted
  const { data: boundProfile } = await supabase
    .from("recruiter_profiles")
    .select("id, profile_id, created_at")
    .eq("recruiter_contact_id", id)
    .maybeSingle();

  // Fetch complete invitation history for this contact
  const { data: invitations } = await supabase
    .from("recruiter_invitations")
    .select(
      `
      id,
      status,
      invited_at,
      expires_at,
      accepted_at,
      revoked_at,
      invited_by,
      revoked_by,
      inviter:profiles!recruiter_invitations_invited_by_fkey(display_name, role),
      revoker:profiles!recruiter_invitations_revoked_by_fkey(display_name, role)
    `
    )
    .eq("recruiter_contact_id", id)
    .order("invited_at", { ascending: false });

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/staff/recruiters"
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                >
                  &larr; Recruiter Contacts
                </Link>
                <span className="text-[var(--color-border)]">|</span>
                <Badge
                  variant={contact.is_active ? "success" : "danger"}
                  size="sm"
                >
                  {contact.is_active ? "Active Contact" : "Inactive Contact"}
                </Badge>
                {boundProfile && (
                  <Badge variant="info" size="sm">
                    Account Bound
                  </Badge>
                )}
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                {contact.full_name}
              </Heading>
              <Text variant="secondary" className="text-sm">
                Representative for{" "}
                <Link
                  href={`/staff/companies/${contact.company_id}`}
                  className="text-[var(--color-primary)] hover:underline font-medium"
                >
                  {(contact.company as unknown as { name?: string })?.name ||
                    "Company"}
                </Link>
              </Text>
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/staff/companies/${contact.company_id}`}>
                <Button variant="secondary" size="sm">
                  Company Detail &rarr;
                </Button>
              </Link>
            </div>
          </div>

          <RecruiterDetailClient
            contact={contact}
            company={
              contact.company as unknown as {
                id: string;
                name: string;
                is_archived: boolean;
                website?: string | null;
              }
            }
            boundProfile={boundProfile}
            invitations={invitations || []}
            canManage={canManage}
          />
        </div>
      </Container>
    </div>
  );
}
