import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
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
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useInvoices } from "@/hooks/useInvoices";
import { useProjects, useProjectStatsMap } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useExpenses } from "@/hooks/useExpenses";
import { useEmployees } from "@/hooks/useEmployees";
import { PartnersGovernanceWidget } from "@/components/dashboard/PartnersGovernanceWidget";
import {
  TrendingUp,
  TrendingDown,
  Landmark,
  RefreshCw,
  ChevronRight,
  Eye,
  FolderKanban,
  Clock,
  Briefcase,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, PieChart, Pie, Cell, Sector, AreaChart, Area, ResponsiveContainer } from "recharts";
import type { PieSectorDataItem } from "recharts/types/polar/Pie";

// Dashboard-only palette: the AgentOps-blue brand accent (#0052FF),
// matching the primary CSS token in index.css and the current logo.
const CHART_ACCENT = "#0052FF";

// Clean elevated Bento surface — overrides the shared Card component's
// defaults on this page only (Card itself stays untouched, so every other
// page keeps its current look) for the flatter, lower-contrast executive
// style: less translucency, a hairline slate border, a much softer shadow.
const BENTO_CARD_CLASS = "bg-white/90 border-slate-200/70 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.03)] rounded-2xl transition-all dark:bg-card dark:border-border";

// Diverging cash-flow bars — brand blue for recettes, neutral slate for
// dépenses.
const cashflowChartConfig = {
  // Recettes in a refined brand blue — not green, which reads as a generic
  // "positive" color unrelated to the brand; Dépenses stays a plain neutral
  // slate. Operating expenses are normal business outlays, not something to
  // alarm on by default — red is reserved for actual deficits (see
  // NEGATIVE_COLOR below).
  revenue: { label: "Recettes", color: "#2563EB" },
  expenses: { label: "Dépenses", color: "#E2E8F0" },
} satisfies ChartConfig;

// Financial-health palette — green strictly means "≥ 0", red strictly means
// "< 0". Used both for the metric-ribbon sparklines (Bénéfice Net,
// Trésorerie) and for coloring an individual month's expense bar when that
// month's own balance went negative.
const POSITIVE_COLOR = "#10b981";
const NEGATIVE_COLOR = "#ef4444";

// Rotating donut palette for the "revenue by project" breakdown — a modern
// SaaS-style sequence (blue, emerald, amber, violet, rose), with the "Autres"
// bucket's own slate hardcoded separately below rather than pulled from here.
const DONUT_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#F43F5E", "#64748B"];

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
  payload?: { payload: { revenue: number; expensesOnly: number; payrollAmount: number; netSolde: number } }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const fmt = (v: number) => new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(Math.round(v)) + " DA";
  const negative = d.netSolde < 0;
  return (
    <div className="rounded-xl border border-border bg-popover px-3.5 py-3 text-xs min-w-[220px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Recettes</span>
          <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(d.revenue)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Dépenses opérationnelles</span>
          <span className="font-mono tabular-nums text-foreground">{fmt(d.expensesOnly)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Masse salariale</span>
          <span className="font-mono tabular-nums text-foreground">{fmt(d.payrollAmount)}</span>
        </div>
        <div className={cn("flex items-center justify-between gap-4 mt-2 pt-1.5 border-t border-border font-semibold", negative ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
          <span>Solde Net</span>
          <span className="font-mono tabular-nums">{d.netSolde >= 0 ? "+" : ""}{fmt(d.netSolde)}</span>
        </div>
      </div>
    </div>
  );
}

interface BarListItem {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  color: string;
  /** Service/category sub-label shown under the client name in the legend — absent for the "Autres" bucket and orphan/no-project rows, which have no single category to show. */
  category?: string;
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
  const [hoveredDonutIndex, setHoveredDonutIndex] = useState<number | null>(null);

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
    queryKey: ["activity_logs", "recent", 5],
    queryFn: () => db.history.getLogs(5),
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
      // Must exclude the same document types as the "Chiffre d'affaires HT"
      // KPI card (get_dashboard_stats: invoice_type NOT IN ('credit_note',
      // 'proforma')) — this list feeds the "Répartition par Projet" donut,
      // whose total needs to equal that card's figure. Proformas/devis were
      // previously still counted here, inflating the donut's total well
      // above real invoiced revenue.
      return yearMatch && monthMatch && i.invoice_type !== "credit_note" && i.invoice_type !== "proforma";
    } catch {
      return false;
    }
  });

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
  let monthlySeries: { name: string; revenue: number; expenses: number; expensesOnly: number; payrollAmount: number; monthNumber: number | null }[] = [];
  if (stats?.isMonthView && stats?.dailyData) {
    const dailyMonth = selectedMonths.length === 1 ? parseInt(selectedMonths[0]) : null;
    monthlySeries = stats.dailyData.map((d) => ({ name: `J${d.label}`, revenue: d.revenue, expenses: d.expenses, expensesOnly: d.expenses_only, payrollAmount: d.payroll_amount, monthNumber: dailyMonth }));
  } else {
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    monthlySeries =
      stats?.monthlyData?.map((m) => {
        const parts = m.label ? m.label.split("-") : [];
        const monthIndex = parts.length >= 2 ? parseInt(parts[1]) - 1 : 0;
        return { name: monthNames[monthIndex] || m.label, revenue: m.revenue, expenses: m.expenses, expensesOnly: m.expenses_only, payrollAmount: m.payroll_amount, monthNumber: monthIndex + 1 };
      }) || [];
  }
  const cashflowChartData = monthlySeries.map((d) => ({
    name: d.name,
    revenue: d.revenue,
    expenses: -d.expenses,
    // Positive-valued breakdown for the tooltip — the negated `expenses`
    // above is only for the diverging stacked-bar layout, not for display.
    expensesOnly: d.expensesOnly,
    payrollAmount: d.payrollAmount,
    netSolde: d.revenue - d.expenses,
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

  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

  // Revenue by project — top 5 + an "Autres" bucket, for the donut and the
  // breakdown list beneath it. The legend's primary label is the CLIENT
  // (who the money is from), the project's own name becomes the muted
  // sub-label (what the work actually is) — a project's `name` field in
  // this app is a service description ("Branding et sites web"), not the
  // client's name, so reading it as the primary label was misleading.
  const projectClientById = new Map((projects ?? []).map((p) => [p.id, p.client_id]));
  const projectNameById = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const projectRevenueMap = (invoices ?? []).reduce((acc, inv: any) => {
    const key = inv.project_id || "__none__";
    const clientName = inv.project_id
      ? clientNameById.get(projectClientById.get(inv.project_id) || "") || "Projet supprimé"
      : "Sans projet";
    const category = inv.project_id ? projectNameById.get(inv.project_id) : undefined;
    if (!acc[key]) acc[key] = { key, clientName, category, value: 0 };
    acc[key].value += Number(inv.subtotal_ht || 0);
    return acc;
  }, {} as Record<string, { key: string; clientName: string; category?: string; value: number }>);
  const projectRevenueSorted = Object.values(projectRevenueMap)
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
  // Top 3 (not top 5) — the legend below shows these plus a minimal "+X
  // autres" indicator instead of a longer, denser list.
  const projectRevenueTop = projectRevenueSorted.slice(0, 3);
  const projectRevenueOthers = projectRevenueSorted.slice(3);
  const projectRevenueOthersTotal = projectRevenueOthers.reduce((s, p) => s + p.value, 0);
  const projectDonutData: BarListItem[] = [
    ...projectRevenueTop.map((p, i) => ({
      key: p.key,
      label: p.clientName,
      category: p.category,
      value: p.value,
      displayValue: formatCompactCurrency(p.value),
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    })),
    ...(projectRevenueOthersTotal > 0
      ? [{ key: "others", label: "Autres", value: projectRevenueOthersTotal, displayValue: formatCompactCurrency(projectRevenueOthersTotal), color: "#64748B" }]
      : []),
  ];
  const donutTotal = projectDonutData.reduce((sum, d) => sum + d.value, 0);


  // Project health & profitability — real revenue (HT, all-time, not
  // period-filtered: a project's profitability is a lifetime figure, not
  // reset every time the dashboard's date filter changes) minus real direct
  // costs, both grouped client-side from invoices/expenses the same way the
  // "revenue by project" donut above does. Capped to the 5 most active
  // projects by revenue so the hub stays a "top of mind" list, not a full
  // Projects-page table.
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
      const pstats = projectStatsById.get(project.id);
      // Real collected cash / real contract total (from the payments
      // ledger via get_project_stats), not "logged expenses vs a manually-
      // typed planned_budget" — the bar used to read 0/planned_budget for
      // every project here since none of them have expenses.project_id
      // set, even ones that are fully paid.
      const contractTotal = pstats?.budget_facture ?? 0;
      const collected = pstats?.budget_paye ?? 0;
      const budgetRatio = contractTotal > 0 ? Math.min(1, collected / contractTotal) : 0;
      // A margin only means something once real, project-tagged costs
      // exist — with none logged, revenue - 0 always equals revenue,
      // producing a meaningless flat "+100%". Fall back to the collection
      // percentage instead, which is always a real, non-fabricated number.
      const hasDirectCosts = directCosts > 0;
      const marginPct = hasDirectCosts && revenue > 0 ? (netMargin / revenue) * 100 : null;
      const collectionPct = contractTotal > 0 ? (collected / contractTotal) * 100 : 0;
      // Collection status — distinct from computeProjectStatus's task/
      // deadline-driven lifecycle status (still used on Projects.tsx/
      // ProjectDetail.tsx): a project can be fully solvent with zero tasks
      // logged, which used to pin every row here to "Nouveau" regardless
      // of how much had actually been collected.
      const collectionStatus: { label: string; classes: string } =
        contractTotal > 0 && collected >= contractTotal
          ? { label: "Soldé", classes: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" }
          : collected > 0
            ? { label: "En cours", classes: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20" }
            : { label: "En attente", classes: "bg-slate-100 text-slate-700 border-slate-200/60 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700" };
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
      return { project, clientName: clientNameById.get(project.client_id) || "-", revenue, directCosts, netMargin, marginPct, collectionPct, collectionStatus, contractTotal, collected, budgetRatio, team };
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
      <main className="flex-1 overflow-auto p-6 md:p-8 bg-[#F8FAFC]">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-9 w-72 rounded-full" />
          </div>
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
    <main className="flex-1 overflow-auto p-6 md:p-8 bg-[#F8FAFC]">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* ── Tier 1 — page identity. The invoice quick-create action moved
            to the "Factures en attente" card below (Tier 5) — this header
            covers the whole business (clients, payroll, projects...), so a
            single invoice-only CTA next to its title read as an arbitrary
            pick; it belongs next to the section it actually acts on. */}
        <div className="animate-fade-in-down">
          <h1 className="text-2xl tracking-tight text-foreground">{t("dashboard")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Vue d'ensemble de votre activité</p>
        </div>

        {/* ── Tier 1b — period toggle, comparison mode: secondary to the
            title/CTA above it, so it's visually a notch quieter (smaller
            text, lighter border) instead of competing at the same weight. */}
        <div className="flex flex-wrap items-center gap-3 -mt-2 animate-fade-in-down">
          {/* Period range — preset + year, grouped since both narrow the
              same thing (which time window the numbers below cover) */}
          <div className="flex items-center gap-1.5">
            {/* Clean macOS-style segmented control — a raised white pill on
                a flat slate track for the active preset, instead of a solid
                brand-blue block, keeping the accent color to a deliberate
                10% of this row's visual weight (the year Select + refresh
                button around it stay neutral slate). */}
            <div role="group" className="flex items-center gap-1 h-9 rounded-xl bg-slate-100 p-1 dark:bg-secondary/40">
              {PERIOD_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setPeriodPreset(preset.key)}
                  aria-pressed={periodPreset === preset.key}
                  className={cn(
                    "h-7 px-3 rounded-lg text-xs font-medium transition-all duration-150",
                    periodPreset === preset.key
                      ? "bg-white text-slate-900 font-medium shadow-xs dark:bg-card dark:text-foreground"
                      : "text-slate-500 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-24 h-9 rounded-xl border-slate-200/70 bg-white/90 dark:border-border dark:bg-secondary/40">
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
          </div>

          {/* Divider — separates "which period" from "how to view it",
              two unrelated decisions that read as one continuous strip
              of blue pills without it */}
          <div className="hidden sm:block h-6 w-px bg-border/60" aria-hidden="true" />

          {/* Refresh action — the N-1 comparison used to be a manual toggle
              here, but the badge is now always shown inline on each card
              (see Tier 2), so this row is refresh-only. */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing} className="shrink-0 rounded-xl h-9 w-9 border-slate-200/70 bg-white/90 dark:border-border dark:bg-secondary/40">
                  <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} strokeWidth={1.5} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Actualiser</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ── Tier 2 — 4-column KPI bento grid, one card per metric ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 animate-fade-in-up animation-delay-100">
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
              <div key={cell.key} className={cn(BENTO_CARD_CLASS, "p-5 flex flex-col")}>
                <div className="flex items-center gap-1.5 text-slate-400 dark:text-muted-foreground">
                  <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                  {/* Zero ellipsis — full label always fits, never truncated. */}
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{cell.label}</span>
                </div>
                <div className="mt-2">
                  <span className={cn("inline-flex items-baseline flex-wrap", isDeficit && "px-2 py-0.5 rounded-full bg-rose-500/10")}>
                    <AnimatedNumber
                      value={cell.value}
                      format={formatCurrencyNumber}
                      className={cn(
                        "text-2xl font-bold font-mono tabular-nums tracking-tight",
                        isDeficit ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-foreground"
                      )}
                    />
                    <span className="text-xs font-medium text-slate-400 ml-1.5 dark:text-muted-foreground">DA</span>
                  </span>
                </div>
                {/* Bottom status/trend row — comparison badge, subtext badge,
                    or a micro-sparkline when the metric has no delta/badge of
                    its own. Always its own row so nothing ever clips against
                    the value above it. */}
                <div className="mt-2 flex items-center justify-between gap-3 min-h-[22px]">
                  {cell.delta !== null ? (
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full border shrink-0",
                        deltaGood
                          ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400"
                          : "text-rose-600 bg-rose-500/10 border-rose-500/20 dark:text-rose-400"
                      )}
                    >
                      {cell.delta >= 0 ? "+" : ""}
                      {cell.delta.toFixed(1)}% vs N-1
                    </span>
                  ) : "subtext" in cell && cell.subtext ? (
                    cell.key === "receivables" ? (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 select-none">
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full ring-2 shrink-0",
                            ("outstandingCount" in cell && (cell.outstandingCount as number) > 0)
                              ? "bg-amber-500 ring-amber-500/20"
                              : "bg-emerald-500 ring-emerald-500/20"
                          )}
                        />
                        {"outstandingCount" in cell && (cell.outstandingCount as number) > 0 ? (
                          <>
                            <span className="font-medium text-slate-600 dark:text-slate-300">
                              {cell.outstandingCount} {(cell.outstandingCount as number) > 1 ? "factures" : "facture"}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500">avec solde restant</span>
                          </>
                        ) : (
                          <span className="font-medium text-slate-600 dark:text-slate-300">
                            Aucun solde restant
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400">
                        {cell.subtext}
                      </span>
                    )
                  ) : (
                    <span />
                  )}
                  {cell.sparkline.length > 1 && (
                    <div className="h-8 flex-1 min-w-[48px]">
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
              </div>
            );
          })}
        </div>

        {/* ── Tier 3 — 12-column analytics grid, height-locked at 320px ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch animate-fade-in-up animation-delay-200">
          {/* Left: cashflow diverging bar chart — span 8/12 */}
          <Card className={cn("lg:col-span-2 flex flex-col h-[320px]", BENTO_CARD_CLASS)}>
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
                  {/* Breathable padding on every side so bars never touch the
                      card edges — was flush against left/right/bottom. */}
                  <BarChart data={cashflowChartData} margin={{ top: 16, right: 16, left: 8, bottom: 4 }} stackOffset="sign">
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-border/50" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => formatCompactCurrency(Math.abs(Number(v)))} fontSize={12} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <ChartTooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      content={<CashflowTooltip />}
                    />
                    {/* Recettes in a refined brand blue, matching the legend
                        dot exactly — every bar, not just the current month,
                        so the series reads consistently at any zoom/period.
                        Rounded only at the outer (top) edge — the baseline
                        edge stays flush against the zero line. */}
                    <Bar dataKey="revenue" stackId="a" radius={[3, 3, 0, 0]} animationDuration={900} fill={cashflowChartConfig.revenue.color} />
                    {/* Expenses stay a clean neutral gray regardless of that
                        month's balance — operating costs are a normal,
                        expected outlay, not an alarm state. Red is reserved
                        exclusively for the Bénéfice Net/Trésorerie
                        sparklines and figures when the *period* total is
                        actually in deficit (see the metric ribbon below),
                        not sprinkled across every negative month's bar.
                        Rounded at the outer (bottom) edge — these bars grow
                        downward from the zero line. */}
                    <Bar dataKey="expenses" stackId="a" radius={[0, 0, 3, 3]} animationDuration={900} animationBegin={100} fill={cashflowChartConfig.expenses.color} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Right: revenue-by-project donut + breakdown — span 4/12 */}
          <Card className={cn("lg:col-span-1 flex flex-col h-[320px] justify-between", BENTO_CARD_CLASS)}>
            <CardHeader className="shrink-0 py-4">
              <CardTitle className="text-sm font-semibold">Répartition par Projet</CardTitle>
            </CardHeader>
            {projectDonutData.length === 0 ? (
              <CardContent className="flex-1 min-h-0">
                <EmptyState size="compact" icon={FolderKanban} title="Aucune vente" description="Aucune vente n'est rattachée à un projet" />
              </CardContent>
            ) : (
              <>
                <div className="relative h-[160px] shrink-0">
                  <ChartContainer config={{}} className="w-full h-full">
                    <PieChart>
                      {/* No tooltip on this chart on purpose — the center
                          hero stat (Total Projets) needs to stay fully
                          visible and static on hover, and a floating value
                          box tends to render right on top of it. */}
                      <Pie
                        data={projectDonutData}
                        dataKey="value"
                        nameKey="label"
                        innerRadius="72%"
                        outerRadius="92%"
                        paddingAngle={4}
                        cornerRadius={8}
                        stroke="none"
                        animationDuration={900}
                        // Emphasize the hovered slice by growing its outer
                        // radius a few px, via Recharts' activeShape hook —
                        // Cell alone can't override radius per-segment.
                        activeIndex={hoveredDonutIndex ?? undefined}
                        activeShape={(shapeProps: PieSectorDataItem) => (
                          <Sector {...shapeProps} outerRadius={(shapeProps.outerRadius ?? 0) + 4} />
                        )}
                        onMouseEnter={(_, index) => setHoveredDonutIndex(index)}
                        onMouseLeave={() => setHoveredDonutIndex(null)}
                      >
                        {projectDonutData.map((entry, index) => (
                          <Cell
                            key={entry.key}
                            fill={entry.color}
                            opacity={hoveredDonutIndex === null || hoveredDonutIndex === index ? 1 : 0.35}
                            style={{ transition: "opacity 200ms ease, transform 200ms ease", transformOrigin: "center" }}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  {/* Hero stat in the donut's hollow center — Recharts has no
                      native center-label slot for a plain Pie, so this is a
                      plain absolutely-centered overlay instead. Three short
                      lines (micro-label / figure / unit) instead of one long
                      "Total Projets" + "value DA" line — the long label was
                      wider than the hollow center's inscribed square, so it
                      visually crowded the ring even though nothing actually
                      overlapped in the DOM. */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total</span>
                    <span className="text-xl font-bold tracking-tight text-slate-900 tabular-nums leading-none mt-0.5">{formatCompactCurrency(donutTotal)}</span>
                    <span className="text-[10px] font-medium text-slate-400">DA</span>
                  </div>
                </div>
                <CardContent className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pt-0 pb-3 space-y-2.5">
                  {hoveredDonutIndex !== null && projectDonutData[hoveredDonutIndex] ? (
                    // Hovering a segment isolates the legend to just that
                    // project — re-keyed per index so the fade-in restarts
                    // on every swap between hovered segments.
                    (() => {
                      const item = projectDonutData[hoveredDonutIndex];
                      if (item.key === "others") {
                        return (
                          <div key="hovered-others" className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 bg-muted/40 animate-fade-in duration-150">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-xs font-medium text-muted-foreground">
                              +{projectRevenueOthers.length} autre{projectRevenueOthers.length > 1 ? "s" : ""} projet{projectRevenueOthers.length > 1 ? "s" : ""} · {item.displayValue} DA
                            </span>
                          </div>
                        );
                      }
                      const pct = donutTotal > 0 ? Math.round((item.value / donutTotal) * 100) : 0;
                      return (
                        <div
                          key={`hovered-${item.key}`}
                          className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-1.5 bg-muted/40 animate-fade-in duration-150"
                          onMouseEnter={() => setHoveredDonutIndex(hoveredDonutIndex)}
                          onMouseLeave={() => setHoveredDonutIndex(null)}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-foreground leading-tight">{item.label}</span>
                              {item.category && (
                                <span className="block truncate text-[11px] text-muted-foreground leading-tight">{item.category}</span>
                              )}
                            </span>
                          </span>
                          <span className="flex flex-col items-end shrink-0">
                            <span className="font-mono tabular-nums tracking-tight text-foreground text-sm leading-tight">{formatCurrency(item.value)}</span>
                            <span className="text-[11px] text-muted-foreground leading-tight">{pct}%</span>
                          </span>
                        </div>
                      );
                    })()
                  ) : (
                    projectDonutData.map((item, index) => {
                      // "Autres" renders as a clean, minimal "+X autres"
                      // indicator instead of a full client/amount/percent
                      // row — the top 3 above it already carry the detail.
                      if (item.key === "others") {
                        return (
                          <div
                            key={item.key}
                            className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-muted/40 animate-fade-in duration-150"
                            onMouseEnter={() => setHoveredDonutIndex(index)}
                            onMouseLeave={() => setHoveredDonutIndex(null)}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-xs font-medium text-muted-foreground">
                              +{projectRevenueOthers.length} autre{projectRevenueOthers.length > 1 ? "s" : ""} projet{projectRevenueOthers.length > 1 ? "s" : ""}
                            </span>
                          </div>
                        );
                      }
                      const pct = donutTotal > 0 ? Math.round((item.value / donutTotal) * 100) : 0;
                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-muted/40 animate-fade-in duration-150"
                          onMouseEnter={() => setHoveredDonutIndex(index)}
                          onMouseLeave={() => setHoveredDonutIndex(null)}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-foreground leading-tight">{item.label}</span>
                              {item.category && (
                                <span className="block truncate text-[11px] text-muted-foreground leading-tight">{item.category}</span>
                              )}
                            </span>
                          </span>
                          <span className="flex flex-col items-end shrink-0">
                            <span className="font-mono tabular-nums tracking-tight text-foreground text-sm leading-tight">{formatCurrency(item.value)}</span>
                            <span className="text-[11px] text-muted-foreground leading-tight">{pct}%</span>
                          </span>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </>
            )}
          </Card>
        </div>

        {/* ── Tier 4 — Project Hub + Activité Récente, two equal columns —
            sized to content (min/max instead of a hard lock) so a handful
            of rows doesn't leave a wall of empty space, but the card still
            caps out and scrolls instead of growing unbounded with many
            rows. Each card sizes independently (items-start), not forced
            to match the other's height. ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch animate-fade-in-up animation-delay-300">
          {/* Left: project health & profitability hub */}
          <Card className={cn("flex flex-col h-full", BENTO_CARD_CLASS)}>
            <CardHeader className="flex flex-row items-center justify-between shrink-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                Santé &amp; Rentabilité des Projets
              </CardTitle>
              <button onClick={() => navigate("/projects")} className="text-xs text-muted-foreground hover:text-primary flex items-center transition-colors">
                Tout voir <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-5 pt-0">
              {projectHubRows.length === 0 ? (
                <EmptyState
                  size="compact"
                  type="projects"
                  title="Aucun projet"
                  description="Aucun projet avec de l'activité facturée"
                  action={{ label: "Créer un projet", onClick: () => navigate("/projects/new") }}
                />
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-border/40">
                  {projectHubRows.map((row) => {
                    const isSettled = row.collectionStatus.label === "Soldé";
                    const pct = Math.round(row.budgetRatio * 100);
                    return (
                      <li key={row.project.id}>
                        <button
                          onClick={() => navigate(`/projects/${row.project.id}`)}
                          className="w-full flex items-center gap-4 text-left hover:bg-slate-50/70 dark:hover:bg-muted/30 p-2 -mx-2 rounded-xl transition-colors cursor-pointer"
                        >
                          {/* Project info */}
                          <div className="min-w-0 flex-[1.2]">
                            <p className="text-xs font-semibold text-slate-800 dark:text-foreground truncate max-w-[160px]">
                              {row.project.name}
                            </p>
                            <p className="text-[11px] text-slate-400 dark:text-muted-foreground font-normal truncate">
                              {row.clientName}
                            </p>
                          </div>

                          {/* Progress & metrics — real cash collected via
                              the payments ledger, not "logged expenses vs a
                              manually-typed planned budget" (empty for every
                              project unless someone tags expenses.project_id,
                              which nothing here does). */}
                          <div className="flex-1 min-w-[100px] hidden md:block">
                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", isSettled ? "bg-emerald-500" : "bg-blue-600")}
                                style={{ width: `${row.budgetRatio * 100}%` }}
                              />
                            </div>
                            <p className="text-[10px] font-mono text-slate-400 dark:text-muted-foreground mt-1">
                              {formatCompactCurrency(row.collected)} / {formatCompactCurrency(row.contractTotal)} DA ({pct}%)
                            </p>
                          </div>

                          {/* Collection status — whether the client has
                              actually paid, independent of task-tracking
                              (computeProjectStatus's "Nouveau" fires whenever
                              a project has zero logged tasks, which is every
                              project here, even fully-settled ones). */}
                          <div className="shrink-0 hidden sm:block">
                            <span
                              className={cn(
                                "text-[10px] font-medium px-2 py-0.5 rounded-md",
                                isSettled ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground"
                              )}
                            >
                              {row.collectionStatus.label}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Right: Gouvernance & Retraits (2026) */}
          <PartnersGovernanceWidget />
        </div>
      </div>
    </main>
  );
};

export default Index;
