import React from "react";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Divider } from "@/components/ui/Divider";

export const metadata: Metadata = {
  title: "About Training & Placement",
  description:
    "Learn about the Training & Placement cell of the Department of Architecture & Planning at VNIT Nagpur, our educational mission, and organizational structure.",
};

export default function AboutPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container size="lg">
        {/* Header Section */}
        <div className="max-w-3xl flex flex-col gap-4">
          <Badge variant="default" size="md">
            Department Overview
          </Badge>
          <Heading level={1}>About Training & Placement Cell</Heading>
          <Text variant="lead">
            Fostering professional excellence, academic integrity, and industry
            collaboration at the Department of Architecture & Planning, VNIT
            Nagpur.
          </Text>
        </div>

        <Divider spacing="lg" />

        {/* Mission & Vision */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-8">
          <Card padding="lg">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
              Our Purpose
            </span>
            <Heading level={2} className="text-2xl mt-2">
              Department Mission
            </Heading>
            <Text variant="secondary" className="mt-4 leading-relaxed">
              The Department of Architecture and Planning at Visvesvaraya
              National Institute of Technology (VNIT) Nagpur is committed to
              providing world-class architectural education and urban planning
              scholarship. We emphasize contextual sensitivity, sustainable
              construction technologies, computational mastery, and cultural
              responsiveness.
            </Text>
          </Card>

          <Card padding="lg">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
              Industry Interface
            </span>
            <Heading level={2} className="text-2xl mt-2">
              T&P Cell Role
            </Heading>
            <Text variant="secondary" className="mt-4 leading-relaxed">
              The Training & Placement cell operates as the dedicated bridge
              between graduating architects, urban planners, and the design
              industry. We manage formal campus recruitment drives, assist in
              semester-long mandatory practical training placements, and uphold
              rigorous institutional verification standards for all candidates.
            </Text>
          </Card>
        </div>

        {/* Academic Programs */}
        <div className="flex flex-col gap-6 my-12">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Academic Curricula
            </span>
            <Heading level={2} className="mt-1">
              Programs Offered
            </Heading>
            <Text variant="secondary" className="mt-2 max-w-2xl">
              Our students undergo rigorous multi-disciplinary training
              combining studio pedagogy, technical engineering principles, and
              hands-on field research.
            </Text>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card padding="md" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[var(--color-accent)] bg-[var(--color-accent-muted)] px-2 py-1 rounded-[var(--radius-sm)]">
                  UG PROGRAM
                </span>
                <Badge variant="success">Placement Eligible</Badge>
              </div>
              <Heading level={3}>Bachelor of Architecture (B.Arch)</Heading>
              <Text variant="secondary">
                A comprehensive 5-year undergraduate degree accredited by the
                Council of Architecture (COA). Focuses on architectural design,
                structural engineering, computational modeling (BIM), historic
                preservation, and a mandatory semester of practical training.
              </Text>
            </Card>

            <Card padding="md" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[var(--color-accent)] bg-[var(--color-accent-muted)] px-2 py-1 rounded-[var(--radius-sm)]">
                  PG PROGRAM
                </span>
                <Badge variant="success">Placement Eligible</Badge>
              </div>
              <Heading level={3}>Master of Planning (Urban Planning)</Heading>
              <Text variant="secondary">
                A 2-year postgraduate program equipping specialists with
                expertise in statutory urban planning, GIS-based spatial
                analytics, regional infrastructure, sustainable transit systems,
                and environmental impact analysis.
              </Text>
            </Card>
          </div>
        </div>

        {/* Organizational Structure */}
        <div className="flex flex-col gap-6 my-12">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Operational Governance
            </span>
            <Heading level={2} className="mt-1">
              T&P Organizational Structure
            </Heading>
            <Text variant="secondary" className="mt-2 max-w-2xl">
              Operating within institute guidelines, the departmental cell is
              run by faculty officers and dedicated student coordinators.
            </Text>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card padding="md">
              <Heading level={4}>Faculty In-Charge</Heading>
              <Text variant="secondary" className="mt-1 text-xs">
                Training & Placement Officer
              </Text>
              <Text variant="secondary" className="mt-3 text-sm">
                Supervises institutional compliance, approves corporate
                invitations, publishes drives, and liaises with central
                institute authorities.
              </Text>
            </Card>

            <Card padding="md">
              <Heading level={4}>Student Coordinators</Heading>
              <Text variant="secondary" className="mt-1 text-xs">
                Elected / Nominated Representatives
              </Text>
              <Text variant="secondary" className="mt-3 text-sm">
                Coordinates cohort communications, verifies portfolio
                submissions, and facilitates day-of-drive logistics.
              </Text>
            </Card>

            <Card padding="md">
              <Heading level={4}>Central VNIT T&P</Heading>
              <Text variant="secondary" className="mt-1 text-xs">
                Institute Career Cell
              </Text>
              <Text variant="secondary" className="mt-3 text-sm">
                Coordinates overarching institute recruitment policies,
                slotting, and cross-departmental placement regulations.
              </Text>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}
