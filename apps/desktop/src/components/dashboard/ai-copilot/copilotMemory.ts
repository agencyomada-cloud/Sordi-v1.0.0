import type { CopilotExpenseResult, CopilotFewShotExample, CopilotInvoiceResult, CopilotResult } from "./types";

// ---------------------------------------------------------------------------
// Local-first learning loop — strictly per-company (every key below is
// namespaced by companyId), persisted in localStorage rather than a new
// SQLite table: this is genuinely lightweight (a few hundred small JSON
// records, capped below, comes out to tens of KB, nowhere near the 5MB
// ceiling) and needs no Rust/migration work to ship. Two separate stores:
//
// - "corrections": one row per FIELD the user actually changed before
//   confirming (id/input_phrase/entity_type/resolved_field/corrected_value/
//   created_at, exactly as specced) — a plain append-only log, not
//   currently read back by anything itself but kept for future analytics/
//   debugging ("what does this user keep correcting?").
// - "examples": one row per CONFIRMED result (edited or not), full
//   input text -> full output object. This is what actually powers both
//   zero-token offline matching (an exact repeat of a past input skips the
//   network call entirely) and few-shot injection (the last few are sent
//   back to Gemini so it learns this user's own vocabulary/habits).
// ---------------------------------------------------------------------------

export interface CopilotCorrection {
  id: string;
  input_phrase: string;
  entity_type: "EXPENSE" | "INVOICE";
  resolved_field: string;
  corrected_value: string;
  created_at: string;
}

interface CopilotExample {
  id: string;
  normalizedInput: string;
  input: string;
  output: CopilotResult;
  created_at: string;
}

const MAX_CORRECTIONS = 300;
const MAX_EXAMPLES = 100;
const FEW_SHOT_COUNT = 5;

const correctionsKey = (companyId: string) => `copilot_corrections_${companyId}`;
const examplesKey = (companyId: string) => `copilot_examples_${companyId}`;

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full/unavailable — the learning loop is a nice-to-have, never
    // worth surfacing an error over.
  }
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function recordCorrection(companyId: string, entry: Omit<CopilotCorrection, "id" | "created_at">) {
  const all = readJson<CopilotCorrection[]>(correctionsKey(companyId), []);
  all.push({ ...entry, id: newId(), created_at: new Date().toISOString() });
  writeJson(correctionsKey(companyId), all.slice(-MAX_CORRECTIONS));
}

// Only the fields a user can actually edit in the review card (see
// AiCopilotResult.tsx) are worth learning from — comparing every field
// would just log noise like a `total` that recalculated itself.
function diffExpenseFields(original: CopilotExpenseResult, edited: CopilotExpenseResult): [string, string][] {
  const diffs: [string, string][] = [];
  if (original.category !== edited.category) diffs.push(["category", edited.category]);
  if (original.paymentMethod !== edited.paymentMethod) diffs.push(["paymentMethod", edited.paymentMethod]);
  if (original.supplierId !== edited.supplierId) diffs.push(["supplierId", edited.supplierId ?? ""]);
  return diffs;
}

function diffInvoiceFields(original: CopilotInvoiceResult, edited: CopilotInvoiceResult): [string, string][] {
  const diffs: [string, string][] = [];
  if (original.clientId !== edited.clientId) diffs.push(["clientId", edited.clientId ?? ""]);
  return diffs;
}

/** Called once, right before the final create mutation — diffs the
 *  edited draft against the AI's original output and logs one correction
 *  row per field that actually changed. `inputPhrase` is the ORIGINAL
 *  natural-language prompt (never a refinement's synthetic JSON-embedding
 *  text), so future few-shot examples read like real sentences. */
export function recordDraftCorrections(companyId: string, inputPhrase: string, original: CopilotResult, edited: CopilotResult) {
  if (original.action !== edited.action) return; // a refinement can't change the action type here
  if (edited.action === "CREATE_EXPENSE" && original.action === "CREATE_EXPENSE") {
    for (const [field, value] of diffExpenseFields(original, edited)) {
      recordCorrection(companyId, { input_phrase: inputPhrase, entity_type: "EXPENSE", resolved_field: field, corrected_value: value });
    }
  } else if (edited.action === "CREATE_INVOICE" && original.action === "CREATE_INVOICE") {
    for (const [field, value] of diffInvoiceFields(original, edited)) {
      recordCorrection(companyId, { input_phrase: inputPhrase, entity_type: "INVOICE", resolved_field: field, corrected_value: value });
    }
  }
}

/** Called on every successful confirm (edited or not) — this is what
 *  powers both the offline exact-match cache and few-shot injection.
 *  Never called for OUT_OF_SCOPE (nothing useful to remember there). */
export function recordConfirmedExample(companyId: string, inputText: string, output: CopilotResult) {
  const all = readJson<CopilotExample[]>(examplesKey(companyId), []);
  all.push({ id: newId(), normalizedInput: normalize(inputText), input: inputText, output, created_at: new Date().toISOString() });
  writeJson(examplesKey(companyId), all.slice(-MAX_EXAMPLES));
}

/** Zero-token offline match — an exact (normalized) repeat of a
 *  previously confirmed input skips the network call entirely. This is
 *  intentionally a literal-repeat check, not fuzzy NLP matching: the most
 *  common real case is a recurring monthly line ("Loyer bureau 25000 DA
 *  virement") typed the same way each time. */
export function findCachedResult(companyId: string, inputText: string): CopilotResult | null {
  const normalized = normalize(inputText);
  const all = readJson<CopilotExample[]>(examplesKey(companyId), []);
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].normalizedInput === normalized) return all[i].output;
  }
  return null;
}

/** The last few confirmed examples, formatted for the /copilot/parse
 *  request's `fewShotExamples` field — sent on every online call so
 *  Gemini picks up this user's own vocabulary (their usual categories,
 *  which supplier "the usual guy" resolves to, etc.). */
export function getFewShotExamples(companyId: string): CopilotFewShotExample[] {
  const all = readJson<CopilotExample[]>(examplesKey(companyId), []);
  return all.slice(-FEW_SHOT_COUNT).map((e) => ({ input: e.input, output: e.output as unknown as Record<string, unknown> }));
}
