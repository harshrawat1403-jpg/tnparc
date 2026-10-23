"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface AuditLogItem {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  total_count: number;
}

interface AuditViewerClientProps {
  logs: AuditLogItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  userRole: "SUPER_ADMIN" | "TNP_SECRETARY";
  filters: {
    action?: string;
    entity_type?: string;
    start_date?: string;
    end_date?: string;
  };
}

export function AuditViewerClient({
  logs,
  totalCount,
  currentPage,
  pageSize,
  userRole,
  filters,
}: AuditViewerClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [filterAction, setFilterAction] = useState(filters.action || "");
  const [filterEntityType, setFilterEntityType] = useState(
    filters.entity_type || ""
  );
  const [filterStartDate, setFilterStartDate] = useState(
    filters.start_date || ""
  );
  const [filterEndDate, setFilterEndDate] = useState(filters.end_date || "");
  const [inspectItem, setInspectItem] = useState<AuditLogItem | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function handleApplyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("page", "1");
    if (filterAction.trim()) params.set("action", filterAction.trim());
    if (filterEntityType.trim())
      params.set("entity_type", filterEntityType.trim());
    if (filterStartDate.trim())
      params.set("start_date", filterStartDate.trim());
    if (filterEndDate.trim()) params.set("end_date", filterEndDate.trim());

    router.push(`${pathname}?${params.toString()}`);
  }

  function handleResetFilters() {
    setFilterAction("");
    setFilterEntityType("");
    setFilterStartDate("");
    setFilterEndDate("");
    router.push(pathname);
  }

  function handleGoPage(page: number) {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    if (filters.action) params.set("action", filters.action);
    if (filters.entity_type) params.set("entity_type", filters.entity_type);
    if (filters.start_date) params.set("start_date", filters.start_date);
    if (filters.end_date) params.set("end_date", filters.end_date);

    router.push(`${pathname}?${params.toString()}`);
  }

  function getActionBadgeVariant(action: string) {
    if (
      action.includes("DELETE") ||
      action.includes("REVOKE") ||
      action.includes("ARCHIVE") ||
      action.includes("REJECT")
    ) {
      return "danger";
    }
    if (
      action.includes("UPDATE") ||
      action.includes("TRANSITION") ||
      action.includes("CORRECT") ||
      action.includes("CLOSE")
    ) {
      return "warning";
    }
    if (
      action.includes("CREATE") ||
      action.includes("PUBLISH") ||
      action.includes("SELECT") ||
      action.includes("ASSIGN")
    ) {
      return "success";
    }
    return "default";
  }

  return (
    <div className="space-y-6">
      {/* Header and Scope Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Heading level={1} className="text-2xl font-bold text-neutral-900">
              Institutional Audit Log
            </Heading>
            <Badge
              variant={userRole === "SUPER_ADMIN" ? "danger" : "info"}
              size="sm"
            >
              {userRole === "SUPER_ADMIN"
                ? "Full Audit Trail"
                : "Operational Subset"}
            </Badge>
          </div>
          <Text className="text-sm text-neutral-600">
            Immutable, append-only procedural audit trail with defense-in-depth
            privacy safeguards.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/staff/dashboard">
            <Button variant="secondary" size="sm">
              ← Staff Dashboard
            </Button>
          </Link>
          {userRole === "SUPER_ADMIN" && (
            <Link href="/admin/roles">
              <Button variant="secondary" size="sm">
                Role Management
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card padding="md">
        <form onSubmit={handleApplyFilters} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="filter-action"
                className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1"
              >
                Action
              </label>
              <Input
                id="filter-action"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                placeholder="e.g. STATUS_CHANGE, DRIVE_PUBLISHED"
              />
            </div>

            <div>
              <label
                htmlFor="filter-entity"
                className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1"
              >
                Entity Type
              </label>
              <Input
                id="filter-entity"
                value={filterEntityType}
                onChange={(e) => setFilterEntityType(e.target.value)}
                placeholder="e.g. application, placement_drive"
              />
            </div>

            <div>
              <label
                htmlFor="filter-start-date"
                className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1"
              >
                From Date
              </label>
              <Input
                id="filter-start-date"
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="filter-end-date"
                className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1"
              >
                To Date
              </label>
              <Input
                id="filter-end-date"
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
            <span className="text-xs text-neutral-500">
              Showing {logs.length} of {totalCount} records (Page {currentPage}{" "}
              of {totalPages})
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
              >
                Reset
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Apply Filters
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Audit Log Table */}
      <Card padding="none" className="overflow-hidden">
        {logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-500">
            No audit records found matching your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-neutral-200">
              <thead className="bg-neutral-50 text-neutral-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-neutral-50/80 transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-neutral-600 font-mono">
                      {new Date(log.created_at).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge
                        variant={getActionBadgeVariant(log.action)}
                        size="sm"
                      >
                        {log.action}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-neutral-900">
                          {log.actor_name || "System"}
                        </span>
                        {log.actor_role && (
                          <Badge variant="default" size="sm">
                            {log.actor_role}
                          </Badge>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-neutral-700 font-medium">
                      {log.entity_type}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-neutral-500 font-mono">
                      {log.entity_id ? log.entity_id.slice(0, 8) + "..." : "—"}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectItem(log)}
                          className="text-xs py-1 px-2 text-indigo-600 hover:text-indigo-800"
                        >
                          Inspect JSON
                        </Button>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-neutral-200 bg-neutral-50 text-xs">
            <span className="text-neutral-600">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => handleGoPage(currentPage - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => handleGoPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Metadata Inspector Modal */}
      {inspectItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-meta-title"
        >
          <div className="relative w-full max-w-2xl bg-white border border-neutral-200 rounded-lg shadow-xl p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-neutral-200">
              <div>
                <Heading
                  level={2}
                  id="audit-meta-title"
                  className="text-base font-bold text-neutral-900"
                >
                  Audit Event Metadata
                </Heading>
                <Text variant="secondary" className="text-xs mt-1">
                  Action:{" "}
                  <strong className="text-neutral-800">
                    {inspectItem.action}
                  </strong>{" "}
                  • Entity:{" "}
                  <strong className="text-neutral-800">
                    {inspectItem.entity_type}
                  </strong>{" "}
                  ({inspectItem.entity_id})
                </Text>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInspectItem(null)}
              >
                ✕
              </Button>
            </div>

            <div className="flex-1 overflow-auto bg-neutral-900 text-neutral-100 p-4 rounded font-mono text-xs">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(inspectItem.metadata, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-3 border-t border-neutral-200">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setInspectItem(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
