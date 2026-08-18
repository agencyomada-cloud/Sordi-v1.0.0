import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, EmployeeScore, CreateScoreData } from "@/lib/database";
import { toast } from "sonner";

export const useScores = (month: string, year: string) => {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["scores", month, year],
        queryFn: () => db.scores.getByPeriod(month, year),
    });

    const upsertMutation = useMutation({
        mutationFn: (data: CreateScoreData) => db.scores.upsert(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["scores", month, year] });
        },
        onError: (error: any) => {
            toast.error(`Erreur lors de l'enregistrement: ${error.message || error}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => db.scores.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["scores", month, year] });
            toast.success("Note supprimée");
        },
        onError: (error: any) => {
            toast.error(`Erreur lors de la suppression: ${error.message || error}`);
        },
    });

    return {
        ...query,
        upsertScore: upsertMutation,
        deleteScore: deleteMutation,
    };
};
