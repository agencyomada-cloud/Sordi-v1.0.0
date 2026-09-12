import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./lib/utils";

const buttonVariants = cva(
  // Desktop-compact density: text-xs (was text-sm) at a fixed control
  // height instead of the web-default py-driven sizing.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs font-medium ring-offset-background transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Clean/minimal direction: solid fills carry no shadow at all —
        // depth-via-border doesn't apply to a filled control the way it
        // does to a card/panel, so these just lean on the color change.
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-card hover:bg-secondary hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // rounded-md (var(--radius), 6px), not rounded-full — a desktop
      // control reads as a button via its border/fill, not a pill shape.
      // h-8 is the standard desktop action-button height across all sizes;
      // sm/lg only vary the horizontal padding, not the height, other than
      // a small step down/up for genuinely dense or prominent contexts.
      size: {
        default: "h-8 px-2.5 rounded-md",
        sm: "h-7 rounded-md px-2",
        lg: "h-9 rounded-md px-4",
        icon: "h-8 w-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
