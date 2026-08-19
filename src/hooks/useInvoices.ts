import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createInvoiceSchema } from "@/lib/validations";
import { logError } from "@/lib/errorLogger";
import { db, type Invoice, type CreateInvoiceData as DbCreateInvoiceData } from "@/lib/database";
import type { Client } from "@/lib/database";

export type InvoiceStatus = "draft" | "issued" | "paid" | "partial" | "overdue" | "cancelled";
export type InvoiceType = "invoice" | "credit_note" | "proforma";

export interface InvoiceWithClient extends Invoice {
  clients?: {
    name: string;
    email: string | null;
  };
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  amount: number | null;
  products?: {
    code: string;
    name: string;
    unit?: string | null;
    description?: string | null;
  };
}

export interface CreateInvoiceData {
  client_id: string;
  invoice_date: string;
  due_date?: string;
  month_period?: string;
  notes?: string;
  header_note?: string;
  invoice_type?: InvoiceType;
  original_invoice_id?: string;
  discount?: number;
  discount_type?: string;
  discount_value?: number;
  custom_title?: string | null;
  invoice_number?: string;
  payment_method?: string | null;
  use_secondary_register?: boolean;
  selected_secondary_rc?: string | null;
  selected_secondary_address?: string | null;
  items: {
    product_id: string;
    product_description?: string | null;
    quantity: number;
    unit_price: number;
    tva_rate?: number | null;
    timbre_exempt?: boolean;
  }[];
}

export function useInvoices(status?: InvoiceStatus, invoiceType?: InvoiceType) {
  return useQuery({
    queryKey: ["invoices", status, invoiceType],
    queryFn: async () => {
      // Use optimized backend command that performs the JOIN
      return await db.invoices.getAllWithClients(status || undefined, invoiceType || undefined);
    },
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: async () => {
      if (!id) {
        console.log("useInvoice: No ID provided");
        return null;
      }

      console.log("useInvoice: Fetching invoice with ID:", id);

      try {
        const invoice = await db.invoices.getById(id);

        if (!invoice) {
          console.log("useInvoice: Invoice not found for ID:", id);
          return null;
        }

        console.log("useInvoice: Invoice found:", invoice.invoice_number);

        // Fetch client data
        const client = await db.clients.getById(invoice.client_id);

        // Fetch invoice items
        const invoiceItems = await db.invoices.getItems(id);

        console.log("useInvoice: Invoice items count:", invoiceItems.length);

        return {
          ...invoice,
          clients: client ? {
            id: client.id,
            name: client.name,
            address: client.address,
            nif: client.nif,
            nis: client.nis,
            rc: client.rc,
            secondary_rc: client.secondary_rc,
            secondary_address: client.secondary_address,
            ai: client.ai,
          } : undefined,
          invoice_items: invoiceItems,
        };
      } catch (error) {
        console.error("useInvoice: Error fetching invoice:", error);
        throw error;
      }
    },
    enabled: !!id,
    retry: 1,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInvoiceData) => {
      // Validate input
      const validated = createInvoiceSchema.parse(data);
      return await db.invoices.create(validated as DbCreateInvoiceData);
    },
    onSuccess: (invoice, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
      // Invalidate client products cache for this client
      if (invoice.client_id) {
        queryClient.invalidateQueries({ queryKey: ["client-products", invoice.client_id] });
      }
      const message = variables.invoice_type === "credit_note"
        ? "Facture d'avoir créée avec succès"
        : "Facture créée avec succès";

      db.history.log({
        action: "CREATE",
        entity_type: "INVOICE",
        entity_id: invoice.id,
        description: `${message} ${invoice.invoice_number ? `(${invoice.invoice_number})` : ""}`.trim(),
      });

      toast.success(message);
    },
    onError: (error: any) => {
      if (error.issues) {
        toast.error(error.issues[0]?.message || "Erreur de validation");
      } else {
        toast.error("Erreur lors de la création de la facture");
      }
      logError("Invoice creation error", error);
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateInvoiceData }) => {
      // Validate input
      const validated = createInvoiceSchema.parse(data);
      return await db.invoices.update(id, validated as DbCreateInvoiceData);
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", invoice.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      const inv = invoice as any;
      if (inv?.client_id) {
        queryClient.invalidateQueries({ queryKey: ["client-products", inv.client_id] });
      }

      db.history.log({
        action: "UPDATE",
        entity_type: "INVOICE",
        entity_id: invoice.id,
        description: `Facture ${invoice.invoice_number || ""} modifiée avec succès`,
      });

      toast.success("Facture mise à jour avec succès");
    },
    onError: (error: any) => {
      if (error.issues) {
        toast.error(error.issues[0]?.message || "Erreur de validation");
      } else {
        toast.error("Erreur lors de la mise à jour de la facture");
      }
      logError("Invoice update error", error);
    },
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
      return await db.invoices.updateStatus(id, status);
    },
    onSuccess: (invoice, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
      // Invalidate client products cache for this client
      const inv = invoice as any;
      if (inv?.client_id) {
        queryClient.invalidateQueries({ queryKey: ["client-products", inv.client_id] });
      }

      db.history.log({
        action: "UPDATE",
        entity_type: "INVOICE",
        entity_id: variables.id,
        description: `Statut facture mis à jour : ${variables.status}`,
      });

      toast.success("Statut mis à jour");
    },
    onError: (error) => {
      toast.error("Erreur lors de la mise à jour du statut");
      logError("Invoice status update error", error);
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await db.invoices.delete(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["client-products"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "DELETE",
        entity_type: "INVOICE",
        entity_id: id,
        description: `Facture supprimée`,
      });

      toast.success("Facture supprimée avec succès");
    },
    onError: (error) => {
      toast.error("Erreur lors de la suppression de la facture");
      logError("Invoice deletion error", error);
    },
  });
}

export function useConvertProforma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await db.invoices.convertProforma(id);
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "CONVERT",
        entity_type: "INVOICE",
        entity_id: invoice.id,
        description: `Proforma convertie en Facture ${invoice.invoice_number || ""}`,
      });

      toast.success("Proforma convertie en facture avec succès");
    },
    onError: (error) => {
      toast.error("Erreur lors de la conversion de la proforma");
      logError("Proforma conversion error", error);
    },
  });
}

export function useInvoiceStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      // TODO: Implement stats fetching using local DB
      // const stats = await db.invoices.getStats();
      return {
        total: 0,
        paid: 0,
        unpaid: 0,
        overdue: 0,
        count: 0,
      };
    },
  });
}
