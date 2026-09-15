import React from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { pdf, DocumentProps } from '@react-pdf/renderer';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { Settings } from "@/hooks/useSettings";
import { InvoicePDFDocument } from "@/components/pdf/InvoicePDFDocument";
import { InvoiceTemplateEpure } from "@/components/pdf/InvoiceTemplateEpure";
import { InvoiceTemplateModerne } from "@/components/pdf/InvoiceTemplateModerne";
import { PDFInvoice, PDFSettings, PDFInvoiceItem, InvoicePdfTheme, resolveLicenseWatermark } from "@/components/pdf/invoicePdfShared";
import { resolveInvoiceAppearance } from "@/components/pdf/invoiceAppearance";
import { CumulativesPDFDocument, ClientCumulativeRecord } from "@/components/pdf/CumulativesPDFDocument";
import { PayrollPDFDocument, PayrollPDFRow } from "@/components/pdf/PayrollPDFDocument";
import { BulletinPaiePDFDocument, BulletinPaieRun, BulletinPaieEmployee } from "@/components/pdf/BulletinPaiePDFDocument";
import { MonthlyReportPDF } from "@/components/pdf/MonthlyReportPDF";
import { ContractPDFDocument, type ContractPDFProps } from "@/components/pdf/ContractPDFDocument";
import { db, MonthlyBusinessReport } from "@/lib/database";
import { toast } from "sonner";

export type { PDFInvoiceItem, PDFInvoice, PDFSettings };

/** The three selectable invoice PDF themes, chosen in Settings. */
const INVOICE_PDF_TEMPLATES: Record<InvoicePdfTheme, typeof InvoicePDFDocument> = {
  structure: InvoicePDFDocument,
  epure: InvoiceTemplateEpure,
  moderne: InvoiceTemplateModerne,
};

export type AnyDocument = Partial<PDFInvoice> & Record<string, unknown>;

/** Makes a display string (a client name, typically) safe to embed inside a
 *  generated file name: collapses whitespace to underscores and strips
 *  characters the underlying filesystem/OS would reject, without touching
 *  accented letters — a client called "Établissement Amélioré" stays
 *  readable as "Établissement_Amélioré" rather than being mangled down to
 *  ASCII. */
export function sanitizeFileNamePart(value: string): string {
  return value.trim().replace(/\s+/g, '_').replace(/[\\/:*?"<>|]+/g, '');
}

/** The one place that names an exported/attached PDF for a given document —
 *  shared by generateInvoicePDF's own save path below and by any other call
 *  site building a file name outside it (bulk ZIP export, email
 *  attachments), so all three always agree instead of drifting apart.
 *  The 4 core invoicing types (Facture/Proforma/Devis/Avoir) get
 *  "[Type]_[Number]_[ClientName].pdf" (e.g. "Devis_DEV-2026-001_Nadatek.pdf")
 *  — the strict serialized number stays the document's real identity, the
 *  client name is purely a browsing convenience. Delivery notes, orders and
 *  the cumulatives report aren't tied to one client the same way, so they
 *  keep their existing plain "Prefix-Number.pdf" shape. */
export function resolveDocumentFileName(doc: AnyDocument): string {
  let prefix = 'Document';
  let number = '000';
  let includeClientInFileName = false;

  if (doc.invoice_type === 'proforma') {
    prefix = 'Proforma';
    number = doc.invoice_number || '000';
    includeClientInFileName = true;
  } else if (doc.invoice_type === 'quote') {
    prefix = 'Devis';
    number = doc.invoice_number || '000';
    includeClientInFileName = true;
  } else if (doc.invoice_type === 'credit_note') {
    prefix = 'Avoir';
    number = doc.invoice_number || '000';
    includeClientInFileName = true;
  } else if (doc.invoice_type === 'delivery_note' || doc.delivery_number) {
    prefix = 'BonLivraison';
    number = doc.delivery_number || doc.invoice_number || '000';
  } else if (doc.invoice_type === 'order' || doc.order_number) {
    prefix = 'BonCommande';
    number = doc.order_number || doc.invoice_number || '000';
  } else if (doc.invoice_type === 'cumulatives') {
    prefix = 'CumulesVentes';
    number = new Date().toISOString().split('T')[0];
  } else {
    prefix = 'Facture';
    number = doc.invoice_number || '000';
    includeClientInFileName = true;
  }

  if (!includeClientInFileName) {
    return `${prefix}-${number}.pdf`;
  }
  const clientName = String(doc.clients?.name || doc.client_name || doc.supplier_name || 'Client');
  return `${prefix}_${number}_${sanitizeFileNamePart(clientName)}.pdf`;
}

export interface PDFOptions {
  paper_size?: string;
  landscape?: boolean;
  elementId?: string;
}

/**
 * Converts a Blob object into a Base64 encoded string (without Data URI prefix)
 */
export const blobToBase64 = async (blob: Blob): Promise<string> => {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Opens a just-saved document — the handler behind every "Ouvrir" toast
 * action across the document export flows. Prefers the real saved file
 * (native default-viewer via the open_file_path Tauri command) since that's
 * the actual file on disk; falls back to opening the in-memory blob in a
 * new browser tab when Tauri isn't available (web preview) or the native
 * open failed for some reason (path since moved/deleted, permissions, ...).
 */
export const openSavedFile = async (path: string | null, blob?: Blob): Promise<void> => {
  if (path) {
    try {
      await invoke("open_file_path", { path });
      return;
    } catch (err) {
      console.warn("open_file_path failed, trying plugin-opener:", err);
      try {
        const { openPath } = await import("@tauri-apps/plugin-opener");
        await openPath(path);
        return;
      } catch (openerErr) {
        console.warn("plugin-opener openPath failed, falling back to blob preview:", openerErr);
      }
    }
  }
  if (blob) {
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    // Revoked well after the new tab has had time to load it — not
    // immediately, since the browser fetches the blob URL asynchronously.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  toast.error("Impossible d'ouvrir le fichier");
};

/**
 * Bundles multiple PDF blobs into a single .zip and saves it — used by list
 * pages' bulk "download selected" action. Tries the same direct-to-Downloads
 * save the single-document flows use; falls back to a browser download link
 * when running outside Tauri (dev/web preview), matching the fallback
 * pattern used elsewhere in this file.
 */
export const downloadBlobsAsZip = async (
  files: { blob: Blob; fileName: string }[],
  zipFileName: string
): Promise<void> => {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  files.forEach(({ blob, fileName }) => zip.file(fileName, blob));
  const zipBlob = await zip.generateAsync({ type: "blob" });

  try {
    const zipBase64 = await blobToBase64(zipBlob);
    await invoke("save_pdf", { pdfBase64: zipBase64, fileName: zipFileName });
  } catch (err) {
    console.warn("Tauri save unavailable, falling back to browser download:", err);
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = zipFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

/**
 * Generates a vector PDF Blob directly using @react-pdf/renderer
 */
export const generateInvoicePDFBlob = async (
  doc: AnyDocument,
  settings?: Settings,
  // The device's raw LicenseState (e.g. "TRIAL_ACTIVE", "PAID_ACTIVE",
  // "TRIAL_EXPIRED") — every call site just forwards
  // licenseStatus?.license_state, never computes its own "is this licensed"
  // boolean. resolveLicenseWatermark below is the one place that decision
  // gets made. Kept as a plain string (not LicenseState) so this file
  // doesn't need to import that type from @/lib/database.
  licenseState?: string
): Promise<Blob> => {
  try {
    const rawItems = Array.isArray(doc.invoice_items)
      ? doc.invoice_items
      : Array.isArray(doc.items)
      ? doc.items
      : [];

    const formattedInvoice: PDFInvoice = {
      id: doc.id ? String(doc.id) : undefined,
      invoice_number: doc.invoice_number ? String(doc.invoice_number) : "00000",
      invoice_date: doc.invoice_date ? String(doc.invoice_date) : new Date().toISOString(),
      month_period: doc.month_period ? String(doc.month_period) : undefined,
      due_date: doc.due_date ? String(doc.due_date) : undefined,
      subtotal_ht: Number(doc.subtotal_ht) || 0,
      tva_rate: Number(doc.tva_rate) || 19,
      tva_amount: Number(doc.tva_amount) || 0,
      timbre: Number(doc.timbre) || 0,
      total_ttc: Number(doc.total_ttc) || 0,
      amount_paid: doc.amount_paid !== undefined ? Number(doc.amount_paid) : undefined,
      balance_due: doc.balance_due !== undefined ? Number(doc.balance_due) : undefined,
      status: doc.status ? String(doc.status) : undefined,
      invoice_items: rawItems.map((item: any) => ({
        id: item.id ? String(item.id) : undefined,
        product_code: item.product_code ? String(item.product_code) : item.code ? String(item.code) : undefined,
        product_name: item.product_name ? String(item.product_name) : item.name ? String(item.name) : undefined,
        product_description: item.product_description ? String(item.product_description) : item.description ? String(item.description) : undefined,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        amount: item.amount !== undefined ? Number(item.amount) : undefined,
        products: item.products,
      })),
      invoice_type: doc.invoice_type || (doc.delivery_number ? 'delivery_note' : doc.order_number ? 'order' : 'invoice'),
      original_invoice_id: doc.original_invoice_id,
      notes: doc.notes,
      header_note: doc.header_note,
      custom_title: doc.custom_title,
      delivery_number: doc.delivery_number,
      order_number: doc.order_number,
      clients: doc.clients ? {
        name: doc.clients.name,
        address: doc.clients.address,
        city: doc.clients.city,
        wilaya: doc.clients.wilaya,
        phone: doc.clients.phone,
        email: doc.clients.email,
        rc: doc.clients.rc,
        nif: doc.clients.nif,
        nis: doc.clients.nis,
        ai: doc.clients.ai,
        activite: doc.clients.activite,
        contact: doc.clients.contact,
      } : undefined,
      client_name: doc.client_name,
      client_address: doc.client_address,
      client_rc: doc.client_rc,
      client_nif: doc.client_nif,
      client_nis: doc.client_nis,
      client_ai: doc.client_ai,
      client_activite: doc.client_activite,
      use_secondary_register: doc.use_secondary_register,
      selected_secondary_rc: doc.selected_secondary_rc,
      selected_secondary_address: doc.selected_secondary_address,
      discount: doc.discount !== undefined ? Number(doc.discount) : undefined,
      discount_type: doc.discount_type,
      discount_value: doc.discount_value !== undefined ? Number(doc.discount_value) : undefined,
      driver_name: doc.driver_name,
      driver_cni: doc.driver_cni,
      vehicle_number: doc.vehicle_number,
      delivery_location: doc.delivery_location,
      stamp_size: (doc as any).stamp_size !== undefined && (doc as any).stamp_size !== null
        ? Number((doc as any).stamp_size)
        : (settings?.stamp_size ? Number(settings.stamp_size) : 180),
    };

    // Single source of truth for logo/stamp sizing and theme — computed once
    // here from the same (doc, settings) pair the templates themselves would
    // otherwise re-derive fallbacks from independently. Replaces the local
    // `effectiveStampSize` fallback chain that used to live only in this
    // function, so pdfSettings/formattedInvoice below and the resolver can
    // never drift apart.
    const resolvedAppearance = resolveInvoiceAppearance(doc, { ...(settings as any), invoice_pdf_theme: (settings as any)?.invoice_pdf_theme });
    const effectiveStampSize = resolvedAppearance.stampSize;

    const pdfSettings: PDFSettings = settings ? {
      company_name: settings.company_name,
      legal_name: (settings as any)?.legal_name || settings?.company_name || "EURL OMADA AGENCY",
      company_address: settings.company_address,
      company_activity: settings.company_activity,
      company_phone: settings.company_phone,
      company_phones: settings.company_phones,
      company_email: settings.company_email,
      company_website: settings.company_website,
      company_nif: settings.company_nif,
      company_nis: settings.company_nis,
      company_rc: settings.company_rc,
      company_ai: settings.company_ai,
      company_capital: settings.company_capital,
      company_rib: settings.company_rib,
      company_bank_agency: settings.company_bank_agency,
      logo_data: settings.logo_data,
      logo_size: resolvedAppearance.logoHeight,
      body_pattern_data: settings.body_pattern_data,
      stamp_data: settings.stamp_data,
      stamp_size: effectiveStampSize,
      signature_data: settings.signature_data,
      signature_size: settings.signature_size ? Number(settings.signature_size) : undefined,
      primary_color: settings.primary_color,
      invoice_pdf_font: settings.invoice_pdf_font,
      hide_empty_columns: settings.hide_empty_columns,
      show_amount_in_words: settings.show_amount_in_words,
      show_stamp_signature: settings.show_stamp_signature,
      license_watermark: resolveLicenseWatermark(licenseState),
    } : { license_watermark: resolveLicenseWatermark(licenseState), stamp_size: effectiveStampSize, legal_name: "EURL OMADA AGENCY" };

    const theme = resolvedAppearance.theme;
    const Template = INVOICE_PDF_TEMPLATES[theme] || InvoicePDFDocument;

    console.log('🚀 [PDF_EXPORT_PAYLOAD]', { invoiceId: formattedInvoice.id, resolvedAppearance });

    const instance = pdf(React.createElement(Template, { invoice: formattedInvoice, settings: pdfSettings }) as React.ReactElement<DocumentProps>);
    const blob = await instance.toBlob();
    return blob;
  } catch (error) {
    console.error("Failed to render vector PDF blob:", error);
    throw error;
  }
};

/**
 * Generates a vector PDF Blob for client sales cumulative reports
 */
export const generateCumulativesPDFBlob = async (
  records: ClientCumulativeRecord[],
  totals: { total_ht: number; total_tva: number; total_timbre: number; total_ttc: number },
  periodLabel?: string,
  settings?: Settings
): Promise<Blob> => {
  const instance = pdf(
    React.createElement(CumulativesPDFDocument, {
      records,
      totals,
      periodLabel,
      settings: settings ? {
        company_name: settings.company_name,
        company_address: settings.company_address,
        company_activity: settings.company_activity,
        company_phone: settings.company_phone,
        company_phones: settings.company_phones,
        company_email: settings.company_email,
        company_nif: settings.company_nif,
        company_nis: settings.company_nis,
        company_rc: settings.company_rc,
        company_ai: settings.company_ai,
        company_capital: settings.company_capital,
        company_rib: settings.company_rib,
        company_bank_agency: settings.company_bank_agency,
        logo_data: settings.logo_data,
        qr_code_data: settings.qr_code_data,
        primary_color: settings.primary_color,
        body_pattern_data: settings.body_pattern_data,
      } : {}
    }) as React.ReactElement<DocumentProps>
  );
  return await instance.toBlob();
};

export const generateCumulativesPDF = async (
  records: ClientCumulativeRecord[],
  totals: { total_ht: number; total_tva: number; total_timbre: number; total_ttc: number },
  periodLabel?: string,
  settings?: Settings
): Promise<string> => {
  try {
    const blob = await generateCumulativesPDFBlob(records, totals, periodLabel, settings);
    const pdfBase64 = await blobToBase64(blob);

    const fileName = `CumulesVentes-${new Date().toISOString().split('T')[0]}.pdf`;

    try {
      await invoke<string>('save_pdf', { pdfBase64, fileName });
    } catch (err) {
      console.warn("Tauri backend save_pdf unavailable, triggering browser fallback download:", err);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    return pdfBase64;
  } catch (error) {
    console.error("Failed to generate Cumulatives PDF:", error);
    throw error;
  }
};

/**
 * Generates a vector PDF Blob for a payroll (paie) summary table
 */
export const generatePayrollPDFBlob = async (
  rows: PayrollPDFRow[],
  totalNetAPayer: number,
  periodLabel?: string,
  settings?: Settings
): Promise<Blob> => {
  const instance = pdf(
    React.createElement(PayrollPDFDocument, {
      rows,
      totalNetAPayer,
      periodLabel,
      settings: settings ? {
        company_name: settings.company_name,
        company_address: settings.company_address,
        company_phone: settings.company_phone,
        company_phones: settings.company_phones,
        company_email: settings.company_email,
        company_nif: settings.company_nif,
        company_nis: settings.company_nis,
        company_rc: settings.company_rc,
        company_ai: settings.company_ai,
        company_capital: settings.company_capital,
        company_rib: settings.company_rib,
        company_bank_agency: settings.company_bank_agency,
        logo_data: settings.logo_data,
        qr_code_data: settings.qr_code_data,
        primary_color: settings.primary_color,
        body_pattern_data: settings.body_pattern_data,
      } : {}
    }) as React.ReactElement<DocumentProps>
  );
  return await instance.toBlob();
};

export const generatePayrollPDF = async (
  rows: PayrollPDFRow[],
  totalNetAPayer: number,
  periodLabel?: string,
  settings?: Settings
): Promise<string> => {
  try {
    const blob = await generatePayrollPDFBlob(rows, totalNetAPayer, periodLabel, settings);
    const pdfBase64 = await blobToBase64(blob);

    const fileName = `Paie-${periodLabel || new Date().toISOString().split('T')[0]}.pdf`;

    try {
      await invoke<string>('save_pdf', { pdfBase64, fileName });
    } catch (err) {
      console.warn("Tauri backend save_pdf unavailable, triggering browser fallback download:", err);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    return pdfBase64;
  } catch (error) {
    console.error("Failed to generate Payroll PDF:", error);
    throw error;
  }
};

// Only used if getVersion() can't run (e.g. previewing outside Tauri) — the
// real value always comes from the running app via getVersion() below.
export const FALLBACK_APP_VERSION = "1.0.0";

/**
 * Generates one employee's individual "Bulletin de Paie" (Algerian payslip
 * layout) for one month and saves it wherever the user picks via the native
 * save dialog. Returns the saved base64 content, or null if the user
 * cancelled the dialog (a clean abort, not an error).
 */
export const generateBulletinPaiePDF = async (
  run: BulletinPaieRun,
  employee: BulletinPaieEmployee,
  settings?: Settings
): Promise<string | null> => {
  try {
    const appVersion = await getVersion().catch(() => FALLBACK_APP_VERSION);
    const instance = pdf(
      React.createElement(BulletinPaiePDFDocument, {
        run,
        employee,
        appVersion,
        settings: settings ? {
          company_name: settings.company_name,
          company_rc: settings.company_rc,
          company_nif: settings.company_nif,
          logo_data: settings.logo_data,
          invoice_pdf_font: settings.invoice_pdf_font,
          company_cnas_adherent: settings.company_cnas_adherent,
          payroll_prime_panier_taux: settings.payroll_prime_panier_taux,
          payroll_prime_transport: settings.payroll_prime_transport,
        } : {}
      }) as React.ReactElement<DocumentProps>
    );
    const blob = await instance.toBlob();
    const pdfBase64 = await blobToBase64(blob);
    const fileName = `Bulletin-Paie-${employee.name.replace(/[^a-zA-Z0-9]+/g, '_')}-${run.month}.pdf`;

    let chosenPath: string | null;
    try {
      chosenPath = await saveDialog({
        title: "Enregistrer le bulletin de paie",
        defaultPath: fileName,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
    } catch (err) {
      // Dialog plugin itself unavailable (e.g. browser preview outside
      // Tauri) — not a user cancellation, fall back to a browser download.
      console.warn("Tauri save dialog unavailable, triggering browser fallback download:", err);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return pdfBase64;
    }

    if (!chosenPath) {
      // User cancelled the dialog — abort cleanly, no error, no toast.
      return null;
    }

    await invoke('save_pdf_to_path', { path: chosenPath, pdfBase64 });
    toast.success("Bulletin de paie enregistré", { description: chosenPath });
    return pdfBase64;
  } catch (error) {
    console.error("Failed to generate Bulletin de Paie PDF:", error);
    throw error;
  }
};

/**
 * Generates the "Rapport Mensuel d'Activité & Clôture" executive PDF (see
 * MonthlyReportPDF) for one calendar month and saves it wherever the user
 * picks via the native save dialog — same pattern as generateBulletinPaiePDF.
 * Returns the saved base64 content, or null if the user cancelled the dialog
 * (a clean abort, not an error).
 */
export const generateMonthlyReportPDF = async (
  report: MonthlyBusinessReport,
  settings?: Settings
): Promise<string | null> => {
  try {
    const instance = pdf(
      React.createElement(MonthlyReportPDF, {
        report,
        settings: settings ? {
          company_name: settings.company_name,
          company_address: settings.company_address,
          company_phone: settings.company_phone,
          company_phones: settings.company_phones,
          company_nif: settings.company_nif,
          company_nis: settings.company_nis,
          company_rc: settings.company_rc,
          company_ai: settings.company_ai,
          logo_data: settings.logo_data,
          primary_color: settings.primary_color,
          invoice_pdf_font: settings.invoice_pdf_font,
        } : {}
      }) as React.ReactElement<DocumentProps>
    );
    const blob = await instance.toBlob();
    const pdfBase64 = await blobToBase64(blob);
    const fileName = `Rapport-Mensuel-${report.month}.pdf`;

    let chosenPath: string | null;
    try {
      chosenPath = await saveDialog({
        title: "Enregistrer le rapport mensuel",
        defaultPath: fileName,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
    } catch (err) {
      console.warn("Tauri save dialog unavailable, triggering browser fallback download:", err);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return pdfBase64;
    }

    if (!chosenPath) {
      // User cancelled the dialog — abort cleanly, no error, no toast.
      return null;
    }

    await invoke('save_pdf_to_path', { path: chosenPath, pdfBase64 });
    toast.success("Rapport mensuel enregistré", { description: chosenPath });
    return pdfBase64;
  } catch (error) {
    console.error("Failed to generate Monthly Report PDF:", error);
    throw error;
  }
};

export const generateContractPDFBlob = async (data: ContractPDFProps): Promise<Blob> => {
  const instance = pdf(
    React.createElement(ContractPDFDocument, data) as React.ReactElement<DocumentProps>
  );
  return await instance.toBlob();
};

export const generateContractPDF = async (data: ContractPDFProps): Promise<string | null> => {
  try {
    const blob = await generateContractPDFBlob(data);
    const pdfBase64 = await blobToBase64(blob);
    const fileName = `Contrat-${data.contractRef}.pdf`;

    let chosenPath: string | null;
    try {
      chosenPath = await saveDialog({
        title: "Enregistrer le contrat",
        defaultPath: fileName,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
    } catch (err) {
      console.warn("Tauri save dialog unavailable, triggering browser fallback download:", err);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return pdfBase64;
    }

    if (!chosenPath) {
      // User cancelled the dialog — abort cleanly, no error, no toast.
      return null;
    }

    await invoke('save_pdf_to_path', { path: chosenPath, pdfBase64 });
    toast.success("Contrat enregistré", { description: chosenPath });
    return pdfBase64;
  } catch (error) {
    console.error("Failed to generate Contract PDF:", error);
    throw error;
  }
};

/**
 * Main PDF generation entrypoint.
 * Generates vector PDF, triggers Tauri save_pdf or browser download, and returns base64.
 *
 * onSaved (optional) fires once the file has actually been written — with
 * the absolute path when save_pdf succeeded (the normal Tauri case), or
 * null path + the blob when it didn't (web preview, or save_pdf
 * unavailable) — so a caller can wire up an "Ouvrir" toast action via
 * openSavedFile() without needing to re-generate the PDF itself. Only
 * fires when download=true, since download=false callers (print-preview
 * flows) never write a file in the first place.
 */
export const generateInvoicePDF = async (
  doc: AnyDocument,
  settings?: Settings,
  download = true,
  _options?: PDFOptions,
  // The device's raw LicenseState — see generateInvoicePDFBlob's own note.
  licenseState?: string,
  onSaved?: (info: { path: string | null; blob: Blob; fileName: string }) => void
): Promise<string> => {
  try {
    // Handle html2canvas fallback if elementId is provided
    if (_options?.elementId) {
      const element = document.getElementById(_options.elementId);
      if (element) {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: _options.landscape ? 'landscape' : 'portrait',
          unit: 'pt',
          format: _options.paper_size === 'A3' ? 'a3' : 'a4'
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        
        if (download) {
          pdf.save(`${doc.invoice_type || 'report'}-${new Date().toISOString().split('T')[0]}.pdf`);
        }
        
        // Return base64 without data URI prefix
        const dataUri = pdf.output('datauristring');
        return dataUri.split(',')[1];
      }
    }

    const blob = await generateInvoicePDFBlob(doc, settings, licenseState);
    const pdfBase64 = await blobToBase64(blob);

    const clientName = String(doc.clients?.name || doc.client_name || doc.supplier_name || 'Client');
    // Backup naming stays on the plain document number (no client name/
    // prefix) — db.pdfBackup.save already takes the client name as its own
    // argument and builds its own folder/file convention around it.
    const number = doc.invoice_number || doc.delivery_number || doc.order_number || (doc.invoice_type === 'cumulatives' ? new Date().toISOString().split('T')[0] : '000');

    // Non-blocking local backup — never awaited by the caller, never blocks
    // the PDF preview/download UI. Silently skipped if no backup folder is
    // configured in Paramètres.
    if (settings?.pdf_backup_directory && doc.invoice_type !== 'cumulatives') {
      blob.arrayBuffer()
        .then((buf) => db.pdfBackup.save(settings.pdf_backup_directory!, clientName, number, new Uint8Array(buf)))
        .catch((err) => {
          console.warn('PDF backup failed:', err);
          toast.error('Échec de la sauvegarde automatique du PDF', { duration: 3000 });
        });
    }

    if (download) {
      const fileName = resolveDocumentFileName(doc);

      try {
        const savedPath = await invoke<string>('save_pdf', { pdfBase64, fileName });
        onSaved?.({ path: savedPath, blob, fileName });
      } catch (err) {
        console.warn("Tauri backend save_pdf unavailable, triggering browser fallback download:", err);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        onSaved?.({ path: null, blob, fileName });
      }
    }

    return pdfBase64;
  } catch (error) {
    console.error("Failed to generate vector PDF:", error);
    throw error;
  }
};

export const generateOrderPDF = generateInvoicePDF;

interface DeliveryNoteLike {
  delivery_number: string;
  delivery_date: string;
  client_received_date?: string | null;
  reserves?: string | null;
  custom_title?: string | null;
  clients?: {
    id?: string;
    name: string;
    address?: string | null;
    city?: string | null;
    wilaya?: string | null;
    phone?: string | null;
    email?: string | null;
    nif?: string | null;
    nis?: string | null;
    rc?: string | null;
    contact_person?: string | null;
  };
  delivery_note_items?: {
    product_id?: string | null;
    product_code?: string | null;
    product_name?: string | null;
    product_description?: string | null;
    quantity: number;
    unit_price?: number | null;
    tva_rate?: number | null;
    products?: { code?: string; name?: string; description?: string | null; unit_price?: number; unit?: string | null };
  }[];
}

/**
 * Shapes a fetched delivery note (however each page's hook returns it) into
 * the shared engine's AnyDocument contract — the exact same
 * InvoicePDFDocument/Epure/Moderne templates and generateInvoicePDF/
 * generateInvoicePDFBlob that Facture and Bon de Commande already use, with
 * `invoice_type: 'delivery_note'` so resolveInvoiceData/getDocumentSectionFlags
 * hide pricing, TVA, timbre, montant-en-lettres and swap the signature text
 * exactly like the web canvas's own useEditableInvoiceLogic does. One place
 * for this mapping instead of duplicating it in every page that generates
 * the PDF, mirroring buildOrderForPDF in Orders.tsx.
 */
export function buildDeliveryDocumentForPDF(note: DeliveryNoteLike): AnyDocument {
  const items = (note.delivery_note_items || []).map((item) => ({
    product_code: item.product_code ?? item.products?.code,
    product_name: item.product_name ?? item.products?.name,
    product_description: item.product_description ?? item.products?.description,
    quantity: item.quantity,
    unit_price: item.unit_price ?? item.products?.unit_price ?? 0,
    tva_rate: item.tva_rate,
  }));
  const subtotal_ht = items.reduce((sum, i) => sum + i.quantity * (i.unit_price || 0), 0);
  const tva_amount = items.reduce((sum, i) => {
    const rate = i.tva_rate === undefined || i.tva_rate === null ? 19 : i.tva_rate;
    return sum + i.quantity * (i.unit_price || 0) * (rate / 100);
  }, 0);

  return {
    invoice_type: 'delivery_note',
    invoice_number: note.delivery_number,
    delivery_number: note.delivery_number,
    invoice_date: note.delivery_date,
    due_date: note.client_received_date || undefined,
    notes: note.reserves || undefined,
    custom_title: note.custom_title || "BON DE LIVRAISON",
    clients: note.clients ? { ...note.clients } : undefined,
    invoice_items: items,
    subtotal_ht,
    tva_amount,
    timbre: 0,
    total_ttc: subtotal_ht + tva_amount,
  };
}

/** The delivery note (Bon de Livraison) PDF — literally the same shared
 *  engine as every other document type (see buildDeliveryDocumentForPDF's
 *  own note above), not a bespoke template/save flow. */
export const generateDeliveryPDF = generateInvoicePDF;
