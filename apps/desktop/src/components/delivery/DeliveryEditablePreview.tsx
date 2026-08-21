import { useSettings } from "@/hooks/useSettings";
import { resolveInvoiceHtmlTheme } from "@/components/invoice/invoiceHtmlShared";
import { ScaleToFit } from "@/components/invoice/EditableInvoicePreview";
import { useEditableDeliveryLogic } from "./useEditableDeliveryLogic";
import { DeliveryEditableStructure } from "./DeliveryEditableStructure";
import { DeliveryEditableEpure } from "./DeliveryEditableEpure";
import { DeliveryEditableModerne } from "./DeliveryEditableModerne";

interface DeliveryEditablePreviewProps {
  deliveryNote: any;
  onDeliveryChange: (deliveryNote: any) => void;
  clients?: any[];
  products?: any[];
  readOnly?: boolean;
}

/**
 * Picks the editable theme renderer matching Settings' chosen PDF theme —
 * same pattern as EditableInvoicePreview/OrderEditablePreview. Kept as its
 * own component because delivery notes carry driver_name/truck_plate/
 * delivery_location/reserves, none of which exist on the invoice data
 * shape. All the totals/item logic lives once in useEditableDeliveryLogic;
 * the three renderers only differ in presentation.
 */
export function DeliveryEditablePreview({ deliveryNote, onDeliveryChange, clients, products, readOnly = false }: DeliveryEditablePreviewProps) {
  const { data: settings } = useSettings();
  const theme = resolveInvoiceHtmlTheme(settings);
  const logic = useEditableDeliveryLogic(deliveryNote, onDeliveryChange, clients);

  const props = { deliveryNote, onDeliveryChange, clients, products, settings, logic, readOnly };

  return (
    <ScaleToFit>
      {theme === "epure" ? (
        <DeliveryEditableEpure {...props} />
      ) : theme === "moderne" ? (
        <DeliveryEditableModerne {...props} />
      ) : (
        <DeliveryEditableStructure {...props} />
      )}
    </ScaleToFit>
  );
}
