import { useSettings } from "@/hooks/useSettings";
import { ScaleToFit } from "@/components/invoice/EditableInvoicePreview";
import { useEditableDeliveryLogic } from "./useEditableDeliveryLogic";
import { DeliveryEditableStructure } from "./DeliveryEditableStructure";

interface DeliveryEditablePreviewProps {
  deliveryNote: any;
  onDeliveryChange: (deliveryNote: any) => void;
  clients?: any[];
  products?: any[];
  readOnly?: boolean;
}

/**
 * Delivery notes have exactly one layout — DeliveryNotePDFDocument.tsx isn't
 * themed (unlike invoices), so this doesn't branch on the user's invoice
 * theme setting either. That branching used to point at three
 * independently-drifting copies (epure/moderne have been removed); one
 * template in, one template out keeps the live preview and the exported PDF
 * from ever disagreeing again.
 */
export function DeliveryEditablePreview({ deliveryNote, onDeliveryChange, clients, products, readOnly = false }: DeliveryEditablePreviewProps) {
  const { data: settings } = useSettings();
  const logic = useEditableDeliveryLogic(deliveryNote, onDeliveryChange, clients);

  return (
    <ScaleToFit>
      <DeliveryEditableStructure
        deliveryNote={deliveryNote}
        onDeliveryChange={onDeliveryChange}
        clients={clients}
        products={products}
        settings={settings}
        logic={logic}
        readOnly={readOnly}
      />
    </ScaleToFit>
  );
}
