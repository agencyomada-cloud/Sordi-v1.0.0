import { numberToWords } from "@/lib/numberToWords";
import { chunkItems } from "@/lib/paginationUtils";
import { INVOICE_PDF_FONTS } from "@/components/pdf/invoicePdfShared";

/**
 * Shared between the read-only preview, the print view, and the editable
 * live preview — one place for "what does this invoice look like as data"
 * so the three HTML surfaces (and the three PDF templates) all agree.
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (!amount && amount !== 0) return "0.00 DZD";
  const formatted = Math.abs(amount).toFixed(2).replace(/\./g, ',');
  const parts = formatted.split(',');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const decimalPart = parts[1] || '00';
  const sign = amount < 0 ? "-" : "";
  return `${sign}${integerPart}.${decimalPart} DZD`;
}

export function getCompanyPhones(settings: any): string[] {
  if (!settings?.company_phones && !settings?.company_phone) return [];
  if (settings?.company_phones) {
    if (Array.isArray(settings.company_phones)) return settings.company_phones;
    try {
      const parsed = JSON.parse(settings.company_phones);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return settings.company_phones.split(/[\n,;]/).map((p: string) => p.trim()).filter(Boolean);
    }
  }
  if (settings?.company_phone) {
    return settings.company_phone.split(/[\n,;]/).map((p: string) => p.trim()).filter(Boolean);
  }
  return [];
}

export function formatPhone(p: string): string {
  return p.startsWith("(+") ? p : `(+213) ${p.replace(/^0/, '')}`;
}

export function resolveHtmlInvoiceData(invoice: any) {
  const isCreditNote = invoice.invoice_type === "credit_note";
  const isProforma = invoice.invoice_type === "proforma";

  const docTitle = invoice.custom_title
    || (isCreditNote && "FACTURE D'AVOIR")
    || (isProforma && "FACTURE PROFORMA")
    || "FACTURE";

  const clientName = invoice.clients?.name || invoice.client_name || "";
  const clientAddress = invoice.use_secondary_register && invoice.selected_secondary_address
    ? invoice.selected_secondary_address
    : (invoice.clients?.address || invoice.client_address || "");
  const clientRc = invoice.use_secondary_register && invoice.selected_secondary_rc
    ? invoice.selected_secondary_rc
    : (invoice.clients?.rc || invoice.client_rc || "");
  const clientNif = invoice.clients?.nif || invoice.client_nif || "";
  const clientAi = invoice.clients?.ai || invoice.client_ai || "";
  const clientNis = invoice.clients?.nis || invoice.client_nis || "";
  const clientActivite = invoice.clients?.activite || invoice.client_activite || "";
  const clientContact = invoice.clients?.contact || invoice.client_contact || "";

  const items = invoice.invoice_items || [];
  const pages = chunkItems(items);

  return {
    isCreditNote,
    isProforma,
    docTitle,
    clientName,
    clientAddress,
    clientRc,
    clientNif,
    clientAi,
    clientNis,
    clientActivite,
    clientContact,
    items,
    pages,
    wordsFrench: numberToWords(invoice.total_ttc || 0),
  };
}

export interface LegalField {
  label: string;
  value?: string;
}

export function resolveLegalFields(settings: any): LegalField[] {
  return [
    { label: 'Forme Juridique', value: settings?.company_legal_form },
    { label: 'N° Reg. Commerce', value: settings?.company_rc },
    { label: 'NIF', value: settings?.company_nif },
    { label: 'Articl. Imposition', value: settings?.company_ai },
    { label: 'NIS', value: settings?.company_nis },
    { label: 'Capital Social', value: settings?.company_capital },
  ].filter(f => f.value);
}

export type InvoiceHtmlTheme = 'structure' | 'epure' | 'moderne';

export function resolveInvoiceHtmlTheme(settings: any): InvoiceHtmlTheme {
  const theme = settings?.invoice_pdf_theme;
  return theme === 'epure' || theme === 'moderne' ? theme : 'structure';
}

/**
 * CSS font-family value for the on-screen editable preview (invoice, order,
 * delivery note alike) — same setting (Paramètres > Thème de la facture PDF
 * > Police) and same option list as the exported PDF's
 * resolveInvoicePdfFontFamily, so the live preview never shows a different
 * face than what actually gets generated.
 */
export function resolveInvoiceHtmlFontFamily(settings: any): string {
  const match = INVOICE_PDF_FONTS.find((f) => f.value === settings?.invoice_pdf_font);
  const family = match ? match.label : 'Montserrat';
  return `'${family}', sans-serif`;
}
