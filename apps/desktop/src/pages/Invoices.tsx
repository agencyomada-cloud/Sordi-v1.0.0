import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  RiAddLine as Plus,
  RiMoreFill as MoreHorizontal,
  RiEyeLine as Eye,
  RiBankCardLine as CreditCard,
  RiDownloadLine as FileDown,
  RiSubtractLine as MinusCircle,
  RiDeleteBinLine as Trash2,
  RiArrowLeftRightLine as ArrowRightLeft,
  RiEditLine as Edit,
  RiMailSendLine as MailIcon,
  RiCheckLine as Check,
  RiFolderZipLine as FolderZip,
  RiLoader4Line as Loader2,
  RiFileCopyLine as Copy,
} from "@remixicon/react";
import { Button, Checkbox, SearchInput, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, TableLoading, EmptyState, Tooltip, TooltipTrigger, TooltipContent } from "@sordi/ui";
import { cn } from "@/lib/utils";
import { useInvoices, useDeleteInvoice, useConvertProforma, useUpdateInvoiceStatus, type InvoiceStatus, type InvoiceType } from "@/hooks/useInvoices";
import { generateInvoicePDF, generateInvoicePDFBlob, blobToBase64, downloadBlobsAsZip, openSavedFile } from "@/lib/pdfGenerator";
import { getInvoiceStatusConfig, INVOICE_STATUS_PILL_BASE, INVOICE_STATUS_PILL_CLASSES, INVOICE_STATUS_DOT_CLASSES } from "@/lib/invoiceStatus";
import { toast } from "sonner";
import { db } from "@/lib/database";
import { useSettings } from "@/hooks/useSettings";
import { useLicenseStatus } from "@/hooks/useLicense";
import { InvoicePreview } from "@/components/invoice/InvoicePreview";
import { SendDocumentEmailModal } from "@/components/email/SendDocumentEmailModal";
import { BulkActionBar } from "@/components/BulkActionBar";
import type { DraftInvoiceInput } from "@/lib/emailDrafter";
import { useSecureSession } from "@/hooks/useSecureSession";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";

const tabs = [
  { label: "Toutes", status: undefined, type: undefined },
  { label: "Factures", status: undefined, type: "invoice" as InvoiceType },
  { label: "Proformas", status: undefined, type: "proforma" as InvoiceType },
  { label: "Avoirs", status: undefined, type: "credit_note" as InvoiceType },
  { label: "Payées", status: "paid" as InvoiceStatus, type: undefined },
  { label: "Impayées", status: "issued" as InvoiceStatus, type: undefined },
];


export default function InvoicesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const getInitialTab = () => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "proformas") return 2;
    if (tabParam === "invoices") return 1;
    if (tabParam === "credit-notes") return 3;
    return 0;
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const { data: invoices, isLoading } = useInvoices(tabs[activeTab].status, tabs[activeTab].type);
  const deleteInvoice = useDeleteInvoice();
  const convertProforma = useConvertProforma();
  const { data: settings } = useSettings();
  const { data: licenseStatus } = useLicenseStatus();
  const updateStatus = useUpdateInvoiceStatus();
  const { executeSecuredAction } = useSecureSession();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [pdfInvoice, setPdfInvoice] = useState<any>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [emailTarget, setEmailTarget] = useState<any | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkMarkingPaid, setIsBulkMarkingPaid] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    setSelectedInvoices([]);
    const tabName = index === 1 ? "invoices" : index === 2 ? "proformas" : index === 3 ? "credit-notes" : "all";
    setSearchParams({ tab: tabName });
  };

  const toggleAll = () => {
    if (selectedInvoices.length === filteredInvoices?.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices?.map((inv: any) => inv.id) || []);
    }
  };

  const toggleInvoice = (id: string) => {
    if (selectedInvoices.includes(id)) {
      setSelectedInvoices(selectedInvoices.filter((i) => i !== id));
    } else {
      setSelectedInvoices([...selectedInvoices, id]);
    }
  };

  const handleDelete = async () => {
    if (invoiceToDelete) {
      await executeSecuredAction(() => {
        deleteInvoice.mutate(invoiceToDelete);
        setDeleteDialogOpen(false);
        setInvoiceToDelete(null);
      }, "Autoriser la suppression de la facture");
    }
  };

  const filteredInvoices = invoices?.filter((invoice: any) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      invoice.invoice_number?.toLowerCase().includes(searchLower) ||
      invoice.clients?.name?.toLowerCase().includes(searchLower) ||
      invoice.total_ttc?.toString().includes(searchLower)
    );
  })?.sort((a: any, b: any) => {
    let aValue, bValue;
    switch (sortConfig.key) {
      case 'date':
        aValue = new Date(a.invoice_date).getTime();
        bValue = new Date(b.invoice_date).getTime();
        break;
      case 'number':
        aValue = a.invoice_number || '';
        bValue = b.invoice_number || '';
        break;
      case 'client':
        aValue = a.clients?.name?.toLowerCase() || '';
        bValue = b.clients?.name?.toLowerCase() || '';
        break;
      case 'amount':
        aValue = a.total_ttc || 0;
        bValue = b.total_ttc || 0;
        break;
      default:
        return 0;
    }
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-DZ", {
      style: "currency",
      currency: "DZD",
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Shared by the single-row download and the bulk zip export — fetches an
  // invoice's items/client and reshapes them into what the PDF generator
  // expects. Throws (with a French message) on any missing piece so callers
  // can decide how to report a failure (single toast vs. a batch summary).
  const buildInvoiceForPDF = async (invoiceId: string) => {
    const fullInvoice = await db.invoices.getById(invoiceId);
    if (!fullInvoice) throw new Error("Impossible de récupérer les détails de la facture");

    const items = await db.invoices.getItems(invoiceId);

    if (!fullInvoice.client_id) throw new Error("Cette facture n'a pas de client associé");

    const client = await db.clients.getById(fullInvoice.client_id);
    if (!client) throw new Error("Impossible de récupérer les détails du client");

    return {
      ...fullInvoice,
      invoice_items: items.map(item => ({
        ...item,
        products: item.products ? {
          code: item.products.code,
          name: item.products.name,
          description: item.products.description,
          unit: item.products.unit,
        } : undefined
      })),
      clients: {
        name: client.name,
        address: client.address,
        city: client.city,
        wilaya: client.wilaya,
        phone: client.phone,
        email: client.email,
        nif: client.nif,
        nis: client.nis,
        rc: client.rc,
        ai: client.ai,
      }
    };
  };

  const handleDownloadPDF = async (invoiceId: string, invoiceSummary: any) => {
    const loadingId = toast.loading("Génération du PDF...");
    try {
      const invoiceForPDF = await buildInvoiceForPDF(invoiceId);
      setPdfInvoice(invoiceForPDF);

      // Wait for the off-screen preview to render before rasterizing it
      await new Promise((r) => setTimeout(r, 500));

      await generateInvoicePDF(invoiceForPDF, settings, true, undefined, licenseStatus?.state === "active", ({ path, blob }) => {
        toast.success("Facture PDF générée", {
          id: loadingId,
          description: "Le fichier a été enregistré avec succès.",
          action: { label: "Ouvrir", onClick: () => openSavedFile(path, blob) },
          duration: 5000,
        });
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error(error instanceof Error ? error.message : "Erreur inattendue", { id: loadingId });
    } finally {
      setPdfInvoice(null);
    }
  };

  const handleOpenEmailModal = async (invoiceId: string) => {
    try {
      const fullInvoice = await db.invoices.getById(invoiceId);
      if (!fullInvoice) {
        toast.error("Impossible de récupérer les détails de la facture");
        return;
      }
      const items = await db.invoices.getItems(invoiceId);
      const client = fullInvoice.client_id ? await db.clients.getById(fullInvoice.client_id) : null;

      setEmailTarget({
        ...fullInvoice,
        invoice_items: items,
        clients: client ? {
          name: client.name,
          email: client.email,
        } : undefined,
      });
      setEmailModalOpen(true);
    } catch (error) {
      console.error("Failed to load invoice for email:", error);
      toast.error("Impossible de préparer l'email pour cette facture");
    }
  };

  const clearSelection = () => setSelectedInvoices([]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).then(
      () => toast.success("ID copié dans le presse-papiers"),
      () => toast.error("Impossible de copier l'ID")
    );
  };

  const handleBulkMarkPaid = async () => {
    setIsBulkMarkingPaid(true);
    try {
      const results = await Promise.allSettled(
        selectedInvoices.map((id) => updateStatus.mutateAsync({ id, status: "paid" }))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        toast.success(`${results.length} facture${results.length > 1 ? "s" : ""} marquée${results.length > 1 ? "s" : ""} payée${results.length > 1 ? "s" : ""}`);
      } else {
        toast.error(`${failed} facture(s) sur ${results.length} n'ont pas pu être mises à jour`);
      }
      clearSelection();
    } finally {
      setIsBulkMarkingPaid(false);
    }
  };

  const handleBulkDownloadZip = async () => {
    setIsBulkDownloading(true);
    try {
      const results = await Promise.allSettled(
        selectedInvoices.map(async (id) => {
          const invoiceForPDF = await buildInvoiceForPDF(id);
          const blob = await generateInvoicePDFBlob(invoiceForPDF, settings, licenseStatus?.state === "active");
          const isCreditNote = invoiceForPDF.invoice_type === "credit_note";
          const fileName = `${isCreditNote ? "Avoir" : "Facture"}-${invoiceForPDF.invoice_number || id}.pdf`;
          return { blob, fileName };
        })
      );
      const files = results.filter((r): r is PromiseFulfilledResult<{ blob: Blob; fileName: string }> => r.status === "fulfilled").map((r) => r.value);
      const failed = results.length - files.length;

      if (files.length === 0) {
        toast.error("Aucun PDF n'a pu être généré");
        return;
      }

      await downloadBlobsAsZip(files, `Factures-${new Date().toISOString().split("T")[0]}.zip`);
      toast.success(
        failed === 0
          ? `${files.length} facture${files.length > 1 ? "s" : ""} téléchargée${files.length > 1 ? "s" : ""} (ZIP)`
          : `${files.length} facture(s) téléchargées, ${failed} en échec`
      );
      clearSelection();
    } catch (error) {
      console.error("Bulk PDF download error:", error);
      toast.error("Erreur lors du téléchargement groupé");
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const results = await Promise.allSettled(selectedInvoices.map((id) => deleteInvoice.mutateAsync(id)));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        toast.success(`${results.length} facture${results.length > 1 ? "s" : ""} supprimée${results.length > 1 ? "s" : ""}`);
      } else {
        toast.error(`${failed} facture(s) sur ${results.length} n'ont pas pu être supprimées`);
      }
      clearSelection();
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <>
      {/* Off-screen Preview for PDF Generation */}
      <div className="fixed left-[-9999px] top-0 opacity-0 pointer-events-none z-[-100]">
        {pdfInvoice && <InvoicePreview invoice={pdfInvoice} />}
      </div>

      <main className="flex-1 p-8 pt-4 min-w-0">
          <div className="max-w-[1600px] mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 animate-fade-in-down">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Facturation & Créances</h1>
              <p className="text-xs text-slate-500 mt-1">Gérez vos factures, proformas et avoirs</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => navigate("/invoices/credit-note/new")}>
                <MinusCircle className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Avoir</span>
              </Button>
              <Button variant="outline" onClick={() => navigate("/proformas/new")}>
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Proforma</span>
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => navigate("/invoices/new")}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle facture
              </Button>
            </div>
          </div>

          {/* Tabs and Search — rest directly on the page canvas, no card
              wrapper; a single hairline divider closes off the filter row
              instead of a full bordered/shadowed box. */}
          {/* xl, not md — the filter tabs need their own full-width row to
              show all of them; sharing a row with the sort-select+search at
              md's 768px squeezed the (overflow-x-auto) tabs strip down to
              where the last tab was visually cut off mid-word with no
              indication it was scrollable. */}
          <div className="flex flex-col items-start xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-border/40 animate-fade-in-up animation-delay-100">
            <div className="flex items-center gap-2 overflow-x-auto">
              {tabs.map((tab, index) => (
                <Button
                  key={tab.label}
                  variant={activeTab === index ? "default" : "outline"}
                  onClick={() => handleTabChange(index)}
                  className={cn(
                    "rounded-full px-4 border-0",
                    activeTab === index
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {tab.label}
                </Button>
              ))}
              <span className="text-xs text-muted-foreground font-mono tabular-nums ps-2 shrink-0 whitespace-nowrap">
                {invoices?.length || 0} facture{(invoices?.length || 0) > 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <Select
                value={`${sortConfig.key}-${sortConfig.direction}`}
                onValueChange={(val) => {
                  const [key, direction] = val.split('-');
                  setSortConfig({ key, direction: direction as 'asc' | 'desc' });
                }}
              >
                <SelectTrigger className="w-[180px] h-11 bg-secondary/30 border-border/50 rounded-xl">
                  <SelectValue placeholder="Trier par..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Date (Plus récent)</SelectItem>
                  <SelectItem value="date-asc">Date (Plus ancien)</SelectItem>
                  <SelectItem value="number-asc">N° Facture (Croissant)</SelectItem>
                  <SelectItem value="number-desc">N° Facture (Décroissant)</SelectItem>
                  <SelectItem value="client-asc">Client (A-Z)</SelectItem>
                  <SelectItem value="client-desc">Client (Z-A)</SelectItem>
                  <SelectItem value="amount-desc">Montant (Plus grand)</SelectItem>
                  <SelectItem value="amount-asc">Montant (Plus petit)</SelectItem>
                </SelectContent>
              </Select>

              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                containerClassName="flex-1 md:w-72"
              />
            </div>
          </div>

          {/* Bulk action bar */}
          <div className="pt-4">
            <BulkActionBar count={selectedInvoices.length} onClear={clearSelection}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-full text-xs"
                onClick={handleBulkMarkPaid}
                disabled={isBulkMarkingPaid}
              >
                {isBulkMarkingPaid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Marquer comme payées
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-full text-xs"
                onClick={handleBulkDownloadZip}
                disabled={isBulkDownloading}
              >
                {isBulkDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderZip className="w-3.5 h-3.5" />}
                Télécharger en lot
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-full text-xs text-destructive hover:text-destructive"
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer la sélection
              </Button>
            </BulkActionBar>
          </div>

          {/* Table — borderless outer surface, resting directly on the page
              canvas (was a bg-card/border/shadow-card box around the whole
              block); only the row dividers now separate content. */}
          <div className="animate-fade-in-up animation-delay-200">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="[&:has([role=checkbox])]:pl-5">
                    <Checkbox
                      checked={selectedInvoices.length === filteredInvoices?.length && filteredInvoices?.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>N°</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead numeric>Montant</TableHead>
                  <TableHead className="hidden sm:table-cell">Statut</TableHead>
                  <TableHead className="w-14"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoading columns={7} rows={5} />
                ) : filteredInvoices?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState
                        type="invoices"
                        title="Aucune facture"
                        description={searchQuery ? "Essayez une autre recherche" : "Créez votre première facture"}
                        action={searchQuery ? {
                          label: "Effacer la recherche",
                          onClick: () => setSearchQuery(""),
                        } : {
                          label: "Créer",
                          onClick: () => navigate("/invoices/new"),
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices?.map((invoice) => {
                    const isCreditNote = invoice.invoice_type === "credit_note";
                    const isProforma = invoice.invoice_type === "proforma";
                    const statusConfig = getInvoiceStatusConfig(invoice.status);
                    const isCancelled = invoice.status === "cancelled";
                    return (
                      <TableRow
                        key={invoice.id}
                        className="cursor-pointer"
                        dimmed={isCancelled}
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedInvoices.includes(invoice.id)}
                            onCheckedChange={() => toggleInvoice(invoice.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium tabular-nums tracking-tight">{invoice.invoice_number}</span>
                            {isCreditNote && (
                              <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">Avoir</span>
                            )}
                            {isProforma && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Proforma</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[220px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">{invoice.clients?.name}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top">{invoice.clients?.name}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell whitespace-nowrap">
                          {formatDate(invoice.invoice_date)}
                        </TableCell>
                        <TableCell numeric className={cn("whitespace-nowrap", isCreditNote && "text-destructive")}>
                          {isCreditNote ? "-" : ""}{formatCurrency(invoice.total_ttc)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className={cn(
                                    INVOICE_STATUS_PILL_BASE,
                                    INVOICE_STATUS_PILL_CLASSES[statusConfig.variant],
                                    "cursor-pointer hover:opacity-80 transition-opacity"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                  }}
                                >
                                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", INVOICE_STATUS_DOT_CLASSES[statusConfig.variant])} />
                                  {statusConfig.label}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="center">
                                <DropdownMenuItem onClick={() => updateStatus.mutate({ id: invoice.id, status: "paid" })}>
                                  Payée
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatus.mutate({ id: invoice.id, status: "issued" })}>
                                  Émise (Impayée)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatus.mutate({ id: invoice.id, status: "draft" })}>
                                  Brouillon
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatus.mutate({ id: invoice.id, status: "cancelled" })}>
                                  Annulée
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {/* Hidden until the row is hovered/focused — Linear-style
                              contextual actions instead of permanently-visible icon clutter. */}
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all text-muted-foreground hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyId(invoice.id);
                                  }}
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Copier l'ID</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all text-muted-foreground hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadPDF(invoice.id, invoice);
                                  }}
                                >
                                  <FileDown className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Télécharger PDF</TooltipContent>
                            </Tooltip>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all">
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Voir détails
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Modifier la facture
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenEmailModal(invoice.id)}>
                                  <MailIcon className="mr-2 h-4 w-4" />
                                  Envoyer par email
                                </DropdownMenuItem>
                                {isProforma && invoice.status !== "converted" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      convertProforma.mutate(invoice.id, {
                                        onSuccess: (created) => navigate(`/invoices/${created.id}`),
                                      })
                                    }
                                  >
                                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                                    Convertir en Facture
                                  </DropdownMenuItem>
                                )}
                                {!isCreditNote && !isProforma && (
                                  <>
                                    <DropdownMenuItem onClick={() => navigate(`/payments?invoice=${invoice.id}`)}>
                                      <CreditCard className="w-4 h-4 mr-2" />
                                      Paiement
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => navigate(`/invoices/credit-note/new?invoice=${invoice.id}`)}>
                                      <MinusCircle className="w-4 h-4 mr-2" />
                                      Avoir
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setInvoiceToDelete(invoice.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          </div>
      </main>

      <DeleteConfirmationModal
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Supprimer la facture"
        itemIdentifier={invoices?.find((i) => i.id === invoiceToDelete)?.invoice_number || "Facture"}
        description={(() => {
          const invoice = invoices?.find((i) => i.id === invoiceToDelete);
          if (invoice && (invoice.amount_paid || 0) > 0) {
            return `Cette facture a des paiements enregistrés totalisant ${invoice.amount_paid.toLocaleString("fr-FR")} DA — ils seront supprimés définitivement avec la facture. Cette action est irréversible.`;
          }
          return "Cette action est irréversible.";
        })()}
        isLoading={deleteInvoice.isPending}
        onConfirm={handleDelete}
      />

      <DeleteConfirmationModal
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title={`Supprimer ${selectedInvoices.length} facture${selectedInvoices.length > 1 ? "s" : ""} ?`}
        description={`Cette action est irréversible et supprimera définitivement ${selectedInvoices.length > 1 ? "ces factures" : "cette facture"}.`}
        isLoading={isBulkDeleting}
        onConfirm={handleBulkDelete}
      />

      {emailTarget && (
        <SendDocumentEmailModal
          open={emailModalOpen}
          onOpenChange={(next) => {
            setEmailModalOpen(next);
            if (!next) setEmailTarget(null);
          }}
          recipientEmail={emailTarget.clients?.email}
          fileName={`${emailTarget.invoice_type === "credit_note" ? "Avoir" : "Facture"}-${emailTarget.invoice_number || "000"}.pdf`}
          draftInput={{
            docType: "invoice",
            isCreditNote: emailTarget.invoice_type === "credit_note",
            documentNumber: emailTarget.invoice_number,
            clientName: emailTarget.clients?.name || "",
            documentDate: emailTarget.invoice_date,
            dueDate: emailTarget.due_date,
            totalTTC: emailTarget.total_ttc,
            bankRib: settings?.company_rib || null,
            bankAgency: settings?.company_bank_agency || null,
            senderCompany: settings?.company_name || "Sordi",
            items: (emailTarget.invoice_items || []).map((item: any) => ({
              name: item.product_name || item.products?.name || item.name || "Article",
              quantity: item.quantity,
              unitPrice: item.unit_price,
            })),
          } satisfies DraftInvoiceInput}
          getPdfBase64={async () => {
            const blob = await generateInvoicePDFBlob(emailTarget, settings, licenseStatus?.state === "active");
            return blobToBase64(blob);
          }}
        />
      )}
    </>
  );
}
