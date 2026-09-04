import "server-only";

import Stripe from "stripe";

/**
 * Turns a thrown Stripe error into (a) a structured object worth logging and
 * (b) a message the person staring at the failure can act on.
 *
 * Every billing failure used to collapse into "Couldn't start checkout. Try
 * again." — which is indistinguishable from a network blip, a missing env var,
 * a stale Price ID, and a test/live key mismatch. Those need different fixes,
 * so they get different messages.
 */
export interface BillingFailure {
  /** Safe to show to the user. */
  message: string;
  /** Structured detail for the server log. */
  log: Record<string, unknown>;
}

function isStripeError(err: unknown): err is Stripe.errors.StripeError {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    typeof (err as { type: unknown }).type === "string" &&
    (err as { type: string }).type.startsWith("Stripe")
  );
}

export function describeBillingError(
  err: unknown,
  fallback: string,
): BillingFailure {
  if (!isStripeError(err)) {
    return {
      message: fallback,
      log: { kind: "non-stripe", error: err instanceof Error ? err.message : String(err) },
    };
  }

  const log: Record<string, unknown> = {
    kind: "stripe",
    type: err.type,
    code: err.code,
    param: err.param,
    statusCode: err.statusCode,
    requestId: err.requestId,
    message: err.message,
  };

  // A Price ID that Stripe doesn't recognise in this account/mode. Almost
  // always a stale or wrong-mode STRIPE_PRICE_* env var.
  if (err.code === "resource_missing" && String(err.param ?? "").includes("price")) {
    return {
      message:
        "Stripe doesn't recognise this plan's price. The STRIPE_PRICE_* value for it is stale, blank, or from the other Stripe mode (test vs live). Update it in the deployment's environment settings.",
      log,
    };
  }

  if (err.type === "StripeAuthenticationError") {
    return {
      message:
        "Stripe rejected our API key. Check STRIPE_SECRET_KEY in the deployment's environment settings.",
      log,
    };
  }

  if (err.type === "StripePermissionError") {
    return {
      message:
        "Stripe refused this request for the configured API key. Check the key's permissions and that it belongs to the right account.",
      log,
    };
  }

  if (err.type === "StripeInvalidRequestError") {
    return {
      message: `Stripe rejected the request: ${err.message}`,
      log,
    };
  }

  if (err.type === "StripeConnectionError" || err.type === "StripeAPIError") {
    return { message: "Stripe is unreachable right now. Try again in a moment.", log };
  }

  return { message: fallback, log };
}

/** An inactive (archived) price can't be used in Checkout — catch it early. */
export function priceUnusableReason(price: Stripe.Price): string | null {
  if (!price.active) {
    return "archived in Stripe";
  }
  if (!price.recurring) {
    return "a one-off price, not a subscription price";
  }
  return null;
}
