import type { InvoiceStatus } from "@/hooks/useInvoices";
import type { StatusBadgeTone } from "@sordi/ui";

/**
 * Single source of truth for invoice status label/chip-tone, shared by
 * Invoices.tsx and InvoiceDetail.tsx — previously each hand-maintained its
 * own copy, which drifted (one included a non-existent "unpaid" status and
 * omitted the real "cancelled" one) and crashed the whole page on any
 * invoice whose status wasn't in the map. Keyed by the InvoiceStatus union
 * itself so TypeScript enforces every status has an entry.
 *
 * `tone` only drives the StatusBadge's 5px micro-dot color — the pill
 * itself is the same neutral treatment for every status (Crimson/Coral Red
 * rebrand's "Status Chips" spec).
 */
export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; variant: StatusBadgeTone }> = {
  draft: { label: "Brouillon", variant: "neutral" },
  issued: { label: "Émise", variant: "neutral" },
  paid: { label: "Payée", variant: "success" },
  partial: { label: "Partielle", variant: "warning" },
  overdue: { label: "En retard", variant: "error" },
  cancelled: { label: "Annulée", variant: "neutral" },
  converted: { label: "Convertie", variant: "info" },
};

const FALLBACK_STATUS_CONFIG = { label: "Statut inconnu", variant: "neutral" as StatusBadgeTone };

/**
 * Tinted status-pill treatment for the Invoices and Payments *tables*
 * specifically — a full colored capsule (background + border), matching the
 * same tinted-pill classes `@sordi/ui`'s `StatusBadge` now uses everywhere
 * else in the app.
 */
export const INVOICE_STATUS_PILL_CLASSES: Record<StatusBadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  warning: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  error: "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
  neutral: "bg-slate-100 text-slate-700 border-slate-200/60 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  info: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
};

export const INVOICE_STATUS_DOT_CLASSES: Record<StatusBadgeTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  neutral: "bg-slate-400",
  info: "bg-blue-500",
};

/** Compose the full pill className (border + tinted background/text for the
 *  given tone) — pair with a `<span className={cn("h-1.5 w-1.5 rounded-full
 *  shrink-0", INVOICE_STATUS_DOT_CLASSES[tone])} />` dot as the first child. */
export const INVOICE_STATUS_PILL_BASE = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border";

// "unpaid" isn't a real InvoiceStatus value, but some seed/legacy invoice
// records carry it anyway — treat it as a synonym for "issued" (sent,
// awaiting payment) rather than showing a bare "Statut inconnu" for what's
// otherwise an ordinary state.
const LEGACY_STATUS_ALIASES: Record<string, InvoiceStatus> = {
  unpaid: "issued",
};

/** Safe lookup — falls back instead of throwing for any status value that
 *  isn't in the map (legacy data, a future status this map hasn't caught up
 *  with yet), unlike indexing INVOICE_STATUS_CONFIG directly. */
export function getInvoiceStatusConfig(status: string | null | undefined) {
  const key = (status || "draft") as string;
  const resolved = LEGACY_STATUS_ALIASES[key] || (key as InvoiceStatus);
  return INVOICE_STATUS_CONFIG[resolved] ?? FALLBACK_STATUS_CONFIG;
}
