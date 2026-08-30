import { ShieldCheck } from "lucide-react";

export function Logo({
  className = "",
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "inverse";
}) {
  const color = tone === "inverse" ? "text-ink-inverse" : "text-brand-ink";
  return (
    <span className={`inline-flex items-center gap-2 ${color} ${className}`}>
      <ShieldCheck className="h-5 w-5" strokeWidth={2} aria-hidden />
      <span className="text-lg font-semibold tracking-tight">Subbies</span>
    </span>
  );
}
