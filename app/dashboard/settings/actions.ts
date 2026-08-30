"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";

export interface CompanyProfileState {
  ok: boolean;
  error?: string;
  fieldErrors?: { name?: string; address?: string; phone?: string };
}

export async function updateCompanyProfile(
  _prev: CompanyProfileState | null,
  formData: FormData,
): Promise<CompanyProfileState> {
  const company = await getCompany();
  if (!company) {
    return { ok: false, error: "Your session has expired. Reload and try again." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const fieldErrors: CompanyProfileState["fieldErrors"] = {};
  if (!name) fieldErrors.name = "Company name is required.";
  else if (name.length > 120) fieldErrors.name = "Keep it under 120 characters.";
  if (address.length > 250) fieldErrors.address = "Keep it under 250 characters.";
  if (phone.length > 40) fieldErrors.phone = "Keep it under 40 characters.";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ name, address: address || null, phone: phone || null })
    .eq("id", company.id);

  if (error) {
    console.error("updateCompanyProfile failed", error);
    return { ok: false, error: "Couldn't save your changes. Try again." };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
