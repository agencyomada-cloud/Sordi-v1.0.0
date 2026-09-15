import { numberToWords } from '@/lib/numberToWords';

export interface PDFInvoiceItem {
  id?: string;
  product_code?: string;
  product_name?: string;
  product_description?: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  amount?: number;
  products?: {
    name?: string;
    description?: string;
    unit?: string;
  };
}

export interface PDFClient {
  name?: string;
  address?: string;
  city?: string;
  wilaya?: string;
  phone?: string;
  email?: string;
  rc?: string;
  nif?: string;
  nis?: string;
  ai?: string;
  activite?: string;
  contact?: string;
}

export interface PDFInvoice {
  id?: string;
  invoice_number: string;
  invoice_date: string;
  /** "standard" | "exempt" | "ttc_direct" — see InvoiceTaxMode in lib/database.ts. Hides the TVA row and prints the exemption legend when "exempt". */
  tax_mode?: string;
  month_period?: string;
  due_date?: string;
  subtotal_ht: number;
  tva_rate: number;
  tva_amount: number;
  timbre: number;
  total_ttc: number;
  amount_paid?: number;
  balance_due?: number;
  status?: string;
  invoice_items: PDFInvoiceItem[];
  invoice_type?: string;
  original_invoice_id?: string;
  original_invoice?: {
    invoice_number?: string;
  };
  notes?: string;
  header_note?: string;
  custom_title?: string;
  delivery_number?: string;
  order_number?: string;
  clients?: PDFClient;
  client_name?: string;
  client_address?: string;
  client_rc?: string;
  client_nif?: string;
  client_nis?: string;
  client_ai?: string;
  client_activite?: string;
  use_secondary_register?: boolean;
  selected_secondary_rc?: string;
  selected_secondary_address?: string;
  discount?: number;
  discount_type?: 'percent' | 'amount';
  discount_value?: number;
  driver_name?: string;
  driver_cni?: string;
  vehicle_number?: string;
  delivery_location?: string;
  payment_method?: string;
  stamp_size?: number;
}

export interface PDFSettings {
  company_name?: string;
  legal_name?: string;
  company_address?: string;
  company_activity?: string;
  company_phone?: string;
  company_phones?: string | string[];
  company_email?: string;
  company_website?: string;
  company_nif?: string;
  company_nis?: string;
  company_rc?: string;
  company_ai?: string;
  company_capital?: string;
  company_rib?: string;
  company_bank_agency?: string;
  logo_data?: string;
  logo_size?: number;
  stamp_data?: string;
  stamp_size?: number;
  signature_data?: string;
  signature_size?: number;
  primary_color?: string;
  body_pattern_data?: string;
  /** Not a company setting — which watermark (if any) this export should
   *  carry, derived once in pdfGenerator.ts from the device's real
   *  LicenseState (see resolveLicenseWatermark): 'trial' during the 14-day
   *  active trial, 'expired' once trial/paid access has lapsed or was
   *  never activated, or undefined for a genuinely active paid license
   *  (no watermark at all). Never a plain boolean — trial and expired need
   *  different watermark text, not just "licensed vs not". */
  license_watermark?: "trial" | "expired";
  invoice_pdf_font?: string;
  // --- "Personnaliser" Smart Control Panel — see useSettings.ts's own note ---
  hide_empty_columns?: string; // "true" | "false"
  show_amount_in_words?: string; // "true" | "false"
  show_stamp_signature?: string; // "true" | "false"
}

/** Every currency figure on an Algerian invoice is shown as "X XXX,XX DZD". */
export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return "0.00 DZD";
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toFixed(2).replace(/\./g, ',');
  const parts = formatted.split(',');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const decimalPart = parts[1] || '00';
  const sign = amount < 0 ? "-" : "";
  return `${sign}${integerPart}.${decimalPart} DZD`;
};

/**
 * True if the string contains any Arabic-script character. Used to
 * selectively disarm `textTransform: 'uppercase'` on a handful of Text
 * styles (client name, item designation) in InvoicePDFDocument/
 * InvoiceTemplateEpure/InvoiceTemplateModerne.
 *
 * Arabic has no uppercase/lowercase concept, so uppercasing Arabic text is
 * always semantically meaningless — but it turned out to be actively
 * destructive here: `textTransform: 'uppercase'` (a locale-aware case-fold
 * applied by react-pdf's text-transform engine before layout) corrupts
 * Arabic text into unrelated glyphs specifically inside Tauri's WKWebView
 * runtime, while the exact same font/style/content renders correctly both
 * without the transform and in a plain Node render of the same component —
 * i.e. this is a case-folding bug hit only in that specific runtime, not a
 * font or shaping problem (registering 'Readex Pro Arabic' fixed shaping/
 * RTL correctly; this is the separate bug that was still corrupting the
 * DESTINATAIRE/item-name fields after that fix). Skipping the transform for
 * Arabic content sidesteps it with zero risk: nothing is lost, since
 * uppercasing Arabic was never meaningful to begin with, and every non-
 * Arabic (French) string keeps its existing all-caps styling unchanged.
 */
export function containsArabicScript(text: string | null | undefined): boolean {
  if (!text) return false;
  return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻾]/.test(text);
}

export const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

export interface ResolvedInvoiceData {
  docTitle: string;
  docNumber: string;
  isCreditNote: boolean;
  isProforma: boolean;
  isQuote: boolean;
  isDelivery: boolean;
  isOrder: boolean;
  isTaxExempt: boolean;
  clientName: string;
  clientAddress: string;
  clientRc: string;
  clientNif: string;
  clientNis: string;
  clientAi: string;
  clientActivite: string;
  clientContact: string;
  items: PDFInvoiceItem[];
  wordsFrench: string;
  amountInWordsLabel: string;
  /** Whether to render the amount-in-words block at all — respects
   *  show_amount_in_words (default false) on top of the pre-existing
   *  order/delivery exclusion (this resolver is invoice/proforma/quote/
   *  credit-note only, so that exclusion doesn't apply here). */
  showAmountInWords: boolean;
  /** Whether to render the "Remise" totals row — respects
   *  hide_empty_columns (default TRUE, to match this app's pre-existing,
   *  unconditional "never show a distracting Remise: 0.00 line" behavior):
   *  true hides the row when nothing was actually discounted; false always
   *  shows it, even at zero, for a viewer who wants every total line
   *  present for comparison across documents. */
  showRemiseRow: boolean;
  /** Whether to render the stamp/signature image block — respects
   *  show_stamp_signature (default true). Lets a user print a blank
   *  document to stamp/sign by hand without deleting the uploaded images
   *  from Settings. */
  showStampSignature: boolean;
}

/**
 * One place that resolves invoice display fields (doc title/number, client
 * identity, amount in words) so all three PDF templates read from the same
 * logic instead of triplicating it. `settings` is optional (some legacy
 * call sites still pass none) — every Smart Control Panel field below
 * falls back to its documented default when absent.
 */
export function resolveInvoiceData(invoice: PDFInvoice, settings?: PDFSettings): ResolvedInvoiceData {
  const isCreditNote = invoice.invoice_type === 'credit_note';
  const isProforma = invoice.invoice_type === 'proforma';
  const isQuote = invoice.invoice_type === 'quote';
  const isDelivery = invoice.invoice_type === 'delivery_note' || !!invoice.delivery_number;
  const isOrder = invoice.invoice_type === 'order' || !!invoice.order_number;

  const docTitle = invoice.custom_title
    || (isCreditNote && "FACTURE D'AVOIR")
    || (isProforma && "FACTURE PROFORMA")
    || (isQuote && "DEVIS")
    || (isDelivery && "BON DE LIVRAISON")
    || (isOrder && "BON DE COMMANDE")
    || "FACTURE";

  const docNumber = (isDelivery && (invoice.delivery_number || invoice.invoice_number))
    || (isOrder && (invoice.order_number || invoice.invoice_number))
    || invoice.invoice_number;

  const clientAddress = invoice.use_secondary_register && invoice.selected_secondary_address
    ? invoice.selected_secondary_address
    : (invoice.clients?.address || invoice.client_address || "");
  const clientRc = invoice.use_secondary_register && invoice.selected_secondary_rc
    ? invoice.selected_secondary_rc
    : (invoice.clients?.rc || invoice.client_rc || "");

  // "Arrêté" stays invariant across every type — only the article + noun
  // that follows changes. A devis/proforma exported as PDF must never read
  // like a real "facture" here.
  const amountInWordsLabel = isCreditNote
    ? "Arrêté le présent avoir à la somme de"
    : isQuote
    ? "Arrêté le présent devis à la somme de"
    : isProforma
    ? "Arrêté la présente facture proforma à la somme de"
    : "Arrêté la présente facture à la somme de";

  const hasDiscount = (invoice.discount || 0) > 0 || (invoice.discount_value || 0) > 0;
  const hideEmptyColumns = readInvoiceBoolSetting(settings?.hide_empty_columns, true);

  return {
    docTitle,
    docNumber,
    isCreditNote,
    isProforma,
    isQuote,
    isDelivery,
    isOrder,
    isTaxExempt: invoice.tax_mode === 'exempt',
    clientName: invoice.clients?.name || invoice.client_name || "",
    clientAddress,
    clientRc,
    clientNif: invoice.clients?.nif || invoice.client_nif || "",
    clientNis: invoice.clients?.nis || invoice.client_nis || "",
    clientAi: invoice.clients?.ai || invoice.client_ai || "",
    clientActivite: invoice.clients?.activite || invoice.client_activite || "",
    clientContact: invoice.clients?.contact || "",
    items: invoice.invoice_items || [],
    wordsFrench: numberToWords(invoice.total_ttc || 0),
    amountInWordsLabel,
    showAmountInWords: readInvoiceBoolSetting(settings?.show_amount_in_words, false),
    showRemiseRow: hasDiscount || !hideEmptyColumns,
    showStampSignature: readInvoiceBoolSetting(settings?.show_stamp_signature, true),
  };
}

export interface DocumentSectionFlags {
  showTva: boolean;
  showTimbre: boolean;
  showMontantEnLettres: boolean;
  showPaymentMethod: boolean;
  /** A delivery note purely proves physical delivery of goods — it never
   *  carries pricing at all (unlike an order, which still shows P.U/Total
   *  HT). false only for isDelivery: hides the P.U/Total HT item-table
   *  columns and the entire totals block (which would otherwise also
   *  surface TVA/Total TTC), mirroring the web canvas's own `showPricing`
   *  in useEditableInvoiceLogic.ts. */
  showPricing: boolean;
  /** "Total TTC"/"Net à déduire" implies tax is baked in — misleading once
   *  the TVA line is hidden, so order/delivery get a plain "Total" label. */
  grandTotalLabel: string;
  /** Set only when the invoice was created in "exempt" tax mode — the legal
   *  legend to print in place of the (hidden) TVA breakdown row. */
  taxExemptionLegend: string | null;
  /** Overrides the default "Cachet et Signature" stamp-box title/placeholder
   *  text — set for delivery notes to a client-facing acknowledgment,
   *  mirroring the web canvas's own `stampLabel`. */
  stampLabel: string | undefined;
}

/**
 * Which invoice-specific legal/tax sections apply to this document type.
 * Orders and delivery notes are internal operational documents, not tax
 * instruments — TVA breakdown, droit de timbre, and "montant en lettres"
 * are Algerian invoice-specific legal requirements that don't apply to them.
 * Separately, an invoice explicitly marked "Hors Taxe / Sans TVA" also
 * hides the TVA row (Total HT and Total TTC are identical there — nothing
 * to break down) and prints the exemption legend instead.
 */
export function getDocumentSectionFlags(data: Pick<ResolvedInvoiceData, 'isDelivery' | 'isOrder' | 'isCreditNote' | 'isTaxExempt'>): DocumentSectionFlags {
  const isOrderOrDelivery = data.isDelivery || data.isOrder;
  return {
    showTva: !isOrderOrDelivery && !data.isTaxExempt,
    showTimbre: !isOrderOrDelivery,
    showMontantEnLettres: !isOrderOrDelivery,
    showPaymentMethod: !isOrderOrDelivery,
    showPricing: !data.isDelivery,
    grandTotalLabel: data.isCreditNote ? "Net à déduire" : isOrderOrDelivery ? "Total" : "Total TTC",
    taxExemptionLegend: (!isOrderOrDelivery && data.isTaxExempt)
      ? "Régime d'exonération / Facturation sans TVA — Montant Net à Payer HT - TVA non applicable"
      : null,
    stampLabel: data.isDelivery ? "Cachet et Signature du Client (Bon pour accord et réception)" : undefined,
  };
}

/**
 * Splits the settings' phone field(s) into a clean list. No fallback phone
 * numbers here — an unconfigured company simply shows none, rather than a
 * previous tenant's real number.
 */
export function resolveCompanyPhones(settings?: PDFSettings): string[] {
  if (!settings?.company_phones && !settings?.company_phone) return [];
  if (settings?.company_phones) {
    if (Array.isArray(settings.company_phones)) return settings.company_phones;
    try {
      const parsed = JSON.parse(settings.company_phones);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return settings.company_phones.split(/[\n,;]/).map(p => p.trim()).filter(Boolean);
    }
  }
  if (settings?.company_phone) {
    return settings.company_phone.split(/[\n,;]/).map(p => p.trim()).filter(Boolean);
  }
  return [];
}

export function formatPhone(p: string): string {
  return p.startsWith("(+") ? p : `(+213) ${p.replace(/^0/, '')}`;
}

/** The three selectable invoice PDF themes, set in Settings. */
export type InvoicePdfTheme = 'structure' | 'epure' | 'moderne';

export const INVOICE_PDF_THEMES: { value: InvoicePdfTheme; label: string; description: string }[] = [
  { value: 'structure', label: 'Structuré', description: "Grille tarifée classique, en-tête pleine largeur — le style facture officielle." },
  { value: 'epure', label: 'Épuré', description: "Traits fins, aucune couleur de fond, hiérarchie typographique minimale." },
  { value: 'moderne', label: 'Moderne', description: "Bandeau et accents dans votre couleur de marque, tableau aéré." },
];

/**
 * The selectable invoice PDF fonts, set in Settings. `label` doubles as the
 * exact family name passed to react-pdf's Font.register in each theme file
 * (InvoicePDFDocument/InvoiceTemplateEpure/InvoiceTemplateModerne) — keep it
 * in sync with those registrations if this list changes.
 *
 * "cairo"/"tajawal" are listed here (Arabic-optimized, per the Smart
 * Control Panel's typography engine) but are NOT YET registered with
 * react-pdf in any theme file — picking one updates the picker/preview
 * immediately, but the exported PDF still falls back to Montserrat until a
 * follow-up adds their Font.register calls. This mirrors every other
 * français/Arabic split already in the app's PDF pipeline: additive to the
 * setting, deferred on the render side.
 */
export type InvoicePdfFont = 'montserrat' | 'inter' | 'poppins' | 'roboto' | 'cairo' | 'tajawal';

export const INVOICE_PDF_FONTS: { value: InvoicePdfFont; label: string; description: string }[] = [
  { value: 'montserrat', label: 'Montserrat', description: "La police de l'application Sordi — cohérence totale entre l'app et vos documents." },
  { value: 'inter', label: 'Inter', description: "Conçue pour les écrans, très lisible en petite taille — look produit/SaaS." },
  { value: 'poppins', label: 'Poppins', description: "Géométrique et chaleureuse, un rendu moderne et accueillant." },
  { value: 'roboto', label: 'Roboto', description: "Neutre et professionnelle, l'un des choix les plus classiques pour les documents." },
  { value: 'cairo', label: 'Cairo', description: "Optimisée pour l'arabe, également lisible en latin — pour une facturation bilingue." },
  { value: 'tajawal', label: 'Tajawal', description: "Géométrique et moderne, conçue pour l'arabe — alternative à Cairo." },
];

/** Family name to hand to react-pdf's `fontFamily` style property — falls back to Montserrat (the app's own font) when unset or unrecognized.
 *  'cairo'/'tajawal' resolve to 'Readex Pro' (see pdfFonts.ts's own note) —
 *  the two Arabic-labeled options never had a real registered font behind
 *  them before, so this also fixes those two specific choices, not just
 *  the new hybrid-text fallback below. */
export function resolveInvoicePdfFontFamily(settings?: PDFSettings): string {
  const match = INVOICE_PDF_FONTS.find((f) => f.value === settings?.invoice_pdf_font);
  if (!match) return 'Montserrat';
  if (match.value === 'cairo' || match.value === 'tajawal') return 'Readex Pro';
  return match.label;
}

/**
 * The font STACK to hand to react-pdf's `fontFamily` style property (which
 * accepts `string | string[]` — see @react-pdf/stylesheet's Style type) so
 * Arabic text renders correctly no matter which body font is selected.
 *
 * react-pdf's layout engine (@react-pdf/textkit) does real Unicode script
 * itemization, per-run font substitution across the stack, Arabic glyph
 * shaping (joining), and full bidi reordering (via bidi-js) — all
 * automatic, with no "isRtl" prop (none exists) and no manual text
 * reshaping/reversal needed. The ONLY reason Arabic previously rendered
 * disconnected and reversed is that no font in the stack had any Arabic
 * glyphs at all (Montserrat/Inter/Poppins/Roboto are Latin-only, and
 * 'cairo'/'tajawal' were never actually registered — see
 * resolveInvoicePdfFontFamily above) — nothing for the engine to shape or
 * substitute. 'Readex Pro Arabic' (registered in pdfFonts.ts, the same
 * typeface the app already uses for Arabic UI) closes that gap.
 *
 * Used by InvoicePDFDocument/InvoiceTemplateEpure/InvoiceTemplateModerne —
 * every react-pdf invoice/order/delivery-note document — in place of
 * resolveInvoicePdfFontFamily wherever the resolved family feeds a Text
 * style, so hybrid French/Arabic content (a client name, a note, an
 * "activité" field) renders correctly regardless of which body font the
 * user picked.
 */
export function resolveInvoicePdfFontStack(settings?: PDFSettings): string[] {
  const bodyFont = resolveInvoicePdfFontFamily(settings);
  if (bodyFont === 'Readex Pro') return [bodyFont];
  return [bodyFont, 'Readex Pro Arabic'];
}

/**
 * Auto-Contrast: given a hex accent color, returns the readable text color
 * to use on top of it — pure white or a dark slate — computed from the
 * color's relative luminance (WCAG-style weighted RGB, not a flat
 * brightness average) rather than a fixed light/dark threshold guess.
 * Shared so the (future) preview/PDF header and totals bands compute this
 * the same way the customization panel's own live swatch preview does —
 * one formula, never two color-contrast implementations drifting apart.
 */
export function getAutoContrastTextColor(hexColor: string): '#FFFFFF' | '#1E293B' {
  const hex = hexColor.replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const r = parseInt(normalized.slice(0, 2), 16) || 0;
  const g = parseInt(normalized.slice(2, 4), 16) || 0;
  const b = parseInt(normalized.slice(4, 6), 16) || 0;
  // Relative luminance (sRGB, gamma-corrected) — standard WCAG formula.
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  // A dark slate (not pure black) reads better than #000 on light accents,
  // matching the app's own dark-text token used elsewhere in the UI.
  return luminance > 0.5 ? '#1E293B' : '#FFFFFF';
}

/**
 * Maps a device's real LicenseState (src/lib/database.ts) to the watermark
 * this export should carry — the one place this decision is made, so every
 * PDF call site just passes the raw license_state through instead of each
 * re-deriving its own "is this licensed" boolean (which is exactly how the
 * old license_active flag lost the trial/expired distinction: every call
 * site computed `licenseStatus?.state === "active"`, collapsing both
 * TRIAL_ACTIVE and a genuinely paid license to the same "no watermark"
 * outcome). Kept independent of any @/lib/database import here (this file
 * has no such dependency) — takes the plain string so callers can pass
 * `licenseStatus?.license_state` directly without pulling in an extra type.
 */
export function resolveLicenseWatermark(licenseState: string | null | undefined): "trial" | "expired" | undefined {
  switch (licenseState) {
    case "TRIAL_ACTIVE":
      return "trial";
    case "PAID_ACTIVE":
    case "OFFLINE_GRACE":
      return undefined;
    // TRIAL_EXPIRED, PAID_EXPIRED, REVOKED, UNREGISTERED, and any
    // unrecognized/missing value all fall through to "expired" — the safe
    // default when license state can't be confirmed as genuinely active.
    default:
      return "expired";
  }
}

/** Parses one of the Smart Control Panel's boolean flags — stored as the
 *  literal strings "true"/"false" (see useSettings.ts's own note on the
 *  schemaless settings store), never a real boolean. */
export function readInvoiceBoolSetting(value: string | undefined, defaultValue: boolean): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

