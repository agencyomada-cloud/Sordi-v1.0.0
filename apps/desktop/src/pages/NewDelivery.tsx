import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { RiArrowLeftLine as ArrowLeft } from "@remixicon/react";
import { Button } from "@sordi/ui";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { useCreateDeliveryNote } from "@/hooks/useDeliveryNotes";
import { toast } from "sonner";
import { DeliveryEditablePreview } from "@/components/delivery/DeliveryEditablePreview";
import { generateDeliveryNotePDF } from "@/lib/pdfGenerator";
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

export default function NewDeliveryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const invoiceData = location.state?.invoiceData;
  const { data: clients } = useClients();
  const { data: products } = useProducts();
  const { data: orders } = useOrders();
  const createDelivery = useCreateDeliveryNote();
  const { data: settings } = useSettings();
  const { data: licenseStatus } = useLicenseStatus();

  const [draftDelivery, setDraftDelivery] = useState({
    client_id: invoiceData?.client_id || "",
    delivery_date: new Date().toISOString().split("T")[0],
    order_id: "",
    truck_plate: "",
    driver_name: "",
    deliverer_name: "",
    deliverer_nin: "",
    transporter_name: "",
    transporter_nin: "",
    delivery_location: "",
    notes: "",
    reserves: "",
    custom_title: "BON DE LIVRAISON",
    delivery_number: "",
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
      truck_plate: draftDelivery.truck_plate || undefined,
      driver_name: draftDelivery.driver_name || undefined,
      deliverer_name: draftDelivery.deliverer_name || undefined,
      deliverer_nin: draftDelivery.deliverer_nin || undefined,
      transporter_name: draftDelivery.transporter_name || undefined,
      transporter_nin: draftDelivery.transporter_nin || undefined,
      delivery_location: draftDelivery.delivery_location || undefined,
      notes: draftDelivery.notes || undefined,
      reserves: draftDelivery.reserves || undefined,
      custom_title: draftDelivery.custom_title || undefined,
      delivery_number: draftDelivery.delivery_number || undefined,
      items: validItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
    }, {
      onSuccess: async (createdNote) => {
        toast.success("Bon de livraison créé avec succès");
        // PDF Gen
        try {
          const client = clients?.find(c => c.id === createdNote.client_id);
          const noteForPDF = {
            ...createdNote,
            clients: client ? {
              name: client.name,
              address: client.address || "",
              nif: client.nif || "",
              nis: client.nis || "",
              rc: client.rc || "",
              ai: client.ai || "",
            } : undefined,
            custom_title: createdNote.custom_title || draftDelivery.custom_title,
            delivery_note_items: validItems.map(item => ({
              product_id: item.product_id,
              product_description: item.product_description || item.products?.description || undefined,
              products: {
                name: item.product_name,
                code: item.product_code,
                description: item.product_description || item.products?.description || undefined
              },
              quantity: item.quantity
            }))
          };
          await generateDeliveryNotePDF(noteForPDF as any, settings, true, undefined, licenseStatus?.state === "active");
          toast.success("PDF téléchargé");
        } catch (error) {
          console.error("PDF generation error", error);
          toast.error("Erreur lors de la génération du PDF");
        }

        navigate("/deliveries");
      },
    });
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />

        <div className="flex-1 overflow-auto bg-muted/40 p-8 flex flex-col items-center">
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
        </div>
      </div>
    </div>
  );
}
