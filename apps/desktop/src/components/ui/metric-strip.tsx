import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";

export interface MetricCell {
  key: string;
  label: string;
  /** Pre-formatted display string — callers own their own currency/number
   *  formatting (formatCurrency varies slightly per page), this component
   *  only owns the shared layout and numeric typography. Used as-is when
   *  `numericValue` isn't given (e.g. non-numeric cells), and as the very
   *  first paint's text either way. */
  value: string;
  /** The raw number `value` was formatted from — when set, the cell ticks
   *  up/down with a spring on every value change instead of snapping
   *  straight to the new text. Pair with `format`. */
  numericValue?: number;
  /** Re-applied to the interpolated value on every animation frame — must
   *  produce the same string as `value` when called with `numericValue`. */
  format?: (value: number) => string;
  icon?: ComponentType<{ className?: string; strokeWidth?: number | string }>;
  /** Small trailing indicator next to the value — a delta badge, a trend
   *  arrow, a count pill. Rendered as-is, no assumptions about its shape. */
  trend?: ReactNode;
  /** Optional secondary line under the value (e.g. "3 impayées"). */
  sublabel?: ReactNode;
}

export interface MetricStripProps {
  cells: MetricCell[];
  className?: string;
}

/**
 * Shared KPI header strip — the same bordered, divided, glass-card ribbon
 * used on the Dashboard (Tier 2), now factored out so every CRUD list page
 * builds its top metrics from one component instead of a hand-rolled card
 * grid per page.
 */
// Static map, not a template literal — Tailwind only picks up class names
// it can see verbatim in source, so `sm:grid-cols-${n}` would get purged.
const RESPONSIVE_COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
};

export function MetricStrip({ cells, className }: MetricStripProps) {
  const cols = RESPONSIVE_COLS[cells.length] ?? "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <div
      className={cn(
        "grid grid-cols-2 divide-x divide-y sm:divide-y-0 divide-border/40 border border-border/40 rounded-2xl bg-card/60 backdrop-blur-sm p-4",
        cols,
        className
      )}
    >
      {cells.map((cell) => {
        const Icon = cell.icon;
        return (
          <div key={cell.key} className="px-4 first:ps-1 last:pe-1 py-1 min-w-0">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />}
              <span className="text-[10px] font-semibold uppercase tracking-wider truncate">{cell.label}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {cell.numericValue !== undefined && cell.format ? (
                <AnimatedNumber
                  value={cell.numericValue}
                  format={cell.format}
                  className="text-2xl font-bold font-mono tabular-nums tracking-tight text-foreground"
                />
              ) : (
                <span className="text-2xl font-bold font-mono tabular-nums tracking-tight text-foreground">{cell.value}</span>
              )}
              {cell.trend}
            </div>
            {cell.sublabel && <div className="mt-0.5 text-xs text-muted-foreground">{cell.sublabel}</div>}
          </div>
        );
      })}
    </div>
  );
}

/** Shared delta/trend badge — same shape as the Dashboard's N-1 comparison
 *  pill, for pages that want a trend indicator next to a metric value. */
export function MetricTrendBadge({ good, children }: { good: boolean | null; children: ReactNode }) {
  if (good === null) return null;
  return (
    <span
      className={cn(
        "text-xs font-mono font-semibold px-1.5 py-0.5 rounded-full border shrink-0",
        good
          ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400"
          : "text-rose-600 bg-rose-500/10 border-rose-500/20 dark:text-rose-400"
      )}
    >
      {children}
    </span>
  );
}
