import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useInvoices } from "@/hooks/useInvoices";
import { useExpenses } from "@/hooks/useExpenses";
import { useClients } from "@/hooks/useClients";
import {
  RiArrowRightUpLine as TrendingUp,
  RiArrowRightDownLine as TrendingDown,
  RiMoneyDollarCircleLine as DollarSign,
  RiReceiptLine as Receipt,
  RiUserLine as Users,
  RiBox3Line as Package,
  RiTableLine as TableIcon,
  RiArrowRightSLine,
  RiPercentLine,
} from "@remixicon/react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  PolarGrid,
  PolarRadiusAxis,
  Label,
} from "recharts";


// Dashboard-only palette: the exact two colors in the Sordi logo
// (public/sordi main logo.svg) — #476cff and #a8c8e8 — nothing invented.
// Scoped to these chart configs rather than the shared --chart-N/--status-N
// tokens, since those also color badges and icons elsewhere in the app that
// weren't asked to change.
const CHART_BLUE = "#476cff";
const CHART_BLUE_LIGHT = "#a8c8e8";
const CHART_BLUE_SOFT = "#476cff80";
const CHART_BLUE_LIGHT_SOFT = "#a8c8e880";

// One story, one chart: revenue vs. charges over time. Profit is legible as
// the gap between the two areas, so a third series would only repeat what's
// already visible rather than add information.
const performanceChartConfig = {
  revenue: { label: "Revenus", color: CHART_BLUE },
  expenses: { label: "Charges", color: CHART_BLUE_LIGHT },
} satisfies ChartConfig;

const productChartConfig = {
  value: { label: "Montant vendu", color: CHART_BLUE },
} satisfies ChartConfig;

const invoiceStatusChartConfig = {
  paid: { label: "Payées", color: CHART_BLUE },
  partial: { label: "Partielles", color: CHART_BLUE_LIGHT },
  pending: { label: "En attente", color: CHART_BLUE_SOFT },
  overdue: { label: "En retard", color: CHART_BLUE_LIGHT_SOFT },
} satisfies ChartConfig;

const recoveryChartConfig = {
  rate: { label: "Recouvré", color: CHART_BLUE },
} satisfies ChartConfig;

const Index = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const { data: stats, isLoading: statsLoading } = useDashboardStats(
    parseInt(selectedYear),
    selectedMonths
  );

  const { data: allInvoices } = useInvoices();
  const { data: allExpenses } = useExpenses();
  const { data: clients } = useClients();
  const navigate = useNavigate();

  // Filter local data
  const invoices = allInvoices?.filter(i => {
    try {
      const d = new Date(i.invoice_date);
      const yearMatch = d.getFullYear() === parseInt(selectedYear);
      const m = d.getMonth() + 1;
      const monthMatch = selectedMonths.length === 0 || selectedMonths.includes(m.toString());
      return yearMatch && monthMatch && i.invoice_type !== 'credit_note';
    } catch { return false; }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(amount) + " DA";
  };

  const formatCompactCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(1) + "M";
    }
    if (amount >= 1000) {
      return (amount / 1000).toFixed(0) + "K";
    }
    return amount.toString();
  };

  // Prepare main chart data
  let mainChartData: { name: string; revenue: number; expenses: number }[] = [];

  if (stats?.isMonthView && stats?.dailyData) {
    mainChartData = stats.dailyData.map(d => ({
      name: `J${d.label}`,
      revenue: d.revenue,
      expenses: d.expenses,
    }));
  } else {
    mainChartData = stats?.monthlyData?.map((m) => {
      const parts = m.label ? m.label.split('-') : [];
      const monthIndex = parts.length >= 2 ? parseInt(parts[1]) - 1 : 0;
      const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
      return {
        name: monthNames[monthIndex] || m.label,
        revenue: m.revenue,
        expenses: m.expenses,
      };
    }) || [];
  }

  // Calculate revenue by client
  const clientStatsMap = invoices?.reduce((acc, inv) => {
    const clientId = inv.client_id;
    const clientName = inv.clients?.name || "Inconnu";

    if (!acc[clientId]) {
      acc[clientId] = {
        id: clientId,
        name: clientName,
        revenue: 0,
        count: 0
      };
    }

    acc[clientId].revenue += Number(inv.total_ttc || 0);
    acc[clientId].count += 1;

    return acc;
  }, {} as Record<string, { id: string, name: string, revenue: number, count: number }>) || {};

  const topClientsData = Object.values(clientStatsMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // Prepare Product Stats Data
  const productChartData = stats?.productStats?.map(p => ({
    name: p.product_name || p.product_code || "Inconnu",
    value: p.total_amount,
  })) || [];

  // Invoice status breakdown
  const invoiceStatusData = invoices?.reduce((acc, inv) => {
    const status = inv.status || "draft";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const totalInvoicesCount = invoices?.length || 0;
  const paidInvoicesCount = invoiceStatusData["paid"] || 0;
  const collectionRate = totalInvoicesCount > 0 ? Math.round((paidInvoicesCount / totalInvoicesCount) * 100) : 0;
  const recoveryChartData = [{ metric: "rate", value: collectionRate, fill: "var(--color-rate)" }];

  const statusChartData = [
    { key: "paid", name: "Payées", value: invoiceStatusData["paid"] || 0 },
    { key: "partial", name: "Partielles", value: invoiceStatusData["partial"] || 0 },
    { key: "pending", name: "En attente", value: (invoiceStatusData["issued"] || 0) + (invoiceStatusData["draft"] || 0) },
    { key: "overdue", name: "En retard", value: invoiceStatusData["overdue"] || 0 },
  ].filter(s => s.value > 0);

  // Year options
  const yearOptions = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  const monthOptions = [
    { value: "1", label: "Janvier" },
    { value: "2", label: "Février" },
    { value: "3", label: "Mars" },
    { value: "4", label: "Avril" },
    { value: "5", label: "Mai" },
    { value: "6", label: "Juin" },
    { value: "7", label: "Juillet" },
    { value: "8", label: "Août" },
    { value: "9", label: "Septembre" },
    { value: "10", label: "Octobre" },
    { value: "11", label: "Novembre" },
    { value: "12", label: "Décembre" },
  ];

  const totalRevenue = stats?.yearly.revenue || 0;
  const totalExpenses = stats?.yearly.expenses || 0;
  const netProfit = stats?.yearly.profit || 0;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0.0";
  const expenseRatio = totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(1) : "0.0";

  if (statsLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-8 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Chargement du tableau de bord...</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-[1600px] mx-auto space-y-8">

            {/* Header / Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-down relative z-30">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Tableau de bord</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Vue d'ensemble de votre activité</p>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <MultiSelect
                  key={selectedYear}
                  options={monthOptions}
                  selected={selectedMonths}
                  onChange={setSelectedMonths}
                  placeholder="Filtrer par mois..."
                  className="w-56"
                />
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up animation-delay-100">
              <StatsCard
                title={`CA ${selectedMonths.length > 0 ? "Période" : "Annuel"}`}
                value={formatCurrency(totalRevenue)}
                icon={TrendingUp}
                highlighted
                trend={stats?.growth !== 0 ? {
                  value: `${stats?.growth && stats.growth > 0 ? "+" : ""}${stats?.growth}% vs période précédente`,
                  positive: !!(stats?.growth && stats.growth > 0),
                } : undefined}
              />
              <StatsCard
                title={`Charges ${selectedMonths.length > 0 ? "Période" : "Annuelles"}`}
                value={formatCurrency(totalExpenses)}
                icon={TrendingDown}
                subValue={`${expenseRatio}% du chiffre d'affaires`}
              />
              <StatsCard
                title="Bénéfice Net"
                value={formatCurrency(netProfit)}
                icon={DollarSign}
                trend={{ value: `Marge de ${profitMargin}%`, positive: netProfit >= 0 }}
              />
              <StatsCard
                title="Créances Totales"
                value={formatCurrency((stats?.payments?.unpaid || 0) + (selectedMonths.length === 0 ? (stats?.payments?.initialDebt || 0) : 0))}
                icon={Receipt}
                subValue={`Dont ${formatCompactCurrency(stats?.payments?.initialDebt || 0)} dettes antérieures`}
              />
            </div>

            {/* Cumulative sales */}
            <div className="space-y-3 animate-fade-in-up animation-delay-150">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Package className="w-4 h-4 text-primary" />
                Détails cumulés des ventes ({invoices?.length || 0} factures)
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 md:divide-x divide-border rounded-[6px] border border-border bg-card card-hover">
                <div className="p-5">
                  <p className="text-xs text-muted-foreground mb-1">Total HT</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{formatCurrency(stats?.salesCumulatives?.totalHt || 0)}</p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-muted-foreground mb-1">Total TVA</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{formatCurrency(stats?.salesCumulatives?.totalTva || 0)}</p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-muted-foreground mb-1">Total Timbre</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{formatCurrency(stats?.salesCumulatives?.totalTimbre || 0)}</p>
                </div>
                <div className="p-5 bg-primary/5">
                  <p className="text-xs text-primary font-medium mb-1">Total TTC Cumulé</p>
                  <p className="text-lg font-bold text-primary tabular-nums">{formatCurrency(stats?.salesCumulatives?.totalTtc || 0)}</p>
                </div>
              </div>
            </div>

            {/* Primary chart */}
            <Card className="card-hover animate-fade-in-up animation-delay-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Revenus &amp; Charges</CardTitle>
                <CardDescription className="text-xs">
                  Évolution du chiffre d'affaires face aux charges d'exploitation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={performanceChartConfig} className="aspect-auto h-80 w-full">
                  <AreaChart data={mainChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradientRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradientExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-expenses)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-expenses)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => formatCompactCurrency(v)} fontSize={12} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                    <Area type="monotone" dataKey="expenses" stroke="var(--color-expenses)" strokeWidth={2} fill="url(#gradientExpenses)" />
                    <Area type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2.5} fill="url(#gradientRevenue)" />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Secondary charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch animate-fade-in-up animation-delay-300">
              <Card className="flex flex-col card-hover">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <RiPercentLine className="w-4 h-4 text-muted-foreground" />
                    Taux de Recouvrement
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col sm:flex-row items-start gap-8">
                  <ChartContainer config={recoveryChartConfig} className="w-64 h-64 mx-auto sm:mx-0 shrink-0">
                    <RadialBarChart
                      data={recoveryChartData}
                      startAngle={90}
                      endAngle={90 - (collectionRate / 100) * 360}
                      innerRadius={72}
                      outerRadius={100}
                    >
                      <PolarGrid gridType="circle" radialLines={false} stroke="none" className="first:fill-muted last:fill-background" polarRadius={[78, 66]} />
                      <RadialBar dataKey="value" cornerRadius={10} fill="var(--color-rate)" />
                      <PolarRadiusAxis tick={false} tickLine={false} axisLine={false} domain={[0, 100]}>
                        <Label
                          content={({ viewBox }) => {
                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                              return (
                                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                  <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-4xl font-bold">
                                    {collectionRate}%
                                  </tspan>
                                </text>
                              );
                            }
                            return null;
                          }}
                        />
                      </PolarRadiusAxis>
                    </RadialBarChart>
                  </ChartContainer>
                  <div className="w-full sm:flex-1 pt-7 space-y-1">
                    <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Factures payées</span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {paidInvoicesCount} / {totalInvoicesCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-muted-foreground">Montant recouvré</span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {formatCurrency(stats?.payments?.paid || 0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="flex flex-col card-hover">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-muted-foreground" />
                    État des Factures
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col sm:flex-row items-center gap-8">
                  <div className="relative shrink-0 w-64 h-64 mx-auto sm:mx-0">
                    <ChartContainer config={invoiceStatusChartConfig} className="w-full h-full">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={64} outerRadius={100} paddingAngle={2} dataKey="value" nameKey="key">
                          {statusChartData.map((entry) => (
                            <Cell key={entry.key} fill={`var(--color-${entry.key})`} strokeWidth={0} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-bold text-foreground tabular-nums">{totalInvoicesCount}</span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Factures</span>
                    </div>
                  </div>
                  <div className="w-full sm:flex-1 space-y-1">
                    {statusChartData.map((s) => (
                      <div key={s.key} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: `var(--color-${s.key})` }} />
                          <span className="text-sm text-muted-foreground">{s.name}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-semibold text-foreground tabular-nums">{s.value}</span>
                          <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">
                            {totalInvoicesCount > 0 ? Math.round((s.value / totalInvoicesCount) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                    {statusChartData.length === 0 && (
                      <p className="text-sm text-muted-foreground">Aucune facture sur cette période</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch animate-fade-in-up animation-delay-400">
              <Card className="flex flex-col card-hover">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    Top Produits
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex items-center">
                  <ChartContainer config={productChartConfig} className="aspect-auto h-80 w-full">
                    <BarChart layout="vertical" data={productChartData.slice(0, 6)} margin={{ left: 0, right: 16 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactCurrency(v)} fontSize={12} />
                      <YAxis dataKey="name" type="category" width={140} tickLine={false} axisLine={false} fontSize={12} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} hideLabel />} />
                      <Bar dataKey="value" fill="var(--color-value)" radius={4} maxBarSize={24} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="flex flex-col card-hover">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    Top Clients
                  </CardTitle>
                  <button onClick={() => navigate('/clients')} className="text-xs text-muted-foreground hover:text-primary flex items-center transition-colors">
                    Tous <RiArrowRightSLine className="w-3.5 h-3.5" />
                  </button>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center">
                  <div className="space-y-1">
                    {topClientsData.map((client, i) => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-[6px] hover:bg-muted/50 cursor-pointer transition-all duration-200 hover:translate-x-1"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={cn(
                            "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 tabular-nums transition-transform duration-200 group-hover:scale-110",
                            i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-foreground truncate">{client.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-foreground tabular-nums shrink-0 ml-2">
                          {formatCompactCurrency(client.revenue)}
                        </span>
                      </div>
                    ))}
                    {topClientsData.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">Aucune vente sur cette période</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cumulative sales analysis now lives on its own page — it's a
                reporting tool, not an at-a-glance metric, and the pivot
                tables need more room than a dashboard card can offer. */}
            <button
              onClick={() => navigate('/analyses')}
              className="w-full flex items-center justify-between p-5 rounded-[6px] border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 hover:shadow-soft text-left group animate-fade-in-up animation-delay-500 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <TableIcon className="w-5 h-5 text-primary transition-transform duration-300 group-hover:scale-110" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Analyses des Ventes Cumulées</p>
                  <p className="text-xs text-muted-foreground">Rapports détaillés par produit et par client</p>
                </div>
              </div>
              <RiArrowRightSLine className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
