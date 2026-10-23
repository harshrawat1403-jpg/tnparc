"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  requestStaffExportAction,
  ExportType,
  ExportFilters,
} from "@/lib/actions/exports";

interface ProgramOption {
  id: string;
  code: string;
  display_name: string;
}

interface DriveOption {
  id: string;
  title: string;
  drive_type: string;
  published_at: string | null;
}

interface Props {
  programs: ProgramOption[];
  drives: DriveOption[];
  userRole: string;
}

export function StaffExportsClient({ programs, drives, userRole }: Props) {
  const [exportType, setExportType] = useState<ExportType>("APPLICATIONS");
  const [batch, setBatch] = useState<string>("");
  const [programCode, setProgramCode] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [driveType, setDriveType] = useState<string>("");
  const [driveId, setDriveId] = useState<string>("");
  const [year, setYear] = useState<string>("");

  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleExport = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const filters: ExportFilters = {};
    if (batch.trim()) filters.batch = batch.trim();
    if (programCode.trim()) filters.program_code = programCode.trim();
    if (status.trim()) filters.status = status.trim();
    if (driveType.trim()) filters.drive_type = driveType.trim();
    if (driveId.trim()) filters.drive_id = driveId.trim();
    if (year.trim()) filters.year = parseInt(year.trim(), 10);

    startTransition(async () => {
      try {
        const result = await requestStaffExportAction(exportType, filters);
        if (!result.success || !result.csv) {
          setErrorMsg(result.error || "Export failed.");
          return;
        }

        // Trigger safe file download
        const blob = new Blob([result.csv], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename || `export-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setSuccessMsg(
          `Successfully generated ${result.filename} (${result.rowCount} rows). Download started.`
        );
      } catch (err: unknown) {
        setErrorMsg(
          err instanceof Error ? err.message : "Unexpected export error."
        );
      }
    });
  };

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
                  Data Exports
                </span>
              </div>
              <Heading
                level={1}
                className="text-xl sm:text-2xl font-bold text-neutral-900"
              >
                Institutional Data Exports
              </Heading>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="info">Role: {userRole}</Badge>
              <Link href="/staff/statistics">
                <Button variant="secondary" size="sm">
                  View Analytics →
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </header>

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Container className="py-8 max-w-4xl space-y-6">
          {/* Institutional Privacy Warning Banner */}
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <span className="font-bold text-amber-800 uppercase tracking-wider text-[10px] bg-amber-100 px-2 py-0.5 rounded shrink-0">
              CONFIDENTIAL DATA
            </span>
            <div className="space-y-1">
              <p className="font-semibold text-neutral-900">
                Institutional Data Handling &amp; Audit Obligation
              </p>
              <p className="text-neutral-700 leading-relaxed">
                Exported CSV files contain internal institutional records. In
                compliance with the department privacy policy, every export
                execution is permanently recorded in the immutable audit ledger
                (<code>DATA_EXPORT_REQUESTED</code>). Student private contact
                numbers, personal emails, resumes, and CGPA values are omitted
                from general operational exports.
              </p>
            </div>
          </div>

          {/* Hard Row Cap Notice */}
          <div className="p-3.5 rounded-lg bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs flex items-center justify-between">
            <span>
              <strong>Hard Export Bound:</strong> Capped at a maximum of{" "}
              <strong>1,000 rows</strong> per export to protect server resources
              and prevent bulk data exfiltration.
            </span>
            <Badge variant="default" size="sm">
              Cap: 1,000 Rows
            </Badge>
          </div>

          {/* Export Form Card */}
          <Card className="p-6 border border-neutral-200 space-y-6">
            <div>
              <Heading
                level={2}
                className="text-base font-semibold text-neutral-900"
              >
                Configure Export Parameters
              </Heading>
              <Text variant="secondary" className="text-xs">
                Select the target export dataset and apply optional filters to
                narrow the result set.
              </Text>
            </div>

            {/* Error & Success Alerts */}
            {errorMsg && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md">
                <strong>Export Error:</strong> {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-3.5 bg-green-50 border border-green-200 text-green-800 text-xs rounded-md">
                {successMsg}
              </div>
            )}

            {/* Export Type Selector */}
            <div className="space-y-2">
              <label
                htmlFor="export-type-select"
                className="block text-xs font-semibold text-neutral-700 uppercase"
              >
                Dataset / Export Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    type: "APPLICATIONS",
                    label: "Student Applications",
                    desc: "Candidate applications with drive, batch, and status.",
                  },
                  {
                    type: "DRIVE_RESULTS",
                    label: "Drive Placement Results",
                    desc: "Drive summary with total applicants, selections, and conversion rate.",
                  },
                  {
                    type: "PLACEMENT_OUTCOMES",
                    label: "Final Placement Selections",
                    desc: "Students selected in full-time PLACEMENT drives.",
                  },
                  {
                    type: "INTERNSHIP_OUTCOMES",
                    label: "Internship Selections",
                    desc: "Students selected in INTERNSHIP drives.",
                  },
                  {
                    type: "COMPANIES",
                    label: "Corporate Partners Summary",
                    desc: "Company directory with drive counts and total hires.",
                  },
                  {
                    type: "ALUMNI_INDUSTRY",
                    label: "Alumni Industry Summary",
                    desc: "Verified alumni employment, company, and location data.",
                  },
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setExportType(item.type as ExportType)}
                    className={`p-3.5 rounded-lg border text-left transition-all ${
                      exportType === item.type
                        ? "border-blue-600 bg-blue-50/40 ring-1 ring-blue-600"
                        : "border-neutral-200 hover:border-neutral-300 bg-white"
                    }`}
                  >
                    <p className="text-sm font-semibold text-neutral-900">
                      {item.label}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {item.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Filters Section */}
            <div className="space-y-4 pt-4 border-t border-neutral-100">
              <p className="text-xs font-semibold text-neutral-700 uppercase">
                Optional Filters (Narrow Result Set)
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Batch Filter */}
                {[
                  "APPLICATIONS",
                  "PLACEMENT_OUTCOMES",
                  "INTERNSHIP_OUTCOMES",
                  "ALUMNI_INDUSTRY",
                ].includes(exportType) && (
                  <div>
                    <label
                      htmlFor="batch-filter"
                      className="block text-xs font-medium text-neutral-600 mb-1"
                    >
                      Batch / Graduation Year
                    </label>
                    <input
                      id="batch-filter"
                      type="text"
                      placeholder="e.g. 2026"
                      value={batch}
                      onChange={(e) => setBatch(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                )}

                {/* Program Filter */}
                {[
                  "APPLICATIONS",
                  "PLACEMENT_OUTCOMES",
                  "INTERNSHIP_OUTCOMES",
                  "ALUMNI_INDUSTRY",
                ].includes(exportType) && (
                  <div>
                    <label
                      htmlFor="program-filter"
                      className="block text-xs font-medium text-neutral-600 mb-1"
                    >
                      Academic Program
                    </label>
                    <select
                      id="program-filter"
                      value={programCode}
                      onChange={(e) => setProgramCode(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                    >
                      <option value="">All Academic Programs</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.code}>
                          {p.code} - {p.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Status Filter */}
                {exportType === "APPLICATIONS" && (
                  <div>
                    <label
                      htmlFor="status-filter"
                      className="block text-xs font-medium text-neutral-600 mb-1"
                    >
                      Application Status
                    </label>
                    <select
                      id="status-filter"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                    >
                      <option value="">All Statuses</option>
                      <option value="APPLIED">APPLIED</option>
                      <option value="SHORTLISTED">SHORTLISTED</option>
                      <option value="INTERVIEW">INTERVIEW</option>
                      <option value="SELECTED">SELECTED</option>
                      <option value="REJECTED">REJECTED</option>
                      <option value="WITHDRAWN">WITHDRAWN</option>
                    </select>
                  </div>
                )}

                {/* Drive Type Filter */}
                {["APPLICATIONS", "DRIVE_RESULTS"].includes(exportType) && (
                  <div>
                    <label
                      htmlFor="drive-type-filter"
                      className="block text-xs font-medium text-neutral-600 mb-1"
                    >
                      Drive Type
                    </label>
                    <select
                      id="drive-type-filter"
                      value={driveType}
                      onChange={(e) => setDriveType(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                    >
                      <option value="">
                        All Types (Placement &amp; Internship)
                      </option>
                      <option value="PLACEMENT">PLACEMENT</option>
                      <option value="INTERNSHIP">INTERNSHIP</option>
                    </select>
                  </div>
                )}

                {/* Drive Selector */}
                {exportType === "APPLICATIONS" && (
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="drive-select"
                      className="block text-xs font-medium text-neutral-600 mb-1"
                    >
                      Specific Drive
                    </label>
                    <select
                      id="drive-select"
                      value={driveId}
                      onChange={(e) => setDriveId(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                    >
                      <option value="">All Drives</option>
                      {drives.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title} ({d.drive_type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Calendar Year Filter */}
                {[
                  "DRIVE_RESULTS",
                  "PLACEMENT_OUTCOMES",
                  "INTERNSHIP_OUTCOMES",
                  "COMPANIES",
                ].includes(exportType) && (
                  <div>
                    <label
                      htmlFor="calendar-year-filter"
                      className="block text-xs font-medium text-neutral-600 mb-1"
                    >
                      Calendar Year
                    </label>
                    <input
                      id="calendar-year-filter"
                      type="number"
                      placeholder="e.g. 2026"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-neutral-100">
              <div className="text-xs text-neutral-500">
                Generated CSV output is sanitized against spreadsheet formula
                injection and encoded in UTF-8.
              </div>
              <Button
                variant="primary"
                onClick={handleExport}
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                {isPending ? "Generating CSV..." : "Generate & Download CSV ↓"}
              </Button>
            </div>
          </Card>
        </Container>
      </main>
    </div>
  );
}
