import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  RiArrowLeftLine as ArrowLeft,
  RiFileTextLine as FileText,
  RiDownloadLine as Download,
  RiLoader4Line as Loader2,
} from "@remixicon/react";
import { Palette } from "lucide-react";
import { Button, Tooltip, TooltipTrigger, TooltipContent } from "@sordi/ui";
import { cn } from "@/lib/utils";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { useCreateDeliveryNote } from "@/hooks/useDeliveryNotes";
import { toast } from "sonner";
import { EditableInvoicePreview } from "@/components/invoice/EditableInvoicePreview";
import { InvoiceCustomizeDrawer } from "@/components/invoice/InvoiceCustomizeDrawer";
import { generateDeliveryPDF, buildDeliveryDocumentForPDF, openSavedFile } from "@/lib/pdfGenerator";
import { useSettings } from "@/hooks/useSettings";
import { useLicenseStatus } from "@/hooks/useLicense";

interface DeliveryItem {
  product_id: string;
  product_code: string;
  product_name: string;
  product_description?: string;
  quantity: number;
  unit_price?: number;
  tva_rate?: number;
  products?: any;
}

/**
 * Same unified A4 editor as Facture/Devis/Proforma/Avoir/Bon de Commande —
 * literally the same EditableInvoicePreview/EditableInvoiceStructure/
 * Epure/Moderne components (documentType="delivery_note"), not the old
 * parallel DeliveryEditable* tree. See NewOrder.tsx's own doc comment for
 * the same adapter rationale (draftDelivery keeps the real
 * CreateDeliveryNoteData shape; sharedInvoice/handleSharedChange below is
 * the two-way view the shared component reads/writes).
 *
 * PDF export goes through the exact same shared engine as every other
 * document type (generateDeliveryPDF is a plain alias of generateInvoicePDF,
 * same as generateOrderPDF) — buildDeliveryDocumentForPDF maps the native
 * delivery-note shape into the AnyDocument contract those shared
 * InvoicePDFDocument/Epure/Moderne templates read.
 */
export default function NewDeliveryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const invoiceData = location.state?.invoiceData;
  const { data: clients } = useClients();
  const { data: products } = useProducts();
  const createDelivery = useCreateDeliveryNote();
  const { data: settings } = useSettings();
  const { data: licenseStatus } = useLicenseStatus();
  const [customizeDrawerOpen, setCustomizeDrawerOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [draftDelivery, setDraftDelivery] = useState({
    client_id: invoiceData?.client_id || "",
    delivery_date: new Date().toISOString().split("T")[0],
    order_id: "",
    reserves: "",
    delivery_number: "",
    deliverer_name: "",
    supplier_delivered_date: "",
    client_received_date: "",
    client_signature: "",
    custom_title: "BON DE LIVRAISON",
    items: (invoiceData?.items || []) as DeliveryItem[],
  });

  const sharedInvoice = {
    invoice_number: draftDelivery.delivery_number,
    invoice_date: draftDelivery.delivery_date,
    due_date: draftDelivery.client_received_date,
    notes: draftDelivery.reserves,
    custom_title: draftDelivery.custom_title,
    clients: draftDelivery.client_id ? clients?.find((c) => c.id === draftDelivery.client_id) : undefined,
    invoice_items: draftDelivery.items,
  };

  const handleSharedChange = (updated: any) => {
    setDraftDelivery(prev => ({
      ...prev,
      delivery_number: updated.invoice_number ?? prev.delivery_number,
      delivery_date: updated.invoice_date ?? prev.delivery_date,
      client_received_date: updated.due_date ?? prev.client_received_date,
      reserves: updated.notes ?? prev.reserves,
      custom_title: updated.custom_title ?? prev.custom_title,
      client_id: updated.clients?.id ?? prev.client_id,
      items: updated.invoice_items ?? prev.items,
    }));
  };

  const handleSubmit = () => {
    const validItems = draftDelivery.items.filter(item => item.quantity > 0);

    if (!draftDelivery.client_id || validItems.length === 0) {
      if (!draftDelivery.client_id) toast.error("Veuillez sélectionner un client");
      else toast.error("Veuillez saisir au moins une quantité");
      return;
    }

    if (validItems.some(item => (item.unit_price ?? 0) < 0)) {
      toast.error("Le prix unitaire ne peut pas être négatif");
      return;
    }

    createDelivery.mutate({
      client_id: draftDelivery.client_id,
      delivery_date: draftDelivery.delivery_date,
      order_id: draftDelivery.order_id || undefined,
      reserves: draftDelivery.reserves || undefined,
      delivery_number: draftDelivery.delivery_number || undefined,
      deliverer_name: draftDelivery.deliverer_name || undefined,
      supplier_delivered_date: draftDelivery.supplier_delivered_date || undefined,
      client_received_date: draftDelivery.client_received_date || undefined,
      client_signature: draftDelivery.client_signature || undefined,
      items: validItems.map(item => ({
        product_id: item.product_id || undefined,
        product_name: item.product_id ? undefined : item.product_name || undefined,
        product_code: item.product_id ? undefined : item.product_code || undefined,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tva_rate: item.tva_rate,
      })),
    }, {
      onSuccess: async (createdNote) => {
        toast.success("Bon de livraison créé avec succès");
        try {
          const client = clients?.find(c => c.id === createdNote.client_id);
          const docForPDF = buildDeliveryDocumentForPDF({
            ...createdNote,
            clients: client ? {
              name: client.name,
              address: client.address,
              city: client.city,
              wilaya: client.wilaya,
              phone: client.phone,
              email: client.email,
              nif: client.nif,
              rc: client.rc,
              contact_person: client.contact_person,
            } : undefined,
            delivery_note_items: validItems.map(item => ({
              product_id: item.product_id,
              product_code: item.product_code,
              product_name: item.product_name,
              product_description: item.product_description || item.products?.description || undefined,
              unit_price: item.unit_price,
              tva_rate: item.tva_rate,
              quantity: item.quantity,
            })),
          });
          await generateDeliveryPDF(docForPDF, settings, true, undefined, licenseStatus?.license_state);
        } catch (error) {
          console.error("PDF generation error", error);
          toast.error("Erreur lors de la génération du PDF");
        }

        navigate("/deliveries");
      },
    });
  };

  const handleDownloadPDF = async () => {
    const validItems = draftDelivery.items.filter(item => item.quantity > 0);
    if (validItems.length === 0) {
      toast.error("Ajoutez au moins un produit avant de télécharger le PDF");
      return;
    }
    const toastId = "download-delivery-pdf";
    try {
      setIsDownloading(true);
      toast.loading("Génération du PDF...", { id: toastId });
      const client = clients?.find(c => c.id === draftDelivery.client_id);
      const docForPDF = buildDeliveryDocumentForPDF({
        ...draftDelivery,
        clients: client ? {
          name: client.name,
          address: client.address,
          city: client.city,
          wilaya: client.wilaya,
          phone: client.phone,
          email: client.email,
          nif: client.nif,
          rc: client.rc,
          contact_person: client.contact_person,
        } : undefined,
        delivery_note_items: validItems.map(item => ({
          product_id: item.product_id,
          product_code: item.product_code,
          product_name: item.product_name,
          product_description: item.product_description || item.products?.description || undefined,
          unit_price: item.unit_price,
          tva_rate: item.tva_rate,
          quantity: item.quantity,
        })),
      });
      await generateDeliveryPDF(
        docForPDF,
        settings,
        true,
        undefined,
        licenseStatus?.license_state,
        ({ path, blob }) => {
          toast.success("Bon de livraison PDF généré", {
            id: toastId,
            description: "Le fichier a été enregistré avec succès.",
            action: { label: "Ouvrir", onClick: () => openSavedFile(path, blob) },
            duration: 5000,
          });
        }
      );
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Erreur lors de la génération du PDF", { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col min-h-0 w-full max-w-full overflow-x-hidden">
      <header className="sticky top-0 h-10 w-full max-w-full border-b border-border/80 bg-background/95 backdrop-blur-sm px-4 flex items-center justify-between gap-4 shrink-0 z-30 overflow-hidden select-none">
        <div className="flex items-center gap-2.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => navigate("/deliveries")}
                className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Retour</TooltipContent>
          </Tooltip>
          <div className="h-4 w-px bg-border shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold font-mono text-foreground shrink-0 whitespace-nowrap">
            Nouveau bon de livraison
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5 h-[30px] px-2.5 text-xs rounded-md font-medium",
              customizeDrawerOpen && "bg-primary/10 text-primary border-primary/30"
            )}
            onClick={() => setCustomizeDrawerOpen((prev) => !prev)}
          >
            <Palette className="w-3.5 h-3.5" />
            Personnaliser
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-[30px] px-2.5 text-xs rounded-md font-medium"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
          >
            {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline">{isDownloading ? "Téléchargement..." : "Télécharger PDF"}</span>
            <span className="lg:hidden">{isDownloading ? "..." : "PDF"}</span>
          </Button>
        </div>
      </header>

      <div
        className={cn(
          "fixed bottom-6 z-30 pointer-events-auto flex items-center gap-4 p-2 pl-5 bg-card/95 backdrop-blur-md border border-border/80 shadow-xl shadow-zinc-900/10 rounded-2xl transition-[right] duration-300 ease-out",
          customizeDrawerOpen ? "right-[calc(18rem+2rem)]" : "right-8"
        )}
      >
        <Button
          type="button"
          size="default"
          className="h-10 px-5 font-medium rounded-xl gap-2"
          onClick={handleSubmit}
          disabled={createDelivery.isPending}
        >
          {createDelivery.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {createDelivery.isPending ? "Création..." : "Créer le bon de livraison"}
        </Button>
      </div>

      <div className="flex flex-1 w-full overflow-hidden relative min-h-0">
        <div className="flex-1 min-h-0 min-w-0 bg-zinc-100/60 dark:bg-zinc-950">
          <EditableInvoicePreview
            invoice={sharedInvoice}
            onInvoiceChange={handleSharedChange}
            clients={clients}
            products={products}
            documentType="delivery_note"
          />
        </div>

        <InvoiceCustomizeDrawer open={customizeDrawerOpen} onOpenChange={setCustomizeDrawerOpen} />
      </div>
    </main>
  );
}
