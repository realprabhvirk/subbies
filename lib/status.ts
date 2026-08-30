import type { LucideIcon } from "lucide-react";
import {
  CircleCheck,
  CircleDashed,
  Clock,
  TriangleAlert,
  CircleX,
} from "lucide-react";

import type { ContractorStatus, DocumentStatus } from "@/lib/types";

interface StatusMeta {
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for the badge (text + background + border tokens). */
  className: string;
}

export const contractorStatusMeta: Record<ContractorStatus, StatusMeta> = {
  pending: {
    label: "Pending onboarding",
    icon: CircleDashed,
    className:
      "text-neutral-status bg-neutral-status-bg border-neutral-status-line",
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
    className:
      "text-neutral-status bg-neutral-status-bg border-neutral-status-line",
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
};
