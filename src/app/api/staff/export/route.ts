import { NextRequest, NextResponse } from "next/server";
import {
  requestStaffExportAction,
  ExportType,
  ExportFilters,
} from "@/lib/actions/exports";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const exportType = searchParams.get("type") as ExportType | null;

  if (!exportType) {
    return NextResponse.json(
      { error: "Missing export type parameter" },
      { status: 400 }
    );
  }

  const filters: ExportFilters = {};
  const driveId = searchParams.get("drive_id");
  if (driveId) filters.drive_id = driveId;

  const batch = searchParams.get("batch");
  if (batch) filters.batch = batch;

  const programCode = searchParams.get("program_code");
  if (programCode) filters.program_code = programCode;

  const status = searchParams.get("status");
  if (status) filters.status = status;

  const driveType = searchParams.get("drive_type");
  if (driveType) filters.drive_type = driveType;

  const yearStr = searchParams.get("year");
  if (yearStr) filters.year = parseInt(yearStr, 10);

  const result = await requestStaffExportAction(exportType, filters);

  if (!result.success || !result.csv) {
    return NextResponse.json(
      { error: result.error || "Export failed" },
      { status: result.error?.includes("Unauthorized") ? 403 : 400 }
    );
  }

  return new NextResponse(result.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
