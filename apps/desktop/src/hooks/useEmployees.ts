import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, Employee, CreateEmployeeData } from "@/lib/database";
import { toast } from "sonner";

export const useEmployees = () => {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["employees"],
        queryFn: () => db.employees.getAll(),
    });

    const createMutation = useMutation({
        mutationFn: (data: CreateEmployeeData) => db.employees.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            toast.success("Employé ajouté avec succès");
        },
        onError: (error: any) => {
            toast.error(`Erreur lors de l'ajout: ${error.message || error}`);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: CreateEmployeeData }) =>
            db.employees.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            toast.success("Employé mis à jour avec succès");
        },
        onError: (error: any) => {
            toast.error(`Erreur lors de la modification: ${error.message || error}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => db.employees.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            toast.success("Employé supprimé avec succès");
        },
        onError: (error: any) => {
            toast.error(`Erreur lors de la suppression: ${error.message || error}`);
        },
    });

    return {
        ...query,
        createEmployee: createMutation,
        updateEmployee: updateMutation,
        deleteEmployee: deleteMutation,
    };
};
