"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { submitAcceptRecruiterInvitation } from "@/lib/actions/recruiters";

interface ContactSummary {
  id: string;
  full_name: string;
  email: string;
  designation: string | null;
  is_active: boolean;
  company?: { id: string; name: string; is_archived: boolean } | null;
}

interface AcceptInvitationClientProps {
  userEmail: string;
  contact: ContactSummary | null;
}

export function AcceptInvitationClient({
  userEmail,
  contact,
}: AcceptInvitationClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validation checks prior to user submission
  if (!contact) {
    return (
      <Card padding="lg" className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto text-xl font-bold">
          !
        </div>
        <Heading level={2} className="text-xl font-bold">
          No Matching Recruiter Contact
        </Heading>
        <Text variant="secondary" className="text-sm leading-relaxed">
          The authenticated email address{" "}
          <strong className="font-mono">{userEmail}</strong> does not match any
          registered recruiter contact in our placement portal. Please ensure
          you have clicked the invitation link sent to your official corporate
          email address.
        </Text>
        <div className="pt-4 border-t border-[var(--color-border)]">
          <Link href="/contact">
            <Button variant="secondary" size="sm">
              Contact TNP Office
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (!contact.is_active) {
    return (
      <Card padding="lg" className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto text-xl font-bold">
          ✕
        </div>
        <Heading
          level={2}
          className="text-xl font-bold text-red-600 dark:text-red-400"
        >
          Contact Deactivated
        </Heading>
        <Text variant="secondary" className="text-sm leading-relaxed">
          Your recruiter contact entry has been deactivated by the Training &
          Placement cell. Please contact the TNP office to reactivate your
          credentials.
        </Text>
      </Card>
    );
  }

  if (contact.company?.is_archived) {
    return (
      <Card padding="lg" className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto text-xl font-bold">
          ✕
        </div>
        <Heading
          level={2}
          className="text-xl font-bold text-red-600 dark:text-red-400"
        >
          Company Record Archived
        </Heading>
        <Text variant="secondary" className="text-sm leading-relaxed">
          The corporate entity <strong>{contact.company.name}</strong> is
          currently archived in our system. Recruitment portal onboarding is
          disabled for archived organizations.
        </Text>
      </Card>
    );
  }

  async function handleAccept() {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await submitAcceptRecruiterInvitation();
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setIsSuccess(true);
        setTimeout(() => {
          router.push("/recruiter/dashboard");
        }, 1200);
      }
    });
  }

  if (isSuccess) {
    return (
      <Card padding="lg" className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center mx-auto text-xl font-bold">
          ✓
        </div>
        <Heading
          level={2}
          className="text-xl font-bold text-green-700 dark:text-green-400"
        >
          Invitation Accepted!
        </Heading>
        <Text variant="secondary" className="text-sm leading-relaxed">
          Welcome to the VNIT Training & Placement Portal. Your recruiter
          profile is now active. Redirecting to your dashboard...
        </Text>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="space-y-6">
      <div className="text-center space-y-2 pb-4 border-b border-[var(--color-border)]">
        <Badge variant="default" size="sm">
          Industry Partner Onboarding
        </Badge>
        <Heading level={1} className="text-2xl font-bold">
          Confirm Portal Invitation
        </Heading>
        <Text variant="secondary" className="text-sm">
          Please verify your organization details below to complete your
          recruiter account binding.
        </Text>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Details Box */}
      <div className="rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-text-secondary)]">
            Organization:
          </span>
          <span className="font-semibold text-sm">
            {contact.company?.name || "Corporate Partner"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-text-secondary)]">
            Representative:
          </span>
          <span className="font-medium">{contact.full_name}</span>
        </div>
        {contact.designation && (
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-secondary)]">
              Designation:
            </span>
            <span>{contact.designation}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-text-secondary)]">
            Official Email:
          </span>
          <span className="font-mono">{contact.email}</span>
        </div>
      </div>

      <div className="pt-2 flex flex-col gap-3">
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isPending}
          onClick={handleAccept}
        >
          {isPending
            ? "Activating Recruiter Profile..."
            : "Accept Invitation & Enter Portal →"}
        </Button>

        <p className="text-[11px] text-[var(--color-text-tertiary)] text-center leading-relaxed">
          By accepting, you confirm that you are an authorized representative of{" "}
          <strong>{contact.company?.name}</strong>. Student applications and
          placement drive workflows will adhere to the VNIT Placement Cell
          confidentiality policies.
        </p>
      </div>
    </Card>
  );
}
