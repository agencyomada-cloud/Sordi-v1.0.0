import { generateInvoicePDFBlob, blobToBase64, PDFInvoice, AnyDocument } from "../lib/pdfGenerator";
import { Settings } from "../hooks/useSettings";

export interface PDFWorkerMessageData {
  invoice: PDFInvoice;
  settings?: Settings;
}

self.onmessage = async (e: MessageEvent<PDFWorkerMessageData>) => {
  try {
    const { invoice, settings } = e.data;
    const blob = await generateInvoicePDFBlob(invoice as AnyDocument, settings);
    const pdfBase64 = await blobToBase64(blob);
    self.postMessage({ success: true, pdfBase64, blob });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    self.postMessage({ success: false, error: errorMessage });
  }
};
