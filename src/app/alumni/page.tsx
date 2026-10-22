import React from "react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import {
  AlumniDirectoryClient,
  type PublicAlumnus,
} from "./AlumniDirectoryClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Alumni Directory | VNIT Nagpur",
  description:
    "Explore the network of distinguished architecture and urban planning alumni from VNIT Nagpur. Connect with graduates across leading global practices and institutions.",
};

interface AlumniPageProps {
  searchParams: Promise<{
    year?: string;
    program?: string;
    search?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 24;

export default async function PublicAlumniDirectoryPage({
  searchParams,
}: AlumniPageProps) {
  const resolvedParams = await searchParams;
  const graduationYear = resolvedParams.year
    ? parseInt(resolvedParams.year, 10)
    : undefined;
  const programCode = resolvedParams.program || undefined;
  const search = resolvedParams.search || undefined;
  const currentPage = Math.max(1, parseInt(resolvedParams.page || "1", 10));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const supabase = await createClient();

  // Fetch academic programs for filter dropdown
  const { data: programsData } = await supabase
    .from("academic_programs")
    .select("code, display_name")
    .order("code", { ascending: true });

  const programs = programsData || [];

  // Call privacy-safe narrow RPC
  const { data: alumniData, error } = await supabase.rpc(
    "get_public_alumni_directory",
    {
      p_graduation_year:
        graduationYear && !isNaN(graduationYear) ? graduationYear : undefined,
      p_program_code: programCode || undefined,
      p_search: search || undefined,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    }
  );

  const alumni = (alumniData as unknown as PublicAlumnus[]) || [];

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
            Alumni Directory
          </Heading>
          <Text
            variant="secondary"
            className="text-base sm:text-lg leading-relaxed"
          >
            Discover and connect with VNIT Architecture and Urban Planning
            graduates leading industry practices, urban governance, research,
            and academia globally.
          </Text>
        </div>

        {error ? (
          <div className="p-4 rounded-[var(--radius-md)] bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900 text-center text-sm">
            Unable to load the alumni directory at this time. Please try again
            later.
          </div>
        ) : (
          <AlumniDirectoryClient
            initialAlumni={alumni}
            programs={programs}
            currentYear={
              graduationYear && !isNaN(graduationYear)
                ? graduationYear
                : undefined
            }
            currentProgram={programCode}
            currentSearch={search}
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
          />
        )}
      </Container>
    </div>
  );
}
