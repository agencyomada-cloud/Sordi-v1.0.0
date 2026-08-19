import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, type CreateClientAdvanceData, type UpdateClientAdvanceData } from "@/lib/database";
import { toast } from "sonner";

export function useClientAdvances(clientId: string | undefined) {
    return useQuery({
        queryKey: ["client-advances", clientId],
        queryFn: () => {
            if (!clientId) return [];
            return db.clientAdvances.getAll(clientId);
        },
        enabled: !!clientId,
    });
}

export function useAddClientAdvance() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateClientAdvanceData) => db.clientAdvances.create(data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["client-advances", variables.client_id] });
            queryClient.invalidateQueries({ queryKey: ["clients", variables.client_id] });
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            toast.success("Avance ajoutée avec succès");
        },
        onError: (error) => {
            toast.error("Erreur lors de l'ajout de l'avance: " + error);
        },
    });
}

export function useUpdateClientAdvance() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: UpdateClientAdvanceData & { client_id: string }) => {
            // We pass client_id just for invalidation, the db method doesn't need it
            const payload: UpdateClientAdvanceData = {
                id: data.id,
                amount: data.amount,
                date: data.date,
                payment_mode: data.payment_mode,
                reference: data.reference,
                bank: data.bank,
                issuer_name: data.issuer_name,
                notes: data.notes
            };
            return db.clientAdvances.update(payload);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["client-advances", variables.client_id] });
            queryClient.invalidateQueries({ queryKey: ["clients", variables.client_id] });
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            toast.success("Avance modifiée avec succès");
        },
        onError: (error) => {
            toast.error("Erreur lors de la modification de l'avance: " + error);
        },
    });
}

export function useDeleteClientAdvance() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id }: { id: string; client_id: string }) => db.clientAdvances.delete(id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["client-advances", variables.client_id] });
            queryClient.invalidateQueries({ queryKey: ["clients", variables.client_id] });
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            toast.success("Avance supprimée");
        },
        onError: (error) => {
            toast.error("Erreur lors de la suppression de l'avance: " + error);
        },
    });
}
