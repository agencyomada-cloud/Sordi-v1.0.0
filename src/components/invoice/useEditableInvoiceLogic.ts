import { useEffect, useState } from "react";
import { chunkItems } from "@/lib/paginationUtils";

/**
 * All the state and calculation logic behind the editable live-preview —
 * shared by the three theme presentations (Structuré/Épuré/Moderne) so the
 * complex totals/timbre/discount math exists exactly once instead of being
 * re-implemented (and re-risked) per theme.
 */
export function useEditableInvoiceLogic(invoice: any, onInvoiceChange: (invoice: any) => void) {
  const [paymentMode, setPaymentMode] = useState(invoice.payment_method || "Espèces");
  const [discountRate, setDiscountRate] = useState<number>(invoice.discount_rate || 0);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>(invoice.discount_type || 'percent');
  const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null);
  const [openClientCombo, setOpenClientCombo] = useState(false);

  useEffect(() => {
    if (invoice.payment_method) setPaymentMode(invoice.payment_method);
    if (invoice.discount_type) setDiscountType(invoice.discount_type);
    if (invoice.discount_type === 'percent') {
      setDiscountRate(invoice.discount_value || invoice.discount_rate || 0);
    } else {
      setDiscountRate(0);
    }
  }, [invoice.id, invoice.payment_method, invoice.discount_type, invoice.discount_rate, invoice.discount_value]);

  const items = invoice.invoice_items || [];

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "0,00 DA";
    const formatted = amount.toFixed(2).replace(/\./g, ',');
    const parts = formatted.split(',');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '00';
    const integerWithSpaces = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${integerWithSpaces},${decimalPart} DA`;
  };

  const updateInvoiceField = (field: string, value: any) => {
    onInvoiceChange({ ...invoice, [field]: value });
  };

  const updateClient = (clientId: string, clients?: any[]) => {
    const selectedClient = clients?.find(c => c.id === clientId);
    updateInvoiceField('clients', selectedClient ? {
      id: selectedClient.id,
      name: selectedClient.name,
      address: selectedClient.address || null,
      nif: selectedClient.nif || null,
      nis: selectedClient.nis || null,
      rc: selectedClient.rc || null,
      secondary_rc: selectedClient.secondary_rc || null,
      secondary_address: selectedClient.secondary_address || null,
      ai: selectedClient.ai || null,
    } : undefined);
  };

  const recalculateTotals = (
    itemsList: any[],
    currentPaymentMode: string,
    currentDiscountRate: number = 0,
    currentDiscountAmount: number = 0,
    type: 'percent' | 'amount' = 'percent',
    currentWithholdingRate: number = 0
  ) => {
    const newSubtotal = itemsList.reduce((sum: number, item: any) =>
      sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);

    let finalDiscountAmount = 0;
    let finalDiscountRate = 0;

    if (type === 'percent') {
      finalDiscountRate = currentDiscountRate;
      finalDiscountAmount = newSubtotal * (currentDiscountRate / 100);
    } else {
      finalDiscountAmount = currentDiscountAmount;
      finalDiscountRate = newSubtotal > 0 ? (currentDiscountAmount / newSubtotal) * 100 : 0;
    }

    let totalTva = 0;
    let totalForTimbre = 0;

    itemsList.forEach((item: any) => {
      const itemAmount = (item.quantity || 0) * (item.unit_price || 0);
      const tvaRate = item.tva_rate === undefined ? 19.0 : item.tva_rate;
      let itemTva = 0;

      if (tvaRate && tvaRate > 0) {
        itemTva = itemAmount * (tvaRate / 100);
        totalTva += itemTva;
      }

      if (item.timbre_exempt !== true) {
        totalForTimbre += itemAmount + itemTva;
      }
    });

    let newTimbre = 0;
    if (currentPaymentMode === "Espèces" && totalForTimbre > 0) {
      const amount = totalForTimbre;
      let rate = 0.01;
      if (amount > 100000) {
        rate = 0.02;
      } else if (amount > 30000) {
        rate = 0.015;
      }
      newTimbre = amount * rate;
      if (newTimbre < 5) newTimbre = 5;
      if (newTimbre > 20000) newTimbre = 20000;
    }

    const netHt = newSubtotal - finalDiscountAmount;
    const withholdingAmount = currentWithholdingRate > 0 ? netHt * (currentWithholdingRate / 100) : 0;
    const total = netHt + totalTva + newTimbre;
    const netTotal = total - withholdingAmount;

    return {
      subtotal_ht: newSubtotal,
      tva_amount: totalTva,
      timbre: newTimbre,
      total_ttc: total,
      discount_rate: finalDiscountRate,
      discount_amount: finalDiscountAmount,
      discount_value: type === 'percent' ? finalDiscountRate : finalDiscountAmount,
      discount: finalDiscountAmount,
      discount_type: type,
      balance_due: total,
      amount_paid: 0,
      payment_method: currentPaymentMode,
      withholding_rate: currentWithholdingRate,
      withholding_amount: withholdingAmount,
      net_total: netTotal,
    };
  };

  const handlePaymentModeChange = (newMode: string) => {
    setPaymentMode(newMode);
    const newTotals = recalculateTotals(items, newMode, discountRate, invoice.discount_amount || 0, discountType, invoice.withholding_rate || 0);
    onInvoiceChange({ ...invoice, payment_method: newMode, ...newTotals });
  };

  const handleDiscountRateChange = (newRate: number) => {
    setDiscountRate(newRate);
    const newTotals = recalculateTotals(items, paymentMode, newRate, 0, 'percent', invoice.withholding_rate || 0);
    onInvoiceChange({ ...invoice, ...newTotals });
  };

  const handleDiscountAmountChange = (newAmount: number) => {
    const newTotals = recalculateTotals(items, paymentMode, 0, newAmount, 'amount', invoice.withholding_rate || 0);
    onInvoiceChange({ ...invoice, ...newTotals });
  };

  const handleItemUpdate = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    const newTotals = recalculateTotals(newItems, paymentMode, discountRate, invoice.discount_amount || 0, discountType, invoice.withholding_rate || 0);
    onInvoiceChange({ ...invoice, invoice_items: newItems, ...newTotals });
  };

  const handleAddProduct = (product: any, index: number) => {
    const newItems = [...items];
    newItems.splice(index + 1, 0, {
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      unit_price: product.unit_price || 0,
      tva_rate: product.tva_rate !== undefined ? product.tva_rate : 19,
      timbre_exempt: product.timbre_exempt || false,
      products: product
    });
    const newTotals = recalculateTotals(newItems, paymentMode, discountRate, invoice.discount_amount || 0, discountType, invoice.withholding_rate || 0);
    onInvoiceChange({ ...invoice, invoice_items: newItems, ...newTotals });
    setOpenPopoverIndex(null);
  };

  const handleDeleteItem = (index: number) => {
    const newItems = items.filter((_: any, i: number) => i !== index);
    const newTotals = recalculateTotals(newItems, paymentMode, discountRate, invoice.discount_amount || 0, discountType, invoice.withholding_rate || 0);
    onInvoiceChange({ ...invoice, invoice_items: newItems, ...newTotals });
  };

  const isCreditNote = invoice.invoice_type === "credit_note";
  const isProforma = invoice.invoice_type === "proforma";

  const pages = chunkItems(items);
  const subtotal = invoice.subtotal_ht || 0;
  const tvaAmount = invoice.tva_amount || 0;
  const timbre = invoice.timbre || 0;
  const discountAmount = invoice.discount || invoice.discount_amount || 0;
  const total = invoice.total_ttc || (subtotal + tvaAmount + timbre - discountAmount);
  const netTotal = invoice.balance_due || total;

  return {
    paymentMode,
    discountRate,
    discountType,
    setDiscountType,
    openPopoverIndex,
    setOpenPopoverIndex,
    openClientCombo,
    setOpenClientCombo,
    items,
    pages,
    subtotal,
    tvaAmount,
    timbre,
    discountAmount,
    total,
    netTotal,
    isCreditNote,
    isProforma,
    formatCurrency,
    updateInvoiceField,
    updateClient,
    handlePaymentModeChange,
    handleDiscountRateChange,
    handleDiscountAmountChange,
    handleItemUpdate,
    handleAddProduct,
    handleDeleteItem,
  };
}

export type EditableInvoiceLogic = ReturnType<typeof useEditableInvoiceLogic>;
