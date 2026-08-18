import React from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { pdf } from '@react-pdf/renderer';
import { invoke } from '@tauri-apps/api/core';
import { Settings } from "@/hooks/useSettings";
import { InvoicePDFDocument, PDFInvoice, PDFSettings, PDFInvoiceItem } from "@/components/pdf/InvoicePDFDocument";
import { CumulativesPDFDocument, ClientCumulativeRecord } from "@/components/pdf/CumulativesPDFDocument";

export type { PDFInvoiceItem, PDFInvoice, PDFSettings };

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
 * Generates a vector PDF Blob directly using @react-pdf/renderer
 */
export const generateInvoicePDFBlob = async (
  doc: AnyDocument,
  settings?: Settings
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
    };

    const pdfSettings: PDFSettings = settings ? {
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
      company_rib: settings.company_rib,
      logo_data: settings.logo_data,
      footer_logo_data: settings.footer_logo_data,
      qr_code_data: settings.qr_code_data,
      body_pattern_data: settings.body_pattern_data,
      stamp_data: settings.stamp_data,
      primary_color: settings.primary_color,
      logo_bg_color: settings.logo_bg_color,
      logo_text_color: settings.logo_text_color,
    } : {};

    const instance = pdf(React.createElement(InvoicePDFDocument, { invoice: formattedInvoice, settings: pdfSettings }));
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
    })
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
 * Main PDF generation entrypoint.
 * Generates vector PDF, triggers Tauri save_pdf or browser download, and returns base64.
 */
export const generateInvoicePDF = async (
  doc: AnyDocument,
  settings?: Settings,
  download = true,
  _options?: PDFOptions
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

    const blob = await generateInvoicePDFBlob(doc, settings);
    const pdfBase64 = await blobToBase64(blob);

    if (download) {
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

      const fileName = `${prefix}-${number}.pdf`;

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
    }

    return pdfBase64;
  } catch (error) {
    console.error("Failed to generate vector PDF:", error);
    throw error;
  }
};

export const generateDeliveryNotePDF = generateInvoicePDF;
export const generateOrderPDF = generateInvoicePDF;
