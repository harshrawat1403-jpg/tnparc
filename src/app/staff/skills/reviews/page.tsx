import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SkillReviewsClient, SkillReviewRow } from "./SkillReviewsClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Skill Verification Review Queue | Staff Portal",
  description:
    "Scoped staff review and verification queue for student skill declarations.",
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    program?: string;
    batch?: string;
    search?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 20;

export default async function StaffSkillReviewsPage({
  searchParams,
}: PageProps) {
  const resolvedParams = await searchParams;
  const statusParam = resolvedParams.status || "PENDING";
  const programParam = resolvedParams.program || "ALL";
  const batchParam = resolvedParams.batch || "";
  const searchParam = resolvedParams.search || "";
  const pageParam = parseInt(resolvedParams.page || "1", 10);
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/skills/reviews");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, display_name")
    .eq("id", user.id)
    .single();

  const isStaff =
    profile &&
    profile.is_active &&
    ["SUPER_ADMIN", "TNP_SECRETARY", "TNP_COORDINATOR"].includes(profile.role);

  if (!isStaff) {
    redirect("/unauthorized");
  }

  // Fetch academic programs for filtering
  const { data: programs } = await supabase
    .from("academic_programs")
    .select("code, display_name")
    .eq("is_active", true)
    .order("code", { ascending: true });

  // Query v_staff_skill_reviews with bounded pagination (fetch PAGE_SIZE + 1 = 21 items)
  let query = supabase.from("v_staff_skill_reviews").select("*");

  const validStatuses = ["PENDING", "VERIFIED", "REJECTED"] as const;
  type VerificationStatus = (typeof validStatuses)[number];

  if (
    statusParam !== "ALL" &&
    validStatuses.includes(statusParam as VerificationStatus)
  ) {
    query = query.eq("verification_status", statusParam as VerificationStatus);
  }

  if (programParam !== "ALL") {
    query = query.eq("program_code", programParam);
  }

  if (batchParam.trim()) {
    query = query.eq("batch", batchParam.trim());
  }

  if (searchParam.trim()) {
    const term = searchParam.trim();
    query = query.or(`student_name.ilike.%${term}%,skill_name.ilike.%${term}%`);
  }

  const offset = (currentPage - 1) * PAGE_SIZE;
  query = query
    .order("claim_created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE);

  const { data: rawRows, error } = await query;

  if (error) {
    console.error("Error querying skill reviews:", error);
  }

  const rows = (rawRows || []) as SkillReviewRow[];
  const hasNextPage = rows.length > PAGE_SIZE;
  const pageReviews = rows.slice(0, PAGE_SIZE);

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/staff/dashboard"
                  className="text-xs text-[var(--color-text-secondary)] hover:underline"
                >
                  ← Staff Dashboard
                </Link>
                <span className="text-[var(--color-text-secondary)]">/</span>
                <Link
                  href="/staff/skills"
                  className="text-xs text-[var(--color-text-secondary)] hover:underline"
                >
                  Skills Catalog
                </Link>
                <span className="text-[var(--color-text-secondary)]">/</span>
                <Badge variant="default" size="sm">
                  Review Queue
                </Badge>
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                Skill Claim Verification Queue
              </Heading>
              <Text variant="secondary" className="text-sm">
                Evaluate student skill claims and evidence within your
                authorized scope.
              </Text>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/staff/skills">
                <Button variant="secondary" size="sm">
                  Catalog Management
                </Button>
              </Link>
            </div>
          </div>

          {/* Client Reviews Component */}
          <SkillReviewsClient
            initialReviews={pageReviews}
            hasNextPage={hasNextPage}
            currentPage={currentPage}
            totalPrograms={programs || []}
            currentStatus={statusParam}
            currentProgram={programParam}
            currentBatch={batchParam}
            currentSearch={searchParam}
          />
        </div>
      </Container>
    </div>
  );
}
