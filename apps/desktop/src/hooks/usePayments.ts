import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { paymentSchema } from "@/lib/validations";
import { logError } from "@/lib/errorLogger";
import { db, type Payment, type CreatePaymentData } from "@/lib/database";

export function usePayments(invoiceId?: string) {
  return useQuery({
    queryKey: ["payments", invoiceId],
    queryFn: async () => {
      return await db.payments.getAll(invoiceId);
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: CreatePaymentData) => {
      // Validate input
      const validated = paymentSchema.parse(payment) as CreatePaymentData;
      return await db.payments.create(validated);
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
    mutationFn: async ({ id, data }: { id: string; data: CreatePaymentData }) => {
      const validated = paymentSchema.parse(data) as CreatePaymentData;
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

      toast.success("Paiement supprimé avec succès");
    },
    onError: (error: any) => {
      toast.error("Erreur lors de la suppression du paiement");
      logError("Payment deletion error", error);
    },
  });
}
