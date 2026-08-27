import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground border-border",
        // Sophisticated low-opacity alpha chips (Binance/Linear style) —
        // a tinted border, not just a tinted fill, is what keeps these
        // legible against both the white card surface and the tinted page.
        // Rose (not red) for unpaid/overdue — softer, less alarm-red than
        // the destructive variant above, which is reserved for delete/danger.
        success: "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-400",
        warning: "border-amber-500/20 bg-amber-500/[0.08] text-amber-600 dark:text-amber-400",
        error: "border-rose-500/20 bg-rose-500/[0.08] text-rose-600 dark:text-rose-400",
        draft: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
