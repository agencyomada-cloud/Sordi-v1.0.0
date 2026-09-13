import type { CopilotContext, CopilotPaymentMethod, CopilotResult } from "@sordi/schema";

// ---------------------------------------------------------------------------
// Fallback parser used when GEMINI_API_KEY isn't configured — see env.ts's
// doc comment. Deliberately covers French, Arabic, and Algerian Darija
// commercial terms by keyword/regex, plus simple substring entity
// resolution against the caller's own context. Not a replacement for the
// real LLM path (services/copilotService.ts): no free-form reasoning, no
// multi-item invoice line splitting — just enough to make the feature
// usable end-to-end before a real API key is configured.
// ---------------------------------------------------------------------------

/** "3 500 DA", "150 000DA", "12000 da" — thousand-separator spaces/commas
 *  stripped before parsing. Falls back to the first bare number in the
 *  sentence if no currency suffix is found. */
function extractAmount(text: string): number | null {
  const withCurrency = text.match(/([\d][\d\s.,]*)\s*(da|dzd|dinars?)\b/i);
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
  { category: "Loyer", pattern: /(loyer|كراء|location)/i },
  { category: "Salaires", pattern: /(salaire|سلاك|الخدامة|paie)/i },
  { category: "Avances", pattern: /(avance|لافونس|acompte)/i },
  { category: "Fournitures de bureau", pattern: /(fourniture|papeterie|bureau)/i },
  { category: "Transport", pattern: /(transport|taxi|livraison)/i },
  { category: "Maintenance", pattern: /(maintenance|réparation|entretien)/i },
];

function detectCategory(text: string): string {
  for (const { category, pattern } of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return category;
  }
  return "Autre";
}

function detectPaymentMethod(text: string): CopilotPaymentMethod {
  if (/(chèque|cheque|شيك)/i.test(text)) return "cheque";
  if (/(virement|حوالة)/i.test(text)) return "transfer";
  if (/\b(carte|cb|بطاقة)\b/i.test(text)) return "card";
  return "cash";
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

/** Naive "pour/de/à <Nom propre>" extraction — used only when no entity in
 *  context matched, so the review card still shows *something* recognizable
 *  instead of a bare "—" for a genuinely new client/supplier. */
function extractProperNoun(text: string): string | null {
  const match = text.match(/\b(?:pour|de|à)\s+([A-ZÀ-Ü][\w&-]*(?:\s+[A-ZÀ-Ü][\w&-]*){0,2})/);
  return match?.[1]?.trim() ?? null;
}

const OUT_OF_SCOPE_MESSAGE = "Je peux uniquement vous aider à enregistrer vos dépenses, devis et factures.";

function extractPhone(text: string): string | null {
  return text.match(/\b0[5-7]\d{8}\b/)?.[0] ?? null;
}

function extractEmail(text: string): string | null {
  return text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
}

export function parseHeuristically(text: string, context: CopilotContext): CopilotResult {
  // Checked before anything financial — "nouveau client X" / "nouveau
  // produit Y" are structurally distinct enough (no purchase mentioned)
  // that they're worth a dedicated, earlier check rather than falling
  // through to the expense/invoice branches below and being misread.
  if (/\b(nouveau|nouvelle)\s+client/i.test(text)) {
    const stripped = text.replace(/\b(nouveau|nouvelle)\s+client\s*/i, "").trim();
    const name = extractProperNoun(text) ?? (stripped || "Nouveau client");
    return { action: "CREATE_CLIENT", name, phone: extractPhone(text), email: extractEmail(text), address: null };
  }
  if (/\b(nouveau|nouvelle)\s+produit/i.test(text)) {
    const stripped = text.replace(/\b(nouveau|nouvelle)\s+produit\s*/i, "").trim();
    const name = extractProperNoun(text) ?? (stripped || "Nouveau produit");
    return { action: "CREATE_PRODUCT", name, sellPrice: extractAmount(text) ?? 0, buyPrice: null };
  }
  if (/(mode sombre|dark mode|mode nuit)/i.test(text)) {
    return { action: "SET_APP_SETTINGS", setting: "theme", value: "dark" };
  }
  if (/(mode clair|light mode|passer en blanc)/i.test(text)) {
    return { action: "SET_APP_SETTINGS", setting: "theme", value: "light" };
  }

  const isInvoice = /\b(facture|فاكتير|دوفي|devis|invoice)\b/i.test(text);
  const amount = extractAmount(text) ?? 0;

  // No amount and no invoice keyword — this heuristic has nothing
  // financial to hang a CREATE_EXPENSE/CREATE_INVOICE on, so it's almost
  // certainly a general-knowledge/chit-chat prompt slipping past the (much
  // weaker) fallback path. The real LLM path below does this check itself
  // via the system prompt; this is just this path's own equivalent guard.
  if (!isInvoice && amount === 0) {
    return { action: "OUT_OF_SCOPE", message: OUT_OF_SCOPE_MESSAGE };
  }

  if (isInvoice) {
    const clientMatch = findEntityMatch(text, context.clients);
    const itemMatch = findEntityMatch(text, context.catalogItems);
    const clientName = clientMatch?.name ?? extractProperNoun(text) ?? "Client";
    const unitPrice = itemMatch?.unitPrice ?? amount;

    return {
      action: "CREATE_INVOICE",
      clientId: clientMatch?.id ?? null,
      clientName,
      isNewClient: !clientMatch,
      newClient: clientMatch ? null : { name: clientName },
      items: [
        {
          itemId: itemMatch?.id ?? null,
          description: itemMatch?.name ?? "Prestation",
          quantity: 1,
          unitPrice,
          total: unitPrice,
        },
      ],
      totalAmount: unitPrice,
    };
  }

  const supplierMatch = findEntityMatch(text, context.suppliers);
  return {
    action: "CREATE_EXPENSE",
    amount,
    category: detectCategory(text),
    supplierId: supplierMatch?.id ?? null,
    supplierName: supplierMatch?.name ?? extractProperNoun(text),
    paymentMethod: detectPaymentMethod(text),
    notes: text,
  };
}
