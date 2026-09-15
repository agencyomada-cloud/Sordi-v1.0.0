import { useState, useEffect, useRef } from "react";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useProducts } from "@/hooks/useProducts";
import { useNavigate } from "react-router-dom";
import {
  RiArrowLeftLine as ArrowLeft,
  RiFileTextLine as FileText,
  RiDownloadLine as Download,
  RiLoader4Line as Loader2,
} from "@remixicon/react";
import { Palette } from "lucide-react";
import { format } from "date-fns";
import { Button, Tooltip, TooltipTrigger, TooltipContent } from "@sordi/ui";
import { cn } from "@/lib/utils";
import { useCreateOrder, useNextOrderNumber } from "@/hooks/useOrders";
import { toast } from "sonner";
import { EditableInvoicePreview } from "@/components/invoice/EditableInvoicePreview";
import { InvoiceCustomizeDrawer } from "@/components/invoice/InvoiceCustomizeDrawer";
import { generateOrderPDF, openSavedFile } from "@/lib/pdfGenerator";
import { useSettings } from "@/hooks/useSettings";
import { useLicenseStatus } from "@/hooks/useLicense";

interface OrderLine {
  id: string;
  product_id?: string;
  product_name?: string;
  product_code?: string;
  product_description?: string;
  quantity: number;
  unit_price: number;
  tva_rate?: number;
}

/**
 * Same unified A4 editor as Facture/Devis/Proforma/Avoir — literally the
 * same EditableInvoicePreview/EditableInvoiceStructure/Epure/Moderne
 * components (documentType="order"), not a parallel OrderEditable* tree.
 * See useEditableInvoiceLogic's own doc comment on EditableDocumentType.
 *
 * The order's own data model (order_number/order_date/supplier_* flat
 * fields — see useOrders.ts's CreateOrderData) is kept as the page's real
 * state and the one truth handleSubmit posts from; `toSharedShape`/
 * `applySharedChange` below are a thin, one-way-and-back adapter that lets
 * the SAME shared component read/write it as if it were an invoice
 * (invoice_number/invoice_date/clients/invoice_items) without the order
 * data model itself needing to be renamed. This mirrors how `client_id`
 * still stores the picked SUPPLIER's id (see EditableInvoicePreview's own
 * `suppliers` prop doc comment) — a deliberate, explicitly-noted
 * compromise rather than a backend migration this pass doesn't take on.
 */
export default function NewOrderPage() {
  const navigate = useNavigate();
  const createOrder = useCreateOrder();
  const { data: settings } = useSettings();
  const { data: licenseStatus } = useLicenseStatus();
  const { data: suppliers } = useSuppliers();
  const { data: products } = useProducts();
  const { data: nextOrderNumber } = useNextOrderNumber();
  const [customizeDrawerOpen, setCustomizeDrawerOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const initialDate = format(new Date(), "yyyy-MM-dd");

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
    order_date: initialDate,
    delivery_date: "",
    payment_terms: "30",
    // "Virement bancaire", deliberately never "Espèces" — the shared
    // component's timbre-fiscal math triggers automatically whenever
    // paymentMode is "Espèces" (see useEditableInvoiceLogic's
    // recalculateTotals), and showPaymentMethod is false for orders so
    // there's no picker to ever change this away from its initial value.
    payment_method: "transfer",
    notes: "",
    custom_title: "BON DE COMMANDE",
    order_number: "",
    items: [
      { id: crypto.randomUUID(), product_name: "", product_code: "", quantity: 1, unit_price: 0 }
    ] as OrderLine[],
    subtotal_ht: 0,
    tva_amount: 0,
    total_ttc: 0,
  });

  const orderNumberAutoFilled = useRef(false);
  useEffect(() => {
    if (nextOrderNumber && !orderNumberAutoFilled.current) {
      orderNumberAutoFilled.current = true;
      setDraftOrder(prev => ({ ...prev, order_number: nextOrderNumber }));
    }
  }, [nextOrderNumber]);

  // The shared component's own useEditableInvoiceLogic recomputes
  // subtotal/tva/total on every item edit and hands the full totals object
  // back through applySharedChange below — this effect no longer needs to
  // compute them itself (unlike the pre-unification version of this page).

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

  // One-way view of draftOrder in the shape EditableInvoiceStructure reads
  // (invoice_number/invoice_date/clients/invoice_items/...).
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

  // Reverse mapping — every write EditableInvoiceStructure makes (picking
  // a supplier, editing a line, changing the number/date/notes) comes back
  // through here and is folded into draftOrder's own real field names.
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

  const isSubmitDisabled = !draftOrder.supplier_name?.trim() && !draftOrder.client_id;

  const handleSubmit = async () => {
    if (isSubmitDisabled) {
      toast.error("Veuillez sélectionner ou saisir un fournisseur");
      return;
    }

    const validLines = draftOrder.items.filter((l) => (l.product_name?.trim() || l.product_code?.trim()) && l.quantity > 0);
    if (validLines.length === 0) {
      toast.error("Ajoutez au moins un produit");
      return;
    }

    if (validLines.some((l) => (l.unit_price ?? 0) < 0)) {
      toast.error("Le prix unitaire ne peut pas être négatif");
      return;
    }

    const finalOrderDate = draftOrder.order_date || initialDate;

    createOrder.mutate(
      {
        client_id: draftOrder.client_id || undefined,
        supplier_name: draftOrder.supplier_name?.trim() || undefined,
        supplier_address: draftOrder.supplier_address?.trim() || undefined,
        supplier_email: draftOrder.supplier_email?.trim() || undefined,
        supplier_phone: draftOrder.supplier_phone?.trim() || undefined,
        supplier_rc: draftOrder.supplier_rc?.trim() || undefined,
        supplier_nif: draftOrder.supplier_nif?.trim() || undefined,
        supplier_nis: draftOrder.supplier_nis?.trim() || undefined,
        supplier_ai: draftOrder.supplier_ai?.trim() || undefined,
        order_date: finalOrderDate,
        delivery_date: draftOrder.delivery_date || undefined,
        payment_terms: `${draftOrder.payment_terms} jours`,
        payment_method: paymentMethodFromOrder(draftOrder.payment_method),
        notes: draftOrder.notes || undefined,
        custom_title: draftOrder.custom_title || undefined,
        order_number: draftOrder.order_number || undefined,
        items: validLines.map((l) => ({
          product_id: l.product_id || undefined,
          product_name: l.product_name?.trim() || undefined,
          product_code: l.product_code?.trim() || undefined,
          product_description: l.product_description?.trim() || undefined,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tva_rate: l.tva_rate,
        })),
      },
      {
        onSuccess: async (createdOrder) => {
          toast.success("Bon de commande créé avec succès");

          try {
            const orderForPDF = {
              ...createdOrder,
              custom_title: createdOrder.custom_title || draftOrder.custom_title,
            };
            await generateOrderPDF(orderForPDF as any, settings, true, undefined, licenseStatus?.license_state);
            toast.success("PDF téléchargé");
          } catch (error) {
            console.error("PDF generation error", error);
            toast.error("Erreur lors de la génération du PDF");
          }

          navigate("/orders");
        }
      }
    );
  };

  const handleDownloadPDF = async () => {
    if (!draftOrder.items.some((l) => (l.product_name?.trim() || l.product_code?.trim()) && l.quantity > 0)) {
      toast.error("Ajoutez au moins un produit avant de télécharger le PDF");
      return;
    }
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

  return (
    <main className="flex-1 flex flex-col min-h-0 w-full max-w-full overflow-x-hidden">
      <header className="sticky top-0 h-10 w-full max-w-full border-b border-border/80 bg-background/95 backdrop-blur-sm px-4 flex items-center justify-between gap-4 shrink-0 z-30 overflow-hidden select-none">
        <div className="flex items-center gap-2.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => navigate("/orders")}
                className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Retour</TooltipContent>
          </Tooltip>
          <div className="h-4 w-px bg-border shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold font-mono text-foreground shrink-0 whitespace-nowrap">
            Nouveau bon de commande
            {(draftOrder.order_number || nextOrderNumber) && (
              <span className="ml-1.5 font-normal text-muted-foreground">
                N° {draftOrder.order_number || nextOrderNumber}
              </span>
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
          disabled={isSubmitDisabled || createOrder.isPending}
        >
          {createOrder.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {createOrder.isPending ? "Création..." : "Créer le bon de commande"}
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
