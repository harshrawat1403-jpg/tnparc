"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface DriveStat {
  year: number;
  placement_drives: number;
  internship_drives: number;
  total_drives: number;
}

interface ConversionStat {
  drive_id: string;
  drive_title: string;
  company_name: string;
  drive_type: string;
  drive_status: string;
  published_year: number;
  total_applied: number;
  total_selected: number;
  conversion_pct: number;
}

interface CompanyYearStat {
  year: number;
  company_id: string;
  company_name: string;
  students_selected: number;
}

interface RepeatRecruiterStat {
  company_id: string;
  company_name: string;
  years_recruited: number;
  first_year: number;
  latest_year: number;
  total_drives: number;
}

interface InternshipConversionStat {
  total_internship_selected: number;
  converted_to_placement: number;
  conversion_rate_pct: number;
}

interface AlumniCompanyStat {
  company_id: string | null;
  company_name: string;
  alumni_count: number;
}

interface AlumniYearStat {
  graduation_year: number;
  alumni_count: number;
}

interface Props {
  driveStats: DriveStat[];
  conversionStats: ConversionStat[];
  companiesByYear: CompanyYearStat[];
  repeatRecruiters: RepeatRecruiterStat[];
  internshipConversion: InternshipConversionStat;
  alumniByCompany: AlumniCompanyStat[];
  alumniByYear: AlumniYearStat[];
  userRole: string;
}

export function StaffStatisticsClient({
  driveStats,
  conversionStats,
  companiesByYear,
  repeatRecruiters,
  internshipConversion,
  alumniByCompany,
  alumniByYear,
  userRole,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "drives" | "conversion" | "companies" | "alumni"
  >("overview");

  // Aggregate metrics
  const totalPlacementDrives = driveStats.reduce(
    (acc, d) => acc + d.placement_drives,
    0
  );
  const totalInternshipDrives = driveStats.reduce(
    (acc, d) => acc + d.internship_drives,
    0
  );

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* Top Header */}
      <header className="bg-white border-b border-neutral-200">
        <Container className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/staff/dashboard"
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
                >
                  ← Staff Dashboard
                </Link>
                <span className="text-neutral-300">/</span>
                <span className="text-xs text-neutral-600 font-semibold">
                  Statistics &amp; Analytics
                </span>
              </div>
              <Heading
                level={1}
                className="text-xl sm:text-2xl font-bold text-neutral-900"
              >
                Department Placement Statistics
              </Heading>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="info">Role: {userRole}</Badge>
              <Link href="/staff/exports">
                <Button variant="secondary" size="sm">
                  Export Data Reports →
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </header>

      {/* Navigation Tabs */}
      <nav
        aria-label="Statistics Sections"
        className="bg-white border-b border-neutral-200 sticky top-0 z-10 shadow-xs"
      >
        <Container>
          <div className="flex space-x-6 overflow-x-auto text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`py-3.5 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === "overview"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Executive Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("drives")}
              className={`py-3.5 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === "drives"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Drives by Year ({driveStats.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("conversion")}
              className={`py-3.5 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === "conversion"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Drive Conversion Rates ({conversionStats.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("companies")}
              className={`py-3.5 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === "companies"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Recruiting Partners &amp; Repeat Recruiters
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("alumni")}
              className={`py-3.5 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === "alumni"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Alumni Industry Insights
            </button>
          </div>
        </Container>
      </nav>

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Container className="py-8 space-y-8">
          {/* Top Invariant Notice */}
          <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-200/60 text-xs text-blue-900 flex items-start gap-3">
            <span className="font-semibold text-blue-700 uppercase tracking-wider text-[10px] bg-blue-100 px-2 py-0.5 rounded">
              Immutable Authority
            </span>
            <span>
              All totals and conversion rates are derived dynamically at query
              time from authoritative event tables (<code>applications</code>,{" "}
              <code>placement_drives</code>, <code>companies</code>). No
              manually stored counters or editable metrics exist in the
              platform.
            </span>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-5 border border-neutral-200">
                  <Text
                    variant="secondary"
                    className="text-xs uppercase font-medium"
                  >
                    Total Placement Drives
                  </Text>
                  <p className="text-3xl font-bold text-neutral-900 mt-2">
                    {totalPlacementDrives}
                  </p>
                  <Text variant="secondary" className="text-xs mt-1">
                    Published, Closed &amp; Archived
                  </Text>
                </Card>

                <Card className="p-5 border border-neutral-200">
                  <Text
                    variant="secondary"
                    className="text-xs uppercase font-medium"
                  >
                    Total Internship Drives
                  </Text>
                  <p className="text-3xl font-bold text-neutral-900 mt-2">
                    {totalInternshipDrives}
                  </p>
                  <Text variant="secondary" className="text-xs mt-1">
                    Department pre-final year drives
                  </Text>
                </Card>

                <Card className="p-5 border border-neutral-200">
                  <Text
                    variant="secondary"
                    className="text-xs uppercase font-medium"
                  >
                    Repeat Recruiters
                  </Text>
                  <p className="text-3xl font-bold text-neutral-900 mt-2">
                    {repeatRecruiters.length}
                  </p>
                  <Text variant="secondary" className="text-xs mt-1">
                    Active in multiple recruiting years
                  </Text>
                </Card>

                <Card className="p-5 border border-neutral-200">
                  <Text
                    variant="secondary"
                    className="text-xs uppercase font-medium"
                  >
                    Internship → Placement
                  </Text>
                  <p className="text-3xl font-bold text-green-700 mt-2">
                    {internshipConversion.conversion_rate_pct}%
                  </p>
                  <Text variant="secondary" className="text-xs mt-1">
                    {internshipConversion.converted_to_placement} of{" "}
                    {internshipConversion.total_internship_selected} students
                    converted
                  </Text>
                </Card>
              </div>

              {/* Drives by Year Table Preview */}
              <Card className="p-6 border border-neutral-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Heading
                      level={2}
                      className="text-base font-semibold text-neutral-900"
                    >
                      Placement &amp; Internship Drives by Year
                    </Heading>
                    <Text variant="secondary" className="text-xs">
                      Historical year-wise volume of departmental drives.
                    </Text>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveTab("drives")}
                  >
                    View Full Table →
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase">
                        <th className="py-2.5 px-3">Year</th>
                        <th className="py-2.5 px-3">Placement Drives</th>
                        <th className="py-2.5 px-3">Internship Drives</th>
                        <th className="py-2.5 px-3">Total Drives</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {driveStats.slice(0, 5).map((d) => (
                        <tr key={d.year} className="hover:bg-neutral-50/50">
                          <td className="py-3 px-3 font-medium text-neutral-900">
                            {d.year}
                          </td>
                          <td className="py-3 px-3 text-neutral-700">
                            {d.placement_drives}
                          </td>
                          <td className="py-3 px-3 text-neutral-700">
                            {d.internship_drives}
                          </td>
                          <td className="py-3 px-3 font-semibold text-neutral-900">
                            {d.total_drives}
                          </td>
                        </tr>
                      ))}
                      {driveStats.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-6 text-center text-neutral-500 text-xs"
                          >
                            No drive statistics recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Repeat Recruiters Preview */}
              <Card className="p-6 border border-neutral-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Heading
                      level={2}
                      className="text-base font-semibold text-neutral-900"
                    >
                      Top Repeat Recruiting Partners
                    </Heading>
                    <Text variant="secondary" className="text-xs">
                      Companies recruiting across more than one distinct
                      calendar year.
                    </Text>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveTab("companies")}
                  >
                    View All Partners →
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase">
                        <th className="py-2.5 px-3">Company Name</th>
                        <th className="py-2.5 px-3">Years Recruited</th>
                        <th className="py-2.5 px-3">First Year</th>
                        <th className="py-2.5 px-3">Latest Year</th>
                        <th className="py-2.5 px-3">Total Drives</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {repeatRecruiters.slice(0, 5).map((r) => (
                        <tr
                          key={r.company_id}
                          className="hover:bg-neutral-50/50"
                        >
                          <td className="py-3 px-3 font-medium text-neutral-900">
                            {r.company_name}
                          </td>
                          <td className="py-3 px-3 text-neutral-700">
                            {r.years_recruited} years
                          </td>
                          <td className="py-3 px-3 text-neutral-600">
                            {r.first_year}
                          </td>
                          <td className="py-3 px-3 text-neutral-600">
                            {r.latest_year}
                          </td>
                          <td className="py-3 px-3 font-semibold text-neutral-900">
                            {r.total_drives}
                          </td>
                        </tr>
                      ))}
                      {repeatRecruiters.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-6 text-center text-neutral-500 text-xs"
                          >
                            No repeat recruiters identified across multiple
                            calendar years yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: DRIVES BY YEAR */}
          {activeTab === "drives" && (
            <Card className="p-6 border border-neutral-200 space-y-4">
              <div>
                <Heading
                  level={2}
                  className="text-lg font-semibold text-neutral-900"
                >
                  Drives by Academic Year
                </Heading>
                <Text variant="secondary" className="text-xs">
                  Comprehensive breakdown of placement drives vs. internship
                  drives published by year.
                </Text>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase">
                      <th className="py-3 px-4">Year</th>
                      <th className="py-3 px-4">Placement Drives</th>
                      <th className="py-3 px-4">Internship Drives</th>
                      <th className="py-3 px-4">Total Drives</th>
                      <th className="py-3 px-4">Placement Proportion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {driveStats.map((d) => {
                      const placementPct =
                        d.total_drives > 0
                          ? Math.round(
                              (d.placement_drives / d.total_drives) * 100
                            )
                          : 0;
                      return (
                        <tr key={d.year} className="hover:bg-neutral-50/50">
                          <td className="py-3 px-4 font-bold text-neutral-900">
                            {d.year}
                          </td>
                          <td className="py-3 px-4 text-neutral-700">
                            {d.placement_drives}
                          </td>
                          <td className="py-3 px-4 text-neutral-700">
                            {d.internship_drives}
                          </td>
                          <td className="py-3 px-4 font-semibold text-neutral-900">
                            {d.total_drives}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-neutral-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${placementPct}%` }}
                                />
                              </div>
                              <span className="text-xs text-neutral-500">
                                {placementPct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {driveStats.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-neutral-500"
                        >
                          No published placement drives found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* TAB 3: CONVERSION RATES */}
          {activeTab === "conversion" && (
            <Card className="p-6 border border-neutral-200 space-y-4">
              <div>
                <Heading
                  level={2}
                  className="text-lg font-semibold text-neutral-900"
                >
                  Drive Placement Conversion Rates
                </Heading>
                <Text variant="secondary" className="text-xs">
                  Authoritative conversion rate:{" "}
                  <code>selected / (applied - withdrawn) * 100</code>. Withdrawn
                  applications are excluded from the conversion denominator per
                  architecture specification.
                </Text>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase">
                      <th className="py-3 px-3">Drive Title</th>
                      <th className="py-3 px-3">Company</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Year</th>
                      <th className="py-3 px-3">Applied</th>
                      <th className="py-3 px-3">Selected</th>
                      <th className="py-3 px-3">Conversion Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {conversionStats.map((c) => (
                      <tr key={c.drive_id} className="hover:bg-neutral-50/50">
                        <td className="py-3 px-3 font-medium text-neutral-900">
                          {c.drive_title}
                        </td>
                        <td className="py-3 px-3 text-neutral-700">
                          {c.company_name}
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant={
                              c.drive_type === "PLACEMENT" ? "info" : "default"
                            }
                            size="sm"
                          >
                            {c.drive_type}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="default" size="sm">
                            {c.drive_status}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-neutral-600">
                          {c.published_year}
                        </td>
                        <td className="py-3 px-3 text-neutral-700">
                          {c.total_applied}
                        </td>
                        <td className="py-3 px-3 font-semibold text-green-700">
                          {c.total_selected}
                        </td>
                        <td className="py-3 px-3 font-bold text-neutral-900">
                          {c.conversion_pct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                    {conversionStats.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="py-8 text-center text-neutral-500"
                        >
                          No drive applications available for conversion
                          calculation.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* TAB 4: COMPANIES & REPEAT RECRUITERS */}
          {activeTab === "companies" && (
            <div className="space-y-8">
              {/* Repeat Recruiters Section */}
              <Card className="p-6 border border-neutral-200 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Heading
                      level={2}
                      className="text-lg font-semibold text-neutral-900"
                    >
                      Repeat Recruiting Partners
                    </Heading>
                    <Badge variant="success" size="sm">
                      {repeatRecruiters.length} Firms
                    </Badge>
                  </div>
                  <Text variant="secondary" className="text-xs">
                    Institutional partner firms with closed or archived
                    placement drives across more than one distinct calendar
                    year.
                  </Text>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase">
                        <th className="py-3 px-3">Partner Company</th>
                        <th className="py-3 px-3">Distinct Years Recruited</th>
                        <th className="py-3 px-3">First Recruiting Year</th>
                        <th className="py-3 px-3">Latest Recruiting Year</th>
                        <th className="py-3 px-3">Total Historical Drives</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {repeatRecruiters.map((r) => (
                        <tr
                          key={r.company_id}
                          className="hover:bg-neutral-50/50"
                        >
                          <td className="py-3 px-3 font-medium text-neutral-900">
                            {r.company_name}
                          </td>
                          <td className="py-3 px-3 font-bold text-blue-700">
                            {r.years_recruited} years
                          </td>
                          <td className="py-3 px-3 text-neutral-600">
                            {r.first_year}
                          </td>
                          <td className="py-3 px-3 text-neutral-600">
                            {r.latest_year}
                          </td>
                          <td className="py-3 px-3 text-neutral-800">
                            {r.total_drives}
                          </td>
                        </tr>
                      ))}
                      {repeatRecruiters.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-8 text-center text-neutral-500"
                          >
                            No repeat recruiters found across multiple calendar
                            years.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Companies by Year Section */}
              <Card className="p-6 border border-neutral-200 space-y-4">
                <div>
                  <Heading
                    level={2}
                    className="text-lg font-semibold text-neutral-900"
                  >
                    Companies Recruiting by Year (Selected Students)
                  </Heading>
                  <Text variant="secondary" className="text-xs">
                    Derived exclusively from PLACEMENT drives with SELECTED
                    students.
                  </Text>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase">
                        <th className="py-3 px-3">Year</th>
                        <th className="py-3 px-3">Company Name</th>
                        <th className="py-3 px-3">Students Selected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {companiesByYear.map((c, idx) => (
                        <tr
                          key={`${c.year}-${c.company_id}-${idx}`}
                          className="hover:bg-neutral-50/50"
                        >
                          <td className="py-3 px-3 font-semibold text-neutral-900">
                            {c.year}
                          </td>
                          <td className="py-3 px-3 font-medium text-neutral-800">
                            {c.company_name}
                          </td>
                          <td className="py-3 px-3 font-bold text-green-700">
                            {c.students_selected} selected
                          </td>
                        </tr>
                      ))}
                      {companiesByYear.length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="py-8 text-center text-neutral-500"
                          >
                            No student placement selections recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 5: ALUMNI INDUSTRY */}
          {activeTab === "alumni" && (
            <div className="space-y-8">
              {/* Alumni by Company */}
              <Card className="p-6 border border-neutral-200 space-y-4">
                <div>
                  <Heading
                    level={2}
                    className="text-lg font-semibold text-neutral-900"
                  >
                    Alumni Representation by Employer
                  </Heading>
                  <Text variant="secondary" className="text-xs">
                    Integrated from Phase 10 verified alumni employment records
                    and company matches.
                  </Text>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase">
                        <th className="py-3 px-3">Company / Organization</th>
                        <th className="py-3 px-3">Alumni Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {alumniByCompany.map((a, idx) => (
                        <tr
                          key={`${a.company_name}-${idx}`}
                          className="hover:bg-neutral-50/50"
                        >
                          <td className="py-3 px-3 font-medium text-neutral-900">
                            {a.company_name}
                          </td>
                          <td className="py-3 px-3 font-bold text-blue-700">
                            {a.alumni_count} alumni
                          </td>
                        </tr>
                      ))}
                      {alumniByCompany.length === 0 && (
                        <tr>
                          <td
                            colSpan={2}
                            className="py-8 text-center text-neutral-500"
                          >
                            No alumni employer records verified yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Alumni by Graduation Year */}
              <Card className="p-6 border border-neutral-200 space-y-4">
                <div>
                  <Heading
                    level={2}
                    className="text-lg font-semibold text-neutral-900"
                  >
                    Alumni Distribution by Graduation Cohort
                  </Heading>
                  <Text variant="secondary" className="text-xs">
                    Alumni population counts categorized by degree graduation
                    year.
                  </Text>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase">
                        <th className="py-3 px-3">Graduation Year</th>
                        <th className="py-3 px-3">Graduated Alumni Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {alumniByYear.map((y) => (
                        <tr
                          key={y.graduation_year}
                          className="hover:bg-neutral-50/50"
                        >
                          <td className="py-3 px-3 font-semibold text-neutral-900">
                            {y.graduation_year}
                          </td>
                          <td className="py-3 px-3 font-bold text-green-700">
                            {y.alumni_count} alumni
                          </td>
                        </tr>
                      ))}
                      {alumniByYear.length === 0 && (
                        <tr>
                          <td
                            colSpan={2}
                            className="py-8 text-center text-neutral-500"
                          >
                            No graduated alumni cohorts registered yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </Container>
      </main>
    </div>
  );
}
