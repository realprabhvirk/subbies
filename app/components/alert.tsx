import { CircleCheck, TriangleAlert, CircleX, Info } from "lucide-react";

/**
 * An inline notice. Tones map to the same status hues as the stamps, so an
 * "expiring soon" warning here reads as the same colour as an expiring stamp
 * on a contractor row. A hairline border in the tone's line colour keeps a
 * warning and an error distinguishable by more than tint alone (the icons
 * differ too).
 */

export type AlertTone = "success" | "warning" | "error" | "info";

const TONE = {
  success: { cls: "bg-approved-bg/70 text-approved border-approved-line", icon: CircleCheck },
  warning: { cls: "bg-attention-bg/70 text-attention border-attention-line", icon: TriangleAlert },
  error: { cls: "bg-expired-bg/70 text-expired border-expired-line", icon: CircleX },
  info: { cls: "bg-review-bg/60 text-review border-review-line", icon: Info },
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
      className={`flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm ${cls} ${className}`}
    >
      <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0" strokeWidth={2.25} aria-hidden />
      <span className="flex-1 [&_a]:font-semibold">{children}</span>
      {action}
    </div>
  );
}
