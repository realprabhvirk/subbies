import {
  contractorStatusMeta,
  documentStatusMeta,
  projectContractorStatusMeta,
  projectStatusMeta,
  requirementStateMeta,
} from "@/lib/status";
import type { ProjectContractorStatus, RequirementState } from "@/lib/compliance/project";
import type {
  ContractorStatus,
  DocumentStatus,
  ProjectStatus,
} from "@/lib/types";

type Props = (
  | { kind: "contractor"; status: ContractorStatus }
  | { kind: "document"; status: DocumentStatus }
  | { kind: "project"; status: ProjectStatus }
  | { kind: "projectContractor"; status: ProjectContractorStatus }
  | { kind: "requirement"; status: RequirementState }
) & {
  /** "sm" for dense rows; default for headers and cards. */
  size?: "sm" | "md";
  className?: string;
};

/**
 * The status pill: a full-radius pill with a tinted background, dark text and
 * an icon, never colour alone. Used for contractor, document and project
 * status everywhere. (Called StatusBadge in the code; "StatusPill" in the
 * design brief is this component.)
 */
export function StatusBadge({ size = "md", className = "", ...props }: Props) {
  const meta =
    props.kind === "contractor"
      ? contractorStatusMeta[props.status]
      : props.kind === "document"
        ? documentStatusMeta[props.status]
        : props.kind === "projectContractor"
          ? projectContractorStatusMeta[props.status]
          : props.kind === "requirement"
            ? requirementStateMeta[props.status]
            : projectStatusMeta[props.status];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border font-semibold ${
        size === "sm" ? "h-7 gap-1.5 px-2.5 text-2xs" : "h-8 gap-1.5 px-3 text-xs"
      } ${meta.className} ${className}`}
    >
      <Icon
        className={size === "sm" ? "h-4 w-4" : "h-[1.125rem] w-[1.125rem]"}
        strokeWidth={2.25}
        aria-hidden
      />
      {meta.label}
    </span>
  );
}
