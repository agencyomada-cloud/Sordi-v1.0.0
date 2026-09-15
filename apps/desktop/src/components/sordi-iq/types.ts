/** One tool call the model requested, still awaiting human approval —
 *  created the moment sordi_iq_chat returns write-tool tool_calls (see
 *  SordiIQ.tsx's sendMessage), never auto-executed. `fields` starts as the
 *  model's own extracted arguments and is mutated in place as the user
 *  edits the draft card/drawer — executeToolDraft (SordiIQ.tsx) reads
 *  whatever is in `fields` at confirm time, edited or not. */
export type ToolDraftName = "create_client" | "create_supplier" | "create_invoice" | "create_expense";

export type ToolDraftStatus = "pending" | "saving" | "saved" | "error";

export interface ClientDraftFields {
  name: string;
  phone: string;
}

export interface ExpenseDraftFields {
  category: string;
  amount: number;
  description: string;
  date: string;
}

export interface InvoiceDraftFields {
  client_name: string;
  description: string;
  amount: number;
  date: string;
}

export type ToolDraftFields = ClientDraftFields | ExpenseDraftFields | InvoiceDraftFields;

export interface ToolDraft {
  /** The originating tool_call.id from OpenRouter — stable per draft. */
  id: string;
  toolName: ToolDraftName;
  status: ToolDraftStatus;
  fields: ToolDraftFields;
  /** Set once status is "saved" or "error" — the confirmation/failure line
   *  shown on the card and folded into the persisted chat history. */
  resultMessage?: string;
}

export const TOOL_DRAFT_LABELS: Record<ToolDraftName, string> = {
  create_client: "Nouveau client",
  create_supplier: "Nouveau fournisseur",
  create_invoice: "Nouvelle facture",
  create_expense: "Nouvelle dépense",
};

/** Parses one tool_call's raw JSON arguments into a typed, editable draft.
 *  Every field always has a value (never undefined) so controlled <Input>s
 *  never warn about switching from uncontrolled to controlled. */
export function buildDraftFromToolCall(id: string, toolName: string, rawArguments: string): ToolDraft | null {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(rawArguments);
  } catch {
    return null;
  }

  const today = new Date().toISOString().split("T")[0];
  const str = (v: unknown, fallback = ""): string => (typeof v === "string" && v.trim() ? v : fallback);
  const num = (v: unknown, fallback = 0): number => (typeof v === "number" && !Number.isNaN(v) ? v : fallback);

  switch (toolName) {
    case "create_client":
      return { id, toolName, status: "pending", fields: { name: str(args.name, "Client"), phone: str(args.phone) } };
    case "create_supplier":
      return { id, toolName, status: "pending", fields: { name: str(args.name, "Fournisseur"), phone: str(args.phone) } };
    case "create_expense":
      return {
        id,
        toolName,
        status: "pending",
        fields: { category: str(args.category, "Autre"), amount: num(args.amount), description: str(args.description), date: str(args.date, today) },
      };
    case "create_invoice":
      return {
        id,
        toolName,
        status: "pending",
        fields: { client_name: str(args.client_name, "Client"), description: str(args.description), amount: num(args.amount), date: str(args.date, today) },
      };
    default:
      return null;
  }
}
