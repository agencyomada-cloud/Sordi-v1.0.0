import NewInvoicePage from "./NewInvoice";

// The quote (devis) creation page is NewInvoice.tsx itself, configured for
// the "quote" document type — same form, same live preview, same Reset/PDF/
// submit controls, differing only in document title, numbering sequence
// (DEV-YYYY-NNN) and where it saves to. Editing an existing quote already
// goes through /invoices/:id/edit (NewInvoice.tsx directly), which derives
// its type from the loaded document, so this wrapper only needs to cover
// creation. Mirrors NewProforma.tsx exactly.
export default function NewQuotePage() {
  return <NewInvoicePage documentType="quote" />;
}
