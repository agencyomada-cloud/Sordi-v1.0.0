import NewInvoicePage from "./NewInvoice";

// The proforma creation page is NewInvoice.tsx itself, configured for the
// "proforma" document type — same form, same live preview, same Reset/PDF/
// submit controls, differing only in document title, numbering sequence and
// where it saves to. Editing an existing proforma already goes through
// /invoices/:id/edit (NewInvoice.tsx directly), which derives its type from
// the loaded document, so this wrapper only needs to cover creation.
export default function NewProformaPage() {
  return <NewInvoicePage documentType="proforma" />;
}
