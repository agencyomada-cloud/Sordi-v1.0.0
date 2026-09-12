import { Card, CardContent } from "@sordi/ui";
import {
  RiDownloadLine as InstallsIcon,
  RiTimeLine as TrialIcon,
  RiVipCrownLine as PaidIcon,
  RiFileTextLine as InvoiceIcon,
} from "@remixicon/react";
import type { DeviceRow } from "@/lib/adminApi";

interface KpiCardsProps {
  devices: DeviceRow[];
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  tone: "default" | "warning" | "success" | "primary";
}) {
  const toneClasses = {
    default: "bg-muted text-muted-foreground",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    primary: "bg-primary/10 text-primary",
  }[tone];

  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${toneClasses}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Computed client-side from the currently loaded device rows — this admin
 *  portal has no dedicated aggregate endpoint yet, and the device list is
 *  small enough (an internal tool, not a customer-facing analytics product)
 *  that recomputing on every fetch is simpler than maintaining a second
 *  server-side rollup that could drift from the list it's summarizing. */
export function KpiCards({ devices }: KpiCardsProps) {
  const totalInstalls = devices.length;
  const activeTrials = devices.filter((d) => d.effectiveStatus === "trial").length;
  const paidCustomers = devices.filter((d) => d.effectiveStatus === "active").length;
  const totalInvoices = devices.reduce((sum, d) => sum + d.invoicesCount, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard icon={InstallsIcon} label="Installations totales" value={totalInstalls} tone="default" />
      <KpiCard icon={TrialIcon} label="Essais actifs" value={activeTrials} tone="warning" />
      <KpiCard icon={PaidIcon} label="Clients payants" value={paidCustomers} tone="success" />
      <KpiCard icon={InvoiceIcon} label="Factures générées" value={totalInvoices} tone="primary" />
    </div>
  );
}
