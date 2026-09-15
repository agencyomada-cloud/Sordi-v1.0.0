// Hand-mirrored from packages/schema/src/validators.ts's copilot*Schema
// exports — apps/desktop has no dependency on @sordi/schema (same
// constraint as the licensing types in services/licensing.ts), so this
// copy must be kept in sync by hand if the server-side shape changes.
//
// Re-architected as a "Multilingual Batch Data Extraction Agent" response:
// one call can extract MULTIPLE operations from a single mixed-language
// sentence, each a flat {type, data} pair — see validators.ts's own doc
// comment for the full list of what this DROPS relative to the earlier
// single discriminated-union CopilotResult (no entity-ID resolution on
// the wire, no CREATE_PRODUCT/SET_APP_SETTINGS, no invoice line items, no
// expense supplier/payment-method fields, no dedicated OUT_OF_SCOPE
// action — an out-of-scope input is just an empty `operations` array).

export type CopilotOperationType = "create_client" | "create_supplier" | "create_invoice" | "create_expense";

/** One flat data shape shared by all four operation types — the caller
 *  (AiCopilotBar.tsx) knows which fields are meaningful for a given
 *  `type` and ignores the rest (e.g. `category` is only read for
 *  create_expense).
 *
 *  `name` and `entity_name` are DELIBERATELY separate, not one shared
 *  field — this is the fix for a real hallucination bug where a bare name
 *  inside an invoice/expense sentence ("facture pour CFCE") got read as
 *  license to also emit a create_client for it, since one shared field
 *  looked identical whether it meant "create this" or "reference this
 *  existing one". `name` appears ONLY on create_client/create_supplier
 *  (an actual creation); `entity_name` appears ONLY on create_invoice/
 *  create_expense (a reference resolved by name at confirm time — see
 *  resolveEntityMatch.ts — never a creation instruction). Both stay
 *  optional: confirmed live that Gemini reliably omits `entity_name` for
 *  a create_expense with no real counterparty ("Internet"), where
 *  category/description carry the identifying meaning instead. */
export interface CopilotOperationData {
  name?: string | null;
  entity_name?: string | null;
  phone?: string | null;
  amount?: number | null;
  date?: string | null;
  description?: string | null;
  category?: string | null;
}

export interface CopilotOperation {
  type: CopilotOperationType;
  data: CopilotOperationData;
}

export interface CopilotBatchResult {
  operations: CopilotOperation[];
}

export interface CopilotContextEntity {
  id: string;
  name: string;
}

export interface CopilotContext {
  clients: CopilotContextEntity[];
  suppliers: CopilotContextEntity[];
  categories: string[];
}

/** One prior user correction, replayed as a few-shot example in the next
 *  /copilot/parse call — see copilotMemory.ts. `output` is a full
 *  CopilotBatchResult captured at the moment the user confirmed it. */
export interface CopilotFewShotExample {
  input: string;
  output: Record<string, unknown>;
}
