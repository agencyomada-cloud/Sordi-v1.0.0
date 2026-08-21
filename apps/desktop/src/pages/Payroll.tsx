import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  RiUploadCloud2Line as Upload,
  RiWalletLine as WalletIcon,
  RiErrorWarningLine as WarningIcon,
  RiTimeLine as PendingIcon,
  RiPlayLine as RunIcon,
  RiAddLine as Plus,
} from "@remixicon/react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Checkbox,
} from "@sordi/ui";
import { toast } from "sonner";
import { useEmployees } from "@/hooks/useEmployees";
import { usePayrollRuns, usePayrollDashboardStats, useUpdatePayrollPaid, useImportPunchRecords, useUnmappedDeviceCodes, useRunPayroll } from "@/hooks/usePayroll";
import { useFreelancePayments, useSetFreelancerPaymentStatus, useAssignFreelancePayment, useProjects } from "@/hooks/useProjects";
import { db, type PunchImportRow, type PayrollRun } from "@/lib/database";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD", minimumFractionDigits: 0 }).format(amount);

const currentMonth = new Date().toISOString().slice(0, 7);

/** Parses the ZKTeco-style TSV attlog export: tab-separated, no header,
 *  col1 = device employee ID, col2 = "YYYY-MM-DD HH:MM:SS" timestamp.
 *  Columns 3-6 (status/verify-mode/work-code/reserved) are ignored — the
 *  "any punch = present" logic only needs employee + timestamp. */
function parsePunchTsv(text: string): PunchImportRow[] {
  return text
    .split(/\r\n|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cols = line.split("\t");
      return { external_code: cols[0]?.trim() ?? "", punch_time: cols[1]?.trim() ?? "" };
    })
    .filter((row) => row.external_code && row.punch_time);
}

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"salaries" | "freelances">("salaries");
  const [month, setMonth] = useState(currentMonth);
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [paidFilter, setPaidFilter] = useState<string>("all");
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [isBulkRunning, setIsBulkRunning] = useState(false);

  const { data: employees } = useEmployees();
  const { data: dashboardStats } = usePayrollDashboardStats(month);
  const { data: runs, isLoading } = usePayrollRuns(
    employeeFilter === "all" ? undefined : employeeFilter,
    month === "all" ? undefined : month,
    paidFilter === "all" ? undefined : paidFilter === "paid"
  );
  // Unfiltered by employee/paid — used to check existing-run/paid state for
  // the generate actions below, independent of whatever the table filters are set to.
  const { data: monthRuns } = usePayrollRuns(undefined, month === "all" ? undefined : month, undefined);
  const updatePaid = useUpdatePayrollPaid();
  const importPunches = useImportPunchRecords();
  const runPayroll = useRunPayroll();
  const { data: unmappedCodes } = useUnmappedDeviceCodes();

  const employeeNameById = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e.name])), [employees]);

  const invalidateAfterBulkRun = () => {
    queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
    queryClient.invalidateQueries({ queryKey: ["payroll-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["employee-advances"] });
  };

  const handleBulkGenerate = async () => {
    const salariedEmployees = (employees ?? []).filter((e) => e.contract_type === "Temps plein");
    if (salariedEmployees.length === 0) {
      toast.error("Aucun employé Temps plein trouvé");
      return;
    }

    setIsBulkRunning(true);
    let generated = 0;
    let skippedNoSalary = 0;
    let skippedPaid = 0;
    let failed = 0;

    for (const emp of salariedEmployees) {
      const existingRun = monthRuns?.find((r) => r.employee_id === emp.id);
      if (existingRun?.paid) {
        skippedPaid++;
        continue;
      }
      if (emp.base_salary == null) {
        skippedNoSalary++;
        continue;
      }
      try {
        await db.payroll.run(emp.id, month);
        generated++;
      } catch {
        failed++;
      }
    }

    setIsBulkRunning(false);
    invalidateAfterBulkRun();

    const parts: string[] = [`${generated} bulletin${generated > 1 ? "s" : ""} généré${generated > 1 ? "s" : ""}`];
    if (skippedNoSalary > 0) parts.push(`${skippedNoSalary} ignoré${skippedNoSalary > 1 ? "s" : ""} (pas de salaire de base)`);
    if (skippedPaid > 0) parts.push(`${skippedPaid} déjà payé${skippedPaid > 1 ? "s" : ""} (ignoré${skippedPaid > 1 ? "s" : ""})`);
    if (failed > 0) parts.push(`${failed} échec${failed > 1 ? "s" : ""}`);

    if (generated > 0) {
      toast.success(`Bulletins générés pour ${month}`, { description: parts.slice(1).join(", ") || undefined });
    } else {
      toast.error(`Aucun bulletin généré pour ${month}`, { description: parts.slice(1).join(", ") || undefined });
    }
  };

  const singleEmployeeMonthRun =
    employeeFilter !== "all" ? monthRuns?.find((r) => r.employee_id === employeeFilter) : undefined;
  const showInlineGeneratePrompt = employeeFilter !== "all" && !singleEmployeeMonthRun;

  const monthOptions = useMemo(() => {
    const options: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push(d.toISOString().slice(0, 7));
    }
    return options;
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parsePunchTsv(text);
      if (rows.length === 0) {
        toast.error("Aucun pointage valide trouvé dans le fichier");
        return;
      }
      importPunches.mutate(rows);
    } catch (err) {
      toast.error("Erreur lors de la lecture du fichier");
      console.error(err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
        <main className="flex-1 p-8 pt-4">
          <div className="max-w-[1400px] mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Paie</h1>
                <p className="text-muted-foreground mt-1">Pointages, bulletins de paie et avances</p>
              </div>
              <div className="flex items-center gap-3">
                {activeTab === "salaries" && (
                  <>
                    <input type="file" ref={fileInputRef} onChange={handleImport} accept=".txt,.tsv,.dat" className="hidden" />
                    <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={importPunches.isPending}>
                      <Upload className="w-4 h-4" />
                      {importPunches.isPending ? "Import…" : "Importer les pointages"}
                    </Button>
                    <Button className="gap-2" onClick={handleBulkGenerate} disabled={isBulkRunning}>
                      <RunIcon className="w-4 h-4" />
                      {isBulkRunning ? "Génération…" : `Générer tous les bulletins (${month})`}
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-secondary/30 w-fit rounded-2xl border border-border/50 mb-6">
              {[
                { key: "salaries" as const, label: "Salariés" },
                { key: "freelances" as const, label: "Freelances" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-6 py-2.5 text-sm font-medium transition-all rounded-xl ${
                    activeTab === tab.key
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "freelances" ? (
              <FreelancesTab />
            ) : (
              <>
            {/* Manager dashboard — current filter month's summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Coût total de la paie ({month})</CardTitle>
                  <WalletIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{formatCurrency(dashboardStats?.total_payroll_cost ?? 0)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Employés en alerte absence</CardTitle>
                  <WarningIcon className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-destructive">{dashboardStats?.flagged_employee_count ?? 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Bulletins en attente de paiement</CardTitle>
                  <PendingIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{dashboardStats?.pending_payroll_count ?? 0}</div>
                </CardContent>
              </Card>
            </div>

            {/* Device codes seen in imported punches with no matching employee yet —
                assigning "Code appareil" on an employee's profile backfills them automatically. */}
            {unmappedCodes && unmappedCodes.length > 0 && (
              <Card className="mb-6 border-orange-200 dark:border-orange-900/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <WarningIcon className="h-4 w-4 text-orange-500" />
                    Codes appareil non assignés
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {unmappedCodes.map((c) => (
                      <Badge key={c.external_code} variant="warning" className="gap-1.5">
                        {c.external_code}
                        <span className="opacity-70 font-normal">
                          ({c.punch_count} pointage{c.punch_count > 1 ? "s" : ""})
                        </span>
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Assignez le "Code appareil" correspondant sur la fiche de l'employé pour rattacher automatiquement ces pointages.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Tous les employés" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les employés</SelectItem>
                  {employees?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={paidFilter} onValueChange={setPaidFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="paid">Payé</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showInlineGeneratePrompt && (
              <Card className="mb-4 border-primary/30 bg-primary/[0.03]">
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="text-sm">
                    <span className="font-medium">{employeeNameById.get(employeeFilter) ?? "Cet employé"}</span>
                    <span className="text-muted-foreground"> n'a pas encore de bulletin pour {month}.</span>
                  </div>
                  <Button
                    size="sm"
                    className="gap-2 shrink-0"
                    onClick={() => runPayroll.mutate({ employeeId: employeeFilter, month })}
                    disabled={runPayroll.isPending}
                  >
                    <RunIcon className="w-4 h-4" />
                    {runPayroll.isPending ? "Génération…" : "Générer le bulletin"}
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="bg-card rounded-[6px] border border-border/30 shadow-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Mois</TableHead>
                    <TableHead>Absences</TableHead>
                    <TableHead>Net à payer</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Chargement…
                      </TableCell>
                    </TableRow>
                  ) : !runs || runs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Aucun bulletin de paie pour ces filtres.
                      </TableCell>
                    </TableRow>
                  ) : (
                    runs.map((run) => (
                      <TableRow key={run.id} className="cursor-pointer" onClick={() => setSelectedRun(run)}>
                        <TableCell className="font-medium">{employeeNameById.get(run.employee_id) ?? "-"}</TableCell>
                        <TableCell>{run.month}</TableCell>
                        <TableCell className="text-muted-foreground">{run.absence_days}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(run.net_a_payer)}</TableCell>
                        <TableCell>
                          {run.paid ? (
                            <Badge variant="success">Payé</Badge>
                          ) : (
                            <Badge variant="warning">En attente</Badge>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {!run.paid && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updatePaid.mutate({ id: run.id, paid: true, paidDate: new Date().toISOString().slice(0, 10) })
                              }
                            >
                              Marquer payé
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
              </>
            )}
          </div>
        </main>

      <Dialog open={!!selectedRun} onOpenChange={(open) => !open && setSelectedRun(null)}>
        <DialogContent>
          {selectedRun && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Bulletin de paie — {employeeNameById.get(selectedRun.employee_id) ?? "-"} ({selectedRun.month})
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Salaire de base</span>
                  <span className="font-medium">{formatCurrency(selectedRun.base_salary)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Jours ouvrés du mois</span>
                  <span className="font-medium">{selectedRun.working_days_in_month}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Jours d'absence</span>
                  <span className="font-medium">{selectedRun.absence_days}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Taux journalier</span>
                  <span className="font-medium">{formatCurrency(selectedRun.daily_rate)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Déduction absences</span>
                  <span className="font-medium text-destructive">-{formatCurrency(selectedRun.absence_deduction)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Primes</span>
                  <span className="font-medium text-emerald-600">+{formatCurrency(selectedRun.primes)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Déduction avance</span>
                  <span className="font-medium text-destructive">-{formatCurrency(selectedRun.avance_deduction)}</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="font-semibold">Net à payer</span>
                  <span className="text-lg font-bold">{formatCurrency(selectedRun.net_a_payer)}</span>
                </div>
                <div className="flex justify-between py-2 border-t border-border/50 pt-3">
                  <span className="text-muted-foreground">Statut</span>
                  {selectedRun.paid ? (
                    <Badge variant="success">Payé{selectedRun.paid_date ? ` le ${formatDate(selectedRun.paid_date)}` : ""}</Badge>
                  ) : (
                    <Badge variant="warning">En attente</Badge>
                  )}
                </div>
              </div>
              {!selectedRun.paid && (
                <DialogFooter>
                  <Button
                    onClick={() => {
                      updatePaid.mutate(
                        { id: selectedRun.id, paid: true, paidDate: new Date().toISOString().slice(0, 10) },
                        { onSuccess: (updated) => setSelectedRun(updated) }
                      );
                    }}
                    disabled={updatePaid.isPending}
                  >
                    Marquer payé
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "-");

function FreelancesTab() {
  const { data: payments, isLoading } = useFreelancePayments();
  const setPaymentStatus = useSetFreelancerPaymentStatus();
  const assignPayment = useAssignFreelancePayment();
  const { data: employees } = useEmployees();
  const { data: projects } = useProjects();

  const freelancers = (employees ?? []).filter((e) => e.contract_type === "Freelance");
  // Projects that don't already have a freelance payment attached — the
  // dialog is for logging a new one, not silently overwriting an existing
  // assignment (that's what the project's own edit form is for).
  const availableProjects = (projects ?? []).filter((p) => !p.freelancer_id);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedFreelancerId, setSelectedFreelancerId] = useState("");
  const [montant, setMontant] = useState("");
  const [datePaiement, setDatePaiement] = useState(new Date().toISOString().slice(0, 10));
  const [isPaid, setIsPaid] = useState(true);

  const resetAddForm = () => {
    setSelectedProjectId("");
    setSelectedFreelancerId("");
    setMontant("");
    setDatePaiement(new Date().toISOString().slice(0, 10));
    setIsPaid(true);
  };

  const handleAddPayment = () => {
    if (!selectedProjectId) {
      toast.error("Sélectionnez un projet");
      return;
    }
    if (!selectedFreelancerId) {
      toast.error("Sélectionnez un freelance");
      return;
    }
    const amount = Number(montant);
    if (!amount || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }
    assignPayment.mutate(
      {
        projectId: selectedProjectId,
        freelancerId: selectedFreelancerId,
        montantConvenu: amount,
        statutPaiement: isPaid ? "paye" : "non_paye",
        datePaiement: isPaid ? datePaiement : null,
      },
      {
        onSuccess: () => {
          setAddDialogOpen(false);
          resetAddForm();
        },
      }
    );
  };

  const totalOwed = (payments ?? [])
    .filter((p) => p.statut_paiement === "non_paye")
    .reduce((sum, p) => sum + (p.montant_convenu ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <Card className="w-fit border-orange-200 dark:border-orange-900/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total dû aux freelances (non payé)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-orange-600">{formatCurrency(totalOwed)}</div>
          </CardContent>
        </Card>
        <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Ajouter un paiement freelance
        </Button>
      </div>

      <div className="bg-card rounded-[6px] border border-border/30 shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projet</TableHead>
              <TableHead>Freelance</TableHead>
              <TableHead>Montant convenu</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Chargement…
                </TableCell>
              </TableRow>
            ) : !payments || payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Aucun projet avec un freelance assigné.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <TableRow key={p.project_id}>
                  <TableCell className="font-medium">{p.project_name}</TableCell>
                  <TableCell>{p.freelancer_name}</TableCell>
                  <TableCell>{p.montant_convenu != null ? formatCurrency(p.montant_convenu) : "-"}</TableCell>
                  <TableCell>
                    {p.statut_paiement === "paye" ? (
                      <Badge variant="success">Payé{p.date_paiement ? ` le ${formatDate(p.date_paiement)}` : ""}</Badge>
                    ) : (
                      <Badge variant="warning">Non payé</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={setPaymentStatus.isPending}
                      onClick={() =>
                        setPaymentStatus.mutate({
                          projectId: p.project_id,
                          statutPaiement: p.statut_paiement === "paye" ? "non_paye" : "paye",
                          datePaiement: p.statut_paiement === "paye" ? null : new Date().toISOString().slice(0, 10),
                        })
                      }
                    >
                      {p.statut_paiement === "paye" ? "Marquer non payé" : "Marquer payé"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) resetAddForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un paiement freelance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Projet</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un projet" />
                </SelectTrigger>
                <SelectContent>
                  {availableProjects.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Aucun projet sans freelance assigné
                    </div>
                  ) : (
                    availableProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Freelance</Label>
              <Select value={selectedFreelancerId} onValueChange={setSelectedFreelancerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un freelance" />
                </SelectTrigger>
                <SelectContent>
                  {freelancers.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Aucun employé en freelance
                    </div>
                  ) : (
                    freelancers.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Montant convenu (DA)</Label>
              <Input type="number" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="50000" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={isPaid} onCheckedChange={(v) => setIsPaid(!!v)} />
              <span className="text-sm">Déjà payé</span>
            </label>
            {isPaid && (
              <div className="space-y-1.5">
                <Label>Date de paiement</Label>
                <Input type="date" value={datePaiement} onChange={(e) => setDatePaiement(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddPayment} disabled={assignPayment.isPending}>
              {assignPayment.isPending ? "Ajout…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
