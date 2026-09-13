// Hand-mirrored from packages/schema/src/validators.ts's copilot*Schema
// exports — apps/desktop has no dependency on @sordi/schema (same
// constraint as the licensing types in services/licensing.ts), so this
// copy must be kept in sync by hand if the server-side shape changes.

// Canonical values apps/desktop's own Expenses page Select already uses
// (see pages/Expenses.tsx) — the copilot returns these directly, no
// separate enum/mapping needed before a mutation call.
export type CopilotPaymentMethod = "cash" | "cheque" | "transfer" | "card";

export interface CopilotExpenseResult {
  action: "CREATE_EXPENSE";
  amount: number;
  category: string;
  supplierId: string | null;
  supplierName: string | null;
  paymentMethod: CopilotPaymentMethod;
  notes: string;
}

export interface CopilotInvoiceLine {
  itemId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CopilotInvoiceResult {
  action: "CREATE_INVOICE";
  clientId: string | null;
  clientName: string;
  isNewClient?: boolean;
  /** Authoritatively computed server-side as `isNewClient ? {name:
   *  clientName} : null` — see apps/api's routes/copilot.ts. Confirming
   *  this invoice creates the client first when set. */
  newClient: { name: string } | null;
  items: CopilotInvoiceLine[];
  advancePayment?: number | null;
  totalAmount: number;
}

/** Standalone client creation ("Nouveau client SARL Atlas tél 0550..."),
 *  as opposed to a new client mentioned inline inside a CREATE_INVOICE. */
export interface CopilotClientResult {
  action: "CREATE_CLIENT";
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

/** Standalone catalog item creation. `buyPrice` has no column on the real
 *  Product row (see prefillDraft-era note in copilotHeuristic.ts — only a
 *  single unit_price/sell price exists), so the confirm handler folds it
 *  into the product's description instead of dropping it. */
export interface CopilotProductResult {
  action: "CREATE_PRODUCT";
  name: string;
  sellPrice: number;
  buyPrice: number | null;
}

/** UI/system toggle — executed immediately by AiCopilotBar via next-
 *  themes' setTheme(), with no review card at all. Only ever "theme"
 *  today. */
export interface CopilotSettingsResult {
  action: "SET_APP_SETTINGS";
  setting: "theme";
  value: "dark" | "light" | "system";
}

/** The scope guardrail branch — see copilotService.ts's system prompt.
 *  No amount, no entity, nothing to review; the desktop app renders
 *  `message` and offers only a dismiss action. */
export interface CopilotOutOfScopeResult {
  action: "OUT_OF_SCOPE";
  message: string;
}

export type CopilotResult =
  | CopilotExpenseResult
  | CopilotInvoiceResult
  | CopilotClientResult
  | CopilotProductResult
  | CopilotSettingsResult
  | CopilotOutOfScopeResult;

export interface CopilotContextEntity {
  id: string;
  name: string;
}

export interface CopilotContextCatalogItem extends CopilotContextEntity {
  unitPrice: number;
  category?: string;
}

export interface CopilotContext {
  clients: CopilotContextEntity[];
  suppliers: CopilotContextEntity[];
  catalogItems: CopilotContextCatalogItem[];
  categories: string[];
}

/** One prior user correction, replayed as a few-shot example in the next
 *  /copilot/parse call — see copilotMemory.ts. `output` is a full
 *  CopilotResult (minus OUT_OF_SCOPE, which is never corrected/learned
 *  from) captured at the moment the user confirmed it. */
export interface CopilotFewShotExample {
  input: string;
  output: Record<string, unknown>;
}
