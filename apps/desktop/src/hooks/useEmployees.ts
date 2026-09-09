import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, Employee, CreateEmployeeData } from "@/lib/database";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";

export const useEmployees = () => {
    const queryClient = useQueryClient();
    const { activeCompanyId, isReady } = useWorkspace();

    const query = useQuery({
        queryKey: ["employees", activeCompanyId],
        queryFn: () => db.employees.getAll(activeCompanyId),
        enabled: isReady,
    });

    const createMutation = useMutation({
        mutationFn: (data: Omit<CreateEmployeeData, "company_id">) => db.employees.create({ ...data, company_id: activeCompanyId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            queryClient.invalidateQueries({ queryKey: ["employee-hr-stats"] });
            queryClient.invalidateQueries({ queryKey: ["employee-payroll-summaries"] });
            toast.success("Employé ajouté avec succès");
        },
        onError: (error: any) => {
            toast.error(`Erreur lors de l'ajout: ${error.message || error}`);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Omit<CreateEmployeeData, "company_id"> }) =>
            db.employees.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            queryClient.invalidateQueries({ queryKey: ["employee-hr-stats"] });
            queryClient.invalidateQueries({ queryKey: ["employee-payroll-summaries"] });
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
            queryClient.invalidateQueries({ queryKey: ["employee-hr-stats"] });
            queryClient.invalidateQueries({ queryKey: ["employee-payroll-summaries"] });
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

export function useEmployeeHrStats(year: string) {
    const { activeCompanyId, isReady } = useWorkspace();
    return useQuery({
        queryKey: ["employee-hr-stats", activeCompanyId, year],
        queryFn: () => db.payroll.getHrStats(activeCompanyId, year),
        enabled: isReady,
    });
}

export function useEmployeePayrollSummaries() {
    const { activeCompanyId, isReady } = useWorkspace();
    return useQuery({
        queryKey: ["employee-payroll-summaries", activeCompanyId],
        queryFn: () => db.payroll.getEmployeeSummaries(activeCompanyId),
        enabled: isReady,
    });
}

export function useEmployeeTaskWorkload() {
    const { activeCompanyId, isReady } = useWorkspace();
    return useQuery({
        queryKey: ["employee-task-workload", activeCompanyId],
        queryFn: () => db.employeeTaskWorkload.getAll(activeCompanyId),
        enabled: isReady,
    });
}

export function useSetEmployeePhoto() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ employeeId, sourcePath }: { employeeId: string; sourcePath: string }) =>
            db.employees.setPhoto(employeeId, sourcePath),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            toast.success("Photo mise à jour");
        },
        onError: (error: any) => {
            toast.error(`Erreur lors de l'envoi de la photo: ${error.message || error}`);
        },
    });
}

export function useRemoveEmployeePhoto() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (employeeId: string) => db.employees.removePhoto(employeeId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            toast.success("Photo supprimée");
        },
        onError: (error: any) => {
            toast.error(`Erreur lors de la suppression de la photo: ${error.message || error}`);
        },
    });
}
