import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  RiArrowLeftLine as ArrowLeft, 
  RiFileTextLine as FileText, 
  RiDownloadLine as Download, 
  RiLoader4Line as Loader2 
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { useCreateInvoice, useUpdateInvoice, useInvoice } from "@/hooks/useInvoices";
import { EditableInvoicePreview } from "@/components/invoice/EditableInvoicePreview";
import { generateInvoicePDF } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { db } from "@/lib/database";
import { useSettings } from "@/hooks/useSettings";
import { useParams } from "react-router-dom";
import { useClearClientDraftProducts } from "@/hooks/useClientDraftProducts";
import { useAddClientAdvance } from "@/hooks/useClientAdvances";

interface InvoiceItem {
  product_id: string;
  product_code: string;
  product_name: string;
  product_description?: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tva_rate?: number | null; // 19, 9, null (non assujetti), or -1 (non assujetti au timbre)
  timbre_exempt?: boolean;
  products?: any;
}

export default function NewInvoicePage() {
  const navigate = useNavigate();
  const { data: clients } = useClients();
  const { data: products } = useProducts();
  const { data: settings } = useSettings();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const clearDrafts = useClearClientDraftProducts();
  const { id } = useParams<{ id: string }>(); // Get ID from URL if editing
  const { data: existingInvoice, isLoading: isLoadingInvoice } = useInvoice(id);

  const loadDraft = () => {
    try {
      const saved = localStorage.getItem("draft_invoice");
      if (saved) return JSON.parse(saved);
    } catch (e) { }
    return null;
  };
  const [draftData] = useState(loadDraft);

  const [clientId, setClientId] = useState(draftData?.clientId || "");
  const [invoiceDate, setInvoiceDate] = useState(draftData?.invoiceDate || new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(draftData?.dueDate || "");
  const [notes, setNotes] = useState(draftData?.notes || "");
  const [headerNote, setHeaderNote] = useState(draftData?.headerNote || "");
  const [items, setItems] = useState<InvoiceItem[]>(draftData?.items || []);
  const [isFromDraftProducts, setIsFromDraftProducts] = useState(draftData?.source === 'draft_products');
  const [advancePaymentConsumed, setAdvancePaymentConsumed] = useState(draftData?.advance_payment_consumed || 0);
  const addAdvance = useAddClientAdvance();

  // Extended Invoice State
  const [paymentMode, setPaymentMode] = useState(
    draftData?.source === 'draft_products' ? "Chèque" : (draftData?.paymentMode || "Espèces")
  );
  const [discountRate, setDiscountRate] = useState<number>(draftData?.discountRate || 0);
  const [discountAmount, setDiscountAmount] = useState<number>(draftData?.discountAmount || 0);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>(draftData?.discountType || 'percent');
  const [customTitle, setCustomTitle] = useState(draftData?.customTitle || "");
  const [isDownloading, setIsDownloading] = useState(false);

  // Show toast on mount if draft exists
  useEffect(() => {
    if (draftData) {
      toast.info("Brouillon restauré");
    }
  }, []);

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
      customTitle,
      source: isFromDraftProducts ? 'draft_products' : undefined,
      advance_payment_consumed: advancePaymentConsumed,
    };
    // Only save if there's some meaningful data
    if (clientId || items.length > 0 || notes || headerNote) {
      localStorage.setItem("draft_invoice", JSON.stringify(draft));
    }
  }, [clientId, invoiceDate, dueDate, notes, headerNote, items, paymentMode, discountRate, discountAmount, discountType, customTitle, isFromDraftProducts, advancePaymentConsumed]);

  // Initialize items from products using a ref to prevent loops
  useEffect(() => {
    // Only initialize if items are completely empty AND no id is present (new invoice)
    // AND draftData items are not available
    if (products && items.length === 0 && !id && !draftData?.items?.length) {
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
  }, [products, items.length, id, draftData]);

  // Load existing invoice data if editing
  useEffect(() => {
    if (existingInvoice && products) {
      const inv = existingInvoice as any;
      setClientId(inv.client_id);
      setInvoiceDate(inv.invoice_date);
      setDueDate(inv.due_date || "");
      setNotes(inv.notes || "");
      setHeaderNote(inv.header_note || "");
      setCustomTitle(inv.custom_title || "");
      setPaymentMode(inv.payment_method || "Espèces");
      const type = inv.discount_type || 'percent';
      setDiscountType(type as 'percent' | 'amount');

      if (type === 'percent') {
        setDiscountRate(inv.discount_value || inv.discount_rate || 0);
        setDiscountAmount(0);
      } else {
        setDiscountRate(0);
        setDiscountAmount(inv.discount_value || inv.discount_amount || inv.discount || 0);
      }

      // Map existing items
      if (inv.invoice_items) {
        const mappedItems = inv.invoice_items.map((invItem: any) => {
          const product = products.find(p => p.id === invItem.product_id);
          return {
            product_id: invItem.product_id,
            product_code: product?.code || invItem.products?.code || "",
            product_name: product?.name || invItem.products?.name || "",
            product_description: product?.description || invItem.products?.description || "",
            quantity: invItem.quantity,
            unit_price: invItem.unit_price,
            amount: invItem.amount || (invItem.quantity * invItem.unit_price),
            tva_rate: invItem.tva_rate,
            timbre_exempt: invItem.timbre_exempt,
          };
        });
        setItems(mappedItems);
      }

      // Restore secondary register fields from saved invoice
      setDraftInvoice(prev => ({
        ...prev,
        use_secondary_register: inv.use_secondary_register || false,
        selected_secondary_rc: inv.selected_secondary_rc || null,
        selected_secondary_address: inv.selected_secondary_address || null,
      }));
    }
  }, [existingInvoice, products]);

  // Calculate totals helper function (TVA per product)
  const calculateTotals = (
    itemsList: InvoiceItem[],
    currentPaymentMode: string = "Espèces",
    currentDiscountRate: number = 0,
    currentDiscountAmount: number = 0,
    type: 'percent' | 'amount' = 'percent'
  ) => {
    const calcSubtotal = itemsList.reduce((sum, item) => sum + item.amount, 0);

    // Calculate Discount info
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

    // Calculate TVA per product and sum them
    let totalTva = 0;
    let totalForTimbre = 0; // Total HT + TVA for timbre calculation

    itemsList.forEach(item => {
      const itemAmountHt = item.amount;
      const tvaRate = item.tva_rate;
      const effectiveRate = tvaRate === undefined ? 19.0 : tvaRate;
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

  // Initial totals
  const initialTotals = calculateTotals(items, paymentMode, discountRate, discountAmount, discountType);
  const calculatedDiscountAmount = initialTotals.finalDiscountAmount;

  // Get next invoice number for preview
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState<string>("");

  useEffect(() => {
    const fetchNextInvoiceNumber = async () => {
      try {
        const number = await db.invoices.getNextNumber();
        setNextInvoiceNumber(number);
      } catch (error) {
        console.error("Error fetching next invoice number:", error);
      }
    };
    fetchNextInvoiceNumber();
  }, []);

  // Build draft invoice for preview - editable version
  const [draftInvoice, setDraftInvoice] = useState(() => {
    const totals = calculateTotals(items);
    return {
      invoice_number: "",
      invoice_type: "invoice" as const,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      subtotal_ht: totals.calcSubtotal,
      tva_rate: (items.length > 0 && items[0].tva_rate !== undefined) ? items[0].tva_rate : 19.0, // Best guess or keep generic
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
      selected_secondary_rc: null as string | null,
      selected_secondary_address: null as string | null,
      clients: undefined as any,
      invoice_items: [] as any[],
      custom_title: customTitle, // Initialize custom_title
    };
  });

  // Update invoice number when nextInvoiceNumber is fetched
  useEffect(() => {
    if (nextInvoiceNumber && !id) { // Only set number if NEW invoice
      setDraftInvoice(prev => ({
        ...prev,
        invoice_number: nextInvoiceNumber,
      }));
    } else if (id && existingInvoice) {
      // Keep existing number
      setDraftInvoice(prev => ({
        ...prev,
        invoice_number: existingInvoice.invoice_number,
      }));
    }
  }, [nextInvoiceNumber, id, existingInvoice]);

  // Sync draft invoice with form state
  useEffect(() => {
    const selectedClient = clients?.find(c => c.id === clientId);
    const validItems = items.filter(item => item.quantity > 0);
    const totals = calculateTotals(validItems, paymentMode, discountRate, discountAmount, discountType);
    const calcSubtotal = totals.calcSubtotal;
    const calcTva = totals.calcTva;
    const calcTimbre = totals.calcTimbre;
    const calcTotal = totals.calcTotal;

    setDraftInvoice(prev => ({
      ...prev,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      notes: notes || null,
      header_note: headerNote || null,
      subtotal_ht: calcSubtotal,
      tva_amount: calcTva,
      timbre: calcTimbre,
      total_ttc: calcTotal,
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
        const fallbackProductInfo = item.products ? item.products : { code: item.product_code, name: item.product_name, description: item.product_description };
        return {
          product_id: item.product_id,
          products: product ? {
            id: product.id,
            code: product.code,
            name: product.name,
            description: product.description || undefined,
            unit: product.unit || null,
          } : fallbackProductInfo, // Provide fallback when products isn't fully loaded
          quantity: item.quantity,
          unit_price: item.unit_price,
          tva_rate: item.tva_rate === undefined ? 19.0 : item.tva_rate,
        };
      }),
    }));
  }, [clientId, invoiceDate, dueDate, items, notes, clients, products, paymentMode, discountRate, discountAmount, discountType]);

  // Sync form state with draft invoice changes
  const handleDraftInvoiceChange = (updatedInvoice: any) => {
    setDraftInvoice(updatedInvoice);

    // Update form state from draft
    setInvoiceDate(updatedInvoice.invoice_date || invoiceDate);
    setDueDate(updatedInvoice.due_date || "");
    setNotes(updatedInvoice.notes || "");
    setHeaderNote(updatedInvoice.header_note || "");
    setPaymentMode(updatedInvoice.payment_method || "Espèces");

    const type = updatedInvoice.discount_type || 'percent';
    setDiscountType(type);

    if (type === 'percent') {
      setDiscountRate(updatedInvoice.discount_value || updatedInvoice.discount_rate || 0);
      setDiscountAmount(0);
    } else {
      setDiscountRate(0);
      setDiscountAmount(updatedInvoice.discount_value || updatedInvoice.discount_amount || 0);
    }

    setCustomTitle(updatedInvoice.custom_title || "");

    // Update client
    if (updatedInvoice.clients?.name) {
      const newClient = clients?.find(c => c.name === updatedInvoice.clients.name);
      if (newClient) {
        setClientId(newClient.id);
      }
    }

    // Update items
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

      // Merge with existing items
      const mergedItems = items.map(item => {
        const updatedItem = updatedItems.find((ui: any) => ui.product_id === item.product_id);
        return updatedItem || { ...item, quantity: 0, amount: 0 };
      });

      // Add new items
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

    const payload = {
      client_id: clientId,
      invoice_date: invoiceDate,
      due_date: dueDate || undefined,
      notes: notes || undefined,
      header_note: headerNote || undefined,
      custom_title: draftInvoice.custom_title,
      invoice_number: draftInvoice.invoice_number,
      payment_method: paymentMode,
      use_secondary_register: draftInvoice.use_secondary_register,
      selected_secondary_rc: draftInvoice.selected_secondary_rc || undefined,
      selected_secondary_address: draftInvoice.selected_secondary_address || undefined,
      status: isFromDraftProducts ? "paid" : "issued", // Auto-mark as paid if generated from draft
      amount_paid: isFromDraftProducts ? draftInvoice.total_ttc : 0, // Auto-fill the paid amount
      discount: draftInvoice.discount_amount, // The flat amount for legacy/total displays
      discount_type: discountType,
      discount_value: discountType === 'percent' ? discountRate : discountAmount,
      items: validItems.map(item => ({
        product_id: item.product_id,
        product_description: item.product_description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tva_rate: item.tva_rate === undefined ? 19.0 : item.tva_rate,
        timbre_exempt: item.timbre_exempt ?? false,
      })),
    };

    if (id) {
      // UPDATE MODE
      updateInvoice.mutate({ id, data: payload }, {
        onSuccess: () => {
          localStorage.removeItem("draft_invoice");
          navigate("/invoices"); // Or navigate back to detail
        }
      });
    } else {
      // CREATE MODE
      createInvoice.mutate(payload, {
        onSuccess: async (createdInvoice) => {
          localStorage.removeItem("draft_invoice");

          if (isFromDraftProducts && advancePaymentConsumed > 0) {
            // Clear the draft products queue
            clearDrafts.mutate(clientId);

            // Deduct from client advance payment
            // Deduct from client advance payment via negative advance entry
            addAdvance.mutate({
              client_id: clientId,
              amount: -advancePaymentConsumed,
              date: new Date().toISOString(),
              payment_mode: "Déduction Facture",
              notes: `Déduction pour facture ${createdInvoice.invoice_number}`
            });
          }

          // toast handled in hook
          navigate("/invoices");
        },
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 p-8">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Button variant="ghost" onClick={() => navigate("/invoices")} className="gap-2 mb-2 p-0 h-auto hover:bg-transparent hover:text-primary">
                <ArrowLeft className="w-4 h-4" />
                Retour aux factures
              </Button>
              <h1 className="text-2xl font-semibold text-foreground">{id ? "Modifier la facture" : "Nouvelle facture"}</h1>
              <p className="text-muted-foreground">{id ? `Modification de la facture ${draftInvoice.invoice_number}` : "Créer une facture en mode interactif"}</p>
            </div>

            {/* Actions Buttons */}
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
                    await generateInvoicePDF(draftInvoice, settings);
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
                {createInvoice.isPending || updateInvoice.isPending ? "Traitement..." : (id ? "Mettre à jour" : "Créer la facture")}
              </Button>
            </div>
          </div>

          <div className="space-y-6">

            {/* Live Stats */}
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

            {/* Editable Preview */}
            <div className="bg-muted rounded-xl p-6 overflow-auto" style={{ maxHeight: 'calc(100vh - 250px)', minHeight: '500px' }}>
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
      </div>
    </div>
  );
}
