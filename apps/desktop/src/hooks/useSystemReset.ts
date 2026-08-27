import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db } from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";
import { logError } from "@/lib/errorLogger";

/**
 * Wipes every transactional row for the active company (clients, suppliers,
 * invoices, payments, expenses, contracts, projects, delivery notes,
 * orders, activity logs) back to a clean factory state. Never touches the
 * company profile itself, employees, partners, products, or app settings.
 * Irreversible — the caller is responsible for its own confirmation step
 * before invoking this.
 */
export function useResetToFactoryState() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useWorkspace();

  return useMutation({
    mutationFn: async () => {
      await db.system.resetToFactoryState(activeCompanyId);
    },
    onSuccess: () => {
      // No narrower key would be safe here — virtually every query in the
      // app reads from a table this just wiped.
      queryClient.invalidateQueries();
      toast.success("Base de données réinitialisée aux valeurs d'usine");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la réinitialisation");
      logError("Factory reset error", error);
    },
  });
}
