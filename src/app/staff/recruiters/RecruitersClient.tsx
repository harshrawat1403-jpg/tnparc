"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { Database } from "@/types/database";
import {
  submitCreateRecruiterContact,
  submitSendRecruiterInvitation,
  submitRevokeRecruiterInvitation,
  submitDeactivateRecruiterContact,
  submitReactivateRecruiterContact,
} from "@/lib/actions/recruiters";

export type RecruiterContactView =
  Database["public"]["Views"]["v_staff_recruiter_contacts"]["Row"];

interface CompanyOption {
  id: string;
  name: string;
  is_archived: boolean;
}

interface RecruitersClientProps {
  initialContacts: RecruiterContactView[];
  companies: CompanyOption[];
  canManage: boolean;
  search: string;
  companyId: string;
  active: string;
  invStatus: string;
  currentPage: number;
  hasNextPage: boolean;
}

export function RecruitersClient({
  initialContacts,
  companies,
  canManage,
  search: initialSearch,
  companyId: initialCompanyId,
  active: initialActive,
  invStatus: initialInvStatus,
  currentPage,
  hasNextPage,
}: RecruitersClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedCompany, setSelectedCompany] = useState(initialCompanyId);
  const [activeFilter, setActiveFilter] = useState(initialActive);
  const [invFilter, setInvFilter] = useState(initialInvStatus);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function applyFilters(
    newSearch: string,
    newComp: string,
    newActive: string,
    newInv: string,
    newPage: number = 1
  ) {
    const params = new URLSearchParams();
    if (newSearch.trim()) params.set("search", newSearch.trim());
    if (newComp) params.set("companyId", newComp);
    if (newActive !== "all") params.set("active", newActive);
    if (newInv !== "all") params.set("invStatus", newInv);
    if (newPage > 1) params.set("page", newPage.toString());

    startTransition(() => {
      router.push(`/staff/recruiters?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilters(searchTerm, selectedCompany, activeFilter, invFilter, 1);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    const formData = new FormData(e.currentTarget);
    const res = await submitCreateRecruiterContact(null, formData);

    if (res.error) {
      setActionError(res.error);
    } else {
      setActionSuccess(res.success || "Recruiter contact created.");
      setIsCreateOpen(false);
      router.refresh();
    }
  }

  async function handleInvite(contactId: string) {
    if (
      !confirm("Send official recruiter invitation email? Valid for 7 days.")
    ) {
      return;
    }

    startTransition(async () => {
      setActionError(null);
      setActionSuccess(null);

      const origin = window.location.origin;
      const res = await submitSendRecruiterInvitation(contactId, origin);

      if (res.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(res.success || "Invitation sent.");
        router.refresh();
      }
    });
  }

  async function handleRevoke(invitationId: string) {
    if (!confirm("Revoke this pending recruiter invitation?")) {
      return;
    }

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

  async function handleToggleActive(contact: RecruiterContactView) {
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
      setActionSuccess(null);

      const res = contact.is_active
        ? await submitDeactivateRecruiterContact(contact.id!)
        : await submitReactivateRecruiterContact(contact.id!);

      if (res.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(res.success || "Status updated.");
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
      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-4 p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2 flex-1 max-w-md"
          >
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full text-sm"
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={isPending}
            >
              Search
            </Button>
          </form>

          {canManage && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setActionError(null);
                setActionSuccess(null);
                setIsCreateOpen(true);
              }}
            >
              + Add Recruiter Contact
            </Button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[var(--color-border)] text-xs">
          <div>
            <label className="block text-[var(--color-text-tertiary)] mb-1">
              Company
            </label>
            <Select
              value={selectedCompany}
              onChange={(e) => {
                setSelectedCompany(e.target.value);
                applyFilters(
                  searchTerm,
                  e.target.value,
                  activeFilter,
                  invFilter,
                  1
                );
              }}
              options={[
                { value: "", label: "All Companies" },
                ...companies.map((c) => ({
                  value: c.id,
                  label: `${c.name}${c.is_archived ? " (Archived)" : ""}`,
                })),
              ]}
            />
          </div>

          <div>
            <label className="block text-[var(--color-text-tertiary)] mb-1">
              Contact Status
            </label>
            <Select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                applyFilters(
                  searchTerm,
                  selectedCompany,
                  e.target.value,
                  invFilter,
                  1
                );
              }}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "true", label: "Active Contacts" },
                { value: "false", label: "Inactive Contacts" },
              ]}
            />
          </div>

          <div>
            <label className="block text-[var(--color-text-tertiary)] mb-1">
              Invitation Status
            </label>
            <Select
              value={invFilter}
              onChange={(e) => {
                setInvFilter(e.target.value);
                applyFilters(
                  searchTerm,
                  selectedCompany,
                  activeFilter,
                  e.target.value,
                  1
                );
              }}
              options={[
                { value: "all", label: "All Invitations" },
                { value: "never_invited", label: "Never Invited" },
                { value: "pending", label: "Pending" },
                { value: "accepted", label: "Accepted" },
                { value: "expired", label: "Expired" },
                { value: "revoked", label: "Revoked" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Global Alerts */}
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

      {/* Recruiter Contacts Table */}
      {initialContacts.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            No recruiter contacts found matching the selected filters.
          </p>
          {canManage && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setActionError(null);
                setActionSuccess(null);
                setIsCreateOpen(true);
              }}
            >
              Add First Recruiter Contact
            </Button>
          )}
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-left text-xs divide-y divide-[var(--color-border)]">
            <thead className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] font-medium">
              <tr>
                <th className="p-3">Recruiter Person</th>
                <th className="p-3">Company</th>
                <th className="p-3">Contact Email & Phone</th>
                <th className="p-3">Contact Status</th>
                <th className="p-3">Invitation State</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-bg)]">
              {initialContacts.map((contact) => (
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
                    <Link
                      href={`/staff/companies/${contact.company_id}`}
                      className="text-[var(--color-primary)] hover:underline"
                    >
                      {contact.company_name}
                    </Link>
                    {contact.company_is_archived && (
                      <span className="block text-[10px] text-red-500">
                        Archived Company
                      </span>
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
                                  handleRevoke(contact.latest_invitation_id!)
                                }
                              >
                                Revoke
                              </Button>
                            )}

                          {contact.computed_invitation_status !== "ACCEPTED" &&
                            contact.computed_invitation_status !== "PENDING" &&
                            contact.is_active &&
                            !contact.company_is_archived && (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={isPending}
                                onClick={() =>
                                  contact.id && handleInvite(contact.id)
                                }
                              >
                                Invite
                              </Button>
                            )}

                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() => handleToggleActive(contact)}
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

      {/* Pagination Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)] text-sm">
        <span className="text-[var(--color-text-secondary)] text-xs">
          Page {currentPage}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage <= 1 || isPending}
            onClick={() =>
              applyFilters(
                searchTerm,
                selectedCompany,
                activeFilter,
                invFilter,
                currentPage - 1
              )
            }
          >
            &larr; Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!hasNextPage || isPending}
            onClick={() =>
              applyFilters(
                searchTerm,
                selectedCompany,
                activeFilter,
                invFilter,
                currentPage + 1
              )
            }
          >
            Next &rarr;
          </Button>
        </div>
      </div>

      {/* Create Recruiter Contact Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">Add Recruiter Contact</h2>

            {actionError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                {actionError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Company *
                </label>
                <select
                  name="companyId"
                  required
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">Select a company...</option>
                  {companies
                    .filter((c) => !c.is_archived)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Contact Full Name *
                </label>
                <Input
                  name="fullName"
                  required
                  placeholder="e.g. Sarah Jenkins"
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
                  placeholder="e.g. sjenkins@company.com"
                  maxLength={255}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Phone Number
                </label>
                <Input name="phone" placeholder="+91..." maxLength={30} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Designation
                </label>
                <Input
                  name="designation"
                  placeholder="e.g. HR Manager / Campus Recruiter"
                  maxLength={100}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCreateOpen(false)}
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
