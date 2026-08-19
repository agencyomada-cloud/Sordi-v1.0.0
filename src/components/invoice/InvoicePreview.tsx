import { useSettings } from "@/hooks/useSettings";
import { resolveInvoiceHtmlTheme } from "./invoiceHtmlShared";
import { InvoiceReadOnlyStructure } from "./InvoiceReadOnlyStructure";
import { InvoiceReadOnlyEpure } from "./InvoiceReadOnlyEpure";
import { InvoiceReadOnlyModerne } from "./InvoiceReadOnlyModerne";

interface InvoicePreviewProps {
  invoice: any;
}

/** Picks the read-only renderer matching the theme chosen in Settings. */
export function InvoicePreview({ invoice }: InvoicePreviewProps) {
  const { data: settings } = useSettings();
  const theme = resolveInvoiceHtmlTheme(settings);

  if (theme === 'epure') return <InvoiceReadOnlyEpure invoice={invoice} settings={settings} />;
  if (theme === 'moderne') return <InvoiceReadOnlyModerne invoice={invoice} settings={settings} />;
  return <InvoiceReadOnlyStructure invoice={invoice} settings={settings} />;
}
