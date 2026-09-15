import InvoicesPage from "./Invoices";

// The Avoirs (credit notes) list is Invoices.tsx itself, configured for
// the "credit_note" document type — same table, filters, bulk actions and
// CTA plumbing, differing only in which document type it queries/creates.
// Mirrors Devis.tsx/Proformas.tsx exactly. Strict route isolation: this
// route only ever shows/creates credit notes, never a mixed list.
export default function AvoirsPage() {
  return <InvoicesPage documentType="credit_note" />;
}
