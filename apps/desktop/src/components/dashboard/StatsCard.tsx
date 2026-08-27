import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  /** The one card per row that should carry the solid primary fill. */
  highlighted?: boolean;
  /** Plain secondary line (e.g. "12% du chiffre d'affaires"). */
  subValue?: string;
  /** Colored secondary line for an actual signal (e.g. a growth delta). */
  trend?: { value: string; positive: boolean };
}

/**
 * The one stat-card shape used everywhere a KPI row appears (Dashboard,
 * Suivi des Règlements, Charges, ...). `highlighted` used to mean a full
 * primary-gradient fill; that read more "colorful dashboard template" than
 * the restrained Linear/Stripe/Raycast benchmark, which never solid-fills a
 * KPI tile — so it's now a neutral card with a crisp 2px primary top-border
 * stripe instead, same emphasis signal with far less visual weight.
 */
export function StatsCard({ title, value, icon: Icon, highlighted, subValue, trend }: StatsCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-2xl border bg-card p-6 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all duration-150 ease-out min-w-0 overflow-hidden",
        highlighted ? "border-border/40 border-t-2 border-t-primary shadow-glow" : "border-border/40 hover:border-primary/30"
      )}
    >
      {/* Top-edge accent line — the neutral cards' quieter equivalent of the
          highlighted card's solid border-t-2 stripe above. */}
      {!highlighted && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      )}
      <div className="flex items-center justify-between gap-2 mb-4">
        <span
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-transform duration-150 group-hover:scale-105",
            highlighted ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="w-5 h-5" />
        </span>
        {trend && (
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-mono font-medium tabular-nums whitespace-nowrap truncate max-w-[60%]",
              trend.positive
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
            )}
          >
            {trend.positive ? "▲" : "▼"} {trend.value}
          </span>
        )}
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wider truncate text-muted-foreground">{title}</p>
      <p className="font-mono text-lg xl:text-2xl font-bold tracking-tight tabular-nums mt-1.5 truncate whitespace-nowrap text-foreground">
        {value}
      </p>
      {!trend && subValue && <p className="text-xs mt-1.5 tabular-nums truncate whitespace-nowrap text-muted-foreground">{subValue}</p>}
    </div>
  );
}
