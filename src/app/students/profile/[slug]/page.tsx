import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const instant = false;

interface PublicProfileProps {
  params: Promise<{ slug: string }>;
}

interface PublicStudentProfileRecord {
  slug: string;
  name: string;
  program_code: string;
  program_name: string;
  graduation_batch: string;
  headline: string | null;
  tagline: string | null;
  has_photo: boolean;
  linkedin_url: string | null;
  portfolio_url: string | null;
  portfolio_available: boolean;
  resume_available: boolean;
  verified_skills: Array<{ name: string; category: string }>;
}

export async function generateMetadata(
  props: PublicProfileProps
): Promise<Metadata> {
  const { slug } = await props.params;
  const cleanSlug = slug?.toLowerCase().trim();

  if (!cleanSlug || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(cleanSlug)) {
    return { title: "Student Profile Not Found | VNIT Nagpur" };
  }

  const supabase = await createClient();
  const { data: rawData } = await supabase.rpc("get_public_student_profile", {
    p_slug: cleanSlug,
  });

  const profile = (rawData as unknown as PublicStudentProfileRecord[])?.[0];

  if (!profile) {
    return { title: "Student Profile Not Found | VNIT Nagpur" };
  }

  return {
    title: `${profile.name} — Student Showcase | Department of Architecture & Planning, VNIT Nagpur`,
    description:
      profile.headline ||
      profile.tagline ||
      `${profile.name} — ${profile.program_name}, Class of ${profile.graduation_batch}, VNIT Nagpur.`,
  };
}

export default async function PublicStudentProfilePage(
  props: PublicProfileProps
) {
  const { slug } = await props.params;
  const cleanSlug = slug?.toLowerCase().trim();

  if (!cleanSlug || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(cleanSlug)) {
    notFound();
  }

  const supabase = await createClient();
  const { data: rawData, error } = await supabase.rpc(
    "get_public_student_profile",
    {
      p_slug: cleanSlug,
    }
  );

  if (error || !rawData || !Array.isArray(rawData) || rawData.length === 0) {
    notFound();
  }

  const profile = rawData[0] as unknown as PublicStudentProfileRecord;

  // Group verified skills by category
  const skillsByCategory = new Map<string, string[]>();
  for (const sk of profile.verified_skills || []) {
    const cat = sk.category || "General";
    const list = skillsByCategory.get(cat) || [];
    list.push(sk.name);
    skillsByCategory.set(cat, list);
  }

  const avatarUrl = profile.has_photo
    ? `/api/public/avatar/${profile.slug}`
    : null;
  const initials = profile.name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="py-10 sm:py-16">
      <Container size="md">
        {/* Breadcrumb Navigation */}
        <div className="mb-6 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <Link
            href="/students"
            className="text-[var(--color-primary)] hover:underline"
          >
            Student Showcase
          </Link>
          <span>&rsaquo;</span>
          <Link
            href={`/students/${encodeURIComponent(profile.graduation_batch)}`}
            className="text-[var(--color-primary)] hover:underline"
          >
            Class of {profile.graduation_batch}
          </Link>
          <span>&rsaquo;</span>
          <span className="font-medium text-[var(--color-text)] truncate max-w-[200px]">
            {profile.name}
          </span>
        </div>

        {/* Profile Header Card */}
        <Card padding="lg" className="mb-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            {/* Avatar Photo */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border)] flex items-center justify-center shrink-0 shadow-sm text-2xl font-bold text-[var(--color-text-secondary)]">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={profile.name}
                  fill
                  sizes="128px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span>{initials || "ST"}</span>
              )}
            </div>

            {/* Profile Identity Details */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                <Heading level={1} className="text-2xl sm:text-3xl font-bold">
                  {profile.name}
                </Heading>
                <div className="flex items-center justify-center sm:justify-end gap-1.5">
                  <Badge variant="default" size="sm">
                    {profile.program_code}
                  </Badge>
                  <Badge variant="default" size="sm">
                    Class of {profile.graduation_batch}
                  </Badge>
                </div>
              </div>

              <Text variant="secondary" className="text-sm font-medium mb-3">
                {profile.program_name} &bull; VNIT Nagpur
              </Text>

              {profile.headline && (
                <Text
                  variant="body"
                  className="text-sm sm:text-base font-medium mb-2"
                >
                  {profile.headline}
                </Text>
              )}

              {profile.tagline && (
                <Text
                  variant="secondary"
                  className="text-xs sm:text-sm mb-4 leading-relaxed"
                >
                  {profile.tagline}
                </Text>
              )}

              {/* Action Links & Indicators */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
                {profile.portfolio_available && profile.portfolio_url && (
                  <Button variant="primary" size="sm" asChild>
                    <a
                      href={profile.portfolio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5"
                    >
                      <span>View Design Portfolio</span>
                      <span>&rarr;</span>
                    </a>
                  </Button>
                )}

                {profile.linkedin_url && (
                  <Button variant="secondary" size="sm" asChild>
                    <a
                      href={profile.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5"
                    >
                      <span>LinkedIn Profile</span>
                      <span>&nearr;</span>
                    </a>
                  </Button>
                )}

                {profile.resume_available && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-md)] bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Resume Available on Institutional Request
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Verified Technical & Design Skills */}
        <Card padding="lg" className="mb-8">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)] mb-4">
            <div>
              <Heading level={2} className="text-lg font-semibold">
                Verified Technical & Professional Skills
              </Heading>
              <Text variant="secondary" className="text-xs">
                Skills independently verified by Department of Architecture &
                Planning faculty.
              </Text>
            </div>
            <Badge variant="default" size="sm">
              {profile.verified_skills?.length || 0} Verified
            </Badge>
          </div>

          {skillsByCategory.size === 0 ? (
            <Text
              variant="small"
              className="text-xs py-4 text-center text-[var(--color-text-secondary)]"
            >
              No verified public skills listed yet.
            </Text>
          ) : (
            <div className="space-y-4">
              {Array.from(skillsByCategory.entries()).map(
                ([category, skills]) => (
                  <div key={category} className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      {category}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skillName) => (
                        <span
                          key={skillName}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] border border-[var(--color-border)]"
                        >
                          {skillName}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </Card>

        {/* Recruiter Institutional Contact Card */}
        <Card
          padding="md"
          className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <Heading level={3} className="text-sm font-semibold">
                Interested in recruiting {profile.name}?
              </Heading>
              <Text variant="secondary" className="text-xs">
                To request official student dossiers, schedule interview slots,
                or conduct recruitment drives, please contact the VNIT Training
                & Placement cell.
              </Text>
            </div>
            <Button variant="secondary" size="sm" asChild className="shrink-0">
              <Link href="/contact">Contact TNP Cell</Link>
            </Button>
          </div>
        </Card>
      </Container>
    </div>
  );
}
