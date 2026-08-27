import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  db,
  type CreateEmployeeAdvanceData,
  type PunchImportRow,
  type UpdatePayrollRunData,
} from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";
export type { CreateEmployeeAdvanceData, PunchImportRow, UpdatePayrollRunData };

// ---- Attendance import ----

/** Unmapped device codes are the expected normal case (an employee not yet
 *  assigned a device ID) — every row still imports, and this is always a
 *  success-styled toast, never an error. See PROJECT_STATE.md. */
export function useImportPunchRecords() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useWorkspace();
  return useMutation({
    mutationFn: (rows: PunchImportRow[]) => db.attendance.import(activeCompanyId, rows),
    onSuccess: (summary) => {
      queryClient.invalidateQueries({ queryKey: ["employee-absence-stats"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["unmapped-device-codes"] });

      const parts: string[] = [];
      parts.push(`${summary.imported} pointage${summary.imported > 1 ? "s" : ""} importé${summary.imported > 1 ? "s" : ""}`);
      if (summary.skipped_duplicates > 0) {
        parts.push(`${summary.skipped_duplicates} déjà importé${summary.skipped_duplicates > 1 ? "s" : ""}`);
      }
      const title = parts.join(", ");
      const description =
        summary.unmatched_employee_codes.length > 0
          ? `${summary.unmatched_employee_codes.length} code${summary.unmatched_employee_codes.length > 1 ? "s" : ""} non assigné${summary.unmatched_employee_codes.length > 1 ? "s" : ""} : ${summary.unmatched_employee_codes.join(", ")}`
          : undefined;

      toast.success(title, { description });
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de l'import des pointages");
    },
  });
}

// ---- Absence stats (live) ----

export function useEmployeeAbsenceStats(employeeId: string | undefined, month: string) {
  return useQuery({
    queryKey: ["employee-absence-stats", employeeId, month],
    queryFn: () => db.payroll.getAbsenceStats(employeeId!, month),
    enabled: !!employeeId && !!month,
  });
}

// ---- Advances ----

export function useEmployeeAdvances(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["employee-advances", employeeId],
    queryFn: () => db.employeeAdvances.getAll(employeeId!),
    enabled: !!employeeId,
  });
}

export function useEmployeeAdvanceTotals(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["employee-advances", "totals", employeeId],
    queryFn: () => db.employeeAdvances.getTotals(employeeId!),
    enabled: !!employeeId,
  });
}

export function useCreateEmployeeAdvance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEmployeeAdvanceData) => db.employeeAdvances.create(data),
    onSuccess: (advance) => {
      queryClient.invalidateQueries({ queryKey: ["employee-advances", advance.employee_id] });
      queryClient.invalidateQueries({ queryKey: ["employee-advances", "totals", advance.employee_id] });
      toast.success("Avance enregistrée");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de l'enregistrement de l'avance");
    },
  });
}

export function useSetEmployeeAdvanceDeducted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deducted }: { id: string; deducted: boolean }) => db.employeeAdvances.setDeducted(id, deducted),
    onSuccess: (advance) => {
      queryClient.invalidateQueries({ queryKey: ["employee-advances", advance.employee_id] });
      queryClient.invalidateQueries({ queryKey: ["employee-advances", "totals", advance.employee_id] });
      toast.success(advance.deducted ? "Avance marquée comme déduite" : "Avance marquée en attente");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la mise à jour de l'avance");
    },
  });
}

// ---- Payroll runs ----

export function usePayrollRuns(employeeId?: string, month?: string, paid?: boolean) {
  return useQuery({
    queryKey: ["payroll-runs", employeeId ?? "all", month ?? "all", paid ?? "all"],
    queryFn: () => db.payroll.getRuns(employeeId, month, paid),
  });
}

export function useRunPayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, month, primes }: { employeeId: string; month: string; primes?: number }) =>
      db.payroll.run(employeeId, month, primes),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["employee-advances", run.employee_id] });
      toast.success("Bulletin de paie calculé");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors du calcul de la paie");
    },
  });
}

export function useUpdatePayrollPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paid, paidDate }: { id: string; paid: boolean; paidDate: string | null }) =>
      db.payroll.setPaid(id, paid, paidDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-dashboard"] });
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la mise à jour du statut de paiement");
    },
  });
}

export function useUpdatePayrollRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePayrollRunData) => db.payroll.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-dashboard"] });
      toast.success("Bulletin de paie modifié");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la modification du bulletin");
    },
  });
}

export function useDeletePayrollRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.payroll.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["employee-advances"] });
      toast.success("Bulletin de paie supprimé");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la suppression du bulletin");
    },
  });
}

// ---- Manager dashboard ----

export function usePayrollDashboardStats(month: string) {
  const { activeCompanyId, isReady } = useWorkspace();
  return useQuery({
    queryKey: ["payroll-dashboard", activeCompanyId, month],
    queryFn: () => db.payroll.getDashboardStats(activeCompanyId, month),
    enabled: !!month && isReady,
  });
}

/** Device codes seen in imported punches with no matching employee yet —
 *  assigning that code on an employee's profile (external_code) backfills
 *  them automatically, no re-import needed. Scoped to one month so the
 *  Payroll page's warning banner reflects whatever month is selected there,
 *  not an all-time count. */
export function useUnmappedDeviceCodes(month?: string) {
  return useQuery({
    queryKey: ["unmapped-device-codes", month ?? "all"],
    queryFn: () => db.attendance.getUnmappedCodes(month),
  });
}
