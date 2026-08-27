import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  RiUploadCloud2Line as Upload,
  RiWalletLine as WalletIcon,
  RiErrorWarningLine as WarningIcon,
  RiTimeLine as PendingIcon,
  RiPlayLine as RunIcon,
  RiAddLine as Plus,
  RiPencilLine as EditIcon,
  RiDeleteBinLine as Trash2,
  RiFileDownloadLine as CsvIcon,
  RiFilePdf2Line as PdfIcon,
  RiCalculatorLine as RecalcIcon,
  RiFileTextLine as PayslipIcon,
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
  StatusBadge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Checkbox,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  TableLoading,
  EmptyState,
} from "@sordi/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { useEmployees } from "@/hooks/useEmployees";
import {
  usePayrollRuns,
  usePayrollDashboardStats,
  useUpdatePayrollPaid,
  useUpdatePayrollRun,
  useDeletePayrollRun,
  useImportPunchRecords,
  useUnmappedDeviceCodes,
  useRunPayroll,
} from "@/hooks/usePayroll";
import { useFreelancePayments, useSetFreelancerPaymentStatus, useAssignFreelancePayment, useProjects } from "@/hooks/useProjects";
import { useSettings } from "@/hooks/useSettings";
import { db, type PunchImportRow, type PayrollRun, type UpdatePayrollRunData } from "@/lib/database";
import { exportToCSV } from "@/lib/csvUtils";
import { generatePayrollPDF, generateBulletinPaiePDF } from "@/lib/pdfGenerator";
import { AnimatedNumber } from "@/components/ui/animated-number";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD", minimumFractionDigits: 0 }).format(amount);

const currentMonth = new Date().toISOString().slice(0, 7);

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

type PeriodType = "month" | "quarter" | "semester" | "year";

const PERIOD_OPTIONS: { value: PeriodType; label: string; months: number }[] = [
  { value: "month", label: "Mois", months: 1 },
  { value: "quarter", label: "Trimestre (3 mois)", months: 3 },
  { value: "semester", label: "Semestre (6 mois)", months: 6 },
  { value: "year", label: "Année (12 mois)", months: 12 },
];

/** Trailing N "YYYY-MM" months ending at (and including) anchorMonth,
 *  oldest first — drives the period-wide exports. The on-screen table stays
 *  scoped to the single anchor month; this only widens what the PDF/CSV
 *  exports pull in. */
function monthsInPeriod(anchorMonth: string, periodType: PeriodType): string[] {
  const [y, m] = anchorMonth.split("-").map(Number);
  const count = PERIOD_OPTIONS.find((p) => p.value === periodType)?.months ?? 1;
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

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
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [editingRun, setEditingRun] = useState<PayrollRun | null>(null);
  const [editForm, setEditForm] = useState({
    base_salary: "",
    working_days_in_month: "",
    absence_days: "",
    daily_rate: "",
    absence_deduction: "",
    primes: "",
    avance_deduction: "",
    net_a_payer: "",
  });
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [isDownloadingRunId, setIsDownloadingRunId] = useState<string | null>(null);

  const { data: employees } = useEmployees();
  const { data: settings } = useSettings();
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
  const updateRun = useUpdatePayrollRun();
  const deleteRun = useDeletePayrollRun();
  const importPunches = useImportPunchRecords();
  const runPayroll = useRunPayroll();
  const { data: unmappedCodes } = useUnmappedDeviceCodes(month === "all" ? undefined : month);

  const employeeNameById = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e.name])), [employees]);
  const employeeById = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e])), [employees]);

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

  // Split "YYYY-MM" into independent month/year selectors so any month —
  // past or future, not just a trailing 12-month window — is reachable.
  const [selectedYear, selectedMonthNum] = month.split("-");
  const setYear = (y: string) => setMonth(`${y}-${selectedMonthNum}`);
  const setMonthNum = (m: string) => setMonth(`${selectedYear}-${m}`);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    for (let y = currentYear + 1; y >= currentYear - 6; y--) years.push(String(y));
    return years;
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

  const monthLabel = (m: string) => {
    const [y, mm] = m.split("-");
    return `${MONTH_NAMES[parseInt(mm, 10) - 1] || mm} ${y}`;
  };

  const periodMonths = useMemo(() => monthsInPeriod(month, periodType), [month, periodType]);
  const periodLabel =
    periodType === "month" ? monthLabel(month) : `${monthLabel(periodMonths[0])} - ${monthLabel(periodMonths[periodMonths.length - 1])}`;

  const openEditDialog = (run: PayrollRun) => {
    setEditingRun(run);
    setEditForm({
      base_salary: String(run.base_salary),
      working_days_in_month: String(run.working_days_in_month),
      absence_days: String(run.absence_days),
      daily_rate: String(run.daily_rate),
      absence_deduction: String(run.absence_deduction),
      primes: String(run.primes),
      avance_deduction: String(run.avance_deduction),
      net_a_payer: String(run.net_a_payer),
    });
  };

  // Convenience recompute using the same formula run_payroll uses — doesn't
  // force auto-calculation (the whole point of this form is manual override),
  // just saves the mental math when the user wants the "normal" numbers back.
  const recalculateNet = () => {
    const baseSalary = parseFloat(editForm.base_salary) || 0;
    const absenceDays = parseFloat(editForm.absence_days) || 0;
    const dailyRate = parseFloat(editForm.daily_rate) || 0;
    const primes = parseFloat(editForm.primes) || 0;
    const avanceDeduction = parseFloat(editForm.avance_deduction) || 0;
    const absenceDeduction = absenceDays * dailyRate;
    const netAPayer = baseSalary + primes - absenceDeduction - avanceDeduction;
    setEditForm((f) => ({
      ...f,
      absence_deduction: String(absenceDeduction),
      net_a_payer: String(netAPayer),
    }));
  };

  const handleSaveEdit = () => {
    if (!editingRun) return;
    const data: UpdatePayrollRunData = {
      id: editingRun.id,
      base_salary: parseFloat(editForm.base_salary) || 0,
      working_days_in_month: parseFloat(editForm.working_days_in_month) || 0,
      absence_days: parseFloat(editForm.absence_days) || 0,
      daily_rate: parseFloat(editForm.daily_rate) || 0,
      absence_deduction: parseFloat(editForm.absence_deduction) || 0,
      primes: parseFloat(editForm.primes) || 0,
      avance_deduction: parseFloat(editForm.avance_deduction) || 0,
      net_a_payer: parseFloat(editForm.net_a_payer) || 0,
    };
    updateRun.mutate(data, { onSuccess: () => setEditingRun(null) });
  };

  const handleConfirmDelete = () => {
    if (!deletingRunId) return;
    deleteRun.mutate(deletingRunId, { onSuccess: () => setDeletingRunId(null) });
  };

  // Global exports pull every month in the selected period (not just the
  // on-screen `runs`, which only ever covers the single anchor month) —
  // one get_payroll_runs call per month, merged client-side, since the
  // backend command only takes one month at a time.
  const fetchRunsForPeriod = async (): Promise<PayrollRun[]> => {
    const eid = employeeFilter === "all" ? undefined : employeeFilter;
    const paid = paidFilter === "all" ? undefined : paidFilter === "paid";
    const perMonth = await Promise.all(periodMonths.map((m) => db.payroll.getRuns(eid, m, paid)));
    return perMonth.flat();
  };

  const handleExportCSV = async () => {
    const periodRuns = await fetchRunsForPeriod();
    if (periodRuns.length === 0) {
      toast.error("Aucun bulletin à exporter pour cette période");
      return;
    }
    const rows = periodRuns.map((r) => ({
      employee: employeeNameById.get(r.employee_id) ?? "-",
      month: r.month,
      base_salary: r.base_salary,
      absences: r.absence_days,
      primes: r.primes,
      net_a_payer: r.net_a_payer,
      status: r.paid ? "Payé" : "En attente",
    }));
    exportToCSV(rows, `paie_${periodMonths[0]}_${periodMonths[periodMonths.length - 1]}`, [
      { key: "employee", label: "Employé" },
      { key: "month", label: "Mois" },
      { key: "base_salary", label: "Salaire de base" },
      { key: "absences", label: "Absences" },
      { key: "primes", label: "Primes" },
      { key: "net_a_payer", label: "Net à payer" },
      { key: "status", label: "Statut" },
    ]);
  };

  const handleExportPDF = async () => {
    setIsExportingPdf(true);
    try {
      const periodRuns = await fetchRunsForPeriod();
      if (periodRuns.length === 0) {
        toast.error("Aucun bulletin à exporter pour cette période");
        return;
      }
      const rows = periodRuns.map((r) => ({
        employee_name: employeeNameById.get(r.employee_id) ?? "-",
        month: r.month,
        base_salary: r.base_salary,
        absence_days: r.absence_days,
        primes: r.primes,
        net_a_payer: r.net_a_payer,
        paid: r.paid,
      }));
      const totalNetAPayer = periodRuns.reduce((sum, r) => sum + r.net_a_payer, 0);
      await generatePayrollPDF(rows, totalNetAPayer, periodLabel, settings);
      toast.success("PDF généré et téléchargé avec succès");
    } catch (error) {
      console.error("Erreur export PDF paie:", error);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadPayslip = async (run: PayrollRun) => {
    const employee = employeeById.get(run.employee_id);
    if (!employee) {
      toast.error("Employé introuvable pour ce bulletin");
      return;
    }
    setIsDownloadingRunId(run.id);
    try {
      // generateBulletinPaiePDF shows its own success toast (with the saved
      // path) once the native save dialog resolves. A null result means the
      // user cancelled that dialog — a clean abort, not an error, so no
      // toast here either way.
      await generateBulletinPaiePDF(
        {
          month: run.month,
          base_salary: run.base_salary,
          working_days_in_month: run.working_days_in_month,
          absence_days: run.absence_days,
          absence_deduction: run.absence_deduction,
          primes: run.primes,
          avance_deduction: run.avance_deduction,
          net_a_payer: run.net_a_payer,
        },
        { name: employee.name, role: employee.role, hire_date: employee.hire_date, rib: employee.rib },
        settings
      );
    } catch (error) {
      console.error("Erreur téléchargement bulletin:", error);
      toast.error("Erreur lors de la génération du bulletin");
    } finally {
      setIsDownloadingRunId(null);
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
                    <div className="flex items-center gap-1.5">
                      <Select value={selectedMonthNum} onValueChange={setMonthNum}>
                        <SelectTrigger className="w-[150px] h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTH_NAMES.map((name, i) => {
                            const value = String(i + 1).padStart(2, "0");
                            return (
                              <SelectItem key={value} value={value}>
                                {name}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <Select value={selectedYear} onValueChange={setYear}>
                        <SelectTrigger className="w-[100px] h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {yearOptions.map((y) => (
                            <SelectItem key={y} value={y}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                  <AnimatedNumber value={dashboardStats?.total_payroll_cost ?? 0} format={formatCurrency} className="text-xl font-bold" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Employés en alerte absence</CardTitle>
                  <WarningIcon className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <AnimatedNumber value={dashboardStats?.flagged_employee_count ?? 0} format={(v) => String(Math.round(v))} className="text-xl font-bold text-destructive" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Bulletins en attente de paiement</CardTitle>
                  <PendingIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <AnimatedNumber value={dashboardStats?.pending_payroll_count ?? 0} format={(v) => String(Math.round(v))} className="text-xl font-bold" />
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
                      <StatusBadge key={c.external_code} tone="warning" className="gap-1.5">
                        {c.external_code}
                        <span className="opacity-70 font-normal">
                          ({c.punch_count} pointage{c.punch_count > 1 ? "s" : ""})
                        </span>
                      </StatusBadge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Assignez le "Code appareil" correspondant sur la fiche de l'employé pour rattacher automatiquement ces pointages.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Filter & export toolbar — the anchor month/year picked in the
                header above still drives the table below (always one
                month); "Période" here only widens how many trailing months
                the two export buttons pull in. */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-card rounded-2xl border border-border/30 shadow-card mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
                  <SelectTrigger className="w-[190px] h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger className="w-[220px] h-10">
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
                  <SelectTrigger className="w-[160px] h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="paid">Payé</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="gap-2 border-border/50" onClick={handleExportPDF} disabled={isExportingPdf}>
                  <PdfIcon className="w-4 h-4 text-red-600" />
                  {isExportingPdf ? "Export…" : "Export PDF"}
                </Button>
                <Button variant="outline" className="gap-2 border-border/50" onClick={handleExportCSV}>
                  <CsvIcon className="w-4 h-4 text-emerald-600" />
                  Export CSV
                </Button>
              </div>
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

            <div className="bg-card rounded-2xl border border-border/30 shadow-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Mois</TableHead>
                    <TableHead>Absences</TableHead>
                    <TableHead>Net à payer</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-32"></TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableLoading columns={7} rows={5} />
                  ) : !runs || runs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <EmptyState
                          type="payroll"
                          title="Aucun bulletin de paie"
                          description="Aucun bulletin ne correspond aux filtres sélectionnés"
                        />
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
                            <StatusBadge tone="success">Payé</StatusBadge>
                          ) : (
                            <StatusBadge tone="warning">En attente</StatusBadge>
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="Télécharger le bulletin PDF"
                              onClick={() => handleDownloadPayslip(run)}
                              disabled={isDownloadingRunId === run.id}
                            >
                              <PayslipIcon className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Modifier" onClick={() => openEditDialog(run)}>
                              <EditIcon className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title="Supprimer"
                              onClick={() => setDeletingRunId(run.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
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
                    <StatusBadge tone="success">Payé{selectedRun.paid_date ? ` le ${formatDate(selectedRun.paid_date)}` : ""}</StatusBadge>
                  ) : (
                    <StatusBadge tone="warning">En attente</StatusBadge>
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

      {/* Manual override — every calculated field, editable, so a one-off
          correction doesn't have to go through run_payroll's automatic
          recompute. Payment status stays out of this form on purpose: it's
          exclusively "Marquer payé" 's job, so there's one place that toggles it. */}
      <Dialog open={!!editingRun} onOpenChange={(open) => !open && setEditingRun(null)}>
        <DialogContent>
          {editingRun && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Modifier le bulletin — {employeeNameById.get(editingRun.employee_id) ?? "-"} ({editingRun.month})
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Salaire de base (DA)</Label>
                  <Input
                    type="number"
                    value={editForm.base_salary}
                    onChange={(e) => setEditForm((f) => ({ ...f, base_salary: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Jours ouvrés du mois</Label>
                  <Input
                    type="number"
                    value={editForm.working_days_in_month}
                    onChange={(e) => setEditForm((f) => ({ ...f, working_days_in_month: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Jours d'absence</Label>
                  <Input
                    type="number"
                    value={editForm.absence_days}
                    onChange={(e) => setEditForm((f) => ({ ...f, absence_days: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Taux journalier (DA)</Label>
                  <Input
                    type="number"
                    value={editForm.daily_rate}
                    onChange={(e) => setEditForm((f) => ({ ...f, daily_rate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Déduction absences (DA)</Label>
                  <Input
                    type="number"
                    value={editForm.absence_deduction}
                    onChange={(e) => setEditForm((f) => ({ ...f, absence_deduction: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Primes (DA)</Label>
                  <Input
                    type="number"
                    value={editForm.primes}
                    onChange={(e) => setEditForm((f) => ({ ...f, primes: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Déduction avance (DA)</Label>
                  <Input
                    type="number"
                    value={editForm.avance_deduction}
                    onChange={(e) => setEditForm((f) => ({ ...f, avance_deduction: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Net à payer (DA)</Label>
                  <Input
                    type="number"
                    value={editForm.net_a_payer}
                    onChange={(e) => setEditForm((f) => ({ ...f, net_a_payer: e.target.value }))}
                    className="font-semibold"
                  />
                </div>
              </div>
              <DialogFooter className="sm:justify-between">
                <Button variant="ghost" className="gap-2" onClick={recalculateNet}>
                  <RecalcIcon className="w-4 h-4" />
                  Recalculer
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEditingRun(null)}>
                    Annuler
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={updateRun.isPending}>
                    {updateRun.isPending ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingRunId} onOpenChange={(open) => !open && setDeletingRunId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bulletin de paie ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le bulletin sera supprimé et pourra être régénéré via "Générer le bulletin".
              Les avances déduites par ce bulletin redeviennent disponibles pour un futur calcul.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground rounded-xl">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
            <AnimatedNumber value={totalOwed} format={formatCurrency} className="text-xl font-bold text-orange-600" />
          </CardContent>
        </Card>
        <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Ajouter un paiement freelance
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border/30 shadow-card overflow-hidden">
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
              <TableLoading columns={5} rows={5} />
            ) : !payments || payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    type="payroll"
                    title="Aucun paiement freelance"
                    description="Assignez un freelance à un projet pour suivre ses paiements ici"
                  />
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
                      <StatusBadge tone="success">Payé{p.date_paiement ? ` le ${formatDate(p.date_paiement)}` : ""}</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning">Non payé</StatusBadge>
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
                <DatePicker value={datePaiement} onChange={setDatePaiement} />
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
