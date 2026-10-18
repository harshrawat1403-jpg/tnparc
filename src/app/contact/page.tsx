import React from "react";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Divider } from "@/components/ui/Divider";

export const metadata: Metadata = {
  title: "Contact Placement Office",
  description:
    "Get in touch with the Training & Placement Cell, Department of Architecture & Planning, VNIT Nagpur.",
};

export default function ContactPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container size="lg">
        {/* Page Header */}
        <div className="max-w-3xl flex flex-col gap-4">
          <Badge variant="default" size="md">
            Placement Cell Contact
          </Badge>
          <Heading level={1}>Contact Placement Office</Heading>
          <Text variant="lead">
            Reach out to our faculty coordinators and student placement team for
            campus recruitment inquiries, studio practical training
            partnerships, and institutional verifications.
          </Text>
        </div>

        <Divider spacing="lg" />

        {/* Contact Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
          <Card padding="lg" className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
              Physical Location
            </span>
            <Heading level={3}>Department Address</Heading>
            <Text variant="secondary" className="text-sm leading-relaxed">
              Training & Placement Cell
              <br />
              Department of Architecture & Planning
              <br />
              Visvesvaraya National Institute of Technology (VNIT)
              <br />
              South Ambazari Road, Nagpur, Maharashtra
              <br />
              PIN — 440010, India
            </Text>
          </Card>

          <Card padding="lg" className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
              Electronic Correspondence
            </span>
            <Heading level={3}>Email & Office</Heading>
            <Text variant="secondary" className="text-sm leading-relaxed">
              <strong className="text-[var(--color-text-primary)]">
                Department T&P:
              </strong>
              <br />
              tnp@arch.vnit.ac.in
              <br />
              <br />
              <strong className="text-[var(--color-text-primary)]">
                General T&P Central:
              </strong>
              <br />
              placement@vnit.ac.in
            </Text>
          </Card>

          <Card padding="lg" className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
              Hours of Operation
            </span>
            <Heading level={3}>Office Timings</Heading>
            <Text variant="secondary" className="text-sm leading-relaxed">
              Monday through Friday:
              <br />
              09:30 AM – 05:30 PM IST
              <br />
              <br />
              Closed on Institute Holidays and Weekends.
            </Text>
          </Card>
        </div>

        {/* Central Institute Career Office Notice */}
        <section aria-label="Central T&P Linkage" className="mt-12">
          <Card padding="md" className="bg-[var(--color-surface-alt)]">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                Coordination with Central VNIT Training & Placement Section
              </span>
              <Text variant="secondary" className="text-xs">
                The Department of Architecture & Planning T&P Cell operates in
                close coordination with the central institute placement office
                for centralized slots, institute-wide policy approvals, and
                employer registration guidelines.
              </Text>
            </div>
          </Card>
        </section>
      </Container>
    </div>
  );
}
