import type { LucideIcon } from "lucide-react";
import {
  CircleCheck,
  CircleDashed,
  Clock,
  TriangleAlert,
  CircleX,
  CircleDot,
  PauseCircle,
} from "lucide-react";

import type {
  ContractorStatus,
  DocumentStatus,
  ProjectStatus,
} from "@/lib/types";

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
      "text-neutral-status bg-neutral-status-bg",
  },
  awaiting_review: {
    label: "Awaiting review",
    icon: Clock,
    className: "text-review bg-review-bg",
  },
  approved: {
    label: "Approved",
    icon: CircleCheck,
    className: "text-approved bg-approved-bg",
  },
  attention_required: {
    label: "Attention required",
    icon: TriangleAlert,
    className: "text-attention bg-attention-bg",
  },
  expired: {
    label: "Expired",
    icon: CircleX,
    className: "text-expired bg-expired-bg",
  },
};

export const documentStatusMeta: Record<DocumentStatus, StatusMeta> = {
  requested: {
    label: "Not uploaded",
    icon: CircleDashed,
    className:
      "text-neutral-status bg-neutral-status-bg",
  },
  uploaded: {
    label: "Awaiting review",
    icon: Clock,
    className: "text-review bg-review-bg",
  },
  approved: {
    label: "Approved",
    icon: CircleCheck,
    className: "text-approved bg-approved-bg",
  },
  rejected: {
    label: "Rejected",
    icon: CircleX,
    className: "text-expired bg-expired-bg",
  },
};

export const projectStatusMeta: Record<ProjectStatus, StatusMeta> = {
  active: {
    label: "Active",
    icon: CircleDot,
    className: "text-review bg-review-bg",
  },
  on_hold: {
    label: "On hold",
    icon: PauseCircle,
    className:
      "text-neutral-status bg-neutral-status-bg",
  },
  completed: {
    label: "Completed",
    icon: CircleCheck,
    className: "text-approved bg-approved-bg",
  },
};
