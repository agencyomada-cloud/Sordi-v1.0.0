import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  RiAddLine as Plus,
  RiPieChartLine as PieChartIcon,
  RiHandCoinLine as WalletIcon,
  RiWallet3Line as RemainingIcon,
  RiMoneyDollarCircleLine as ProfitIcon,
  RiHistoryLine as HistoryIcon,
  RiPencilLine as EditIcon,
  RiDeleteBinLine as Trash2,
  RiFileChart2Line as ReportIcon,
} from "@remixicon/react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  StatusBadge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  EmptyState,
  Skeleton,
  Switch,
} from "@sordi/ui";
import { MetricStrip, MetricTrendBadge } from "@/components/ui/metric-strip";
import { DatePicker } from "@/components/ui/date-picker";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useSettings } from "@/hooks/useSettings";
import {
  usePartners,
  usePartnerWithdrawals,
  useCreatePartner,
  useUpdatePartner,
  useDeletePartner,
  useRecordPartnerWithdrawal,
  useDeletePartnerWithdrawal,
} from "@/hooks/usePartners";
import { db } from "@/lib/database";
import type { PartnerFinancials } from "@/lib/database";
import { generateMonthlyReportPDF } from "@/lib/pdfGenerator";
import { useWorkspace } from "@/hooks/useWorkspace";

const SEGMENT_COLORS = ["bg-primary", "bg-blue-500", "bg-purple-500", "bg-amber-500", "bg-emerald-500", "bg-rose-500"];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(amount) + " DA";

const REPORT_MONTHS = [
  { value: "1", label: "Janvier" }, { value: "2", label: "Février" }, { value: "3", label: "Mars" },
  { value: "4", label: "Avril" }, { value: "5", label: "Mai" }, { value: "6", label: "Juin" },
  { value: "7", label: "Juillet" }, { value: "8", label: "Août" }, { value: "9", label: "Septembre" },
  { value: "10", label: "Octobre" }, { value: "11", label: "Novembre" }, { value: "12", label: "Décembre" },
];

const EMPTY_PARTNER_FORM = { name: "", email: "", phone: "", role: "", equity_percentage: "", is_active: true };
const EMPTY_WITHDRAWAL_FORM = {
  partner_id: "",
  withdrawal_date: new Date().toISOString().split("T")[0],
  amount: "",
  payment_method: "Virement",
  notes: "",
};

const Partners = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const yearOptions = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  const { data: partners, isLoading } = usePartners(parseInt(selectedYear));
  const { data: netProfitStats } = useDashboardStats(parseInt(selectedYear));
  const { data: settings } = useSettings();
  const { activeCompanyId } = useWorkspace();

  const createPartner = useCreatePartner();
  const updatePartner = useUpdatePartner();
  const deletePartner = useDeletePartner();
  const recordWithdrawal = useRecordPartnerWithdrawal();
  const deleteWithdrawal = useDeletePartnerWithdrawal();

  // Rapport Mensuel d'Activité & Clôture — the month is its own selector
  // (independent of the page's yearly capital-distribution filter below),
  // but the year now follows selectedYear so the top header doesn't need
  // a second year dropdown for the same concept.
  const [reportMonth, setReportMonth] = useState((new Date().getMonth() + 1).toString());
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const handleGenerateMonthlyReport = async () => {
    setIsGeneratingReport(true);
    try {
      const report = await db.partners.getMonthlyReport(activeCompanyId, parseInt(selectedYear), parseInt(reportMonth));
      // generateMonthlyReportPDF shows its own success toast (with the saved
      // path) once the native save dialog resolves. A null result means the
      // user cancelled that dialog — a clean abort, not an error.
      await generateMonthlyReportPDF(report, settings);
    } catch (error) {
      console.error("Erreur génération rapport mensuel:", error);
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la génération du rapport mensuel");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerFinancials | null>(null);
  const [partnerForm, setPartnerForm] = useState(EMPTY_PARTNER_FORM);

  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState(EMPTY_WITHDRAWAL_FORM);

  const [historyPartner, setHistoryPartner] = useState<PartnerFinancials | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartnerFinancials | null>(null);

  const { data: withdrawalHistory, isLoading: isHistoryLoading } = usePartnerWithdrawals(historyPartner?.id);

  const netProfitPeriod = netProfitStats?.netProfitHt || 0;
  const totalWithdrawn = useMemo(() => (partners || []).reduce((s, p) => s + p.total_withdrawn, 0), [partners]);
  const totalRemaining = useMemo(() => (partners || []).reduce((s, p) => s + p.remaining_balance, 0), [partners]);
  const totalEquity = useMemo(() => (partners || []).reduce((s, p) => s + p.equity_percentage, 0), [partners]);

  const openCreateDialog = () => {
    setEditingPartner(null);
    setPartnerForm(EMPTY_PARTNER_FORM);
    setPartnerDialogOpen(true);
  };

  const openEditDialog = (partner: PartnerFinancials) => {
    setEditingPartner(partner);
    setPartnerForm({
      name: partner.name,
      email: partner.email || "",
      phone: partner.phone || "",
      role: partner.role || "",
      equity_percentage: partner.equity_percentage.toString(),
      is_active: partner.is_active,
    });
    setPartnerDialogOpen(true);
  };

  // Client-side heads-up before hitting the backend's own 100% cap check —
  // the partners list already carries every current percentage.
  const otherPartnersTotal = (partners || [])
    .filter((p) => p.is_active && p.id !== editingPartner?.id)
    .reduce((s, p) => s + p.equity_percentage, 0);
  const availableEquity = Math.max(0, 100 - otherPartnersTotal);

  const handleSubmitPartner = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: partnerForm.name,
      email: partnerForm.email || undefined,
      phone: partnerForm.phone || undefined,
      role: partnerForm.role || undefined,
      equity_percentage: parseFloat(partnerForm.equity_percentage) || 0,
    };
    if (editingPartner) {
      updatePartner.mutate(
        { id: editingPartner.id, data: { ...data, is_active: partnerForm.is_active } },
        { onSuccess: () => setPartnerDialogOpen(false) }
      );
    } else {
      createPartner.mutate(data, { onSuccess: () => setPartnerDialogOpen(false) });
    }
  };

  const openWithdrawalDialog = (partnerId?: string) => {
    setWithdrawalForm({ ...EMPTY_WITHDRAWAL_FORM, partner_id: partnerId || partners?.[0]?.id || "" });
    setWithdrawalDialogOpen(true);
  };

  const handleSubmitWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    recordWithdrawal.mutate(
      {
        partner_id: withdrawalForm.partner_id,
        withdrawal_date: withdrawalForm.withdrawal_date,
        amount: parseFloat(withdrawalForm.amount) || 0,
        payment_method: withdrawalForm.payment_method || undefined,
        notes: withdrawalForm.notes || undefined,
      },
      { onSuccess: () => setWithdrawalDialogOpen(false) }
    );
  };

  const handleDeletePartner = () => {
    if (!deleteTarget) return;
    deletePartner.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  return (
    <main className="flex-1 p-6">
      <div className="max-w-[1600px] mx-auto w-full space-y-5">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Associés &amp; Répartition des Bénéfices</h1>
            <p className="text-sm text-muted-foreground mt-1">Gérez la structure du capital et les prélèvements des associés</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-24 h-[30px] text-xs rounded-md">
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

            <Select value={reportMonth} onValueChange={setReportMonth}>
              <SelectTrigger className="w-28 h-[30px] text-xs rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleGenerateMonthlyReport} disabled={isGeneratingReport} variant="outline" size="sm" className="h-[30px] text-xs rounded-md gap-1.5">
              <ReportIcon className="w-3.5 h-3.5" />
              {isGeneratingReport ? "Génération..." : "Générer Rapport Mensuel (PDF)"}
            </Button>

            <Button onClick={() => openWithdrawalDialog()} variant="outline" size="sm" disabled={!partners?.length} className="h-[30px] text-xs rounded-md gap-1.5">
              <WalletIcon className="w-3.5 h-3.5" />
              Enregistrer un prélèvement
            </Button>

            <Button onClick={openCreateDialog} size="sm" className="h-[30px] text-xs rounded-md gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Ajouter un associé
            </Button>
          </div>
        </div>

        {/* KPI strip — shared MetricStrip component. "Capital Total" reads
            as the period's net profit (the pool actually being split among
            partners) since equity_percentage is the only capital-shaped
            field the data model has — there's no separate invested-capital
            amount to report. */}
        <div>
          <MetricStrip
            cells={[
              { key: "capital", label: "Capital Total (Exercice)", value: formatCurrency(netProfitPeriod), numericValue: netProfitPeriod, format: formatCurrency, icon: ProfitIcon, sublabel: `Exercice ${selectedYear}` },
              { key: "active_parts", label: "Parts Actives", value: String((partners ?? []).filter((p) => p.is_active).length), numericValue: (partners ?? []).filter((p) => p.is_active).length, format: (v) => String(Math.round(v)), icon: PieChartIcon, sublabel: `${totalEquity.toFixed(1)}% du capital attribué` },
              { key: "withdrawn", label: "Total Prélevé", value: formatCurrency(totalWithdrawn), numericValue: totalWithdrawn, format: formatCurrency, icon: WalletIcon },
              {
                key: "remaining",
                label: "Solde Restant à Distribuer",
                value: formatCurrency(totalRemaining),
                numericValue: totalRemaining,
                format: formatCurrency,
                icon: RemainingIcon,
                trend: <MetricTrendBadge good={totalRemaining >= 0}>{totalRemaining >= 0 ? "Disponible" : "Dépassement"}</MetricTrendBadge>,
              },
            ]}
          />
        </div>

        {/* Capital Distribution Panel */}
        <div className="border border-border/80 rounded-md bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 shrink-0">
              <PieChartIcon className="w-4 h-4 text-primary" />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Répartition du Capital</p>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden flex">
            {(partners || []).map((p, idx) => (
              <div
                key={p.id}
                className={`h-full ${SEGMENT_COLORS[idx % SEGMENT_COLORS.length]} ${p.is_active ? "" : "opacity-30"}`}
                style={{ width: `${p.equity_percentage}%` }}
                title={`${p.name} — ${p.equity_percentage}%`}
              />
            ))}
            {totalEquity < 100 && <div className="h-full bg-transparent" style={{ width: `${100 - totalEquity}%` }} />}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
            {(partners || []).map((p, idx) => (
              <span key={p.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`w-2 h-2 rounded-full shrink-0 ${SEGMENT_COLORS[idx % SEGMENT_COLORS.length]}`} />
                {p.name} <span className="font-mono tabular-nums text-foreground font-medium">{p.equity_percentage}%</span>
              </span>
            ))}
            {totalEquity < 100 && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                <span className="w-2 h-2 rounded-full shrink-0 bg-border" />
                Réserve non distribuée <span className="font-mono tabular-nums text-foreground font-medium">{(100 - totalEquity).toFixed(1)}%</span>
              </span>
            )}
          </div>
        </div>

        {/* Partners Ledger */}
        {isLoading ? (
          <div className="border border-border/80 rounded-md bg-card overflow-hidden w-full">
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TableHead key={i}><Skeleton className="h-3 w-16" /></TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : !partners?.length ? (
          <div className="bg-card rounded-md border border-border/80">
            <EmptyState
              title="Aucun associé"
              description="Ajoutez les associés de l'entreprise pour suivre la répartition des bénéfices"
              icon={PieChartIcon}
              action={{ label: "Ajouter un associé", onClick: openCreateDialog }}
            />
          </div>
        ) : (
          <div className="border border-border/80 rounded-md bg-card overflow-hidden w-full">
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow className="h-8 bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Nom</TableHead>
                  <TableHead numeric className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Parts %</TableHead>
                  <TableHead numeric className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Part Théorique</TableHead>
                  <TableHead numeric className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Prélèvements Réalisés</TableHead>
                  <TableHead numeric className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Dividendes Disponibles</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Statut</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase px-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner) => {
                  const balancePositive = partner.remaining_balance >= 0;
                  const settled = Math.abs(partner.remaining_balance) < 1;
                  return (
                    <TableRow
                      key={partner.id}
                      className={`h-8 text-xs border-b border-border/30 hover:bg-muted/20 transition-colors ${!partner.is_active ? "opacity-50" : ""}`}
                    >
                      <TableCell className="font-medium px-3">{partner.name}</TableCell>
                      <TableCell numeric className="font-mono tabular-nums font-medium px-3">{partner.equity_percentage}%</TableCell>
                      <TableCell numeric className="font-mono tabular-nums font-medium px-3">{formatCurrency(partner.allocated_profit)}</TableCell>
                      <TableCell numeric className="font-mono tabular-nums font-medium text-destructive px-3">{formatCurrency(partner.total_withdrawn)}</TableCell>
                      <TableCell numeric className="font-mono tabular-nums font-semibold text-primary px-3">{formatCurrency(partner.remaining_balance)}</TableCell>
                      <TableCell className="px-3">
                        {!partner.is_active ? (
                          <StatusBadge tone="neutral">Inactif</StatusBadge>
                        ) : (
                          <StatusBadge tone={settled ? "neutral" : balancePositive ? "success" : "error"}>
                            {settled ? "Soldé" : balancePositive ? "Créditeur" : "Débiteur"}
                          </StatusBadge>
                        )}
                      </TableCell>
                      <TableCell className="px-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Enregistrer un prélèvement" onClick={() => openWithdrawalDialog(partner.id)}>
                            <WalletIcon className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Historique" onClick={() => setHistoryPartner(partner)}>
                            <HistoryIcon className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Modifier" onClick={() => openEditDialog(partner)}>
                            <EditIcon className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title="Supprimer" onClick={() => setDeleteTarget(partner)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Add / Edit partner dialog */}
        <Dialog open={partnerDialogOpen} onOpenChange={setPartnerDialogOpen}>
          <DialogContent className="max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle>{editingPartner ? "Modifier l'associé" : "Ajouter un associé"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitPartner} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Nom complet *</Label>
                  <Input
                    value={partnerForm.name}
                    onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                    required
                    className="mt-1.5 h-8 text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Rôle</Label>
                  <Input
                    placeholder="Ex: Gérant associé, Associé non gérant..."
                    value={partnerForm.role}
                    onChange={(e) => setPartnerForm({ ...partnerForm, role: e.target.value })}
                    className="mt-1.5 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    value={partnerForm.email}
                    onChange={(e) => setPartnerForm({ ...partnerForm, email: e.target.value })}
                    className="mt-1.5 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Téléphone</Label>
                  <Input
                    value={partnerForm.phone}
                    onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                    className="mt-1.5 h-8 text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Part de capital (%) *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={partnerForm.equity_percentage}
                    onChange={(e) => setPartnerForm({ ...partnerForm, equity_percentage: e.target.value })}
                    required
                    className="mt-1.5 h-8 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {availableEquity.toFixed(1)}% disponible parmi les associés actifs
                  </p>
                </div>
              </div>
              {editingPartner && (
                <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                  <Label className="text-xs">Associé actif</Label>
                  <Switch
                    checked={partnerForm.is_active}
                    onCheckedChange={(checked) => setPartnerForm({ ...partnerForm, is_active: checked })}
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs rounded-md" onClick={() => setPartnerDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" size="sm" className="h-8 px-3 text-xs rounded-md" disabled={createPartner.isPending || updatePartner.isPending}>
                  {createPartner.isPending || updatePartner.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Record withdrawal dialog */}
        <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
          <DialogContent className="max-w-md rounded-xl border border-border/80 shadow-2xl p-5">
            <DialogHeader>
              <DialogTitle>Enregistrer un prélèvement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitWithdrawal} className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Associé *</Label>
                <Select
                  value={withdrawalForm.partner_id}
                  onValueChange={(v) => setWithdrawalForm({ ...withdrawalForm, partner_id: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Sélectionner un associé" />
                  </SelectTrigger>
                  <SelectContent>
                    {(partners || []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Date *</Label>
                  <DatePicker
                    value={withdrawalForm.withdrawal_date}
                    onChange={(v) => setWithdrawalForm({ ...withdrawalForm, withdrawal_date: v })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Montant (DA) *</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={withdrawalForm.amount}
                    onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                    required
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Mode de paiement</Label>
                <Select
                  value={withdrawalForm.payment_method}
                  onValueChange={(v) => setWithdrawalForm({ ...withdrawalForm, payment_method: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Virement">Virement</SelectItem>
                    <SelectItem value="Espèces">Espèces</SelectItem>
                    <SelectItem value="Chèque">Chèque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Notes / Référence</Label>
                <Textarea
                  placeholder="Notes additionnelles..."
                  value={withdrawalForm.notes}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, notes: e.target.value })}
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setWithdrawalDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={recordWithdrawal.isPending || !withdrawalForm.partner_id}>
                  {recordWithdrawal.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Withdrawal history dialog */}
        <Dialog open={!!historyPartner} onOpenChange={(open) => !open && setHistoryPartner(null)}>
          <DialogContent className="max-w-lg rounded-xl border border-border/80 shadow-2xl p-5">
            <DialogHeader>
              <DialogTitle>Historique des retraits — {historyPartner?.name}</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
              {isHistoryLoading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-4 py-3">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <Skeleton className="w-7 h-7 rounded-md shrink-0" />
                  </div>
                ))
              ) : !withdrawalHistory?.length ? (
                <EmptyState type="partners" title="Aucun prélèvement" description="Aucun retrait n'a encore été enregistré pour cet associé" className="py-8" />
              ) : (
                withdrawalHistory.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-mono font-medium tabular-nums tracking-tight">{formatCurrency(w.amount)}</p>
                      <p
                        className="text-xs text-muted-foreground truncate"
                        title={[
                          new Date(w.withdrawal_date).toLocaleDateString("fr-FR"),
                          w.payment_method ?? "",
                          w.notes ?? "",
                        ].filter(Boolean).join(" · ")}
                      >
                        {new Date(w.withdrawal_date).toLocaleDateString("fr-FR")}
                        {w.payment_method ? ` · ${w.payment_method}` : ""}
                        {w.notes ? ` · ${w.notes}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteWithdrawal.mutate(w.id)}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-all shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setHistoryPartner(null)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete partner confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cet associé ?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.name} sera supprimé ainsi que tout son historique de prélèvements. Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeletePartner} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  );
};

export default Partners;
