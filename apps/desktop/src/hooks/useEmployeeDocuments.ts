import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db } from "@/lib/database";

export function useEmployeeDocuments(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["employee-documents", employeeId],
    queryFn: () => db.employeeDocuments.getAll(employeeId!),
    enabled: !!employeeId,
  });
}

export function useAddEmployeeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, sourcePath, name, docType }: { employeeId: string; sourcePath: string; name: string; docType: string | null }) =>
      db.employeeDocuments.add(employeeId, sourcePath, name, docType),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["employee-documents", doc.employee_id] });
      toast.success("Document ajouté");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de l'ajout du document");
    },
  });
}

export function useDeleteEmployeeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; employeeId: string }) => db.employeeDocuments.delete(id),
    onSuccess: (_result, { employeeId }) => {
      queryClient.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
      toast.success("Document supprimé");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la suppression du document");
    },
  });
}
