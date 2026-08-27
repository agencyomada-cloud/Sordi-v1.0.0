import type { ReactNode } from "react";
import { RiCloseLine as X } from "@remixicon/react";
import { Button } from "@sordi/ui";

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  children: ReactNode;
}

/** Slide-down bar shown above a list's table once rows are selected —
 *  shared shell across Invoices/Deliveries/Orders; each page supplies its
 *  own batch-action buttons as children. */
export function BulkActionBar({ count, onClear, children }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="mb-4 animate-fade-in-down">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 shadow-card">
        <div className="flex items-center gap-2">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
            {count}
          </span>
          <span className="text-sm font-medium text-foreground">
            élément{count > 1 ? "s" : ""} sélectionné{count > 1 ? "s" : ""}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onClear}
          >
            <X className="w-3.5 h-3.5" />
            Désélectionner tout
          </Button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
