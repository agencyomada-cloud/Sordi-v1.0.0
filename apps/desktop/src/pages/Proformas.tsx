import InvoicesPage from "./Invoices";

// The Factures Proforma list is Invoices.tsx itself, configured for the
// "proforma" document type — same table, filters, bulk actions and CTA
// plumbing, differing only in which document type it queries/creates.
// Mirrors Devis.tsx/Avoirs.tsx exactly. Strict route isolation: this route
// only ever shows/creates proformas, never a mixed list.
export default function ProformasPage() {
  return <InvoicesPage documentType="proforma" />;
}
