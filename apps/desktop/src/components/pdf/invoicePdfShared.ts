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
}

export interface PDFSettings {
  company_name?: string;
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
  footer_logo_data?: string;
  qr_code_data?: string;
  stamp_data?: string;
  stamp_size?: number;
  primary_color?: string;
  body_pattern_data?: string;
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
  isDelivery: boolean;
  isOrder: boolean;
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
}

/**
 * One place that resolves invoice display fields (doc title/number, client
 * identity, amount in words) so all three PDF templates read from the same
 * logic instead of triplicating it.
 */
export function resolveInvoiceData(invoice: PDFInvoice): ResolvedInvoiceData {
  const isCreditNote = invoice.invoice_type === 'credit_note';
  const isProforma = invoice.invoice_type === 'proforma';
  const isDelivery = invoice.invoice_type === 'delivery_note' || !!invoice.delivery_number;
  const isOrder = invoice.invoice_type === 'order' || !!invoice.order_number;

  const docTitle = invoice.custom_title
    || (isCreditNote && "FACTURE D'AVOIR")
    || (isProforma && "FACTURE PROFORMA")
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

  return {
    docTitle,
    docNumber,
    isCreditNote,
    isProforma,
    isDelivery,
    isOrder,
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
