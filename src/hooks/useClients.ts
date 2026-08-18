import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clientSchema } from "@/lib/validations";
import { logError } from "@/lib/errorLogger";
import { db, type Client, type CreateClientData } from "@/lib/database";
export type { CreateClientData };

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      return await db.clients.getAll();
    },
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

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (client: CreateClientData) => {
      // Validate input
      const validated = clientSchema.parse(client);
      return await db.clients.create(validated as CreateClientData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client supprimé avec succès");
    },
    onError: (error) => {
      toast.error("Erreur lors de la suppression du client");
      logError("Client deletion error", error);
    },
  });
}
