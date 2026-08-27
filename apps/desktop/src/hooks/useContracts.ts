import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db, type CreateContractData } from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";
import { logError } from "@/lib/errorLogger";

export function useContracts() {
  const { activeCompanyId, isReady } = useWorkspace();
  return useQuery({
    queryKey: ["contracts", "all", activeCompanyId],
    queryFn: () => db.contracts.getAll(activeCompanyId),
    enabled: isReady,
  });
}

export function useProjectContracts(project_id: string | undefined) {
  return useQuery({
    queryKey: ["contracts", "project", project_id],
    queryFn: () => db.contracts.getForProject(project_id!),
    enabled: !!project_id,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useWorkspace();

  return useMutation({
    mutationFn: async (data: Omit<CreateContractData, "company_id">) => {
      return await db.contracts.create({ ...data, company_id: activeCompanyId });
    },
    onSuccess: (contract) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
      toast.success(`Contrat ${contract.contract_ref} créé et enregistré avec succès.`);
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la génération du contrat");
      logError("Contract creation error", error);
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.contracts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrat supprimé");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la suppression du contrat");
      logError("Contract deletion error", error);
    },
  });
}
