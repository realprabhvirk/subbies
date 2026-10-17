import {
  contractorStatusMeta,
  documentStatusMeta,
  projectStatusMeta,
} from "@/lib/status";
import type {
  ContractorStatus,
  DocumentStatus,
  ProjectStatus,
} from "@/lib/types";

type Props = (
  | { kind: "contractor"; status: ContractorStatus }
  | { kind: "document"; status: DocumentStatus }
  | { kind: "project"; status: ProjectStatus }
) & {
  /** "sm" for dense rows; default for headers and cards. */
  size?: "sm" | "md";
  className?: string;
};

/**
 * The status stamp — Subbies' signature mark.
 *
 * A squared stamp (4px radius, hairline border in the status' own line
 * colour) with an icon and a word, never colour alone. Expired is the one
 * stamp printed as a solid fill (see lib/status.ts), so it reads as
 * unmistakably different from "attention" even though the two status hues
 * are nearly identical in the locked palette.
 */
export function StatusBadge({ size = "md", className = "", ...props }: Props) {
  const meta =
    props.kind === "contractor"
      ? contractorStatusMeta[props.status]
      : props.kind === "document"
        ? documentStatusMeta[props.status]
        : projectStatusMeta[props.status];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-sm border font-semibold ${
        size === "sm" ? "h-6 gap-1 px-1.5 text-2xs" : "h-7 gap-1.5 px-2 text-xs"
      } ${meta.className} ${className}`}
    >
      <Icon
        className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"}
        strokeWidth={2.25}
        aria-hidden
      />
      {meta.label}
    </span>
  );
}
