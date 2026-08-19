import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RiArrowLeftLine as ArrowLeft } from "@remixicon/react";
import { Button } from "@sordi/ui";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useProducts } from "@/hooks/useProducts";
import { useClients } from "@/hooks/useClients";
// import { useOrders } from "@/hooks/useOrders"; 
import { useOrder, useOrderItems, useUpdateOrder } from "@/hooks/useOrders";
import { toast } from "sonner";
import { OrderEditablePreview } from "@/components/order/OrderEditablePreview";
import { useSettings } from "@/hooks/useSettings";

export default function EditOrderPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: clients } = useClients();
    // Let's check NewOrder.tsx logic. Usually Orders are to suppliers. 
    // OmadaInvoice seems to treat orders as Purchase Orders (Bon de Commande) to suppliers OR Sales Orders from clients?
    // OrderEditablePreview uses "supplier_name".
    const { data: products } = useProducts();
    const { data: order, isLoading: isLoadingOrder } = useOrder(id);
    const { data: orderItems, isLoading: isLoadingItems } = useOrderItems(id);
    const updateOrder = useUpdateOrder();
    const { data: settings } = useSettings();

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
        payment_method: "",
        notes: "",
        custom_title: "BON DE COMMANDE",
        order_number: "",
        items: [] as any[]
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
                payment_method: order.payment_method || "",
                notes: order.notes || "",
                custom_title: order.custom_title || "BON DE COMMANDE",
                order_number: order.order_number || "",
                items: orderItems.map((item: any) => ({
                    ...item,
                    // Ensure product fields are passed correctly
                    product_name: item.product_name || item.products?.name,
                    product_code: item.product_code || item.products?.code,
                    product_description: item.product_description || item.products?.description,
                    unit_price: item.unit_price,
                    quantity: item.quantity,
                    // Map other fields if necessary
                }))
            });
        }
    }, [order, orderItems]);

    const handleOrderChange = (updatedOrder: any) => {
        setDraftOrder(updatedOrder);
    };

    const handleSubmit = () => {
        if (!id) return;

        // Filter invalid items
        const validItems = draftOrder.items.filter((item: any) => item.quantity > 0);

        if (validItems.length === 0) {
            toast.error("Veuillez saisir au moins une quantité");
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
                payment_method: draftOrder.payment_method || undefined,
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

    if (isLoadingOrder || isLoadingItems) {
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
                        <Button variant="ghost" onClick={() => navigate(`/orders/${id}`)} className="gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Retour
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                size="lg"
                                onClick={handleSubmit}
                                disabled={updateOrder.isPending}
                                className="shadow-lg"
                            >
                                {updateOrder.isPending ? "Enregistrement..." : "ENREGISTRER LES MODIFICATIONS"}
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
