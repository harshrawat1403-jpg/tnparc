import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { AuditViewerClient, type AuditLogItem } from "./AuditViewerClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Institutional Audit Log",
  description:
    "Role-aware immutable audit trail and security event inspection.",
};

interface AdminAuditPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminAuditPage(props: AdminAuditPageProps) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/admin/audit");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, display_name")
    .eq("id", user.id)
    .single();

  const isAuthorized =
    profile &&
    profile.is_active &&
    (profile.role === "SUPER_ADMIN" || profile.role === "TNP_SECRETARY");

  if (!isAuthorized) {
    redirect("/unauthorized");
  }

  // Parse pagination and filter params
  const rawPage =
    typeof searchParams.page === "string" ? parseInt(searchParams.page, 10) : 1;
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  const action =
    typeof searchParams.action === "string" && searchParams.action.trim()
      ? searchParams.action.trim()
      : undefined;

  const entityType =
    typeof searchParams.entity_type === "string" &&
    searchParams.entity_type.trim()
      ? searchParams.entity_type.trim()
      : undefined;

  const startDate =
    typeof searchParams.start_date === "string" &&
    searchParams.start_date.trim()
      ? searchParams.start_date.trim()
      : undefined;

  const endDate =
    typeof searchParams.end_date === "string" && searchParams.end_date.trim()
      ? searchParams.end_date.trim()
      : undefined;

  // Call database-authoritative role-aware audit page RPC
  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    "get_audit_log_page",
    {
      p_limit: pageSize,
      p_offset: offset,
      p_action: action || undefined,
      p_entity_type: entityType || undefined,
      p_start_date: startDate ? new Date(startDate).toISOString() : undefined,
      p_end_date: endDate ? new Date(endDate).toISOString() : undefined,
    }
  );

  if (rpcError) {
    console.error("[AdminAuditPage] RPC Error:", rpcError);
  }

  interface RpcAuditRow {
    id: string;
    created_at: string;
    actor_id: string | null;
    actor_name: string | null;
    actor_role: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    metadata: unknown;
    total_count: number | string | null;
  }

  const rawList = (rpcRows || []) as unknown as RpcAuditRow[];
  const totalCount =
    rawList.length > 0 && rawList[0]?.total_count
      ? Number(rawList[0]?.total_count)
      : 0;

  const formattedLogs: AuditLogItem[] = rawList.map((row) => ({
    id: row.id,
    created_at: row.created_at,
    actor_id: row.actor_id,
    actor_name: row.actor_name,
    actor_role: row.actor_role,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    metadata: (row.metadata as Record<string, unknown>) || null,
    total_count: Number(row.total_count || 0),
  }));

  return (
    <div className="py-10">
      <Container size="xl">
        <AuditViewerClient
          logs={formattedLogs}
          totalCount={totalCount}
          currentPage={page}
          pageSize={pageSize}
          userRole={profile.role as "SUPER_ADMIN" | "TNP_SECRETARY"}
          filters={{
            action,
            entity_type: entityType,
            start_date: startDate,
            end_date: endDate,
          }}
        />
      </Container>
    </div>
  );
}
