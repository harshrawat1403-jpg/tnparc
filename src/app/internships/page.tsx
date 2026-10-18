import React from "react";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Divider } from "@/components/ui/Divider";

export const metadata: Metadata = {
  title: "Practical Training & Internships",
  description:
    "Information on the mandatory practical training semester for B.Arch and professional internships for M.Plan at VNIT Nagpur.",
};

export default function InternshipsPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container size="lg">
        {/* Page Header */}
        <div className="max-w-3xl flex flex-col gap-4">
          <Badge variant="default" size="md">
            Mandatory Practical Training
          </Badge>
          <Heading level={1}>Internships & Professional Practice</Heading>
          <Text variant="lead">
            Curricular architectural training and urban planning internships
            ensuring all VNIT students experience rigorous studio practice, site
            supervision, and client coordination prior to graduation.
          </Text>
        </div>

        <Divider spacing="lg" />

        {/* Curricular Guidelines */}
        <section aria-label="Curricular Framework" className="my-8">
          <Heading level={2} className="text-xl mb-6">
            Curricular Training Framework
          </Heading>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card padding="lg" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[var(--color-accent)] bg-[var(--color-accent-muted)] px-2 py-1 rounded-[var(--radius-sm)]">
                  B.ARCH • 8TH SEMESTER
                </span>
                <Badge variant="info">Full Semester (16–20 Weeks)</Badge>
              </div>
              <Heading level={3}>Architectural Practical Training</Heading>
              <Text variant="secondary">
                A core academic requirement under Council of Architecture
                regulations. Students join approved architectural practices
                across India or internationally, contributing directly to live
                working drawings, statutory council approvals, structural
                coordination, and site inspections.
              </Text>
              <ul className="text-xs text-[var(--color-text-secondary)] list-disc pl-5 flex flex-col gap-1 mt-2">
                <li>Working drawings & construction details</li>
                <li>Site supervision & contractor coordination</li>
                <li>3D BIM coordination & municipal documentation</li>
                <li>Faculty and mentor progress reviews</li>
              </ul>
            </Card>

            <Card padding="lg" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[var(--color-accent)] bg-[var(--color-accent-muted)] px-2 py-1 rounded-[var(--radius-sm)]">
                  M.PLAN • SUMMER PERIOD
                </span>
                <Badge variant="info">6–8 Weeks</Badge>
              </div>
              <Heading level={3}>Urban Planning Summer Internship</Heading>
              <Text variant="secondary">
                Postgraduate planning students engage with statutory regional
                bodies, smart city corporations, infrastructure development
                firms, and research institutes to tackle real-world municipal
                and regional planning challenges.
              </Text>
              <ul className="text-xs text-[var(--color-text-secondary)] list-disc pl-5 flex flex-col gap-1 mt-2">
                <li>GIS spatial analysis and field surveys</li>
                <li>Master plan reviews & zonal regulations</li>
                <li>Transit and environmental impact assessment</li>
                <li>Policy documentation & data analytics</li>
              </ul>
            </Card>
          </div>
        </section>

        {/* Aggregate Internship Metrics */}
        <section
          aria-label="Internship Placement Aggregate Data"
          className="my-12"
        >
          <Heading level={2} className="text-xl mb-6">
            Training Engagement Highlights
          </Heading>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card padding="md">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Training Placement
              </span>
              <p className="text-3xl font-bold tracking-tight text-[var(--color-accent)] mt-2">
                100%
              </p>
              <Text variant="secondary" className="mt-1">
                All eligible B.Arch candidates successfully placed in accredited
                firms.
              </Text>
            </Card>

            <Card padding="md">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Geographic Reach
              </span>
              <p className="text-3xl font-bold tracking-tight text-[var(--color-accent)] mt-2">
                Pan-India & Global
              </p>
              <Text variant="secondary" className="mt-1">
                Practices in Mumbai, Bengaluru, Delhi NCR, Ahmedabad, Pune, and
                overseas.
              </Text>
            </Card>

            <Card padding="md">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Pre-Placement Offers
              </span>
              <p className="text-3xl font-bold tracking-tight text-[var(--color-accent)] mt-2">
                High Conversion
              </p>
              <Text variant="secondary" className="mt-1">
                Multiple candidates receive final placement offers following
                practical training.
              </Text>
            </Card>
          </div>
        </section>

        {/* Host Organizations Sample */}
        <section aria-label="Representative Host Practices" className="my-12">
          <div className="flex flex-col gap-2 mb-6">
            <Heading level={2} className="text-xl">
              Representative Training Hosts
            </Heading>
            <Text variant="secondary">
              Distinguished design studios and municipal organizations that
              regularly host VNIT interns.
            </Text>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              "Vastu Shilpa Consultants",
              "Sanjay Puri Architects",
              "Studio Lotus",
              "CCBA Designs (Christopher Benninger)",
              "Abhikram Architects",
              "HCP Design & Project Management",
              "CIDCO Urban Planning",
              "MMRDA Mumbai",
              "Nagpur Smart & Sustainable City",
              "NIUA New Delhi",
              "Urban Arts Studio",
              "Design Accord",
            ].map((firm) => (
              <div
                key={firm}
                className="flex items-center justify-center p-4 min-h-[80px] text-center text-xs font-semibold text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] hover:border-[var(--color-border-strong)] transition-colors"
              >
                {firm}
              </div>
            ))}
          </div>
        </section>

        {/* Privacy Note */}
        <section aria-label="Privacy Disclaimer" className="mt-16">
          <Card padding="md" className="bg-[var(--color-surface-alt)]">
            <Text variant="secondary" className="text-xs">
              Note: Practical training host approvals are verified through
              formal institutional documentation. Individual student portfolios,
              firm log books, and evaluation marks remain strictly confidential
              within the department academic evaluation committee.
            </Text>
          </Card>
        </section>
      </Container>
    </div>
  );
}
