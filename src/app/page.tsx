import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Department of Architecture & Planning | TNP Portal",
  description:
    "Official Training & Placement Portal for the Department of Architecture & Planning, VNIT Nagpur. Connecting students with premier architectural firms and planning organizations.",
};

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12 sm:gap-16 lg:gap-20 pb-16">
      {/* Hero Section */}
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)] py-12 sm:py-20 lg:py-24">
        <Container size="lg">
          <div className="max-w-3xl flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <Badge variant="default" size="md">
                VNIT Nagpur • Established 1960
              </Badge>
              <Badge variant="info" size="md">
                TNP Portal
              </Badge>
            </div>

            <Heading level={1}>Training & Placement Portal</Heading>

            <Text variant="lead">
              Department of Architecture & Planning, Visvesvaraya National
              Institute of Technology Nagpur. Fostering rigorous architectural
              pedagogy, sustainable urban design, and professional industry
              engagement.
            </Text>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/for-recruiters"
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] transition-colors shadow-sm focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              >
                For Recruiters
              </Link>
              <Link
                href="/placements"
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-alt)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              >
                View Placement Highlights
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] rounded-[var(--radius-md)] transition-colors"
              >
                Student Sign In →
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Aggregate Metric Highlights (Placeholder figures for visual demonstration) */}
      <section aria-label="Key Department Statistics">
        <Container size="lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card padding="md">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Accreditation & Heritage
              </span>
              <p className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] mt-2">
                COA & NIRF
              </p>
              <Text variant="secondary" className="mt-1">
                Council of Architecture approved; consistently ranked among top
                national architecture institutes.
              </Text>
            </Card>

            <Card padding="md">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Undergraduate Rigor
              </span>
              <p className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] mt-2">
                5-Year B.Arch
              </p>
              <Text variant="secondary" className="mt-1">
                Comprehensive curriculum integrating structural design, BIM,
                computational architecture, and environmental planning.
              </Text>
            </Card>

            <Card padding="md">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Postgraduate Focus
              </span>
              <p className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] mt-2">
                2-Year M.Plan
              </p>
              <Text variant="secondary" className="mt-1">
                Urban planning specializations addressing regional development,
                transportation infrastructure, and GIS analytics.
              </Text>
            </Card>

            <Card padding="md">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Mandatory Training
              </span>
              <p className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] mt-2">
                Practical Training
              </p>
              <Text variant="secondary" className="mt-1">
                Dedicated semester-long professional architectural internship
                embedded directly into the degree curriculum.
              </Text>
            </Card>
          </div>
        </Container>
      </section>

      {/* Overview Pillars */}
      <section aria-label="Department TNP Pillars">
        <Container size="lg">
          <div className="flex flex-col gap-8">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                Institutional Mission
              </span>
              <Heading level={2} className="mt-1">
                Bridging Academic Excellence with Professional Practice
              </Heading>
              <Text variant="secondary" className="mt-2">
                The Department Training & Placement cell operates
                collaboratively with faculty coordinators, student
                representatives, and industry partners to facilitate transparent
                and merit-based recruitment drives.
              </Text>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card padding="lg" className="flex flex-col gap-3">
                <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-accent-muted)] text-[var(--color-accent)] flex items-center justify-center font-bold text-sm">
                  01
                </div>
                <Heading level={3}>Deterministic Eligibility</Heading>
                <Text variant="secondary">
                  Transparent criteria evaluation based on institutional
                  academic rosters, verified CGPA, and backlog status with clear
                  reasoning for every candidate.
                </Text>
              </Card>

              <Card padding="lg" className="flex flex-col gap-3">
                <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-accent-muted)] text-[var(--color-accent)] flex items-center justify-center font-bold text-sm">
                  02
                </div>
                <Heading level={3}>Comprehensive Portfolios</Heading>
                <Text variant="secondary">
                  Profiles tailored to architecture and planning disciplines,
                  showcasing verified technical skills, curated portfolio links,
                  and professional resumes.
                </Text>
              </Card>

              <Card padding="lg" className="flex flex-col gap-3">
                <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-accent-muted)] text-[var(--color-accent)] flex items-center justify-center font-bold text-sm">
                  03
                </div>
                <Heading level={3}>Structured Drive Management</Heading>
                <Text variant="secondary">
                  End-to-end recruitment lifecycle coordination from initial
                  opportunity broadcast and applicant evaluation to final offer
                  conferrals.
                </Text>
              </Card>
            </div>
          </div>
        </Container>
      </section>

      {/* Recruiter Call to Action */}
      <section aria-label="Recruiter Engagement">
        <Container size="lg">
          <Card
            padding="lg"
            className="bg-[var(--color-surface-alt)] border-[var(--color-border-strong)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            <div className="flex flex-col gap-2 max-w-xl">
              <Heading level={3}>
                Inviting Prospective Recruiters & Studios
              </Heading>
              <Text variant="secondary">
                Are you an architectural practice, urban design consultancy,
                real estate developer, or research institution looking to
                recruit top-tier talent? Explore our recruiter handbook and
                drive timelines.
              </Text>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/for-recruiters"
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                Recruitment Details
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                Contact T&P Cell
              </Link>
            </div>
          </Card>
        </Container>
      </section>
    </div>
  );
}
