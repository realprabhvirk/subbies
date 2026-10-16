import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Secure in production; off on http://localhost for local dev.
      cookieOptions: { secure: process.env.NODE_ENV === "production" },
    }
  )
}