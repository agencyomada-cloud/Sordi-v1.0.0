import { useSettings } from "@/hooks/useSettings";
import { resolveInvoiceHtmlTheme } from "./invoiceHtmlShared";
import { InvoiceReadOnlyStructure } from "./InvoiceReadOnlyStructure";
import { InvoiceReadOnlyEpure } from "./InvoiceReadOnlyEpure";
import { InvoiceReadOnlyModerne } from "./InvoiceReadOnlyModerne";

interface InvoicePrintViewProps {
  invoice: any;
}

/** Same read-only renderers as InvoicePreview — the browser print dialog
 * should print exactly what's shown on screen, including the chosen theme. */
export function InvoicePrintView({ invoice }: InvoicePrintViewProps) {
  const { data: settings } = useSettings();
  const theme = resolveInvoiceHtmlTheme(settings);

  if (theme === 'epure') return <InvoiceReadOnlyEpure invoice={invoice} settings={settings} />;
  if (theme === 'moderne') return <InvoiceReadOnlyModerne invoice={invoice} settings={settings} />;
  return <InvoiceReadOnlyStructure invoice={invoice} settings={settings} />;
}
