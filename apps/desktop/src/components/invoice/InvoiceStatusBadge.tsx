import { cn } from "@/lib/utils";
import { getInvoiceStatusConfig, INVOICE_STATUS_PILL_CLASSES, INVOICE_STATUS_DOT_CLASSES } from "@/lib/invoiceStatus";

/**
 * Odoo-style corner status indicator for the interactive invoice editor
 * canvas only — never rendered by the PDF templates (InvoicePDFDocument /
 * InvoiceTemplateEpure / InvoiceTemplateModerne all live in a completely
 * separate react-pdf tree that this component is never imported into), so
 * it can't pollute an exported PDF. It IS reused, via InvoiceReadOnly*, by
 * InvoicePrintView's browser-print path though — `print:hidden` keeps it
 * out of that one, since a UI-only affordance has no business on a printed
 * page either.
 *
 * Reuses `getInvoiceStatusConfig`/`INVOICE_STATUS_PILL_CLASSES` — the same
 * single source of truth already driving status pills on the Invoices list
 * and Payments pages — rather than a second, slightly different color
 * mapping living only here.
 */
export function InvoiceStatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const { label, variant } = getInvoiceStatusConfig(status);
  return (
    <div
      className={cn(
        "absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide border shadow-sm select-none pointer-events-none print:hidden",
        INVOICE_STATUS_PILL_CLASSES[variant],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", INVOICE_STATUS_DOT_CLASSES[variant])} />
      {label}
    </div>
  );
}
