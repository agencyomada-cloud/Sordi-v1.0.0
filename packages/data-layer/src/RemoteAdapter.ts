import type { DataClient, EntityClient } from "./types";

/**
 * Scaffolded, not functional. Every method throws until this is wired to a
 * real cloud API. The shape exists now so DataClient has exactly two
 * implementations to review together — `baseUrl`/`getAuthToken` are accepted
 * so call sites configuring this adapter don't change once it's real.
 *
 * Today, apps/api only implements auth/clients/products — invoices,
 * deliveryNotes, orders, payments, and expenses have no server routes yet,
 * so those five would stay stubbed even after clients/products are wired up.
 */
export interface RemoteAdapterConfig {
  baseUrl: string;
  getAuthToken?: () => string | null | undefined;
}

function notImplemented(entity: string, method: string) {
  return (): Promise<never> => {
    throw new Error(
      `RemoteAdapter.${entity}.${method}() is not implemented yet. ` +
      `See packages/data-layer/src/RemoteAdapter.ts.`,
    );
  };
}

function stubEntityClient<TEntity, TCreate, TUpdate, TListParams>(
  entity: string,
): EntityClient<TEntity, TCreate, TUpdate, TListParams> {
  return {
    list: notImplemented(entity, "list"),
    get: notImplemented(entity, "get"),
    create: notImplemented(entity, "create"),
    update: notImplemented(entity, "update"),
    delete: notImplemented(entity, "delete"),
  };
}

export function createRemoteAdapter(config: RemoteAdapterConfig): DataClient {
  void config; // accepted now, used once real fetch() calls replace the stubs below

  return {
    clients: stubEntityClient("clients"),
    products: stubEntityClient("products"),

    invoices: stubEntityClient("invoices"),
    getInvoiceItems: notImplemented("invoices", "getInvoiceItems"),

    deliveryNotes: stubEntityClient("deliveryNotes"),
    getDeliveryNoteItems: notImplemented("deliveryNotes", "getDeliveryNoteItems"),

    orders: stubEntityClient("orders"),
    getOrderItems: notImplemented("orders", "getOrderItems"),

    payments: stubEntityClient("payments"),
    expenses: stubEntityClient("expenses"),
  };
}
