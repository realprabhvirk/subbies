/**
 * A donut built from plain SVG arcs: no chart library. Segments are drawn as
 * stroked circles with a dash pattern, from 12 o'clock, clockwise. The total
 * sits in the centre. Colour is never the only cue: pair it with
 * <DonutLegend> (label, count, percentage) beside it; the svg itself carries
 * a text alternative that reads the same numbers.
 *
 * An empty or all-zero chart draws a neutral ring.
 */

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  /** A CSS colour, normally a token: "var(--color-tile-approved-disc)". */
  color: string;
}

const SIZE = 220;
const STROKE = 34;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export function DonutChart({
  segments,
  centerLabel,
  className = "w-full max-w-60",
}: {
  segments: DonutSegment[];
  /** The line under the total, e.g. "Total contractors". */
  centerLabel: string;
  /** Replaces the default sizing (w-full max-w-60). */
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const alt = `${total} ${centerLabel.toLowerCase()}: ${segments
    .map((s) => `${s.value} ${s.label.toLowerCase()}`)
    .join(", ")}`;

  let offset = 0;
  // A hairline gap between segments, only when there is more than one.
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 3 : 0;

  return (
    <div className={`relative mx-auto aspect-square ${className}`}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={alt}
        className="h-full w-full -rotate-90"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={STROKE}
        />
        {total > 0 &&
          visible.map((s) => {
            const length = (s.value / total) * CIRC;
            const dash = Math.max(length - gap, 0.5);
            const circle = (
              <circle
                key={s.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${CIRC - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return circle;
          })}
      </svg>
      <div
        aria-hidden
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
      >
        <span className="figure text-5xl text-ink">{total}</span>
        <span className="mt-1 max-w-[9ch] text-xs leading-tight text-ink-muted">{centerLabel}</span>
      </div>
    </div>
  );
}

export function DonutLegend({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <ul className="space-y-3.5">
      {segments.map((s) => (
        <li key={s.key} className="flex items-center gap-3 text-sm">
          <span
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 rounded-full"
            style={{ backgroundColor: s.color }}
          />
          <span className="min-w-0 flex-1 text-ink">{s.label}</span>
          <span className="font-mono text-xs font-medium tabular-nums text-ink">
            {s.value}
            <span className="ml-1.5 text-ink-muted">
              ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
