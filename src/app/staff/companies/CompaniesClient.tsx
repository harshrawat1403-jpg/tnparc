"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  submitCreateCompany,
  submitUpdateCompany,
  submitArchiveCompany,
  submitReactivateCompany,
} from "@/lib/actions/companies";

interface CompanyItem {
  id: string;
  name: string;
  normalized_name: string;
  website: string | null;
  description: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

interface CompaniesClientProps {
  initialCompanies: CompanyItem[];
  canManage: boolean;
  search: string;
  status: string;
  currentPage: number;
  hasNextPage: boolean;
}

export function CompaniesClient({
  initialCompanies,
  canManage,
  search: initialSearch,
  status: initialStatus,
  currentPage,
  hasNextPage,
}: CompaniesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyItem | null>(
    null
  );

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  function applyFilters(
    newSearch: string,
    newStatus: string,
    newPage: number = 1
  ) {
    const params = new URLSearchParams();
    if (newSearch.trim()) params.set("search", newSearch.trim());
    if (newStatus !== "active") params.set("status", newStatus);
    if (newPage > 1) params.set("page", newPage.toString());

    startTransition(() => {
      router.push(`/staff/companies?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilters(searchTerm, statusFilter, 1);
  }

  function handleStatusChange(newStatus: string) {
    setStatusFilter(newStatus);
    applyFilters(searchTerm, newStatus, 1);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const formData = new FormData(e.currentTarget);
    const res = await submitCreateCompany(null, formData);

    if (res.error) {
      setFormError(res.error);
    } else {
      setFormSuccess(res.success || "Company created.");
      setIsCreateOpen(false);
      router.refresh();
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingCompany) return;
    setFormError(null);
    setFormSuccess(null);

    const formData = new FormData(e.currentTarget);
    const res = await submitUpdateCompany(editingCompany.id, null, formData);

    if (res.error) {
      setFormError(res.error);
    } else {
      setFormSuccess(res.success || "Company updated.");
      setEditingCompany(null);
      router.refresh();
    }
  }

  async function handleToggleArchive(company: CompanyItem) {
    if (
      !confirm(
        company.is_archived
          ? `Are you sure you want to reactivate "${company.name}"?`
          : `Are you sure you want to archive "${company.name}"? Archived companies cannot issue recruiter invitations.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = company.is_archived
        ? await submitReactivateCompany(company.id)
        : await submitArchiveCompany(company.id);

      if (res.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
        {/* Search */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-2 flex-1 max-w-md"
        >
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by company name..."
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

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-1 text-xs">
            <button
              type="button"
              onClick={() => handleStatusChange("active")}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                statusFilter === "active"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange("archived")}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                statusFilter === "archived"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              Archived
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange("all")}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                statusFilter === "all"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              All
            </button>
          </div>

          {canManage && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setFormError(null);
                setFormSuccess(null);
                setIsCreateOpen(true);
              }}
            >
              + Add Company
            </Button>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {formSuccess && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm">
          {formSuccess}
        </div>
      )}

      {/* Companies Grid / List */}
      {initialCompanies.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            No companies found matching the current criteria.
          </p>
          {canManage && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFormError(null);
                setFormSuccess(null);
                setIsCreateOpen(true);
              }}
            >
              Add First Company
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {initialCompanies.map((company) => (
            <Card
              key={company.id}
              padding="md"
              className="flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <Link
                    href={`/staff/companies/${company.id}`}
                    className="font-semibold text-base hover:text-[var(--color-primary)] transition-colors"
                  >
                    {company.name}
                  </Link>
                  {company.is_archived ? (
                    <Badge variant="danger" size="sm">
                      Archived
                    </Badge>
                  ) : (
                    <Badge variant="success" size="sm">
                      Active
                    </Badge>
                  )}
                </div>

                {company.website && (
                  <p className="text-xs text-[var(--color-primary)] mb-2 truncate">
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {company.website}
                    </a>
                  </p>
                )}

                <p className="text-xs text-[var(--color-text-secondary)] line-clamp-3 mb-2">
                  {company.description || "No description provided."}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)] text-xs">
                <span className="text-[var(--color-text-tertiary)]">
                  Created {new Date(company.created_at).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-2">
                  <Link href={`/staff/companies/${company.id}`}>
                    <Button variant="ghost" size="sm">
                      View Detail &rarr;
                    </Button>
                  </Link>

                  {canManage && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setFormError(null);
                          setFormSuccess(null);
                          setEditingCompany(company);
                        }}
                      >
                        Edit
                      </Button>

                      <Button
                        variant={
                          company.is_archived ? "secondary" : "destructive"
                        }
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleToggleArchive(company)}
                      >
                        {company.is_archived ? "Reactivate" : "Archive"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
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
              applyFilters(searchTerm, statusFilter, currentPage - 1)
            }
          >
            &larr; Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!hasNextPage || isPending}
            onClick={() =>
              applyFilters(searchTerm, statusFilter, currentPage + 1)
            }
          >
            Next &rarr;
          </Button>
        </div>
      </div>

      {/* Create Company Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">Add Canonical Company</h2>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Company Name *
                </label>
                <Input
                  name="name"
                  required
                  placeholder="e.g. Foster & Partners"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Official Website
                </label>
                <Input
                  name="website"
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
                  placeholder="Overview of company, practice areas, or recruitment history..."
                  maxLength={2000}
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
                  Save Company
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Company Modal */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              Edit Company: {editingCompany.name}
            </h2>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Company Name *
                </label>
                <Input
                  name="name"
                  defaultValue={editingCompany.name}
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
                  defaultValue={editingCompany.website || ""}
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
                  defaultValue={editingCompany.description || ""}
                  maxLength={2000}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingCompany(null)}
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
    </div>
  );
}
