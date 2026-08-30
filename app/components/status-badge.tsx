import { contractorStatusMeta, documentStatusMeta } from "@/lib/status";
import type { ContractorStatus, DocumentStatus } from "@/lib/types";

type Props =
  | { kind: "contractor"; status: ContractorStatus }
  | { kind: "document"; status: DocumentStatus };

export function StatusBadge(props: Props) {
  const meta =
    props.kind === "contractor"
      ? contractorStatusMeta[props.status]
      : documentStatusMeta[props.status];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      {meta.label}
    </span>
  );
}
