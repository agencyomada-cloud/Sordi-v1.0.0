import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { db } from "@/lib/database";
import { getEntityRoute } from "@/lib/activityLog";
import { getInvoiceStatusConfig } from "@/lib/invoiceStatus";
import { AnimatedNumber } from "@/components/ui/animated-number";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  EmptyState,
  DesktopSegmentedControl,
  StatusBadge,
} from "@sordi/ui";
import { toast } from "sonner";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useInvoices } from "@/hooks/useInvoices";
import {
  TrendingUp,
  TrendingDown,
  Landmark,
  RefreshCw,
  Clock,
} from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, AreaChart, Area, ResponsiveContainer } from "recharts";

// Dashboard-only palette: the Scarlet brand accent, matching --primary in
// index.css (was a stale #0052FF "AgentOps-blue" literal left over from
// before the Scarlet rebrand — recharts strokes are plain hex, not
// CSS-variable-reactive, so this has to be kept in sync by hand). Tuned to
// the dark-mode primary's hsl(351 100% 58%) — bright enough to still read
// clearly against the near-black OLED background, and saturated enough to
// stay legible on the lighter light-mode canvas too.
const CHART_ACCENT = "#FF2949";

// Flat native desktop panel — overrides the shared Card component's
// defaults on this page only (Card itself stays untouched, so every other
// page keeps its current look): no floating-card shadow/translucency, just
// a hairline border and the same bg-card every other bordered grid on this
// desktop uses (Invoices/Suppliers tables, Settings groups, ...).

// Cash-flow area/line comparison — subdued emerald for recettes (a genuine
// "money in" positive, unlike the rest of the app's blue brand accent),
// muted slate for dépenses. Operating expenses are normal business outlays,
// not something to alarm on by default — red is reserved for actual
// deficits (see NEGATIVE_COLOR below).
const cashflowChartConfig = {
  revenue: { label: "Recettes", color: "#10b981" },
  expenses: { label: "Dépenses", color: "#94a3b8" },
} satisfies ChartConfig;

// Financial-health palette — green strictly means "≥ 0", red strictly means
// "< 0". Used both for the metric-ribbon sparklines (Bénéfice Net,
// Trésorerie) and for coloring an individual month's expense bar when that
// month's own balance went negative.
const POSITIVE_COLOR = "#10b981";
const NEGATIVE_COLOR = "#ef4444";

// Dashboard-only timeline dot tint — desaturated slate for almost
// everything, with a light rose tint reserved for deletions. Deliberately
// separate from activityLog.tsx's per-entity-type color palette, which the
// History page and the header notification dropdown still use as-is.
function getDashboardActivityDotColor(log: { action: string }) {
  return log.action === "DELETE" ? "bg-rose-300" : "bg-slate-300";
}

// activity_logs.description is one flat, server-formatted sentence (e.g.
// "Facture FACT-2025-0010 créée pour SARL ALGERIE TELECOM") — there's no
// separate "subject"/"target" field to read structure from. Splitting on
// " pour " (the one connector most create-type messages share) gives a
// genuine two-line hierarchy for those; anything else — updates, deletes,
// and messages with no target clause — just falls back to a single line
// rather than fabricating a second one that isn't in the data.
function splitActivityDescription(description: string): { primary: string; secondary: string | null } {
  const idx = description.indexOf(" pour ");
  if (idx === -1) return { primary: description, secondary: null };
  const rest = description.slice(idx + 1);
  return { primary: description.slice(0, idx), secondary: rest.charAt(0).toUpperCase() + rest.slice(1) };
}

// Custom tooltip for "Flux de Trésorerie & Marges" — breaks a month's
// charges into operational expenses vs. settled payroll instead of the
// single lumped figure ChartTooltipContent would show, per the ask for a
// Recettes / Dépenses opérationnelles / Masse salariale / Solde Net
// breakdown on hover.
function CashflowTooltip({ active, payload, label }: {
  active?: boolean;
  label?: string;
  payload?: { payload: { revenue: number; expensesOnly: number; payrollAmount: number; netSolde: number; cumulative: number } }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const fmt = (v: number) => new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(Math.round(v)) + " DA";
  const negative = d.netSolde < 0;
  return (
    <div className="bg-popover text-foreground border border-border/80 shadow-md text-xs p-2 rounded-md font-mono min-w-[170px]">
      <p className="font-sans font-semibold text-foreground mb-1.5">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="font-sans text-muted-foreground">Recettes</span>
          <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(d.revenue)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="font-sans text-muted-foreground">Dépenses opérationnelles</span>
          <span className="tabular-nums text-foreground">{fmt(d.expensesOnly)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="font-sans text-muted-foreground">Masse salariale</span>
          <span className="tabular-nums text-foreground">{fmt(d.payrollAmount)}</span>
        </div>
        <div className={cn("flex items-center justify-between gap-4 mt-1 pt-1 border-t border-border/60 font-semibold", negative ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
          <span className="font-sans">Solde Net</span>
          <span className="tabular-nums">{d.netSolde >= 0 ? "+" : ""}{fmt(d.netSolde)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-indigo-600 dark:text-indigo-400">
          <span className="font-sans">Solde cumulé</span>
          <span className="tabular-nums">{d.cumulative >= 0 ? "+" : ""}{fmt(d.cumulative)}</span>
        </div>
      </div>
    </div>
  );
}

const PERIOD_PRESETS: { key: "month" | "quarter" | "year"; label: string }[] = [
  { key: "month", label: "Mois" },
  { key: "quarter", label: "Trimestre" },
  { key: "year", label: "Année" },
];

const Index = () => {
  const { t } = useTranslation("navigation");
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [periodPreset, setPeriodPreset] = useState<"month" | "quarter" | "year">("year");

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
  const { data: recentActivity } = useQuery({
    queryKey: ["activity_logs", "recent", 5],
    queryFn: () => db.history.getLogs(5),
  });
  const navigate = useNavigate();

  const isRefreshing = statsFetching || invoicesFetching;

  const handleRefresh = async () => {
    await Promise.all([refetchStats(), refetchInvoices()]);
    toast.success("Tableau de bord actualisé");
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(amount) + " DA";
  // Same formatting, no " DA" suffix — the KPI bento cards render the unit
  // as its own subtly-styled inline tag instead of baking it into the
  // animated figure itself.
  const formatCurrencyNumber = (amount: number) => new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(amount);
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
  // This whole pipeline (monthly series -> cashflow chart -> sparklines)
  // used to re-run on every render — including unrelated ones like an
  // AnimatedNumber tick or a hover state — even though it only actually
  // needs to change when the stats query or the month selection change.
  const { monthlySeries, cashflowChartData, revenueSparkline, expensesSparkline, netSparkline } = useMemo(() => {
    let series: { name: string; revenue: number; expenses: number; expensesOnly: number; payrollAmount: number; monthNumber: number | null }[] = [];
    if (stats?.isMonthView && stats?.dailyData) {
      const dailyMonth = selectedMonths.length === 1 ? parseInt(selectedMonths[0]) : null;
      series = stats.dailyData.map((d) => ({ name: `J${d.label}`, revenue: d.revenue, expenses: d.expenses, expensesOnly: d.expenses_only, payrollAmount: d.payroll_amount, monthNumber: dailyMonth }));
    } else {
      const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
      series =
        stats?.monthlyData?.map((m) => {
          const parts = m.label ? m.label.split("-") : [];
          const monthIndex = parts.length >= 2 ? parseInt(parts[1]) - 1 : 0;
          return { name: monthNames[monthIndex] || m.label, revenue: m.revenue, expenses: m.expenses, expensesOnly: m.expenses_only, payrollAmount: m.payroll_amount, monthNumber: monthIndex + 1 };
        }) || [];
    }
    // `cumulative` is a running total of netSolde across the period shown —
    // a single-peak month otherwise looks like a data bug against 10 flat
    // zero months either side of it; the cumulative line gives every month a
    // non-zero, moving reference point regardless of how sparse the raw
    // per-month bars are.
    let runningSolde = 0;
    const chartData = series.map((d) => {
      runningSolde += d.revenue - d.expenses;
      return {
        name: d.name,
        revenue: d.revenue,
        expenses: -d.expenses,
        // Positive-valued breakdown for the tooltip — the negated `expenses`
        // above is only for the diverging stacked-bar layout, not for display.
        expensesOnly: d.expensesOnly,
        payrollAmount: d.payrollAmount,
        netSolde: d.revenue - d.expenses,
        cumulative: runningSolde,
      };
    });

    // Sparkline series for the metric ribbon — derived from the same monthly
    // cash-basis revenue/expenses series as the cashflow chart above (real
    // data, not fabricated), so "CA HT" and "Bénéfice Net" get the TTC series'
    // *shape* as a proxy: exact HT figures only exist as a period total, not
    // broken out per month, but a sparkline only needs to convey trend shape.
    // "Charges Réelles" is an exact match — expenses carry no tax component.
    return {
      monthlySeries: series,
      cashflowChartData: chartData,
      revenueSparkline: series.map((d) => ({ v: d.revenue })),
      expensesSparkline: series.map((d) => ({ v: d.expenses })),
      netSparkline: series.map((d) => ({ v: d.revenue - d.expenses })),
    };
  }, [stats, selectedMonths]);

  // Factures à Recouvrer & Échéances — every real (non-proforma,
  // non-credit-note) invoice still carrying a balance, all-time (not
  // period-filtered — a receivable doesn't stop being owed just because
  // it falls outside the dashboard's current date filter), ranked by how
  // overdue it is. balance_due/due_date/status are all fields the backend
  // already computes and stores — nothing here recalculates a document's
  // own totals or payment status.
  // Both slices scan and sort the full (now 200+) invoice list — memoized
  // so that only happens when allInvoices itself changes, not on every
  // dashboard re-render (period toggles, AnimatedNumber ticks, etc.).
  const receivablesList = useMemo(() => (allInvoices ?? [])
    .filter((inv: any) => inv.invoice_type === "invoice" && (inv.status === "issued" || inv.status === "partial") && (inv.balance_due || 0) > 0)
    .map((inv: any) => {
      const dueDate = inv.due_date ? new Date(inv.due_date) : null;
      const daysOverdue = dueDate ? Math.floor((Date.now() - dueDate.getTime()) / 86400000) : null;
      return { ...inv, daysOverdue };
    })
    .sort((a, b) => (b.daysOverdue ?? -9999) - (a.daysOverdue ?? -9999))
    .slice(0, 6), [allInvoices]);

  // Derniers Encaissements & Factures — the 6 most recent billing events
  // company-wide (any type/status), newest first. Bumped from 4 so the card
  // reads as populated rather than leaving dead space now that the bottom
  // grid stretches to fill the viewport (see the flex-1 grid wrapper below).
  const recentInvoicesLedger = useMemo(() => (allInvoices ?? [])
    .slice()
    .sort((a: any, b: any) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime())
    .slice(0, 6), [allInvoices]);

  const revenueHt = stats?.revenueHt || 0;
  const totalExpenses = stats?.yearly.expenses || 0;
  const netProfitHt = stats?.netProfitHt || 0;
  const cashFlow = stats?.yearly.profit || 0;

  const prevRevenueHt = prevStats?.revenueHt || 0;
  const prevExpenses = prevStats?.yearly.expenses || 0;
  const prevNetProfitHt = prevStats?.netProfitHt || 0;
  const prevCashFlow = prevStats?.yearly.profit || 0;

  // A near-zero N-1 baseline (e.g. a starting year with almost no recorded
  // expenses) makes the percentage swing to absurd magnitudes (+4839.6%) —
  // that's not a meaningful comparison, so treat it the same as "no prior
  // data" and hide the badge instead of printing a broken number.
  const computeDelta = (current: number, previous: number): number | null => {
    if (!previous) return null;
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    if (!Number.isFinite(pct) || Math.abs(pct) > 500) return null;
    return pct;
  };

  // "Bénéfice Net" used to sit here showing netProfitHt — but that's always
  // exactly equal to cashFlow below (both are revenue - total_charges, see
  // get_dashboard_stats), so the card was pure duplication. Replaced with a
  // genuinely different, forward-looking figure: how much clients still
  // owe across every invoice ever issued (company-wide, all-time — a
  // receivables balance isn't a "this year" concept), already computed
  // server-side as payments.total_receivables/outstanding_invoice_count.
  const totalReceivables = stats?.payments.totalReceivables || 0;
  const outstandingInvoiceCount = stats?.payments.outstandingInvoiceCount || 0;

  const metricCells = [
    { key: "revenue", label: "Chiffre d'Affaires HT", icon: TrendingUp, value: revenueHt, delta: computeDelta(revenueHt, prevRevenueHt), sparkline: revenueSparkline, sparklineColor: CHART_ACCENT },
    { key: "expenses", label: "Charges Réelles", icon: TrendingDown, value: totalExpenses, delta: computeDelta(totalExpenses, prevExpenses), invert: true, sparkline: expensesSparkline, sparklineColor: "#64748b" },
    // Trésorerie Nette is the one remaining "financial health" cell — a
    // negative value is a deficit, not just a smaller positive number, so
    // its sparkline switches to red rather than staying green regardless
    // of sign.
    { key: "treasury", label: "Trésorerie Nette", icon: Landmark, value: cashFlow, delta: computeDelta(cashFlow, prevCashFlow), sparkline: netSparkline, sparklineColor: cashFlow < 0 ? NEGATIVE_COLOR : POSITIVE_COLOR, isFinancialHealth: true },
    // No N-1 delta here — total_receivables is an all-time balance, not
    // period-scoped, so comparing it to "last year's" figure would always
    // read as +0.0% (same underlying number) rather than anything
    // meaningful. The invoice count stands in for that badge slot instead,
    // and there's deliberately no sparkline: a point-in-time balance has no
    // real monthly trend to plot without fabricating one.
    {
      key: "receivables",
      label: "Reste à Recouvrer",
      icon: Clock,
      value: totalReceivables,
      delta: null,
      sparkline: [],
      sparklineColor: "#f59e0b",
      outstandingCount: outstandingInvoiceCount,
      subtext: outstandingInvoiceCount > 0
        ? `${outstandingInvoiceCount} facture${outstandingInvoiceCount > 1 ? "s" : ""} avec solde restant`
        : "Aucun solde restant",
    },
  ];

  const yearOptions = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  if (statsLoading) {
    return (
      <main className="flex-1 overflow-auto p-6 md:p-8 bg-surface">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-9 w-72 rounded-full" />
          </div>
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-[320px] rounded-2xl" />
            <Skeleton className="lg:col-span-1 h-[320px] rounded-2xl" />
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
    <main className="flex-1 overflow-auto p-6 md:p-8 bg-surface">
      {/* h-full + flex-col so the LAST section (the Dernières Opérations /
          Créances à Recouvrer grid below) can claim `flex-1` and actually
          stretch to the bottom of the viewport — without a flex column
          ancestor here, that grid just sizes to its own short content and
          leaves a dead void underneath it on any desktop-height screen. */}
      <div className="max-w-[1600px] mx-auto h-full flex flex-col space-y-4 pb-4">
        {/* ── Unified header row — page identity + period filter, one
            compact desktop toolbar instead of two separate tiers. Every
            underlying value/query (selectedYear, periodPreset ->
            selectedMonths, handleRefresh) is unchanged, only the controls'
            presentation is. */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0 animate-fade-in-down">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("dashboard")}</h1>
            <p className="text-sm text-muted-foreground mt-1">Vue d'ensemble et pilotage de votre activité</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <DesktopSegmentedControl
              className="h-7"
              options={PERIOD_PRESETS.map((preset) => ({ value: preset.key, label: preset.label }))}
              value={periodPreset}
              onChange={(value) => setPeriodPreset(value as "month" | "quarter" | "year")}
            />

            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-7 w-20 text-xs rounded-md border-border/80">
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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing} className="shrink-0 rounded-md h-7 w-7 border-border/80">
                  <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} strokeWidth={1.5} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Actualiser</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ── Tier 2 — unified executive metric strip. Every value/delta/
            subtext computed above is unchanged — only the layout is new.
            This used to be a single `flex` row of 4 `flex-1 min-w-0` cells
            all crammed onto one line each (icon+label, then number+"DA"+
            delta-badge+sparkline all inline) — `min-w-0` explicitly removes
            a flex item's natural size floor, so once the window (or an
            expanded sidebar) left this row narrower than its own content,
            all 4 cells kept shrinking with nothing to stop them, and the
            number/currency label/delta%/sparkline packed onto one line
            visually collided. Fixed the same way MetricStrip elsewhere in
            the app already solves this: a 2-col/4-col responsive `grid`
            (so it wraps to 2 rows instead of infinitely compressing) with
            a real per-cell min-width floor, `divide-x divide-y sm:divide-y-0`
            for the same seamless-bar look as before at full width. Inside
            each cell, the delta badge now sits on its own row below the
            value instead of sharing a line with the sparkline, and the
            sparkline itself is a fixed `w-16 h-8` — nothing left in this
            layout can crush into anything else. ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border/60 bg-card border border-border/80 rounded-md shrink-0 select-none animate-fade-in-up animation-delay-100">
          {metricCells.map((cell) => {
            const Icon = cell.icon;
            // "expenses" going up is bad even though the raw delta is
            // positive — invert which color/arrow reads as good news.
            const deltaGood = cell.delta === null ? null : cell.invert ? cell.delta <= 0 : cell.delta >= 0;
            // Only Bénéfice Net / Trésorerie get deficit styling — a
            // negative "Charges Réelles" isn't a meaningful state to flag,
            // and would never happen anyway.
            const isDeficit = "isFinancialHealth" in cell && cell.isFinancialHealth && cell.value < 0;
            return (
              <div key={cell.key} className="min-w-[190px] px-4 py-2.5 flex flex-col justify-center gap-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider truncate">{cell.label}</span>
                </div>

                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className={cn("flex items-baseline gap-1 min-w-0", isDeficit && "text-rose-600 dark:text-rose-400")}>
                    <AnimatedNumber
                      value={cell.value}
                      format={formatCurrencyNumber}
                      className={cn("truncate font-mono text-base font-semibold tabular-nums tracking-tight", !isDeficit && "text-foreground")}
                    />
                    <span className="text-[10px] font-medium text-muted-foreground shrink-0">DA</span>
                  </span>

                  {/* Mini sparkline — fixed footprint, never shares a line
                      with (or shrinks to make room for) the delta badge
                      below it anymore. */}
                  {cell.sparkline.length > 1 && (
                    <div className="shrink-0 w-16 h-8">
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

                {/* Delta / subtext — its own row now, so it can never bleed
                    into the sparkline or an adjacent card. */}
                {cell.delta !== null ? (
                  <span
                    className={cn(
                      "self-start text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                      deltaGood
                        ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400"
                        : "text-rose-600 bg-rose-500/10 border-rose-500/20 dark:text-rose-400"
                    )}
                  >
                    {cell.delta >= 0 ? "+" : ""}
                    {cell.delta.toFixed(1)}%
                  </span>
                ) : cell.key === "receivables" ? (
                  <span
                    className="self-start flex items-center gap-1.5"
                    title={"subtext" in cell ? cell.subtext : undefined}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full ring-2 shrink-0"
                      style={{
                        backgroundColor: outstandingInvoiceCount > 0 ? "#f59e0b" : "#10b981",
                        boxShadow: `0 0 0 2px ${outstandingInvoiceCount > 0 ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`,
                      }}
                    />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* ── Full-width cash-flow chart — its own row so the 12-month
            series can breathe horizontally instead of being squeezed into
            a 2/3-width column. Same cashflowChartData (revenue/
            expensesOnly/cumulative per month) as before. ── */}
        <div className="w-full bg-card border border-border/80 rounded-md p-4 shrink-0 shadow-xs animate-fade-in-up animation-delay-200">
          <div className="h-8 flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">Flux de Trésorerie</span>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: cashflowChartConfig.revenue.color }} />
                Recettes
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: cashflowChartConfig.expenses.color }} />
                Dépenses
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0 border-t-2 border-dashed border-indigo-500" />
                Solde
              </span>
            </div>
          </div>
          {cashflowChartData.length === 0 ? (
            <EmptyState size="compact" icon={TrendingUp} title="Aucune donnée" description="Aucune donnée sur cette période" />
          ) : (
            <ChartContainer config={cashflowChartConfig} className="w-full h-[220px]">
              {/* Wide micro-bar series (Recettes/Dépenses, maxBarSize 22)
                  plus a cumulative running-balance line on its own right
                  axis — so a single active month among several flat/empty
                  ones still reads as real, moving data instead of a
                  broken-looking single spike. */}
              <ComposedChart data={cashflowChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-border/50" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={6} fontSize={11} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tickMargin={6} tickFormatter={(v) => formatCompactCurrency(Math.abs(Number(v)))} fontSize={11} width={40} />
                <YAxis yAxisId="right" orientation="right" hide />
                <ReferenceLine yAxisId="left" y={0} stroke="hsl(var(--border))" />
                <ChartTooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} content={<CashflowTooltip />} />
                <Bar yAxisId="left" dataKey="revenue" maxBarSize={22} radius={[3, 3, 0, 0]} fill={cashflowChartConfig.revenue.color} animationDuration={700} />
                <Bar yAxisId="left" dataKey="expensesOnly" maxBarSize={22} radius={[3, 3, 0, 0]} fill={cashflowChartConfig.expenses.color} animationDuration={700} animationBegin={100} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulative"
                  // Brightened from #4F46E5 — that indigo read cleanly on
                  // white but washed out against the new near-black OLED
                  // dark background; this lighter indigo-400 keeps enough
                  // contrast on both while staying visually distinct from
                  // the emerald/slate bars and the Scarlet sparklines.
                  stroke="#818CF8"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  animationDuration={700}
                  animationBegin={200}
                />
              </ComposedChart>
            </ChartContainer>
          )}
        </div>

        {/* ── Balanced operational split, 50/50 — both built from data
            already fetched above (allInvoices), no new queries. ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[300px] animate-fade-in-up animation-delay-300">
          {/* Left: Dernières Opérations — the 6 most recent billing events. */}
          <div className="bg-card border border-border/70 rounded-md p-3.5 shadow-xs h-full flex flex-col justify-between">
            <div className="h-8 flex items-center justify-between border-b border-border/50 pb-2 mb-2 shrink-0">
              <span className="text-xs font-semibold text-foreground">Dernières Opérations</span>
              <button onClick={() => navigate("/invoices")} className="text-[11px] text-muted-foreground hover:text-primary transition-colors">
                Voir tout →
              </button>
            </div>
            {recentInvoicesLedger.length === 0 ? (
              <EmptyState size="compact" type="invoices" title="Aucune facture" description="Aucune facture enregistrée pour le moment" />
            ) : (
              <div className="flex-1 overflow-y-auto">
              <Table>
                <TableBody>
                  {recentInvoicesLedger.map((inv: any) => {
                    const statusConfig = getInvoiceStatusConfig(inv.status);
                    return (
                      <TableRow
                        key={inv.id}
                        className="h-8 text-xs hover:bg-muted/30 cursor-pointer transition-colors border-b border-border/30 last:border-0"
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                      >
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {new Date(inv.invoice_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        </TableCell>
                        <TableCell className="font-mono font-medium tabular-nums tracking-tight">{inv.invoice_number}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[120px] truncate">{inv.clients?.name || "-"}</TableCell>
                        <TableCell numeric className="font-mono tabular-nums font-semibold">{formatCurrency(inv.total_ttc || 0)}</TableCell>
                        <TableCell className="min-w-[85px] w-auto text-right">
                          <StatusBadge tone={statusConfig.variant} className="whitespace-nowrap shrink-0 inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-medium leading-none">
                            {statusConfig.label}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            )}
          </div>

          {/* Right: Créances à Recouvrer — priority overdue/unpaid invoices
              (same allInvoices data the "Reste à Recouvrer" metric-strip
              cell already reads). */}
          <div className="bg-card border border-border/70 rounded-md p-3.5 shadow-xs h-full flex flex-col justify-between">
            <div className="h-8 flex items-center justify-between border-b border-border/50 pb-2 mb-2 shrink-0">
              <span className="text-xs font-semibold text-foreground">
                Créances à Recouvrer {receivablesList.length > 0 && `(${receivablesList.length})`}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[11px] font-semibold text-foreground bg-muted px-2 py-0.5 rounded-full">
                  {formatCompactCurrency(totalReceivables)} DA
                </span>
                <button onClick={() => navigate("/relances")} className="text-[11px] text-muted-foreground hover:text-primary transition-colors">
                  Voir tout →
                </button>
              </div>
            </div>
            {receivablesList.length === 0 ? (
              <EmptyState size="compact" icon={Clock} title="Aucune créance" description="Tout est réglé — aucune facture en attente de paiement" />
            ) : (
              <ul className="flex-1 overflow-y-auto divide-y divide-border/50">
                {receivablesList.map((inv: any) => {
                  const overdue = (inv.daysOverdue ?? 0) > 0;
                  return (
                    <li key={inv.id}>
                      <button
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                        className="w-full h-9 px-2 hover:bg-muted/30 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-xs truncate max-w-[160px]">{inv.clients?.name || "Client"}</span>
                          {overdue ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                              {inv.daysOverdue}j
                            </span>
                          ) : inv.due_date ? (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(inv.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                            </span>
                          ) : null}
                        </span>
                        <span className="font-mono text-xs font-semibold tabular-nums text-foreground shrink-0">
                          {formatCompactCurrency(inv.balance_due || 0)} DA
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Index;
