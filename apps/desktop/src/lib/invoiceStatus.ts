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
};

const FALLBACK_STATUS_CONFIG = { label: "Statut inconnu", variant: "neutral" as StatusBadgeTone };

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
