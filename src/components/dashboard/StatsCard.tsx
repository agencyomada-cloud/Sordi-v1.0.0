import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
}

export function StatsCard({ title, value, change, changeLabel }: StatsCardProps) {
  const isPositive = change >= 0;

  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <div className="flex items-center gap-1.5 mb-2">
        {isPositive ? (
          <TrendingUp className="w-4 h-4 text-stat-positive" />
        ) : (
          <TrendingDown className="w-4 h-4 text-stat-negative" />
        )}
        <span className={cn(
          "text-sm font-medium",
          isPositive ? "text-stat-positive" : "text-stat-negative"
        )}>
          {isPositive ? "+" : ""}{change}%
        </span>
        <span className="text-sm text-muted-foreground">{changeLabel}</span>
      </div>
      <p className="text-2xl font-semibold text-foreground mb-1">{value}</p>
      <p className="text-sm text-muted-foreground">{title}</p>
    </div>
  );
}
