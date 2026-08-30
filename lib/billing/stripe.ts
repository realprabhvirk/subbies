import "server-only";

import Stripe from "stripe";

let cached: Stripe | null = null;

/** The Stripe client, or null if the secret key isn't configured. */
export function getStripe(): Stripe | null {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  cached = new Stripe(key, {
    apiVersion: "2026-08-26.dahlia",
    appInfo: { name: "Subbies" },
  });
  return cached;
}
