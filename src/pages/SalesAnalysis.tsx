import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";
import { ClientProductPivotTable } from "@/components/dashboard/ClientProductPivotTable";
import { ClientCumulativeTable } from "@/components/dashboard/ClientCumulativeTable";

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

export default function SalesAnalysisPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [view, setView] = useState<'pivot' | 'client'>('pivot');

  const yearOptions = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 min-w-0 p-4 md:p-8">
          <div className="max-w-[1600px] mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-30">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Analyses des Ventes</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Ventilation détaillée des ventes cumulées, par produit et par client
                </p>
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

            <div className="flex bg-muted/40 p-1 rounded-[6px] border border-border/40 w-fit">
              <button
                onClick={() => setView('pivot')}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded-[4px] transition-all",
                  view === 'pivot' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Analyse par Produit
              </button>
              <button
                onClick={() => setView('client')}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded-[4px] transition-all",
                  view === 'client' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Rapport Global Clients
              </button>
            </div>

            {view === 'pivot' ? (
              <ClientProductPivotTable year={parseInt(selectedYear)} months={selectedMonths} />
            ) : (
              <ClientCumulativeTable year={parseInt(selectedYear)} months={selectedMonths} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
