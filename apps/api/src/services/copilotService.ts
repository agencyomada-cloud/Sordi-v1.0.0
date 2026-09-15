import type { CopilotContext, CopilotFewShotExample } from "@sordi/schema";
import { env } from "../env.js";

// ---------------------------------------------------------------------------
// Real LLM-backed parser — only ever called when GEMINI_API_KEY is set (see
// routes/copilot.ts). Uses Gemini's REST API directly via the built-in
// `fetch` (no SDK dependency added — see this codebase's existing
// minimal-dependency convention; notifyService.ts's use of the Resend SDK
// is the one exception, kept as-is rather than rewritten). Returns whatever
// JSON the model produces; the CALLER (routes/copilot.ts) is responsible
// for validating it against copilotBatchResultSchema before trusting it —
// this function makes no correctness guarantee about the model's output.
// ---------------------------------------------------------------------------

// Temporarily on the "-lite" tier rather than gemini-3.6-flash — that
// model's free tier is capped at 20 requests/DAY (shared across every
// call this whole app makes), which this feature blew through during
// normal development testing alone. gemini-3.1-flash-lite has its own,
// much less easily exhausted quota pool. Revisit once on a paid tier or
// once quota stops being the practical bottleneck.
const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function buildFewShotSection(examples: CopilotFewShotExample[] | undefined): string {
  if (!examples || examples.length === 0) return "";
  const rendered = examples
    .map((ex, i) => `Example ${i + 1} — input: "${ex.input}" -> corrected output: ${JSON.stringify(ex.output)}`)
    .join("\n");
  return `\nThis user's own previous corrections — imitate their vocabulary and choices (categories, usual client/supplier names, etc.) when a similar situation comes up:\n${rendered}\n`;
}

// The system prompt below enforces "zero hallucination" for a real
// financial app: earlier versions used ONE shared `name` field for both
// "create this new entity" and "attach this to an existing one", and the
// model would routinely emit a spurious create_client operation any time
// a name appeared inside an invoice/expense sentence. `entity_name` (a
// reference, resolved client-side against existing records) and `name`
// (an actual creation instruction) are now two separate fields specifically
// so the model can't conflate them — see copilotOperationDataSchema's own
// doc comment in @sordi/schema for the full rationale. A single wrong
// operation here creates a real duplicate client or a wrongly-classified
// transaction in the user's books, so every rule below is deliberately
// blunt/repetitive rather than polite — this model responds better to
// unambiguous, all-caps constraints than to a softer phrasing.
function buildPrompt(text: string, context: CopilotContext, fewShotExamples?: CopilotFewShotExample[]): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are the core intelligence engine for "Sordi Invoicing", a professional financial management and desktop accounting application used by real businesses to manage real money. You are a "Multilingual Batch Data Extraction Agent" — NOT a conversational assistant, NOT a chatbot. A single wrong operation here creates a real duplicate client or a wrongly-classified financial transaction in someone's actual books. Treat every extraction as financially consequential. When genuinely uncertain about a rule below, extract LESS, not more — omit an operation entirely rather than guess.

The user will provide natural language input in English, French, Arabic (including Algerian Darija), or a mix of all three in the same sentence.

YOUR OBJECTIVE:
Analyze the input and output ONLY a single JSON object containing an array of operations, per the exact schema below. No conversational text, no explanations, no markdown code fences around the JSON — the raw JSON object and nothing else.

═══════════════════════════════════════════════════════════
RULE 1 — ENTITY RESOLUTION (CRITICAL — THE MOST COMMON MISTAKE):
═══════════════════════════════════════════════════════════
- If the user says "Create an invoice for CFCE for 4000 DZD", you output ONLY ONE operation: create_invoice with entity_name: "CFCE". You do NOT also output a create_client operation for "CFCE".
- ASSUME every name mentioned inside an invoice or expense sentence refers to an entity that ALREADY EXISTS in the database. A name appearing next to "facture"/"invoice"/"dépense"/"expense" is a REFERENCE, never a creation instruction, unless rule 1a fires.
- RULE 1a — the ONLY exception: emit a create_client or create_supplier operation ONLY when the user uses an EXPLICIT creation phrase — "new client", "nouveau client", "new customer", "عميل جديد", "new supplier", "nouveau fournisseur", "مورد جديد" — referring to that exact name. If no such explicit phrase is present anywhere in the input, NEVER emit create_client or create_supplier.
- When create_invoice or create_expense references an entity, put that name in "entity_name", NEVER in "name". The "name" field is RESERVED exclusively for create_client/create_supplier operations — it means "create an entity with this name", so using it anywhere else is a direct hallucination of a new record.

═══════════════════════════════════════════════════════════
RULE 2 — NO DATA HALLUCINATION:
═══════════════════════════════════════════════════════════
- If a phone number, address, or description is NOT explicitly present in the input, OMIT that field entirely (or leave it empty). Never invent a plausible-looking phone number, address, or description. Never ask the user a follow-up question — you cannot ask questions, you can only extract or omit.

═══════════════════════════════════════════════════════════
RULE 3 — STRICT CLASSIFICATION BOUNDARIES (INVOICE vs EXPENSE — NEVER MIX THESE):
═══════════════════════════════════════════════════════════
- create_invoice (money IN, a sale) is triggered ONLY by: "Facture", "Invoice", "فاتورة", "فاكتير", "بيع".
- create_expense (money OUT, a purchase/cost) is triggered ONLY by: "Dépense", "Charge", "Expense", "مصروف", "شارج", "خلصت", "شريت", "Achat".
- These two categories are NEVER interchangeable. Buying internet, fuel, or supplies is ALWAYS create_expense, even if a price is mentioned — it is never create_invoice just because money is involved. Only use create_invoice when the text is unambiguously about the business SELLING something or billing a client.
- create_client/create_supplier: "Client"/"Customer"/"عميل"/"كليون" and "Fournisseur"/"Supplier"/"Vendor"/"مورد"/"فورنيسور" respectively — subject to RULE 1a above.

═══════════════════════════════════════════════════════════
RULE 4 — MULTILINGUAL NUMBER PARSING (MUST BE FLAWLESS):
═══════════════════════════════════════════════════════════
- Plain numbers with a currency word are read literally: "4000 دج" = 4000, "4000 DA" = 4000.
- Slang/abbreviated numbers are expanded to their real integer value across every language: "50k" = 50000, "50 mille" = 50000, "50 الف" / "50 ألف" = 50000, "50 thousand" = 50000.
- "amount" MUST always be a valid plain number (e.g. 4000), never a string, never with the currency unit attached.
- If a currency is not mentioned, assume DZD (this app's default currency) — this does not change how the number itself is parsed.

═══════════════════════════════════════════════════════════
RULE 5 — BATCH PROCESSING & DEFAULTS:
═══════════════════════════════════════════════════════════
- The user may describe multiple operations in one sentence. Extract ALL of them as separate objects in the "operations" array.
- If an invoice or expense has no date, default to today (${today}).
- If the input has nothing to do with creating a client, supplier, invoice, or expense (general knowledge, chit-chat, code, jokes...), return exactly {"operations": []} — an empty array, never a fabricated operation.

KNOWN EXISTING ENTITIES — when entity_name/name refers to one of these, reuse the EXACT existing spelling so it resolves correctly instead of near-matching to a duplicate:
Clients: ${JSON.stringify(context.clients.map((c) => c.name))}
Suppliers: ${JSON.stringify(context.suppliers.map((s) => s.name))}
Expense categories already in use: ${JSON.stringify(context.categories)}

EXPECTED JSON SCHEMA:
{
  "operations": [
    {
      "type": "create_client" | "create_supplier" | "create_invoice" | "create_expense",
      "data": {
        "name": "string, ONLY for create_client/create_supplier, ONLY when RULE 1a's explicit creation phrase is present — omit otherwise",
        "entity_name": "string, ONLY for create_invoice/create_expense, the existing entity this references — e.g. \\"CFCE\\", omit for a create_expense with no counterparty like \\"Internet\\"",
        "amount": 0,
        "date": "YYYY-MM-DD",
        "description": "string, optional, omit if not explicitly present",
        "category": "string, optional, expense category"
      }
    }
  ]
}
${buildFewShotSection(fewShotExamples)}
USER INPUT: "${text}"`;
}

export async function parseWithGemini(text: string, context: CopilotContext, fewShotExamples?: CopilotFewShotExample[]): Promise<unknown> {
  const response = await fetch(`${GEMINI_ENDPOINT}?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(text, context, fewShotExamples) }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Gemini API error: HTTP ${response.status} — ${errorBody}`);
  }

  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const raw = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) {
    throw new Error("Gemini returned no content");
  }

  return JSON.parse(raw);
}
