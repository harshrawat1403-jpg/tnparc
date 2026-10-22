"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";

export interface PublicAlumnus {
  name: string;
  graduation_year: number;
  program_code: string;
  program_name: string;
  professional_domain: string | null;
  city: string | null;
  country: string | null;
  current_employer: string | null;
  designation: string | null;
  total_count: number;
}

interface AlumniDirectoryClientProps {
  initialAlumni: PublicAlumnus[];
  programs: { code: string; display_name: string }[];
  currentYear?: number;
  currentProgram?: string;
  currentSearch?: string;
  currentPage: number;
  pageSize: number;
}

export function AlumniDirectoryClient({
  initialAlumni,
  programs,
  currentYear,
  currentProgram,
  currentSearch = "",
  currentPage,
  pageSize,
}: AlumniDirectoryClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [yearInput, setYearInput] = useState<string>(
    currentYear ? String(currentYear) : ""
  );
  const [progInput, setProgInput] = useState<string>(currentProgram || "");
  const [searchInput, setSearchInput] = useState<string>(currentSearch);

  const totalCount = initialAlumni[0]?.total_count
    ? Number(initialAlumni[0].total_count)
    : initialAlumni.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  const applyFilters = (page = 1) => {
    const params = new URLSearchParams();
    if (yearInput.trim()) params.set("year", yearInput.trim());
    if (progInput.trim()) params.set("program", progInput.trim());
    if (searchInput.trim()) params.set("search", searchInput.trim());
    if (page > 1) params.set("page", String(page));

    startTransition(() => {
      router.push(`/alumni?${params.toString()}`);
    });
  };

  const handleReset = () => {
    setYearInput("");
    setProgInput("");
    setSearchInput("");
    startTransition(() => {
      router.push("/alumni");
    });
  };

  return (
    <div className="space-y-8">
      {/* Search and Filters Bar */}
      <Card padding="md" className="border shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters(1);
          }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label
              htmlFor="alumni-search"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
            >
              Search by Name
            </label>
            <input
              id="alumni-search"
              type="text"
              placeholder="e.g. Rahul Sharma"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label
              htmlFor="alumni-year"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
            >
              Graduation Year
            </label>
            <input
              id="alumni-year"
              type="number"
              placeholder="e.g. 2024"
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              min={1960}
              max={2100}
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label
              htmlFor="alumni-program"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
            >
              Program
            </label>
            <select
              id="alumni-program"
              value={progInput}
              onChange={(e) => setProgInput(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="">All Programs</option>
              {programs.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} — {p.display_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="flex-1"
              disabled={isPending}
            >
              {isPending ? "Filtering..." : "Search"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleReset}
              disabled={isPending}
            >
              Clear
            </Button>
          </div>
        </form>
      </Card>

      {/* Results Header */}
      <div className="flex justify-between items-center text-sm text-[var(--color-text-secondary)]">
        <span>
          Showing {initialAlumni.length} of {totalCount} alumni
        </span>
        {totalPages > 1 && (
          <span>
            Page {currentPage} of {totalPages}
          </span>
        )}
      </div>

      {/* Directory Grid */}
      {initialAlumni.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <Text variant="secondary" className="text-base mb-2">
            No alumni found matching your filter criteria.
          </Text>
          <Text variant="secondary" className="text-xs">
            Only alumni who have opted into the public directory are visible.
          </Text>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {initialAlumni.map((alum, idx) => {
            const location = [alum.city, alum.country]
              .filter(Boolean)
              .join(", ");
            return (
              <Card
                key={`${alum.name}-${alum.graduation_year}-${idx}`}
                padding="md"
                className="flex flex-col justify-between hover:shadow-md transition-shadow border"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <Heading
                        level={3}
                        className="text-lg font-semibold text-[var(--color-text-primary)]"
                      >
                        {alum.name}
                      </Heading>
                      <Text variant="secondary" className="text-xs">
                        Class of {alum.graduation_year} &bull;{" "}
                        {alum.program_code}
                      </Text>
                    </div>
                    <Badge variant="default" size="sm">
                      {alum.program_code}
                    </Badge>
                  </div>

                  {alum.designation && (
                    <Text className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                      {alum.designation}
                    </Text>
                  )}

                  {alum.current_employer && (
                    <Text
                      variant="secondary"
                      className="text-sm mb-2 font-normal"
                    >
                      at{" "}
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {alum.current_employer}
                      </span>
                    </Text>
                  )}

                  {alum.professional_domain && (
                    <div className="mt-2 mb-3">
                      <Badge variant="default" size="sm">
                        {alum.professional_domain}
                      </Badge>
                    </div>
                  )}
                </div>

                {location && (
                  <div className="pt-3 border-t border-[var(--color-border)] mt-2">
                    <Text
                      variant="secondary"
                      className="text-xs flex items-center gap-1"
                    >
                      <span>📍</span> {location}
                    </Text>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 pt-6">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => applyFilters(currentPage - 1)}
            disabled={currentPage <= 1 || isPending}
          >
            Previous
          </Button>
          <span className="text-sm text-[var(--color-text-secondary)] font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => applyFilters(currentPage + 1)}
            disabled={currentPage >= totalPages || isPending}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
