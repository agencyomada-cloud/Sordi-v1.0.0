import { useState } from "react";
import { chunkItems } from "@/lib/paginationUtils";

/**
 * All the state and calculation logic behind the order editable preview —
 * shared by the three theme presentations (Structuré/Épuré/Moderne), same
 * split as useEditableInvoiceLogic. Deliberately NOT the invoice logic hook:
 * order items are free-typed (no product-catalog requirement — you're often
 * ordering from a supplier whose products aren't in your own catalog), and
 * orders carry separate supplier_* fields with no invoice equivalent.
 */
export function useEditableOrderLogic(order: any, onOrderChange: (order: any) => void) {
  const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null);
  const [openClientCombo, setOpenClientCombo] = useState(false);

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "0,00 DA";
    const formatted = amount.toFixed(2).replace(/\./g, ',');
    const parts = formatted.split(',');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '00';
    const integerWithSpaces = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${integerWithSpaces},${decimalPart} DA`;
  };

  const updateOrderField = (field: string, value: any) => {
    onOrderChange({ ...order, [field]: value });
  };

  const updateClient = (clientId: string, clients?: any[]) => {
    const selectedClient = clients?.find((c) => c.id === clientId);
    if (selectedClient) {
      onOrderChange({
        ...order,
        client_id: clientId,
        supplier_name: selectedClient.name,
        supplier_address: selectedClient.address,
        supplier_rc: selectedClient.rc,
        supplier_nif: selectedClient.nif,
        supplier_nis: selectedClient.nis,
        supplier_ai: selectedClient.ai,
      });
    } else {
      updateOrderField('client_id', clientId);
    }
  };

  const recalculateTotals = (items: any[]) => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);
    let totalTva = 0;
    items.forEach((item: any) => {
      const itemAmount = (item.quantity || 0) * (item.unit_price || 0);
      const tvaRate = item.tva_rate === undefined ? 19.0 : item.tva_rate;
      if (tvaRate && tvaRate > 0) {
        totalTva += itemAmount * (tvaRate / 100);
      }
    });
    const total = subtotal + totalTva;
    return { subtotal, tvaAmount: totalTva, total };
  };

  const items = order.items || [];

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...items];
    if (updatedItems[index]) {
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      const totals = recalculateTotals(updatedItems);
      onOrderChange({ ...order, items: updatedItems, subtotal_ht: totals.subtotal, tva_amount: totals.tvaAmount, total_ttc: totals.total });
    }
  };

  const removeItem = (index: number) => {
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    const totals = recalculateTotals(updatedItems);
    onOrderChange({ ...order, items: updatedItems, subtotal_ht: totals.subtotal, tva_amount: totals.tvaAmount, total_ttc: totals.total });
  };

  const addItem = () => {
    const newItem = { id: crypto.randomUUID(), product_code: "", product_name: "", quantity: 1, unit_price: 0 };
    const updatedItems = [...items, newItem];
    const totals = recalculateTotals(updatedItems);
    onOrderChange({ ...order, items: updatedItems, subtotal_ht: totals.subtotal, tva_amount: totals.tvaAmount, total_ttc: totals.total });
  };

  const pages = chunkItems(items);

  return {
    items,
    pages,
    openPopoverIndex,
    setOpenPopoverIndex,
    openClientCombo,
    setOpenClientCombo,
    formatCurrency,
    updateOrderField,
    updateClient,
    updateItem,
    removeItem,
    addItem,
  };
}

export type EditableOrderLogic = ReturnType<typeof useEditableOrderLogic>;
