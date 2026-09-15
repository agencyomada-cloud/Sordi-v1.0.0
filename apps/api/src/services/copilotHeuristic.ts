import type { CopilotBatchResult, CopilotContext, CopilotOperation } from "@sordi/schema";

// ---------------------------------------------------------------------------
// Fallback parser used when GEMINI_API_KEY isn't configured — see env.ts's
// doc comment. Deliberately covers French, English, Arabic, and Algerian
// Darija commercial terms by keyword/regex, plus simple substring entity
// matching against the caller's own context. Not a replacement for the
// real LLM path (services/copilotService.ts): batch-splitting here is a
// naive clause split on conjunctions/punctuation, not real multi-clause
// language understanding — just enough to make the feature usable
// end-to-end before a real API key is configured.
// ---------------------------------------------------------------------------

const today = () => new Date().toISOString().slice(0, 10);

/** Slang/text number parsing across languages, per the extraction-agent
 *  spec: "50k", "50 mille", "50 ألف", "50 thousand" all equal 50000.
 *  Checked before the plain-currency/bare-number fallbacks below. */
function extractAmount(text: string): number | null {
  const slang = text.match(/(\d+(?:[.,]\d+)?)\s*(k|mille|ألف|thousand)\b/i);
  if (slang) {
    const base = Number.parseFloat(slang[1].replace(",", "."));
    return Number.isFinite(base) && base > 0 ? Math.round(base * 1000) : null;
  }
  const withCurrency = text.match(/([\d][\d\s.,]*)\s*(da|dzd|دج|دينار|dinars?)\b/i);
  const raw = withCurrency?.[1] ?? text.match(/\b\d[\d\s.,]{1,}\b/)?.[0];
  if (!raw) return null;
  const digitsOnly = raw.replace(/[^\d]/g, "");
  if (!digitsOnly) return null;
  const value = Number.parseInt(digitsOnly, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Keyword -> category, covering the French/Arabic/Darija terms named in
// the feature's own spec. Checked in order; first match wins.
const CATEGORY_KEYWORDS: { category: string; pattern: RegExp }[] = [
  { category: "Carburant", pattern: /(carburant|essence|gasoil|diesel|مازوت|بنزين|سيتيشن|station)/i },
  { category: "Loyer", pattern: /(loyer|كراء|location|rent)/i },
  { category: "Salaires", pattern: /(salaire|سلاك|الخدامة|paie|salary)/i },
  { category: "Avances", pattern: /(avance|لافونس|acompte|advance)/i },
  { category: "Fournitures de bureau", pattern: /(fourniture|papeterie|bureau|office supplies)/i },
  { category: "Transport", pattern: /(transport|taxi|livraison|delivery)/i },
  { category: "Maintenance", pattern: /(maintenance|réparation|entretien|repair)/i },
  { category: "Internet", pattern: /(internet|wifi|connexion)/i },
];

function detectCategory(text: string): string {
  for (const { category, pattern } of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return category;
  }
  return "Autre";
}

/** Case-insensitive substring match, either direction (the entity's own
 *  name inside the text, or a word of the text inside the entity's name)
 *  — good enough for "ENPEC" matching "SARL ENPEC Distribution". */
function findEntityMatch<T extends { id: string; name: string }>(text: string, entities: T[]): T | null {
  const lower = text.toLowerCase();
  return (
    entities.find((e) => e.name.length >= 3 && (lower.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(lower))) ?? null
  );
}

/** Naive "pour/de/à/for/named/باسم <Nom propre>" extraction — used only
 *  when no entity in context matched, so the review card still shows
 *  *something* recognizable instead of a bare fallback. */
function extractProperNoun(text: string): string | null {
  const match = text.match(/\b(?:pour|de|à|for|named|nommé[e]?)\s+([A-ZÀ-Ü][\w&-]*(?:\s+[A-ZÀ-Ü][\w&-]*){0,2})/);
  return match?.[1]?.trim() ?? null;
}

function extractPhone(text: string): string | null {
  return text.match(/\b0[5-7]\d{8}\b/)?.[0] ?? null;
}

// EXPLICIT creation phrasing only — a bare "عميل"/"client" mention is NOT
// enough (that used to be this heuristic's own version of the exact
// hallucination bug reported against the real LLM prompt: "facture pour
// le client CFCE" contains the word "client" but is a REFERENCE to an
// existing entity, not a creation instruction). Requiring "new"/
// "nouveau"/"جديد" mirrors copilotService.ts's RULE 1a exactly.
const CLIENT_PATTERN = /\b(?:nouveau|nouvelle)\s+client\b|\bnew\s+(?:customer|client)\b|عميل\s*جديد|كليون\s*جديد/i;
const SUPPLIER_PATTERN = /\b(?:nouveau|nouvelle)\s+fournisseur\b|\bnew\s+(?:supplier|vendor)\b|مورد\s*جديد|فورنيسور\s*جديد/i;
const INVOICE_PATTERN = /\bfacture\b|\binvoice\b|فاتورة|فاكتير|بيع/i;
const EXPENSE_PATTERN = /\bdépense\b|\bcharge\b|\bexpense\b|\bachat\b|مصروف|شارج|خلصت|شريت/i;

/** Classifies ONE clause into at most one operation — the batch splitter
 *  below calls this per clause so one sentence can yield several
 *  operations, per the "BATCH PROCESSING" rule in the real prompt.
 *
 *  Checks the EXPLICIT create_client/create_supplier phrasing first, but
 *  only fires on it — every other branch below is a REFERENCE to an
 *  existing entity (`entity_name`), never a creation (`name`), matching
 *  RULE 1 in copilotService.ts's own prompt exactly. */
function parseClause(clause: string, context: CopilotContext): CopilotOperation | null {
  const text = clause.trim();
  if (!text) return null;

  if (CLIENT_PATTERN.test(text)) {
    const stripped = text.replace(CLIENT_PATTERN, "").trim();
    const name = extractProperNoun(text) ?? (stripped || "Nouveau client");
    return { type: "create_client", data: { name, phone: extractPhone(text) } };
  }

  if (SUPPLIER_PATTERN.test(text)) {
    const stripped = text.replace(SUPPLIER_PATTERN, "").trim();
    const name = extractProperNoun(text) ?? (stripped || "Nouveau fournisseur");
    return { type: "create_supplier", data: { name, phone: extractPhone(text) } };
  }

  const isInvoice = INVOICE_PATTERN.test(text);
  const isExpense = EXPENSE_PATTERN.test(text);
  const amount = extractAmount(text);

  // Nothing financial and no invoice/expense keyword — almost certainly a
  // general-knowledge/chit-chat clause slipping past this fallback. The
  // real LLM path handles this via its own "return an empty batch" rule;
  // this is this path's equivalent: contribute nothing to the batch.
  if (!isInvoice && !isExpense && amount === null) return null;

  if (isInvoice) {
    // A name here REFERENCES an existing client — never `name` (creation).
    const clientMatch = findEntityMatch(text, context.clients);
    const entityName = clientMatch?.name ?? extractProperNoun(text) ?? undefined;
    return {
      type: "create_invoice",
      data: { entity_name: entityName, amount: amount ?? 0, date: today(), description: text },
    };
  }

  // Expenses reliably have no meaningful counterparty name (see
  // copilotOperationDataSchema's own doc comment) — category/description
  // carry the identifying meaning instead, so entity_name is omitted
  // unless a real supplier match exists.
  const supplierMatch = findEntityMatch(text, context.suppliers);
  return {
    type: "create_expense",
    data: {
      entity_name: supplierMatch?.name,
      amount: amount ?? 0,
      date: today(),
      description: text,
      category: detectCategory(text),
    },
  };
}

// Naive clause split — conjunctions ("and"/"et"/"و") and sentence-ending
// punctuation. Not real language understanding, just enough to let a
// sentence like "new customer Yacine... and add an internet expense..."
// yield two operations instead of one confused one.
function splitClauses(text: string): string[] {
  return text
    .split(/[.;]|\b(?:and|et|و)\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseHeuristically(text: string, context: CopilotContext): CopilotBatchResult {
  const operations = splitClauses(text)
    .map((clause) => parseClause(clause, context))
    .filter((op): op is CopilotOperation => op !== null);
  return { operations };
}
