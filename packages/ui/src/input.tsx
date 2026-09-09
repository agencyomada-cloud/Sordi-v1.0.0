import * as React from "react";

import { cn } from "./lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/10 focus-visible:border-blue-500 focus-visible:bg-white disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 dark:border-border/50 dark:bg-secondary/30 dark:text-foreground dark:placeholder:text-muted-foreground dark:focus-visible:bg-card",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
