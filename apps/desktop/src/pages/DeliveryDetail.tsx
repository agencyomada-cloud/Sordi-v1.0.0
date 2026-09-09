import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PDFViewer } from "@react-pdf/renderer";
import { getVersion } from "@tauri-apps/api/app";
import {
  RiArrowLeftLine as ArrowLeft,
  RiDownloadLine as Download,
  RiPrinterLine as Printer,
  RiEditLine as Edit,
  RiLoader4Line as Loader2,
  RiMailSendLine as MailSend,
} from "@remixicon/react";
import { Button } from "@sordi/ui";
import { useDeliveryNote } from "@/hooks/useDeliveryNotes";
import { useSetPageHeader } from "@/hooks/usePageHeader";
import {
  generateDeliveryNotePDF,
  generateDeliveryNotePDFBlob,
  buildDeliveryNotePDFData,
  toDeliveryNotePDFSettings,
  blobToBase64,
  FALLBACK_APP_VERSION,
  type DeliveryNotePDFData,
} from "@/lib/pdfGenerator";
import { DeliveryNotePDFDocument } from "@/components/pdf/DeliveryNotePDFDocument";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";
import { SendDocumentEmailModal } from "@/components/email/SendDocumentEmailModal";
import type { DraftDeliveryInput } from "@/lib/emailDrafter";

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: deliveryNote, isLoading, error } = useDeliveryNote(id);
  const { data: settings } = useSettings();
  const [isGenerating, setIsGenerating] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  // Drives the live preview below — same shape the PDF generator consumes,
  // so the preview (rendered via react-pdf's PDFViewer, the exact same
  // DeliveryNotePDFDocument) can never drift from the exported file again.
  const [pdfData, setPdfData] = useState<DeliveryNotePDFData | null>(null);
  const [appVersion, setAppVersion] = useState<string>(FALLBACK_APP_VERSION);

  useSetPageHeader("Livraisons", [
    { label: "Livraisons", path: "/deliveries" },
    { label: deliveryNote?.delivery_number || "…" },
  ]);

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  useEffect(() => {
    setPdfData(deliveryNote ? buildDeliveryNotePDFData(deliveryNote) : null);
  }, [deliveryNote]);

  const buildPdfData = async () => {
    if (!deliveryNote) return null;
    return buildDeliveryNotePDFData(deliveryNote);
  };

  const handleDownloadPDF = async () => {
    const pdfData = await buildPdfData();
    if (!pdfData) return;

    try {
      setIsGenerating(true);
      // generateDeliveryNotePDF shows its own success toast with the saved
      // path once the native save dialog resolves; null means cancelled.
      await generateDeliveryNotePDF(pdfData, settings);
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = async () => {
    const pdfData = await buildPdfData();
    if (!pdfData) return;
    setIsGenerating(true);
    try {
      const blob = await generateDeliveryNotePDFBlob(pdfData, settings);
      const pdfBase64 = await blobToBase64(blob);
      const { invoke } = await import("@tauri-apps/api/core");
      const fileName = `Impression-${pdfData.delivery_number || "bon_livraison"}.pdf`;
      await invoke("open_pdf", { pdfBase64, fileName });
      toast.success("PDF ouvert pour impression");
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Erreur lors de l'impression");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "0,00 DA";
    return new Intl.NumberFormat("fr-DZ", {
      style: "decimal",
      minimumFractionDigits: 2,
    }).format(amount) + " DA";
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <main className="flex-1 p-8 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </main>
    );
  }

  if (!deliveryNote && !isLoading) {
    return (
      <main className="flex-1 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-muted-foreground mb-4">Bon de livraison non trouvé</div>
          {id && (
            <div className="text-sm text-muted-foreground mb-4">
              ID: {id}
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive mb-4">
              Erreur: {error instanceof Error ? error.message : String(error)}
            </div>
          )}
          <Button onClick={() => navigate("/deliveries")}>
            Retour aux livraisons
          </Button>
        </div>
      </main>
    );
  }

  if (!deliveryNote) return null;

  return (
        <main className="flex-1 p-8 pt-4">
          {/* Header */}
          <div className="flex flex-col items-start xl:flex-row xl:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/deliveries")}
                className="rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-foreground tracking-tight">
                    Bon de livraison {deliveryNote.delivery_number}
                  </h1>
                </div>
                <p className="text-muted-foreground mt-1">
                  {deliveryNote.clients?.name} • {formatDate(deliveryNote.delivery_date)}
                </p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-3">
              <Button variant="outline" onClick={() => navigate(`/deliveries/${id}/edit`)}>
                <Edit className="w-4 h-4 mr-2" />
                Modifier
              </Button>
              <Button variant="outline" onClick={handlePrint} disabled={isGenerating}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimer
              </Button>
              <Button onClick={handleDownloadPDF} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {isGenerating ? "Téléchargement..." : "Télécharger PDF"}
              </Button>
              <Button variant="outline" onClick={() => setEmailModalOpen(true)}>
                <MailSend className="w-4 h-4 mr-2" />
                Envoyer par Email
              </Button>
            </div>
          </div>

          {/* Delivery Preview Section — the exact PDF template, rendered live
              via react-pdf's PDFViewer, so this is a 1:1 replica of the
              exported file by construction, not a second hand-maintained
              implementation that can drift out of sync. */}
          <div className="bg-card rounded-3xl border border-border/30 shadow-card overflow-hidden p-8">
            {pdfData ? (
              <PDFViewer
                showToolbar={false}
                style={{ width: "100%", height: "calc(100vh - 300px)", border: "none", borderRadius: 12 }}
              >
                <DeliveryNotePDFDocument
                  data={pdfData}
                  appVersion={appVersion}
                  settings={toDeliveryNotePDFSettings(settings)}
                />
              </PDFViewer>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                Chargement de l'aperçu...
              </div>
            )}
          </div>

          {pdfData && (
            <SendDocumentEmailModal
              open={emailModalOpen}
              onOpenChange={setEmailModalOpen}
              recipientEmail={pdfData.client.email}
              fileName={`BonLivraison-${pdfData.delivery_number || "000"}.pdf`}
              draftInput={{
                docType: "delivery",
                documentNumber: pdfData.delivery_number,
                clientName: pdfData.client.name,
                documentDate: pdfData.delivery_date,
                senderCompany: settings?.company_name || "Sordi",
                items: pdfData.items.map((item) => ({
                  name: item.product_name || "Article",
                  quantity: item.quantity,
                  unitPrice: item.unit_price,
                })),
              } satisfies DraftDeliveryInput}
              getPdfBase64={async () => {
                const blob = await generateDeliveryNotePDFBlob(pdfData, settings);
                return blobToBase64(blob);
              }}
            />
          )}
        </main>
  );
}

