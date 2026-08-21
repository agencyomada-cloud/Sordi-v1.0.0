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
 * Suivi des Règlements, ...). Icon color is intentionally uniform — primary
 * tint on neutral cards, translucent white on the highlighted one — rather
 * than a different hue per card, since the hue was never carrying meaning.
 */
export function StatsCard({ title, value, icon: Icon, highlighted, subValue, trend }: StatsCardProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-[6px] border flex items-center gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-soft cursor-default group min-w-0",
        highlighted ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border hover:border-primary/30"
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-[6px] flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110",
          highlighted ? "bg-primary-foreground/15" : "bg-primary/10"
        )}
      >
        <Icon className={cn("w-4 h-4", highlighted ? "text-primary-foreground" : "text-primary")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn(
          "text-xs font-medium uppercase tracking-wide truncate",
          highlighted ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {title}
        </p>
        <p className="text-xl font-bold tracking-tight tabular-nums mt-0.5 truncate">{value}</p>
        {trend && (
          <p className={cn(
            "text-xs mt-0.5 tabular-nums font-medium truncate",
            highlighted ? "text-primary-foreground/90" : trend.positive ? "text-stat-positive" : "text-stat-negative"
          )}>
            {trend.value}
          </p>
        )}
        {!trend && subValue && (
          <p className={cn("text-xs mt-0.5 tabular-nums truncate", highlighted ? "text-primary-foreground/70" : "text-muted-foreground")}>
            {subValue}
          </p>
        )}
      </div>
    </div>
  );
}
