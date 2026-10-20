"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { Database } from "@/types/database";
import {
  submitUpdateCompany,
  submitArchiveCompany,
  submitReactivateCompany,
} from "@/lib/actions/companies";
import {
  submitCreateRecruiterContact,
  submitSendRecruiterInvitation,
  submitRevokeRecruiterInvitation,
  submitDeactivateRecruiterContact,
  submitReactivateRecruiterContact,
} from "@/lib/actions/recruiters";

interface CompanyData {
  id: string;
  name: string;
  normalized_name: string;
  website: string | null;
  description: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export type RecruiterContactView =
  Database["public"]["Views"]["v_staff_recruiter_contacts"]["Row"];

interface CompanyDetailClientProps {
  company: CompanyData;
  contacts: RecruiterContactView[];
  canManage: boolean;
}

export function CompanyDetailClient({
  company,
  contacts,
  canManage,
}: CompanyDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleUpdateCompany(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    setActionMessage(null);

    const formData = new FormData(e.currentTarget);
    const res = await submitUpdateCompany(company.id, null, formData);

    if (res.error) {
      setActionError(res.error);
    } else {
      setActionMessage(res.success || "Company updated.");
      setIsEditOpen(false);
      router.refresh();
    }
  }

  async function handleToggleArchive() {
    if (
      !confirm(
        company.is_archived
          ? `Reactivate "${company.name}"?`
          : `Archive "${company.name}"? Active invitations and new recruiter onboarding will be disabled.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = company.is_archived
        ? await submitReactivateCompany(company.id)
        : await submitArchiveCompany(company.id);

      if (res.error) {
        setActionError(res.error);
      } else {
        setActionMessage(res.success || "Status updated.");
        router.refresh();
      }
    });
  }

  async function handleCreateContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    setActionMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.set("companyId", company.id);

    const res = await submitCreateRecruiterContact(null, formData);
    if (res.error) {
      setActionError(res.error);
    } else {
      setActionMessage(res.success || "Contact created.");
      setIsAddContactOpen(false);
      router.refresh();
    }
  }

  async function handleInviteContact(contactId: string) {
    if (
      !confirm("Send official recruiter invitation email? Valid for 7 days.")
    ) {
      return;
    }

    startTransition(async () => {
      setActionError(null);
      setActionMessage(null);

      const origin = window.location.origin;
      const res = await submitSendRecruiterInvitation(contactId, origin);

      if (res.error) {
        setActionError(res.error);
      } else {
        setActionMessage(res.success || "Invitation sent.");
        router.refresh();
      }
    });
  }

  async function handleRevokeInvitation(invitationId: string) {
    if (!confirm("Revoke this pending invitation?")) return;

    startTransition(async () => {
      setActionError(null);
      setActionMessage(null);

      const res = await submitRevokeRecruiterInvitation(invitationId);
      if (res.error) {
        setActionError(res.error);
      } else {
        setActionMessage(res.success || "Invitation revoked.");
        router.refresh();
      }
    });
  }

  async function handleToggleContactActive(contact: RecruiterContactView) {
    if (!contact.id) return;
    if (
      !confirm(
        contact.is_active
          ? `Deactivate ${contact.full_name || "this contact"}?`
          : `Reactivate ${contact.full_name || "this contact"}?`
      )
    ) {
      return;
    }

    startTransition(async () => {
      setActionError(null);
      setActionMessage(null);

      const res = contact.is_active
        ? await submitDeactivateRecruiterContact(contact.id!)
        : await submitReactivateRecruiterContact(contact.id!);

      if (res.error) {
        setActionError(res.error);
      } else {
        setActionMessage(res.success || "Contact status updated.");
        router.refresh();
      }
    });
  }

  function renderInvitationBadge(status: string | null) {
    switch (status) {
      case "ACCEPTED":
        return (
          <Badge variant="success" size="sm">
            Accepted
          </Badge>
        );
      case "PENDING":
        return (
          <Badge variant="warning" size="sm">
            Pending
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge variant="danger" size="sm">
            Expired
          </Badge>
        );
      case "REVOKED":
        return (
          <Badge variant="danger" size="sm">
            Revoked
          </Badge>
        );
      default:
        return (
          <Badge variant="default" size="sm">
            Never Invited
          </Badge>
        );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Alert Messages */}
      {actionMessage && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm">
          {actionMessage}
        </div>
      )}
      {actionError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          {actionError}
        </div>
      )}

      {/* Company Info Card */}
      <Card padding="lg">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-3 max-w-2xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                Company Overview
              </p>
              <h2 className="text-xl font-bold">{company.name}</h2>
            </div>

            {company.website && (
              <p className="text-sm text-[var(--color-primary)]">
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1"
                >
                  {company.website} &nearr;
                </a>
              </p>
            )}

            <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
              {company.description || "No company description provided."}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-[var(--color-text-tertiary)]">
              <span>
                Created: {new Date(company.created_at).toLocaleDateString()}
              </span>
              <span>
                Last Updated:{" "}
                {new Date(company.updated_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {canManage && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEditOpen(true)}
              >
                Edit Company
              </Button>
              <Button
                variant={company.is_archived ? "secondary" : "destructive"}
                size="sm"
                disabled={isPending}
                onClick={handleToggleArchive}
              >
                {company.is_archived ? "Reactivate Company" : "Archive Company"}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Recruiter Contacts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Associated Recruiter Contacts</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Institutional CRM contacts authorized to recruit for this
              canonical organization.
            </p>
          </div>

          {canManage && !company.is_archived && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddContactOpen(true)}
            >
              + Add Contact
            </Button>
          )}
        </div>

        {contacts.length === 0 ? (
          <Card padding="md" className="text-center py-8">
            <p className="text-sm text-[var(--color-text-secondary)] mb-3">
              No recruiter contacts registered for this company yet.
            </p>
            {canManage && !company.is_archived && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAddContactOpen(true)}
              >
                Add Recruiter Contact
              </Button>
            )}
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-left text-xs divide-y divide-[var(--color-border)]">
              <thead className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] font-medium">
                <tr>
                  <th className="p-3">Contact Person</th>
                  <th className="p-3">Email & Phone</th>
                  <th className="p-3">Contact Status</th>
                  <th className="p-3">Invitation Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-bg)]">
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="hover:bg-[var(--color-bg-secondary)]/50 transition-colors"
                  >
                    <td className="p-3">
                      <Link
                        href={`/staff/recruiters/${contact.id}`}
                        className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
                      >
                        {contact.full_name}
                      </Link>
                      {contact.designation && (
                        <p className="text-[var(--color-text-tertiary)] text-[11px]">
                          {contact.designation}
                        </p>
                      )}
                    </td>

                    <td className="p-3">
                      <p className="font-mono text-[11px] text-[var(--color-text)]">
                        {contact.email}
                      </p>
                      {contact.phone && (
                        <p className="text-[var(--color-text-tertiary)] text-[11px]">
                          {contact.phone}
                        </p>
                      )}
                    </td>

                    <td className="p-3">
                      {contact.is_active ? (
                        <Badge variant="success" size="sm">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="danger" size="sm">
                          Inactive
                        </Badge>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="space-y-1">
                        {renderInvitationBadge(
                          contact.computed_invitation_status
                        )}
                        {contact.computed_invitation_status === "PENDING" &&
                          contact.latest_expires_at && (
                            <p className="text-[10px] text-[var(--color-text-tertiary)]">
                              Expires:{" "}
                              {new Date(
                                contact.latest_expires_at
                              ).toLocaleDateString()}
                            </p>
                          )}
                        {contact.computed_invitation_status === "ACCEPTED" &&
                          contact.latest_accepted_at && (
                            <p className="text-[10px] text-green-600 dark:text-green-400">
                              Accepted:{" "}
                              {new Date(
                                contact.latest_accepted_at
                              ).toLocaleDateString()}
                            </p>
                          )}
                      </div>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/staff/recruiters/${contact.id}`}>
                          <Button variant="ghost" size="sm">
                            Detail &rarr;
                          </Button>
                        </Link>

                        {canManage && (
                          <>
                            {contact.computed_invitation_status === "PENDING" &&
                              contact.latest_invitation_id && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={isPending}
                                  onClick={() =>
                                    handleRevokeInvitation(
                                      contact.latest_invitation_id!
                                    )
                                  }
                                >
                                  Revoke
                                </Button>
                              )}

                            {contact.computed_invitation_status !==
                              "ACCEPTED" &&
                              contact.computed_invitation_status !==
                                "PENDING" &&
                              contact.is_active &&
                              !company.is_archived && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={isPending}
                                  onClick={() =>
                                    contact.id &&
                                    handleInviteContact(contact.id)
                                  }
                                >
                                  Invite
                                </Button>
                              )}

                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isPending}
                              onClick={() => handleToggleContactActive(contact)}
                            >
                              {contact.is_active ? "Deactivate" : "Reactivate"}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Company Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              Edit Company: {company.name}
            </h2>
            <form onSubmit={handleUpdateCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Company Name *
                </label>
                <Input
                  name="name"
                  defaultValue={company.name}
                  required
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Official Website
                </label>
                <Input
                  name="website"
                  defaultValue={company.website || ""}
                  placeholder="https://..."
                  maxLength={500}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Description
                </label>
                <Textarea
                  name="description"
                  rows={3}
                  defaultValue={company.description || ""}
                  maxLength={2000}
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
                  Update Company
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {isAddContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">Add Recruiter Contact</h2>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
              Organization: <strong>{company.name}</strong>
            </p>

            <form onSubmit={handleCreateContact} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Contact Full Name *
                </label>
                <Input
                  name="fullName"
                  required
                  placeholder="e.g. John Doe"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Official Contact Email *
                </label>
                <Input
                  name="email"
                  type="email"
                  required
                  placeholder="e.g. jdoe@company.com"
                  maxLength={255}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Contact Phone
                </label>
                <Input name="phone" placeholder="+91..." maxLength={30} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Designation
                </label>
                <Input
                  name="designation"
                  placeholder="e.g. Campus Talent Lead"
                  maxLength={100}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsAddContactOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Save Contact
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
