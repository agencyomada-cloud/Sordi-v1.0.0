import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, Project, CreateProjectData } from "@/lib/database";
import { toast } from "sonner";

export const useProjects = () => {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["projects"],
        queryFn: () => db.projects.getAll(),
    });

    const createMutation = useMutation({
        mutationFn: (data: CreateProjectData) => db.projects.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            toast.success("Projet ajouté avec succès");
        },
        onError: (error: any) => {
            toast.error(`Erreur lors de l'ajout: ${error.message || error}`);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: CreateProjectData }) =>
            db.projects.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            toast.success("Projet mis à jour avec succès");
        },
        onError: (error: any) => {
            toast.error(`Erreur lors de la modification: ${error.message || error}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => db.projects.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            toast.success("Projet supprimé avec succès");
        },
        onError: (error: any) => {
            toast.error(`Erreur lors de la suppression: ${error.message || error}`);
        },
    });

    return {
        ...query,
        createProject: createMutation,
        updateProject: updateMutation,
        deleteProject: deleteMutation,
    };
};
