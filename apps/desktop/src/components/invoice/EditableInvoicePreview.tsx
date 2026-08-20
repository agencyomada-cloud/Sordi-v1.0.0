import { useEffect, useRef, useState } from "react";
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
 * The invoice page itself is a fixed 210mm-wide (~794px) A4 sheet — that's
 * deliberate (matches what actually prints/exports), not something to make
 * fluid. But at this app's own minimum window size (1024px, minus the
 * sidebar and page padding), the available space can be narrower than
 * 794px, which without this wrapper meant the document just overflowed its
 * container (only a scrollbar away from usable, which read as "not
 * responsive at all"). This scales the whole rendered document down
 * visually to fit — the DOM underneath is still the true A4 size, so
 * editing/print/export accuracy is untouched, it's a zoom level, not a
 * layout change.
 */
function ScaleToFit({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const recompute = () => {
      const naturalWidth = inner.scrollWidth;
      const naturalHeight = inner.scrollHeight;
      if (naturalWidth === 0) return;
      setNaturalSize((prev) =>
        prev.width === naturalWidth && prev.height === naturalHeight ? prev : { width: naturalWidth, height: naturalHeight }
      );
      const availableWidth = outer.clientWidth;
      setScale(Math.min(1, availableWidth / naturalWidth));
    };

    recompute();
    // Two observers: the outer tracks the window/container being resized,
    // the inner tracks the document's own size changing (adding a line
    // item can push it onto a second A4 page, changing its height).
    const resizeObserver = new ResizeObserver(recompute);
    resizeObserver.observe(outer);
    resizeObserver.observe(inner);
    return () => resizeObserver.disconnect();
  }, [children]);

  return (
    <div ref={outerRef} className="w-full">
      <div
        className="mx-auto"
        style={{ width: naturalSize.width * scale || undefined, height: naturalSize.height * scale || undefined }}
      >
        <div
          ref={innerRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: naturalSize.width || "max-content",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
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

  return (
    <ScaleToFit>
      {theme === "epure" ? (
        <EditableInvoiceEpure {...props} />
      ) : theme === "moderne" ? (
        <EditableInvoiceModerne {...props} />
      ) : (
        <EditableInvoiceStructure {...props} />
      )}
    </ScaleToFit>
  );
}
