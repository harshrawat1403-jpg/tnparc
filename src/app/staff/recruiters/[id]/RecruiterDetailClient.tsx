"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import {
  submitUpdateRecruiterContact,
  submitSendRecruiterInvitation,
  submitRevokeRecruiterInvitation,
  submitDeactivateRecruiterContact,
  submitReactivateRecruiterContact,
} from "@/lib/actions/recruiters";

interface ContactData {
  id: string;
  company_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  designation: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CompanyData {
  id: string;
  name: string;
  is_archived: boolean;
  website?: string | null;
}

interface BoundProfileData {
  id: string;
  profile_id: string;
  created_at: string;
}

interface InvitationItem {
  id: string;
  status: string;
  invited_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  invited_by: string;
  revoked_by: string | null;
  inviter?: { display_name?: string; role?: string } | null;
  revoker?: { display_name?: string; role?: string } | null;
}

interface RecruiterDetailClientProps {
  contact: ContactData;
  company: CompanyData;
  boundProfile: BoundProfileData | null;
  invitations: InvitationItem[];
  canManage: boolean;
}

export function RecruiterDetailClient({
  contact,
  company,
  boundProfile,
  invitations,
  canManage,
}: RecruiterDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Check latest pending invitation
  const latestPending = invitations.find(
    (inv) => inv.status === "PENDING" && new Date(inv.expires_at) > new Date()
  );

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    const formData = new FormData(e.currentTarget);
    const res = await submitUpdateRecruiterContact(contact.id, null, formData);

    if (res.error) {
      setActionError(res.error);
    } else {
      setActionSuccess(res.success || "Contact updated.");
      setIsEditOpen(false);
      router.refresh();
    }
  }

  type RecruiterConfirmState =
    | { type: "invite" }
    | { type: "revoke"; invitationId: string }
    | { type: "toggle_active" }
    | null;

  const [confirmDialog, setConfirmDialog] =
    useState<RecruiterConfirmState>(null);

  function executeInvite() {
    startTransition(async () => {
      setActionError(null);
      setActionSuccess(null);

      const origin = window.location.origin;
      const res = await submitSendRecruiterInvitation(contact.id, origin);

      if (res.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(res.success || "Invitation sent.");
        router.refresh();
      }
    });
  }

  function executeRevoke(invitationId: string) {
    startTransition(async () => {
      setActionError(null);
      setActionSuccess(null);

      const res = await submitRevokeRecruiterInvitation(invitationId);
      if (res.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(res.success || "Invitation revoked.");
        router.refresh();
      }
    });
  }

  function executeToggleActive() {
    startTransition(async () => {
      setActionError(null);
      setActionSuccess(null);

      const res = contact.is_active
        ? await submitDeactivateRecruiterContact(contact.id)
        : await submitReactivateRecruiterContact(contact.id);

      if (res.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(res.success || "Status updated.");
        router.refresh();
      }
    });
  }

  function renderStatusBadge(inv: InvitationItem) {
    const isExpired =
      inv.status === "PENDING" && new Date(inv.expires_at) <= new Date();

    if (isExpired || inv.status === "EXPIRED") {
      return (
        <Badge variant="danger" size="sm">
          Expired
        </Badge>
      );
    }
    if (inv.status === "ACCEPTED") {
      return (
        <Badge variant="success" size="sm">
          Accepted
        </Badge>
      );
    }
    if (inv.status === "REVOKED") {
      return (
        <Badge variant="danger" size="sm">
          Revoked
        </Badge>
      );
    }
    return (
      <Badge variant="warning" size="sm">
        Pending
      </Badge>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Alert Messages */}
      {actionSuccess && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm">
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          {actionError}
        </div>
      )}

      {/* Grid of Contact and Company details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Contact Info */}
        <Card padding="lg" className="md:col-span-2 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                Contact Profile
              </p>
              <h2 className="text-xl font-bold">{contact.full_name}</h2>
              {contact.designation && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {contact.designation}
                </p>
              )}
            </div>

            {canManage && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditOpen(true)}
                >
                  Edit Details
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setConfirmDialog({ type: "toggle_active" })}
                >
                  {contact.is_active ? "Deactivate" : "Reactivate"}
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--color-border)] text-xs">
            <div>
              <span className="block text-[var(--color-text-tertiary)] mb-1">
                Official Email (Identity Anchor)
              </span>
              <p className="font-mono text-sm font-semibold">{contact.email}</p>
            </div>

            <div>
              <span className="block text-[var(--color-text-tertiary)] mb-1">
                Phone Number
              </span>
              <p className="text-sm">{contact.phone || "Not provided"}</p>
            </div>

            <div>
              <span className="block text-[var(--color-text-tertiary)] mb-1">
                Contact Status
              </span>
              <p>
                {contact.is_active ? (
                  <Badge variant="success" size="sm">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="danger" size="sm">
                    Inactive
                  </Badge>
                )}
              </p>
            </div>

            <div>
              <span className="block text-[var(--color-text-tertiary)] mb-1">
                Registered On
              </span>
              <p className="text-[var(--color-text-secondary)]">
                {new Date(contact.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </Card>

        {/* Company & Bound Account summary */}
        <div className="space-y-6">
          <Card padding="md">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
              Affiliated Organization
            </p>
            <h3 className="font-bold text-base mb-1">
              <Link
                href={`/staff/companies/${company.id}`}
                className="hover:text-[var(--color-primary)] transition-colors"
              >
                {company.name}
              </Link>
            </h3>
            {company.is_archived && (
              <Badge variant="danger" size="sm" className="mb-2">
                Archived Company
              </Badge>
            )}
            {company.website && (
              <p className="text-xs text-[var(--color-primary)] truncate mt-1">
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {company.website} &nearr;
                </a>
              </p>
            )}
          </Card>

          <Card padding="md">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
              Account Status
            </p>
            {boundProfile ? (
              <div className="space-y-1 text-xs">
                <Badge variant="success" size="sm">
                  Active Recruiter Account
                </Badge>
                <p className="text-[var(--color-text-secondary)] mt-1">
                  Bound User ID:{" "}
                  <span className="font-mono text-[10px]">
                    {boundProfile.profile_id.slice(0, 8)}...
                  </span>
                </p>
                <p className="text-[var(--color-text-tertiary)] text-[10px]">
                  Accepted:{" "}
                  {new Date(boundProfile.created_at).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <Badge variant="default" size="sm">
                  No Bound Account
                </Badge>
                <p className="text-[var(--color-text-secondary)]">
                  Recruiter has not yet accepted an invitation to bind an
                  authenticated account.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Invitation Management Section */}
      <Card padding="lg" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Portal Invitation Lifecycle</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Authorized invitations, 7-day expiry windows, and acceptance audit
              trail.
            </p>
          </div>

          {canManage && (
            <div className="flex items-center gap-2">
              {latestPending ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    setConfirmDialog({
                      type: "revoke",
                      invitationId: latestPending.id,
                    })
                  }
                >
                  Revoke Pending Invitation
                </Button>
              ) : (
                !boundProfile &&
                contact.is_active &&
                !company.is_archived && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setConfirmDialog({ type: "invite" })}
                  >
                    Send Invitation Link
                  </Button>
                )
              )}
            </div>
          )}
        </div>

        {/* Status banner */}
        {latestPending && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
            <div>
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                Pending Active Invitation
              </span>
              <p className="text-[var(--color-text-secondary)]">
                Sent: {new Date(latestPending.invited_at).toLocaleString()} |
                Expires: {new Date(latestPending.expires_at).toLocaleString()}
              </p>
            </div>
            {canManage && (
              <Button
                variant="destructive"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  setConfirmDialog({
                    type: "revoke",
                    invitationId: latestPending.id,
                  })
                }
              >
                Revoke
              </Button>
            )}
          </div>
        )}

        {/* History Table */}
        {invitations.length === 0 ? (
          <p className="text-xs text-[var(--color-text-secondary)] py-4 text-center">
            No invitation history recorded for this contact.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-left text-xs divide-y divide-[var(--color-border)]">
              <thead className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] font-medium">
                <tr>
                  <th className="p-3">Status</th>
                  <th className="p-3">Invited At</th>
                  <th className="p-3">Expires At</th>
                  <th className="p-3">Invited By</th>
                  <th className="p-3">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-bg)]">
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td className="p-3">{renderStatusBadge(inv)}</td>
                    <td className="p-3 text-[var(--color-text-secondary)]">
                      {new Date(inv.invited_at).toLocaleString()}
                    </td>
                    <td className="p-3 text-[var(--color-text-secondary)]">
                      {new Date(inv.expires_at).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {inv.inviter?.display_name || inv.invited_by.slice(0, 8)}
                      {inv.inviter?.role && (
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block">
                          ({inv.inviter.role})
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {inv.status === "ACCEPTED" && inv.accepted_at && (
                        <span className="text-green-600 dark:text-green-400">
                          Accepted on{" "}
                          {new Date(inv.accepted_at).toLocaleString()}
                        </span>
                      )}
                      {inv.status === "REVOKED" && inv.revoked_at && (
                        <span className="text-red-500">
                          Revoked on {new Date(inv.revoked_at).toLocaleString()}
                          {inv.revoker?.display_name &&
                            ` by ${inv.revoker.display_name}`}
                        </span>
                      )}
                      {inv.status === "PENDING" &&
                        new Date(inv.expires_at) <= new Date() && (
                          <span className="text-[var(--color-text-tertiary)]">
                            Expired without acceptance
                          </span>
                        )}
                      {inv.status === "PENDING" &&
                        new Date(inv.expires_at) > new Date() && (
                          <span className="text-amber-600 dark:text-amber-400">
                            Awaiting recipient action
                          </span>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">Edit Recruiter Contact</h2>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Contact Full Name *
                </label>
                <Input
                  name="fullName"
                  defaultValue={contact.full_name}
                  required
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Official Email (Read-only anchor)
                </label>
                <Input
                  value={contact.email}
                  disabled
                  className="opacity-70 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Phone Number
                </label>
                <Input
                  name="phone"
                  defaultValue={contact.phone || ""}
                  placeholder="+91..."
                  maxLength={30}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Designation
                </label>
                <Input
                  name="designation"
                  defaultValue={contact.designation || ""}
                  placeholder="e.g. Talent Acquisition"
                  maxLength={100}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsEditOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Update Contact
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Accessible Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog !== null}
        title={
          confirmDialog?.type === "invite"
            ? `Send Recruiter Invitation`
            : confirmDialog?.type === "revoke"
              ? `Revoke Recruiter Invitation`
              : confirmDialog?.type === "toggle_active"
                ? contact.is_active
                  ? `Deactivate ${contact.full_name}`
                  : `Reactivate ${contact.full_name}`
                : "Confirm Action"
        }
        description={
          confirmDialog?.type === "invite"
            ? `An official recruiter invitation email will be dispatched to ${contact.email}, valid for 7 days.`
            : confirmDialog?.type === "revoke"
              ? `This will immediately invalidate the pending recruiter invitation link.`
              : confirmDialog?.type === "toggle_active"
                ? contact.is_active
                  ? `Deactivating will revoke access and prevent this contact from authenticating.`
                  : `Reactivating will restore this recruiter's active status.`
                : "Are you sure you wish to proceed?"
        }
        variant={
          confirmDialog?.type === "revoke"
            ? "danger"
            : confirmDialog?.type === "toggle_active" && contact.is_active
              ? "danger"
              : "primary"
        }
        confirmLabel={
          confirmDialog?.type === "invite"
            ? "Send Invitation"
            : confirmDialog?.type === "revoke"
              ? "Revoke Invitation"
              : confirmDialog?.type === "toggle_active"
                ? contact.is_active
                  ? "Deactivate"
                  : "Reactivate"
                : "Confirm"
        }
        cancelLabel="Cancel"
        isPending={isPending}
        onConfirm={() => {
          if (!confirmDialog) return;
          const current = confirmDialog;
          setConfirmDialog(null);
          if (current.type === "invite") {
            executeInvite();
          } else if (current.type === "revoke") {
            executeRevoke(current.invitationId);
          } else if (current.type === "toggle_active") {
            executeToggleActive();
          }
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
