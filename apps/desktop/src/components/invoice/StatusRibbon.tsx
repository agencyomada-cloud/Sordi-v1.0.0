import {
  RiCheckLine as Check,
  RiArrowRightSLine as ChevronRight,
} from "@remixicon/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@sordi/ui";
import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/hooks/useInvoices";

const STEPS: { status: InvoiceStatus; label: string }[] = [
  { status: "draft", label: "Brouillon" },
  { status: "issued", label: "Émise" },
  { status: "paid", label: "Payée" },
];

// Statuses that read as "still at the Émise step" for ribbon purposes —
// partial/overdue are both "issued, not yet fully settled" variants, not
// distinct pipeline stages of their own.
const ISSUED_LIKE: InvoiceStatus[] = ["issued", "partial", "overdue"];

function stepIndexFor(status: string): number {
  if (status === "paid" || status === "converted") return 2;
  if (ISSUED_LIKE.includes(status as InvoiceStatus)) return 1;
  return 0; // draft
}

export interface StatusRibbonProps {
  status: string;
  /** Real invoices/credit notes carry an official sequential number from
   *  creation, so reverting to "draft" is rejected — mirrors the same rule
   *  already enforced server-side (update_invoice_status, commands.rs) and
   *  in the status dropdowns on Invoices.tsx / this page's toolbar. */
  draftDisabled?: boolean;
  onSelect: (status: InvoiceStatus) => void;
  className?: string;
}

/**
 * Odoo-style lifecycle breadcrumb — Brouillon → Émise → Payée, each step
 * clickable to jump the invoice straight to that status. "Annulée" isn't a
 * step on this pipeline (it's a terminal, off-ramp state), so it replaces
 * the whole ribbon with a single destructive badge instead of trying to
 * fit a 4th step into a 3-step visual metaphor.
 */
export function StatusRibbon({ status, draftDisabled, onSelect, className }: StatusRibbonProps) {
  if (status === "cancelled") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide shrink-0",
              "bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
              "hover:opacity-80 transition-opacity",
              className
            )}
          >
            Annulée
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onSelect("issued")}>Réactiver (Émise)</DropdownMenuItem>
          <DropdownMenuItem
            disabled={draftDisabled}
            title={draftDisabled ? "Ce document porte un numéro séquentiel officiel et ne peut pas être remis en brouillon" : undefined}
            onClick={() => onSelect("draft")}
          >
            Brouillon
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const activeIndex = stepIndexFor(status);

  return (
    <div className={cn("inline-flex items-center gap-0.5 shrink-0", className)}>
      {STEPS.map((step, i) => {
        const isDone = i < activeIndex;
        const isActive = i === activeIndex;
        const isFuture = i > activeIndex;
        const disabled = step.status === "draft" && draftDisabled;

        return (
          <div key={step.status} className="flex items-center gap-0.5 shrink-0">
            {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
            <button
              type="button"
              disabled={disabled}
              title={disabled ? "Ce document porte un numéro séquentiel officiel et ne peut pas être remis en brouillon" : undefined}
              onClick={() => onSelect(step.status)}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide transition-colors shrink-0 whitespace-nowrap",
                disabled && "opacity-40 cursor-not-allowed",
                !disabled && "cursor-pointer",
                isActive && "bg-primary text-primary-foreground",
                isDone && "bg-muted text-muted-foreground hover:bg-muted/80",
                isFuture && "border border-border text-muted-foreground/70 hover:border-primary/40 hover:text-foreground"
              )}
            >
              {isDone && <Check className="w-2.5 h-2.5 shrink-0" />}
              {step.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
