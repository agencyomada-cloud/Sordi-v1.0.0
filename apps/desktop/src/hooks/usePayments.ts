import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { paymentSchema } from "@/lib/validations";
import { logError } from "@/lib/errorLogger";
import { db, type Payment, type CreatePaymentData, type PaymentAttachment } from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";

export function usePayments(invoiceId?: string) {
  const { activeCompanyId, isReady } = useWorkspace();
  return useQuery({
    queryKey: ["payments", activeCompanyId, invoiceId],
    queryFn: async () => {
      return await db.payments.getAll(activeCompanyId, invoiceId);
    },
    enabled: isReady,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useWorkspace();

  return useMutation({
    mutationFn: async (payment: Omit<CreatePaymentData, "company_id">) => {
      // Validate input
      const validated = paymentSchema.parse(payment) as Omit<CreatePaymentData, "company_id">;
      return await db.payments.create({ ...validated, company_id: activeCompanyId });
    },
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "CREATE",
        entity_type: "PAYMENT",
        entity_id: payment?.id || null,
        description: `Paiement de ${payment?.amount || ""} DA enregistré avec succès`,
      });

      toast.success("Paiement enregistré avec succès");
    },
    onError: (error: any) => {
      if (error.issues) {
        toast.error(error.issues[0]?.message || "Erreur de validation");
      } else {
        toast.error("Erreur lors de l'enregistrement du paiement");
      }
      logError("Payment creation error", error);
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Omit<CreatePaymentData, "company_id"> }) => {
      const validated = paymentSchema.parse(data) as Omit<CreatePaymentData, "company_id">;
      return await db.payments.update(id, validated);
    },
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "UPDATE",
        entity_type: "PAYMENT",
        entity_id: payment?.id || null,
        description: `Paiement de ${payment?.amount || ""} DA mis à jour`,
      });

      toast.success("Paiement mis à jour avec succès");
    },
    onError: (error: any) => {
      if (error.issues) {
        toast.error(error.issues[0]?.message || "Erreur de validation");
      } else {
        toast.error("Erreur lors de la mise à jour du paiement");
      }
      logError("Payment update error", error);
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await db.payments.delete(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "DELETE",
        entity_type: "PAYMENT",
        entity_id: id,
        description: `Paiement supprimé`,
      });
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || "Erreur lors de la suppression du paiement");
      logError("Payment deletion error", error);
    },
  });
}

// Re-creates a deleted payment verbatim for the delete-toast's "Annuler"
// action — a new row (fresh id/timestamps), not a true undo, since the
// backend has no soft-delete. Any attachment on the deleted payment is gone
// for good (delete_payment removes the files from disk), which is an
// accepted limitation of the 5s undo window, same as Suppliers' restore.
export function useRestorePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: Payment) => {
      const { id: _id, created_at: _created_at, ...data } = payment;
      return await db.payments.create(data as CreatePaymentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Paiement restauré");
    },
    onError: (error) => {
      toast.error("Erreur lors de la restauration du paiement");
      logError("Payment restore error", error);
    },
  });
}

export function usePaymentAttachments(paymentId: string | undefined) {
  return useQuery({
    queryKey: ["payment-attachments", paymentId],
    queryFn: () => db.paymentAttachments.getAll(paymentId!),
    enabled: !!paymentId,
  });
}

export function useAddPaymentAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, sourcePath, fileName }: { paymentId: string; sourcePath: string; fileName: string }) =>
      db.paymentAttachments.add(paymentId, sourcePath, fileName),
    onSuccess: (attachment) => {
      queryClient.invalidateQueries({ queryKey: ["payment-attachments", attachment.payment_id] });
      toast.success("Pièce justificative ajoutée");
    },
    onError: (error: any) => {
      toast.error("Erreur lors de l'ajout de la pièce justificative");
      logError("Payment attachment upload error", error);
    },
  });
}

export function useDeletePaymentAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attachment: PaymentAttachment) => {
      await db.paymentAttachments.delete(attachment.id);
      return attachment;
    },
    onSuccess: (attachment) => {
      queryClient.invalidateQueries({ queryKey: ["payment-attachments", attachment.payment_id] });
      toast.success("Pièce justificative supprimée");
    },
    onError: (error: any) => {
      toast.error("Erreur lors de la suppression de la pièce justificative");
      logError("Payment attachment deletion error", error);
    },
  });
}
