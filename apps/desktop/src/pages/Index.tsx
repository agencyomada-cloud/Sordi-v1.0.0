import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { db } from "@/lib/database";
import { getEntityConfig, getActionColor, getActionLabel, getEntityRoute } from "@/lib/activityLog";
import { getInvoiceStatusConfig } from "@/lib/invoiceStatus";
import { AnimatedNumber } from "@/components/ui/animated-number";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  EmptyState,
} from "@sordi/ui";
import { toast } from "sonner";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useInvoices } from "@/hooks/useInvoices";
import { useProjects, useProjectStatsMap } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useExpenses } from "@/hooks/useExpenses";
import { useEmployees } from "@/hooks/useEmployees";
import { computeProjectStatus } from "@/lib/projectOverview";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  RefreshCw,
  ChevronRight,
  Eye,
  FolderKanban,
  Clock,
  Briefcase,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, PieChart, Pie, Cell, AreaChart, Area, ResponsiveContainer } from "recharts";

// Dashboard-only palette: the Crimson/Coral Red brand accent (#EB3B48),
// matching the primary CSS token in index.css and the current logo.
const CHART_ACCENT = "#EB3B48";

// Diverging cash-flow bars — emerald for recettes, slate for dépenses, a
// distinct pairing from CHART_ACCENT so the chart doesn't compete visually
// with the primary-accent KPI ribbon above it.
const cashflowChartConfig = {
  revenue: { label: "Recettes", color: "#10b981" },
  expenses: { label: "Dépenses", color: "#64748b" },
} satisfies ChartConfig;

// Rotating donut palette for the "revenue by project" breakdown — primary
// Crimson/Coral Red first (most prominent project), then a fixed sequence after.
const DONUT_COLORS = [CHART_ACCENT, "#10b981", "#f59e0b", "#a855f7", "#ec4899", "#64748b"];

// Solid dot colors for the Activité Récente timeline's status marker — a
// separate, solid palette from getActionColor's low-opacity chip classes
// (packages/ui alpha-tinted backgrounds read as near-invisible at dot size).
const ACTION_DOT_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-500",
  UPDATE: "bg-primary",
  DELETE: "bg-destructive",
  CONVERT: "bg-purple-500",
};

interface BarListItem {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  color: string;
}

const PERIOD_PRESETS: { key: "month" | "quarter" | "year"; label: string }[] = [
  { key: "month", label: "Ce mois" },
  { key: "quarter", label: "Ce trimestre" },
  { key: "year", label: "Cette année" },
];

const Index = () => {
  const { t } = useTranslation("navigation");
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [periodPreset, setPeriodPreset] = useState<"month" | "quarter" | "year">("year");
  const [viewMode, setViewMode] = useState<"global" | "comparison">("global");

  // Quick-period pills drive the same selectedMonths filter the stats query
  // already used (previously set via a month multi-select) — one source of
  // truth, just a simpler control surface.
  useEffect(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    if (periodPreset === "year") {
      setSelectedMonths([]);
    } else if (periodPreset === "month") {
      setSelectedMonths([String(currentMonth)]);
    } else {
      const quarterStart = Math.floor((currentMonth - 1) / 3) * 3 + 1;
      setSelectedMonths([quarterStart, quarterStart + 1, quarterStart + 2].map(String));
    }
  }, [periodPreset]);

  const { data: stats, isLoading: statsLoading, isFetching: statsFetching, refetch: refetchStats } = useDashboardStats(
    parseInt(selectedYear),
    selectedMonths
  );
  // Only meaningfully used in "comparison" view, but cheap enough (local
  // SQLite/mock, no network) to always keep warm rather than gate behind
  // view-mode with a conditional hook call, which React disallows anyway.
  const { data: prevStats } = useDashboardStats(parseInt(selectedYear) - 1, selectedMonths);

  const { data: allInvoices, isFetching: invoicesFetching, refetch: refetchInvoices } = useInvoices();
  const { data: projects } = useProjects();
  const { data: clients } = useClients();
  const { data: projectStatsById } = useProjectStatsMap();
  // Unfiltered — grouped client-side by project_id below, same as the
  // revenue-by-project breakdown groups invoices.
  const { data: allExpenses } = useExpenses();
  const { data: employees } = useEmployees();
  const { data: recentActivity } = useQuery({
    queryKey: ["activity_logs", "recent", 6],
    queryFn: () => db.history.getLogs(6),
  });
  const navigate = useNavigate();

  const isRefreshing = statsFetching || invoicesFetching;

  const handleRefresh = async () => {
    await Promise.all([refetchStats(), refetchInvoices()]);
    toast.success("Tableau de bord actualisé");
  };

  const invoices = allInvoices?.filter((i) => {
    try {
      const d = new Date(i.invoice_date);
      const yearMatch = d.getFullYear() === parseInt(selectedYear);
      const m = d.getMonth() + 1;
      const monthMatch = selectedMonths.length === 0 || selectedMonths.includes(m.toString());
      return yearMatch && monthMatch && i.invoice_type !== "credit_note";
    } catch {
      return false;
    }
  });

  const formatCurrency = (amount: number) => new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(amount) + " DA";
  const formatCompactCurrency = (amount: number) => {
    if (Math.abs(amount) >= 1000000) return (amount / 1000000).toFixed(1) + "M";
    if (Math.abs(amount) >= 1000) return (amount / 1000).toFixed(0) + "K";
    return amount.toString();
  };

  // Monthly cash-basis (TTC) revenue/expenses — same series the app has
  // always shown month-by-month; HT is only available as a period total
  // (salesCumulatives), not broken out per month, so the chart stays on the
  // cash-basis series it actually has data for rather than fabricating one.
  // monthNumber (1-12) rides along through the whole pipeline — not derived
  // from the display label, which is a locale month abbreviation ("Août")
  // or a day-of-month ("J14") in daily view, neither reliably parseable
  // back into a month index for the "highlight the current month" bar.
  let monthlySeries: { name: string; revenue: number; expenses: number; monthNumber: number | null }[] = [];
  if (stats?.isMonthView && stats?.dailyData) {
    const dailyMonth = selectedMonths.length === 1 ? parseInt(selectedMonths[0]) : null;
    monthlySeries = stats.dailyData.map((d) => ({ name: `J${d.label}`, revenue: d.revenue, expenses: d.expenses, monthNumber: dailyMonth }));
  } else {
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    monthlySeries =
      stats?.monthlyData?.map((m) => {
        const parts = m.label ? m.label.split("-") : [];
        const monthIndex = parts.length >= 2 ? parseInt(parts[1]) - 1 : 0;
        return { name: monthNames[monthIndex] || m.label, revenue: m.revenue, expenses: m.expenses, monthNumber: monthIndex + 1 };
      }) || [];
  }
  // Only the current calendar month, and only while looking at the current
  // year — highlighting "the current month" on a past year's chart doesn't
  // mean anything, so every bar stays muted there instead.
  const now = new Date();
  const isCurrentYearView = parseInt(selectedYear) === now.getFullYear();
  const currentMonthNumber = isCurrentYearView ? now.getMonth() + 1 : null;
  const cashflowChartData = monthlySeries.map((d) => ({
    name: d.name,
    revenue: d.revenue,
    expenses: -d.expenses,
    isCurrent: currentMonthNumber !== null && d.monthNumber === currentMonthNumber,
  }));

  // Sparkline series for the metric ribbon — derived from the same monthly
  // cash-basis revenue/expenses series as the cashflow chart above (real
  // data, not fabricated), so "CA HT" and "Bénéfice Net" get the TTC series'
  // *shape* as a proxy: exact HT figures only exist as a period total, not
  // broken out per month, but a sparkline only needs to convey trend shape.
  // "Charges Réelles" is an exact match — expenses carry no tax component.
  const revenueSparkline = monthlySeries.map((d) => ({ v: d.revenue }));
  const expensesSparkline = monthlySeries.map((d) => ({ v: d.expenses }));
  const netSparkline = monthlySeries.map((d) => ({ v: d.revenue - d.expenses }));

  // Revenue by project — top 5 + an "Autres" bucket, for the donut and the
  // breakdown list beneath it.
  const projectNameById = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const projectRevenueMap = (invoices ?? []).reduce((acc, inv: any) => {
    const key = inv.project_id || "__none__";
    const name = inv.project_id ? projectNameById.get(inv.project_id) || "Projet supprimé" : "Sans projet";
    if (!acc[key]) acc[key] = { key, name, value: 0 };
    acc[key].value += Number(inv.subtotal_ht || 0);
    return acc;
  }, {} as Record<string, { key: string; name: string; value: number }>);
  const projectRevenueSorted = Object.values(projectRevenueMap)
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
  const projectRevenueTop = projectRevenueSorted.slice(0, 5);
  const projectRevenueOthersTotal = projectRevenueSorted.slice(5).reduce((s, p) => s + p.value, 0);
  const projectDonutData: BarListItem[] = [
    ...projectRevenueTop.map((p, i) => ({
      key: p.key,
      label: p.name,
      value: p.value,
      displayValue: formatCompactCurrency(p.value),
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    })),
    ...(projectRevenueOthersTotal > 0
      ? [{ key: "others", label: "Autres", value: projectRevenueOthersTotal, displayValue: formatCompactCurrency(projectRevenueOthersTotal), color: "#94a3b8" }]
      : []),
  ];

  // Invoices awaiting payment — not period-filtered (due dates are inherently
  // "now"-relative), soonest due first.
  const pendingInvoices = (allInvoices ?? [])
    .filter((inv: any) => inv.invoice_type === "invoice" && ["issued", "partial", "overdue"].includes(inv.status || ""))
    .sort((a: any, b: any) => new Date(a.due_date || a.invoice_date).getTime() - new Date(b.due_date || b.invoice_date).getTime())
    .slice(0, 6);

  // Project health & profitability — real revenue (HT, all-time, not
  // period-filtered: a project's profitability is a lifetime figure, not
  // reset every time the dashboard's date filter changes) minus real direct
  // costs, both grouped client-side from invoices/expenses the same way the
  // "revenue by project" donut above does. Capped to the 5 most active
  // projects by revenue so the hub stays a "top of mind" list, not a full
  // Projects-page table.
  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.name]));
  // responsible_person is a free-typed name, not an employee reference — a
  // case-insensitive name match against the real employee list is the only
  // way to recover that person's actual uploaded photo instead of always
  // falling back to their initials.
  const employeeByName = new Map((employees ?? []).map((e) => [e.name.trim().toLowerCase(), e]));
  const projectDirectExpenses = (allExpenses ?? []).reduce((acc, e) => {
    if (!e.project_id) return acc;
    acc[e.project_id] = (acc[e.project_id] || 0) + (e.amount || 0);
    return acc;
  }, {} as Record<string, number>);
  const projectAllTimeRevenue = (allInvoices ?? [])
    .filter((inv: any) => inv.project_id && (inv.invoice_type === "invoice" || inv.invoice_type === "credit_note"))
    .reduce((acc: Record<string, number>, inv: any) => {
      const ht = inv.subtotal_ht || 0;
      acc[inv.project_id] = (acc[inv.project_id] || 0) + (inv.invoice_type === "credit_note" ? -ht : ht);
      return acc;
    }, {});

  const projectHubRows = (projects ?? [])
    .map((project) => {
      const revenue = projectAllTimeRevenue[project.id] || 0;
      const directCosts = projectDirectExpenses[project.id] || 0;
      const netMargin = revenue - directCosts;
      const marginPct = revenue > 0 ? (netMargin / revenue) * 100 : 0;
      const pstats = projectStatsById.get(project.id);
      const status = pstats ? computeProjectStatus(pstats) : null;
      const budgetRatio = project.planned_budget > 0 ? Math.min(1, directCosts / project.planned_budget) : 0;
      const overBudget = project.planned_budget > 0 && directCosts > project.planned_budget;
      // "Team" here is what's actually captured on a project record — a
      // single named owner (responsible_person) plus a freelancer when one
      // is assigned. There's no multi-assignee roster on Project itself
      // (that would mean deriving it from per-project tasks, which has no
      // mock-data path and would silently break in web-preview) — so the
      // stack is honestly 1-2 people, not a fabricated crowd.
      const team: { name: string; photoPath?: string | null }[] = [];
      if (project.responsible_person) {
        const matchedEmployee = employeeByName.get(project.responsible_person.trim().toLowerCase());
        team.push({ name: project.responsible_person, photoPath: matchedEmployee?.photo_path });
      }
      const freelancer = project.freelancer_id ? employees?.find((e) => e.id === project.freelancer_id) : null;
      if (freelancer) team.push({ name: freelancer.name, photoPath: freelancer.photo_path });
      return { project, clientName: clientNameById.get(project.client_id) || "-", revenue, directCosts, netMargin, marginPct, status, budgetRatio, overBudget, team };
    })
    .filter((row) => row.revenue > 0 || row.directCosts > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const revenueHt = stats?.revenueHt || 0;
  const totalExpenses = stats?.yearly.expenses || 0;
  const netProfitHt = stats?.netProfitHt || 0;
  const cashFlow = stats?.yearly.profit || 0;

  const prevRevenueHt = prevStats?.revenueHt || 0;
  const prevExpenses = prevStats?.yearly.expenses || 0;
  const prevNetProfitHt = prevStats?.netProfitHt || 0;
  const prevCashFlow = prevStats?.yearly.profit || 0;

  const computeDelta = (current: number, previous: number): number | null => {
    if (!previous) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const metricCells = [
    { key: "revenue", label: "Chiffre d'Affaires HT", icon: TrendingUp, value: revenueHt, delta: computeDelta(revenueHt, prevRevenueHt), sparkline: revenueSparkline, sparklineColor: CHART_ACCENT },
    { key: "expenses", label: "Charges Réelles", icon: TrendingDown, value: totalExpenses, delta: computeDelta(totalExpenses, prevExpenses), invert: true, sparkline: expensesSparkline, sparklineColor: "#64748b" },
    { key: "profit", label: "Bénéfice Net", icon: Wallet, value: netProfitHt, delta: computeDelta(netProfitHt, prevNetProfitHt), sparkline: netSparkline, sparklineColor: "#10b981" },
    { key: "treasury", label: "Trésorerie", icon: Landmark, value: cashFlow, delta: computeDelta(cashFlow, prevCashFlow), sparkline: netSparkline, sparklineColor: "#10b981" },
  ];

  const yearOptions = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  if (statsLoading) {
    return (
      <main className="flex-1 overflow-auto p-4 md:p-8 bg-background">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-9 w-72 rounded-full" />
          </div>
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="lg:col-span-8 h-[320px] rounded-2xl" />
            <Skeleton className="lg:col-span-4 h-[320px] rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[320px] rounded-2xl" />
            <Skeleton className="h-[320px] rounded-2xl" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto p-4 md:p-8 bg-background">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* ── Tier 1 — header, quick period toggle, comparison mode ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-fade-in-down">
          <div>
            <h1 className="text-2xl tracking-tight text-foreground">{t("dashboard")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Vue d'ensemble de votre activité</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div role="group" className="flex items-center rounded-full border border-border bg-secondary/50 p-0.5">
              {PERIOD_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setPeriodPreset(preset.key)}
                  aria-pressed={periodPreset === preset.key}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-150",
                    periodPreset === preset.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-24 h-9 rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div role="group" className="flex items-center rounded-full border border-border bg-secondary/50 p-0.5">
              {(["global", "comparison"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 whitespace-nowrap",
                    viewMode === mode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode === "global" ? "Vue Globale" : "Comparaison vs N-1"}
                </button>
              ))}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing} className="shrink-0 rounded-full">
                  <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} strokeWidth={1.5} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Actualiser</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ── Tier 2 — unified 4-metric ribbon, zero floating boxes ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border/40 border border-border/40 rounded-2xl bg-card/60 backdrop-blur-sm p-4 animate-fade-in-up animation-delay-100">
          {metricCells.map((cell) => {
            const Icon = cell.icon;
            // "expenses" going up is bad even though the raw delta is
            // positive — invert which color/arrow reads as good news.
            const deltaGood = cell.delta === null ? null : cell.invert ? cell.delta <= 0 : cell.delta >= 0;
            return (
              <div key={cell.key} className="px-4 first:ps-1 last:pe-1 py-1 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">{cell.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <AnimatedNumber
                      value={cell.value}
                      format={formatCurrency}
                      className="text-2xl font-bold font-mono tabular-nums tracking-tight text-foreground"
                    />
                    {viewMode === "comparison" && cell.delta !== null && (
                      <span
                        className={cn(
                          "text-xs font-mono font-semibold px-1.5 py-0.5 rounded-full border shrink-0",
                          deltaGood
                            ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400"
                            : "text-rose-600 bg-rose-500/10 border-rose-500/20 dark:text-rose-400"
                        )}
                      >
                        {cell.delta >= 0 ? "+" : ""}
                        {cell.delta.toFixed(1)}% vs N-1
                      </span>
                    )}
                  </div>
                </div>
                {/* Micro-sparkline — trend shape only, no axes/labels/tooltip. */}
                {cell.sparkline.length > 1 && (
                  <div className="h-9 w-16 shrink-0 hidden sm:block">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cell.sparkline} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`spark-${cell.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={cell.sparklineColor} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={cell.sparklineColor} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke={cell.sparklineColor} strokeWidth={1.5} fill={`url(#spark-${cell.key})`} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Tier 3 — 12-column analytics grid, height-locked at 320px ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch animate-fade-in-up animation-delay-200">
          {/* Left: cashflow diverging bar chart — span 8/12 */}
          <Card className="lg:col-span-8 flex flex-col h-[320px]">
            <CardHeader className="flex flex-row items-center justify-between shrink-0 py-4">
              <CardTitle className="text-sm font-semibold">Flux de Trésorerie &amp; Marges</CardTitle>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cashflowChartConfig.revenue.color }} />
                  Recettes
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cashflowChartConfig.expenses.color }} />
                  Dépenses
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 pb-4">
              {cashflowChartData.length === 0 ? (
                <EmptyState size="compact" icon={TrendingUp} title="Aucune donnée" description="Aucune donnée sur cette période" />
              ) : (
                <ChartContainer config={cashflowChartConfig} className="w-full h-full">
                  <BarChart data={cashflowChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} stackOffset="sign">
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => formatCompactCurrency(Math.abs(Number(v)))} fontSize={12} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <ChartTooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      content={<ChartTooltipContent formatter={(value) => formatCurrency(Math.abs(Number(value)))} />}
                    />
                    {/* Only the current month's columns render in the full
                        brand accent — every past month is muted to a
                        neutral gray, so the chart reads "here's where we
                        are now" at a glance instead of every bar competing
                        for attention. */}
                    <Bar dataKey="revenue" stackId="a" radius={[4, 4, 4, 4]} animationDuration={900}>
                      {cashflowChartData.map((d, i) => (
                        <Cell key={`revenue-${i}`} fill={d.isCurrent ? CHART_ACCENT : "hsl(var(--muted-foreground) / 0.35)"} />
                      ))}
                    </Bar>
                    <Bar dataKey="expenses" stackId="a" radius={[4, 4, 4, 4]} animationDuration={900} animationBegin={100}>
                      {cashflowChartData.map((d, i) => (
                        <Cell key={`expenses-${i}`} fill={d.isCurrent ? "hsl(var(--foreground) / 0.55)" : "hsl(var(--muted-foreground) / 0.2)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Right: revenue-by-project donut + breakdown — span 4/12 */}
          <Card className="lg:col-span-4 flex flex-col h-[320px] justify-between">
            <CardHeader className="shrink-0 py-4">
              <CardTitle className="text-sm font-semibold">Répartition par Projet</CardTitle>
            </CardHeader>
            {projectDonutData.length === 0 ? (
              <CardContent className="flex-1 min-h-0">
                <EmptyState size="compact" icon={FolderKanban} title="Aucune vente" description="Aucune vente n'est rattachée à un projet" />
              </CardContent>
            ) : (
              <>
                <div className="h-[160px] shrink-0">
                  <ChartContainer config={{}} className="w-full h-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                      <Pie data={projectDonutData} dataKey="value" nameKey="label" innerRadius={45} outerRadius={68} paddingAngle={2} animationDuration={900}>
                        {projectDonutData.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} stroke="hsl(var(--card))" strokeWidth={2} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </div>
                <CardContent className="flex-1 min-h-0 overflow-y-auto pt-0 pb-4 space-y-2">
                  {projectDonutData.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="truncate text-foreground">{item.label}</span>
                      </span>
                      <span className="font-mono tabular-nums tracking-tight text-muted-foreground shrink-0">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </CardContent>
              </>
            )}
          </Card>
        </div>

        {/* ── Tier 4 — Project Hub (8) + Activité Récente (4) — sized to
            content (min/max instead of a hard lock) so a handful of rows
            doesn't leave a wall of empty space, but the card still caps out
            and scrolls instead of growing unbounded with many rows. Each
            card sizes independently (items-start), not forced to match the
            other's height. ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in-up animation-delay-300">
          {/* Left: project health & profitability hub — span 8/12 */}
          <Card className="lg:col-span-8 flex flex-col min-h-[180px] max-h-[340px]">
            <CardHeader className="flex flex-row items-center justify-between shrink-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                Santé &amp; Rentabilité des Projets
              </CardTitle>
              <button onClick={() => navigate("/projects")} className="text-xs text-muted-foreground hover:text-primary flex items-center transition-colors">
                Tout voir <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto pt-0">
              {projectHubRows.length === 0 ? (
                <EmptyState
                  size="compact"
                  type="projects"
                  title="Aucun projet"
                  description="Aucun projet avec de l'activité facturée"
                  action={{ label: "Créer un projet", onClick: () => navigate("/projects/new") }}
                />
              ) : (
                <ul className="divide-y divide-border/40">
                  {projectHubRows.map((row) => (
                    <li key={row.project.id}>
                      <button
                        onClick={() => navigate(`/projects/${row.project.id}`)}
                        className="w-full flex items-center gap-4 py-3 text-left hover:bg-muted/30 rounded-xl px-2 -mx-2 transition-colors"
                      >
                        <div className="min-w-0 flex-[1.4]">
                          <p className="text-sm font-medium text-foreground truncate">{row.project.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{row.clientName}</p>
                        </div>

                        {/* Team avatar stack */}
                        <div className="flex items-center -space-x-2 shrink-0">
                          {row.team.length === 0 ? (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          ) : (
                            row.team.map((member, i) => (
                              <Tooltip key={i}>
                                <TooltipTrigger asChild>
                                  <span className="ring-2 ring-card rounded-full">
                                    <EmployeeAvatar name={member.name} photoPath={member.photoPath} size="sm" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">{member.name}</TooltipContent>
                              </Tooltip>
                            ))
                          )}
                        </div>

                        {/* Budget HT vs coûts réels */}
                        <div className="flex-1 min-w-[100px] hidden md:block">
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", row.overBudget ? "bg-destructive" : "bg-primary")}
                              style={{ width: `${row.budgetRatio * 100}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 font-mono tabular-nums">
                            {formatCompactCurrency(row.directCosts)} / {formatCompactCurrency(row.project.planned_budget)}
                          </p>
                        </div>

                        <span
                          className={cn(
                            "text-xs font-mono font-bold px-1.5 py-0.5 rounded-full border shrink-0 hidden lg:inline-block",
                            row.marginPct >= 0
                              ? "text-emerald-600 bg-emerald-500/[0.08] border-emerald-500/20 dark:text-emerald-400"
                              : "text-rose-600 bg-rose-500/[0.08] border-rose-500/20 dark:text-rose-400"
                          )}
                        >
                          {row.marginPct >= 0 ? "+" : ""}
                          {row.marginPct.toFixed(0)}%
                        </span>

                        {row.status && <div className="shrink-0 hidden sm:block"><ProjectStatusBadge status={row.status} /></div>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Right: recent activity timeline — span 4/12 */}
          <Card className="lg:col-span-4 flex flex-col min-h-[180px] max-h-[340px]">
            <CardHeader className="flex flex-row items-center justify-between shrink-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                Activité Récente
              </CardTitle>
              <button onClick={() => navigate("/history")} className="text-xs text-muted-foreground hover:text-primary flex items-center transition-colors">
                Tout voir <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto">
              {!recentActivity?.length ? (
                <EmptyState size="compact" icon={Clock} title="Aucune activité" description="Aucune activité récente à afficher" />
              ) : (
                <ol className="relative">
                  {recentActivity.map((log, i) => {
                    const entityConfig = getEntityConfig(log.entity_type);
                    const isLast = i === recentActivity.length - 1;
                    return (
                      <li key={log.id} className="relative pb-5 last:pb-0">
                        {!isLast && <span className="absolute left-4 top-9 bottom-0 w-px bg-border/60" />}
                        <button onClick={() => navigate(getEntityRoute(log.entity_type, log.entity_id))} className="w-full flex items-start gap-3 text-left group/item">
                          <span className="relative shrink-0 z-10">
                            <span className={cn("flex items-center justify-center w-8 h-8 rounded-full ring-4 ring-card", entityConfig.color)}>{entityConfig.icon}</span>
                            <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-card", ACTION_DOT_COLORS[log.action] || "bg-muted-foreground")} />
                          </span>
                          <span className="min-w-0 flex-1 pt-1">
                            <span className="text-sm text-foreground leading-snug line-clamp-2 group-hover/item:text-primary transition-colors">{log.description}</span>
                            <span className="flex items-center gap-1.5 mt-1">
                              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", getActionColor(log.action))}>{getActionLabel(log.action)}</span>
                              <span className="text-[10px] text-muted-foreground/70 font-mono tabular-nums">
                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Tier 5 — pending invoices, full width ── */}
        <div className="animate-fade-in-up animation-delay-400">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                Factures &amp; Échéances en attente
              </CardTitle>
              <button onClick={() => navigate("/invoices?tab=impayees")} className="text-xs text-muted-foreground hover:text-primary flex items-center transition-colors">
                Tout voir <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </CardHeader>
            <CardContent className="p-0">
              {pendingInvoices.length === 0 ? (
                <div className="px-6 pb-6">
                  <EmptyState size="compact" type="invoices" title="Aucune facture" description="Aucune facture en attente" />
                </div>
              ) : (
                <Table>
                  <TableHeader className="static backdrop-blur-none bg-transparent">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-6">Client</TableHead>
                      <TableHead className="px-3">Échéance</TableHead>
                      <TableHead numeric className="px-6">Montant</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvoices.map((inv: any) => {
                      const statusConfig = getInvoiceStatusConfig(inv.status);
                      return (
                        <TableRow key={inv.id} className="cursor-pointer" dimmed={inv.status === "cancelled"} onClick={() => navigate(`/invoices/${inv.id}`)}>
                          <TableCell className="px-6 max-w-[160px]">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate text-sm text-foreground">{inv.clients?.name || "-"}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top">{inv.clients?.name || "-"}</TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="px-3 text-xs text-muted-foreground whitespace-nowrap">
                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString("fr-FR") : "-"}
                          </TableCell>
                          <TableCell numeric className="px-6 text-sm font-medium">
                            {formatCurrency(inv.total_ttc || 0)}
                          </TableCell>
                          <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                            <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => navigate(`/invoices/${inv.id}`)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary transition-all text-muted-foreground hover:text-foreground"
                                  >
                                    <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Voir la facture · {statusConfig.label}</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default Index;
