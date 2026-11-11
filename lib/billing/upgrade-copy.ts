/**
 * The words in an UpgradePrompt, built only from PLAN_CONFIG and the typed
 * error the server returned. Pure, so it runs under plain `node --test`.
 */
import {
  FEATURE_LABEL,
  PLAN_CONFIG,
  RESOURCE_NOUN,
  limitFor,
  limitLine,
  type LimitResource,
  type PlanError,
  type PlanFeature,
  type PlanId,
} from "./plans.ts";

export interface PromptCopy {
  plan: PlanId;
  title: string;
  why: string;
  bullets: string[];
}

/** The words for a prompt; null when no plan would unlock it. */
export function promptCopy(error: PlanError): PromptCopy | null {
  if (!error.requiredPlan) return null;
  const plan = PLAN_CONFIG[error.requiredPlan];

  if (error.code === "PLAN_FEATURE") {
    const label = FEATURE_LABEL[error.feature];
    const current = error.currentPlan ? PLAN_CONFIG[error.currentPlan].name : "current";
    return {
      plan: plan.id,
      title: `${label}: available on ${plan.name}`,
      why: `Your ${current} plan doesn't include this.`,
      bullets: featureBullets(error.feature, plan.id),
    };
  }

  const noun = RESOURCE_NOUN[error.resource];
  const lim = error.limit;
  return {
    plan: plan.id,
    title: lim === 0 ? `${cap(noun.many)} aren't included` : `${cap(noun.one)} limit reached`,
    why:
      lim === 0
        ? `Your plan doesn't include ${noun.many}.`
        : `Your plan allows ${limitLine(lim, error.resource).toLowerCase()} and you have ${error.used}.`,
    bullets: limitBullets(error.resource, plan.id),
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the plan unlocks for this resource first, then its other limits. */
function limitBullets(resource: LimitResource, plan: PlanId): string[] {
  const order: LimitResource[] = ["contractors", "documentTypes", "projects"];
  const rest = order.filter((r) => r !== resource);
  return [resource, ...rest].slice(0, 3).map((r) => limitLine(limitFor(plan, r), r));
}

/**
 * The feature itself, then the plan's top two limits. Deliberately not other
 * gated features: those may not have shipped yet, and a prompt mustn't
 * advertise anything that isn't live.
 */
function featureBullets(feature: PlanFeature, plan: PlanId): string[] {
  return [
    FEATURE_LABEL[feature],
    limitLine(limitFor(plan, "contractors"), "contractors"),
    limitLine(limitFor(plan, "projects"), "projects"),
  ];
}
