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

type Props =
  | { kind: "contractor"; status: ContractorStatus }
  | { kind: "document"; status: DocumentStatus }
  | { kind: "project"; status: ProjectStatus };

export function StatusBadge(props: Props) {
  const meta =
    props.kind === "contractor"
      ? contractorStatusMeta[props.status]
      : props.kind === "document"
        ? documentStatusMeta[props.status]
        : projectStatusMeta[props.status];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      {meta.label}
    </span>
  );
}
