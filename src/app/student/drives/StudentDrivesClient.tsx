"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";

interface StudentDriveItem {
  id: string;
  company_id: string;
  company_name: string;
  company_website: string | null;
  title: string;
  drive_type: "PLACEMENT" | "INTERNSHIP";
  status: "PUBLISHED";
  description: string | null;
  location: string | null;
  application_deadline: string | null;
  package_lpa: number | null;
  stipend_monthly: number | null;
  compensation_details: string | null;
  requirements_info: string | null;
  published_at: string | null;
  is_open: boolean;
}

interface Props {
  drives: StudentDriveItem[];
  initialType: string;
  initialSearch: string;
}

export function StudentDrivesClient({
  drives,
  initialType,
  initialSearch,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [type, setType] = useState(initialType);
  const [search, setSearch] = useState(initialSearch);

  function updateFilters(newType: string, newSearch: string) {
    const params = new URLSearchParams();
    if (newType && newType !== "all") params.set("type", newType);
    if (newSearch.trim()) params.set("search", newSearch.trim());
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
          {["all", "placement", "internship"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setType(t);
                updateFilters(t, search);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
                type === t
                  ? "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm font-semibold"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t === "all" ? "All Drives" : t}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <Input
            placeholder="Search drives or roles..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              updateFilters(type, e.target.value);
            }}
          />
        </div>
      </div>

      {/* Drives Grid */}
      {drives.length === 0 ? (
        <Card className="p-8 text-center text-[var(--color-text-secondary)]">
          No drives published matching your search criteria.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {drives.map((drive) => {
            return (
              <Link
                key={drive.id}
                href={`/student/drives/${drive.id}`}
                className="group block"
              >
                <Card className="p-5 h-full flex flex-col justify-between hover:border-[var(--color-primary)] transition-all">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge
                        variant={
                          drive.drive_type === "PLACEMENT" ? "info" : "default"
                        }
                      >
                        {drive.drive_type}
                      </Badge>

                      <Badge variant={drive.is_open ? "success" : "warning"}>
                        {drive.is_open ? "OPEN" : "DEADLINE PASSED"}
                      </Badge>
                    </div>

                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                      {drive.title}
                    </h3>

                    <Text className="text-xs text-[var(--color-text-secondary)] mt-0.5 font-medium">
                      {drive.company_name}
                    </Text>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-[var(--color-text-secondary)]">
                      {drive.location && <span>📍 {drive.location}</span>}
                      {drive.package_lpa !== null && (
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          💰 {drive.package_lpa} LPA
                        </span>
                      )}
                      {drive.stipend_monthly !== null && (
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          💵 ₹{drive.stipend_monthly.toLocaleString()}/mo
                        </span>
                      )}
                    </div>

                    {drive.description && (
                      <p className="text-xs text-[var(--color-text-secondary)] mt-3 line-clamp-2">
                        {drive.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-[var(--color-border)] flex items-center justify-between text-xs">
                    {drive.application_deadline ? (
                      <span className="text-[var(--color-text-secondary)]">
                        Deadline:{" "}
                        <span
                          className={
                            !drive.is_open
                              ? "text-red-500 font-medium"
                              : "text-[var(--color-text-primary)] font-medium"
                          }
                        >
                          {new Date(
                            drive.application_deadline
                          ).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-secondary)]">
                        No deadline
                      </span>
                    )}

                    <span className="text-[var(--color-primary)] font-medium group-hover:underline">
                      View Details &amp; Check Eligibility &rarr;
                    </span>
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
