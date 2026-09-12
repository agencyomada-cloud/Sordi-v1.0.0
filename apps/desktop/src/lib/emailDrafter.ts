/**
 * Offline-first email drafting for document dispatch (Invoices, Bons de
 * Livraison, Bons de Commande). Pure template engine — no network call, no
 * LLM, zero marginal cost per draft. "IA" in the UI copy describes the
 * feature to the user, not the implementation; there is no external model
 * involved.
 */

export type DraftDocType = "invoice" | "delivery" | "order";
export type EmailTone = "standard" | "formal" | "direct";

export const EMAIL_TONE_LABELS: Record<EmailTone, string> = {
  standard: "Standard B2B",
  formal: "Formel & Facturation",
  direct: "Court & Direct",
};

export interface DraftLineItem {
  name: string;
  quantity?: number | null;
  unitPrice?: number | null;
}

interface DraftInputBase {
  documentNumber: string;
  clientName: string;
  documentDate: string;
  senderCompany: string;
  items: DraftLineItem[];
}

/** Aged-receivables dunning escalation level (Relances.tsx) — absent for a
 *  normal "here's your invoice" send, present only when this email is a
 *  payment reminder for an overdue invoice. Chosen by the caller from how
 *  overdue the invoice is, not derived here. */
export type DunningStage = "reminder" | "second-reminder" | "formal-notice";

export const DUNNING_STAGE_LABELS: Record<DunningStage, string> = {
  reminder: "Rappel amical de règlement",
  "second-reminder": "Deuxième relance de paiement",
  "formal-notice": "Mise en demeure avant contentieux",
};

export interface DraftInvoiceInput extends DraftInputBase {
  docType: "invoice";
  isCreditNote?: boolean;
  totalTTC: number | null;
  dueDate?: string | null;
  bankRib?: string | null;
  bankAgency?: string | null;
  /** Set only for a dunning/relance send — switches the subject/body to an
   *  escalating payment-reminder template instead of the plain "please
   *  find attached" one. */
  dunningStage?: DunningStage;
  /** Days past the due date, for the reminder copy — required alongside
   *  dunningStage. */
  daysOverdue?: number;
  /** The unpaid balance on THIS invoice specifically — falls back to
   *  totalTTC when omitted (e.g. nothing paid yet). */
  balanceDue?: number | null;
  /** When this client has more than one overdue invoice, the total unpaid
   *  across all of them (this invoice included) — lets the reminder say
   *  "and N other invoice(s) totalling X DA" instead of looking like their
   *  only debt is this one document. */
  outstandingCount?: number;
  outstandingTotal?: number;
}

export interface DraftDeliveryInput extends DraftInputBase {
  docType: "delivery";
}

export interface DraftOrderInput extends DraftInputBase {
  docType: "order";
  totalTTC: number | null;
  deliveryDate?: string | null;
}

export type DraftInput = DraftInvoiceInput | DraftDeliveryInput | DraftOrderInput;

const DOC_LABEL: Record<DraftDocType, string> = {
  invoice: "Facture",
  delivery: "Bon de Livraison",
  order: "Bon de Commande",
};

const formatCurrencyDZD = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return "0,00 DA";
  return new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2 }).format(amount) + " DA";
};

const formatDateFR = (date: string | null | undefined): string => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
};

/** Bullets the first few items, folding the rest into a "et N autres" tail
 *  so the email stays a summary, not a full copy of the attached PDF. Not
 *  shown at all for the "direct" tone, which stays to a handful of lines. */
const summarizeItems = (items: DraftLineItem[], max = 5): string => {
  if (!items.length) return "";
  const shown = items.slice(0, max);
  const lines = shown.map((item) => {
    const qty = item.quantity !== null && item.quantity !== undefined ? `${item.quantity} × ` : "";
    const price = item.unitPrice !== null && item.unitPrice !== undefined ? ` (${formatCurrencyDZD(item.unitPrice)})` : "";
    return `  • ${qty}${item.name}${price}`;
  });
  if (items.length > max) {
    lines.push(`  • … et ${items.length - max} autre(s) article(s)`);
  }
  return lines.join("\n");
};

const greeting = (tone: EmailTone): string => (tone === "direct" ? "Bonjour," : "Madame, Monsieur,");

export function draftDocumentSubject(input: DraftInput): string {
  if (input.docType === "invoice" && input.dunningStage) {
    return `${DUNNING_STAGE_LABELS[input.dunningStage]} — Facture N° ${input.documentNumber}`;
  }
  const label = input.docType === "invoice" && input.isCreditNote ? "Avoir" : DOC_LABEL[input.docType];
  return `${label} N° ${input.documentNumber} — ${input.senderCompany}`;
}

/** Escalating payment-reminder copy for Relances.tsx — tone still adjusts
 *  the greeting/sign-off, but the core message strength comes from
 *  dunningStage, not tone: a "formal-notice" stays firm even in the
 *  "direct" tone, since that stage exists specifically to sound firm. */
function draftDunningEmail(input: DraftInvoiceInput, tone: EmailTone): string {
  const stage = input.dunningStage!;
  const balance = input.balanceDue ?? input.totalTTC;
  const lines: string[] = [greeting(tone), ""];

  const otherDebtLine =
    input.outstandingCount && input.outstandingCount > 1 && input.outstandingTotal
      ? ` Ce montant s'ajoute à ${input.outstandingCount - 1} autre(s) facture(s) impayée(s), pour un total dû de ${formatCurrencyDZD(input.outstandingTotal)}.`
      : "";

  if (stage === "reminder") {
    lines.push(
      `Sauf erreur de notre part, nous n'avons pas encore reçu le règlement de la facture N° ${input.documentNumber} du ${formatDateFR(input.documentDate)}, ` +
        `d'un montant de ${formatCurrencyDZD(balance)}, dont l'échéance était fixée au ${formatDateFR(input.dueDate)} (soit ${input.daysOverdue} jour(s) de retard).${otherDebtLine}`,
      "",
      "Il s'agit probablement d'un simple oubli — merci de bien vouloir procéder au règlement dans les meilleurs délais, ou de nous signaler si celui-ci a déjà été effectué."
    );
  } else if (stage === "second-reminder") {
    lines.push(
      `Malgré notre précédente relance, la facture N° ${input.documentNumber} du ${formatDateFR(input.documentDate)}, d'un montant de ${formatCurrencyDZD(balance)}, ` +
        `reste impayée à ce jour (échéance dépassée de ${input.daysOverdue} jours).${otherDebtLine}`,
      "",
      "Nous vous demandons de bien vouloir régulariser cette situation sous les plus brefs délais. Si un désaccord ou une difficulté explique ce retard, n'hésitez pas à nous contacter afin d'en discuter."
    );
  } else {
    lines.push(
      `Malgré nos relances successives, la facture N° ${input.documentNumber} du ${formatDateFR(input.documentDate)}, d'un montant de ${formatCurrencyDZD(balance)}, ` +
        `demeure impayée à ce jour, avec un retard de ${input.daysOverdue} jours par rapport à son échéance du ${formatDateFR(input.dueDate)}.${otherDebtLine}`,
      "",
      "À défaut de règlement intégral sous 8 jours à compter de la présente, nous nous verrons contraints d'engager toute procédure utile au recouvrement de cette créance, sans autre préavis."
    );
  }

  if (!input.isCreditNote && input.bankRib) {
    lines.push("", `Coordonnées bancaires pour règlement par virement : ${input.bankRib}${input.bankAgency ? ` (${input.bankAgency})` : ""}.`);
  }

  lines.push("", "Cordialement,", input.senderCompany);
  return lines.join("\n");
}

function draftInvoiceEmail(input: DraftInvoiceInput, tone: EmailTone): string {
  if (input.dunningStage) {
    return draftDunningEmail(input, tone);
  }

  const label = input.isCreditNote ? "l'avoir" : "la facture";
  const lines: string[] = [greeting(tone), ""];

  if (tone === "direct") {
    lines.push(`Ci-joint ${label} N° ${input.documentNumber} — ${formatCurrencyDZD(input.totalTTC)} TTC.`);
    if (!input.isCreditNote && input.dueDate) {
      lines.push(`Échéance : ${formatDateFR(input.dueDate)}.`);
    }
    lines.push("", "Cordialement,", input.senderCompany);
    return lines.join("\n");
  }

  lines.push(
    tone === "formal"
      ? `Nous vous prions de bien vouloir trouver ci-joint ${label} N° ${input.documentNumber} du ${formatDateFR(input.documentDate)}, d'un montant total de ${formatCurrencyDZD(input.totalTTC)} TTC.`
      : `Veuillez trouver ci-joint ${label} N° ${input.documentNumber} du ${formatDateFR(input.documentDate)}, d'un montant total de ${formatCurrencyDZD(input.totalTTC)} TTC.`
  );

  const itemsBlock = summarizeItems(input.items);
  if (itemsBlock) {
    lines.push("", "Récapitulatif :", itemsBlock);
  }

  if (!input.isCreditNote && input.dueDate) {
    lines.push(
      "",
      tone === "formal"
        ? `Nous vous remercions de bien vouloir procéder au règlement avant le ${formatDateFR(input.dueDate)}.`
        : `Le règlement est attendu avant le ${formatDateFR(input.dueDate)}.`
    );
  }

  if (!input.isCreditNote && input.bankRib) {
    lines.push(
      "",
      `Pour un règlement par virement, voici nos coordonnées bancaires : ${input.bankRib}${input.bankAgency ? ` (${input.bankAgency})` : ""}.`
    );
  }

  lines.push("", "Nous restons à votre disposition pour toute question.", "", "Cordialement,", input.senderCompany);

  return lines.join("\n");
}

function draftDeliveryEmail(input: DraftDeliveryInput, tone: EmailTone): string {
  const lines: string[] = [greeting(tone), ""];

  if (tone === "direct") {
    lines.push(
      `Livraison N° ${input.documentNumber} du ${formatDateFR(input.documentDate)} — merci de confirmer bonne réception.`,
      "",
      "Cordialement,",
      input.senderCompany
    );
    return lines.join("\n");
  }

  lines.push(`Nous vous confirmons la livraison N° ${input.documentNumber} du ${formatDateFR(input.documentDate)}.`);

  const itemsBlock = summarizeItems(input.items);
  if (itemsBlock) {
    lines.push("", "Articles livrés :", itemsBlock);
  }

  lines.push(
    "",
    tone === "formal"
      ? "Nous vous remercions de bien vouloir nous retourner ce document signé, ou de confirmer sa bonne réception, afin de valider la livraison."
      : "Merci de nous retourner ce bon signé, ou de simplement confirmer sa bonne réception par retour de mail.",
    "",
    "Cordialement,",
    input.senderCompany
  );

  return lines.join("\n");
}

function draftOrderEmail(input: DraftOrderInput, tone: EmailTone): string {
  const lines: string[] = [greeting(tone), ""];

  if (tone === "direct") {
    lines.push(
      `Ci-joint le bon de commande N° ${input.documentNumber} — ${formatCurrencyDZD(input.totalTTC)} TTC.` +
        (input.deliveryDate ? ` Livraison prévue le ${formatDateFR(input.deliveryDate)}.` : ""),
      "",
      "Cordialement,",
      input.senderCompany
    );
    return lines.join("\n");
  }

  lines.push(
    (tone === "formal" ? "Nous vous prions de bien vouloir trouver ci-joint" : "Veuillez trouver ci-joint") +
      ` le bon de commande N° ${input.documentNumber} du ${formatDateFR(input.documentDate)}` +
      (input.deliveryDate ? `, avec une livraison prévue le ${formatDateFR(input.deliveryDate)}` : "") +
      `, pour un montant total de ${formatCurrencyDZD(input.totalTTC)} TTC.`
  );

  const itemsBlock = summarizeItems(input.items);
  if (itemsBlock) {
    lines.push("", "Détail de la commande :", itemsBlock);
  }

  lines.push(
    "",
    tone === "formal" ? "Merci de bien vouloir nous confirmer la bonne réception de cette commande." : "Merci de nous confirmer que tout est en ordre de votre côté.",
    "",
    "Cordialement,",
    input.senderCompany
  );

  return lines.join("\n");
}

export function draftDocumentEmailBody(input: DraftInput, tone: EmailTone = "standard"): string {
  switch (input.docType) {
    case "invoice":
      return draftInvoiceEmail(input, tone);
    case "delivery":
      return draftDeliveryEmail(input, tone);
    case "order":
      return draftOrderEmail(input, tone);
  }
}
