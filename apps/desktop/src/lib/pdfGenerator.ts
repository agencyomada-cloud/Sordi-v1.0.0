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
import { PDFInvoice, PDFSettings, PDFInvoiceItem, InvoicePdfTheme } from "@/components/pdf/invoicePdfShared";
import { CumulativesPDFDocument, ClientCumulativeRecord } from "@/components/pdf/CumulativesPDFDocument";
import { PayrollPDFDocument, PayrollPDFRow } from "@/components/pdf/PayrollPDFDocument";
import { BulletinPaiePDFDocument, BulletinPaieRun, BulletinPaieEmployee } from "@/components/pdf/BulletinPaiePDFDocument";
import { DeliveryNotePDFDocument, DeliveryNotePDFData } from "@/components/pdf/DeliveryNotePDFDocument";
import { MonthlyReportPDF } from "@/components/pdf/MonthlyReportPDF";
import { ContractPDFDocument, type ContractPDFProps } from "@/components/pdf/ContractPDFDocument";
import { db, MonthlyBusinessReport } from "@/lib/database";
import { toast } from "sonner";

export type { DeliveryNotePDFData, DeliveryNotePDFItem, DeliveryNotePDFClient } from "@/components/pdf/DeliveryNotePDFDocument";

export type { PDFInvoiceItem, PDFInvoice, PDFSettings };

/** The three selectable invoice PDF themes, chosen in Settings. */
const INVOICE_PDF_TEMPLATES: Record<InvoicePdfTheme, typeof InvoicePDFDocument> = {
  structure: InvoicePDFDocument,
  epure: InvoiceTemplateEpure,
  moderne: InvoiceTemplateModerne,
};

export type AnyDocument = Partial<PDFInvoice> & Record<string, unknown>;

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
  licenseActive?: boolean
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

    const effectiveStampSize = formattedInvoice.stamp_size || 180;

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
      footer_logo_data: settings.footer_logo_data,
      body_pattern_data: settings.body_pattern_data,
      stamp_data: settings.stamp_data,
      stamp_size: effectiveStampSize,
      signature_data: settings.signature_data,
      signature_size: settings.signature_size ? Number(settings.signature_size) : undefined,
      primary_color: settings.primary_color,
      license_active: licenseActive,
    } : { license_active: licenseActive, stamp_size: effectiveStampSize, legal_name: "EURL OMADA AGENCY" };

    const theme = (settings?.invoice_pdf_theme as InvoicePdfTheme) || 'structure';
    const Template = INVOICE_PDF_TEMPLATES[theme] || InvoicePDFDocument;

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
        footer_logo_data: settings.footer_logo_data,
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
        footer_logo_data: settings.footer_logo_data,
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
export const FALLBACK_APP_VERSION = "1.0.4";

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
  licenseActive?: boolean,
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

    const blob = await generateInvoicePDFBlob(doc, settings, licenseActive);
    const pdfBase64 = await blobToBase64(blob);

    let prefix = 'Document';
    let number = '000';

    if (doc.invoice_type === 'proforma') {
      prefix = 'Proforma';
      number = doc.invoice_number || '000';
    } else if (doc.invoice_type === 'credit_note') {
      prefix = 'Avoir';
      number = doc.invoice_number || '000';
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
    }

    // Non-blocking local backup — never awaited by the caller, never blocks
    // the PDF preview/download UI. Silently skipped if no backup folder is
    // configured in Paramètres.
    if (settings?.pdf_backup_directory && doc.invoice_type !== 'cumulatives') {
      const clientName = String(doc.clients?.name || doc.client_name || doc.supplier_name || 'Client');
      blob.arrayBuffer()
        .then((buf) => db.pdfBackup.save(settings.pdf_backup_directory!, clientName, number, new Uint8Array(buf)))
        .catch((err) => {
          console.warn('PDF backup failed:', err);
          toast.error('Échec de la sauvegarde automatique du PDF', { duration: 3000 });
        });
    }

    if (download) {
      const fileName = `${prefix}-${number}.pdf`;

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
  truck_plate?: string | null;
  driver_name?: string | null;
  deliverer_name?: string | null;
  transporter_name?: string | null;
  delivery_location?: string | null;
  reserves?: string | null;
  supplier_delivered_date?: string | null;
  client_received_date?: string | null;
  /** "Nom du réceptionnaire" — stored in the client_signature column. */
  client_signature?: string | null;
  clients?: {
    name: string;
    address?: string | null;
    city?: string | null;
    wilaya?: string | null;
    phone?: string | null;
    email?: string | null;
    nif?: string | null;
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

/** Shapes a fetched delivery note (however each page's hook returns it)
 *  into the PDF template's data contract — one place for this instead of
 *  duplicating the mapping in every page that generates the PDF. */
export function buildDeliveryNotePDFData(note: DeliveryNoteLike): DeliveryNotePDFData {
  return {
    delivery_number: note.delivery_number,
    delivery_date: note.delivery_date,
    truck_plate: note.truck_plate,
    driver_name: note.driver_name,
    deliverer_name: note.deliverer_name,
    transporter_name: note.transporter_name,
    delivery_location: note.delivery_location,
    reserves: note.reserves,
    supplier_delivered_date: note.supplier_delivered_date,
    client_received_date: note.client_received_date,
    receiver_name: note.client_signature,
    client: {
      name: note.clients?.name || "Client",
      address: note.clients?.address,
      city: note.clients?.city,
      wilaya: note.clients?.wilaya,
      phone: note.clients?.phone,
      email: note.clients?.email,
      nif: note.clients?.nif,
      rc: note.clients?.rc,
      contact_person: note.clients?.contact_person,
    },
    items: (note.delivery_note_items || []).map((item) => ({
      product_code: item.product_code ?? item.products?.code,
      product_name: item.product_name ?? item.products?.name,
      product_description: item.product_description ?? item.products?.description,
      quantity: item.quantity,
      unit_price: item.unit_price ?? item.products?.unit_price,
      tva_rate: item.tva_rate,
    })),
  };
}

/** Shared by generateDeliveryNotePDFBlob and the live in-app preview (which
 *  renders this exact same DeliveryNotePDFDocument via react-pdf's
 *  PDFViewer) — one mapping, so the two can never drift apart again. */
export function toDeliveryNotePDFSettings(settings?: Settings): PDFSettings {
  if (!settings) return {};
  return {
    company_name: settings.company_name,
    company_address: settings.company_address,
    company_phone: settings.company_phone,
    company_phones: settings.company_phones,
    company_email: settings.company_email,
    company_nif: settings.company_nif,
    company_nis: settings.company_nis,
    company_rc: settings.company_rc,
    company_ai: settings.company_ai,
    logo_data: settings.logo_data,
    primary_color: settings.primary_color,
    invoice_pdf_font: settings.invoice_pdf_font,
    stamp_data: settings.stamp_data,
    stamp_size: settings.stamp_size ? Number(settings.stamp_size) : undefined,
    signature_data: settings.signature_data,
    signature_size: settings.signature_size ? Number(settings.signature_size) : undefined,
  };
}

/**
 * Renders the delivery note (Bon de Livraison) PDF to a Blob only — no
 * save/download side effect. Used both by generateDeliveryNotePDF below and
 * directly by "Imprimer" flows that open the PDF for printing instead of
 * saving it to disk.
 */
export const generateDeliveryNotePDFBlob = async (
  data: DeliveryNotePDFData,
  settings?: Settings
): Promise<Blob> => {
  const appVersion = await getVersion().catch(() => FALLBACK_APP_VERSION);
  const instance = pdf(
    React.createElement(DeliveryNotePDFDocument, {
      data,
      appVersion,
      settings: toDeliveryNotePDFSettings(settings),
    }) as React.ReactElement<DocumentProps>
  );
  return await instance.toBlob();
};

/**
 * Generates the Bon de Livraison PDF and saves it wherever the user picks
 * via the native save dialog (same pattern as generateBulletinPaiePDF).
 * Returns the saved base64 content, or null if the user cancelled — a
 * clean abort, not an error.
 */
export const generateDeliveryNotePDF = async (
  data: DeliveryNotePDFData,
  settings?: Settings
): Promise<string | null> => {
  try {
    const blob = await generateDeliveryNotePDFBlob(data, settings);
    const pdfBase64 = await blobToBase64(blob);
    const fileName = `BL-${data.client.name.replace(/[^a-zA-Z0-9]+/g, '_')}-${data.delivery_number}.pdf`;

    let chosenPath: string | null;
    try {
      chosenPath = await saveDialog({
        title: "Enregistrer le bon de livraison",
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
      return null;
    }

    await invoke('save_pdf_to_path', { path: chosenPath, pdfBase64 });
    toast.success("Bon de livraison enregistré", {
      description: `Enregistré sous : ${chosenPath}`,
      action: { label: "Ouvrir", onClick: () => openSavedFile(chosenPath, blob) },
      duration: 6000,
    });
    return pdfBase64;
  } catch (error) {
    console.error("Failed to generate Delivery Note PDF:", error);
    throw error;
  }
};
