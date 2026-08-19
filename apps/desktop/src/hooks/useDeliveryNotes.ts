import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { createDeliveryNoteSchema } from "@/lib/validations";
import { logError } from "@/lib/errorLogger";
import { db, type DeliveryNote as DbDeliveryNote, type CreateDeliveryNoteData as DbCreateDeliveryNoteData } from "@/lib/database";

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
  products?: {
    code: string;
    name: string;
    unit_price: number;
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
  items: {
    product_id: string;
    quantity: number;
  }[];
}

export function useDeliveryNotes(clientId?: string, isInvoiced?: boolean) {
  return useQuery({
    queryKey: ["delivery-notes", clientId, isInvoiced],
    queryFn: async () => {
      const notes = await db.deliveryNotes.getAll(clientId, isInvoiced);

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
          } : undefined,
          delivery_note_items: items,
        };
      }));

      return notesWithItems as DeliveryNote[];
    },
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

  return useMutation({
    mutationFn: async (data: CreateDeliveryNoteData) => {
      // Validate input
      const validated = createDeliveryNoteSchema.parse(data);
      return await db.deliveryNotes.create(validated as DbCreateDeliveryNoteData);
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
        toast.error("Erreur lors de la modification du bon de livraison");
      }
      logError("Delivery note update error", error);
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
