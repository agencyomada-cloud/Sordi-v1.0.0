import { useSettings } from "@/hooks/useSettings";
import { resolveInvoiceHtmlTheme } from "./invoiceHtmlShared";
import { useEditableInvoiceLogic } from "./useEditableInvoiceLogic";
import { EditableInvoiceStructure } from "./EditableInvoiceStructure";
import { EditableInvoiceEpure } from "./EditableInvoiceEpure";
import { EditableInvoiceModerne } from "./EditableInvoiceModerne";

interface EditableInvoicePreviewProps {
  invoice: any;
  onInvoiceChange: (invoice: any) => void;
  clients?: any[];
  products?: any[];
}

/**
 * Picks the editable theme renderer matching Settings' chosen PDF theme.
 * All the totals/discount/timbre logic lives once in useEditableInvoiceLogic
 * — the three renderers only differ in presentation.
 */
export function EditableInvoicePreview({ invoice, onInvoiceChange, clients, products }: EditableInvoicePreviewProps) {
  const { data: settings } = useSettings();
  const theme = resolveInvoiceHtmlTheme(settings);
  const logic = useEditableInvoiceLogic(invoice, onInvoiceChange);

  const props = { invoice, onInvoiceChange, clients, products, settings, logic };

  if (theme === 'epure') return <EditableInvoiceEpure {...props} />;
  if (theme === 'moderne') return <EditableInvoiceModerne {...props} />;
  return <EditableInvoiceStructure {...props} />;
}
