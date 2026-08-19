import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RiArrowLeftLine as ArrowLeft } from "@remixicon/react";
import { Button } from "@sordi/ui";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { useDeliveryNote, useUpdateDeliveryNote } from "@/hooks/useDeliveryNotes";
import { toast } from "sonner";
import { DeliveryEditablePreview } from "@/components/delivery/DeliveryEditablePreview";
import { generateDeliveryNotePDF } from "@/lib/pdfGenerator";
import { useSettings } from "@/hooks/useSettings";

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
    const { data: settings } = useSettings();

    const [draftDelivery, setDraftDelivery] = useState({
        client_id: "",
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
        items: [] as any[]
    });

    useEffect(() => {
        if (deliveryNote) {
            setDraftDelivery({
                client_id: deliveryNote.client_id || "",
                delivery_date: deliveryNote.delivery_date,
                order_id: deliveryNote.order_id || "",
                truck_plate: deliveryNote.truck_plate || "",
                driver_name: deliveryNote.driver_name || "",
                deliverer_name: deliveryNote.deliverer_name || "",
                deliverer_nin: deliveryNote.deliverer_nin || "",
                transporter_name: deliveryNote.transporter_name || "",
                transporter_nin: deliveryNote.transporter_nin || "",
                delivery_location: deliveryNote.delivery_location || "",
                notes: deliveryNote.notes || "",
                reserves: deliveryNote.reserves || "",
                custom_title: deliveryNote.custom_title || "BON DE LIVRAISON",
                delivery_number: deliveryNote.delivery_number || "",
                items: deliveryNote.delivery_note_items?.map((item: any) => ({
                    ...item,
                    // Ensure product fields are flattened if needed by EditablePreview, 
                    // but EditablePreview expects direct fields on item object usually? 
                    // Let's check NewDelivery - it constructs items from product selection.
                    // When loading, we might need to preserve product details.
                    // The DeliveryEditablePreview uses item.product_name etc.
                    product_name: item.product_name || item.products?.name,
                    product_code: item.product_code || item.products?.code,
                    product_description: item.product_description || item.products?.description,
                    unit_price: item.unit_price || item.products?.unit_price,
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
                items: validItems.map((item: any) => ({
                    product_id: item.product_id, // Might be null if custom item? Backend handling?
                    // If we allow custom items, backend must handle nullable product_id or we create one.
                    // Assuming existing logic handles it or we only pick from products. 
                    // NewDelivery uses product_id. 
                    quantity: item.quantity,
                    product_name: item.product_name, // If backend supports updating name overrides
                    product_code: item.product_code,
                    unit_price: item.unit_price,
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
            <div className="flex min-h-screen bg-background items-center justify-center">
                <div className="animate-pulse text-muted-foreground">Chargement...</div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <Header />

                <div className="flex-1 overflow-auto bg-muted/40 p-8 flex flex-col items-center">
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
                </div>
            </div>
        </div>
    );
}
