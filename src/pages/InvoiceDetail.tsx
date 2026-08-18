import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Printer, CreditCard, MinusCircle, Eye, FileText, ArrowRightLeft, Edit, Truck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useInvoice, useConvertProforma } from "@/hooks/useInvoices";
import { InvoicePrintView } from "@/components/invoice/InvoicePrintView";
import { InvoicePreview } from "@/components/invoice/InvoicePreview";
import { generateInvoicePDF, generateInvoicePDFBlob, blobToBase64 } from "@/lib/pdfGenerator";
import { PDFViewerModal } from "@/components/pdf/PDFViewerModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";
import { db } from "@/lib/database";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

const statusStyles: Record<string, string> = {
  paid: "bg-status-paid-bg text-status-paid",
  partial: "bg-status-pending-bg text-status-pending",
  unpaid: "bg-status-unpaid-bg text-status-unpaid",
  draft: "bg-status-draft-bg text-status-draft",
  overdue: "bg-status-unpaid-bg text-status-unpaid",
  issued: "bg-status-pending-bg text-status-pending",
};

const statusLabels: Record<string, string> = {
  paid: "Payée",
  partial: "Partielle",
  unpaid: "Impayée",
  draft: "Brouillon",
  overdue: "En retard",
  issued: "Émise",
};

const EditableHeader = ({ invoice, onUpdate }: { invoice: any, onUpdate: (title: string, number: string) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(invoice.custom_title || (invoice.invoice_type === "credit_note" ? "Avoir" : "Facture"));
  const [number, setNumber] = useState(invoice.invoice_number);

  const handleSave = () => {
    if (title !== invoice.custom_title || number !== invoice.invoice_number) {
      onUpdate(title, number);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          className="text-3xl font-bold bg-transparent border-b border-primary focus:outline-none w-[150px]"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
        />
        <input
          className="text-3xl font-bold bg-transparent border-b border-primary focus:outline-none w-[150px]"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  }

  return (
    <h1
      className="text-3xl font-bold text-foreground tracking-tight cursor-pointer hover:underline decoration-dashed underline-offset-4 decoration-muted-foreground/50"
      onClick={() => setIsEditing(true)}
      title="Cliquer pour modifier"
    >
      {invoice.custom_title || (invoice.invoice_type === "credit_note" ? "Avoir" : "Facture")} {invoice.invoice_number}
    </h1>
  );
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading, error, refetch } = useInvoice(id);
  const { data: settings } = useSettings();
  const convertProforma = useConvertProforma();
  const [showPreview, setShowPreview] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);

  const handleOpenVectorPreview = async () => {
    if (!invoice) return;
    setIsGenerating(true);
    try {
      const blob = await generateInvoicePDFBlob(invoice, settings);
      toast.success("PDF téléchargé avec succès");
      const b64 = await blobToBase64(blob);
      setPdfBlob(blob);
      setPdfBase64(b64);
      setPdfModalOpen(true);
    } catch (err) {
      console.error("Vector PDF preview error:", err);
      toast.error("Erreur lors de la génération de l'aperçu PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  console.log("InvoiceDetailPage: ID from params:", id);
  console.log("InvoiceDetailPage: Invoice data:", invoice);
  console.log("InvoiceDetailPage: Loading:", isLoading);
  console.log("InvoiceDetailPage: Error:", error);

  const handleDownloadPDF = async () => {
    if (!invoice) return;

    setIsGenerating(true);
    try {
      await generateInvoicePDF(invoice, settings);
      toast.success("PDF téléchargé avec succès");
      toast.success("PDF téléchargé dans le dossier Téléchargements");
    } catch (error) {
      console.error("PDF generation error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Erreur PDF: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = async () => {
    if (!invoice) return;
    setIsGenerating(true);
    try {
      const pdfBase64 = await generateInvoicePDF(invoice, settings, false);
      toast.success("PDF téléchargé avec succès");
      const { invoke } = await import("@tauri-apps/api/core");
      const fileName = `Impression-${invoice.invoice_number || "facture"}.pdf`;
      await invoke("open_pdf", { pdfBase64, fileName });
      toast.success("PDF ouvert pour impression");
    } catch (error) {
      console.error("Print error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Erreur impression: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "0.00 DA";
    return new Intl.NumberFormat("fr-DZ", {
      style: "decimal",
      minimumFractionDigits: 2,
    }).format(amount) + " DA";
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-8 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Chargement...</div>
          </main>
        </div>
      </div>
    );
  }

  if (!invoice && !isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-8 flex items-center justify-center">
            <div className="text-center">
              <div className="text-muted-foreground mb-4">Facture non trouvée</div>
              {id && (
                <div className="text-sm text-muted-foreground mb-4">
                  ID: {id}
                </div>
              )}
              {error && (
                <div className="text-sm text-destructive mb-4">
                  Erreur: {error instanceof Error ? error.message : String(error)}
                </div>
              )}
              <Button onClick={() => navigate("/invoices")}>
                Retour aux factures
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const isCreditNote = invoice.invoice_type === "credit_note";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 p-8 pt-4">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/invoices")}
                className="rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <EditableHeader
                    invoice={invoice}
                    onUpdate={async (title, number) => {
                      try {
                        await db.invoices.updateHeader(invoice.id, number, title || null);
                        await refetch();
                        toast.success("En-tête mis à jour");
                        // Refresh data (optional if refetch works)
                        // navigate(0); 
                      } catch (err) {
                        toast.error("Erreur lors de la mise à jour");
                        console.error(err);
                      }
                    }}
                  />
                  <span className={cn(
                    "inline-flex px-3 py-1 text-xs font-medium rounded-full",
                    statusStyles[invoice.status || "draft"]
                  )}>
                    {statusLabels[invoice.status || "draft"]}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1">
                  {invoice.clients?.name} • {formatDate(invoice.invoice_date)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant={showPreview ? "secondary" : "default"}
                onClick={() => setShowPreview(!showPreview)}
                className="rounded-full"
              >
                {showPreview ? (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Vue détail
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Aperçu
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                className="rounded-full bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300"
                onClick={handleOpenVectorPreview}
                disabled={isGenerating}
              >
                {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                <span>Aperçu PDF Vectoriel</span>
              </Button>

              <Button
                variant="outline"
                className="rounded-full"
                onClick={handlePrint}
                disabled={isGenerating}
              >
                {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
                <span>Imprimer</span>
              </Button>
              <Button
                className="rounded-full"
                onClick={handleDownloadPDF}
                disabled={isGenerating}
              >
                {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                <span>Télécharger</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="rounded-full px-4 border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                    <span className="mr-2">Plus Actions</span>
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {!isCreditNote && invoice.status !== "paid" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate(`/payments?invoice=${invoice.id}`)}>
                        <CreditCard className="w-4 h-4 mr-2 text-primary" />
                        <span className="text-primary font-medium">Enregistrer Paiement</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/invoices/credit-note/new?invoice=${invoice.id}`)}>
                        <MinusCircle className="w-4 h-4 mr-2" />
                        <span>Créer un Avoir</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => navigate(`/deliveries/new`, {
                          state: {
                            invoiceData: {
                              client_id: invoice.client_id,
                              items: invoice.invoice_items?.map((item: any) => ({
                                product_id: item.product_id,
                                product_code: item.products?.code,
                                product_name: item.products?.name,
                                quantity: item.quantity,
                                unit_price: item.unit_price,
                                tva_rate: item.tva_rate,
                                products: item.products
                              }))
                            }
                          }
                        })}
                      >
                        <Truck className="w-4 h-4 mr-2" />
                        <span>Générer Bon de Livraison</span>
                      </DropdownMenuItem>
                    </>
                  )}

                  {invoice.invoice_type === "proforma" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => convertProforma.mutate(invoice.id)}
                        disabled={convertProforma.isPending}
                      >
                        <ArrowRightLeft className="w-4 h-4 mr-2" />
                        <span>{convertProforma.isPending ? "Conversion..." : "Convertir en Facture"}</span>
                      </DropdownMenuItem>
                    </>
                  )}

                  {invoice.status !== "paid" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                        <Edit className="w-4 h-4 mr-2" />
                        <span>Modifier</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Toggle between Preview and Detail View */}
          <div className={showPreview ? "block" : "fixed left-[-9999px] top-0 opacity-0 pointer-events-none z-[-100]"}>
            <div className="bg-gray-100/50 dark:bg-gray-900/20 rounded-2xl p-4 sm:p-8 flex justify-center w-full">
              <div className="w-full max-w-4xl shadow-xl bg-white dark:bg-zinc-950 rounded-lg overflow-hidden border border-border/20">
                <InvoicePreview invoice={invoice} />
              </div>
            </div>
          </div>

          {!showPreview && (
            /* Invoice Preview Card - Detail View */
            <div className="bg-card rounded-3xl border border-border/30 shadow-card overflow-hidden">
              <div className="p-8">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-secondary/30 rounded-2xl p-4">
                    <p className="text-sm text-muted-foreground">Sous-total H.T</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(invoice.subtotal_ht)}</p>
                  </div>
                  {(invoice.discount > 0 || (invoice.discount_type === 'percent' && invoice.discount_value > 0) || (invoice.discount_type === 'amount' && invoice.discount_value > 0)) && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Remise {invoice.discount_type === 'percent' ? `(${invoice.discount_value}%)` : ''}
                      </p>
                      <p className="text-xl font-bold text-red-600 dark:text-red-400">
                        -{formatCurrency(invoice.discount || (invoice.discount_type === 'amount' ? invoice.discount_value : 0))}
                      </p>
                    </div>
                  )}
                  <div className="bg-secondary/30 rounded-2xl p-4">
                    <p className="text-sm text-muted-foreground">Total TVA</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(invoice.tva_amount)}</p>
                  </div>
                  <div className="bg-secondary/30 rounded-2xl p-4">
                    <p className="text-sm text-muted-foreground">Timbre</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(invoice.timbre)}</p>
                  </div>
                  <div className="bg-primary/10 rounded-2xl p-4">
                    <p className="text-sm text-primary">Total TTC</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(invoice.total_ttc)}</p>
                  </div>
                </div>

                {/* Header Note */}
                {invoice.header_note && (
                  <div className="mb-6 p-4 bg-secondary/20 rounded-2xl">
                    <p className="text-sm text-muted-foreground mb-1">Note d'entête</p>
                    <p className="text-foreground whitespace-pre-wrap">{invoice.header_note}</p>
                  </div>
                )}

                {/* Invoice Items Table */}
                <div className="bg-secondary/20 rounded-2xl overflow-hidden mb-6">
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="px-5 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[100px]">Code</th>
                        <th className="px-5 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Désignation</th>
                        <th className="px-5 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-[120px]">Quantité</th>
                        <th className="px-5 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-[150px]">P.U H.T</th>
                        <th className="px-5 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-[150px]">Montant H.T</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.invoice_items?.map((item: any) => (
                        <tr key={item.id} className="border-b border-border/20 last:border-0 hover:bg-secondary/10 transition-colors">
                          <td className="px-5 py-4 font-medium align-top">{item.products?.code}</td>
                          <td className="px-5 py-4 text-muted-foreground align-top">
                            <div className="font-medium text-foreground">{item.products?.name}</div>
                            {item.products?.description && (
                              <div className="text-xs mt-1 text-muted-foreground/80">{item.products.description}</div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right align-top">{item.quantity.toFixed(3)}</td>
                          <td className="px-5 py-4 text-right align-top">{formatCurrency(item.unit_price)}</td>
                          <td className="px-5 py-4 text-right font-medium align-top">{formatCurrency(item.quantity * item.unit_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Payment Info */}
                {!isCreditNote && (
                  <div className="flex justify-between items-center p-4 bg-secondary/20 rounded-2xl">
                    <div>
                      <p className="text-sm text-muted-foreground">Montant payé</p>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(invoice.amount_paid)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Reste à payer</p>
                      <p className={cn(
                        "text-lg font-bold",
                        (invoice.balance_due || 0) > 0 ? "text-destructive" : "text-status-paid"
                      )}>
                        {formatCurrency(invoice.balance_due)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {invoice.notes && (
                  <div className="mt-6 p-4 bg-secondary/20 rounded-2xl">
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-foreground">{invoice.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hidden Print View */}
          <div className="hidden print:block">
            <InvoicePrintView invoice={invoice} />
          </div>

          <PDFViewerModal
            isOpen={pdfModalOpen}
            onClose={() => setPdfModalOpen(false)}
            pdfBlob={pdfBlob}
            pdfBase64={pdfBase64}
            fileName={`Facture-${invoice.invoice_number || "000"}.pdf`}
            title={`Aperçu PDF Vectoriel - N° ${invoice.invoice_number || ""}`}
          />
        </main>
      </div >
    </div >
  );
}
