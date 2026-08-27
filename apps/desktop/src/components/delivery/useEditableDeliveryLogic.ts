import { useState } from "react";
import { chunkItems } from "@/lib/paginationUtils";

/**
 * All the state and calculation logic behind the delivery note editable
 * preview — shared by the three theme presentations, same split as
 * useEditableInvoiceLogic/useEditableOrderLogic. Not the invoice logic hook:
 * delivery notes carry driver_name/truck_plate/delivery_location/reserves,
 * none of which exist on the invoice data shape.
 */
export function useEditableDeliveryLogic(deliveryNote: any, onDeliveryChange: (deliveryNote: any) => void, clients?: any[]) {
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

  const updateDeliveryField = (field: string, value: any) => {
    onDeliveryChange({ ...deliveryNote, [field]: value });
  };

  const updateClient = (clientId: string) => {
    updateDeliveryField('client_id', clientId);
  };

  const items = deliveryNote.items || [];

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...items];
    if (updatedItems[index]) {
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      updateDeliveryField('items', updatedItems);
    }
  };

  const removeItem = (index: number) => {
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    updateDeliveryField('items', updatedItems);
  };

  const handleAddProduct = (product: any, index: number) => {
    const newItems = [...items];
    const newItem = {
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      quantity: 1,
      unit_price: product.unit_price || 0,
      tva_rate: product.tva_rate !== undefined ? product.tva_rate : 19,
      product_description: product.description,
      products: product,
    };
    if (index >= 0) {
      newItems.splice(index + 1, 0, newItem);
    } else {
      newItems.push(newItem);
    }
    updateDeliveryField('items', newItems);
    setOpenPopoverIndex(null);
  };

  const handleAddCustomItem = (name: string, index: number) => {
    const newItems = [...items];
    const newItem = {
      product_name: name,
      quantity: 1,
      unit_price: 0,
      tva_rate: 19,
    };
    if (index >= 0) {
      newItems.splice(index + 1, 0, newItem);
    } else {
      newItems.push(newItem);
    }
    updateDeliveryField('items', newItems);
    setOpenPopoverIndex(null);
  };

  // clients prop when editing, embedded deliveryNote.clients when read-only.
  const client = clients?.find((c) => c.id === deliveryNote.client_id) || deliveryNote.clients;
  const pages = chunkItems(items);

  const calculateTotals = () => {
    let subtotal = 0;
    let totalTva = 0;
    items.forEach((item: any) => {
      const amount = (item.quantity || 0) * (item.unit_price || 0);
      subtotal += amount;
      const tvaRate = item.tva_rate === undefined ? 19.0 : item.tva_rate;
      if (tvaRate && tvaRate > 0) {
        totalTva += amount * (tvaRate / 100);
      }
    });
    return { subtotal, tva: totalTva, total: subtotal + totalTva };
  };

  const totals = calculateTotals();

  return {
    items,
    pages,
    client,
    totals,
    openPopoverIndex,
    setOpenPopoverIndex,
    openClientCombo,
    setOpenClientCombo,
    formatCurrency,
    updateDeliveryField,
    updateClient,
    updateItem,
    removeItem,
    handleAddProduct,
    handleAddCustomItem,
  };
}

export type EditableDeliveryLogic = ReturnType<typeof useEditableDeliveryLogic>;
