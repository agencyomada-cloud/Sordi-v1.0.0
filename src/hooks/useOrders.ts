import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { mapErrorToUserMessage } from "@/lib/errorMapper";
import { logError } from "@/lib/errorLogger";
import { db, type Order as DbOrder, type CreateOrderData as DbCreateOrderData } from "@/lib/database";

export interface Order extends DbOrder {
  clients?: {
    name: string;
    code: string | null;
    address?: string | null;
    city?: string | null;
    wilaya?: string | null;
    phone?: string | null;
    email?: string | null;
    nif?: string | null;
    nis?: string | null;
    rc?: string | null;
    ai?: string | null;
  };
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  amount: number | null;
  product_name?: string | null;
  product_code?: string | null;
  products?: {
    name: string;
    code: string;
    unit: string | null;
  };
}

export interface CreateOrderData {
  client_id?: string | null;
  supplier_name?: string | null;
  supplier_address?: string | null;
  supplier_email?: string | null;
  supplier_phone?: string | null;
  supplier_rc?: string | null;
  supplier_nif?: string | null;
  supplier_nis?: string | null;
  supplier_ai?: string | null;
  order_date: string;
  delivery_date?: string;
  payment_terms?: string;
  payment_method?: string;
  notes?: string;
  custom_title?: string;
  order_number?: string;
  items: {
    product_id?: string | null;
    product_name?: string | null;
    product_code?: string | null;
    quantity: number;
    unit_price: number;
  }[];
}

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const orders = await db.orders.getAll();

      // Fetch clients separately (only for orders that have a client_id)
      const clientIds = [...new Set(orders.map((o) => o.client_id).filter((id): id is string => !!id))];
      const clients = await Promise.all(clientIds.map(id => db.clients.getById(id)));
      const clientMap = new Map(clients.filter(c => c !== null).map(c => [c!.id, c!]));

      return orders.map((order) => ({
        ...order,
        clients: clientMap.get(order.client_id) ? {
          name: clientMap.get(order.client_id)!.name,
          code: clientMap.get(order.client_id)!.code,
        } : undefined,
      })) as Order[];
    },
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["orders", id],
    queryFn: async () => {
      if (!id) return null;
      const order = await db.orders.getById(id);
      if (!order) return null;

      const client = order.client_id ? await db.clients.getById(order.client_id) : null;
      return {
        ...order,
        clients: client ? {
          name: client.name,
          code: client.code,
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
      } as Order;
    },
    enabled: !!id,
  });
}

export function useOrderItems(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order_items", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const items = await db.orders.getItems(orderId);
      return items.map((item: any) => ({
        ...item,
        product_code: item.products?.code,
        product_name: item.products?.name,
        unit: item.products?.unit,
        unit_price: item.products?.unit_price || item.unit_price,
        // Ensure nested object exists if needed (though flattening is preferred)
        products: item.products
      })) as OrderItem[];
    },
    enabled: !!orderId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateOrderData) => {
      return await db.orders.create(data as DbCreateOrderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Bon de commande créé avec succès");
    },
    onError: (error) => {
      toast.error(mapErrorToUserMessage(error));
      logError("Create order error", error);
    },
  });

}

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateOrderData }) => {
      // Note: We might want to validate data here if there's a schema for updation
      // For now assuming passed data matches interface
      return await db.orders.update(id, data as DbCreateOrderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      // Invalidate specific order query as well
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Bon de commande modifié avec succès");
    },
    onError: (error) => {
      toast.error(mapErrorToUserMessage(error));
      logError("Update order error", error);
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await db.orders.updateStatus(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Statut mis à jour");
    },
    onError: (error) => {
      toast.error(mapErrorToUserMessage(error));
      logError("Update order status error", error);
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await db.orders.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Bon de commande supprimé");
    },
    onError: (error) => {
      toast.error(mapErrorToUserMessage(error));
      logError("Delete order error", error);
    },
  });
}

export function useNextOrderNumber() {
  // Add invoke import manually if needed, or assume it is imported or available in global scope if backend uses invoke. 
  // Wait, useOrders.ts doesn't import `invoke`. I need to add that import too. 
  // Wait, useQuery is all I need if I used a db wrapper, but get_next_order_number is a command.
  // I should check if `invoke` is imported. It is NOT imported in the file view above.
  // The file uses `db.orders.getAll()`.
  // I should probably add `getNextOrderNumber` to `db` object in `database.ts` or just use `invoke` here.
  // Let's add `invoke` to imports first, then add the hook.
  // Actually, following the pattern, I should probably add it to `database.ts`.
  // But for speed, I will use `invoke` here.
  // So I need to add `import { invoke } from "@tauri-apps/api/core";` at the top.

  // I will use two edits. One for import, one for hook.
  // This tool call is for the hook. I'll just assume I'll fix the import in next call or use `db` if I add it there.
  // Let's stick to adding it here but I need `invoke`.

  // Better plan: Add `getNextOrderNumber` to `database.ts` first? No, that file is big.
  // I'll add `import { invoke } from "@tauri-apps/api/core";` here.
  return useQuery({
    queryKey: ["next-order-number"],
    queryFn: async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<string>("get_next_order_number");
    },
  });
}
