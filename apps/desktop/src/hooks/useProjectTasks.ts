import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db, type CreateProjectTaskData, type ProjectTaskStatus, type UpdateProjectTaskData } from "@/lib/database";
export type { CreateProjectTaskData, UpdateProjectTaskData };

export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: () => db.projectTasks.getAll(projectId!),
    enabled: !!projectId,
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>, projectId: string) {
  queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
  queryClient.invalidateQueries({ queryKey: ["projects", "stats", projectId] });
  queryClient.invalidateQueries({ queryKey: ["projects", "stats", "all"] });
}

export function useCreateProjectTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectTaskData) => db.projectTasks.create(data),
    onSuccess: (task) => {
      invalidate(queryClient, task.project_id);
      toast.success("Tâche créée");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la création de la tâche");
    },
  });
}

export function useUpdateProjectTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectTaskData }) => db.projectTasks.update(id, data),
    onSuccess: (task) => {
      invalidate(queryClient, task.project_id);
      toast.success("Tâche mise à jour");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la mise à jour de la tâche");
    },
  });
}

export function useUpdateProjectTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProjectTaskStatus }) => db.projectTasks.updateStatus(id, status),
    onSuccess: (task) => {
      invalidate(queryClient, task.project_id);
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors du changement de statut");
    },
  });
}

export function useDeleteProjectTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => db.projectTasks.delete(id),
    onSuccess: (_result, { projectId }) => {
      invalidate(queryClient, projectId);
      toast.success("Tâche supprimée");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la suppression de la tâche");
    },
  });
}
