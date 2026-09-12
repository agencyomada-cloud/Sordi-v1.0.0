import { useEffect, useRef, useState } from "react";
import { ScaleToFitContainerContext } from "./scaleToFitContext";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { resolveInvoiceHtmlTheme } from "./invoiceHtmlShared";
import { useEditableInvoiceLogic } from "./useEditableInvoiceLogic";
import { EditableInvoiceStructure } from "./EditableInvoiceStructure";
import { EditableInvoiceEpure } from "./EditableInvoiceEpure";
import { EditableInvoiceModerne } from "./EditableInvoiceModerne";

const DEFAULT_STAMP_SIZE = 140;

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
export function ScaleToFit({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

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

  // Published once the scaled node exists, so descendants (via
  // useScaleToFitContainer) can portal popovers into it instead of body.
  useEffect(() => {
    setContainer(innerRef.current);
  }, []);

  return (
    // This owns the actual scroll region and horizontal centering for the
    // whole canvas — NewInvoice.tsx's own wrapper around
    // <EditableInvoicePreview> stays a plain, non-scrolling flex host.
    // `overflow-x-hidden` here is a deliberate backstop, not the fix itself:
    // the real fix is that nothing inside is allowed to force this box
    // wider than its parent in the first place.
    // pb-32: safe clearance below the document so scrolling to its bottom
    // (legal text, stamp, totals) never ends up underneath the floating
    // action dock — that dock is `fixed` over this scroll container, not
    // inside it, so only extra bottom padding here (not anything on
    // NewInvoice.tsx's non-scrolling wrapper one level up) actually gives
    // the user room to scroll past it.
    <div ref={outerRef} className="w-full h-full overflow-y-auto overflow-x-hidden flex justify-center pt-6 pb-32">
      <div
        style={{
          margin: "0 auto",
          width: naturalSize.width * scale || undefined,
          height: naturalSize.height * scale || undefined,
        }}
      >
        <div
          ref={innerRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top center",
            width: naturalSize.width || "max-content",
          }}
        >
          <ScaleToFitContainerContext.Provider value={container}>
            {children}
          </ScaleToFitContainerContext.Provider>
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
  const updateSettings = useUpdateSettings();
  const theme = resolveInvoiceHtmlTheme(settings);
  const logic = useEditableInvoiceLogic(invoice, onInvoiceChange);

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
    if (onInvoiceChange && invoice) {
      onInvoiceChange({ ...invoice, stamp_size: v });
    }
  };

  const handleStampSizeCommit = (v: number) => {
    updateSettings.mutate({ stamp_size: String(Math.round(v)) });
    if (onInvoiceChange && invoice) {
      onInvoiceChange({ ...invoice, stamp_size: v });
    }
  };

  const props = {
    invoice,
    onInvoiceChange,
    clients,
    products,
    settings,
    logic,
    stampSize,
    onStampSizeChange: handleStampSizeChange,
    onStampSizeCommit: handleStampSizeCommit,
  };

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
