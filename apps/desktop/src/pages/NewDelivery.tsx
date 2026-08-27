import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { RiArrowLeftLine as ArrowLeft } from "@remixicon/react";
import { Button } from "@sordi/ui";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { useCreateDeliveryNote } from "@/hooks/useDeliveryNotes";
import { toast } from "sonner";
import { DeliveryEditablePreview } from "@/components/delivery/DeliveryEditablePreview";
import { generateDeliveryNotePDF, buildDeliveryNotePDFData } from "@/lib/pdfGenerator";
import { useSettings } from "@/hooks/useSettings";

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

export default function NewDeliveryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const invoiceData = location.state?.invoiceData;
  const { data: clients } = useClients();
  const { data: products } = useProducts();
  const createDelivery = useCreateDeliveryNote();
  const { data: settings } = useSettings();

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
    items: (invoiceData?.items || []) as DeliveryItem[]
  });

  const handleDeliveryChange = (updatedDelivery: any) => {
    setDraftDelivery(updatedDelivery);
  };

  const handleSubmit = () => {
    const validItems = draftDelivery.items.filter(item => item.quantity > 0);

    if (!draftDelivery.client_id || validItems.length === 0) {
      if (!draftDelivery.client_id) toast.error("Veuillez sélectionner un client");
      else toast.error("Veuillez saisir au moins une quantité");
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
        // Only meaningful when product_id is absent — a custom/one-off item.
        product_name: item.product_id ? undefined : item.product_name || undefined,
        product_code: item.product_id ? undefined : item.product_code || undefined,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tva_rate: item.tva_rate,
      })),
    }, {
      onSuccess: async (createdNote) => {
        toast.success("Bon de livraison créé avec succès");
        // PDF Gen
        try {
          const client = clients?.find(c => c.id === createdNote.client_id);
          const pdfData = buildDeliveryNotePDFData({
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
          await generateDeliveryNotePDF(pdfData, settings);
        } catch (error) {
          console.error("PDF generation error", error);
          toast.error("Erreur lors de la génération du PDF");
        }

        navigate("/deliveries");
      },
    });
  };

  return (
    <main className="flex-1 overflow-auto bg-muted/40 p-8 flex flex-col items-center">
          <div className="w-full max-w-[210mm] flex items-center justify-between mb-6">
            <Button variant="ghost" onClick={() => navigate("/deliveries")} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            <div className="flex gap-2">
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={createDelivery.isPending}
                className="shadow-lg"
              >
                {createDelivery.isPending ? "Création..." : "VALIDER LE BON DE LIVRAISON"}
              </Button>
            </div>
          </div>

          <div className="w-full max-w-[210mm] pb-20">
            <div className="shadow-2xl">
              <DeliveryEditablePreview
                deliveryNote={draftDelivery}
                onDeliveryChange={handleDeliveryChange}
                clients={clients}
                products={products}
              />
            </div>
          </div>
    </main>
  );
}
