import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  RiArrowLeftLine as ArrowLeft,
  RiDownloadLine as Download,
  RiPrinterLine as Printer,
  RiBankCardLine as CreditCard,
  RiSubtractLine as MinusCircle,
  RiEyeLine as Eye,
  RiFileTextLine as FileText,
  RiArrowLeftRightLine as ArrowRightLeft,
  RiEditLine as Edit,
  RiTruckLine as Truck,
  RiLoader4Line as Loader2,
  RiMailSendLine as MailSend,
  RiMore2Fill as MoreVertical,
  RiFileCopyLine as Copy,
  RiDeleteBinLine as Trash2,
  RiListView as ListCollapse,
  RiLockLine as Lock,
  RiAddLine as PlusIcon,
} from "@remixicon/react";
import { toast } from "sonner";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  EmptyState,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@sordi/ui";
import { RiFolderChartLine as FolderIcon, RiFileSearchLine as NotFoundIcon } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/database";
import { useInvoice, useInvoices, useConvertProforma, useCreateInvoice, useDeleteInvoice, useUpdateInvoiceStatus } from "@/hooks/useInvoices";
import { useSetPageHeader } from "@/hooks/usePageHeader";
import { useSettings } from "@/hooks/useSettings";
import { useSecureSession } from "@/hooks/useSecureSession";
import { useLicenseStatus } from "@/hooks/useLicense";
import { useProjects, useAssignInvoiceToProject } from "@/hooks/useProjects";
import { generateInvoicePDF, generateInvoicePDFBlob, blobToBase64, openSavedFile } from "@/lib/pdfGenerator";
import { InvoicePreview } from "@/components/invoice/InvoicePreview";
import { InvoicePrintView } from "@/components/invoice/InvoicePrintView";
import { PDFViewerModal } from "@/components/pdf/PDFViewerModal";
import { resolveInvoiceAppearance } from "@/components/pdf/invoiceAppearance";
import { SendDocumentEmailModal } from "@/components/email/SendDocumentEmailModal";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";
import { StatusRibbon } from "@/components/invoice/StatusRibbon";
import { CopyChip } from "@/components/ui/copy-chip";
import { RecordPaymentModal } from "@/components/invoice/RecordPaymentModal";
import { CreateActivityModal } from "@/components/CreateActivityModal";
import { ActivityList } from "@/components/ActivityList";
import { useActivities } from "@/hooks/useActivities";
import type { DraftInvoiceInput } from "@/lib/emailDrafter";


const EditableHeader = ({ invoice, onUpdate }: { invoice: any, onUpdate: (title: string, number: string) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  // The fallback-substituted value, not the raw field — comparing against
  // the raw `invoice.custom_title` (often null/empty) made handleSave
  // think *every* open-then-close of the editor was a real edit, silently
  // writing the literal word "Facture"/"Avoir" into custom_title even
  // when the user changed nothing.
  const originalTitle = invoice.custom_title || (invoice.invoice_type === "credit_note" ? "Avoir" : "Facture");
  const [title, setTitle] = useState(originalTitle);
  const [number, setNumber] = useState(invoice.invoice_number);

  // Resync when the underlying invoice changes — navigating from one
  // invoice's detail page to another reuses this same mounted component,
  // and without this the inputs would show the *previous* invoice's
  // title/number the next time edit mode is opened.
  useEffect(() => {
    setTitle(originalTitle);
    setNumber(invoice.invoice_number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id, originalTitle, invoice.invoice_number]);

  const handleSave = () => {
    if (title !== originalTitle || number !== invoice.invoice_number) {
      onUpdate(title, number);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Blur instead of calling handleSave directly — unmounting the
      // input on setIsEditing(false) fires a native blur anyway, so
      // calling handleSave from both here and onBlur double-saved (and
      // could double-toast) on every Enter press.
      e.currentTarget.blur();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          className="font-mono font-semibold text-xs bg-transparent border-b border-primary focus:outline-none w-[90px]"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
        />
        <input
          className="font-mono font-semibold text-xs bg-transparent border-b border-primary focus:outline-none w-[90px]"
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
      className="font-mono font-semibold text-xs text-foreground cursor-pointer hover:underline decoration-dashed underline-offset-4 decoration-muted-foreground/50 whitespace-nowrap"
      onClick={() => setIsEditing(true)}
      title="Cliquer pour modifier"
    >
      {invoice.custom_title || (invoice.invoice_type === "credit_note" ? "Avoir" : "Facture")} N° {invoice.invoice_number}
    </h1>
  );
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading, refetch } = useInvoice(id);
  const { data: settings } = useSettings();
  const { data: licenseStatus } = useLicenseStatus();
  const { data: projects } = useProjects();
  const assignInvoiceToProject = useAssignInvoiceToProject();
  const convertProforma = useConvertProforma();
  const createInvoice = useCreateInvoice();
  const deleteInvoice = useDeleteInvoice();
  const updateStatus = useUpdateInvoiceStatus();
  const { executeSecuredAction } = useSecureSession();
  // Only fetched to check for a linked avoir — "Télécharger Avoir" only
  // shows up when one actually exists for this invoice.
  const { data: creditNotes } = useInvoices(undefined, "credit_note");
  const linkedCreditNote = creditNotes?.find((cn: any) => cn.original_invoice_id === id);
  // Defaults to the detail view (not the raw PDF preview) — the PDF-only
  // view has no room for the Notes/balance breakdown or the "Activités &
  // Rappels" panel below, so defaulting to it hid that panel completely on
  // first open of every invoice; "Aperçu document" is still one click away.
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  // Same queryKey ActivityList itself uses below, so this is a cache hit,
  // not a second fetch — only here for the heading's open-count badge.
  const { pendingActivities: pendingInvoiceActivities } = useActivities("invoice", id);
  const deleteConfirmOpen = isDeleteDialogOpen;
  const setDeleteConfirmOpen = setIsDeleteDialogOpen;

  const handleDuplicate = async () => {
    if (!invoice) return;
    try {
      createInvoice.mutate(
        {
          client_id: invoice.client_id,
          invoice_date: new Date().toISOString().split("T")[0],
          due_date: invoice.due_date || undefined,
          notes: invoice.notes || undefined,
          header_note: invoice.header_note || undefined,
          payment_method: invoice.payment_method || undefined,
          tax_mode: invoice.tax_mode,
          project_id: invoice.project_id || undefined,
          items: (invoice.invoice_items || []).map((item: any) => ({
            product_id: item.product_id || undefined,
            product_name: item.product_name || item.products?.name || undefined,
            product_code: item.product_code || item.products?.code || undefined,
            product_description: item.product_description || item.products?.description || undefined,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tva_rate: item.tva_rate === undefined ? 19.0 : item.tva_rate,
            timbre_exempt: item.timbre_exempt ?? false,
          })),
        },
        {
          onSuccess: (created) => {
            toast.success("Facture dupliquée avec succès");
            navigate(`/invoices/${created.id}/edit`);
          },
          onError: (error: any) => {
            toast.error("Erreur lors de la duplication de la facture", {
              description: error?.message,
            });
          },
        }
      );
    } catch (error: any) {
      toast.error("Erreur lors de la duplication de la facture", {
        description: error?.message,
      });
    }
  };
  const handleDuplicateToInvoice = handleDuplicate;

  const handleConfirmDelete = async () => {
    if (!id) return;
    await executeSecuredAction(() => {
      deleteInvoice.mutate(id, {
        onSuccess: () => navigate(listPath),
      });
    }, "Autoriser la suppression de la facture");
  };

  // Strict route isolation means "back to the list" now depends on which
  // of the 4 sales document types this is — a credit note's breadcrumb/
  // back button must return to /avoirs, never the Factures list.
  const listLabel =
    invoice?.invoice_type === "credit_note" ? "Avoirs"
    : invoice?.invoice_type === "proforma" ? "Factures Proforma"
    : invoice?.invoice_type === "quote" ? "Devis"
    : "Facturation";
  const listPath =
    invoice?.invoice_type === "credit_note" ? "/avoirs"
    : invoice?.invoice_type === "proforma" ? "/proformas"
    : invoice?.invoice_type === "quote" ? "/devis"
    : "/factures";
  useSetPageHeader(listLabel, [
    { label: listLabel, path: listPath },
    { label: invoice?.invoice_number || "…" },
  ]);

  const handleOpenVectorPreview = async () => {
    if (!invoice) return;
    setIsGenerating(true);
    try {
      const blob = await generateInvoicePDFBlob(invoice, settings, licenseStatus?.license_state);
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

  const handleDownloadPDF = async () => {
    if (!invoice) return;

    const resolvedAppearance = resolveInvoiceAppearance(invoice, settings);
    console.log('🚀 [PDF_EXPORT_PAYLOAD]', { invoiceId: invoice?.id, resolvedAppearance });

    setIsGenerating(true);
    try {
      await generateInvoicePDF(invoice, settings, true, undefined, licenseStatus?.license_state, ({ path, blob }) => {
        toast.success("Facture PDF générée", {
          description: "Le fichier a été enregistré avec succès.",
          action: { label: "Ouvrir", onClick: () => openSavedFile(path, blob) },
          duration: 5000,
        });
      });
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
      const pdfBase64 = await generateInvoicePDF(invoice, settings, false, undefined, licenseStatus?.license_state);
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
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-[600px] w-full rounded-2xl" />
        </div>
      </main>
    );
  }

  if (!invoice && !isLoading) {
    return (
      <main className="flex-1 p-8 flex items-center justify-center">
        <div className="max-w-sm">
          <EmptyState
            icon={NotFoundIcon}
            title="Facture introuvable"
            description="Cette facture n'existe plus ou a été déplacée."
          />
          <Button onClick={() => navigate(listPath)} className="w-full">
            Retour à la liste
          </Button>
        </div>
      </main>
    );
  }

  const isCreditNote = invoice.invoice_type === "credit_note";

  // Mirrors the Rust `update_invoice` immutability guard (commands.rs)
  // exactly — paid/partial/converted/cancelled invoices are rejected
  // server-side with INVOICE_LOCKED, so the UI disables the same actions up
  // front instead of letting the user hit that error on save.
  const isLocked = ["paid", "partial", "converted", "cancelled"].includes(invoice.status);

  // Pillar 2: on any invoice that still has real money outstanding, the
  // primary toolbar action becomes recording that payment rather than
  // editing the document — this excludes draft (nothing issued yet to pay),
  // paid/cancelled/converted (nothing left to collect), and credit notes
  // (which reduce a balance, they don't carry one of their own).
  const showsPaymentButton = !isCreditNote && ["issued", "partial", "overdue"].includes(invoice.status);

  return (
        <main className="flex-1 flex flex-col min-h-0 w-full max-w-full overflow-x-hidden">
          {/* Unified 56px toolbar — matches NewInvoice.tsx's master bar
              (same h-14/px-4 sm:px-6/sticky treatment) instead of the old
              two-row, ~120px-tall header with a dozen full-width pill
              buttons. */}
          <header className="h-10 w-full border-b border-border/80 bg-background/95 backdrop-blur-sm px-4 flex items-center justify-between sticky top-0 z-30 shrink-0 select-none">
            {/* Left: identity + status — allowed to shrink (and clip via
                overflow-hidden) so the Right action zone below never has to
                give up its own space for this one; the client name span is
                the only piece that visibly truncates under pressure. */}
            <div className="min-w-0 shrink flex items-center gap-2 overflow-hidden">
              <Button variant="ghost" size="sm" onClick={() => navigate(listPath)} className="h-7 px-2.5 gap-1.5 text-xs text-zinc-600 shrink-0 rounded-md">
                <ArrowLeft className="w-3.5 h-3.5" />
                Retour
              </Button>
              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" aria-hidden="true" />
              <div className="flex items-center gap-1 min-w-0 shrink-0 group">
                <EditableHeader
                  invoice={invoice}
                  onUpdate={async (title, number) => {
                    try {
                      await db.invoices.updateHeader(invoice.id, number, title || null);
                      await refetch();
                      toast.success("En-tête mis à jour");
                    } catch (err) {
                      toast.error("Erreur lors de la mise à jour");
                      console.error(err);
                    }
                  }}
                />
                <CopyChip value={invoice.invoice_number} label="Copier le N° de facture" />
                {/* Odoo-style lifecycle ribbon — previously a plain status
                    pill/dropdown here, so changing an invoice's status
                    required leaving the detail page and finding the same
                    row again in the list (Invoices.tsx). Each step is
                    clickable, same status set and draft-revert guard as
                    Invoices.tsx's own status dropdown. */}
                <StatusRibbon
                  status={invoice.status}
                  draftDisabled={invoice.invoice_type === "invoice" || invoice.invoice_type === "credit_note"}
                  onSelect={(status) => updateStatus.mutate({ id: invoice.id, status })}
                />
              </div>
              <span className="text-xs text-muted-foreground hidden md:inline truncate min-w-0 max-w-[160px]">
                {invoice.clients?.name} · {formatDate(invoice.invoice_date)}
              </span>
            </div>

            {/* Center: view switcher — text labels only reappear on very
                wide windows (2xl, 1536px+); below that it's icon-only with
                a title tooltip, so this control keeps working at a
                standard 1280px width instead of costing ~300px of layout
                room the Right action zone needs. */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="inline-flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-medium gap-0.5">
                <button
                  type="button"
                  title="Vue détaillée"
                  onClick={() => setShowPreview(false)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all",
                    !showPreview
                      ? "bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100 font-semibold"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  <ListCollapse className="w-3.5 h-3.5" />
                  <span className="hidden 2xl:inline">Vue détaillée</span>
                </button>
                <button
                  type="button"
                  title="Aperçu document"
                  onClick={() => setShowPreview(true)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all",
                    showPreview
                      ? "bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100 font-semibold"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden 2xl:inline">Aperçu document</span>
                </button>
              </div>
            </div>

            {/* Right: hierarchical actions — shrink-0 + ml-auto so this
                cluster always keeps its full width and stays pinned to the
                trailing edge, no matter how tight the Left zone gets
                squeezed. Text-label buttons trimmed to the ones that matter
                at a glance (payment/edit, + Activité); PDF/Print/Email are
                icon-only and everything else lives in the "..." menu, so
                the whole row fits a standard 1280px window without
                clipping or being pushed off-screen. */}
            <div className="shrink-0 flex items-center gap-1.5 ml-auto">
              {/* When there's a real payment to collect, that action takes
                  the primary (blue) slot instead of "Modifier" — settling
                  the invoice is the actual next step in its lifecycle at
                  this point, not editing it. */}
              {showsPaymentButton && (
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 rounded-md"
                  onClick={() => setPaymentModalOpen(true)}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Enregistrer un paiement
                </Button>
              )}
              {isLocked ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* disabled buttons swallow pointer events, so the
                        tooltip trigger has to be this wrapping span, not
                        the Button itself. */}
                    <span>
                      <Button
                        size="sm"
                        variant={showsPaymentButton ? "outline" : "default"}
                        disabled
                        className={cn("h-7 px-2.5 text-xs font-medium gap-1.5 rounded-md")}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Modifier
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Document validé — modification impossible</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  size="sm"
                  variant={showsPaymentButton ? "outline" : "default"}
                  className="h-7 px-2.5 text-xs font-medium gap-1.5 rounded-md"
                  onClick={() => navigate(`/invoices/${id}/edit`)}
                >
                  <Edit className="w-3.5 h-3.5" />
                  Modifier
                </Button>
              )}
              {/* Was an icon-only ghost button lost in the Print/Email/"..."
                  cluster further right — promoted to a labeled button right
                  next to Modifier so it's visible at a glance, matching the
                  "+ Activité" button's placement on ClientDetail. */}
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs font-medium gap-1.5 rounded-md"
                onClick={() => setIsActivityModalOpen(true)}
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Activité
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-zinc-600"
                title="Télécharger PDF"
                onClick={handleDownloadPDF}
                disabled={isGenerating}
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-zinc-600" title="Imprimer" onClick={handlePrint} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-zinc-600" title="Envoyer par email" onClick={() => setEmailModalOpen(true)}>
                <MailSend className="w-4 h-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-zinc-600">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {!isCreditNote && (
                    // Moved in from its own toolbar button — the toolbar
                    // was overflowing at standard desktop widths with every
                    // action as a labeled button; this one is a corrective
                    // action taken far less often than Modifier/Activité,
                    // so it's the one that gives up its dedicated slot.
                    <DropdownMenuItem onClick={() => navigate(`/invoices/credit-note/new?invoice=${invoice.id}`)}>
                      <MinusCircle className="w-4 h-4 mr-2" />
                      <span>Créer un Avoir</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleOpenVectorPreview} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                    <span>Aperçu PDF Vectoriel</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicate} disabled={createInvoice.isPending}>
                    <Copy className="w-4 h-4 mr-2" />
                    <span>{createInvoice.isPending ? "Duplication..." : "Dupliquer"}</span>
                  </DropdownMenuItem>
                  {linkedCreditNote && (
                    <DropdownMenuItem onClick={() => navigate(`/invoices/${linkedCreditNote.id}`)}>
                      <Download className="w-4 h-4 mr-2" />
                      <span>Télécharger Avoir</span>
                    </DropdownMenuItem>
                  )}

                  {!isCreditNote && invoice.status !== "paid" && (
                    <>
                      <DropdownMenuSeparator />
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

                  {invoice.invoice_type === "proforma" && invoice.status !== "converted" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          convertProforma.mutate(invoice.id, {
                            onSuccess: (created) => navigate(`/invoices/${created.id}`),
                          })
                        }
                        disabled={convertProforma.isPending}
                      >
                        <ArrowRightLeft className="w-4 h-4 mr-2" />
                        <span>{convertProforma.isPending ? "Conversion..." : "Convertir en Facture"}</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  {invoice.invoice_type === "proforma" && invoice.converted_to_invoice_id && (
                    <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.converted_to_invoice_id}`)}>
                      <FileText className="w-4 h-4 mr-2" />
                      <span>Voir la facture générée</span>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setDeleteConfirmOpen(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    <span>Supprimer</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Scrollable content below the sticky toolbar — the project
              assignment control used to live inside the old header block;
              kept (not dropped) as a lightweight row here instead of
              cramming it into the 56px bar, which has no room for it. */}
          <div className="flex-1 overflow-y-auto p-8 pt-6">
            {/* omada-agency branch only — links this invoice to a project so its
                total_ttc/amount_paid count toward that project's derived budget */}
            <div className="flex items-center gap-2 mb-6">
              <FolderIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Select
                value={invoice.project_id ?? "none"}
                onValueChange={(v) => assignInvoiceToProject.mutate({ invoiceId: invoice.id, projectId: v === "none" ? null : v })}
              >
                <SelectTrigger className="h-7 w-[220px] text-xs border-none bg-transparent px-2 shadow-none hover:bg-secondary/50">
                  <SelectValue placeholder="Aucun projet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun projet</SelectItem>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          <DeleteConfirmationModal
            open={deleteConfirmOpen}
            onOpenChange={setDeleteConfirmOpen}
            title="Supprimer la facture"
            itemIdentifier={invoice.invoice_number || "Facture"}
            description={(invoice.amount_paid || 0) > 0
              ? `Cette facture a des paiements enregistrés totalisant ${invoice.amount_paid.toLocaleString("fr-FR")} DA — ils seront supprimés définitivement avec la facture. Cette action est irréversible.`
              : "Cette action est irréversible."}
            isLoading={deleteInvoice.isPending}
            onConfirm={handleConfirmDelete}
          />

          <RecordPaymentModal
            open={paymentModalOpen}
            onOpenChange={setPaymentModalOpen}
            invoiceId={invoice.id}
            balanceDue={invoice.balance_due || 0}
          />

          {/* Toggle between Preview and Detail View — a native document
              workbench canvas, not a floating card nested inside another
              floating card: the A4 sheet itself (InvoiceReadOnly*.tsx)
              already carries its own crisp 1px border + shadow-sm, so this
              wrapper is just the neutral workbench backdrop around it. */}
          <div className={showPreview ? "flex-1 bg-muted/40 overflow-y-auto flex flex-col items-center py-8 px-4 relative" : "fixed left-[-9999px] top-0 opacity-0 pointer-events-none z-[-100]"}>
            <InvoicePreview invoice={invoice} />
          </div>

          {!showPreview && (
            /* Invoice Preview Card - Detail View */
            <div className="bg-card rounded-3xl border border-border/30 shadow-card overflow-hidden">
              <div className="p-8">
                {/* Lifecycle ribbon, top-right of the document canvas —
                    same control as the toolbar's, kept in sync via the
                    same updateStatus mutation/query cache. */}
                <div className="flex justify-end mb-6">
                  <StatusRibbon
                    status={invoice.status}
                    draftDisabled={invoice.invoice_type === "invoice" || invoice.invoice_type === "credit_note"}
                    onSelect={(status) => updateStatus.mutate({ id: invoice.id, status })}
                  />
                </div>
                {/* Summary Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <div className="bg-secondary/30 rounded-2xl p-4">
                    <p className="text-sm text-muted-foreground">Sous-total H.T</p>
                    <p className="font-mono tabular-nums text-xl font-bold text-foreground">{formatCurrency(invoice.subtotal_ht)}</p>
                  </div>
                  {(invoice.discount > 0 || (invoice.discount_type === 'percent' && invoice.discount_value > 0) || (invoice.discount_type === 'amount' && invoice.discount_value > 0)) && (
                    <div className="bg-destructive/10 rounded-2xl p-4">
                      <p className="text-sm text-destructive">
                        Remise {invoice.discount_type === 'percent' && invoice.discount_value ? `(${invoice.discount_value}%)` : ''}
                      </p>
                      <p className="font-mono tabular-nums text-xl font-bold text-destructive">
                        -{formatCurrency(invoice.discount || (invoice.discount_type === 'amount' ? invoice.discount_value : 0))}
                      </p>
                    </div>
                  )}
                  <div className="bg-secondary/30 rounded-2xl p-4">
                    <p className="text-sm text-muted-foreground">Total TVA</p>
                    <p className="font-mono tabular-nums text-xl font-bold text-foreground">{formatCurrency(invoice.tva_amount)}</p>
                  </div>
                  <div className="bg-secondary/30 rounded-2xl p-4">
                    <p className="text-sm text-muted-foreground">Timbre</p>
                    <p className="font-mono tabular-nums text-xl font-bold text-foreground">{formatCurrency(invoice.timbre)}</p>
                  </div>
                  <div className="bg-primary/10 rounded-2xl p-4">
                    <p className="text-sm text-primary">Total TTC</p>
                    <p className="font-mono tabular-nums text-xl font-bold text-primary">{formatCurrency(invoice.total_ttc)}</p>
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
                          <td className="px-5 py-4 text-right align-top font-mono tabular-nums">{(item.quantity ?? 0).toFixed(3)}</td>
                          <td className="px-5 py-4 text-right align-top font-mono tabular-nums">{formatCurrency(item.unit_price)}</td>
                          <td className="px-5 py-4 text-right font-medium align-top font-mono tabular-nums">{formatCurrency(item.quantity * item.unit_price)}</td>
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
                      <p className="font-mono tabular-nums text-lg font-bold text-foreground">{formatCurrency(invoice.amount_paid)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Reste à payer</p>
                      <p className={cn(
                        "font-mono tabular-nums text-lg font-bold",
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

                {/* Activités & Rappels — Odoo-chatter-style follow-ups
                    scoped to this invoice. */}
                <div className="mt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    Activités &amp; Rappels
                    {pendingInvoiceActivities.length > 0 && (
                      <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-muted text-[10px] font-semibold text-foreground normal-case tracking-normal">
                        {pendingInvoiceActivities.length}
                      </span>
                    )}
                  </p>
                  <ActivityList entityType="invoice" entityId={invoice.id} />
                </div>
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

          <SendDocumentEmailModal
            open={emailModalOpen}
            onOpenChange={setEmailModalOpen}
            recipientEmail={invoice.clients?.email}
            fileName={`${isCreditNote ? "Avoir" : "Facture"}-${invoice.invoice_number || "000"}.pdf`}
            draftInput={{
              docType: "invoice",
              isCreditNote,
              documentNumber: invoice.invoice_number,
              clientName: invoice.clients?.name || "",
              documentDate: invoice.invoice_date,
              dueDate: invoice.due_date,
              totalTTC: invoice.total_ttc,
              bankRib: settings?.company_rib || null,
              bankAgency: settings?.company_bank_agency || null,
              senderCompany: settings?.company_name || "Sordi",
              items: (invoice.invoice_items || []).map((item: any) => ({
                name: item.product_name || item.products?.name || item.name || "Article",
                quantity: item.quantity,
                unitPrice: item.unit_price,
              })),
            } satisfies DraftInvoiceInput}
            getPdfBase64={async () => {
              const blob = await generateInvoicePDFBlob(invoice, settings, licenseStatus?.license_state);
              return blobToBase64(blob);
            }}
          />

          <CreateActivityModal
            open={isActivityModalOpen}
            onOpenChange={setIsActivityModalOpen}
            entityType="invoice"
            entityId={invoice.id}
            entityLabel={`${invoice.custom_title || (invoice.invoice_type === "credit_note" ? "Avoir" : "Facture")} N° ${invoice.invoice_number}`}
          />
          </div>
        </main>
  );
}
