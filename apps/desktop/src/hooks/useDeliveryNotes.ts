import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { createDeliveryNoteSchema } from "@/lib/validations";
import { logError } from "@/lib/errorLogger";
import { db, type DeliveryNote as DbDeliveryNote, type CreateDeliveryNoteData as DbCreateDeliveryNoteData, type DeliveryNoteStatus } from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface DeliveryNote extends DbDeliveryNote {
  clients?: {
    name: string;
  };
  delivery_note_items?: DeliveryNoteItem[];
}

export interface DeliveryNoteItem {
  id: string;
  delivery_note_id: string;
  product_id: string;
  quantity: number;
  // Only populated by useDeliveryNote (singular) 's own mapping — the list
  // hook (useDeliveryNotes) returns items raw, without these projected.
  product_code?: string;
  product_name?: string;
  product_description?: string | null;
  unit_price?: number;
  tva_rate?: number | null;
  products?: {
    code: string;
    name: string;
    unit_price: number;
    unit?: string | null;
    description?: string | null;
  };
}

export interface CreateDeliveryNoteData {
  client_id: string;
  delivery_date: string;
  order_id?: string;
  truck_plate?: string;
  driver_name?: string;
  deliverer_name?: string;
  deliverer_nin?: string;
  transporter_name?: string;
  transporter_nin?: string;
  delivery_location?: string;
  notes?: string;
  reserves?: string;
  custom_title?: string;
  delivery_number?: string;
  supplier_delivered_date?: string;
  client_received_date?: string;
  /** "Nom du réceptionnaire" — a plain text field despite the column name. */
  client_signature?: string;
  items: {
    product_id?: string;
    /** Only meaningful when product_id is absent — a custom/one-off item. */
    product_name?: string;
    product_code?: string;
    quantity: number;
    unit_price?: number;
    tva_rate?: number;
  }[];
}

export function useDeliveryNotes(clientId?: string, isInvoiced?: boolean) {
  const { activeCompanyId, isReady } = useWorkspace();
  return useQuery({
    queryKey: ["delivery-notes", activeCompanyId, clientId, isInvoiced],
    queryFn: async () => {
      const notes = await db.deliveryNotes.getAll(activeCompanyId, clientId, isInvoiced);

      // Fetch clients separately
      const clientIds = [...new Set(notes.map(n => n.client_id))];
      const clients = await Promise.all(clientIds.map(id => db.clients.getById(id)));
      const clientMap = new Map(clients.filter(c => c !== null).map(c => [c!.id, c!]));

      // Fetch items for each note
      const notesWithItems = await Promise.all(notes.map(async (note) => {
        const items = await db.deliveryNotes.getItems(note.id);
        return {
          ...note,
          clients: clientMap.get(note.client_id) ? {
            name: clientMap.get(note.client_id)!.name,
            address: clientMap.get(note.client_id)!.address,
            city: clientMap.get(note.client_id)!.city,
            wilaya: clientMap.get(note.client_id)!.wilaya,
            phone: clientMap.get(note.client_id)!.phone,
            email: clientMap.get(note.client_id)!.email,
            nif: clientMap.get(note.client_id)!.nif,
            nis: clientMap.get(note.client_id)!.nis,
            rc: clientMap.get(note.client_id)!.rc,
            ai: clientMap.get(note.client_id)!.ai,
            contact_person: clientMap.get(note.client_id)!.contact_person,
          } : undefined,
          delivery_note_items: items,
        };
      }));

      return notesWithItems as DeliveryNote[];
    },
    enabled: isReady,
  });
}

export function useDeliveryNote(id: string | undefined) {
  return useQuery({
    queryKey: ["delivery-note", id],
    queryFn: async () => {
      if (!id) return null;
      const note = await db.deliveryNotes.getById(id);
      if (!note) return null;

      // Fetch client
      const client = await db.clients.getById(note.client_id);

      // Fetch items
      const items = await db.deliveryNotes.getItems(id);

      // Fetch order if exists
      let order = null;
      if (note.order_id) {
        order = await db.orders.getById(note.order_id);
      }

      return {
        ...note,
        clients: client ? {
          name: client.name,
          address: client.address,
          city: client.city,
          wilaya: client.wilaya,
          phone: client.phone,
          email: client.email,
          nif: client.nif,
          nis: client.nis,
          rc: client.rc,
          ai: client.ai,
          contact_person: client.contact_person,
        } : undefined,
        delivery_note_items: items.map(item => ({
          ...item,
          product_description: item.products?.description || item.product_description,
          product_code: item.products?.code,
          product_name: item.products?.name,
          unit_price: item.products?.unit_price || 0,
          products: item.products ? {
            code: item.products.code,
            name: item.products.name,
            unit: item.products.unit || null,
            unit_price: item.products.unit_price || 0,
            description: item.products.description || null,
          } : undefined,
        })),
        orders: order ? {
          order_number: order.order_number,
        } : undefined,
      } as DeliveryNote & {
        delivery_note_items?: DeliveryNoteItem[];
        orders?: { order_number: string };
      };
    },
    enabled: !!id,
  });
}

export function useCreateDeliveryNote() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useWorkspace();

  return useMutation({
    mutationFn: async (data: CreateDeliveryNoteData) => {
      // Validate input
      const validated = createDeliveryNoteSchema.parse(data);
      return await db.deliveryNotes.create({ ...validated, company_id: activeCompanyId } as DbCreateDeliveryNoteData);
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "CREATE",
        entity_type: "DELIVERY",
        entity_id: note?.id || null,
        description: `Bon de livraison ${note?.delivery_number || ""} créé avec succès`,
      });

      toast.success("Bon de livraison créé avec succès");
    },
    onError: (error: any) => {
      if (error.issues) {
        toast.error(error.issues[0]?.message || "Erreur de validation");
      } else {
        toast.error("Erreur lors de la création du bon de livraison");
      }
      logError("Delivery note creation error", error);
    },
  });
}

export function useUpdateDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateDeliveryNoteData }) => {
      // Validate input
      const validated = createDeliveryNoteSchema.parse(data);
      return await db.deliveryNotes.update(id, validated as DbCreateDeliveryNoteData);
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-note"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "UPDATE",
        entity_type: "DELIVERY",
        entity_id: note?.id || null,
        description: `Bon de livraison ${note?.delivery_number || ""} modifié avec succès`,
      });

      toast.success("Bon de livraison modifié avec succès");
    },
    onError: (error: any) => {
      if (error.issues) {
        toast.error(error.issues[0]?.message || "Erreur de validation");
      } else {
        const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
        toast.error(message || "Erreur lors de la modification du bon de livraison");
      }
      logError("Delivery note update error", error);
    },
  });
}

export function useSetDeliveryStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DeliveryNoteStatus }) => {
      return await db.deliveryNotes.updateStatus(id, status);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-note"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "UPDATE",
        entity_type: "DELIVERY",
        entity_id: variables.id,
        description: `Statut du bon de livraison mis à jour : ${variables.status}`,
      });
    },
    onError: (error: any) => {
      toast.error("Erreur lors de la mise à jour du statut");
      logError("Delivery note status update error", error);
    },
  });
}

export function useDeleteDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await db.deliveryNotes.delete(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });

      db.history.log({
        action: "DELETE",
        entity_type: "DELIVERY",
        entity_id: id,
        description: "Bon de livraison supprimé",
      });

      toast.success("Bon de livraison supprimé avec succès");
    },
    onError: (error: any) => {
      toast.error("Erreur lors de la suppression");
      logError("Delete delivery note error", error);
    },
  });
}

export function useGenerateInvoiceFromDeliveries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deliveryNoteIds,
      clientId,
      invoiceDate
    }: {
      deliveryNoteIds: string[];
      clientId: string;
      invoiceDate: string;
    }) => {
      const result = await invoke("generate_invoice_from_delivery_notes", {
        deliveryNoteIds,
        invoiceDate,
        dueDate: invoiceDate // Default due date to invoice date for now
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Facture générée à partir des bons de livraison");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erreur lors de la génération de la facture");
      logError("Invoice generation from deliveries error", error);
    },
  });
}
