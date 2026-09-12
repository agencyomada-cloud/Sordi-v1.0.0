import { RiArrowUpLine as UpIcon, RiArrowDownLine as DownIcon, RiFileTextLine as InvoiceIcon } from "@remixicon/react";

// `good: true` means this direction is a positive signal for the business
// (revenue/active clients up is good; unpaid invoices DOWN is good) — the
// arrow direction always matches the literal trend sign, but the color is
// driven by `good`, so a shrinking "Factures impayées" number reads as
// green-with-a-down-arrow, not a confusing green-with-an-up-arrow.
const KPI_CARDS = [
  { label: "Chiffre d'affaires", value: "2 480 500 DA", trend: "+12,4%", up: true, good: true },
  { label: "Factures impayées", value: "184 200 DA", trend: "-3,1%", up: false, good: true },
  { label: "Clients actifs", value: "47", trend: "+5", up: true, good: true },
];

const INVOICE_ROWS = [
  { number: "FA-2026-0142", client: "SARL Atlas Digital", amount: "156 800 DA", status: "Payée" },
  { number: "FA-2026-0141", client: "EURL Nomad Solutions", amount: "89 400 DA", status: "En attente" },
  { number: "FA-2026-0140", client: "SARL Kahina Trading", amount: "212 300 DA", status: "Payée" },
];

const STATUS_STYLE: Record<string, string> = {
  "Payée": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "En attente": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

/** Stylized, hand-built illustration of the desktop app's invoices
 *  dashboard — not a real screenshot (none exists yet, see Hero.tsx), but
 *  built from the same brand language (Scarlet primary accent, card-based
 *  KPI row, invoice table) so it reads as authentic rather than a generic
 *  stock mockup. Swap for a real screenshot the moment one exists. */
export function MockDashboardPreview() {
  return (
    <div className="p-5 sm:p-6 bg-slate-50 select-none">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Tableau de bord</p>
          <p className="text-sm font-semibold">Septembre 2026</p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <InvoiceIcon className="w-4 h-4 text-primary" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {KPI_CARDS.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border/50 bg-card px-3 py-2.5 text-left">
            <p className="text-[10px] text-muted-foreground truncate">{kpi.label}</p>
            <p className="text-sm font-semibold tabular-nums mt-0.5 truncate">{kpi.value}</p>
            <p
              className={`text-[10px] flex items-center gap-0.5 mt-0.5 ${
                kpi.good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {kpi.up ? <UpIcon className="w-2.5 h-2.5" /> : <DownIcon className="w-2.5 h-2.5" />}
              {kpi.trend}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
        <div className="px-3 py-2 border-b border-border/40 text-[11px] font-medium text-muted-foreground">
          Factures récentes
        </div>
        {INVOICE_ROWS.map((row) => (
          <div key={row.number} className="flex items-center justify-between px-3 py-2 border-b border-border/30 last:border-0 text-left">
            <div className="min-w-0">
              <p className="text-xs font-medium font-mono truncate">{row.number}</p>
              <p className="text-[11px] text-muted-foreground truncate">{row.client}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-xs tabular-nums font-medium">{row.amount}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[row.status]}`}>
                {row.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
