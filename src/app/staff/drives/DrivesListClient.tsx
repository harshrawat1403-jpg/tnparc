"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";

interface StaffDriveRecord {
  id: string;
  company_id: string;
  company_name: string;
  title: string;
  drive_type: "PLACEMENT" | "INTERNSHIP";
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
  description: string | null;
  location: string | null;
  application_deadline: string | null;
  package_lpa: number | null;
  stipend_monthly: number | null;
  created_at: string;
  published_at: string | null;
  closed_at: string | null;
  archived_at: string | null;
  created_by_name?: string | null;
  published_by_name?: string | null;
  eligible_batches_count?: number | null;
  recruiter_grants_count?: number | null;
}

interface Props {
  drives: StaffDriveRecord[];
  initialStatus: string;
  initialSearch: string;
  canPublishOrClose: boolean;
}

export function DrivesListClient({
  drives,
  initialStatus,
  initialSearch,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState(initialSearch);
  const [now] = useState(() => Date.now());

  function updateFilters(newStatus: string, newSearch: string) {
    const params = new URLSearchParams();
    if (newStatus && newStatus !== "all") params.set("status", newStatus);
    if (newSearch.trim()) params.set("search", newSearch.trim());
    router.push(`${pathname}?${params.toString()}`);
  }

  function getStatusBadge(statusVal: StaffDriveRecord["status"]) {
    switch (statusVal) {
      case "DRAFT":
        return <Badge variant="default">DRAFT</Badge>;
      case "PUBLISHED":
        return <Badge variant="success">PUBLISHED</Badge>;
      case "CLOSED":
        return <Badge variant="warning">CLOSED</Badge>;
      case "ARCHIVED":
        return <Badge variant="danger">ARCHIVED</Badge>;
      default:
        return <Badge variant="default">{statusVal}</Badge>;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search and Filter Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
          {["all", "draft", "published", "closed", "archived"].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatus(st);
                updateFilters(st, search);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
                status === st
                  ? "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm font-semibold"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="w-full md:w-72">
          <Input
            placeholder="Search drives..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              updateFilters(status, e.target.value);
            }}
          />
        </div>
      </div>

      {/* Drives Grid / List */}
      {drives.length === 0 ? (
        <Card className="p-8 text-center text-[var(--color-text-secondary)]">
          No drives found matching the selected filter criteria.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {drives.map((drive) => {
            const isDeadlinePassed =
              drive.application_deadline &&
              new Date(drive.application_deadline).getTime() <= now;

            return (
              <Link
                key={drive.id}
                href={`/staff/drives/${drive.id}`}
                className="group block"
              >
                <Card className="p-5 hover:border-[var(--color-primary)] transition-all">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <Badge
                          variant={
                            drive.drive_type === "PLACEMENT"
                              ? "info"
                              : "default"
                          }
                        >
                          {drive.drive_type}
                        </Badge>
                        {getStatusBadge(drive.status)}
                        <Text className="text-xs text-[var(--color-text-secondary)]">
                          Company:{" "}
                          <span className="font-semibold text-[var(--color-text-primary)]">
                            {drive.company_name}
                          </span>
                        </Text>
                      </div>

                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                        {drive.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-2 text-xs text-[var(--color-text-secondary)]">
                        {drive.location && (
                          <span>📍 Location: {drive.location}</span>
                        )}
                        {drive.package_lpa !== null && (
                          <span>💰 Package: {drive.package_lpa} LPA</span>
                        )}
                        {drive.stipend_monthly !== null && (
                          <span>
                            💵 Stipend: ₹
                            {drive.stipend_monthly.toLocaleString()}/mo
                          </span>
                        )}
                        <span>
                          👥 Eligible Cohorts:{" "}
                          {drive.eligible_batches_count || 0}
                        </span>
                        <span>
                          🔑 Recruiter Grants:{" "}
                          {drive.recruiter_grants_count || 0}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-start md:items-end justify-center shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-[var(--color-border)]">
                      {drive.application_deadline ? (
                        <div className="text-xs">
                          <span className="text-[var(--color-text-secondary)]">
                            Deadline:{" "}
                          </span>
                          <span
                            className={
                              isDeadlinePassed
                                ? "text-red-500 font-medium"
                                : "font-medium"
                            }
                          >
                            {new Date(
                              drive.application_deadline
                            ).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isDeadlinePassed && (
                            <span className="ml-1 text-[10px] text-red-500 uppercase font-bold">
                              (Passed)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          No deadline set
                        </span>
                      )}

                      <span className="text-xs text-[var(--color-primary)] mt-2 font-medium group-hover:underline">
                        Manage Drive &rarr;
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
