"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CompanyActionResult {
  success?: string;
  error?: string;
  companyId?: string;
}

/**
 * Staff (Super Admin & Secretary): Create a canonical company entry
 */
export async function submitCreateCompany(
  prevState: CompanyActionResult | null,
  formData: FormData
): Promise<CompanyActionResult> {
  const name = formData.get("name") as string;
  const website = (formData.get("website") as string) || "";
  const description = (formData.get("description") as string) || "";

  if (!name || name.trim().length === 0) {
    return { error: "Company name is required." };
  }

  const cleanName = name.trim();
  if (cleanName.length > 200) {
    return { error: "Company name cannot exceed 200 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_company", {
    p_name: cleanName,
    p_website: website.trim() || undefined,
    p_description: description.trim() || undefined,
  });

  if (error) {
    if (error.code === "23505" || error.message.includes("normalized_name")) {
      return {
        error:
          "A company with this name or normalized identity already exists.",
      };
    }
    return { error: error.message };
  }

  const res = data as unknown as { success?: boolean; company_id?: string };
  revalidatePath("/staff/companies");
  return {
    success: "Company created successfully.",
    companyId: res?.company_id,
  };
}

/**
 * Staff (Super Admin & Secretary): Update company details
 */
export async function submitUpdateCompany(
  companyId: string,
  prevState: CompanyActionResult | null,
  formData: FormData
): Promise<CompanyActionResult> {
  const name = formData.get("name") as string;
  const website = (formData.get("website") as string) || "";
  const description = (formData.get("description") as string) || "";

  if (!name || name.trim().length === 0) {
    return { error: "Company name is required." };
  }

  const cleanName = name.trim();
  if (cleanName.length > 200) {
    return { error: "Company name cannot exceed 200 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_company", {
    p_company_id: companyId,
    p_name: cleanName,
    p_website: website.trim() || undefined,
    p_description: description.trim() || undefined,
  });

  if (error) {
    if (error.code === "23505" || error.message.includes("normalized_name")) {
      return {
        error: "Another company with this normalized name already exists.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/staff/companies");
  revalidatePath(`/staff/companies/${companyId}`);
  return { success: "Company details updated successfully." };
}

/**
 * Staff (Super Admin & Secretary): Archive a company
 */
export async function submitArchiveCompany(
  companyId: string
): Promise<CompanyActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_company", {
    p_company_id: companyId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/companies");
  revalidatePath(`/staff/companies/${companyId}`);
  return { success: "Company has been archived." };
}

/**
 * Staff (Super Admin & Secretary): Reactivate an archived company
 */
export async function submitReactivateCompany(
  companyId: string
): Promise<CompanyActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reactivate_company", {
    p_company_id: companyId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/companies");
  revalidatePath(`/staff/companies/${companyId}`);
  return { success: "Company has been reactivated." };
}
