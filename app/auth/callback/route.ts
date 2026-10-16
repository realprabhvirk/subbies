import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/auth/redirect-path";

export const dynamic = "force-dynamic";

/**
 * Where the email-confirmation link (and any other Supabase auth email) lands.
 *
 * Supabase's SSR auth uses the PKCE flow: the link carries a one-time `code`
 * that has to be exchanged for a session here, server-side, which also sets
 * the auth cookies. Without this route the confirmation link would drop the
 * person back on the site still logged out, with a stray `?code=` nothing
 * reads — so email confirmation can be switched on without that dead end.
 *
 * After a good exchange we send them to the dashboard; the dashboard gate then
 * routes a brand-new account on to plan selection, and finishes creating the
 * company row from the name carried in their signup metadata. On a bad or
 * expired link we send them to login with a flag so they see a clear message
 * instead of a blank failure.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");

  // `next` is only ever a same-origin path (safeRedirectPath enforces that),
  // so this can't be turned into an open redirect.
  const next = safeRedirectPath(searchParams.get("next"), "/dashboard");

  if (errorDescription || !code) {
    console.error("auth callback: no code / error from provider", { errorDescription });
    return NextResponse.redirect(`${origin}/login?confirm=failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("auth callback: code exchange failed", error.message);
    return NextResponse.redirect(`${origin}/login?confirm=failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
