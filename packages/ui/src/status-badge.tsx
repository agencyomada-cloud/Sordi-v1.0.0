import * as React from "react";
import { cn } from "./lib/utils";

export type StatusBadgeTone = "success" | "warning" | "error" | "neutral" | "info";

const DOT_COLORS: Record<StatusBadgeTone, string> = {
  // Solid dot colors (not alpha-tinted like the old colored-pill badges) —
  // a 5px dot needs full saturation to actually read as a color at that size.
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  neutral: "bg-muted-foreground/50",
  // "In progress" blue, distinct from neutral — used where an active/
  // ongoing state needs to read as more than "nothing to report".
  info: "bg-blue-500",
};

// Tinted pill per tone — bg/text/border read the status at a glance without
// needing the separate colored dot the app used before. Kept close to the
// literal "Payé / En attente / En retard" pill spec: text-[11px] font-medium
// px-2.5 py-0.5 rounded-full border, one alpha-tinted color triad per tone.
const TONE_CLASSES: Record<StatusBadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  warning: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  error: "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
  neutral: "bg-slate-100 text-slate-600 border-slate-200/60 dark:bg-muted dark:text-muted-foreground dark:border-border",
  info: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
};

/** Pure className generator, same pattern as badgeVariants — for the rare
 *  spot a status chip needs to render as something other than a plain div
 *  (e.g. a DropdownMenuTrigger's clickable button). */
export function statusBadgeVariants({ tone = "neutral", className }: { tone?: StatusBadgeTone; className?: string } = {}) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border text-[11px] font-medium px-2.5 py-0.5 transition-colors",
    TONE_CLASSES[tone],
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
 * Executive-SaaS status chip: a tinted pill (background/text/border all
 * carrying the tone) rather than a neutral pill + colored dot — matches the
 * Payé/En attente/En retard pill treatment used across the app's tables.
 */
export function StatusBadge({ tone = "neutral", className, children, ...props }: StatusBadgeProps) {
  return (
    <div className={statusBadgeVariants({ tone, className })} {...props}>
      {children}
    </div>
  );
}
