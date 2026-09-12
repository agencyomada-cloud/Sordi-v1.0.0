import { createContext, useContext } from "react";

// Any Popover/dropdown triggered from inside the scaled invoice document
// (the client picker, the line-item product search…) must portal its
// content back into the ScaleToFit wrapper's transformed element instead of
// the default document.body — see the `container` prop doc comment on
// packages/ui's PopoverContent for why. `null` until ScaleToFit's first
// render commits that DOM node.
//
// Split into its own module (rather than living in EditableInvoicePreview.tsx
// alongside the ScaleToFit component that publishes it) so the three
// EditableInvoice* template components — which ScaleToFit itself renders as
// children — can import the consumer hook without an import cycle back
// through EditableInvoicePreview.tsx.
export const ScaleToFitContainerContext = createContext<HTMLDivElement | null>(null);

export function useScaleToFitContainer() {
  return useContext(ScaleToFitContainerContext);
}
