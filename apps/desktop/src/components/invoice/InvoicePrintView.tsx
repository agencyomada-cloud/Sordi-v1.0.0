import { useSettings } from "@/hooks/useSettings";
import { InvoiceReadOnlyStructure } from "./InvoiceReadOnlyStructure";
import { InvoiceReadOnlyEpure } from "./InvoiceReadOnlyEpure";
import { InvoiceReadOnlyModerne } from "./InvoiceReadOnlyModerne";
import { resolveInvoiceAppearance } from "@/components/pdf/invoiceAppearance";

interface InvoicePrintViewProps {
  invoice: any;
}

/** Same read-only renderers as InvoicePreview — the browser print dialog
 * should print exactly what's shown on screen, including the chosen theme.
 * Goes through the same resolveInvoiceAppearance() single source of truth
 * InvoicePreview.tsx and the PDF export pipeline use, rather than deriving
 * the theme independently — that split previously left `appearance` itself
 * unset here, crashing InvoiceReadOnlyStructure's `appearance.primaryColor`
 * read on every print-view render. */
export function InvoicePrintView({ invoice }: InvoicePrintViewProps) {
  const { data: settings } = useSettings();
  const appearance = resolveInvoiceAppearance(invoice, settings);

  if (appearance.theme === 'epure') return <InvoiceReadOnlyEpure invoice={invoice} settings={settings} appearance={appearance} />;
  if (appearance.theme === 'moderne') return <InvoiceReadOnlyModerne invoice={invoice} settings={settings} appearance={appearance} />;
  return <InvoiceReadOnlyStructure invoice={invoice} settings={settings} appearance={appearance} />;
}
