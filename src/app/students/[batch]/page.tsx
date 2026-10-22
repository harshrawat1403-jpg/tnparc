import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import {
  BatchDirectoryClient,
  type PublicStudentCard,
} from "./BatchDirectoryClient";

export const instant = false;

interface BatchPageProps {
  params: Promise<{ batch: string }>;
  searchParams: Promise<{
    program?: string;
    skill?: string;
    portfolio?: string;
    search?: string;
    page?: string;
  }>;
}

export async function generateMetadata(
  props: BatchPageProps
): Promise<Metadata> {
  const { batch } = await props.params;
  const decodedBatch = decodeURIComponent(batch);

  return {
    title: `Class of ${decodedBatch} Student Showcase | VNIT Nagpur`,
    description: `Explore student design portfolios and verified professional talent from the Class of ${decodedBatch}, Department of Architecture & Planning, VNIT Nagpur.`,
  };
}

export default async function BatchDirectoryPage(props: BatchPageProps) {
  const { batch } = await props.params;
  const decodedBatch = decodeURIComponent(batch).trim();

  // Basic batch sanitization: alphanumeric, hyphens
  if (!decodedBatch || !/^[a-zA-Z0-9\-]+$/.test(decodedBatch)) {
    notFound();
  }

  const searchParams = await props.searchParams;
  const programFilter = (searchParams.program || "").trim().toUpperCase();
  const skillFilter = (searchParams.skill || "").trim();
  const portfolioFilter = searchParams.portfolio === "true";
  const searchQuery = (searchParams.search || "").trim();
  const currentPage = Math.max(1, parseInt(searchParams.page || "1", 10));
  const pageSize = 21; // Bounded page size <= 24
  const offset = (currentPage - 1) * pageSize;

  const supabase = await createClient();

  // Fetch student cards from narrow public RPC
  const { data: rawStudents, error } = await supabase.rpc(
    "get_public_batch_page",
    {
      p_batch: decodedBatch,
      p_program_code: programFilter || undefined,
      p_skill: skillFilter || undefined,
      p_has_portfolio: portfolioFilter || undefined,
      p_search: searchQuery || undefined,
      p_limit: pageSize,
      p_offset: offset,
    }
  );

  if (error) {
    notFound();
  }

  const students = (rawStudents as unknown as PublicStudentCard[]) || [];
  const totalCount =
    students.length > 0 && students[0] ? Number(students[0].total_count) : 0;

  // Fetch available programs for dropdown
  const { data: programsData } = await supabase
    .from("academic_programs")
    .select("code, display_name")
    .eq("is_active", true)
    .order("code");

  const availablePrograms = (programsData || []).map((p) => ({
    code: p.code,
    name: p.display_name,
  }));

  return (
    <div className="py-10 sm:py-14">
      <Container size="lg">
        {/* Breadcrumb Navigation */}
        <div className="mb-6 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <Link
            href="/students"
            className="text-[var(--color-primary)] hover:underline"
          >
            Student Showcase
          </Link>
          <span>&rsaquo;</span>
          <span className="font-medium text-[var(--color-text)]">
            Class of {decodedBatch}
          </span>
        </div>

        {/* Header Title */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <Heading level={1} className="text-2xl sm:text-3xl font-bold">
              Class of {decodedBatch}
            </Heading>
            <Badge variant="default" size="sm">
              {totalCount} {totalCount === 1 ? "Student" : "Students"}
            </Badge>
          </div>
          <Text variant="secondary" className="text-sm max-w-2xl">
            Browse verified student portfolios and professional profiles for the
            graduating cohort of {decodedBatch}.
          </Text>
        </div>

        {/* Directory Client */}
        <BatchDirectoryClient
          batch={decodedBatch}
          students={students}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          programFilter={programFilter}
          skillFilter={skillFilter}
          portfolioFilter={portfolioFilter}
          searchQuery={searchQuery}
          availablePrograms={availablePrograms}
        />
      </Container>
    </div>
  );
}
