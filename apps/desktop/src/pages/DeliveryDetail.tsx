import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { generateDeliveryPDF, generateInvoicePDFBlob, buildDeliveryDocumentForPDF, blobToBase64, openSavedFile } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { useSettings } from "@/hooks/useSettings";
import { useLicenseStatus } from "@/hooks/useLicense";
import { EditableInvoicePreview } from "@/components/invoice/EditableInvoicePreview";
import { SendDocumentEmailModal } from "@/components/email/SendDocumentEmailModal";
import type { DraftDeliveryInput } from "@/lib/emailDrafter";

/** Same shared engine as OrderDetail.tsx — the live preview below is the
 *  exact same EditableInvoicePreview canvas every document type uses (not a
 *  react-pdf PDFViewer rendering a delivery-specific template), and export
 *  goes through generateDeliveryPDF, a plain alias of generateInvoicePDF. */
export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: deliveryNote, isLoading, error } = useDeliveryNote(id);
  const { data: settings } = useSettings();
  const { data: licenseStatus } = useLicenseStatus();
  const [isGenerating, setIsGenerating] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  useSetPageHeader("Livraisons", [
    { label: "Livraisons", path: "/deliveries" },
    { label: deliveryNote?.delivery_number || "…" },
  ]);

  const buildDocForPDF = () => {
    if (!deliveryNote) return null;
    return buildDeliveryDocumentForPDF(deliveryNote);
  };

  const handleDownloadPDF = async () => {
    const docForPDF = buildDocForPDF();
    if (!docForPDF) return;

    try {
      setIsGenerating(true);
      await generateDeliveryPDF(docForPDF, settings, true, undefined, licenseStatus?.license_state, ({ path, blob, fileName }) => {
        toast.success("PDF téléchargé avec succès", {
          description: `Enregistré sous : ${path || fileName}`,
          action: { label: "Ouvrir", onClick: () => openSavedFile(path, blob) },
          duration: 6000,
        });
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = async () => {
    const docForPDF = buildDocForPDF();
    if (!docForPDF) return;
    setIsGenerating(true);
    try {
      const pdfBase64 = await generateDeliveryPDF(docForPDF, settings, false, undefined, licenseStatus?.license_state);
      const { invoke } = await import("@tauri-apps/api/core");
      const fileName = `Impression-${docForPDF.delivery_number || "bon_livraison"}.pdf`;
      await invoke("open_pdf", { pdfBase64, fileName });
      toast.success("PDF ouvert pour impression");
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Erreur lors de l'impression");
    } finally {
      setIsGenerating(false);
    }
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

          {/* Delivery Preview Section — the exact same shared A4 canvas every
              document type uses (EditableInvoicePreview), read-only here via
              a no-op onInvoiceChange, same as OrderDetail.tsx's own preview. */}
          <div className="bg-card rounded-3xl border border-border/30 shadow-card overflow-hidden p-8">
            <div className="flex justify-center bg-muted rounded-lg p-6 overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              <div className="shadow-xl">
                <EditableInvoicePreview
                  invoice={{
                    ...deliveryNote,
                    invoice_items: deliveryNote.delivery_note_items || [],
                  }}
                  onInvoiceChange={() => { }}
                  documentType="delivery_note"
                />
              </div>
            </div>
          </div>

          <SendDocumentEmailModal
            open={emailModalOpen}
            onOpenChange={setEmailModalOpen}
            recipientEmail={(deliveryNote.clients as any)?.email}
            fileName={`BonLivraison-${deliveryNote.delivery_number || "000"}.pdf`}
            draftInput={{
              docType: "delivery",
              documentNumber: deliveryNote.delivery_number,
              clientName: deliveryNote.clients?.name || "",
              documentDate: deliveryNote.delivery_date,
              senderCompany: settings?.company_name || "Sordi",
              items: (deliveryNote.delivery_note_items || []).map((item: any) => ({
                name: item.product_name || item.products?.name || "Article",
                quantity: item.quantity,
                unitPrice: item.unit_price ?? item.products?.unit_price,
              })),
            } satisfies DraftDeliveryInput}
            getPdfBase64={async () => {
              const docForPDF = buildDocForPDF();
              if (!docForPDF) throw new Error("Bon de livraison introuvable");
              const blob = await generateInvoicePDFBlob(docForPDF, settings, licenseStatus?.license_state);
              return blobToBase64(blob);
            }}
          />
        </main>
  );
}
