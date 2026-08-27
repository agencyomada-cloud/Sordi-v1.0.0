import { useSettings } from "@/hooks/useSettings";
import { resolveInvoiceHtmlTheme } from "@/components/invoice/invoiceHtmlShared";
import { ScaleToFit } from "@/components/invoice/EditableInvoicePreview";
import { useEditableOrderLogic } from "./useEditableOrderLogic";
import { OrderEditableStructure } from "./OrderEditableStructure";
import { OrderEditableEpure } from "./OrderEditableEpure";
import { OrderEditableModerne } from "./OrderEditableModerne";

interface OrderEditablePreviewProps {
  order: any;
  onOrderChange: (order: any) => void;
  clients?: any[];
  products?: any[];
  readOnly?: boolean;
}

/**
 * Picks the editable theme renderer matching Settings' chosen PDF theme —
 * same pattern as EditableInvoicePreview, kept as its own component (not
 * folded into the invoice one) because orders have free-typed line items
 * and supplier_* fields with no invoice equivalent. All the totals/item
 * logic lives once in useEditableOrderLogic; the three renderers only
 * differ in presentation.
 */
export function OrderEditablePreview({ order, onOrderChange, clients, products, readOnly = false }: OrderEditablePreviewProps) {
  const { data: settings } = useSettings();
  const theme = resolveInvoiceHtmlTheme(settings);
  const logic = useEditableOrderLogic(order, onOrderChange);

  const props = { order, onOrderChange, clients, products, settings, logic, readOnly };

  return (
    <ScaleToFit>
      {theme === "epure" ? (
        <OrderEditableEpure {...props} />
      ) : theme === "moderne" ? (
        <OrderEditableModerne {...props} />
      ) : (
        <OrderEditableStructure {...props} />
      )}
    </ScaleToFit>
  );
}
