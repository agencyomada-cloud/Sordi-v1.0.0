import { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { cn } from "@/lib/utils";

// "3.8M DA" / "320K DA" style — the card is narrow, full currency formatting
// wraps at this size.
const formatCompact = (amount: number) => {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M DA`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K DA`;
  return `${sign}${Math.round(abs)} DA`;
};

interface HeroBentoCardProps {
  className?: string;
}

/**
 * The login screen's single product-proof card — one unified, crisp glass
 * card: live net treasury with a month-to-date trend sparkline. Real data
 * via the same useDashboardStats hook the main Dashboard and the desktop
 * widget use, not a static mockup.
 */
export function HeroBentoCard({ className }: HeroBentoCardProps) {
  const { data: stats } = useDashboardStats();

  // Matches the main Dashboard's own "Trésorerie Nette" definition
  // (stats.yearly.profit), not stats.currentMonth — see useDashboardStats.
  const netTreasury = stats?.yearly.profit ?? 0;
  const isPositive = netTreasury >= 0;

  const sparklineData = useMemo(() => {
    if (!stats?.monthlyData) return [];
    const upToNow = stats.monthlyData.slice(0, new Date().getMonth() + 1);
    return upToNow.slice(-6).map((m) => ({ value: m.profit }));
  }, [stats?.monthlyData]);

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-xl p-5",
        "shadow-[0_12px_36px_-6px_rgba(0,0,0,0.06)]",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
          Trésorerie Nette
        </p>
      </div>

      <p className="mt-2 whitespace-nowrap text-[26px] font-bold tabular-nums tracking-tight text-slate-900">
        {formatCompact(netTreasury)}
      </p>

      {sparklineData.length > 1 && (
        <div className="mt-3 h-12 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData} margin={{ top: 2, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="hero-sparkline-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isPositive ? "#0052FF" : "#F43F5E"} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={isPositive ? "#0052FF" : "#F43F5E"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={isPositive ? "#0052FF" : "#F43F5E"}
                strokeWidth={1.75}
                strokeLinecap="round"
                fill="url(#hero-sparkline-fill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-2 text-[10px] text-slate-400">Cumul sur l'année en cours</p>
    </div>
  );
}
