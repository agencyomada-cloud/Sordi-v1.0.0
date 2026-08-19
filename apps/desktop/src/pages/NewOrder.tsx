import { useState, useMemo, useEffect } from "react";
import { useClients } from "@/hooks/useClients";
import { useNavigate } from "react-router-dom";
import { RiArrowLeftLine as ArrowLeft } from "@remixicon/react";
import { format } from "date-fns";
import { Button } from "@sordi/ui";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useCreateOrder, useNextOrderNumber } from "@/hooks/useOrders";
import { toast } from "sonner";
import { OrderEditablePreview } from "@/components/order/OrderEditablePreview";
import { generateOrderPDF } from "@/lib/pdfGenerator";
import { useSettings } from "@/hooks/useSettings";

interface OrderLine {
  id: string;
  product_id?: string;
  product_name?: string;
  product_code?: string;
  product_description?: string;
  quantity: number;
  unit_price: number;
  tva_rate?: number;
  // Computed for convenience
  total_ht?: number;
}

export default function NewOrderPage() {
  const navigate = useNavigate();
  const createOrder = useCreateOrder();
  const { data: settings } = useSettings();
  const { data: clients } = useClients();
  const { data: nextOrderNumber, isLoading: isLoadingNumber } = useNextOrderNumber();

  // Initial state logic
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

  // Auto-fill order number when loaded
  useEffect(() => {
    if (nextOrderNumber && !draftOrder.order_number) {
      setDraftOrder(prev => ({ ...prev, order_number: nextOrderNumber }));
    }
  }, [nextOrderNumber]);

  // Calculate totals whenever items change
  useMemo(() => {
    const subtotal = draftOrder.items.reduce((sum, l) => sum + (l.quantity || 0) * (l.unit_price || 0), 0);

    let tvaAmount = 0;
    draftOrder.items.forEach(item => {
      const itemAmount = (item.quantity || 0) * (item.unit_price || 0);
      const tvaRate = item.tva_rate === undefined ? 19.0 : item.tva_rate;
      if (tvaRate && tvaRate > 0) {
        tvaAmount += itemAmount * (tvaRate / 100);
      }
    });

    const total = subtotal + tvaAmount;

    if (
      subtotal !== draftOrder.subtotal_ht ||
      tvaAmount !== draftOrder.tva_amount ||
      total !== draftOrder.total_ttc
    ) {
      setDraftOrder(prev => ({
        ...prev,
        subtotal_ht: subtotal,
        tva_amount: tvaAmount,
        total_ttc: total
      }));
    }
  }, [draftOrder.items]);

  const handleOrderChange = (updatedOrder: any) => {
    setDraftOrder(updatedOrder);
  };

  const handleSubmit = async () => {
    if (!draftOrder.supplier_name?.trim() && !draftOrder.client_id) {
      toast.error("Veuillez sélectionner un client ou entrer un fournisseur");
      return;
    }

    const validLines = draftOrder.items.filter((l) => (l.product_name?.trim() || l.product_code?.trim()) && l.quantity > 0);
    if (validLines.length === 0) {
      toast.error("Ajoutez au moins un produit");
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
        payment_method: draftOrder.payment_method === "transfer" ? "Virement bancaire" : draftOrder.payment_method === "cheque" ? "Chèque" : "Espèces",
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
            await generateOrderPDF(orderForPDF as any, settings);
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

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />

        <div className="flex-1 overflow-auto bg-muted/40 p-8 flex flex-col items-center">
          <div className="w-full max-w-[210mm] flex items-center justify-between mb-6">
            <Button variant="ghost" onClick={() => navigate("/orders")} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            <div className="flex gap-2">
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={createOrder.isPending}
                className="shadow-lg"
              >
                {createOrder.isPending ? "Création..." : "VALIDER LA COMMANDE"}
              </Button>
            </div>
          </div>

          <div className="w-full max-w-[210mm] pb-20">
            <div className="shadow-2xl">
              <OrderEditablePreview
                order={draftOrder}
                onOrderChange={handleOrderChange}
                clients={clients}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
