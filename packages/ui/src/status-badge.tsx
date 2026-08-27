import * as React from "react";
import { cn } from "./lib/utils";

export type StatusBadgeTone = "success" | "warning" | "error" | "neutral";

const DOT_COLORS: Record<StatusBadgeTone, string> = {
  // Solid dot colors (not alpha-tinted like the old colored-pill badges) —
  // a 5px dot needs full saturation to actually read as a color at that size.
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  neutral: "bg-muted-foreground/50",
};

/** Pure className generator, same pattern as badgeVariants — for the rare
 *  spot a status chip needs to render as something other than a plain div
 *  (e.g. a DropdownMenuTrigger's clickable button). Doesn't include the
 *  dot itself; pair with <StatusDot tone=.../> as the first child. */
export function statusBadgeVariants({ className }: { className?: string } = {}) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition-colors",
    className
  );
}

export function StatusDot({ tone = "neutral", className }: { tone?: StatusBadgeTone; className?: string }) {
  return <span className={cn("h-[5px] w-[5px] rounded-full shrink-0", DOT_COLORS[tone], className)} />;
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: StatusBadgeTone;
}

/**
 * Crimson/Coral Red rebrand's "Status Chips" spec: a neutral monochrome
 * pill (same background/text treatment regardless of status) with a small
 * 5px colored micro-dot carrying the actual status color — replaces the
 * prior alpha-tinted colored-pill Badge variants (success/warning/error)
 * for genuine status indicators. Not a Badge variant itself since Badge is
 * also used for non-status chips (e.g. a percentage-of-equity tag) that
 * shouldn't grow a dot.
 */
export function StatusBadge({ tone = "neutral", className, children, ...props }: StatusBadgeProps) {
  return (
    <div className={statusBadgeVariants({ className })} {...props}>
      <StatusDot tone={tone} />
      {children}
    </div>
  );
}
