import { Fragment, useMemo, useState } from "react";
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
  RiErrorWarningLine as AlertCircle,
  RiFileTextLine as FileTextIcon,
  RiScales3Line as Scales,
} from "@remixicon/react";
import { Button, Checkbox, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, TableLoading, EmptyState, Tooltip, TooltipTrigger, TooltipContent, DesktopSegmentedControl, StatusBadge } from "@sordi/ui";
import { MetricStrip } from "@/components/ui/metric-strip";
import { cn } from "@/lib/utils";
import { useInvoices, useDeleteInvoice, useConvertProforma, useUpdateInvoiceStatus, type InvoiceStatus, type InvoiceType } from "@/hooks/useInvoices";
import { generateInvoicePDF, generateInvoicePDFBlob, blobToBase64, downloadBlobsAsZip, openSavedFile, resolveDocumentFileName } from "@/lib/pdfGenerator";
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
import { useTableKeyboardNav } from "@/hooks/useTableKeyboardNav";
import { FacetedSearchInput, type SearchFacet } from "@/components/common/FacetedSearchInput";
import { GridGroupBySelect, type GroupByOption } from "@/components/common/GridGroupBySelect";
import { RiArrowDownSLine as ChevronDown, RiArrowRightSLine as ChevronRight } from "@remixicon/react";

// Payment/approval STATUS only — never a document type. Which document
// type this whole page shows is fixed by the route (see DOCUMENT_CONFIG
// below and the documentType prop), not by a tab; strict route isolation
// means "Factures", "Devis", "Factures Proforma" and "Avoirs" each get
// their own page instance instead of sharing tabs that used to also
// double as a type filter.
//
// The set of STATUSES shown is also per document type, not shared — a
// Devis is never "Payée"/"En attente" (that's an invoice payment/collection
// state), it moves through its own Brouillon/Envoyé/Accepté/Refusé/Expiré
// lifecycle instead. Proforma/Avoir keep the invoice-style tabs/menu
// unchanged (not part of this fix's reported scope).
const STATUS_TABS_INVOICE_LIKE: { label: string; status?: InvoiceStatus }[] = [
  { label: "Toutes", status: undefined },
  { label: "Payées", status: "paid" },
  { label: "En attente", status: "issued" },
];
const STATUS_MENU_INVOICE_LIKE: { label: string; status: InvoiceStatus }[] = [
  { label: "Payée", status: "paid" },
  { label: "Émise (Impayée)", status: "issued" },
  { label: "Brouillon", status: "draft" },
  { label: "Annulée", status: "cancelled" },
];

const STATUS_TABS_QUOTE: { label: string; status?: InvoiceStatus }[] = [
  { label: "Toutes", status: undefined },
  { label: "Brouillon", status: "draft" },
  { label: "Envoyé", status: "sent" },
  { label: "Accepté", status: "accepted" },
  { label: "Refusé", status: "rejected" },
  { label: "Expiré", status: "expired" },
];
const STATUS_MENU_QUOTE: { label: string; status: InvoiceStatus }[] = [
  { label: "Brouillon", status: "draft" },
  { label: "Envoyé", status: "sent" },
  { label: "Accepté", status: "accepted" },
  { label: "Refusé", status: "rejected" },
  { label: "Expiré", status: "expired" },
];

interface DocumentTypeConfig {
  pageTitle: string;
  pageDescription: string;
  /** Singular noun used in row counts ("3 devis", "1 avoir") — French
   *  pluralization varies enough (facture/factures, devis/devis,
   *  avoir/avoirs) that this needs its own plural form too. */
  nounSingular: string;
  nounPlural: string;
  createLabel: string;
  createPath: string;
  emptyTitle: string;
  emptyDescription: string;
  deleteTitle: string;
  /** The segmented-control tabs above the table — status only, never a
   *  document-type filter (see the module comment above). */
  statusTabs: { label: string; status?: InvoiceStatus }[];
  /** The per-row "change status" dropdown options — a strict subset/
   *  reflection of statusTabs' own lifecycle, so a row can never be set to
   *  a status its own document type doesn't have a tab for. */
  statusMenu: { label: string; status: InvoiceStatus }[];
}

const DOCUMENT_CONFIG: Record<InvoiceType, DocumentTypeConfig> = {
  invoice: {
    pageTitle: "Facturation & Créances",
    pageDescription: "Gérez vos factures et suivez vos encaissements",
    nounSingular: "facture",
    nounPlural: "factures",
    createLabel: "Facture",
    createPath: "/invoices/new",
    emptyTitle: "Aucune facture",
    emptyDescription: "Créez votre première facture",
    deleteTitle: "Supprimer la facture",
    statusTabs: STATUS_TABS_INVOICE_LIKE,
    statusMenu: STATUS_MENU_INVOICE_LIKE,
  },
  quote: {
    pageTitle: "Devis",
    pageDescription: "Gérez vos devis clients",
    nounSingular: "devis",
    nounPlural: "devis",
    createLabel: "Devis",
    createPath: "/devis/new",
    emptyTitle: "Aucun devis",
    emptyDescription: "Créez votre premier devis",
    deleteTitle: "Supprimer le devis",
    statusTabs: STATUS_TABS_QUOTE,
    statusMenu: STATUS_MENU_QUOTE,
  },
  proforma: {
    pageTitle: "Factures Proforma",
    pageDescription: "Gérez vos factures proforma",
    nounSingular: "proforma",
    nounPlural: "proformas",
    createLabel: "Proforma",
    createPath: "/proformas/new",
    emptyTitle: "Aucune proforma",
    emptyDescription: "Créez votre première facture proforma",
    deleteTitle: "Supprimer la proforma",
    statusTabs: STATUS_TABS_INVOICE_LIKE,
    statusMenu: STATUS_MENU_INVOICE_LIKE,
  },
  credit_note: {
    pageTitle: "Avoirs",
    pageDescription: "Gérez vos avoirs et notes de crédit",
    nounSingular: "avoir",
    nounPlural: "avoirs",
    createLabel: "Avoir",
    createPath: "/invoices/credit-note/new",
    emptyTitle: "Aucun avoir",
    emptyDescription: "Créez votre premier avoir",
    deleteTitle: "Supprimer l'avoir",
    statusTabs: STATUS_TABS_INVOICE_LIKE,
    statusMenu: STATUS_MENU_INVOICE_LIKE,
  },
};

const GROUP_BY_OPTIONS: GroupByOption[] = [
  { value: "none", label: "Aucun regroupement" },
  { value: "client", label: "Regrouper par Client" },
  { value: "period", label: "Regrouper par Mois / Période" },
  { value: "status", label: "Regrouper par Statut" },
];


interface InvoicesPageProps {
  /** Fixed by the route that mounted this page (see App.tsx's /factures,
   *  /devis, /proformas, /avoirs routes) — strict route isolation means
   *  this never changes based on a tab or dropdown, only on which URL the
   *  sidebar link navigated to. */
  documentType?: InvoiceType;
}

export default function InvoicesPage({ documentType = "invoice" }: InvoicesPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const config = DOCUMENT_CONFIG[documentType];
  const docLabel = config.nounSingular.charAt(0).toUpperCase() + config.nounSingular.slice(1);

  const getInitialTab = () => {
    const statusParam = searchParams.get("status");
    if (!statusParam) return 0;
    const index = config.statusTabs.findIndex((tab) => tab.status === statusParam);
    return index === -1 ? 0 : index;
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const { data: invoices, isLoading, isError, refetch } = useInvoices(config.statusTabs[activeTab]?.status, documentType);
  // Unfiltered (within this route's own document type) — the metric strip
  // always summarizes the whole picture for this type, independent of the
  // active status tab, matching how Suppliers.tsx and Products.tsx build
  // their own strips from the full dataset rather than whatever subset the
  // table happens to be showing. Only ever rendered for the Factures route
  // (see showMetricStrip below), so this stays cheap elsewhere.
  const { data: allInvoices } = useInvoices(undefined, documentType);
  const deleteInvoice = useDeleteInvoice();
  const convertProforma = useConvertProforma();
  const { data: settings } = useSettings();
  const { data: licenseStatus } = useLicenseStatus();
  const updateStatus = useUpdateInvoiceStatus();
  const { executeSecuredAction } = useSecureSession();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFacets, setSearchFacets] = useState<SearchFacet[]>([]);
  const [groupBy, setGroupBy] = useState("none");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
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
    const status = config.statusTabs[index]?.status;
    setSearchParams(status ? { status } : {});
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

  // Filter + sort over the full (now 200+) invoice list — memoized so it
  // only re-runs when the data or the actual query/facets/sort change,
  // not on every unrelated re-render (selection toggles, hover state,
  // keyboard-nav focus, etc.).
  const filteredInvoices = useMemo(() => {
    return invoices?.filter((invoice: any) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesQuery =
        !searchQuery ||
        invoice.invoice_number?.toLowerCase().includes(searchLower) ||
        invoice.clients?.name?.toLowerCase().includes(searchLower) ||
        invoice.total_ttc?.toString().includes(searchLower);

      // Faceted pills — each is an additional AND condition on top of the
      // plain-text query above, same "contains"/">=" semantics as the
      // suggestion that created it (FacetedSearchInput just hands back
      // {field, value}; interpreting the field is this page's job).
      const matchesFacets = searchFacets.every((facet) => {
        if (facet.field === "number") return (invoice.invoice_number || "").toLowerCase().includes(facet.value.toLowerCase());
        if (facet.field === "client") return (invoice.clients?.name || "").toLowerCase().includes(facet.value.toLowerCase());
        if (facet.field === "amount") return (invoice.total_ttc || 0) >= parseFloat(facet.value);
        return true;
      });

      return matchesQuery && matchesFacets;
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
  }, [invoices, searchQuery, searchFacets, sortConfig]);

  // Group-by buckets — groupBy === "none" yields one unlabeled bucket so
  // flat and grouped rendering share the same code path below. Order of
  // groups follows first-appearance in the already-sorted list (so sorting
  // by client A→Z + grouping by client naturally reads alphabetically).
  // Subtotals mirror the row-level "-" convention for credit notes so a
  // group's Total TTC matches what its rows visually sum to.
  const invoiceGroups = useMemo(() => {
    const list = filteredInvoices ?? [];
    if (groupBy === "none") {
      return [{ key: "__all__", title: "", invoices: list, total: 0 }];
    }
    const order: string[] = [];
    const map = new Map<string, { key: string; title: string; invoices: any[]; total: number }>();
    for (const invoice of list) {
      let key: string;
      let title: string;
      if (groupBy === "client") {
        title = invoice.clients?.name || "Client inconnu";
        key = `client:${title}`;
      } else if (groupBy === "period") {
        const d = new Date(invoice.invoice_date);
        if (isNaN(d.getTime())) {
          key = "period:unknown";
          title = "Date inconnue";
        } else {
          key = `period:${d.getFullYear()}-${d.getMonth()}`;
          const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
          title = label.charAt(0).toUpperCase() + label.slice(1);
        }
      } else {
        key = `status:${invoice.status}`;
        title = getInvoiceStatusConfig(invoice.status).label;
      }
      if (!map.has(key)) {
        map.set(key, { key, title, invoices: [], total: 0 });
        order.push(key);
      }
      const group = map.get(key)!;
      group.invoices.push(invoice);
      group.total += invoice.invoice_type === "credit_note" ? -(invoice.total_ttc || 0) : (invoice.total_ttc || 0);
    }
    return order.map((key) => map.get(key)!);
  }, [filteredInvoices, groupBy]);

  const groupPrefix = groupBy === "client" ? "Client" : groupBy === "period" ? "Période" : groupBy === "status" ? "Statut" : "";

  // Flat visible order (skips collapsed groups' rows) — both the keyboard
  // hook's arrow/Enter navigation and the row-index-based highlight below
  // must agree on this exact order, or a hidden row could end up "focused".
  const visibleInvoices = useMemo(
    () => invoiceGroups.flatMap((group) => (collapsedGroups.has(group.key) ? [] : group.invoices)),
    [invoiceGroups, collapsedGroups]
  );

  // O(1) lookup from an invoice back to its position in visibleInvoices, so
  // the grouped render below doesn't do an O(n) indexOf per row.
  const indexById = useMemo(
    () => new Map(visibleInvoices.map((invoice, i) => [invoice.id, i])),
    [visibleInvoices]
  );

  // Desktop keyboard ergonomics — N opens a new invoice, Escape clears the
  // search box, ArrowUp/ArrowDown + Enter select and open a row.
  const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
    rows: visibleInvoices,
    onOpen: (invoice: any) => navigate(`/invoices/${invoice.id}`),
    onCreate: () => navigate(config.createPath),
    onEscape: () => {
      setSearchQuery("");
      setSearchFacets([]);
    },
  });

  const toggleGroupCollapsed = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-DZ", {
      style: "currency",
      currency: "DZD",
    }).format(amount);
  };

  // Metric strip — pure summation over fields the backend already computes
  // (total_ttc, amount_paid, balance_due) and stores per invoice; nothing
  // here recalculates a document's own totals or payment status. Only
  // meaningful on the Factures route: proformas/devis aren't fiscal
  // invoices with real collections against them, and avoirs are already
  // netted against real invoices elsewhere — so this whole strip is
  // skipped on those 3 routes (see showMetricStrip below) rather than
  // inventing revenue-style metrics for document types that don't have one.
  const showMetricStrip = documentType === "invoice";
  const realInvoices = (allInvoices ?? []).filter((inv: any) => inv.invoice_type === "invoice" && inv.status !== "cancelled" && inv.status !== "draft");
  const totalFacture = realInvoices.reduce((sum: number, inv: any) => sum + (inv.total_ttc || 0), 0);
  const totalEncaisse = realInvoices.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0);
  const unpaidInvoices = realInvoices.filter((inv: any) => inv.status === "issued" || inv.status === "partial");
  const resteARecouvrer = unpaidInvoices.reduce((sum: number, inv: any) => sum + (inv.balance_due ?? (inv.total_ttc || 0) - (inv.amount_paid || 0)), 0);
  const today = new Date();
  const facturesEnRetard = unpaidInvoices.filter((inv: any) => inv.due_date && new Date(inv.due_date) < today).length;

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

      await generateInvoicePDF(invoiceForPDF, settings, true, undefined, licenseStatus?.license_state, ({ path, blob }) => {
        toast.success("PDF généré", {
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

  // Smart Business Copy — a client-ready one-line summary (reference,
  // amount, status/balance), not the raw internal UUID, which is useless
  // for anything a business owner would actually paste into an email or
  // WhatsApp message to a client.
  const handleCopyInvoiceSummary = (invoice: any) => {
    const reference = invoice.invoice_number || invoice.id;
    const balance = invoice.balance_due ?? 0;
    const summary =
      balance > 0
        ? `${docLabel} N° ${reference} | Montant: ${formatCurrency(invoice.total_ttc)} | Reste dû: ${formatCurrency(balance)}`
        : `${docLabel} N° ${reference} — ${formatCurrency(invoice.total_ttc)} (${getInvoiceStatusConfig(invoice.status).label})`;
    navigator.clipboard.writeText(summary).then(
      () => toast.success(`Résumé ${documentType === "invoice" ? "de la facture" : "du document"} copié`),
      () => toast.error("Impossible de copier le résumé")
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
          const blob = await generateInvoicePDFBlob(invoiceForPDF, settings, licenseStatus?.license_state);
          const fileName = resolveDocumentFileName(invoiceForPDF);
          return { blob, fileName };
        })
      );
      const files = results.filter((r): r is PromiseFulfilledResult<{ blob: Blob; fileName: string }> => r.status === "fulfilled").map((r) => r.value);
      const failed = results.length - files.length;

      if (files.length === 0) {
        toast.error("Aucun PDF n'a pu être généré");
        return;
      }

      await downloadBlobsAsZip(files, `${config.nounPlural}-${new Date().toISOString().split("T")[0]}.zip`);
      toast.success(
        failed === 0
          ? `${files.length} ${config.nounSingular}${files.length > 1 ? "s" : ""} téléchargée${files.length > 1 ? "s" : ""} (ZIP)`
          : `${files.length} ${config.nounSingular}(s) téléchargées, ${failed} en échec`
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
        toast.success(`${results.length} document${results.length > 1 ? "s" : ""} supprimé${results.length > 1 ? "s" : ""}`);
      } else {
        toast.error(`${failed} document(s) sur ${results.length} n'ont pas pu être supprimés`);
      }
      clearSelection();
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Row renderer shared by the flat list and the grouped-by view below —
  // `index` is always this invoice's position in the flat VISIBLE order
  // (visibleInvoices), so keyboard-nav highlighting stays correct whether
  // grouping is on or off.
  const renderInvoiceRow = (invoice: any, index: number) => {
                    const isCreditNote = invoice.invoice_type === "credit_note";
                    const isProforma = invoice.invoice_type === "proforma";
                    const statusConfig = getInvoiceStatusConfig(invoice.status);
                    const isCancelled = invoice.status === "cancelled";
                    return (
                      <TableRow
                        key={invoice.id}
                        className={cn(
                          "h-9 border-border/40 hover:bg-muted/20 text-xs cursor-pointer",
                          focusedIndex === index && "bg-muted/40 ring-1 ring-inset ring-ring/40"
                        )}
                        dimmed={isCancelled}
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                        onMouseEnter={() => setFocusedIndex(index)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedInvoices.includes(invoice.id)}
                            onCheckedChange={() => toggleInvoice(invoice.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {/* No per-row type chip — every row on this page is
                              already the same document type (strict route
                              isolation), so a type badge would just repeat
                              what the page title already says. */}
                          <span className="font-mono font-medium tabular-nums tracking-tight">{invoice.invoice_number}</span>
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
                                {/* Options come strictly from this route's own
                                    documentType (config.statusMenu) — a Devis
                                    row can only ever move through its own
                                    Brouillon/Envoyé/Accepté/Refusé/Expiré
                                    lifecycle, never an invoice payment status
                                    like "Payée". */}
                                {config.statusMenu.map((option) => {
                                  const isDraftLocked = option.status === "draft" && (documentType === "invoice" || documentType === "credit_note");
                                  return (
                                    <DropdownMenuItem
                                      key={option.status}
                                      disabled={isDraftLocked}
                                      onClick={() => updateStatus.mutate({ id: invoice.id, status: option.status })}
                                      title={isDraftLocked ? "Ce document porte un numéro séquentiel officiel et ne peut pas être remis en brouillon" : undefined}
                                    >
                                      {option.label}
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()} className="w-24 shrink-0 text-right">
                          {/* Hidden until the row is hovered/focused — Linear-style
                              contextual actions instead of permanently-visible icon clutter.
                              The cell itself has a fixed w-24 so opacity toggling never
                              changes the column's reserved width (it always had one, just
                              implicitly — this makes it explicit and guards against future
                              button-count changes reflowing every row on hover). */}
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all text-muted-foreground hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyInvoiceSummary(invoice);
                                  }}
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Copier le résumé</TooltipContent>
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
                                  Modifier {documentType === "invoice" ? "la facture" : documentType === "credit_note" ? "l'avoir" : documentType === "quote" ? "le devis" : "la proforma"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenEmailModal(invoice.id)}>
                                  <MailIcon className="mr-2 h-4 w-4" />
                                  Envoyer par email
                                </DropdownMenuItem>
                                {/* Convertir/Paiement/Avoir are all Facture-lifecycle
                                    actions that only make sense on their own
                                    dedicated routes now — a quote is never
                                    "converted" the way a proforma is (no
                                    equivalent command exists), and only a real
                                    invoice can take a payment or an avoir
                                    against it. */}
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
                                {documentType === "invoice" && (
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
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{config.pageTitle}</h1>
              <p className="text-sm text-muted-foreground mt-1">{config.pageDescription}</p>
            </div>

            <div className="flex items-center gap-3">
              {/* One direct, contextual CTA — no dropdown, no cross-type
                  picker. Which document type this button creates is fixed
                  by the route this page instance was mounted for (strict
                  route isolation), so it never needs to branch on anything
                  at click time. Same brand-red treatment as the titlebar's
                  own "+ Facture" button (Header.tsx). */}
              <Button
                className="h-[30px] px-3 text-xs rounded-md gap-1.5 bg-primary text-primary-foreground hover:bg-primary-hover"
                onClick={() => navigate(config.createPath)}
              >
                <Plus className="w-3.5 h-3.5" />
                {config.createLabel}
                <kbd className="ml-1 text-[10px] font-mono text-primary-foreground/70 border border-primary-foreground/30 rounded px-1 py-px">N</kbd>
              </Button>
            </div>
          </div>

          {/* Metric strip — Factures only (see showMetricStrip's own
              comment above): proformas/devis/avoirs don't have a
              collections/overdue story the same way a real invoice does. */}
          {showMetricStrip && (
            <div className="mb-6 animate-fade-in-up animation-delay-100">
              <MetricStrip
                cells={[
                  { key: "facture", label: "Total Facturé (TTC)", value: formatCurrency(totalFacture), numericValue: totalFacture, format: formatCurrency, icon: FileTextIcon },
                  { key: "encaisse", label: "Total Encaissé", value: formatCurrency(totalEncaisse), numericValue: totalEncaisse, format: formatCurrency, icon: CreditCard },
                  {
                    key: "reste",
                    label: "Reste à Recouvrer",
                    value: formatCurrency(resteARecouvrer),
                    numericValue: resteARecouvrer,
                    format: formatCurrency,
                    icon: Scales,
                    trend: resteARecouvrer > 0 ? <StatusBadge tone="warning">À recouvrer</StatusBadge> : <StatusBadge tone="neutral">Soldé</StatusBadge>,
                  },
                  {
                    key: "retard",
                    label: "Factures en Retard",
                    value: String(facturesEnRetard),
                    numericValue: facturesEnRetard,
                    format: (v) => String(Math.round(v)),
                    icon: AlertCircle,
                    trend: facturesEnRetard > 0 ? <StatusBadge tone="error">En retard</StatusBadge> : undefined,
                  },
                ]}
              />
            </div>
          )}

          {/* Tabs and Search — rest directly on the page canvas, no card
              wrapper; a single hairline divider closes off the filter row
              instead of a full bordered/shadowed box.
              Two strict flex zones, never one unconstrained flex-between
              row: the left (tabs) zone is `shrink-0` so it always renders
              at its full intrinsic width and scrolls internally
              (`overflow-x-auto`) rather than being squeezed by its sibling;
              the right (search/group-by/sort) zone is `flex-1 justify-end`
              with its own `max-w-xl` ceiling, and FacetedSearchInput is
              wrapped in a fixed-footprint div (`w-64 min-w-[200px]
              max-w-[280px]`) instead of sizing itself off a bare `w-72`
              className — the input's own internal flex-row layout (pills +
              text field) can't out-negotiate its neighbors for width. */}
          <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-border/40 animate-fade-in-up animation-delay-150">
            <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
              <DesktopSegmentedControl
                className="h-[30px]"
                options={config.statusTabs.map((tab, index) => ({ value: String(index), label: tab.label }))}
                value={String(activeTab)}
                onChange={(value) => handleTabChange(Number(value))}
              />
              <span className="text-xs text-muted-foreground font-mono tabular-nums ps-2 shrink-0 whitespace-nowrap">
                {invoices?.length || 0} {(invoices?.length || 0) > 1 ? config.nounPlural : config.nounSingular}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-1 justify-end max-w-xl">
              <div className="w-64 min-w-[200px] max-w-[280px]">
                <FacetedSearchInput
                  query={searchQuery}
                  onQueryChange={setSearchQuery}
                  facets={searchFacets}
                  onFacetsChange={setSearchFacets}
                  placeholder="Rechercher..."
                  className="w-full"
                />
              </div>

              <GridGroupBySelect value={groupBy} onChange={setGroupBy} options={GROUP_BY_OPTIONS} />

              <Select
                value={`${sortConfig.key}-${sortConfig.direction}`}
                onValueChange={(val) => {
                  const [key, direction] = val.split('-');
                  setSortConfig({ key, direction: direction as 'asc' | 'desc' });
                }}
              >
                <SelectTrigger className="h-[30px] w-[160px] text-xs rounded-md border-border/80">
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
            </div>
          </div>

          {/* Bulk action bar */}
          <div className="pt-4">
            <BulkActionBar count={selectedInvoices.length} onClear={clearSelection}>
              {/* "Marquer comme payées" only makes sense for real invoices —
                  proformas/devis aren't fiscal documents with a collection
                  status, and avoirs are already credits, not something you
                  "pay". */}
              {documentType === "invoice" && (
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
              )}
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

          {/* Table — edge-to-edge desktop data grid: a clean bordered card
              instead of a borderless surface, matching Suppliers.tsx's Phase
              2 grid treatment. */}
          <div className="animate-fade-in-up animation-delay-200 border border-border/80 rounded-md bg-card overflow-hidden w-full">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent h-8 bg-muted/40">
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
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoading columns={7} rows={5} />
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState
                        icon={AlertCircle}
                        tone="destructive"
                        title="Échec du chargement des données"
                        description="Une erreur est survenue lors du chargement des factures."
                        action={{ label: "Réessayer", onClick: () => refetch() }}
                      />
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState
                        type="invoices"
                        title={config.emptyTitle}
                        description={searchQuery || searchFacets.length > 0 ? "Essayez une autre recherche" : config.emptyDescription}
                        action={searchQuery || searchFacets.length > 0 ? {
                          label: "Effacer la recherche",
                          onClick: () => { setSearchQuery(""); setSearchFacets([]); },
                        } : {
                          label: "Créer",
                          onClick: () => navigate(config.createPath),
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  groupBy === "none" ? (
                    visibleInvoices.map((invoice, index) => renderInvoiceRow(invoice, index))
                  ) : (
                    invoiceGroups.map((group) => {
                      const collapsed = collapsedGroups.has(group.key);
                      return (
                        <Fragment key={group.key}>
                          <TableRow className="h-7 bg-muted/40 hover:bg-muted/40 border-y border-border/40">
                            <TableCell colSpan={7} className="p-0">
                              <button
                                type="button"
                                onClick={() => toggleGroupCollapsed(group.key)}
                                className="w-full h-7 font-semibold text-xs px-3 flex items-center justify-between gap-3 text-left"
                              >
                                <span className="flex items-center gap-1.5 min-w-0">
                                  {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                  <span className="truncate">
                                    {groupPrefix}: {group.title} ({group.invoices.length} facture{group.invoices.length > 1 ? "s" : ""})
                                  </span>
                                </span>
                                <span className="font-mono tabular-nums shrink-0">Total TTC: {formatCurrency(group.total)}</span>
                              </button>
                            </TableCell>
                          </TableRow>
                          {!collapsed && group.invoices.map((invoice) => renderInvoiceRow(invoice, indexById.get(invoice.id) ?? -1))}
                        </Fragment>
                      );
                    })
                  )
                )}
              </TableBody>
            </Table>
          </div>
          </div>
      </main>

      <DeleteConfirmationModal
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={config.deleteTitle}
        itemIdentifier={invoices?.find((i) => i.id === invoiceToDelete)?.invoice_number || docLabel}
        description={(() => {
          const invoice = invoices?.find((i) => i.id === invoiceToDelete);
          if (invoice && (invoice.amount_paid || 0) > 0) {
            return `Ce document a des paiements enregistrés totalisant ${invoice.amount_paid.toLocaleString("fr-FR")} DA — ils seront supprimés définitivement avec lui. Cette action est irréversible.`;
          }
          return "Cette action est irréversible.";
        })()}
        isLoading={deleteInvoice.isPending}
        onConfirm={handleDelete}
      />

      <DeleteConfirmationModal
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title={`Supprimer ${selectedInvoices.length} ${selectedInvoices.length > 1 ? config.nounPlural : config.nounSingular} ?`}
        description={`Cette action est irréversible et supprimera définitivement ${selectedInvoices.length > 1 ? "ces documents" : "ce document"}.`}
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
          fileName={resolveDocumentFileName(emailTarget)}
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
            const blob = await generateInvoicePDFBlob(emailTarget, settings, licenseStatus?.license_state);
            return blobToBase64(blob);
          }}
        />
      )}
    </>
  );
}
