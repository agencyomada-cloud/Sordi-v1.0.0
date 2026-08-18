import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useInvoices } from "@/hooks/useInvoices";
import { useExpenses } from "@/hooks/useExpenses";
import { useClients } from "@/hooks/useClients";
import { TrendingUp, TrendingDown, DollarSign, Receipt, Users, Package, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

import { ClientProductPivotTable } from "@/components/dashboard/ClientProductPivotTable";
import { ClientCumulativeTable } from "@/components/dashboard/ClientCumulativeTable";

const chartColors = {
  primary: "hsl(142, 76%, 36%)",
  secondary: "hsl(45, 93%, 47%)",
  danger: "hsl(0, 84%, 60%)",
  muted: "hsl(215, 20%, 65%)",
  blue: "hsl(217, 91%, 60%)",
  purple: "hsl(262, 83%, 58%)",
  orange: "hsl(25, 95%, 53%)",
  cyan: "hsl(186, 94%, 42%)",
};

const COLORS = [chartColors.primary, chartColors.secondary, chartColors.blue, chartColors.purple, chartColors.orange, chartColors.cyan];

const Index = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  // Multi-select state for months
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [cumulativeView, setCumulativeView] = useState<'pivot' | 'client'>('pivot');

  const { data: stats, isLoading: statsLoading } = useDashboardStats(
    parseInt(selectedYear),
    selectedMonths
  );

  const { data: allInvoices } = useInvoices();
  const { data: allExpenses } = useExpenses();
  const { data: clients } = useClients();

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

  const expenses = allExpenses?.filter(e => {
    try {
      const d = new Date(e.expense_date);
      const yearMatch = d.getFullYear() === parseInt(selectedYear);

      const m = d.getMonth() + 1;
      const monthMatch = selectedMonths.length === 0 || selectedMonths.includes(m.toString());

      return yearMatch && monthMatch;
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

  // Prepare chart data 
  // If stats.isMonthView is true (single month selected) -> dailyData
  // Else -> monthlyData

  let mainChartData: any[] = [];

  if (stats?.isMonthView && stats?.dailyData) {
    mainChartData = stats.dailyData.map(d => ({
      name: d.label, // Backend returns "label" (day number string "1", "2")
      revenue: d.revenue,
      expenses: d.expenses,
      profit: d.profit
    }));
  } else {
    // Monthly View (Yearly or Multi-Month)
    // We can just use stats.monthlyData directly as it already contains "YYYY-MM" labels 
    // BUT usually we want human readable "Jan", "Feb" etc.
    // Let's format the name based on the month

    mainChartData = stats?.monthlyData?.map((m) => {
      // m.label is "YYYY-MM"
      const parts = m.label ? m.label.split('-') : [];
      if (parts.length < 2) return { name: "N/A", revenue: 0, expenses: 0, profit: 0 };

      const monthIndex = parseInt(parts[1]) - 1;
      const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
      return {
        name: monthNames[monthIndex] || m.label,
        revenue: m.revenue,
        expenses: m.expenses,
        profit: m.profit,
      };
    }) || [];
  }

  // Calculate expense by category
  const expenseByCategory = expenses?.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
    return acc;
  }, {} as Record<string, number>) || {};

  const expenseCategoryData = Object.entries(expenseByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Calculate revenue by client
  // Group by ID to ensure we have the ID for navigation
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
    .slice(0, 5);

  // Navigation
  const navigate = useNavigate();

  // ... (rest of the file until Top Clients Card)

  // (This replacement chunk is large because I need to insert `const navigate` at top AND update the Top Clients Card rendering)
  // Actually, I should do it in two steps or just rewrite the component body start and the specific card.
  // The component starts at line 41. I need `useNavigate` there.
  // Then the card is at 456.
  // I'll do `useNavigate` first.


  // Prepare Product Stats Data
  // stats.productStats is already sorted by amount DESC by the backend
  const productChartData = stats?.productStats?.map(p => ({
    name: p.product_name || p.product_code || "Inconnu",
    value: p.total_amount,
    quantity: p.total_quantity
  })) || [];


  // Invoice status breakdown
  const invoiceStatusData = invoices?.reduce((acc, inv) => {
    const status = inv.status || "draft";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const statusChartData = [
    { name: "Payées", value: invoiceStatusData["paid"] || 0, color: chartColors.primary },
    { name: "Partielles", value: invoiceStatusData["partial"] || 0, color: chartColors.secondary },
    { name: "En attente", value: (invoiceStatusData["issued"] || 0) + (invoiceStatusData["draft"] || 0), color: chartColors.muted },
    { name: "En retard", value: invoiceStatusData["overdue"] || 0, color: chartColors.danger },
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

  if (statsLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-8 flex items-center justify-center">
            <p className="text-muted-foreground">Chargement du tableau de bord...</p>
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
        <main className="flex-1 overflow-auto bg-muted/20 p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-4 md:space-y-8">
            {/* Header / Filter Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Tableau de bord</h1>
                <p className="text-muted-foreground">Vue d'ensemble de votre activité</p>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <MultiSelect
                  key={selectedYear}
                  options={monthOptions}
                  selected={selectedMonths}
                  onChange={setSelectedMonths}
                  placeholder="Filtrer par mois..."
                  className="w-64"
                />

                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32">
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

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                    <span className="text-sm text-muted-foreground">CA {selectedMonths.length > 0 ? 'Période' : 'Annuel'}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(stats?.yearly.revenue || 0)}</p>
                  {stats?.growth !== 0 && (
                    <p className={`text-sm mt-1 ${stats?.growth && stats.growth > 0 ? "text-green-600" : "text-red-500"}`}>
                      {stats?.growth && stats.growth > 0 ? "+" : ""}{stats?.growth}% vs période précédente
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    </div>
                    <span className="text-sm text-muted-foreground">Charges {selectedMonths.length > 0 ? 'Période' : 'Annuelles'}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(stats?.yearly.expenses || 0)}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {((stats?.yearly.expenses || 0) / (stats?.yearly.revenue || 1) * 100).toFixed(1)}% du CA
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-sm text-muted-foreground">Bénéfice Net</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(stats?.yearly.profit || 0)}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Marge: {((stats?.yearly.profit || 0) / (stats?.yearly.revenue || 1) * 100).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Receipt className="w-5 h-5 text-yellow-600" />
                    </div>
                    <span className="text-sm text-muted-foreground">Créances Totales</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency((stats?.payments?.unpaid || 0) + (selectedMonths.length === 0 ? (stats?.payments?.initialDebt || 0) : 0))}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Dont {formatCompactCurrency(stats?.payments?.initialDebt || 0)} dettes antérieures
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Cumulative Sales Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Détails Cumulés des Ventes (Période)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground mb-1">Total HT</p>
                    <p className="text-xl font-bold">{formatCurrency(stats?.salesCumulatives?.totalHt || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground mb-1">Total TVA</p>
                    <p className="text-xl font-bold">{formatCurrency(stats?.salesCumulatives?.totalTva || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground mb-1">Total Timbre</p>
                    <p className="text-xl font-bold">{formatCurrency(stats?.salesCumulatives?.totalTimbre || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/10 border-primary/30">
                  <CardContent className="p-4">
                    <p className="text-sm text-primary font-medium mb-1">Total TTC Cumulé</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(stats?.salesCumulatives?.totalTtc || 0)}</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Revenus vs Charges</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={mainChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => formatCompactCurrency(v)} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                        <Bar dataKey="revenue" fill={chartColors.primary} name="Revenus" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" fill={chartColors.danger} name="Charges" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ventes par Produit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={productChartData.slice(0, 8)}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" tickFormatter={(v) => formatCompactCurrency(v)} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                        <Bar dataKey="value" fill={chartColors.orange} name="Montant Vendu" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">État des Factures</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {statusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => value + " factures"}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Évolution du Bénéfice</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mainChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => formatCompactCurrency(v)} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="profit"
                          stroke={chartColors.blue}
                          strokeWidth={3}
                          dot={{ fill: chartColors.blue, strokeWidth: 2 }}
                          name="Bénéfice"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Top Clients
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topClientsData.map((client, i) => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium">{client.name}</span>
                        </div>
                        <span className="text-sm font-bold">{formatCurrency(client.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Summary Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Users className="w-8 h-8 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{clients?.length || 0}</p>
                      <p className="text-sm text-muted-foreground">Clients actifs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Receipt className="w-8 h-8 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{invoices?.length || 0}</p>
                      <p className="text-sm text-muted-foreground">Factures émises</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <TrendingDown className="w-8 h-8 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{formatCurrency(stats?.yearly?.expenses || 0)}</p>
                      <p className="text-sm text-muted-foreground">Dépenses {selectedYear}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cumulative Sales Analysis Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <TableIcon className="w-5 h-5 text-primary" />
                  Analyses des Ventes Cumulées
                </h2>
                <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50">
                  <button
                    onClick={() => setCumulativeView('pivot')}
                    className={cn(
                      "px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200",
                      cumulativeView === 'pivot'
                        ? "bg-card text-primary shadow-sm ring-1 ring-border/50"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Analyse par Produit
                  </button>
                  <button
                    onClick={() => setCumulativeView('client')}
                    className={cn(
                      "px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200",
                      cumulativeView === 'client'
                        ? "bg-card text-primary shadow-sm ring-1 ring-border/50"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Rapport Global Clients
                  </button>
                </div>
              </div>

              {cumulativeView === 'pivot' ? (
                <ClientProductPivotTable year={parseInt(selectedYear)} months={selectedMonths} />
              ) : (
                <ClientCumulativeTable year={parseInt(selectedYear)} months={selectedMonths} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
