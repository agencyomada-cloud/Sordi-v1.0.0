import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, MultiSelect, DesktopSegmentedControl } from "@sordi/ui";
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
    <main className="flex-1 min-w-0 p-6">
          <div className="max-w-[1600px] mx-auto space-y-5">
            <div className="h-9 mb-3 flex items-center justify-between gap-3 relative z-30">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">Analyses & Rapports</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
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
                  className="w-56 h-[30px] text-xs"
                />
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-24 h-[30px] text-xs rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DesktopSegmentedControl
                  options={[
                    { value: "pivot", label: "Analyse par Produit" },
                    { value: "client", label: "Rapport Global Clients" },
                  ]}
                  value={view}
                  onChange={(v) => setView(v as 'pivot' | 'client')}
                />
              </div>
            </div>

            {view === 'pivot' ? (
              <ClientProductPivotTable year={parseInt(selectedYear)} months={selectedMonths} />
            ) : (
              <ClientCumulativeTable year={parseInt(selectedYear)} months={selectedMonths} />
            )}
          </div>
    </main>
  );
}
