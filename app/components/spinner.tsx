import { Loader2 } from "lucide-react";

/** Small inline loading spinner. Pair it with text for button pending states. */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Loader2
      className={`animate-spin ${className}`}
      strokeWidth={2}
      aria-hidden
    />
  );
}
