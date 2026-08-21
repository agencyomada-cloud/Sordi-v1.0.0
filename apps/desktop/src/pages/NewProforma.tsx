import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  RiArrowLeftLine as ArrowLeft, 
  RiFileTextLine as FileText, 
  RiDownloadLine as Download, 
  RiLoader4Line as Loader2 
} from "@remixicon/react";
import { Button } from "@sordi/ui";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { useCreateInvoice } from "@/hooks/useInvoices";
import { EditableInvoicePreview } from "@/components/invoice/EditableInvoicePreview";
import { generateInvoicePDF } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { useSettings } from "@/hooks/useSettings";
import { useLicenseStatus } from "@/hooks/useLicense";

interface InvoiceItem {
    product_id: string;
    product_code: string;
    product_name: string;
    product_description?: string;
    quantity: number;
    unit_price: number;
    amount: number;
    tva_rate?: number | null;
    timbre_exempt?: boolean;
}

export default function NewProformaPage() {
    const navigate = useNavigate();
    const { data: clients } = useClients();
    const { data: products } = useProducts();
    const { data: settings } = useSettings();
    const { data: licenseStatus } = useLicenseStatus();
    const createInvoice = useCreateInvoice();

    const [clientId, setClientId] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
    const [dueDate, setDueDate] = useState("");
    const [notes, setNotes] = useState("");
    const [headerNote, setHeaderNote] = useState("");
    const [items, setItems] = useState<InvoiceItem[]>([]);

    // Extended Invoice State
    const [paymentMode, setPaymentMode] = useState("Espèces");
    const [discountRate, setDiscountRate] = useState<number>(0);
    const [discountAmount, setDiscountAmount] = useState<number>(0);
    const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
    const [customTitle, setCustomTitle] = useState("Facture Proforma");
    const [isDownloading, setIsDownloading] = useState(false);

    // Load from LocalStorage on mount
    useEffect(() => {
        const savedDraft = localStorage.getItem("draft_proforma");
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                if (parsed.clientId) setClientId(parsed.clientId);
                if (parsed.invoiceDate) setInvoiceDate(parsed.invoiceDate);
                if (parsed.dueDate) setDueDate(parsed.dueDate);
                if (parsed.notes) setNotes(parsed.notes);
                if (parsed.headerNote) setHeaderNote(parsed.headerNote);
                if (parsed.items) setItems(parsed.items);
                if (parsed.paymentMode) setPaymentMode(parsed.paymentMode);
                if (parsed.discountRate) setDiscountRate(parsed.discountRate);
                if (parsed.discountAmount) setDiscountAmount(parsed.discountAmount);
                if (parsed.discountType) setDiscountType(parsed.discountType);
                if (parsed.customTitle) setCustomTitle(parsed.customTitle);
                toast.info("Brouillon proforma restauré");
            } catch (e) {
                console.error("Failed to parse draft", e);
            }
        }
    }, []);

    // Save to LocalStorage on change
    useEffect(() => {
        const draft = {
            clientId,
            invoiceDate,
            dueDate,
            notes,
            headerNote,
            items,
            paymentMode,
            discountRate,
            discountAmount,
            discountType,
            customTitle
        };
        if (clientId || items.length > 0 || notes || headerNote) {
            localStorage.setItem("draft_proforma", JSON.stringify(draft));
        }
    }, [clientId, invoiceDate, dueDate, notes, headerNote, items, paymentMode, discountRate, discountAmount, discountType, customTitle]);

    useEffect(() => {
        if (products && items.length === 0) {
            setItems(products.map(p => ({
                product_id: p.id,
                product_code: p.code,
                product_name: p.name,
                product_description: p.description || "",
                quantity: 0,
                unit_price: p.unit_price,
                amount: 0,
                tva_rate: p.tva_rate === undefined ? 19.0 : p.tva_rate,
                timbre_exempt: p.timbre_exempt === true,
            })));
        }
    }, [products, items.length]);

    const calculateTotals = (
        itemsList: InvoiceItem[],
        currentPaymentMode: string = "Espèces",
        currentDiscountRate: number = 0,
        currentDiscountAmount: number = 0,
        type: 'percent' | 'amount' = 'percent'
    ) => {
        const calcSubtotal = itemsList.reduce((sum, item) => sum + item.amount, 0);
        let finalDiscountAmount = 0;
        let finalDiscountRate = 0;

        if (type === 'percent') {
            finalDiscountRate = currentDiscountRate;
            finalDiscountAmount = calcSubtotal * (currentDiscountRate / 100);
        } else {
            finalDiscountAmount = currentDiscountAmount;
            finalDiscountRate = calcSubtotal > 0 ? (currentDiscountAmount / calcSubtotal) * 100 : 0;
        }

        // Apply discount to reduction ratio for tax base
        const reductionRatio = calcSubtotal > 0 ? (calcSubtotal - finalDiscountAmount) / calcSubtotal : 1;

        let totalTva = 0;
        let totalForTimbre = 0;

        itemsList.forEach(item => {
            const itemAmountHt = item.amount;
            const tvaRate = item.tva_rate;
            const effectiveRate = (tvaRate === undefined || tvaRate === null) ? 19.0 : tvaRate;
            const isTimbreExempt = item.timbre_exempt || effectiveRate === -1.0;

            // TVA is calculated on GROSS HT amount (before discount)
            const itemTva = (effectiveRate && effectiveRate > 0) ? (itemAmountHt * (effectiveRate / 100)) : 0;
            totalTva += itemTva;

            if (!isTimbreExempt) {
                // Timbre base is Gross HT + Gross TVA
                totalForTimbre += itemAmountHt + itemTva;
            }
        });

        let calcTimbre = 0;
        if (currentPaymentMode && currentPaymentMode.toLowerCase().includes("espèc") && totalForTimbre > 0) {
            const amount = totalForTimbre;
            let rate = 0.01;
            if (amount > 100000) {
                rate = 0.02; // Over 100k
            } else if (amount > 30000) {
                rate = 0.015; // 30k to 100k
            } else {
                rate = 0.01; // 0 to 30k
            }
            calcTimbre = amount * rate;
            if (calcTimbre < 5) calcTimbre = 5;
            if (calcTimbre > 20000) calcTimbre = 20000;
        }


        const calcTotal = (calcSubtotal - finalDiscountAmount) + totalTva + calcTimbre;

        return {
            calcSubtotal,
            calcTva: totalTva,
            calcTimbre,
            calcTotal,
            finalDiscountAmount,
            finalDiscountRate
        };
    };

    const initialTotals = calculateTotals(items, paymentMode, discountRate, discountAmount, discountType);
    const calculatedDiscountAmount = initialTotals.finalDiscountAmount;

    // Build draft invoice for preview
    const [draftInvoice, setDraftInvoice] = useState(() => {
        const totals = calculateTotals(items);
        return {
            invoice_number: "PRO-...", // Placeholder for Proforma
            invoice_type: "proforma" as const,
            invoice_date: invoiceDate,
            due_date: dueDate || null,
            subtotal_ht: totals.calcSubtotal,
            tva_rate: (items.length > 0 && items[0].tva_rate !== undefined) ? items[0].tva_rate : 19.0,
            tva_amount: totals.calcTva,
            timbre: totals.calcTimbre,
            total_ttc: totals.calcTotal,
            notes: notes || null,
            header_note: headerNote || null,
            payment_method: paymentMode,
            discount_rate: discountRate,
            discount_amount: calculatedDiscountAmount,
            discount_value: discountType === 'percent' ? discountRate : discountAmount,
            discount: calculatedDiscountAmount,
            discount_type: discountType,
            use_secondary_register: false,
            clients: undefined as any,
            invoice_items: [] as any[],
            custom_title: customTitle, // Default title
        };
    });

    useEffect(() => {
        const selectedClient = clients?.find(c => c.id === clientId);
        const validItems = items.filter(item => item.quantity > 0);
        const totals = calculateTotals(validItems, paymentMode, discountRate, discountAmount, discountType);

        setDraftInvoice(prev => ({
            ...prev,
            invoice_date: invoiceDate,
            due_date: dueDate || null,
            notes: notes || null,
            header_note: headerNote || null,
            subtotal_ht: totals.calcSubtotal,
            tva_amount: totals.calcTva,
            timbre: totals.calcTimbre,
            total_ttc: totals.calcTotal,
            payment_method: paymentMode,
            discount_rate: discountRate,
            discount_amount: totals.finalDiscountAmount,
            discount_value: discountType === 'percent' ? discountRate : discountAmount,
            discount: totals.finalDiscountAmount,
            discount_type: discountType,
            clients: selectedClient ? {
                name: selectedClient.name,
                address: selectedClient.address || null,
                nif: selectedClient.nif || null,
                nis: selectedClient.nis || null,
                rc: selectedClient.rc || null,
                secondary_rc: selectedClient.secondary_rc || null,
                secondary_address: selectedClient.secondary_address || null,
                ai: selectedClient.ai || null,
            } : undefined,
            invoice_items: validItems.map(item => {
                const product = products?.find(p => p.id === item.product_id);
                return {
                    product_id: item.product_id,
                    product_name: product?.name || "",
                    product_description: product?.description || undefined,
                    products: product ? {
                        code: product.code,
                        name: product.name,
                        description: product.description || undefined,
                        unit: product.unit || null,
                    } : undefined,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    tva_rate: item.tva_rate === undefined ? 19.0 : item.tva_rate,
                };
            }),
        }));
    }, [clientId, invoiceDate, dueDate, items, notes, headerNote, clients, products, paymentMode, discountRate, discountAmount, discountType]);

    const handleDraftInvoiceChange = (updatedInvoice: any) => {
        setDraftInvoice(updatedInvoice);

        setInvoiceDate(updatedInvoice.invoice_date || invoiceDate);
        setDueDate(updatedInvoice.due_date || "");
        setNotes(updatedInvoice.notes || "");
        setHeaderNote(updatedInvoice.header_note || "");
        setPaymentMode(updatedInvoice.payment_method || "Espèces");
        setDiscountRate(updatedInvoice.discount_rate || 0);
        setDiscountAmount(updatedInvoice.discount_amount || 0);
        setDiscountType(updatedInvoice.discount_type || 'percent');
        setCustomTitle(updatedInvoice.custom_title || "Facture Proforma");

        if (updatedInvoice.clients?.name) {
            const newClient = clients?.find(c => c.name === updatedInvoice.clients.name);
            if (newClient) {
                setClientId(newClient.id);
            }
        }

        if (updatedInvoice.invoice_items) {
            const updatedItems = updatedInvoice.invoice_items.map((invoiceItem: any) => {
                const product = products?.find(p => p.id === invoiceItem.product_id || p.code === invoiceItem.products?.code);
                if (product) {
                    return {
                        product_id: product.id,
                        product_code: product.code,
                        product_name: product.name,
                        product_description: product.description || "",
                        quantity: invoiceItem.quantity || 0,
                        unit_price: invoiceItem.unit_price || product.unit_price,
                        amount: (invoiceItem.quantity || 0) * (invoiceItem.unit_price || product.unit_price),
                        tva_rate: invoiceItem.tva_rate,
                        timbre_exempt: invoiceItem.timbre_exempt,
                    };
                }
                return null;
            }).filter((item: any) => item !== null);

            const mergedItems = items.map(item => {
                const updatedItem = updatedItems.find((ui: any) => ui.product_id === item.product_id);
                return updatedItem || { ...item, quantity: 0, amount: 0 };
            });

            updatedItems.forEach((updatedItem: any) => {
                if (!mergedItems.find((mi: any) => mi.product_id === updatedItem.product_id)) {
                    mergedItems.push(updatedItem);
                }
            });

            setItems(mergedItems);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("fr-DZ", {
            style: "decimal",
            minimumFractionDigits: 2,
        }).format(amount) + " DA";
    };

    const submitInvoice = () => {
        const validItems = items.filter(item => item.quantity > 0);

        if (!clientId || validItems.length === 0) {
            if (!clientId) toast.error("Veuillez sélectionner un client");
            if (validItems.length === 0) toast.error("Veuillez ajouter au moins un produit");
            return;
        }

        createInvoice.mutate({
            client_id: clientId,
            invoice_date: invoiceDate,
            due_date: dueDate || undefined,
            notes: notes || undefined,
            header_note: headerNote || undefined,
            custom_title: draftInvoice.custom_title,
            invoice_number: (draftInvoice.invoice_number && draftInvoice.invoice_number !== "PRO-...") ? draftInvoice.invoice_number : undefined,
            invoice_type: "proforma", // Explicitly set type
            use_secondary_register: draftInvoice.use_secondary_register,
            discount: draftInvoice.discount_amount,
            discount_type: discountType,
            discount_value: discountType === 'percent' ? discountRate : discountAmount,
            items: validItems.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                tva_rate: item.tva_rate === undefined ? 19.0 : item.tva_rate,
                timbre_exempt: item.timbre_exempt ?? false,
                product_description: item.product_description,
            })),
        }, {
            onSuccess: async () => {
                localStorage.removeItem("draft_proforma");
                toast.success("Facture Proforma créée avec succès");
                navigate("/invoices?tab=proformas");
            },
        });
    };

    return (
                <main className="flex-1 p-8">
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <Button variant="ghost" onClick={() => navigate("/invoices")} className="gap-2 mb-2 p-0 h-auto hover:bg-transparent hover:text-primary">
                                <ArrowLeft className="w-4 h-4" />
                                Retour aux factures/proformas
                            </Button>
                            <h1 className="text-2xl font-semibold text-foreground">Nouvelle Facture Proforma</h1>
                            <p className="text-muted-foreground">Créer une facture proforma / devis</p>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={async () => {
                                    if (!draftInvoice.clients || !draftInvoice.invoice_items || draftInvoice.invoice_items.length === 0) {
                                        toast.error("Veuillez remplir les informations client et ajouter au moins un produit");
                                        return;
                                    }
                                    try {
                                        setIsDownloading(true);
                                        await generateInvoicePDF(draftInvoice, settings, true, undefined, licenseStatus?.state === "active");
                                        toast.success("PDF téléchargé avec succès");
                                    } catch (error) {
                                        toast.error("Erreur lors de la génération du PDF");
                                    } finally {
                                        setIsDownloading(false);
                                    }
                                }}
                                disabled={isDownloading || !draftInvoice.clients || !draftInvoice.invoice_items || draftInvoice.invoice_items.length === 0}
                                className="gap-2"
                            >
                                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                {isDownloading ? "Téléchargement..." : "Télécharger PDF"}
                            </Button>
                            <Button
                                type="button"
                                onClick={submitInvoice}
                                disabled={!clientId || items.every(i => i.quantity === 0) || createInvoice.isPending}
                                className="gap-2"
                            >
                                {createInvoice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                {createInvoice.isPending ? "Création..." : "Créer le proforma"}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-card rounded-xl border border-border p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="bg-secondary/30 rounded-lg p-3">
                                    <p className="text-xs text-muted-foreground">Sous-total H.T</p>
                                    <p className="text-sm font-bold">{formatCurrency(draftInvoice.subtotal_ht || 0)}</p>
                                </div>
                                <div className="bg-secondary/30 rounded-lg p-3">
                                    <p className="text-xs text-muted-foreground">Total TVA</p>
                                    <p className="text-sm font-bold">{formatCurrency(draftInvoice.tva_amount || 0)}</p>
                                </div>
                                <div className="bg-secondary/30 rounded-lg p-3">
                                    <p className="text-xs text-muted-foreground">Timbre</p>
                                    <p className="text-sm font-bold">{formatCurrency(draftInvoice.timbre || 0)}</p>
                                </div>
                                <div className="bg-primary/10 rounded-lg p-3">
                                    <p className="text-xs text-primary">Total TTC</p>
                                    <p className="text-sm font-bold text-primary">{formatCurrency(draftInvoice.total_ttc || 0)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-muted rounded-xl p-6 overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)', minHeight: '500px' }}>
                            <div className="flex justify-center">
                                <div className="shadow-2xl">
                                    <EditableInvoicePreview
                                        invoice={draftInvoice}
                                        onInvoiceChange={handleDraftInvoiceChange}
                                        clients={clients}
                                        products={products}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
    );
}
