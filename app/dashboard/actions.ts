"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";

export async function markNotificationsRead(): Promise<{ ok: boolean }> {
  const company = await getCompany();
  if (!company) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("company_id", company.id)
    .is("read_at", null);

  if (error) {
    console.error("markNotificationsRead failed", error);
    return { ok: false };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
