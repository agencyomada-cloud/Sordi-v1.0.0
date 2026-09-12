import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RiArrowDownSLine as ChevronDown,
  RiArrowRightSLine as ChevronRight,
  RiMailSendLine as SendIcon,
  RiErrorWarningLine as AlertCircle,
  RiMoneyDollarCircleLine as TotalDueIcon,
  RiGroupLine as ClientsIcon,
  RiTimeLine as AvgDelayIcon,
  RiCalendarEventLine as OldestIcon,
} from "@remixicon/react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableLoading,
  EmptyState,
  DesktopSegmentedControl,
} from "@sordi/ui";
import { MetricStrip } from "@/components/ui/metric-strip";
import { FacetedSearchInput, type SearchFacet } from "@/components/common/FacetedSearchInput";
import { SendDocumentEmailModal } from "@/components/email/SendDocumentEmailModal";
import { cn } from "@/lib/utils";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { useSettings } from "@/hooks/useSettings";
import { useLicenseStatus } from "@/hooks/useLicense";
import { db } from "@/lib/database";
import { generateInvoicePDFBlob, blobToBase64 } from "@/lib/pdfGenerator";
import { INVOICE_STATUS_PILL_BASE, INVOICE_STATUS_PILL_CLASSES, INVOICE_STATUS_DOT_CLASSES, getInvoiceStatusConfig } from "@/lib/invoiceStatus";
import type { DunningStage, DraftInvoiceInput } from "@/lib/emailDrafter";

type BucketKey = "all" | "not-due" | "1-30" | "31-60" | "61-90" | "90+";

const BUCKETS: { key: BucketKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "not-due", label: "À échoir (< 0j)" },
  { key: "1-30", label: "1 - 30j" },
  { key: "31-60", label: "31 - 60j" },
  { key: "61-90", label: "61 - 90j" },
  { key: "90+", label: "+90j" },
];

function bucketFor(daysOverdue: number): BucketKey {
  if (daysOverdue <= 0) return "not-due";
  if (daysOverdue <= 30) return "1-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

function dunningStageFor(daysOverdue: number): DunningStage {
  if (daysOverdue <= 30) return "reminder";
  if (daysOverdue <= 60) return "second-reminder";
  return "formal-notice";
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD" }).format(amount);

const formatDate = (date: string | null) => {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

interface OverdueInvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_ttc: number;
  balance_due: number;
  status: string;
  daysOverdue: number;
}

interface ClientGroup {
  clientId: string;
  clientName: string;
  wilaya: string | null;
  clientEmail: string | null;
  invoices: OverdueInvoiceRow[];
  totalOverdue: number;
  oldestDaysOverdue: number;
  oldestDueDate: string;
}

export default function Relances() {
  const navigate = useNavigate();
  const { data: allInvoices, isLoading, isError, refetch } = useInvoices();
  const { data: clients } = useClients();
  const { data: settings } = useSettings();
  const { data: licenseStatus } = useLicenseStatus();

  const [activeBucket, setActiveBucket] = useState<BucketKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFacets, setSearchFacets] = useState<SearchFacet[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [relanceTarget, setRelanceTarget] = useState<{ group: ClientGroup; invoice: OverdueInvoiceRow } | null>(null);

  const wilayaByClientId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const c of clients ?? []) map.set(c.id, c.wilaya);
    return map;
  }, [clients]);

  const emailByClientId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const c of clients ?? []) map.set(c.id, c.email);
    return map;
  }, [clients]);

  const today = new Date().toISOString().slice(0, 10);

  // Every unpaid, real (non-draft/cancelled/credit-note) invoice, with its
  // days-overdue computed from due_date — the same "real overdue" logic
  // Index.tsx's receivablesList and useSidebarCounts' relances badge use,
  // not the (sometimes stale) literal `status` column.
  const unpaidInvoices: OverdueInvoiceRow[] = useMemo(() => {
    return (allInvoices ?? [])
      .filter(
        (inv: any) =>
          inv.invoice_type === "invoice" &&
          inv.status !== "cancelled" &&
          inv.status !== "draft" &&
          (inv.balance_due || 0) > 0 &&
          !!inv.due_date
      )
      .map((inv: any) => {
        const due = new Date(inv.due_date);
        const daysOverdue = Math.floor((Date.now() - due.getTime()) / 86_400_000);
        return {
          id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          due_date: inv.due_date,
          total_ttc: inv.total_ttc || 0,
          balance_due: inv.balance_due || 0,
          status: inv.status,
          daysOverdue,
          client_id: inv.client_id,
          clientName: inv.clients?.name || "Client inconnu",
        } as OverdueInvoiceRow & { client_id: string; clientName: string };
      });
  }, [allInvoices, today]);

  // Fixed KPI ribbon — the real (strictly overdue, daysOverdue > 0) picture,
  // unaffected by the bucket tab or search below, same "always-on north
  // star" convention Invoices.tsx uses for its own metric strip.
  const overdueOnly = useMemo(() => unpaidInvoices.filter((i) => i.daysOverdue > 0), [unpaidInvoices]);
  const totalEchu = useMemo(() => overdueOnly.reduce((sum, i) => sum + i.balance_due, 0), [overdueOnly]);
  const clientsARelancer = useMemo(
    () => new Set(overdueOnly.map((i: any) => i.client_id)).size,
    [overdueOnly]
  );
  const retardMoyen = useMemo(() => {
    if (overdueOnly.length === 0) return 0;
    return Math.round(overdueOnly.reduce((sum, i) => sum + i.daysOverdue, 0) / overdueOnly.length);
  }, [overdueOnly]);
  const plusAncienneCreance = useMemo(() => {
    if (overdueOnly.length === 0) return null;
    return overdueOnly.reduce((oldest, i) => (i.due_date < oldest ? i.due_date : oldest), overdueOnly[0].due_date);
  }, [overdueOnly]);

  // Bucket + search filter, then group by client.
  const clientGroups: ClientGroup[] = useMemo(() => {
    const bucketed = (unpaidInvoices as (OverdueInvoiceRow & { client_id: string; clientName: string })[]).filter((inv) =>
      activeBucket === "all" ? true : bucketFor(inv.daysOverdue) === activeBucket
    );

    const q = searchQuery.trim().toLowerCase();
    const filtered = bucketed.filter((inv) => {
      const matchesQuery =
        !q || inv.invoice_number.toLowerCase().includes(q) || inv.clientName.toLowerCase().includes(q);
      const matchesFacets = searchFacets.every((facet) => {
        if (facet.field === "number") return inv.invoice_number.toLowerCase().includes(facet.value.toLowerCase());
        if (facet.field === "client") return inv.clientName.toLowerCase().includes(facet.value.toLowerCase());
        return true;
      });
      return matchesQuery && matchesFacets;
    });

    const map = new Map<string, ClientGroup>();
    for (const inv of filtered) {
      let group = map.get(inv.client_id);
      if (!group) {
        group = {
          clientId: inv.client_id,
          clientName: inv.clientName,
          wilaya: wilayaByClientId.get(inv.client_id) ?? null,
          clientEmail: emailByClientId.get(inv.client_id) ?? null,
          invoices: [],
          totalOverdue: 0,
          oldestDaysOverdue: -Infinity,
          oldestDueDate: inv.due_date,
        };
        map.set(inv.client_id, group);
      }
      group.invoices.push(inv);
      group.totalOverdue += inv.balance_due;
      if (inv.daysOverdue > group.oldestDaysOverdue) {
        group.oldestDaysOverdue = inv.daysOverdue;
        group.oldestDueDate = inv.due_date;
      }
    }
    // Most overdue client first — that's who actually needs a relance today.
    return Array.from(map.values()).sort((a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue);
  }, [unpaidInvoices, activeBucket, searchQuery, searchFacets, wilayaByClientId, emailByClientId]);

  const toggleGroupCollapsed = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openRelance = (group: ClientGroup) => {
    // Represent the client's whole balance with their single most-overdue
    // invoice — SendDocumentEmailModal is a one-document-at-a-time
    // composer, so that invoice's PDF is what gets attached, while the
    // dunning copy itself (emailDrafter.ts) still mentions the client's
    // total outstanding across every invoice in this group.
    const oldest = group.invoices.reduce((a, b) => (b.daysOverdue > a.daysOverdue ? b : a), group.invoices[0]);
    setRelanceTarget({ group, invoice: oldest });
  };

  const relanceDraftInput: DraftInvoiceInput | null = useMemo(() => {
    if (!relanceTarget) return null;
    const { group, invoice } = relanceTarget;
    return {
      docType: "invoice",
      documentNumber: invoice.invoice_number,
      clientName: group.clientName,
      documentDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      totalTTC: invoice.total_ttc,
      balanceDue: invoice.balance_due,
      senderCompany: settings?.company_name || "Sordi",
      bankRib: settings?.company_rib || null,
      bankAgency: settings?.company_bank_agency || null,
      items: [],
      dunningStage: dunningStageFor(invoice.daysOverdue),
      daysOverdue: invoice.daysOverdue,
      outstandingCount: group.invoices.length,
      outstandingTotal: group.totalOverdue,
    };
  }, [relanceTarget, settings]);

  const isLicensed = licenseStatus?.state === "active";

  return (
    <main className="flex-1 p-8 pt-4 min-w-0">
      <div className="max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 animate-fade-in-down">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Relances & Balance Âgée</h1>
            <p className="text-xs text-slate-500 mt-1">Suivi et relances des créances échues</p>
          </div>
        </div>

        {/* Metric strip */}
        <div className="mb-6 animate-fade-in-up animation-delay-100">
          <MetricStrip
            cells={[
              { key: "total-echu", label: "Total Échu", value: formatCurrency(totalEchu), numericValue: totalEchu, format: formatCurrency, icon: TotalDueIcon },
              { key: "clients", label: "Clients à Relancer", value: String(clientsARelancer), numericValue: clientsARelancer, format: (v) => String(Math.round(v)), icon: ClientsIcon },
              { key: "retard-moyen", label: "Retard Moyen", value: `${retardMoyen} j`, numericValue: retardMoyen, format: (v) => `${Math.round(v)} j`, icon: AvgDelayIcon },
              { key: "plus-ancienne", label: "Plus Ancienne Créance", value: plusAncienneCreance ? formatDate(plusAncienneCreance) : "—", icon: OldestIcon },
            ]}
          />
        </div>

        {/* Bucket tabs and search */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-border/40 animate-fade-in-up animation-delay-150">
          <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
            <DesktopSegmentedControl
              className="h-[30px]"
              options={BUCKETS.map((b) => ({ value: b.key, label: b.label }))}
              value={activeBucket}
              onChange={(value) => setActiveBucket(value as BucketKey)}
            />
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end max-w-xl">
            <div className="w-64 min-w-[200px] max-w-[280px]">
              <FacetedSearchInput
                query={searchQuery}
                onQueryChange={setSearchQuery}
                facets={searchFacets}
                onFacetsChange={setSearchFacets}
                placeholder="Rechercher client ou N° facture..."
                fieldLabels={{ number: "N° Facture", client: "Client" }}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="mt-2 border border-border/60 rounded-md overflow-hidden animate-fade-in-up animation-delay-200">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent h-8 bg-muted/40">
                <TableHead>N°</TableHead>
                <TableHead className="hidden md:table-cell">Émission</TableHead>
                <TableHead className="hidden md:table-cell">Échéance</TableHead>
                <TableHead numeric>Retard</TableHead>
                <TableHead numeric>Total TTC</TableHead>
                <TableHead numeric>Reste à Payer</TableHead>
                <TableHead className="hidden sm:table-cell">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoading columns={7} rows={5} />
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      icon={AlertCircle}
                      tone="destructive"
                      title="Échec du chargement des données"
                      description="Une erreur est survenue lors du chargement des créances."
                      action={{ label: "Réessayer", onClick: () => refetch() }}
                    />
                  </TableCell>
                </TableRow>
              ) : clientGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      icon={SendIcon}
                      title="Aucune créance"
                      description={
                        searchQuery || searchFacets.length > 0
                          ? "Essayez une autre recherche"
                          : "Aucune facture en attente de règlement pour ce filtre"
                      }
                      action={
                        searchQuery || searchFacets.length > 0
                          ? { label: "Effacer la recherche", onClick: () => { setSearchQuery(""); setSearchFacets([]); } }
                          : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                clientGroups.map((group) => {
                  const collapsed = collapsedGroups.has(group.clientId);
                  const oldestOverdue = group.oldestDaysOverdue > 0;
                  return (
                    <Fragment key={group.clientId}>
                      <TableRow className="h-11 bg-muted/40 hover:bg-muted/50 border-y border-border/40">
                        <TableCell colSpan={7} className="p-0">
                          <div className="w-full h-11 px-3 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => toggleGroupCollapsed(group.clientId)}
                              className="flex items-center gap-2 min-w-0 text-left flex-1"
                            >
                              {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                              <span className="font-semibold text-xs truncate">{group.clientName}</span>
                              {group.wilaya && (
                                <span className="text-[11px] text-muted-foreground truncate hidden md:inline">{group.wilaya}</span>
                              )}
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0",
                                  oldestOverdue
                                    ? "bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
                                    : "bg-slate-100 text-slate-600 border border-slate-200/60 dark:bg-slate-800/60 dark:text-slate-300"
                                )}
                              >
                                {oldestOverdue ? `${group.oldestDaysOverdue}j de retard` : "À échoir"}
                              </span>
                              <span className="font-mono tabular-nums text-xs font-semibold shrink-0">
                                {formatCurrency(group.totalOverdue)}
                              </span>
                            </button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs font-medium gap-1.5 rounded-md shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRelance(group);
                              }}
                            >
                              <SendIcon className="w-3.5 h-3.5" />
                              Envoyer Relance
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {!collapsed &&
                        group.invoices
                          .sort((a, b) => b.daysOverdue - a.daysOverdue)
                          .map((invoice) => {
                            const statusConfig = getInvoiceStatusConfig(invoice.status);
                            return (
                              <TableRow
                                key={invoice.id}
                                className="h-9 cursor-pointer hover:bg-muted/20"
                                onClick={() => navigate(`/invoices/${invoice.id}`)}
                              >
                                <TableCell className="font-mono text-xs">{invoice.invoice_number}</TableCell>
                                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{formatDate(invoice.invoice_date)}</TableCell>
                                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{formatDate(invoice.due_date)}</TableCell>
                                <TableCell numeric className={cn("text-xs font-mono tabular-nums", invoice.daysOverdue > 0 ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-muted-foreground")}>
                                  {invoice.daysOverdue > 0 ? `${invoice.daysOverdue}j` : "—"}
                                </TableCell>
                                <TableCell numeric className="font-mono text-xs whitespace-nowrap">{formatCurrency(invoice.total_ttc)}</TableCell>
                                <TableCell numeric className="font-mono text-xs whitespace-nowrap font-semibold">{formatCurrency(invoice.balance_due)}</TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  <span className={cn(INVOICE_STATUS_PILL_BASE, INVOICE_STATUS_PILL_CLASSES[statusConfig.variant])}>
                                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", INVOICE_STATUS_DOT_CLASSES[statusConfig.variant])} />
                                    {statusConfig.label}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {relanceDraftInput && (
        <SendDocumentEmailModal
          open={!!relanceTarget}
          onOpenChange={(open) => { if (!open) setRelanceTarget(null); }}
          recipientEmail={relanceTarget?.group.clientEmail}
          fileName={`Facture-${relanceTarget?.invoice.invoice_number || "000"}.pdf`}
          draftInput={relanceDraftInput}
          getPdfBase64={async () => {
            const id = relanceTarget!.invoice.id;
            const [fullInvoice, items] = await Promise.all([
              db.invoices.getById(id),
              db.invoices.getItems(id),
            ]);
            if (!fullInvoice) throw new Error("Facture introuvable");
            const client = await db.clients.getById(fullInvoice.client_id);
            const blob = await generateInvoicePDFBlob(
              { ...fullInvoice, invoice_items: items, clients: client ? { name: client.name, email: client.email } : undefined },
              settings,
              isLicensed
            );
            return blobToBase64(blob);
          }}
        />
      )}
    </main>
  );
}
