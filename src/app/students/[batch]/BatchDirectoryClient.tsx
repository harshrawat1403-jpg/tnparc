"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export interface PublicStudentCard {
  slug: string;
  name: string;
  program_code: string;
  program_name: string;
  graduation_batch: string;
  headline: string | null;
  tagline: string | null;
  has_photo: boolean;
  portfolio_available: boolean;
  portfolio_url: string | null;
  resume_available: boolean;
  top_skills: Array<{ name: string; category: string }>;
  total_count: number;
}

interface BatchDirectoryClientProps {
  batch: string;
  students: PublicStudentCard[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  programFilter: string;
  skillFilter: string;
  portfolioFilter: boolean;
  searchQuery: string;
  availablePrograms: Array<{ code: string; name: string }>;
}

export function BatchDirectoryClient({
  students,
  totalCount,
  currentPage,
  pageSize,
  programFilter,
  skillFilter,
  portfolioFilter,
  searchQuery,
  availablePrograms,
}: BatchDirectoryClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilters = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1"); // Reset to page 1 on filter changes

    for (const [key, value] of Object.entries(newParams)) {
      if (value === null || value === "" || value === "false") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", p.toString());
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-8">
      {/* Search & Filter Controls */}
      <Card padding="md" className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Name Search */}
          <div>
            <label
              htmlFor="search"
              className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
            >
              Search by Name
            </label>
            <Input
              id="search"
              placeholder="e.g. Alice"
              defaultValue={searchQuery}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateFilters({
                    search: (e.target as HTMLInputElement).value,
                  });
                }
              }}
              onBlur={(e) => {
                if (e.target.value !== searchQuery) {
                  updateFilters({ search: e.target.value });
                }
              }}
            />
          </div>

          {/* Program Filter */}
          <div>
            <label
              htmlFor="program"
              className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
            >
              Academic Program
            </label>
            <Select
              id="program"
              value={programFilter}
              onChange={(e) => updateFilters({ program: e.target.value })}
            >
              <option value="">All Programs</option>
              {availablePrograms.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} &mdash; {p.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Skill Filter */}
          <div>
            <label
              htmlFor="skill"
              className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
            >
              Filter by Verified Skill
            </label>
            <Input
              id="skill"
              placeholder="e.g. Revit, GIS"
              defaultValue={skillFilter}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateFilters({
                    skill: (e.target as HTMLInputElement).value,
                  });
                }
              }}
              onBlur={(e) => {
                if (e.target.value !== skillFilter) {
                  updateFilters({ skill: e.target.value });
                }
              }}
            />
          </div>

          {/* Portfolio Only Toggle */}
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[var(--color-text)] py-2.5">
              <input
                type="checkbox"
                checked={portfolioFilter}
                onChange={(e) =>
                  updateFilters({ portfolio: e.target.checked ? "true" : null })
                }
                className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              Has Portfolio Link Only
            </label>
          </div>
        </div>

        {/* Active Filters Summary */}
        {(programFilter || skillFilter || portfolioFilter || searchQuery) && (
          <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
            <span>
              Filtered results: {totalCount} matching{" "}
              {totalCount === 1 ? "student" : "students"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                startTransition(() => {
                  router.push(pathname);
                });
              }}
              className="text-xs text-[var(--color-primary)]"
            >
              Clear All Filters
            </Button>
          </div>
        )}
      </Card>

      {/* Directory Cards Grid */}
      {students.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <Text variant="secondary" className="text-base mb-2">
            No public student profiles found matching your criteria.
          </Text>
          <Text variant="small" className="text-[var(--color-text-secondary)]">
            Try adjusting your search query or clearing active filters.
          </Text>
        </Card>
      ) : (
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 ${isPending ? "opacity-60" : ""}`}
        >
          {students.map((student) => {
            const avatarUrl = student.has_photo
              ? `/api/public/avatar/${student.slug}`
              : null;
            const initials = student.name
              .split(" ")
              .filter(Boolean)
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <Card
                key={student.slug}
                padding="md"
                className="flex flex-col justify-between hover:border-[var(--color-primary)] transition-all hover:shadow-sm"
              >
                <div>
                  {/* Top Header: Avatar & Name */}
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-[var(--color-bg-secondary)] border border-[var(--color-border)] flex items-center justify-center shrink-0 text-sm font-semibold text-[var(--color-text-secondary)]">
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt={student.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <span>{initials || "ST"}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <Heading
                        level={3}
                        className="text-base font-semibold truncate"
                      >
                        {student.name}
                      </Heading>
                      <div className="flex items-center gap-1.5 flex-wrap text-xs text-[var(--color-text-secondary)]">
                        <Badge variant="default" size="sm">
                          {student.program_code}
                        </Badge>
                        <span>&bull;</span>
                        <span>Class of {student.graduation_batch}</span>
                      </div>
                    </div>
                  </div>

                  {/* Headline & Tagline */}
                  {student.headline && (
                    <Text
                      variant="body"
                      className="text-xs font-medium line-clamp-1 mb-1"
                    >
                      {student.headline}
                    </Text>
                  )}
                  {student.tagline && (
                    <Text
                      variant="secondary"
                      className="text-xs line-clamp-2 mb-3"
                    >
                      {student.tagline}
                    </Text>
                  )}

                  {/* Top Skills Badges */}
                  {student.top_skills && student.top_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {student.top_skills.map((sk) => (
                        <span
                          key={sk.name}
                          className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] border border-[var(--color-border)]"
                        >
                          {sk.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer: Indicators & View Profile Button */}
                <div className="pt-3 border-t border-[var(--color-border)] space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    {/* Resume Indicator */}
                    {student.resume_available ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Resume Available
                      </span>
                    ) : (
                      <span />
                    )}

                    {/* Portfolio Indicator */}
                    {student.portfolio_available && student.portfolio_url ? (
                      <a
                        href={student.portfolio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[var(--color-primary)] hover:underline inline-flex items-center gap-0.5"
                      >
                        Portfolio &rarr;
                      </a>
                    ) : (
                      <span />
                    )}
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    asChild
                    className="w-full"
                  >
                    <Link href={`/students/profile/${student.slug}`}>
                      View Profile
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-[var(--color-border)]">
          <Text variant="secondary" className="text-xs">
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount}{" "}
            students
          </Text>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage <= 1 || isPending}
              onClick={() => goToPage(currentPage - 1)}
            >
              &larr; Previous
            </Button>
            <span className="text-xs text-[var(--color-text-secondary)] px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage >= totalPages || isPending}
              onClick={() => goToPage(currentPage + 1)}
            >
              Next &rarr;
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
