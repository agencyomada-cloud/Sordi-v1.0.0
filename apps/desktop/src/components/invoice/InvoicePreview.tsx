import { useEffect, useState } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { resolveInvoiceHtmlTheme } from "./invoiceHtmlShared";
import { InvoiceReadOnlyStructure } from "./InvoiceReadOnlyStructure";
import { InvoiceReadOnlyEpure } from "./InvoiceReadOnlyEpure";
import { InvoiceReadOnlyModerne } from "./InvoiceReadOnlyModerne";

interface InvoicePreviewProps {
  invoice: any;
}

const DEFAULT_STAMP_SIZE = 140;

export function InvoicePreview({ invoice }: InvoicePreviewProps) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const theme = resolveInvoiceHtmlTheme(settings);

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
