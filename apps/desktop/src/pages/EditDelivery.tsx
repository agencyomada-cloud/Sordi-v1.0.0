import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { useDeliveryNote, useUpdateDeliveryNote } from "@/hooks/useDeliveryNotes";
import { toast } from "sonner";
import { EditableInvoicePreview } from "@/components/invoice/EditableInvoicePreview";
import { InvoiceCustomizeDrawer } from "@/components/invoice/InvoiceCustomizeDrawer";
import { generateDeliveryPDF, buildDeliveryDocumentForPDF, openSavedFile } from "@/lib/pdfGenerator";
import { useSettings } from "@/hooks/useSettings";
import { useLicenseStatus } from "@/hooks/useLicense";

/** Same unified A4 editor + adapter approach as NewDelivery.tsx — see that
 *  page's own doc comment for the full rationale. */
export default function EditDeliveryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: clients } = useClients();
  const { data: products } = useProducts();
  const { data: deliveryNote, isLoading: isLoadingNote } = useDeliveryNote(id);
  const updateDelivery = useUpdateDeliveryNote();
  const { data: settings } = useSettings();
  const { data: licenseStatus } = useLicenseStatus();
  const [customizeDrawerOpen, setCustomizeDrawerOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [draftDelivery, setDraftDelivery] = useState({
    client_id: "",
    delivery_date: new Date().toISOString().split("T")[0],
    order_id: "",
    reserves: "",
    delivery_number: "",
    deliverer_name: "",
    supplier_delivered_date: "",
    client_received_date: "",
    client_signature: "",
    custom_title: "BON DE LIVRAISON",
    items: [] as any[],
  });

  useEffect(() => {
    if (deliveryNote) {
      setDraftDelivery({
        client_id: deliveryNote.client_id || "",
        delivery_date: deliveryNote.delivery_date,
        order_id: deliveryNote.order_id || "",
        reserves: deliveryNote.reserves || "",
        delivery_number: deliveryNote.delivery_number || "",
        deliverer_name: deliveryNote.deliverer_name || "",
        supplier_delivered_date: deliveryNote.supplier_delivered_date || "",
        client_received_date: deliveryNote.client_received_date || "",
        client_signature: deliveryNote.client_signature || "",
        custom_title: (deliveryNote as any).custom_title || "BON DE LIVRAISON",
        items: deliveryNote.delivery_note_items?.map((item: any) => ({
          ...item,
          product_name: item.product_name || item.products?.name,
          product_code: item.product_code || item.products?.code,
          product_description: item.product_description || item.products?.description,
          unit_price: item.unit_price ?? item.products?.unit_price,
          tva_rate: item.tva_rate,
        })) || [],
      });
    }
  }, [deliveryNote]);

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
    if (!id) return;

    const validItems = draftDelivery.items.filter((item: any) => item.quantity > 0);

    if (!draftDelivery.client_id || validItems.length === 0) {
      if (!draftDelivery.client_id) toast.error("Veuillez sélectionner un client");
      else toast.error("Veuillez saisir au moins une quantité");
      return;
    }

    if (validItems.some((item: any) => (item.unit_price ?? 0) < 0)) {
      toast.error("Le prix unitaire ne peut pas être négatif");
      return;
    }

    updateDelivery.mutate({
      id,
      data: {
        client_id: draftDelivery.client_id,
        delivery_date: draftDelivery.delivery_date,
        order_id: draftDelivery.order_id || undefined,
        reserves: draftDelivery.reserves || undefined,
        delivery_number: draftDelivery.delivery_number || undefined,
        deliverer_name: draftDelivery.deliverer_name || undefined,
        supplier_delivered_date: draftDelivery.supplier_delivered_date || undefined,
        client_received_date: draftDelivery.client_received_date || undefined,
        client_signature: draftDelivery.client_signature || undefined,
        items: validItems.map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          product_name: item.product_name,
          product_code: item.product_code,
          unit_price: item.unit_price,
          tva_rate: item.tva_rate,
          product_description: item.product_description
        })),
      }
    }, {
      onSuccess: () => {
        toast.success("Bon de livraison modifié avec succès");
        navigate(`/deliveries/${id}`);
      },
    });
  };

  const handleDownloadPDF = async () => {
    const validItems = draftDelivery.items.filter((item: any) => item.quantity > 0);
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
        delivery_note_items: validItems.map((item: any) => ({
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

  if (isLoadingNote) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col min-h-0 w-full max-w-full overflow-x-hidden">
      <header className="sticky top-0 h-10 w-full max-w-full border-b border-border/80 bg-background/95 backdrop-blur-sm px-4 flex items-center justify-between gap-4 shrink-0 z-30 overflow-hidden select-none">
        <div className="flex items-center gap-2.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => navigate(`/deliveries/${id}`)}
                className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Retour</TooltipContent>
          </Tooltip>
          <div className="h-4 w-px bg-border shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold font-mono text-foreground shrink-0 whitespace-nowrap">
            Modifier le bon de livraison
            {draftDelivery.delivery_number && (
              <span className="ml-1.5 font-normal text-muted-foreground">N° {draftDelivery.delivery_number}</span>
            )}
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
          disabled={updateDelivery.isPending}
        >
          {updateDelivery.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {updateDelivery.isPending ? "Enregistrement..." : "Mettre à jour"}
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
