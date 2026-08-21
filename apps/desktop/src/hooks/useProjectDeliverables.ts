import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db, type CreateProjectDeliverableData, type UpdateProjectDeliverableData } from "@/lib/database";
export type { CreateProjectDeliverableData, UpdateProjectDeliverableData };

export function useProjectDeliverables(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-deliverables", projectId],
    queryFn: () => db.projectDeliverables.getAll(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateProjectDeliverable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectDeliverableData) => db.projectDeliverables.create(data),
    onSuccess: (deliverable) => {
      queryClient.invalidateQueries({ queryKey: ["project-deliverables", deliverable.project_id] });
      toast.success("Livrable ajouté");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de l'ajout du livrable");
    },
  });
}

export function useUpdateProjectDeliverable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectDeliverableData }) => db.projectDeliverables.update(id, data),
    onSuccess: (deliverable) => {
      queryClient.invalidateQueries({ queryKey: ["project-deliverables", deliverable.project_id] });
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la mise à jour du livrable");
    },
  });
}

export function useDeleteProjectDeliverable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => db.projectDeliverables.delete(id),
    onSuccess: (_result, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["project-deliverables", projectId] });
      toast.success("Livrable supprimé");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la suppression du livrable");
    },
  });
}
