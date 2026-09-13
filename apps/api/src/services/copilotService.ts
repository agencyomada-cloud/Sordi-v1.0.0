import type { CopilotContext, CopilotFewShotExample } from "@sordi/schema";
import { env } from "../env.js";

// ---------------------------------------------------------------------------
// Real LLM-backed parser — only ever called when GEMINI_API_KEY is set (see
// routes/copilot.ts). Uses Gemini's REST API directly via the built-in
// `fetch` (no SDK dependency added — see this codebase's existing
// minimal-dependency convention; notifyService.ts's use of the Resend SDK
// is the one exception, kept as-is rather than rewritten). Returns whatever
// JSON the model produces; the CALLER (routes/copilot.ts) is responsible
// for validating it against copilotResultSchema before trusting it — this
// function makes no correctness guarantee about the model's output.
// ---------------------------------------------------------------------------

// Temporarily on the "-lite" tier rather than gemini-3.6-flash — that
// model's free tier is capped at 20 requests/DAY (shared across every
// call this whole app makes), which this feature blew through during
// normal development testing alone. gemini-3.1-flash-lite has its own,
// much less easily exhausted quota pool, confirmed to produce identical
// quality results against this exact prompt (compound multi-item
// invoices, darija expenses, standalone client/product creation, and
// settings-toggle paraphrases all verified correct). Revisit once on a
// paid tier or once quota stops being the practical bottleneck.
const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function buildFewShotSection(examples: CopilotFewShotExample[] | undefined): string {
  if (!examples || examples.length === 0) return "";
  const rendered = examples
    .map((ex, i) => `Exemple ${i + 1} — entrée : "${ex.input}" -> sortie corrigée : ${JSON.stringify(ex.output)}`)
    .join("\n");
  return `\nCorrections précédentes de CET utilisateur — imite son vocabulaire et ses choix (catégories, fournisseurs habituels, etc.) quand une situation similaire se présente :\n${rendered}\n`;
}

function buildPrompt(text: string, context: CopilotContext, fewShotExamples?: CopilotFewShotExample[]): string {
  return `Tu es un copilote strictement commercial/comptable pour une TPE/PME algérienne, intégré à l'application Sordi. Tu ne réponds JAMAIS à des questions générales, de culture, de programmation, d'actualité, ni à des blagues ou de la conversation — ton unique rôle est d'interpréter une phrase libre décrivant une dépense, une facture, un nouveau client, un nouveau produit, ou un réglage d'interface à appliquer dans Sordi.

Si la phrase de l'utilisateur n'a AUCUN rapport avec ces cinq actions (question générale, code, histoire, blague, bavardage...), ne tente RIEN d'autre et n'invente aucune réponse : renvoie exactement
{"action":"OUT_OF_SCOPE","message":"Je peux uniquement vous aider à enregistrer vos dépenses, devis et factures."}

Sinon, renvoie UNIQUEMENT un objet JSON (aucun texte autour) respectant exactement l'un des cinq schémas suivants — choisis le plus spécifique : une phrase qui ne fait QUE créer un client (sans achat associé) -> Schéma 3 ; un nouveau client mentionné À L'INTÉRIEUR d'une facture (il a acheté quelque chose) -> reste Schéma 2, avec isNewClient à true.

Terminologie commerciale algérienne à reconnaître :
- "مازوت" (mazout), "بنزين" (essence), "كراء" (location), "سيتيشن" (station) -> catégorie "Carburant" ou "Loyer" selon le contexte.
- "سلاك الخدامة" (paie employé), "لافونس" (avance) -> catégorie "Salaires" ou "Avances".
- "فاكتير" (facture), "دوفي" (devis), "acompte"/"تسبيق" (avance sur facture) -> action facture.

Schéma 1 — dépense :
{"action":"CREATE_EXPENSE","amount":number,"category":string,"supplierId":string|null,"supplierName":string|null,"paymentMethod":"cash"|"cheque"|"transfer"|"card","notes":string}

Schéma 2 — facture (le client peut être nouveau — voir isNewClient ; un pourcentage d'acompte doit être calculé en DA, jamais renvoyé comme "50%" brut) :
{"action":"CREATE_INVOICE","clientId":string|null,"clientName":string,"isNewClient":boolean,"items":[{"itemId":string|null,"description":string,"quantity":number,"unitPrice":number,"total":number}],"advancePayment":number|null,"totalAmount":number}

Schéma 3 — création de client seule (aucun achat mentionné) :
{"action":"CREATE_CLIENT","name":string,"phone":string|null,"email":string|null,"address":string|null}

Schéma 4 — création d'un article/service du catalogue :
{"action":"CREATE_PRODUCT","name":string,"sellPrice":number,"buyPrice":number|null}

Schéma 5 — réglage d'interface (ex: "active le mode sombre", "mode nuit", "passer en blanc", "light mode") :
{"action":"SET_APP_SETTINGS","setting":"theme","value":"dark"|"light"|"system"}

Résolution d'entités — utilise ces listes existantes pour retrouver le bon id exact plutôt que de le laisser à null quand une correspondance raisonnable existe :
Clients: ${JSON.stringify(context.clients)}
Fournisseurs: ${JSON.stringify(context.suppliers)}
Catalogue (produits/services): ${JSON.stringify(context.catalogItems)}
Catégories de dépenses déjà utilisées: ${JSON.stringify(context.categories)}

Si un article du catalogue correspond, réutilise son itemId et son unitPrice stocké plutôt qu'un montant deviné. Si un client/fournisseur ne correspond à rien dans les listes, mets l'id à null et (pour une facture) isNewClient à true.
${buildFewShotSection(fewShotExamples)}
Phrase de l'utilisateur : "${text}"`;
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
