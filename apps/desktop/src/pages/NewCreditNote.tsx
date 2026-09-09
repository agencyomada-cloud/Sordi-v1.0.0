import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RiArrowLeftLine as ArrowLeft } from "@remixicon/react";
import { Button, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sordi/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { useInvoices, useInvoice, useCreateInvoice } from "@/hooks/useInvoices";
import { useSettings } from "@/hooks/useSettings";
import { EditableInvoicePreview } from "@/components/invoice/EditableInvoicePreview";

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

export default function NewCreditNotePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const originalInvoiceId = searchParams.get("invoice");

  const { data: clients } = useClients();
  const { data: products } = useProducts();
  const { data: invoices } = useInvoices(undefined, "invoice");
  const { data: originalInvoice } = useInvoice(originalInvoiceId || undefined);
  const { data: settings } = useSettings();
  const createInvoice = useCreateInvoice();

  const [clientId, setClientId] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(originalInvoiceId || "");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [headerNote, setHeaderNote] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState<string>("");

  // Filter invoices by selected client
  const clientInvoices = invoices?.filter(inv => inv.client_id === clientId) || [];

  // Fetch next invoice number
  useEffect(() => {
    const fetchNextInvoiceNumber = async () => {
      try {
        // Just use a placeholder or generic fetch, usually we might want a specific sequence for credit notes
        // For now, let's assume same sequence or it just shows "DRAFT" until saved?
        // Actually NewInvoice fetches it. Let's try to fetch it if possible.
        // If your system separates credit note numbering, this might need adjustment.
        // Assuming single sequence for now or handled by backend.
        // Let's manually set a placeholder "AVOIR-BROUILLON" if we can't reliably predict
        // or try to fetch recent.
        // Ideally: db.invoices.getNextNumber('credit_note') ? 
        // Let's skip auto-fetching number for credit note to avoid confusion if it shares sequence
        // or just use "AVOIR" as placeholder.
      } catch (error) {
        console.error("Error fetching number", error);
      }
    };
    fetchNextInvoiceNumber();
  }, []);

  // Initialize items from products or original invoice
  useEffect(() => {
    if (originalInvoice && products) {
      setClientId(originalInvoice.client_id);
      setSelectedInvoiceId(originalInvoice.id);

      const invoiceItems = (originalInvoice as any).invoice_items || [];
      setItems(products.map(p => {
        const originalItem = invoiceItems.find((item: any) => item.product_id === p.id);
        return {
          product_id: p.id,
          product_code: p.code,
          product_name: p.name,
          product_description: originalItem?.product_description || originalItem?.products?.description || p.description || "",
          quantity: originalItem?.quantity || 0,
          unit_price: originalItem?.unit_price || p.unit_price,
          amount: (originalItem?.quantity || 0) * (originalItem?.unit_price || p.unit_price),
        };
      }));
    } else if (products && items.length === 0 && !originalInvoiceId) {
      // Initialize empty if no original invoice
      setItems(products.map(p => ({
        product_id: p.id,
        product_code: p.code,
        product_name: p.name,
        product_description: p.description || "",
        quantity: 0,
        unit_price: p.unit_price,
        amount: 0,
        tva_rate: p.tva_rate ?? 19.0,
        timbre_exempt: p.timbre_exempt ?? false,
      })));
    }
  }, [originalInvoice, products, originalInvoiceId, items.length]);

  // Handle manual selection of original invoice from dropdown
  // We need to fetch that invoice's details to populate items
  // Since we don't have a hook for "fetched invoice by selected ID" unless we use useInvoice
  // But useInvoice takes a single ID.
  // Workaround: Find the invoice in `clientInvoices` list (which might be lightweight)
  // If `clientInvoices` has items, great. If not, we might need to fetch full invoice.
  // The `invoices` list from useInvoices usually doesn't have items.
  // We should probably rely on `useInvoice(selectedInvoiceId)` but we can't call hooks conditionally/loop.
  // So we might need a separate effect or just let user manually edit if they pick from dropdown?
  // Better: When ID changes, if it's different from originalInvoiceId, we might need to fetch it.
  // Let's assume for now we just initialize empty or basic.
  // Actually, for a proper credit note experience, fetching the original items is key.
  // Let's use `useInvoice(selectedInvoiceId)` dynamically?

  const { data: selectedInvoiceData } = useInvoice(selectedInvoiceId || undefined);

  useEffect(() => {
    if (selectedInvoiceData && products && selectedInvoiceId !== originalInvoiceId) {
      const invoiceItems = (selectedInvoiceData as any).invoice_items || [];
      setItems(products.map(p => {
        const originalItem = invoiceItems.find((item: any) => item.product_id === p.id);
        return {
          product_id: p.id,
          product_code: p.code,
          product_name: p.name,
          product_description: originalItem?.product_description || originalItem?.products?.description || p.description || "",
          quantity: originalItem?.quantity || 0,
          unit_price: originalItem?.unit_price || p.unit_price,
          amount: (originalItem?.quantity || 0) * (originalItem?.unit_price || p.unit_price),
        };
      }));
    }
  }, [selectedInvoiceData, products, selectedInvoiceId, originalInvoiceId]);


  const calculateTotals = (itemsList: InvoiceItem[]) => {
    const subtotal = itemsList.reduce((sum, item) => sum + item.amount, 0);
    // Use per-item TVA instead of global setting
    const tva = itemsList.reduce((sum, item) => {
      const rate = item.tva_rate ?? 19.0;
      return sum + (item.amount * (rate / 100));
    }, 0);
    const timbre = 0; // No stamp for credit notes
    const total = subtotal + tva;
    return { subtotal, tva, timbre, total };
  };

  const [paymentMethod, setPaymentMethod] = useState<string>("Virement");
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountRate, setDiscountRate] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Sync payment method when selected invoice changes
  useEffect(() => {
    const targetInv = selectedInvoiceData || originalInvoice;
    if (targetInv?.payment_method) {
      setPaymentMethod(targetInv.payment_method);
    }
  }, [selectedInvoiceData, originalInvoice]);

  const [draftInvoice, setDraftInvoice] = useState(() => {
    return {
      invoice_number: "AVOIR-BROUILLON",
      invoice_type: "credit_note" as const,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      subtotal_ht: 0,
      tva_rate: typeof settings?.tva_rate === 'string' ? parseFloat(settings.tva_rate) : (settings?.tva_rate || 19.0),
      tva_amount: 0,
      timbre: 0,
      total_ttc: 0,
      notes: notes || null,
      header_note: headerNote || null,
      payment_method: paymentMethod,
      clients: undefined as any,
      invoice_items: [] as any[],
      original_invoice_id: selectedInvoiceId,
      original_invoice: selectedInvoiceData || originalInvoice,
      discount_type: 'percent' as 'percent' | 'amount',
      discount_value: 0,
      use_secondary_register: false,
    };
  });

  // Sync draft with form state
  useEffect(() => {
    const selectedClient = clients?.find(c => c.id === clientId);
    const validItems = items.filter(item => item.quantity > 0);
    const totals = calculateTotals(validItems);
    const refInv = selectedInvoiceData || originalInvoice;

    setDraftInvoice(prev => ({
      ...prev,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      notes: notes || null,
      header_note: headerNote || null,
      payment_method: paymentMethod,
      subtotal_ht: totals.subtotal,
      tva_rate: typeof settings?.tva_rate === 'string' ? parseFloat(settings.tva_rate) : (settings?.tva_rate || 19.0),
      tva_amount: totals.tva,
      timbre: totals.timbre,
      total_ttc: totals.total,
      original_invoice_id: selectedInvoiceId,
      original_invoice: refInv, // Pass full object for reference display
      discount_type: discountType,
      discount_value: discountType === 'percent' ? discountRate : discountAmount,
      clients: selectedClient ? {
        name: selectedClient.name,
        address: selectedClient.address || null,
        nif: selectedClient.nif || null,
        nis: selectedClient.nis || null,
        rc: selectedClient.rc || null,
        secondary_rc: selectedClient.secondary_rc || null,
        secondary_address: selectedClient.secondary_address || null,
        ai: selectedClient.ai || null,
        activite: selectedClient.activite || null,
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
  }, [clientId, invoiceDate, dueDate, items, notes, headerNote, paymentMethod, clients, products, selectedInvoiceId, selectedInvoiceData, originalInvoice, settings, discountType, discountRate, discountAmount]);

  const handleDraftInvoiceChange = (updatedInvoice: any) => {
    setDraftInvoice(updatedInvoice);
    setInvoiceDate(updatedInvoice.invoice_date || invoiceDate);
    setDueDate(updatedInvoice.due_date || "");
    setNotes(updatedInvoice.notes || "");
    setHeaderNote(updatedInvoice.header_note || "");
    setDiscountType(updatedInvoice.discount_type || 'percent');
    if (updatedInvoice.discount_type === 'percent') {
      setDiscountRate(updatedInvoice.discount_value || 0);
    } else {
      setDiscountAmount(updatedInvoice.discount_value || 0);
    }

    // Sync items changes from preview back to main items state
    if (updatedInvoice.invoice_items) {
      const newItems = items.map(item => {
        // Find if this item exists in the updated draft
        const draftItem = updatedInvoice.invoice_items.find((di: any) =>
          (di.product_id && di.product_id === item.product_id) || (di.products?.code === item.product_code)
        );

        if (draftItem) {
          return {
            ...item,
            quantity: draftItem.quantity,
            unit_price: draftItem.unit_price,
            amount: draftItem.quantity * draftItem.unit_price,
            tva_rate: draftItem.tva_rate,
            timbre_exempt: draftItem.timbre_exempt,
          };
        }
        return { ...item, quantity: 0, amount: 0 };
      });
      setItems(newItems);
    }
  };

  const handleSubmit = () => {
    const validItems = items.filter(item => item.quantity > 0);

    if (!clientId || !selectedInvoiceId || validItems.length === 0) {
      return;
    }

    createInvoice.mutate({
      client_id: clientId,
      invoice_date: invoiceDate,
      due_date: dueDate || undefined,
      notes: notes || undefined,
      header_note: headerNote || undefined,
      invoice_type: "credit_note",
      original_invoice_id: selectedInvoiceId || undefined,
      payment_method: paymentMethod,
      use_secondary_register: draftInvoice.use_secondary_register,
      discount: draftInvoice.subtotal_ht > 0 ? (draftInvoice.discount_type === 'percent' ? (draftInvoice.subtotal_ht * (draftInvoice.discount_value / 100)) : draftInvoice.discount_value) : 0,
      discount_type: draftInvoice.discount_type,
      discount_value: draftInvoice.discount_value,
      items: validItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity, // Keep positive - backend will handle sign based on invoice_type
        unit_price: item.unit_price,
        tva_rate: item.tva_rate === undefined ? 19.0 : item.tva_rate,
        timbre_exempt: item.timbre_exempt ?? false,
        product_description: item.product_description,
      })),
    }, {
      onSuccess: () => {
        navigate("/invoices");
      },
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-DZ", {
      style: "decimal",
      minimumFractionDigits: 2,
    }).format(amount) + " DA";
  };

  return (
        <main className="flex-1 p-8">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <Button variant="ghost" onClick={() => navigate("/invoices")} className="gap-2 mb-4 p-0 h-auto hover:bg-transparent hover:text-primary">
                <ArrowLeft className="w-4 h-4" />
                Retour aux factures
              </Button>
              <h1 className="text-2xl font-semibold text-foreground">Nouvelle facture d'avoir</h1>
              <p className="text-muted-foreground">Créer une facture d'avoir pour un client</p>
            </div>

            <Button
              onClick={handleSubmit}
              className="bg-red-600 hover:bg-red-700 gap-2"
              disabled={!clientId || !selectedInvoiceId || items.every(i => i.quantity === 0) || createInvoice.isPending}
            >
              {createInvoice.isPending ? "Création..." : "Créer l'avoir"}
            </Button>
          </div>

          <div className="space-y-6">

            {/* Configuration Bar */}
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div>
                  <Label className="mb-2 block">Client *</Label>
                  <Select value={clientId} onValueChange={(value) => {
                    setClientId(value);
                    setSelectedInvoiceId("");
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-2 block">Facture d'origine *</Label>
                  <Select
                    value={selectedInvoiceId}
                    onValueChange={setSelectedInvoiceId}
                    disabled={!clientId}
                    required
                  >
                    <SelectTrigger className={!selectedInvoiceId && clientId ? "border-red-300" : ""}>
                      <SelectValue placeholder={clientId ? "Sélectionner une facture" : "Sélectionner d'abord un client"} />
                    </SelectTrigger>
                    <SelectContent>
                      {clientInvoices.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number} - {formatCurrency(invoice.total_ttc || 0)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedInvoiceId && clientId && (
                    <p className="text-xs text-red-500 mt-1">Obligatoire selon la loi algérienne</p>
                  )}
                </div>

                <div>
                  <Label className="mb-2 block">Date de l'avoir</Label>
                  <DatePicker value={invoiceDate} onChange={setInvoiceDate} />
                </div>

                <div>
                  <Label className="mb-2 block">Mode de paiement</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Mode de paiement" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Espèces">Espèces</SelectItem>
                      <SelectItem value="Chèque">Chèque</SelectItem>
                      <SelectItem value="Virement">Virement</SelectItem>
                      <SelectItem value="Versement">Versement</SelectItem>
                      <SelectItem value="Traite">Traite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Full Width Preview */}
            <div className="bg-muted rounded-xl p-6 overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)', minHeight: '600px' }}>
              <div className="flex justify-center">
                <div className="transition-all duration-300 transform hover:scale-[1.01]">
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
