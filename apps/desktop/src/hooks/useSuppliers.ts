import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supplierSchema } from "@/lib/validations";
import { logError } from "@/lib/errorLogger";
import { db, type Supplier, type CreateSupplierData, type SupplierPurchaseTotal } from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";
export type { CreateSupplierData };

export function useSuppliers() {
  const { activeCompanyId, isReady } = useWorkspace();
  return useQuery({
    queryKey: ["suppliers", activeCompanyId],
    queryFn: async () => {
      return await db.suppliers.getAll(activeCompanyId);
    },
    enabled: isReady,
  });
}

export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: ["suppliers", id],
    queryFn: async () => {
      if (!id) return null;
      return await db.suppliers.getById(id);
    },
    enabled: !!id,
  });
}

// SUM(expenses.amount) per supplier, one call for the whole list — same
// shape as useClientOverviewStatsMap.
export function useSupplierPurchaseTotalsMap() {
  const { activeCompanyId, isReady } = useWorkspace();
  const { data, ...rest } = useQuery({
    queryKey: ["suppliers", "purchase-totals", activeCompanyId],
    queryFn: async () => {
      return await db.suppliers.getPurchaseTotals(activeCompanyId);
    },
    enabled: isReady,
  });
  const byId = new Map<string, SupplierPurchaseTotal>();
  data?.forEach((t) => byId.set(t.supplier_id, t));
  return { data: byId, ...rest };
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useWorkspace();

  return useMutation({
    mutationFn: async (supplier: Omit<CreateSupplierData, "company_id">) => {
      const validated = supplierSchema.parse(supplier);
      return await db.suppliers.create({ ...validated, company_id: activeCompanyId } as CreateSupplierData);
    },
    onSuccess: (supplier) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "CREATE",
        entity_type: "SUPPLIER",
        entity_id: supplier?.id || null,
        description: `Nouveau fournisseur ${supplier?.name || ""} créé avec succès`,
      });

      toast.success("Fournisseur créé avec succès");
    },
    onError: (error: any) => {
      if (error.issues) {
        toast.error(error.issues[0]?.message || "Erreur de validation");
      } else {
        toast.error("Erreur lors de la création du fournisseur");
      }
      logError("Supplier creation error", error);
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...supplier }: Partial<Supplier> & { id: string }) => {
      const validated = supplierSchema.partial().parse(supplier);
      return await db.suppliers.update(id, validated as CreateSupplierData);
    },
    onSuccess: (supplier) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "UPDATE",
        entity_type: "SUPPLIER",
        entity_id: supplier?.id || null,
        description: `Fournisseur ${supplier?.name || ""} mis à jour avec succès`,
      });

      toast.success("Fournisseur mis à jour avec succès");
    },
    onError: (error: any) => {
      if (error.issues) {
        toast.error(error.issues[0]?.message || "Erreur de validation");
      } else {
        toast.error("Erreur lors de la mise à jour du fournisseur");
      }
      logError("Supplier update error", error);
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await db.suppliers.delete(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "DELETE",
        entity_type: "SUPPLIER",
        entity_id: id,
        description: `Fournisseur supprimé`,
      });
    },
    onError: (error) => {
      toast.error("Erreur lors de la suppression du fournisseur");
      logError("Supplier deletion error", error);
    },
  });
}

// Re-creates a deleted supplier verbatim for the delete-toast's "Annuler"
// action — a new row (fresh id/timestamps), not a true undo, since the
// backend has no soft-delete. Good enough for the 5s window the toast is
// visible: nothing else can reference the old id in that time.
export function useRestoreSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (supplier: Supplier) => {
      const { id: _id, created_at: _created_at, updated_at: _updated_at, is_active: _is_active, ...data } = supplier;
      return await db.suppliers.create(data as CreateSupplierData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Fournisseur restauré");
    },
    onError: (error) => {
      toast.error("Erreur lors de la restauration du fournisseur");
      logError("Supplier restore error", error);
    },
  });
}
