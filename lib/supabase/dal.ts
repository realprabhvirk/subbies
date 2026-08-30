import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/types";

/**
 * Data Access Layer.
 *
 * Every server-side read of user-scoped data should start here so the auth
 * check can't be forgotten. `cache` dedupes the work within a single render.
 */

export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const requireUser = cache(async (): Promise<User> => {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
});

/**
 * The company row for the signed-in user. Returns null if the auth user has
 * no company record yet (a broken signup) so the caller can show a recovery
 * state instead of looping through /login.
 */
export const getCompany = cache(async (): Promise<Company | null> => {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .select("id, user_id, name, created_at")
    .eq("user_id", user.id)
    .maybeSingle<Company>();

  if (error) {
    console.error("Failed to load company", error);
    return null;
  }

  return data;
});
