import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { partnerSchema, partnerWithdrawalSchema } from "@/lib/validations";
import { mapErrorToUserMessage, isValidationError } from "@/lib/errorMapper";
import { logError } from "@/lib/errorLogger";
import {
  db,
  type CreatePartnerData,
  type UpdatePartnerData,
  type CreateWithdrawalData,
} from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";

export function usePartners(year?: number, months?: string[]) {
  const { activeCompanyId, isReady } = useWorkspace();
  return useQuery({
    queryKey: ["partners", activeCompanyId, year, months],
    queryFn: () => db.partners.getAll(activeCompanyId, year, months),
    enabled: isReady,
  });
}

export function usePartnerWithdrawals(partner_id: string | undefined) {
  return useQuery({
    queryKey: ["partners", "withdrawals", partner_id],
    queryFn: () => db.partners.getWithdrawals(partner_id!),
    enabled: !!partner_id,
  });
}

export function useCreatePartner() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useWorkspace();
  return useMutation({
    mutationFn: async (data: Omit<CreatePartnerData, "company_id">) => {
      const validated = partnerSchema.parse(data) as Omit<CreatePartnerData, "company_id">;
      return await db.partners.create({ ...validated, company_id: activeCompanyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast.success("Associé ajouté avec succès");
    },
    onError: (error: unknown) => {
      if (isValidationError(error)) {
        toast.error(error.issues[0]?.message || "Erreur de validation");
      } else {
        // Rust's equity-total-exceeds-100% check throws its own friendly,
        // French, non-schema-leaking message — surface it verbatim rather
        // than mapErrorToUserMessage's generic fallback.
        const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
        toast.error(message || "Erreur lors de l'ajout de l'associé");
      }
      logError("Partner creation error", error);
    },
  });
}

export function useUpdatePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePartnerData }) => {
      const validated = partnerSchema.parse(data) as UpdatePartnerData;
      return await db.partners.update(id, { ...validated, is_active: data.is_active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast.success("Associé mis à jour avec succès");
    },
    onError: (error: unknown) => {
      if (isValidationError(error)) {
        toast.error(error.issues[0]?.message || "Erreur de validation");
      } else {
        const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
        toast.error(message || "Erreur lors de la mise à jour de l'associé");
      }
      logError("Partner update error", error);
    },
  });
}

export function useDeletePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.partners.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast.success("Associé supprimé avec succès");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la suppression de l'associé");
    },
  });
}

export function useRecordPartnerWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateWithdrawalData) => {
      const validated = partnerWithdrawalSchema.parse(data) as CreateWithdrawalData;
      return await db.partners.recordWithdrawal(validated);
    },
    onSuccess: (withdrawal) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partners", "withdrawals", withdrawal.partner_id] });
      toast.success("Prélèvement enregistré avec succès");
    },
    onError: (error: unknown) => {
      if (isValidationError(error)) {
        toast.error(error.issues[0]?.message || "Erreur de validation");
      } else {
        const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
        toast.error(message || mapErrorToUserMessage(error));
      }
      logError("Partner withdrawal error", error);
    },
  });
}

export function useDeletePartnerWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.partners.deleteWithdrawal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partners", "withdrawals"] });
      toast.success("Prélèvement supprimé avec succès");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la suppression du prélèvement");
    },
  });
}
