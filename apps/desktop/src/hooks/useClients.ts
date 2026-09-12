import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clientSchema } from "@/lib/validations";
import { logError } from "@/lib/errorLogger";
import { db, type Client, type CreateClientData, type ClientOverviewStats } from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";
export type { CreateClientData };

export function useClients() {
  const { activeCompanyId, isReady } = useWorkspace();
  return useQuery({
    queryKey: ["clients", activeCompanyId],
    queryFn: async () => {
      return await db.clients.getAll(activeCompanyId);
    },
    enabled: isReady,
    // Client mutations invalidate this key explicitly — a 5-minute
    // staleTime just avoids re-fetching the full (now 100+) client list on
    // every window refocus.
    staleTime: 1000 * 60 * 5,
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ["clients", id],
    queryFn: async () => {
      if (!id) return null;
      return await db.clients.getById(id);
    },
    enabled: !!id,
  });
}

// id omitted -> stats for every client in one call (clients list status badge).
// id set -> just that client's stats (client detail "Aperçu" section).
export function useClientOverviewStats(id?: string) {
  return useQuery({
    queryKey: ["clients", "overview-stats", id ?? "all"],
    queryFn: async () => {
      return await db.clients.getOverviewStats(id);
    },
  });
}

export function useClientOverviewStatsMap() {
  const { data, ...rest } = useClientOverviewStats();
  const byClientId = new Map<string, ClientOverviewStats>();
  data?.forEach((stat) => byClientId.set(stat.client_id, stat));
  return { data: byClientId, ...rest };
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useWorkspace();

  return useMutation({
    mutationFn: async (client: Omit<CreateClientData, "company_id">) => {
      // Validate input
      const validated = clientSchema.parse(client);
      return await db.clients.create({ ...validated, company_id: activeCompanyId } as CreateClientData);
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "CREATE",
        entity_type: "CLIENT",
        entity_id: client?.id || null,
        description: `Nouveau client ${client?.name || ""} créé avec succès`,
      });

      toast.success("Client créé avec succès");
    },
    onError: (error: any) => {
      if (error.issues) {
        toast.error(error.issues[0]?.message || "Erreur de validation");
      } else {
        toast.error("Erreur lors de la création du client");
      }
      logError("Client creation error", error);
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...client }: Partial<Client> & { id: string }) => {
      // Partial validation for update
      const validated = clientSchema.partial().parse(client);
      return await db.clients.update(id, validated as CreateClientData);
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "UPDATE",
        entity_type: "CLIENT",
        entity_id: client?.id || null,
        description: `Client ${client?.name || ""} mis à jour avec succès`,
      });

      toast.success("Client mis à jour avec succès");
    },
    onError: (error: any) => {
      if (error.issues) {
        toast.error(error.issues[0]?.message || "Erreur de validation");
      } else {
        toast.error("Erreur lors de la mise à jour du client");
      }
      logError("Client update error", error);
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await db.clients.delete(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "DELETE",
        entity_type: "CLIENT",
        entity_id: id,
        description: `Client supprimé`,
      });

      toast.success("Client supprimé avec succès");
    },
    onError: (error: unknown) => {
      // Tauri command errors (Result<T, String> on the Rust side) arrive
      // here as a plain string — e.g. "Impossible de supprimer ce client :
      // 1 facture liée. Supprimez-les d'abord." Falling back to a generic
      // message discarded that detail and left the user with no idea why
      // the delete didn't work.
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la suppression du client");
      logError("Client deletion error", error);
    },
  });
}
