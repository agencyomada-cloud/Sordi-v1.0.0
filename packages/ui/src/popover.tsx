import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "./lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

interface PopoverContentProps extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> {
  /**
   * Portal target. Radix computes the floating position from the trigger's
   * `getBoundingClientRect()`, which is correct even under a scaled/
   * transformed ancestor — but portaling to the default `document.body`
   * escapes that ancestor's stacking/transform context entirely, and the
   * two coordinate spaces then disagree (the classic "popover jumps to the
   * top-left corner" bug for any trigger inside a `transform: scale(...)`
   * wrapper). Passing the SAME transformed element here as `container` — so
   * the popover renders back inside it — keeps trigger and content in one
   * consistent coordinate space. Omit for the normal (unscaled) case; it's
   * `undefined` by default, matching Radix's own default (`document.body`).
   */
  container?: HTMLElement | null;
}

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(({ className, align = "center", sideOffset = 4, container, ...props }, ref) => (
  <PopoverPrimitive.Portal container={container ?? undefined}>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-[0_10px_30px_-5px_rgba(0,0,0,0.08)] p-4 text-popover-foreground outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:border-border dark:bg-popover/90 dark:backdrop-blur-md dark:shadow-none",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
