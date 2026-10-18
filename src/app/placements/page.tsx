import React from "react";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Divider } from "@/components/ui/Divider";

export const metadata: Metadata = {
  title: "Placement Statistics & Highlights",
  description:
    "Official aggregate placement statistics and recruiting partners for the Department of Architecture & Planning, VNIT Nagpur. Zero student personal data is exposed.",
};

export default function PlacementsPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container size="lg">
        {/* Page Header */}
        <div className="max-w-3xl flex flex-col gap-4">
          <Badge variant="default" size="md">
            Placement Records
          </Badge>
          <Heading level={1}>Placement Statistics & Highlights</Heading>
          <Text variant="lead">
            Department-approved aggregate placement statistics, sectors of
            recruitment, and prospective partner firms. In accordance with
            institutional privacy standards, all student PII is strictly
            protected.
          </Text>
        </div>

        <Divider spacing="lg" />

        {/* Aggregate Metrics (Placeholder data for UI demonstration) */}
        <section aria-label="Aggregate Placement Metrics" className="my-8">
          <Heading level={2} className="text-xl mb-6">
            Aggregate Performance Overview
          </Heading>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card padding="md">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Recruitment Rate
              </span>
              <p className="text-3xl font-bold tracking-tight text-[var(--color-accent)] mt-2">
                85%+
              </p>
              <Text variant="secondary" className="mt-1">
                Average registered student placement across academic sessions.
              </Text>
            </Card>

            <Card padding="md">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Participating Practices
              </span>
              <p className="text-3xl font-bold tracking-tight text-[var(--color-accent)] mt-2">
                40+
              </p>
              <Text variant="secondary" className="mt-1">
                National and international architectural practices and
                consultancies.
              </Text>
            </Card>

            <Card padding="md">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Primary Sectors
              </span>
              <p className="text-3xl font-bold tracking-tight text-[var(--color-accent)] mt-2">
                6 Sectors
              </p>
              <Text variant="secondary" className="mt-1">
                Architecture, Master Planning, BIM/Computation, Real Estate,
                Infrastructure & Research.
              </Text>
            </Card>

            <Card padding="md">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Compensation Range
              </span>
              <p className="text-3xl font-bold tracking-tight text-[var(--color-accent)] mt-2">
                Generalized
              </p>
              <Text variant="secondary" className="mt-1">
                Competitive national packages aligned with Council of
                Architecture norms.
              </Text>
            </Card>
          </div>
        </section>

        {/* Industry Sector Breakdown */}
        <section aria-label="Sector Distribution" className="my-12">
          <Heading level={2} className="text-xl mb-6">
            Employment by Domain
          </Heading>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card padding="md">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[var(--color-text-primary)]">
                  Architectural Practice & Design Studios
                </span>
                <Badge variant="default">~45%</Badge>
              </div>
              <Text variant="secondary" className="mt-2">
                Leading architectural consultancies, design ateliers, landscape
                studios, and heritage conservation organizations.
              </Text>
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[var(--color-text-primary)]">
                  BIM, Computational & Tech Advisory
                </span>
                <Badge variant="default">~25%</Badge>
              </div>
              <Text variant="secondary" className="mt-2">
                Global engineering firms, computational geometry consultants,
                and BIM management practices.
              </Text>
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[var(--color-text-primary)]">
                  Urban Planning & Infrastructure
                </span>
                <Badge variant="default">~30%</Badge>
              </div>
              <Text variant="secondary" className="mt-2">
                Statutory development authorities, smart city planning SPVs,
                environmental firms, and transport consultancies.
              </Text>
            </Card>
          </div>
        </section>

        {/* Approved Recruiting Partners Showcase */}
        <section aria-label="Recruiting Partners Showcase" className="my-12">
          <div className="flex flex-col gap-2 mb-6">
            <Heading level={2} className="text-xl">
              Representative Recruiting Organizations
            </Heading>
            <Text variant="secondary">
              A curated sample of approved corporate and design studio partners
              who have engaged with VNIT Architecture & Planning students.
            </Text>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              "Morphogenesis",
              "CP Kukreja Architects",
              "Hafeez Contractor Architects",
              "RSP Design Consultants",
              "Edifice Consultants",
              "Kembhavi Associates",
              "Vidyadhar Chavhan & Associates",
              "AECOM Infrastructure",
              "Atkins Realis",
              "L&T Construction",
              "Godrej Properties",
              "Tata Consulting Engineers",
            ].map((company) => (
              <div
                key={company}
                className="flex items-center justify-center p-4 min-h-[80px] text-center text-xs font-semibold text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] hover:border-[var(--color-border-strong)] transition-colors"
              >
                {company}
              </div>
            ))}
          </div>
        </section>

        {/* Privacy & Governance Notice */}
        <section aria-label="Privacy Notice" className="mt-16">
          <Card padding="md" className="bg-[var(--color-surface-alt)]">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                Institutional Data Privacy Commitment
              </span>
              <Text variant="secondary" className="text-xs">
                To protect student confidentiality and maintain institutional
                compliance, personal identifying information (including student
                names, individual packages, CGPA transcripts, backlogs, and
                resumes) is strictly restricted to authenticated portal
                workflows and authorized placement officers.
              </Text>
            </div>
          </Card>
        </section>
      </Container>
    </div>
  );
}
