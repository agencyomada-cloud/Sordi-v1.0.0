import { useEffect, useState } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { InvoiceReadOnlyStructure } from "./InvoiceReadOnlyStructure";
import { InvoiceReadOnlyEpure } from "./InvoiceReadOnlyEpure";
import { InvoiceReadOnlyModerne } from "./InvoiceReadOnlyModerne";
import { resolveInvoiceAppearance } from "@/components/pdf/invoiceAppearance";

interface InvoicePreviewProps {
  invoice: any;
}

const DEFAULT_STAMP_SIZE = 140;

export function InvoicePreview({ invoice }: InvoicePreviewProps) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  // Single source of truth for theme/color/font/logo sizing — the same
  // resolver the PDF export pipeline (pdfGenerator.ts) and its
  // console.log('🚀 [PDF_EXPORT_PAYLOAD]', ...) diagnostic already go
  // through, so this read-only canvas can never drift from what "Télécharger
  // PDF" actually produces.
  const appearance = resolveInvoiceAppearance(invoice, settings);
  const theme = appearance.theme;

  const [stampSize, setStampSize] = useState(() => {
    return Number(invoice?.stamp_size || settings?.stamp_size || DEFAULT_STAMP_SIZE);
  });
  const [hasLocalOverride, setHasLocalOverride] = useState(false);

  useEffect(() => {
    if (!hasLocalOverride) {
      if (invoice?.stamp_size) {
        setStampSize(Number(invoice.stamp_size));
      } else if (settings?.stamp_size) {
        setStampSize(Number(settings.stamp_size));
      }
    }
  }, [invoice?.stamp_size, settings?.stamp_size, hasLocalOverride]);

  const handleStampSizeChange = (v: number) => {
    setStampSize(v);
    setHasLocalOverride(true);
  };

  const handleStampSizeCommit = (value: number) => {
    updateSettings.mutate({ stamp_size: String(Math.round(value)) });
  };

  const props = {
    invoice,
    settings,
    appearance,
    stampSize,
    onStampSizeChange: handleStampSizeChange,
    onStampSizeCommit: handleStampSizeCommit,
  };

  return (
    <div>
      {theme === "epure" ? (
        <InvoiceReadOnlyEpure {...props} />
      ) : theme === "moderne" ? (
        <InvoiceReadOnlyModerne {...props} />
      ) : (
        <InvoiceReadOnlyStructure {...props} />
      )}
    </div>
  );
}
