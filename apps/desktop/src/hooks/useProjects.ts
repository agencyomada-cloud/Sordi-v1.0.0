import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db, type Project, type CreateProjectData, type ProjectStats, type FreelancePaymentStatus } from "@/lib/database";
export type { CreateProjectData };

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => db.projects.getAll(),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => db.projects.getById(id!),
    enabled: !!id,
  });
}

// project_id omitted -> stats for every project in one call (list page badges).
// project_id set -> just that project (detail page overview).
export function useProjectStats(project_id?: string) {
  return useQuery({
    queryKey: ["projects", "stats", project_id ?? "all"],
    queryFn: () => db.projects.getStats(project_id),
  });
}

export function useProjectStatsMap() {
  const { data, ...rest } = useProjectStats();
  const byProjectId = new Map<string, ProjectStats>((data ?? []).map((s) => [s.project_id, s]));
  return { data: byProjectId, ...rest };
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectData) => db.projects.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projet créé avec succès");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la création du projet");
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateProjectData }) => db.projects.update(id, data),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", id] });
      toast.success("Projet mis à jour avec succès");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la mise à jour du projet");
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.projects.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projet supprimé avec succès");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la suppression du projet");
    },
  });
}

export function useAssignInvoiceToProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, projectId }: { invoiceId: string; projectId: string | null }) =>
      db.projects.assignInvoice(invoiceId, projectId),
    onSuccess: (_result, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["projects", "stats"] });
      toast.success("Facture liée au projet");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la liaison de la facture");
    },
  });
}

export function useSetFreelancerPaymentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, statutPaiement, datePaiement }: { projectId: string; statutPaiement: FreelancePaymentStatus; datePaiement: string | null }) =>
      db.projects.setFreelancerPaymentStatus(projectId, statutPaiement, datePaiement),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", project.id] });
      queryClient.invalidateQueries({ queryKey: ["freelance-payments"] });
      toast.success(project.statut_paiement === "paye" ? "Paiement freelance marqué payé" : "Paiement freelance marqué non payé");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la mise à jour du statut de paiement");
    },
  });
}

export function useAssignFreelancePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      freelancerId,
      montantConvenu,
      statutPaiement,
      datePaiement,
    }: {
      projectId: string;
      freelancerId: string;
      montantConvenu: number;
      statutPaiement: FreelancePaymentStatus;
      datePaiement: string | null;
    }) => db.projects.assignFreelancePayment(projectId, freelancerId, montantConvenu, statutPaiement, datePaiement),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", project.id] });
      queryClient.invalidateQueries({ queryKey: ["freelance-payments"] });
      toast.success("Paiement freelance ajouté");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de l'ajout du paiement freelance");
    },
  });
}

export function useFreelancePayments() {
  return useQuery({
    queryKey: ["freelance-payments"],
    queryFn: () => db.projects.getFreelancePayments(),
  });
}
