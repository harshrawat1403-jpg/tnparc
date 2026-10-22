import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const instant = false;

export const metadata: Metadata = {
  title: "Student Talent Showcase | VNIT Nagpur",
  description:
    "Explore graduating student cohorts and verified architectural and planning portfolios from the Department of Architecture & Planning, VNIT Nagpur.",
};

interface BatchSummary {
  batch: string;
  program_code: string;
  program_name: string;
  student_count: number;
}

export default async function StudentsLandingPage() {
  const supabase = await createClient();

  const { data: batchesData, error } = await supabase.rpc("get_public_batches");

  const batches = (batchesData as unknown as BatchSummary[]) || [];

  // Group by batch cohort
  const cohortMap = new Map<string, BatchSummary[]>();
  for (const b of batches) {
    const list = cohortMap.get(b.batch) || [];
    list.push(b);
    cohortMap.set(b.batch, list);
  }

  const cohorts = Array.from(cohortMap.entries()).sort(([b1], [b2]) =>
    b2.localeCompare(b1)
  );

  return (
    <div className="py-12 sm:py-16">
      <Container size="lg">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <Badge variant="default" size="sm" className="mb-3">
            Department of Architecture & Planning &bull; VNIT Nagpur
          </Badge>
          <Heading
            level={1}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4"
          >
            Student Talent Directory
          </Heading>
          <Text
            variant="secondary"
            className="text-base sm:text-lg leading-relaxed"
          >
            Discover graduating student talent across Architecture and Urban
            Planning. Browse verified professional profiles, design portfolios,
            and core technical skills.
          </Text>
        </div>

        {/* Directory Content */}
        {error ? (
          <div className="p-4 rounded-[var(--radius-md)] bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900 text-center text-sm">
            Unable to load student directories at this time. Please try again
            later.
          </div>
        ) : cohorts.length === 0 ? (
          <Card padding="lg" className="text-center py-12">
            <Text variant="secondary" className="text-base mb-2">
              No public student showcases are currently available.
            </Text>
            <Text
              variant="small"
              className="text-[var(--color-text-secondary)]"
            >
              Please check back soon as graduating batches publish their talent
              profiles.
            </Text>
          </Card>
        ) : (
          <div className="space-y-12">
            {cohorts.map(([batch, programs]) => {
              const totalInBatch = programs.reduce(
                (sum, p) => sum + Number(p.student_count),
                0
              );

              return (
                <div key={batch} className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--color-border)] gap-2">
                    <div>
                      <Heading
                        level={2}
                        className="text-xl sm:text-2xl font-semibold"
                      >
                        Graduating Class of {batch}
                      </Heading>
                      <Text variant="secondary" className="text-xs sm:text-sm">
                        {totalInBatch}{" "}
                        {totalInBatch === 1 ? "student" : "students"} with
                        public portfolios
                      </Text>
                    </div>

                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/students/${encodeURIComponent(batch)}`}>
                        Browse Entire Class of {batch} &rarr;
                      </Link>
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {programs.map((p) => (
                      <Card
                        key={`${batch}-${p.program_code}`}
                        padding="md"
                        className="flex flex-col justify-between hover:border-[var(--color-primary)] transition-colors"
                      >
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="default" size="sm">
                              {p.program_code}
                            </Badge>
                            <span className="text-xs font-semibold text-[var(--color-primary)]">
                              {p.student_count}{" "}
                              {p.student_count === 1 ? "Profile" : "Profiles"}
                            </span>
                          </div>
                          <Heading
                            level={3}
                            className="text-base font-medium mb-1"
                          >
                            {p.program_name}
                          </Heading>
                          <Text
                            variant="small"
                            className="text-[var(--color-text-secondary)]"
                          >
                            Class of {batch}
                          </Text>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between"
                          asChild
                        >
                          <Link
                            href={`/students/${encodeURIComponent(batch)}?program=${encodeURIComponent(p.program_code)}`}
                          >
                            <span>View Students</span>
                            <span>&rarr;</span>
                          </Link>
                        </Button>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recruiter Notice Box */}
        <div className="mt-16 pt-8 border-t border-[var(--color-border)]">
          <Card
            padding="md"
            className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <Heading level={3} className="text-base font-semibold mb-1">
                  Recruiting from VNIT Architecture & Planning?
                </Heading>
                <Text variant="secondary" className="text-sm">
                  Partner with our Training & Placement cell to coordinate
                  campus drives, review complete student resumes, and organize
                  interview sessions.
                </Text>
              </div>
              <Button variant="primary" size="sm" asChild className="shrink-0">
                <Link href="/for-recruiters">Recruiter Information</Link>
              </Button>
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}
