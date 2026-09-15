import InvoicesPage from "./Invoices";

// The Devis (quote) list is Invoices.tsx itself, configured for the
// "quote" document type — same table, filters, bulk actions and CTA
// plumbing, differing only in which document type it queries/creates.
// Mirrors Proformas.tsx/Avoirs.tsx exactly. Strict route isolation: this
// route only ever shows/creates quotes, never a mixed list.
export default function DevisPage() {
  return <InvoicesPage documentType="quote" />;
}
