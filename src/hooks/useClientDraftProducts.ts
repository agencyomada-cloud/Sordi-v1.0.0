import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, type CreateClientDraftProductData } from "@/lib/database";
import { toast } from "sonner";

export function useClientDraftProducts(clientId: string | undefined) {
    return useQuery({
        queryKey: ["client-draft-products", clientId],
        queryFn: () => {
            if (!clientId) return [];
            return db.clientDrafts.getAll(clientId);
        },
        enabled: !!clientId,
    });
}

export function useAddClientDraftProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateClientDraftProductData) => db.clientDrafts.create(data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["client-draft-products", variables.client_id] });
            toast.success("Produit ajouté à l'avance");
        },
        onError: (error) => {
            toast.error("Erreur lors de l'ajout du produit: " + error);
        },
    });
}

export function useUpdateClientDraftProductQuantity() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { id: string, quantity: number, client_id: string }) =>
            db.clientDrafts.updateQuantity(data.id, data.quantity),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["client-draft-products", variables.client_id] });
        },
        onError: (error) => {
            toast.error("Erreur lors de la modification de la quantité: " + error);
        },
    });
}

export function useDeleteClientDraftProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id }: { id: string; client_id: string }) => db.clientDrafts.delete(id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["client-draft-products", variables.client_id] });
            toast.success("Produit retiré");
        },
        onError: (error) => {
            toast.error("Erreur lors de la suppression: " + error);
        },
    });
}

export function useClearClientDraftProducts() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (clientId: string) => db.clientDrafts.clear(clientId),
        onSuccess: (_, clientId) => {
            queryClient.invalidateQueries({ queryKey: ["client-draft-products", clientId] });
        },
        onError: (error) => {
            console.error("Erreur lors de la suppression des brouillons: ", error);
        },
    });
}
