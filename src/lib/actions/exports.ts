"use server";

import { createClient } from "@/lib/supabase/server";
import { generateCsv } from "@/lib/csv";
import type { Json } from "@/types/database";

export type ExportType =
  | "APPLICATIONS"
  | "DRIVE_RESULTS"
  | "PLACEMENT_OUTCOMES"
  | "INTERNSHIP_OUTCOMES"
  | "COMPANIES"
  | "ALUMNI_INDUSTRY";

export interface ExportFilters {
  drive_id?: string;
  batch?: string;
  program_code?: string;
  status?: string;
  drive_type?: string;
  year?: number;
}

export interface ExportResult {
  success: boolean;
  error?: string;
  csv?: string;
  filename?: string;
  rowCount?: number;
}

export async function requestStaffExportAction(
  exportType: ExportType,
  filters: ExportFilters = {}
): Promise<ExportResult> {
  const supabase = await createClient();

  // 1. Authenticate and Authorize Caller
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    !profile.is_active ||
    !["SUPER_ADMIN", "TNP_SECRETARY"].includes(profile.role)
  ) {
    return {
      success: false,
      error: "Unauthorized: Only Super Admin and TNP Secretary can export data",
    };
  }

  // 2. Validate Export Type
  const validTypes: ExportType[] = [
    "APPLICATIONS",
    "DRIVE_RESULTS",
    "PLACEMENT_OUTCOMES",
    "INTERNSHIP_OUTCOMES",
    "COMPANIES",
    "ALUMNI_INDUSTRY",
  ];

  if (!validTypes.includes(exportType)) {
    return { success: false, error: `Invalid export type: ${exportType}` };
  }

  // 3. Query Bounded Dataset via Security Definer RPC
  const { data: exportData, error: rpcErr } = await supabase.rpc(
    "get_staff_export_data",
    {
      p_export_type: exportType,
      p_filters: filters as unknown as Json,
    }
  );

  if (rpcErr) {
    return { success: false, error: rpcErr.message };
  }

  const payload = exportData as {
    export_type: string;
    row_count: number;
    data: Record<string, unknown>[];
  };

  const records = payload.data || [];
  const rowCount = records.length;

  // 4. Map Dataset to Safe Column Headers and Rows
  let headers: string[] = [];
  let rows: (string | number | boolean | null | undefined)[][] = [];

  const dateSuffix = new Date().toISOString().split("T")[0];
  let filename = `export-${dateSuffix}.csv`;

  if (exportType === "APPLICATIONS") {
    filename = `applications-${dateSuffix}.csv`;
    headers = [
      "Student Name",
      "Roll Number",
      "Program",
      "Batch",
      "Drive Title",
      "Company Name",
      "Drive Type",
      "Status",
      "Applied At",
      "Institutional Email",
    ];
    rows = records.map((r) => [
      String(r.student_name || ""),
      String(r.roll_number || ""),
      String(r.program_code || ""),
      String(r.batch_year || ""),
      String(r.drive_title || ""),
      String(r.company_name || ""),
      String(r.drive_type || ""),
      String(r.application_status || ""),
      String(r.applied_at || ""),
      String(r.institutional_email || ""),
    ]);
  } else if (exportType === "DRIVE_RESULTS") {
    filename = `drive-results-${dateSuffix}.csv`;
    headers = [
      "Drive Title",
      "Company Name",
      "Drive Type",
      "Status",
      "Published Year",
      "Total Applied",
      "Total Selected",
      "Conversion Percentage",
    ];
    rows = records.map((r) => [
      String(r.drive_title || ""),
      String(r.company_name || ""),
      String(r.drive_type || ""),
      String(r.drive_status || ""),
      Number(r.published_year || 0),
      Number(r.total_applied || 0),
      Number(r.total_selected || 0),
      Number(r.conversion_percentage || 0),
    ]);
  } else if (exportType === "PLACEMENT_OUTCOMES") {
    filename = `placement-outcomes-${dateSuffix}.csv`;
    headers = [
      "Student Name",
      "Roll Number",
      "Program",
      "Batch",
      "Company Name",
      "Drive Title",
      "Recruitment Year",
      "Selection Date",
      "Institutional Email",
    ];
    rows = records.map((r) => [
      String(r.student_name || ""),
      String(r.roll_number || ""),
      String(r.program_code || ""),
      String(r.batch_year || ""),
      String(r.company_name || ""),
      String(r.drive_title || ""),
      Number(r.recruitment_year || 0),
      String(r.selection_date || ""),
      String(r.institutional_email || ""),
    ]);
  } else if (exportType === "INTERNSHIP_OUTCOMES") {
    filename = `internship-outcomes-${dateSuffix}.csv`;
    headers = [
      "Student Name",
      "Roll Number",
      "Program",
      "Batch",
      "Company Name",
      "Drive Title",
      "Recruitment Year",
      "Selection Date",
      "Institutional Email",
    ];
    rows = records.map((r) => [
      String(r.student_name || ""),
      String(r.roll_number || ""),
      String(r.program_code || ""),
      String(r.batch_year || ""),
      String(r.company_name || ""),
      String(r.drive_title || ""),
      Number(r.recruitment_year || 0),
      String(r.selection_date || ""),
      String(r.institutional_email || ""),
    ]);
  } else if (exportType === "COMPANIES") {
    filename = `companies-summary-${dateSuffix}.csv`;
    headers = [
      "Company Name",
      "Website",
      "Total Drives",
      "Total Hires",
      "First Recruiting Year",
      "Latest Recruiting Year",
    ];
    rows = records.map((r) => [
      String(r.company_name || ""),
      String(r.website || ""),
      Number(r.total_drives || 0),
      Number(r.total_hires || 0),
      r.first_recruiting_year !== null ? Number(r.first_recruiting_year) : "",
      r.latest_recruiting_year !== null ? Number(r.latest_recruiting_year) : "",
    ]);
  } else if (exportType === "ALUMNI_INDUSTRY") {
    filename = `alumni-industry-${dateSuffix}.csv`;
    headers = [
      "Alumnus Name",
      "Graduation Year",
      "Degree Program",
      "Current Organization",
      "Matched Partner Company",
      "Current Role",
      "City",
      "Country",
      "Profile Verified",
    ];
    rows = records.map((r) => [
      String(r.alumnus_name || ""),
      Number(r.graduation_year || 0),
      String(r.degree_program || ""),
      String(r.current_organization || ""),
      String(r.matched_company_name || ""),
      String(r.current_role || ""),
      String(r.city || ""),
      String(r.country || ""),
      Boolean(r.is_verified) ? "Yes" : "No",
    ]);
  }

  // 5. Generate Safe RFC 4180 CSV with Formula Injection Neutralization
  const csvContent = generateCsv(headers, rows);

  // 6. Atomically Record DATA_EXPORT_REQUESTED Audit Log
  const { error: auditErr } = await supabase.rpc("record_export_audit", {
    p_export_type: exportType,
    p_filter_summary: filters as unknown as Json,
    p_row_count: rowCount,
  });

  if (auditErr) {
    console.error("Failed to record export audit log:", auditErr.message);
  }

  return {
    success: true,
    csv: csvContent,
    filename,
    rowCount,
  };
}
