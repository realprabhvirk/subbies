import { CircleCheck, TriangleAlert, CircleX, Info } from "lucide-react";

/**
 * An inline notice. Tones map to the same status hues used on badges, so an
 * "expiring soon" warning here reads as the same colour as an "expiring soon"
 * badge on a contractor row.
 */

export type AlertTone = "success" | "warning" | "error" | "info";

const TONE = {
  success: { cls: "bg-approved-bg text-approved", icon: CircleCheck },
  warning: { cls: "bg-attention-bg text-attention", icon: TriangleAlert },
  error: { cls: "bg-expired-bg text-expired", icon: CircleX },
  info: { cls: "bg-review-bg text-review", icon: Info },
} as const satisfies Record<
  AlertTone,
  { cls: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }
>;

export function Alert({
  tone = "info",
  action,
  className = "",
  children,
}: {
  tone?: AlertTone;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const { cls, icon: Icon } = TONE[tone];
  return (
    <div
      className={`flex items-start gap-2 rounded-md px-3.5 py-2.5 text-sm ${cls} ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      <span className="flex-1">{children}</span>
      {action}
    </div>
  );
}
