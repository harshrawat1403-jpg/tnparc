import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import {
  StudentSkillsClient,
  type CatalogSkill,
  type StudentSkillClaim,
} from "./StudentSkillsClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Skills & Advisory Profile",
  description:
    "Claim technical and professional skills, provide evidence, and view verification status.",
};

export default async function StudentSkillsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/student/skills");
  }

  // Fetch profiles row
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, is_active, student_lifecycle_status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "STUDENT" || !profile.is_active) {
    redirect("/unauthorized");
  }

  // Fetch active skills catalog
  const { data: rawCatalog, error: catalogError } = await supabase
    .from("skills")
    .select("id, name, category, description")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (catalogError) {
    console.error("Error fetching skills catalog:", catalogError);
  }

  const catalog: CatalogSkill[] = (rawCatalog || []).map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    description: s.description,
  }));

  // Fetch student's active claims with skill info and evidence
  const { data: rawClaims, error: claimsError } = await supabase
    .from("student_skills")
    .select(
      `
      id,
      skill_id,
      proficiency_level,
      verification_status,
      is_active,
      created_at,
      skills (
        name,
        category
      ),
      student_skill_evidence (
        id,
        evidence_type,
        evidence_url,
        storage_path,
        description,
        submitted_at
      )
    `
    )
    .eq("student_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (claimsError) {
    console.error("Error fetching student skill claims:", claimsError);
  }

  interface RawEvidenceRow {
    id: string;
    evidence_type: string;
    evidence_url: string | null;
    storage_path: string | null;
    description: string | null;
    submitted_at: string;
  }

  interface RawClaimRow {
    id: string;
    skill_id: string;
    proficiency_level: number;
    verification_status: string;
    is_active: boolean;
    created_at: string;
    skills:
      | { name: string; category: string | null }
      | { name: string; category: string | null }[]
      | null;
    student_skill_evidence: RawEvidenceRow | RawEvidenceRow[] | null;
  }

  const claims: StudentSkillClaim[] = (
    (rawClaims as unknown as RawClaimRow[]) || []
  ).map((row) => {
    const skillData = Array.isArray(row.skills) ? row.skills[0] : row.skills;
    const evidenceData = Array.isArray(row.student_skill_evidence)
      ? row.student_skill_evidence[0]
      : row.student_skill_evidence;

    return {
      id: row.id,
      skill_id: row.skill_id,
      skill_name: skillData?.name || "Unknown Skill",
      skill_category: skillData?.category || null,
      proficiency_level: row.proficiency_level,
      verification_status: row.verification_status as
        "PENDING" | "VERIFIED" | "REJECTED",
      is_active: row.is_active,
      created_at: row.created_at,
      evidence: evidenceData
        ? {
            id: evidenceData.id,
            evidence_type: evidenceData.evidence_type as
              "PROJECT_LINK" | "PDF_DOCUMENT",
            evidence_url: evidenceData.evidence_url,
            storage_path: evidenceData.storage_path,
            description: evidenceData.description,
            submitted_at: evidenceData.submitted_at,
          }
        : null,
    };
  });

  return (
    <div className="py-10">
      <Container size="md">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/student/dashboard"
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  &larr; Back to Dashboard
                </Link>
                <Badge variant="default" size="sm">
                  {profile.student_lifecycle_status || "STUDENT_ACTIVE"}
                </Badge>
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                Skills & Endorsements
              </Heading>
              <Text variant="secondary" className="text-sm">
                Claim up to 15 active skills from the catalog, specify your
                proficiency level, and attach optional portfolio evidence for
                staff review.
              </Text>
            </div>
          </div>

          <StudentSkillsClient catalog={catalog} claims={claims} />
        </div>
      </Container>
    </div>
  );
}
