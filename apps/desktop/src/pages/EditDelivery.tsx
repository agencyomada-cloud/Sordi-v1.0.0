import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RiArrowLeftLine as ArrowLeft } from "@remixicon/react";
import { Button } from "@sordi/ui";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { useDeliveryNote, useUpdateDeliveryNote } from "@/hooks/useDeliveryNotes";
import { toast } from "sonner";
import { DeliveryEditablePreview } from "@/components/delivery/DeliveryEditablePreview";

interface DeliveryItem {
    product_id: string; // Optional because UI might not have it for custom items, but generally needed. 
    // Actually DeliveryEditablePreview uses product_id, product_code, product_name, quantity etc.
    // When loading from DB, we map existing items.
    id?: string; // Existing item ID
    product_code: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    product_description?: string;
}

export default function EditDeliveryPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: clients } = useClients();
    const { data: products } = useProducts();
    const { data: deliveryNote, isLoading: isLoadingNote } = useDeliveryNote(id);
    const updateDelivery = useUpdateDeliveryNote();

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
        items: [] as any[]
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
                items: deliveryNote.delivery_note_items?.map((item: any) => ({
                    ...item,
                    product_name: item.product_name || item.products?.name,
                    product_code: item.product_code || item.products?.code,
                    product_description: item.product_description || item.products?.description,
                    unit_price: item.unit_price ?? item.products?.unit_price,
                    tva_rate: item.tva_rate,
                })) || []
            });
        }
    }, [deliveryNote]);

    const handleDeliveryChange = (updatedDelivery: any) => {
        setDraftDelivery(updatedDelivery);
    };

    const handleSubmit = () => {
        if (!id) return;

        // Filter invalid items
        const validItems = draftDelivery.items.filter((item: any) => item.quantity > 0);

        if (!draftDelivery.client_id || validItems.length === 0) {
            if (!draftDelivery.client_id) toast.error("Veuillez sélectionner un client");
            else toast.error("Veuillez saisir au moins une quantité");
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

    if (isLoadingNote) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-pulse text-muted-foreground">Chargement...</div>
            </div>
        );
    }

    return (
                <main className="flex-1 overflow-auto bg-muted/40 p-8 flex flex-col items-center">
                    <div className="w-full max-w-[210mm] flex items-center justify-between mb-6">
                        <Button variant="ghost" onClick={() => navigate(`/deliveries/${id}`)} className="gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Retour
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                size="lg"
                                onClick={handleSubmit}
                                disabled={updateDelivery.isPending}
                                className="shadow-lg"
                            >
                                {updateDelivery.isPending ? "Enregistrement..." : "ENREGISTRER LES MODIFICATIONS"}
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
