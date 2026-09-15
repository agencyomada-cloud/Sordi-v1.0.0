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
import { Button, StatusBadge, type StatusBadgeTone } from "@sordi/ui";
import { useOrder, useOrderItems } from "@/hooks/useOrders";
import { useSetPageHeader } from "@/hooks/usePageHeader";
import { generateOrderPDF, generateInvoicePDFBlob, blobToBase64, openSavedFile } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { useSettings } from "@/hooks/useSettings";
import { useLicenseStatus } from "@/hooks/useLicense";
import { EditableInvoicePreview } from "@/components/invoice/EditableInvoicePreview";
import { SendDocumentEmailModal } from "@/components/email/SendDocumentEmailModal";
import type { DraftOrderInput } from "@/lib/emailDrafter";

const statusTones: Record<string, StatusBadgeTone> = {
  draft: "neutral",
  confirmed: "success",
  delivered: "neutral",
  cancelled: "error",
};

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  confirmed: "Confirmée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading, error } = useOrder(id);
  const { data: orderItems } = useOrderItems(id);
  const { data: settings } = useSettings();
  const { data: licenseStatus } = useLicenseStatus();
  const [isGenerating, setIsGenerating] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  useSetPageHeader("Commandes", [
    { label: "Commandes", path: "/orders" },
    { label: order?.order_number || "…" },
  ]);

  const buildOrderData = () => {
    if (!order) return null;
    return {
      ...order,
      order_items: orderItems || [],
    };
  };

  const handleDownloadPDF = async () => {
    const orderData = buildOrderData();
    if (!orderData) return;

    try {
      setIsGenerating(true);
      await generateOrderPDF(orderData, settings, true, undefined, licenseStatus?.license_state, ({ path, blob, fileName }) => {
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
    const orderData = buildOrderData();
    if (!orderData) return;
    setIsGenerating(true);
    try {
      const pdfBase64 = await generateOrderPDF(orderData, settings, false, undefined, licenseStatus?.license_state);
      const { invoke } = await import("@tauri-apps/api/core");
      const fileName = `Impression-${orderData.order_number || "bon_commande"}.pdf`;
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

  if (!order && !isLoading) {
    return (
      <main className="flex-1 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-muted-foreground mb-4">Bon de commande non trouvé</div>
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
          <Button onClick={() => navigate("/orders")}>
            Retour aux commandes
          </Button>
        </div>
      </main>
    );
  }

  if (!order) return null;

  return (
        <main className="flex-1 p-8 pt-4">
          {/* Header */}
          <div className="flex flex-col items-start xl:flex-row xl:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/orders")}
                className="rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-foreground tracking-tight">
                    Bon de commande {order.order_number}
                  </h1>
                  <StatusBadge tone={statusTones[order.status || "draft"] ?? "neutral"}>
                    {statusLabels[order.status || "draft"]}
                  </StatusBadge>
                </div>
                <p className="text-muted-foreground mt-1">
                  {order.clients?.name || order.supplier_name || "N/A"} • {formatDate(order.order_date)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => navigate(`/orders/${id}/edit`)}>
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

          {/* Order Preview Section */}
          <div className="bg-card rounded-3xl border border-border/30 shadow-card overflow-hidden p-8">
            <div className="flex justify-center bg-muted rounded-lg p-6 overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              <div className="shadow-xl">
                <EditableInvoicePreview
                  invoice={{
                    ...order,
                    invoice_items: orderItems || [],
                  }}
                  onInvoiceChange={() => { }}
                />
              </div>
            </div>
          </div>

          <SendDocumentEmailModal
            open={emailModalOpen}
            onOpenChange={setEmailModalOpen}
            recipientEmail={order.clients?.email || order.supplier_email}
            fileName={`BonCommande-${order.order_number || "000"}.pdf`}
            draftInput={{
              docType: "order",
              documentNumber: order.order_number,
              clientName: order.clients?.name || order.supplier_name || "",
              documentDate: order.order_date,
              deliveryDate: order.delivery_date,
              totalTTC: order.total_ttc,
              senderCompany: settings?.company_name || "Sordi",
              items: (orderItems || []).map((item: any) => ({
                name: item.product_name || "Article",
                quantity: item.quantity,
                unitPrice: item.unit_price,
              })),
            } satisfies DraftOrderInput}
            getPdfBase64={async () => {
              const orderData = buildOrderData();
              if (!orderData) throw new Error("Commande introuvable");
              const blob = await generateInvoicePDFBlob(orderData, settings, licenseStatus?.license_state);
              return blobToBase64(blob);
            }}
          />
        </main>
  );
}

