import type { LucideIcon } from "lucide-react";
import {
  CircleCheck,
  CircleDashed,
  Clock,
  TriangleAlert,
  CircleX,
  CircleDot,
  PauseCircle,
  Ban,
  CalendarClock,
} from "lucide-react";

import type {
  ContractorStatus,
  DocumentStatus,
  ProjectStatus,
} from "@/lib/types";
import type { ProjectContractorStatus, RequirementState } from "@/lib/compliance/project";

interface StatusMeta {
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for the pill (text + background + border tokens). */
  className: string;
}

export const contractorStatusMeta: Record<ContractorStatus, StatusMeta> = {
  pending: {
    label: "Pending onboarding",
    icon: CircleDashed,
    className: "text-neutral-status bg-neutral-status-bg border-neutral-status-line",
  },
  awaiting_review: {
    label: "Awaiting review",
    icon: Clock,
    className: "text-review bg-review-bg border-review-line",
  },
  approved: {
    label: "Approved",
    icon: CircleCheck,
    className: "text-approved bg-approved-bg border-approved-line",
  },
  attention_required: {
    label: "Attention required",
    icon: TriangleAlert,
    className: "text-attention bg-attention-bg border-attention-line",
  },
  // Pink pill with a red icon and word; "attention" is amber, so the two
  // can't be confused even without the label.
  expired: {
    label: "Expired",
    icon: CircleX,
    className: "text-expired bg-expired-bg border-expired-line",
  },
};

export const documentStatusMeta: Record<DocumentStatus, StatusMeta> = {
  requested: {
    label: "Not uploaded",
    icon: CircleDashed,
    className: "text-neutral-status bg-neutral-status-bg border-neutral-status-line",
  },
  uploaded: {
    label: "Awaiting review",
    icon: Clock,
    className: "text-review bg-review-bg border-review-line",
  },
  approved: {
    label: "Approved",
    icon: CircleCheck,
    className: "text-approved bg-approved-bg border-approved-line",
  },
  rejected: {
    label: "Rejected",
    icon: CircleX,
    className: "text-expired bg-expired-bg border-expired-line",
  },
  revoked: {
    label: "Revoked",
    icon: Ban,
    className: "text-neutral-status bg-neutral-status-bg border-neutral-status-line",
  },
};

export const projectStatusMeta: Record<ProjectStatus, StatusMeta> = {
  active: {
    label: "Active",
    icon: CircleDot,
    className: "text-review bg-review-bg border-review-line",
  },
  on_hold: {
    label: "On hold",
    icon: PauseCircle,
    className: "text-neutral-status bg-neutral-status-bg border-neutral-status-line",
  },
  // Lifecycle, not compliance: neutral, never green.
  completed: {
    label: "Completed",
    icon: CircleCheck,
    className: "text-neutral-status bg-neutral-status-bg border-neutral-status-line",
  },
};

/** A contractor's standing on one project (the compliance engine). */
export const projectContractorStatusMeta: Record<ProjectContractorStatus, StatusMeta> = {
  compliant: {
    label: "Cleared",
    icon: CircleCheck,
    className: "text-approved bg-approved-bg border-approved-line",
  },
  expiring: {
    label: "Expiring soon",
    icon: CalendarClock,
    className: "text-attention bg-attention-bg border-attention-line",
  },
  pending_review: {
    label: "Pending review",
    icon: Clock,
    className: "text-review bg-review-bg border-review-line",
  },
  not_cleared: {
    label: "Not cleared",
    icon: CircleX,
    className: "text-expired bg-expired-bg border-expired-line",
  },
};

/** One requirement for one contractor. */
export const requirementStateMeta: Record<RequirementState, StatusMeta> = {
  valid: {
    label: "Valid",
    icon: CircleCheck,
    className: "text-approved bg-approved-bg border-approved-line",
  },
  expiring: {
    label: "Expiring soon",
    icon: CalendarClock,
    className: "text-attention bg-attention-bg border-attention-line",
  },
  pending_review: {
    label: "Pending review",
    icon: Clock,
    className: "text-review bg-review-bg border-review-line",
  },
  rejected: {
    label: "Rejected",
    icon: CircleX,
    className: "text-expired bg-expired-bg border-expired-line",
  },
  expired: {
    label: "Expired",
    icon: CircleX,
    className: "text-expired bg-expired-bg border-expired-line",
  },
  missing: {
    label: "Missing",
    icon: CircleDashed,
    className: "text-expired bg-expired-bg border-expired-line",
  },
};
