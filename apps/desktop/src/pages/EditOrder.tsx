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
import { useProducts } from "@/hooks/useProducts";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useOrder, useOrderItems, useUpdateOrder } from "@/hooks/useOrders";
import { toast } from "sonner";
import { EditableInvoicePreview } from "@/components/invoice/EditableInvoicePreview";
import { InvoiceCustomizeDrawer } from "@/components/invoice/InvoiceCustomizeDrawer";
import { generateOrderPDF, openSavedFile } from "@/lib/pdfGenerator";
import { useSettings } from "@/hooks/useSettings";
import { useLicenseStatus } from "@/hooks/useLicense";

/** Same unified A4 editor + adapter approach as NewOrder.tsx — see that
 *  page's own doc comment for the full rationale. */
export default function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: suppliers } = useSuppliers();
  const { data: products } = useProducts();
  const { data: order, isLoading: isLoadingOrder } = useOrder(id);
  const { data: orderItems, isLoading: isLoadingItems } = useOrderItems(id);
  const updateOrder = useUpdateOrder();
  const { data: settings } = useSettings();
  const { data: licenseStatus } = useLicenseStatus();
  const [customizeDrawerOpen, setCustomizeDrawerOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [draftOrder, setDraftOrder] = useState({
    client_id: "",
    supplier_name: "",
    supplier_address: "",
    supplier_email: "",
    supplier_phone: "",
    supplier_rc: "",
    supplier_nif: "",
    supplier_nis: "",
    supplier_ai: "",
    order_date: new Date().toISOString().split("T")[0],
    delivery_date: "",
    payment_terms: "",
    payment_method: "transfer",
    notes: "",
    custom_title: "BON DE COMMANDE",
    order_number: "",
    items: [] as any[],
    subtotal_ht: 0,
    tva_amount: 0,
    total_ttc: 0,
  });

  useEffect(() => {
    if (order && orderItems) {
      setDraftOrder({
        client_id: order.client_id || "",
        supplier_name: order.supplier_name || "",
        supplier_address: order.supplier_address || "",
        supplier_email: order.supplier_email || "",
        supplier_phone: order.supplier_phone || "",
        supplier_rc: order.supplier_rc || "",
        supplier_nif: order.supplier_nif || "",
        supplier_nis: order.supplier_nis || "",
        supplier_ai: order.supplier_ai || "",
        order_date: order.order_date,
        delivery_date: order.delivery_date || "",
        payment_terms: order.payment_terms || "",
        payment_method: order.payment_method === "Chèque" ? "cheque" : order.payment_method === "Espèces" ? "cash" : "transfer",
        notes: order.notes || "",
        custom_title: order.custom_title || "BON DE COMMANDE",
        order_number: order.order_number || "",
        items: orderItems.map((item: any) => ({
          ...item,
          product_name: item.product_name || item.products?.name,
          product_code: item.product_code || item.products?.code,
          product_description: item.product_description || item.products?.description,
          unit_price: item.unit_price,
          quantity: item.quantity,
        })),
        subtotal_ht: order.subtotal_ht || 0,
        tva_amount: order.tva_amount || 0,
        total_ttc: order.total_ttc || 0,
      });
    }
  }, [order, orderItems]);

  const paymentMethodToOrder = (label: string): string => {
    if (label === "Chèque") return "cheque";
    if (label === "Espèces") return "cash";
    return "transfer";
  };
  const paymentMethodFromOrder = (value: string): string => {
    if (value === "cheque") return "Chèque";
    if (value === "cash") return "Espèces";
    return "Virement bancaire";
  };

  const sharedInvoice = {
    invoice_number: draftOrder.order_number,
    invoice_date: draftOrder.order_date,
    due_date: draftOrder.delivery_date,
    notes: draftOrder.notes,
    custom_title: draftOrder.custom_title,
    clients: (draftOrder.client_id || draftOrder.supplier_name) ? {
      id: draftOrder.client_id || undefined,
      name: draftOrder.supplier_name,
      address: draftOrder.supplier_address,
      rc: draftOrder.supplier_rc,
      nif: draftOrder.supplier_nif,
      nis: draftOrder.supplier_nis,
      ai: draftOrder.supplier_ai,
    } : undefined,
    invoice_items: draftOrder.items,
    payment_method: paymentMethodFromOrder(draftOrder.payment_method),
    subtotal_ht: draftOrder.subtotal_ht,
    tva_amount: draftOrder.tva_amount,
    timbre: 0,
    total_ttc: draftOrder.total_ttc,
    balance_due: draftOrder.total_ttc,
  };

  const handleSharedChange = (updated: any) => {
    setDraftOrder(prev => ({
      ...prev,
      order_number: updated.invoice_number ?? prev.order_number,
      order_date: updated.invoice_date ?? prev.order_date,
      delivery_date: updated.due_date ?? prev.delivery_date,
      notes: updated.notes ?? prev.notes,
      custom_title: updated.custom_title ?? prev.custom_title,
      client_id: updated.clients?.id || "",
      supplier_name: updated.clients?.name ?? prev.supplier_name,
      supplier_address: updated.clients?.address ?? prev.supplier_address,
      supplier_rc: updated.clients?.rc ?? prev.supplier_rc,
      supplier_nif: updated.clients?.nif ?? prev.supplier_nif,
      supplier_nis: updated.clients?.nis ?? prev.supplier_nis,
      supplier_ai: updated.clients?.ai ?? prev.supplier_ai,
      items: updated.invoice_items ?? prev.items,
      payment_method: updated.payment_method ? paymentMethodToOrder(updated.payment_method) : prev.payment_method,
      subtotal_ht: updated.subtotal_ht ?? prev.subtotal_ht,
      tva_amount: updated.tva_amount ?? prev.tva_amount,
      total_ttc: updated.total_ttc ?? prev.total_ttc,
    }));
  };

  const formatDockTotal = (amount: number) => {
    const formatted = (amount || 0).toFixed(2).replace('.', ',');
    const [intPart, decPart] = formatted.split(',');
    return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${decPart} DA`;
  };

  const handleSubmit = () => {
    if (!id) return;

    const validItems = draftOrder.items.filter((item: any) => item.quantity > 0);

    if (validItems.length === 0) {
      toast.error("Veuillez saisir au moins une quantité");
      return;
    }

    if (validItems.some((item: any) => (item.unit_price ?? 0) < 0)) {
      toast.error("Le prix unitaire ne peut pas être négatif");
      return;
    }

    updateOrder.mutate({
      id,
      data: {
        client_id: draftOrder.client_id || undefined,
        supplier_name: draftOrder.supplier_name || undefined,
        supplier_address: draftOrder.supplier_address || undefined,
        supplier_email: draftOrder.supplier_email || undefined,
        supplier_phone: draftOrder.supplier_phone || undefined,
        supplier_rc: draftOrder.supplier_rc || undefined,
        supplier_nif: draftOrder.supplier_nif || undefined,
        supplier_nis: draftOrder.supplier_nis || undefined,
        supplier_ai: draftOrder.supplier_ai || undefined,
        order_date: draftOrder.order_date,
        delivery_date: draftOrder.delivery_date || undefined,
        payment_terms: draftOrder.payment_terms || undefined,
        payment_method: paymentMethodFromOrder(draftOrder.payment_method),
        notes: draftOrder.notes || undefined,
        custom_title: draftOrder.custom_title || undefined,
        order_number: draftOrder.order_number || undefined,
        items: validItems.map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          product_name: item.product_name,
          product_code: item.product_code,
          product_description: item.product_description,
          unit_price: item.unit_price,
        })),
      }
    }, {
      onSuccess: () => {
        toast.success("Bon de commande modifié avec succès");
        navigate(`/orders/${id}`);
      },
    });
  };

  const handleDownloadPDF = async () => {
    const toastId = "download-order-pdf";
    try {
      setIsDownloading(true);
      toast.loading("Génération du PDF...", { id: toastId });
      await generateOrderPDF(
        { ...draftOrder, payment_method: paymentMethodFromOrder(draftOrder.payment_method) } as any,
        settings,
        true,
        undefined,
        licenseStatus?.license_state,
        ({ path, blob }) => {
          toast.success("Bon de commande PDF généré", {
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

  if (isLoadingOrder || isLoadingItems) {
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
                onClick={() => navigate(`/orders/${id}`)}
                className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Retour</TooltipContent>
          </Tooltip>
          <div className="h-4 w-px bg-border shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold font-mono text-foreground shrink-0 whitespace-nowrap">
            Modifier le bon de commande
            {draftOrder.order_number && (
              <span className="ml-1.5 font-normal text-muted-foreground">N° {draftOrder.order_number}</span>
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
        <div className="text-right leading-tight">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total TTC</div>
          <span className="font-mono font-bold text-sm text-foreground">{formatDockTotal(draftOrder.total_ttc)}</span>
        </div>
        <div className="h-6 w-px bg-border" aria-hidden="true" />
        <Button
          type="button"
          size="default"
          className="h-10 px-5 font-medium rounded-xl gap-2"
          onClick={handleSubmit}
          disabled={updateOrder.isPending}
        >
          {updateOrder.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {updateOrder.isPending ? "Enregistrement..." : "Mettre à jour"}
        </Button>
      </div>

      <div className="flex flex-1 w-full overflow-hidden relative min-h-0">
        <div className="flex-1 min-h-0 min-w-0 bg-zinc-100/60 dark:bg-zinc-950">
          <EditableInvoicePreview
            invoice={sharedInvoice}
            onInvoiceChange={handleSharedChange}
            suppliers={suppliers}
            products={products}
            documentType="order"
          />
        </div>

        <InvoiceCustomizeDrawer open={customizeDrawerOpen} onOpenChange={setCustomizeDrawerOpen} />
      </div>
    </main>
  );
}
