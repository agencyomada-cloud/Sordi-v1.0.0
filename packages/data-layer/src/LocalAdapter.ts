import { invoke } from "@tauri-apps/api/core";
import { toCamelCase, toSnakeCase } from "./caseConvert";
import type {
  DataClient,
  EntityClient,
  WriteInput,
  WriteMeta,
  Client, CreateClientInput, UpdateClientInput,
  Product, CreateProductInput, UpdateProductInput,
  Invoice, CreateInvoiceInput, UpdateInvoiceInput, InvoiceListParams, InvoiceItem,
  DeliveryNote, CreateDeliveryNoteInput, UpdateDeliveryNoteInput, DeliveryNoteListParams, DeliveryNoteItem,
  Order, CreateOrderInput, UpdateOrderInput, OrderItem,
  Payment, CreatePaymentInput, UpdatePaymentInput, PaymentListParams,
  Expense, CreateExpenseInput, UpdateExpenseInput, ExpenseListParams,
} from "./types";

/**
 * Wraps today's actual desktop data path: Tauri `invoke()` -> Rust ->
 * local SQLite (src-tauri/src/commands.rs, database.rs). No new server-side
 * work — this only re-exposes what already works behind DataClient.
 *
 * Every command name and field shape below is verified directly against
 * src-tauri/src/commands.rs, not inferred. Three gaps confirmed the same
 * way: there is no `update_expense`, `update_payment`, or `delete_payment`
 * command, and no `delete_delivery_note` command, in the current Rust
 * source. Those methods reject immediately with a clear message instead of
 * firing a doomed invoke() call.
 *
 * idempotencyKey/clientTimestamp are accepted (interface compliance, so call
 * sites don't change once real sync exists) but stripped before invoke() —
 * today's Tauri commands don't know about them.
 */

function stripWriteMeta<T extends object>(input: WriteInput<T>): T {
  const { idempotencyKey: _key, clientTimestamp: _ts, ...rest } = input as T & WriteMeta;
  return rest as T;
}

function rejectUnavailable(entity: string, method: string, reason: string) {
  return (): Promise<never> =>
    Promise.reject(
      new Error(
        `LocalAdapter.${entity}.${method}() is not available: ${reason} ` +
        `(confirmed against src-tauri/src/commands.rs).`,
      ),
    );
}

interface CommandNames {
  list: string;
  /** Omit when no dedicated single-fetch command exists — falls back to list+find. */
  get?: string;
  create: string;
  update: string;
  delete: string;
}

function makeEntityClient<TEntity extends { id: string }, TCreate extends object, TUpdate extends object, TListParams = void>(
  commands: CommandNames,
): EntityClient<TEntity, TCreate, TUpdate, TListParams> {
  const list = async (params?: TListParams): Promise<TEntity[]> => {
    // Top-level invoke() args: confirmed (via database.ts's existing working
    // `{ status, invoiceType }` call matching Rust's `invoice_type` param)
    // that Tauri bridges camelCase JS arg names to the Rust command's
    // parameters — NOT case-converted here.
    const raw = await invoke<unknown[]>(commands.list, params as Record<string, unknown> | undefined);
    return raw.map((item) => toCamelCase<TEntity>(item));
  };

  const get = async (id: string): Promise<TEntity | null> => {
    if (commands.get) {
      const raw = await invoke<unknown>(commands.get, { id });
      return raw ? toCamelCase<TEntity>(raw) : null;
    }
    const all = await list();
    return all.find((item) => item.id === id) ?? null;
  };

  const create = async (input: WriteInput<TCreate>): Promise<TEntity> => {
    const data = toSnakeCase(stripWriteMeta(input));
    const raw = await invoke<unknown>(commands.create, { data });
    return toCamelCase<TEntity>(raw);
  };

  const update = async (id: string, input: WriteInput<TUpdate>): Promise<TEntity> => {
    const data = toSnakeCase(stripWriteMeta(input));
    const raw = await invoke<unknown>(commands.update, { id, data });
    return toCamelCase<TEntity>(raw);
  };

  const del = async (id: string): Promise<void> => {
    await invoke<void>(commands.delete, { id });
  };

  return { list, get, create, update, delete: del };
}

export const LocalAdapter: DataClient = {
  clients: makeEntityClient<Client, CreateClientInput, UpdateClientInput>({
    list: "get_clients", get: "get_client", create: "create_client", update: "update_client", delete: "delete_client",
  }),

  products: makeEntityClient<Product, CreateProductInput, UpdateProductInput>({
    // No dedicated `get_product` command — falls back to list+find.
    list: "get_products", create: "create_product", update: "update_product", delete: "delete_product",
  }),

  invoices: makeEntityClient<Invoice, CreateInvoiceInput, UpdateInvoiceInput, InvoiceListParams>({
    list: "get_invoices", get: "get_invoice", create: "create_invoice", update: "update_invoice", delete: "delete_invoice",
  }),
  getInvoiceItems: async (invoiceId: string): Promise<InvoiceItem[]> => {
    // Rust's own parameter here is literally camelCase (`invoiceId`, with
    // #[allow(non_snake_case)]) — no bridging ambiguity for this one at all.
    const raw = await invoke<unknown[]>("get_invoice_items", { invoiceId });
    return raw.map((item) => toCamelCase<InvoiceItem>(item));
  },

  deliveryNotes: {
    ...makeEntityClient<DeliveryNote, CreateDeliveryNoteInput, UpdateDeliveryNoteInput, DeliveryNoteListParams>({
      list: "get_delivery_notes", get: "get_delivery_note", create: "create_delivery_note", update: "update_delivery_note", delete: "delete_delivery_note",
    }),
    // No `delete_delivery_note` command exists — overrides the doomed call above.
    delete: rejectUnavailable("deliveryNotes", "delete", "no delete_delivery_note command exists"),
  },
  getDeliveryNoteItems: async (deliveryNoteId: string): Promise<DeliveryNoteItem[]> => {
    const raw = await invoke<unknown[]>("get_delivery_note_items", { deliveryNoteId });
    return raw.map((item) => toCamelCase<DeliveryNoteItem>(item));
  },

  orders: makeEntityClient<Order, CreateOrderInput, UpdateOrderInput>({
    list: "get_orders", get: "get_order", create: "create_order", update: "update_order", delete: "delete_order",
  }),
  getOrderItems: async (orderId: string): Promise<OrderItem[]> => {
    const raw = await invoke<unknown[]>("get_order_items", { orderId });
    return raw.map((item) => toCamelCase<OrderItem>(item));
  },

  payments: {
    ...makeEntityClient<Payment, CreatePaymentInput, UpdatePaymentInput, PaymentListParams>({
      // No dedicated `get_payment` command — falls back to list+find.
      // update/delete commands don't exist either — overridden below.
      list: "get_payments", create: "create_payment", update: "update_payment", delete: "delete_payment",
    }),
    update: rejectUnavailable("payments", "update", "no update_payment command exists — payments are create/list only today"),
    delete: rejectUnavailable("payments", "delete", "no delete_payment command exists — payments are create/list only today"),
  },

  expenses: {
    ...makeEntityClient<Expense, CreateExpenseInput, UpdateExpenseInput, ExpenseListParams>({
      // No dedicated `get_expense` command — falls back to list+find.
      list: "get_expenses", create: "create_expense", update: "update_expense", delete: "delete_expense",
    }),
    update: rejectUnavailable("expenses", "update", "no update_expense command exists"),
  },
};
