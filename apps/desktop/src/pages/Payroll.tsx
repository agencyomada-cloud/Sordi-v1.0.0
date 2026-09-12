import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
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
  Textarea,
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
  Tracker,
  type TrackerBlockProps,
  type TrackerColor,
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
  useEmployeeDailyAttendance,
} from "@/hooks/usePayroll";
import { useFreelancePayments, useSetFreelancerPaymentStatus, useAssignFreelancePayment, useProjects } from "@/hooks/useProjects";
import { useSettings } from "@/hooks/useSettings";
import { useSecureSession } from "@/hooks/useSecureSession";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";
import { db, type PunchImportRow, type PayrollRun, type UpdatePayrollRunData, type Employee } from "@/lib/database";
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

/** Converts a device/spreadsheet timestamp into the canonical
 *  "YYYY-MM-DD HH:MM:SS" shape that attendance/salary queries match against
 *  (a strict "2026-09%" prefix + strict %Y-%m-%d parsing server-side) —
 *  returns null if the value can't be confidently parsed rather than
 *  passing something through that would silently never match any month.
 *  Handles:
 *  - "YYYY-MM-DD[ T]HH:MM[:SS]" (already canonical / ISO)
 *  - "DD/MM/YYYY HH:MM[:SS]" (the common French/Algerian device export format)
 *  - date-only values (assumes midnight)
 *  - a bare Excel date serial number (days since 1899-12-30, optionally with
 *    a fractional time-of-day) — happens when the device's CSV was actually
 *    opened/re-saved in Excel and its date column got auto-numbered. */
function normalizePunchTimestamp(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  let m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    return `${y}-${mo}-${d} ${h}:${mi}:${s ?? "00"}`;
  }

  m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, d, mo, y, h, mi, s] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")} ${h.padStart(2, "0")}:${mi}:${s ?? "00"}`;
  }

  m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]} 00:00:00`;

  m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")} 00:00:00`;

  if (/^\d+(\.\d+)?$/.test(value)) {
    const serial = Number(value);
    // Sane range guard (~1954-2146) so a stray small integer (e.g. a badge
    // number that leaked into the wrong column) isn't misread as a date.
    if (serial > 20000 && serial < 90000) {
      const epochMs = Date.UTC(1899, 11, 30);
      const ms = epochMs + Math.round(serial * 86400) * 1000;
      const d = new Date(ms);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    }
  }

  return null;
}

/** Parses a biometric device attendance export into punch rows. Tolerant of
 *  the real-world variations these exports show up in: tab, semicolon, or
 *  comma delimited (a ZKTeco attlog .dat/.txt is tab-separated with no
 *  header; a CSV re-saved from Excel is typically comma or semicolon with
 *  quoted fields), col1 = device employee ID (Device User ID / AC-No /
 *  Badge ID), col2 = a timestamp in any of the formats normalizePunchTimestamp
 *  handles. Columns beyond that (status/verify-mode/work-code/reserved) are
 *  ignored — the "any punch = present" logic only needs employee + timestamp.
 *  Rows whose date can't be confidently parsed are dropped rather than sent
 *  upstream with a garbage punch_time that would silently never match any
 *  month's attendance/salary query. */
function parsePunchFile(text: string): { rows: PunchImportRow[]; invalidCount: number } {
  const lines = text
    .split(/\r\n|\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: PunchImportRow[] = [];
  let invalidCount = 0;

  for (const line of lines) {
    const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const cols = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
    const externalCode = cols[0] ?? "";
    const rawTimestamp = cols[1] ?? "";
    if (!externalCode || !rawTimestamp) continue;

    const punchTime = normalizePunchTimestamp(rawTimestamp);
    if (!punchTime) {
      invalidCount++;
      continue;
    }
    rows.push({ external_code: externalCode, punch_time: punchTime });
  }

  return { rows, invalidCount };
}

const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  present: "Présent",
  late: "En retard",
  absent: "Absent",
  weekend: "Repos",
};

const ATTENDANCE_STATUS_COLOR: Record<string, TrackerColor> = {
  present: "emerald",
  late: "amber",
  absent: "rose",
  weekend: "slate",
};

// The day tooltip's status line is plain slate-500 text (light frosted
// card, matches the rest of the app's aesthetic) — the tone lives in this
// small ring-accented dot instead of colored text.
const ATTENDANCE_STATUS_DOT_COLOR: Record<string, string> = {
  present: "bg-emerald-500 ring-emerald-500/20",
  late: "bg-amber-500 ring-amber-500/20",
  absent: "bg-rose-500 ring-rose-500/20",
  weekend: "bg-slate-400 ring-slate-400/20",
};

/** One employee's Tracker strip for the filtered month — a separate
 *  component (not inlined in a .map()) so each employee's daily-attendance
 *  query is its own hook call, not a hooks-in-a-loop violation. */
function EmployeeAttendanceRow({ employee, month }: { employee: Employee; month: string }) {
  const { data: attendance, isLoading } = useEmployeeDailyAttendance(employee.id, month);

  const trackerData: TrackerBlockProps[] = useMemo(() => {
    if (!attendance) return [];
    return attendance.days.map((day) => ({
      key: day.date,
      color: ATTENDANCE_STATUS_COLOR[day.status],
      tooltip: (
        <div>
          <span className="font-semibold text-slate-900 block tracking-tight capitalize">
            {new Date(`${day.date}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <span className="text-[10px] font-medium text-slate-500 mt-0.5 flex items-center gap-1.5">
            <span className={cn("w-1.5 h-1.5 rounded-full ring-2 shrink-0", ATTENDANCE_STATUS_DOT_COLOR[day.status])} />
            {ATTENDANCE_STATUS_LABEL[day.status]}
            {day.arrival_time
              ? ` · Arrivée: ${day.arrival_time.slice(0, 5)}${day.late_minutes ? ` (${day.late_minutes} min)` : ""}`
              : ""}
          </span>
        </div>
      ),
    }));
  }, [attendance]);

  return (
    <div className="py-3 first:pt-0 last:pb-0 border-b last:border-b-0 border-border/40">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-sm font-medium truncate" title={employee.name}>{employee.name}</span>
        {attendance && (
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge tone="success">Présent: {attendance.present_count}</StatusBadge>
            <StatusBadge tone="warning">Retards: {attendance.late_count}</StatusBadge>
            <StatusBadge tone="error">Absences: {attendance.absent_count}</StatusBadge>
          </div>
        )}
      </div>
      {isLoading || !attendance ? (
        <div className="h-6 w-full rounded bg-secondary/40 animate-pulse" />
      ) : (
        <Tracker data={trackerData} className="h-6" />
      )}
    </div>
  );
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
    notes: "",
    paid: false,
    paid_date: "",
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
  const { executeSecuredAction } = useSecureSession();
  const { data: unmappedCodes } = useUnmappedDeviceCodes(month === "all" ? undefined : month);

  const employeeNameById = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e.name])), [employees]);
  const employeeById = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e])), [employees]);
  const activeEmployees = useMemo(() => (employees ?? []).filter((e) => e.is_active), [employees]);

  const invalidateAfterBulkRun = () => {
    queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
    queryClient.invalidateQueries({ queryKey: ["payroll-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["employee-advances"] });
  };

  const handleBulkGenerate = async () => {
    await executeSecuredAction(async () => {
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
    }, "Autoriser la génération des bulletins de paie");
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

  // After a successful punch import, refresh the "Net à payer" of any
  // bulletin already generated for the currently selected month — otherwise
  // an employee's payroll run stays frozen at whatever attendance existed
  // when it was first generated, even though the underlying punches (and
  // therefore present/late/absent counts) just changed. Deliberately scoped
  // to runs that (a) belong to the month currently open on screen and (b)
  // aren't marked paid yet — mirrors the same paid-lock safety rule
  // "Générer tous les bulletins" already applies, so this never silently
  // overwrites a bulletin that's already been settled. It never generates a
  // brand-new bulletin for an employee who doesn't have one yet — that
  // remains the explicit "Générer tous les bulletins" action.
  const recalcSelectedMonthPayroll = async () => {
    if (month === "all" || !monthRuns) return;
    const refreshable = monthRuns.filter((r) => !r.paid);
    if (refreshable.length === 0) return;

    let refreshed = 0;
    for (const run of refreshable) {
      try {
        await db.payroll.run(run.employee_id, month);
        refreshed++;
      } catch {
        // Best-effort — a single employee's recalculation failing (e.g. no
        // base_salary anymore) shouldn't block the others.
      }
    }

    if (refreshed > 0) {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-dashboard"] });
      toast.success(`${refreshed} bulletin${refreshed > 1 ? "s" : ""} recalculé${refreshed > 1 ? "s" : ""} pour ${month}`);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { rows, invalidCount } = parsePunchFile(text);
      if (rows.length === 0) {
        toast.error("Aucun pointage valide trouvé dans le fichier", {
          description: invalidCount > 0 ? `${invalidCount} ligne${invalidCount > 1 ? "s" : ""} avec une date illisible` : undefined,
        });
        return;
      }
      if (invalidCount > 0) {
        toast.warning(`${invalidCount} ligne${invalidCount > 1 ? "s" : ""} ignorée${invalidCount > 1 ? "s" : ""} (date illisible)`);
      }
      importPunches.mutate(rows, { onSuccess: () => { void recalcSelectedMonthPayroll(); } });
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
      notes: run.notes || "",
      paid: run.paid,
      paid_date: run.paid_date || new Date().toISOString().slice(0, 10),
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
      notes: editForm.notes || null,
    };
    // paid/paid_date stay a separate backend command by design (see
    // update_payroll_run's own doc comment) — this button just fires both
    // mutations together so the edit dialog reads as one coherent save,
    // only touching the paid state when it actually changed.
    const paidChanged = editForm.paid !== editingRun.paid || (editForm.paid && editForm.paid_date !== editingRun.paid_date);
    updateRun.mutate(data, {
      onSuccess: () => {
        if (paidChanged) {
          updatePaid.mutate(
            { id: editingRun.id, paid: editForm.paid, paidDate: editForm.paid ? editForm.paid_date : null },
            { onSuccess: () => setEditingRun(null) }
          );
        } else {
          setEditingRun(null);
        }
      },
    });
  };

  const handleConfirmDelete = async () => {
    if (!deletingRunId) return;
    await executeSecuredAction(() => {
      deleteRun.mutate(deletingRunId, { onSuccess: () => setDeletingRunId(null) });
    }, "Autoriser la suppression du bulletin de paie");
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
            {/* xl, not md — the controls on the right (month + year selects,
                import button, generate-bulletins button) need much more
                room than md's 768px breakpoint leaves once they're sharing
                a row with the title, which squeezed the subtitle into an
                ugly multi-line wrap at the app's minimum window width. */}
            <div className="flex flex-col items-start xl:flex-row xl:items-center justify-between mb-6 gap-4">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">Équipe & Salaires</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Pointages, bulletins de paie et avances</p>
              </div>
              <div className="flex items-center gap-2">
                {activeTab === "salaries" && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Select value={selectedMonthNum} onValueChange={setMonthNum}>
                        <SelectTrigger className="w-32 h-[30px] text-xs rounded-md">
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
                        <SelectTrigger className="w-20 h-[30px] text-xs rounded-md">
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
                    <input type="file" ref={fileInputRef} onChange={handleImport} accept=".txt,.tsv,.dat,.csv" className="hidden" />
                    <Button variant="outline" size="sm" className="h-[30px] text-xs rounded-md gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={importPunches.isPending}>
                      <Upload className="w-3.5 h-3.5" />
                      {importPunches.isPending ? "Import…" : "Importer les pointages"}
                    </Button>
                    <Button variant="default" size="sm" className="h-[30px] text-xs rounded-md gap-1.5" onClick={handleBulkGenerate} disabled={isBulkRunning}>
                      <RunIcon className="w-3.5 h-3.5" />
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

            {/* Pointage & Présences — a Tracker strip per active employee
                across the filtered month's days, backed by
                get_employee_daily_attendance (day-by-day, not the monthly
                absence-count summary the payroll runs table below uses). */}
            {activeEmployees.length > 0 && (
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Pointage & Présences ({month})</CardTitle>
                </CardHeader>
                <CardContent>
                  {activeEmployees.map((emp) => (
                    <EmployeeAttendanceRow key={emp.id} employee={emp} month={month} />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Filter & export toolbar — the anchor month/year picked in the
                header above still drives the table below (always one
                month); "Période" here only widens how many trailing months
                the two export buttons pull in. */}
            <div className="h-9 mb-3 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
                  <SelectTrigger className="w-[170px] h-[30px] text-xs rounded-md">
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
                  <SelectTrigger className="w-[190px] h-[30px] text-xs rounded-md">
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
                  <SelectTrigger className="w-36 h-[30px] text-xs rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="paid">Payé</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-[30px] text-xs rounded-md gap-1.5" onClick={handleExportPDF} disabled={isExportingPdf}>
                  <PdfIcon className="w-3.5 h-3.5 text-red-600" />
                  {isExportingPdf ? "Export…" : "Export PDF"}
                </Button>
                <Button variant="outline" size="sm" className="h-[30px] text-xs rounded-md gap-1.5" onClick={handleExportCSV}>
                  <CsvIcon className="w-3.5 h-3.5 text-emerald-600" />
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
                    onClick={() => executeSecuredAction(() => runPayroll.mutate({ employeeId: employeeFilter, month }), "Autoriser la génération du bulletin")}
                    disabled={runPayroll.isPending}
                  >
                    <RunIcon className="w-4 h-4" />
                    {runPayroll.isPending ? "Génération…" : "Générer le bulletin"}
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="border border-border/80 rounded-md bg-card overflow-hidden w-full">
              <Table>
                <TableHeader>
                  <TableRow className="h-8 bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Employé</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Mois</TableHead>
                    <TableHead numeric className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Absences</TableHead>
                    <TableHead numeric className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Net à payer</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Statut</TableHead>
                    <TableHead className="w-32 text-[11px] font-semibold text-muted-foreground uppercase px-3"></TableHead>
                    <TableHead className="w-32 text-right text-[11px] font-semibold text-muted-foreground uppercase px-3">Actions</TableHead>
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
                      <TableRow key={run.id} className="h-8 text-xs border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedRun(run)}>
                        <TableCell className="font-medium px-3">{employeeNameById.get(run.employee_id) ?? "-"}</TableCell>
                        <TableCell className="px-3">{run.month}</TableCell>
                        <TableCell numeric className="font-mono tabular-nums text-muted-foreground px-3">{run.absence_days}</TableCell>
                        <TableCell numeric className="font-mono tabular-nums font-semibold px-3">{formatCurrency(run.net_a_payer)}</TableCell>
                        <TableCell className="px-3">
                          {run.paid ? (
                            <StatusBadge tone="success">Payé</StatusBadge>
                          ) : (
                            <StatusBadge tone="warning">En attente</StatusBadge>
                          )}
                        </TableCell>
                        <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                          {!run.paid && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs rounded-md"
                              disabled={updatePaid.isPending}
                              onClick={() =>
                                updatePaid.mutate({ id: run.id, paid: true, paidDate: new Date().toISOString().slice(0, 10) })
                              }
                            >
                              Marquer payé
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Télécharger le bulletin PDF"
                              onClick={() => handleDownloadPayslip(run)}
                              disabled={isDownloadingRunId === run.id}
                            >
                              <PayslipIcon className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Modifier" onClick={() => openEditDialog(run)}>
                              <EditIcon className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              title="Supprimer"
                              onClick={() => setDeletingRunId(run.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
                  <span className="font-mono tabular-nums font-medium">{formatCurrency(selectedRun.base_salary)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Jours ouvrés du mois</span>
                  <span className="font-mono tabular-nums font-medium">{selectedRun.working_days_in_month}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Jours d'absence</span>
                  <span className="font-mono tabular-nums font-medium">{selectedRun.absence_days}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Taux journalier</span>
                  <span className="font-mono tabular-nums font-medium">{formatCurrency(selectedRun.daily_rate)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Déduction absences</span>
                  <span className="font-mono tabular-nums font-medium text-destructive">-{formatCurrency(selectedRun.absence_deduction)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Primes</span>
                  <span className="font-mono tabular-nums font-medium text-emerald-600">+{formatCurrency(selectedRun.primes)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Déduction avance</span>
                  <span className="font-mono tabular-nums font-medium text-destructive">-{formatCurrency(selectedRun.avance_deduction)}</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="font-semibold">Net à payer</span>
                  <span className="font-mono tabular-nums text-lg font-bold">{formatCurrency(selectedRun.net_a_payer)}</span>
                </div>
                <div className="flex justify-between py-2 border-t border-border/50 pt-3">
                  <span className="text-muted-foreground">Statut</span>
                  {selectedRun.paid ? (
                    <StatusBadge tone="success">Payé{selectedRun.paid_date ? ` le ${formatDate(selectedRun.paid_date)}` : ""}</StatusBadge>
                  ) : (
                    <StatusBadge tone="warning">En attente</StatusBadge>
                  )}
                </div>
                {selectedRun.notes && (
                  <div className="py-2 border-t border-border/50 pt-3">
                    <span className="text-muted-foreground text-xs">Notes</span>
                    <p className="mt-1">{selectedRun.notes}</p>
                  </div>
                )}
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
          recompute. Paid/paid_date/notes save via this same button but still
          go through their own backend commands under the hood (see
          handleSaveEdit) — update_payroll_run itself doesn't touch them. */}
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

              <div className="flex items-center gap-2 mt-4">
                <Checkbox
                  id="payroll-edit-paid"
                  checked={editForm.paid}
                  onCheckedChange={(v) => setEditForm((f) => ({ ...f, paid: !!v }))}
                />
                <Label htmlFor="payroll-edit-paid" className="cursor-pointer">Payé</Label>
              </div>
              {editForm.paid && (
                <div className="space-y-1.5 mt-2">
                  <Label>Date de paiement</Label>
                  <DatePicker value={editForm.paid_date} onChange={(v) => setEditForm((f) => ({ ...f, paid_date: v }))} />
                </div>
              )}
              <div className="space-y-1.5 mt-4">
                <Label>Notes</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Ex. Réglé par virement, avance sur prime de fin d'année…"
                  rows={2}
                />
              </div>

              <DialogFooter className="sm:justify-between mt-4">
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

      <DeleteConfirmationModal
        open={!!deletingRunId}
        onOpenChange={(open) => !open && setDeletingRunId(null)}
        title="Supprimer le bulletin de paie"
        itemIdentifier={(() => {
          const run = monthRuns?.find((r) => r.id === deletingRunId);
          const emp = run ? employeeNameById.get(run.employee_id) : null;
          return emp ? `Bulletin — ${emp}` : "Bulletin de paie";
        })()}
        description="Cette action est irréversible. Le bulletin sera supprimé et pourra être régénéré via 'Générer le bulletin'. Les avances déduites par ce bulletin redeviennent disponibles pour un futur calcul."
        isLoading={deleteRun.isPending}
        onConfirm={handleConfirmDelete}
      />
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

      <div className="border border-border/80 rounded-md bg-card overflow-hidden w-full">
        <Table>
          <TableHeader>
            <TableRow className="h-8 bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Projet</TableHead>
              <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Freelance</TableHead>
              <TableHead numeric className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Montant convenu</TableHead>
              <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Statut</TableHead>
              <TableHead className="w-32 text-[11px] font-semibold text-muted-foreground uppercase px-3"></TableHead>
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
                <TableRow key={p.project_id} className="h-8 text-xs border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <TableCell className="font-medium px-3">{p.project_name}</TableCell>
                  <TableCell className="px-3">{p.freelancer_name}</TableCell>
                  <TableCell numeric className="font-mono tabular-nums font-medium px-3">{p.montant_convenu != null ? formatCurrency(p.montant_convenu) : "-"}</TableCell>
                  <TableCell className="px-3">
                    {p.statut_paiement === "paye" ? (
                      <StatusBadge tone="success">Payé{p.date_paiement ? ` le ${formatDate(p.date_paiement)}` : ""}</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning">Non payé</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="px-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs rounded-md"
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
