import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Divider } from "@/components/ui/Divider";

export const metadata: Metadata = {
  title: "Information for Recruiters",
  description:
    "Information for architectural practices, planning consultancies, and corporate recruiters seeking talent from the Department of Architecture & Planning, VNIT Nagpur.",
};

export default function ForRecruitersPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container size="lg">
        {/* Page Header */}
        <div className="max-w-3xl flex flex-col gap-4">
          <Badge variant="default" size="md">
            Corporate & Studio Relations
          </Badge>
          <Heading level={1}>Information for Prospective Recruiters</Heading>
          <Text variant="lead">
            Partner with the Department of Architecture & Planning, VNIT Nagpur
            to engage top-tier graduating architects, urban planners, and intern
            candidates.
          </Text>
        </div>

        <Divider spacing="lg" />

        {/* Why Recruit Section */}
        <section aria-label="Why Recruit VNIT Architecture" className="my-8">
          <Heading level={2} className="text-xl mb-6">
            Why Recruit at VNIT Architecture & Planning?
          </Heading>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card padding="lg" className="flex flex-col gap-3">
              <span className="text-xs font-mono font-bold text-[var(--color-accent)] bg-[var(--color-accent-muted)] px-2 py-0.5 rounded-[var(--radius-sm)] w-fit">
                PEDAGOGY
              </span>
              <Heading level={3}>Studio-Tested Rigor</Heading>
              <Text variant="secondary">
                Rigorous 5-year and 2-year curricula balancing structural
                engineering realities with contextual architectural expression
                and sustainable climate-responsive design.
              </Text>
            </Card>

            <Card padding="lg" className="flex flex-col gap-3">
              <span className="text-xs font-mono font-bold text-[var(--color-accent)] bg-[var(--color-accent-muted)] px-2 py-0.5 rounded-[var(--radius-sm)] w-fit">
                TECHNOLOGY
              </span>
              <Heading level={3}>Computational Proficiency</Heading>
              <Text variant="secondary">
                Advanced proficiency across industry workflows including
                Building Information Modeling (Revit/BIM), parametric design
                (Rhino/Grasshopper), GIS spatial analysis, and rendering tools.
              </Text>
            </Card>

            <Card padding="lg" className="flex flex-col gap-3">
              <span className="text-xs font-mono font-bold text-[var(--color-accent)] bg-[var(--color-accent-muted)] px-2 py-0.5 rounded-[var(--radius-sm)] w-fit">
                INTEGRITY
              </span>
              <Heading level={3}>Institutional Verification</Heading>
              <Text variant="secondary">
                All student transcripts, active backlogs, CGPA records, and
                skill endorsements are validated against institutional records
                prior to recruitment drives.
              </Text>
            </Card>
          </div>
        </section>

        {/* Recruitment Timeline & Procedure */}
        <section aria-label="Recruitment Process" className="my-12">
          <Heading level={2} className="text-xl mb-6">
            Recruitment Process & Timelines
          </Heading>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card padding="md" className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[var(--color-accent)]">
                STAGE 01
              </span>
              <Heading level={4}>Invitation & Registration</Heading>
              <Text variant="secondary" className="text-xs">
                Recruiters submit company interest or receive an official 7-day
                invitation token from the departmental T&P Officer.
              </Text>
            </Card>

            <Card padding="md" className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[var(--color-accent)]">
                STAGE 02
              </span>
              <Heading level={4}>Opportunity Announcement</Heading>
              <Text variant="secondary" className="text-xs">
                Job notifications, role profiles, eligibility criteria, and
                schedules are officially published to verified cohorts.
              </Text>
            </Card>

            <Card padding="md" className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[var(--color-accent)]">
                STAGE 03
              </span>
              <Heading level={4}>Shortlisting & Interviews</Heading>
              <Text variant="secondary" className="text-xs">
                Recruiter teams conduct design portfolio assessments, technical
                evaluations, and personal interviews (hybrid or on-campus).
              </Text>
            </Card>

            <Card padding="md" className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[var(--color-accent)]">
                STAGE 04
              </span>
              <Heading level={4}>Selection & Offers</Heading>
              <Text variant="secondary" className="text-xs">
                Formal selection lists are finalized through the T&P Cell under
                institute placement policy guidelines.
              </Text>
            </Card>
          </div>
        </section>

        {/* Contact CTA */}
        <section aria-label="Engage With Us" className="my-12">
          <Card
            padding="lg"
            className="bg-[var(--color-surface-alt)] border-[var(--color-border-strong)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
          >
            <div className="flex flex-col gap-2 max-w-xl">
              <Heading level={3}>Schedule a Recruitment Drive</Heading>
              <Text variant="secondary">
                To initiate campus recruitment or discuss practical training
                opportunities, reach out to our departmental placement team.
              </Text>
            </div>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] transition-colors shadow-sm"
            >
              Contact Placement Cell
            </Link>
          </Card>
        </section>
      </Container>
    </div>
  );
}
