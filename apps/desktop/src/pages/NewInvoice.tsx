import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  RiArrowLeftLine as ArrowLeft,
  RiFileTextLine as FileText,
  RiDownloadLine as Download,
  RiLoader4Line as Loader2,
  RiInformationLine as InfoIcon
} from "@remixicon/react";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@sordi/ui";
import { RotateCcw, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { useProjects } from "@/hooks/useProjects";
import { useCreateInvoice, useUpdateInvoice, useInvoice } from "@/hooks/useInvoices";
import { EditableInvoicePreview } from "@/components/invoice/EditableInvoicePreview";
import { InvoiceCustomizeDrawer } from "@/components/invoice/InvoiceCustomizeDrawer";
import { generateInvoicePDF, openSavedFile } from "@/lib/pdfGenerator";
import { resolveInvoiceAppearance } from "@/components/pdf/invoiceAppearance";
import { toast } from "sonner";
import { db } from "@/lib/database";
import { useSettings } from "@/hooks/useSettings";
import { useLicenseStatus } from "@/hooks/useLicense";
import { useParams } from "react-router-dom";
import { useClearClientDraftProducts } from "@/hooks/useClientDraftProducts";
import { useAddClientAdvance } from "@/hooks/useClientAdvances";
import { useSecureSession } from "@/hooks/useSecureSession";
import { LicenseBlockedModal } from "@/components/licensing/LicenseBlockedModal";

interface InvoiceItem {
  product_id: string;
  product_code: string;
  product_name: string;
  product_description?: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tva_rate?: number | null; // 19, 9, null (non assujetti), or -1 (non assujetti au timbre)
  timbre_exempt?: boolean;
  products?: any;
}

interface NewInvoicePageProps {
  // Set only by the /proformas/new route — when editing an existing
  // document (the /invoices/:id/edit route, which also handles proformas
  // since there's no separate proforma edit route) the type is instead
  // derived from the loaded invoice itself, once it arrives.
  documentType?: "invoice" | "proforma";
}

export default function NewInvoicePage({ documentType: documentTypeProp = "invoice" }: NewInvoicePageProps = {}) {
  const navigate = useNavigate();

  // Sidebar focus-mode collapse for this route is handled in AppLayout.tsx
  // (keyed off the URL pathname) rather than here — see its comment for why
  // a mount-time event from this page can't reliably reach it.

  const { data: clients } = useClients();
  const { data: products } = useProducts();
  const { data: projects } = useProjects();
  const { data: settings } = useSettings();
  const { data: licenseStatus } = useLicenseStatus();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const clearDrafts = useClearClientDraftProducts();
  const { executeSecuredAction } = useSecureSession();
  const { id } = useParams<{ id: string }>(); // Get ID from URL if editing
  const { data: existingInvoice, isLoading: isLoadingInvoice } = useInvoice(id);
  const [searchParams] = useSearchParams();
  // Opened from a project's own view (e.g. "Nouvelle facture" inside
  // ProjectDetail) via /invoices/new?project_id=<id> — locks the Projet
  // associé dropdown to that project instead of leaving it editable.
  const lockedProjectId = searchParams.get("project_id");

  // Distinct localStorage draft per document type, so a stray "Nouvelle
  // facture" draft never bleeds into a fresh proforma or vice versa.
  const draftStorageKey = documentTypeProp === "proforma" ? "draft_proforma" : "draft_invoice";

  const loadDraft = () => {
    if (id) return null; // editing an existing document must never resurrect the "new" draft
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse saved invoice draft:", e);
    }
    return null;
  };
  const [draftData] = useState(loadDraft);

  // While creating, fixed by the route (/invoices/new vs /proformas/new).
  // While editing, derived from the loaded document's own invoice_type
  // once it arrives (see the "Load existing invoice data" effect below) —
  // update_invoice never touches invoice_type, so this never flips a
  // document's real type, only how this page currently labels/treats it.
  const [documentType, setDocumentType] = useState<"invoice" | "proforma">(documentTypeProp);
  const isProforma = documentType === "proforma";

  const [clientId, setClientId] = useState(draftData?.clientId || "");
  const [projectId, setProjectId] = useState<string>(lockedProjectId || draftData?.projectId || "");
  // Always default to today, even when restoring a draft — a saved client/
  // items draft is worth keeping, but a stale invoice_date silently
  // resurrected from a draft written days or months earlier (with no
  // indicator that a draft was even restored) produces invoices dated in
  // the past without the user noticing, which then don't show up in the
  // dashboard's current-period view.
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(draftData?.dueDate || "");
  const [notes, setNotes] = useState(draftData?.notes || "");
  const [headerNote, setHeaderNote] = useState(draftData?.headerNote || "");
  const [items, setItems] = useState<InvoiceItem[]>(draftData?.items || []);
  const [isFromDraftProducts, setIsFromDraftProducts] = useState(draftData?.source === 'draft_products');
  const [advancePaymentConsumed, setAdvancePaymentConsumed] = useState(draftData?.advance_payment_consumed || 0);
  const addAdvance = useAddClientAdvance();

  // Extended Invoice State
  const [paymentMode, setPaymentMode] = useState(
    draftData?.source === 'draft_products' ? "Chèque" : (draftData?.paymentMode || "Espèces")
  );
  const [discountRate, setDiscountRate] = useState<number>(draftData?.discountRate || 0);
  const [discountAmount, setDiscountAmount] = useState<number>(draftData?.discountAmount || 0);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>(draftData?.discountType || 'percent');
  const [taxMode, setTaxMode] = useState<'standard' | 'exempt' | 'ttc_direct'>(draftData?.taxMode || 'standard');
  const [customTitle, setCustomTitle] = useState(draftData?.customTitle || (documentTypeProp === "proforma" ? "Facture Proforma" : ""));
  const [isDownloading, setIsDownloading] = useState(false);
  const [customizeDrawerOpen, setCustomizeDrawerOpen] = useState(false);
  const [licenseBlockedOpen, setLicenseBlockedOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() => {
    if (draftData?.savedAt) {
      const d = new Date(draftData.savedAt);
      if (!isNaN(d.getTime())) return d;
    }
    if (draftData && (draftData.clientId || (draftData.items && draftData.items.length > 0))) {
      return new Date();
    }
    return null;
  });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

  const handleConfirmReset = async () => {
    await executeSecuredAction(() => {
      localStorage.removeItem(draftStorageKey);
      setClientId("");
      setProjectId(lockedProjectId || "");
      setInvoiceDate(new Date().toISOString().split("T")[0]);
      setDueDate("");
      setNotes("");
      setHeaderNote("");
      setCustomTitle(isProforma ? "Facture Proforma" : "");
      setPaymentMode("Espèces");
      setDiscountRate(0);
      setDiscountAmount(0);
      setDiscountType("percent");
      setTaxMode("standard");
      setAdvancePaymentConsumed(0);
      setIsFromDraftProducts(false);
      setItems([]);
      setLastSavedAt(null);
      setDraftInvoice((prev: any) => ({
        ...prev,
        clientId: "",
        client_id: "",
        clients: undefined,
        client_name: "",
        client_address: "",
        project_id: lockedProjectId || null,
        invoice_date: new Date().toISOString().split("T")[0],
        due_date: null,
        notes: null,
        header_note: null,
        custom_title: isProforma ? "Facture Proforma" : "",
        payment_method: "Espèces",
        discount_rate: 0,
        discount_amount: 0,
        discount_type: "percent",
        discount_value: 0,
        discount: 0,
        tax_mode: "standard",
        subtotal_ht: 0,
        tva_amount: 0,
        timbre: 0,
        total_ttc: 0,
        stamp_size: Number(settings?.stamp_size) || 180,
        invoice_items: [],
      }));
      setShowResetConfirm(false);
      setResetFeedback("Formulaire réinitialisé");
      setTimeout(() => {
        setResetFeedback(null);
      }, 4000);
      toast.success("Brouillon réinitialisé");
    }, "Autoriser la réinitialisation du brouillon");
  };

  useEffect(() => {
    // Editing an existing invoice must never overwrite the "new invoice"
    // draft slot — this key isn't scoped per-invoice, so writing here would
    // silently resurrect this invoice's client/items the next time someone
    // starts a genuinely new one.
    if (id) return;
    const now = new Date();
    const draft = {
      clientId,
      projectId,
      invoiceDate,
      dueDate,
      notes,
      headerNote,
      items,
      paymentMode,
      discountRate,
      discountAmount,
      discountType,
      taxMode,
      customTitle,
      source: isFromDraftProducts ? 'draft_products' : undefined,
      advance_payment_consumed: advancePaymentConsumed,
      savedAt: now.toISOString(),
    };
    // Only save if there's some meaningful data
    if (clientId || items.length > 0 || notes || headerNote) {
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      setLastSavedAt(now);
    }
  }, [id, draftStorageKey, clientId, projectId, invoiceDate, dueDate, notes, headerNote, items, paymentMode, discountRate, discountAmount, discountType, taxMode, customTitle, isFromDraftProducts, advancePaymentConsumed]);

  // Immutability guard, frontend side — mirrors the Rust `update_invoice`
  // guard (commands.rs) exactly: paid/partial/converted/cancelled invoices
  // can never be edited, only corrected via an Avoir. Reaching this route
  // directly (typed URL, stale bookmark, back-button into a since-locked
  // invoice) must redirect back to the read-only detail page instead of
  // rendering an editor that would just fail on save with INVOICE_LOCKED.
  useEffect(() => {
    if (id && existingInvoice) {
      const status = (existingInvoice as any).status;
      if (["paid", "partial", "converted", "cancelled"].includes(status)) {
        toast.warning("Document validé — modification impossible", {
          description: "Utilisez un Avoir pour corriger cette facture.",
        });
        navigate(`/invoices/${id}`, { replace: true });
      }
    }
  }, [id, existingInvoice, navigate]);

  // Load existing invoice data if editing
  useEffect(() => {
    if (existingInvoice && products) {
      const inv = existingInvoice as any;
      setDocumentType(inv.invoice_type === "proforma" ? "proforma" : "invoice");
      setClientId(inv.client_id);
      setProjectId(inv.project_id || "");
      setInvoiceDate(inv.invoice_date);
      setDueDate(inv.due_date || "");
      setNotes(inv.notes || "");
      setHeaderNote(inv.header_note || "");
      setCustomTitle(inv.custom_title || "");
      setPaymentMode(inv.payment_method || "Espèces");
      setTaxMode(inv.tax_mode || "standard");
      const type = inv.discount_type || 'percent';
      setDiscountType(type as 'percent' | 'amount');

      if (type === 'percent') {
        setDiscountRate(inv.discount_value || inv.discount_rate || 0);
        setDiscountAmount(0);
      } else {
        setDiscountRate(0);
        setDiscountAmount(inv.discount_value || inv.discount_amount || inv.discount || 0);
      }

      // Map existing items
      if (inv.invoice_items) {
        const mappedItems = inv.invoice_items.map((invItem: any) => {
          const product = products.find(p => p.id === invItem.product_id);
          return {
            product_id: invItem.product_id,
            product_code: product?.code || invItem.products?.code || "",
            product_name: product?.name || invItem.products?.name || "",
            product_description: product?.description || invItem.products?.description || "",
            quantity: invItem.quantity,
            unit_price: invItem.unit_price,
            amount: invItem.amount || (invItem.quantity * invItem.unit_price),
            tva_rate: invItem.tva_rate,
            timbre_exempt: invItem.timbre_exempt,
          };
        });
        setItems(mappedItems);
      }

      // Restore secondary register fields from saved invoice — and, just as
      // important, the invoice's real lifecycle status. The initial
      // draftInvoice state (used for brand-new invoices) has no `status`
      // field at all, so without copying it here a PAID invoice being
      // reopened for editing silently showed as a draft everywhere that
      // reads invoice.status — the canvas badge, the watermark logic, all
      // of it — not because any of them hardcode "draft", but because this
      // was the one spot that never carried the real value over in the
      // first place.
      setDraftInvoice(prev => ({
        ...prev,
        status: inv.status,
        use_secondary_register: inv.use_secondary_register || false,
        selected_secondary_rc: inv.selected_secondary_rc || null,
        selected_secondary_address: inv.selected_secondary_address || null,
      }));
    }
  }, [existingInvoice, products]);

  // Clear the selected project if it doesn't belong to the current client
  // (e.g. the client was changed after a project was already picked) — the
  // dropdown itself filters projects to the selected client, so a stale
  // cross-client selection would otherwise stay silently applied while no
  // longer being visible in the list. Skipped while locked from a project
  // context (?project_id=) since that binding is intentional and fixed.
  useEffect(() => {
    if (lockedProjectId || !projectId || !projects) return;
    const stillValid = projects.some((p) => p.id === projectId && (!clientId || p.client_id === clientId));
    if (!stillValid) setProjectId("");
  }, [clientId, projectId, projects, lockedProjectId]);

  // Opened from a project view: also pre-fill the client, since an
  // invoice always belongs to one and the locked project already implies
  // which one. Only runs once clientId is still empty, so it never
  // overrides a client the user (or an existing/draft invoice) already set.
  useEffect(() => {
    if (!lockedProjectId || clientId || !projects) return;
    const lockedProject = projects.find((p) => p.id === lockedProjectId);
    if (lockedProject) setClientId(lockedProject.client_id);
  }, [lockedProjectId, clientId, projects]);

  // Calculate totals helper function (TVA per product)
  const calculateTotals = (
    itemsList: InvoiceItem[],
    currentPaymentMode: string = "Espèces",
    currentDiscountRate: number = 0,
    currentDiscountAmount: number = 0,
    type: 'percent' | 'amount' = 'percent',
    currentTaxMode: 'standard' | 'exempt' | 'ttc_direct' = 'standard'
  ) => {
    const calcSubtotal = itemsList.reduce((sum, item) => sum + item.amount, 0);

    // Calculate Discount info
    let finalDiscountAmount = 0;
    let finalDiscountRate = 0;

    if (type === 'percent') {
      finalDiscountRate = currentDiscountRate;
      finalDiscountAmount = calcSubtotal * (currentDiscountRate / 100);
    } else {
      finalDiscountAmount = currentDiscountAmount;
      finalDiscountRate = calcSubtotal > 0 ? (currentDiscountAmount / calcSubtotal) * 100 : 0;
    }

    // Apply discount to reduction ratio for tax base
    const reductionRatio = calcSubtotal > 0 ? (calcSubtotal - finalDiscountAmount) / calcSubtotal : 1;

    // Calculate TVA per product and sum them
    let totalTva = 0;
    let totalForTimbre = 0; // Total HT + TVA for timbre calculation

    itemsList.forEach(item => {
      const itemAmountHt = item.amount;
      const tvaRate = item.tva_rate;
      // "Exonéré" forces every line to 0% regardless of its own stored
      // rate, same as the editable-preview logic in useEditableInvoiceLogic.
      const effectiveRate = currentTaxMode === 'exempt' ? 0 : (tvaRate === undefined ? 19.0 : tvaRate);
      const isTimbreExempt = item.timbre_exempt || effectiveRate === -1.0;

      // TVA is calculated on GROSS HT amount (before discount)
      const itemTva = (effectiveRate && effectiveRate > 0) ? (itemAmountHt * (effectiveRate / 100)) : 0;
      totalTva += itemTva;

      if (!isTimbreExempt) {
        // Timbre base is Gross HT + Gross TVA
        totalForTimbre += itemAmountHt + itemTva;
      }
    });

    let calcTimbre = 0;
    if (currentPaymentMode && currentPaymentMode.toLowerCase().includes("espèc") && totalForTimbre > 0) {
      const amount = totalForTimbre;
      let rate = 0.01;
      if (amount > 100000) {
        rate = 0.02; // Over 100k
      } else if (amount > 30000) {
        rate = 0.015; // 30k to 100k
      } else {
        rate = 0.01; // 0 to 30k
      }
      calcTimbre = amount * rate;
      if (calcTimbre < 5) calcTimbre = 5;
      if (calcTimbre > 20000) calcTimbre = 20000;
    }

    const calcTotal = (calcSubtotal - finalDiscountAmount) + totalTva + calcTimbre;

    // Every monetary figure above is built from chained floating-point
    // multiplication/division (rate percentages, discount ratios, the
    // timbre bracket math) and can carry residue past 2 decimals (e.g.
    // 894.6955000000001) that a naive display format would round to 3
    // decimals instead of 2 (Intl.NumberFormat's maximumFractionDigits
    // defaults to max(minimumFractionDigits, 3) when only
    // minimumFractionDigits is set — that's what produced the "894,696 DA"
    // glitch). Rounding here, once, at the source, means every consumer of
    // these totals (this page, the invoice actually saved to the database,
    // the PDF) works from the same clean 2-decimal values instead of each
    // needing its own display-layer rounding to hide the same underlying
    // imprecision.
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

    return {
      calcSubtotal: round2(calcSubtotal),
      calcTva: round2(totalTva),
      calcTimbre: round2(calcTimbre),
      calcTotal: round2(calcTotal),
      finalDiscountAmount: round2(finalDiscountAmount),
      finalDiscountRate
    };
  };

  // Initial totals
  const initialTotals = calculateTotals(items, paymentMode, discountRate, discountAmount, discountType, taxMode);
  const calculatedDiscountAmount = initialTotals.finalDiscountAmount;

  // Get next invoice number for preview
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState<string>("");

  useEffect(() => {
    const fetchNextInvoiceNumber = async () => {
      try {
        const number = await db.invoices.getNextNumber();
        setNextInvoiceNumber(number);
      } catch (error) {
        console.error("Error fetching next invoice number:", error);
      }
    };
    fetchNextInvoiceNumber();
  }, []);

  // Build draft invoice for preview - editable version
  const [draftInvoice, setDraftInvoice] = useState(() => {
    const totals = calculateTotals(items);
    return {
      // Proformas are numbered by the backend at save time (PRO-<timestamp>,
      // a separate sequence from real invoices) — this placeholder is never
      // sent as-is (see submitInvoice), just shown until it's saved.
      invoice_number: documentTypeProp === "proforma" ? "PRO-..." : "",
      invoice_type: documentTypeProp,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      subtotal_ht: totals.calcSubtotal,
      tva_rate: (items.length > 0 && items[0].tva_rate !== undefined) ? items[0].tva_rate : 19.0, // Best guess or keep generic
      tva_amount: totals.calcTva,
      timbre: totals.calcTimbre,
      total_ttc: totals.calcTotal,
      notes: notes || null,
      header_note: headerNote || null,
      payment_method: paymentMode,
      discount_rate: discountRate,
      discount_amount: calculatedDiscountAmount,
      discount_value: discountType === 'percent' ? discountRate : discountAmount,
      discount: calculatedDiscountAmount,
      discount_type: discountType,
      tax_mode: taxMode,
      project_id: projectId || null,
      use_secondary_register: false,
      selected_secondary_rc: null as string | null,
      selected_secondary_address: null as string | null,
      clients: undefined as any,
      invoice_items: [] as any[],
      custom_title: customTitle, // Initialize custom_title
    };
  });

  // Update invoice number when nextInvoiceNumber is fetched — proformas are
  // numbered by the backend at save time instead (see the draftInvoice
  // initializer above), so the fetched sequential number doesn't apply here.
  useEffect(() => {
    if (nextInvoiceNumber && !id && !isProforma) { // Only set number if NEW invoice
      setDraftInvoice(prev => ({
        ...prev,
        invoice_number: nextInvoiceNumber,
      }));
    } else if (id && existingInvoice) {
      // Keep existing number
      setDraftInvoice(prev => ({
        ...prev,
        invoice_number: existingInvoice.invoice_number,
      }));
    }
  }, [nextInvoiceNumber, id, isProforma, existingInvoice]);

  // Sync draft invoice with form state
  useEffect(() => {
    const selectedClient = clients?.find(c => c.id === clientId);
    const validItems = items.filter(item => item.quantity > 0);
    const totals = calculateTotals(validItems, paymentMode, discountRate, discountAmount, discountType, taxMode);
    const calcSubtotal = totals.calcSubtotal;
    const calcTva = totals.calcTva;
    const calcTimbre = totals.calcTimbre;
    const calcTotal = totals.calcTotal;

    setDraftInvoice(prev => ({
      ...prev,
      invoice_type: documentType,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      notes: notes || null,
      header_note: headerNote || null,
      subtotal_ht: calcSubtotal,
      tva_amount: calcTva,
      timbre: calcTimbre,
      total_ttc: calcTotal,
      payment_method: paymentMode,
      discount_rate: discountRate,
      discount_amount: totals.finalDiscountAmount,
      discount_value: discountType === 'percent' ? discountRate : discountAmount,
      discount: totals.finalDiscountAmount,
      discount_type: discountType,
      tax_mode: taxMode,
      project_id: projectId || null,
      clients: selectedClient ? {
        name: selectedClient.name,
        address: selectedClient.address || null,
        nif: selectedClient.nif || null,
        nis: selectedClient.nis || null,
        rc: selectedClient.rc || null,
        secondary_rc: selectedClient.secondary_rc || null,
        secondary_address: selectedClient.secondary_address || null,
        ai: selectedClient.ai || null,
      } : undefined,
      invoice_items: validItems.map(item => {
        const product = products?.find(p => p.id === item.product_id);
        const fallbackProductInfo = item.products ? item.products : { code: item.product_code, name: item.product_name, description: item.product_description };
        return {
          product_id: item.product_id,
          products: product ? {
            id: product.id,
            code: product.code,
            name: product.name,
            description: product.description || undefined,
            unit: product.unit || null,
          } : fallbackProductInfo, // Provide fallback when products isn't fully loaded
          quantity: item.quantity,
          unit_price: item.unit_price,
          tva_rate: taxMode === 'exempt' ? 0 : (item.tva_rate === undefined ? 19.0 : item.tva_rate),
        };
      }),
    }));
  }, [documentType, clientId, projectId, invoiceDate, dueDate, items, notes, headerNote, clients, products, paymentMode, discountRate, discountAmount, discountType, taxMode]);

  // Sync form state with draft invoice changes
  const handleDraftInvoiceChange = (updatedInvoice: any) => {
    // invoice_number is populated asynchronously (from existingInvoice
    // when editing, or getNextNumber() when creating) — if the editable
    // preview's own onInvoiceChange fires from a stale closure captured
    // before that resolved, its spread of the old `invoice` prop still
    // carries an empty invoice_number, and since this is a full replace
    // (not a merge), that empty value would otherwise get locked in
    // permanently and fail the update with a raw NOT NULL/UNIQUE error at
    // save time. Never let this full replace erase a real number the page
    // already knows about.
    setDraftInvoice((prev: any) => ({
      ...updatedInvoice,
      invoice_number: updatedInvoice.invoice_number || prev.invoice_number,
    }));

    // Update form state from draft
    setInvoiceDate(updatedInvoice.invoice_date || invoiceDate);
    setDueDate(updatedInvoice.due_date || "");
    setNotes(updatedInvoice.notes || "");
    setHeaderNote(updatedInvoice.header_note || "");
    setPaymentMode(updatedInvoice.payment_method || "Espèces");
    if (updatedInvoice.tax_mode) setTaxMode(updatedInvoice.tax_mode);

    const type = updatedInvoice.discount_type || 'percent';
    setDiscountType(type);

    if (type === 'percent') {
      setDiscountRate(updatedInvoice.discount_value || updatedInvoice.discount_rate || 0);
      setDiscountAmount(0);
    } else {
      setDiscountRate(0);
      setDiscountAmount(updatedInvoice.discount_value || updatedInvoice.discount_amount || 0);
    }

    setCustomTitle(updatedInvoice.custom_title || "");

    // Update client — matched by name since the preview only carries a
    // display name, not the id. Two clients sharing a name would otherwise
    // silently bind the invoice to whichever matches first, so only act
    // on an unambiguous match.
    if (updatedInvoice.clients?.name) {
      const matches = clients?.filter(c => c.name === updatedInvoice.clients.name) ?? [];
      if (matches.length === 1) {
        setClientId(matches[0].id);
      } else if (matches.length > 1) {
        console.warn(`Ambiguous client name "${updatedInvoice.clients.name}" matched ${matches.length} clients — keeping current selection.`);
      }
    }

    // Update items — the preview (useEditableInvoiceLogic) already owns
    // add/update/delete/reorder for invoice_items, so its output is the
    // source of truth here. Re-deriving items via a catalog product_id
    // lookup (the old approach) silently dropped any item without a
    // matching catalog product — which is exactly what a custom/one-off
    // line item is by design.
    if (updatedInvoice.invoice_items) {
      setItems(updatedInvoice.invoice_items.map((item: any) => ({
        product_id: item.product_id,
        product_code: item.product_code || item.products?.code || "",
        product_name: item.product_name || item.products?.name || "",
        product_description: item.product_description || item.products?.description || "",
        quantity: item.quantity || 0,
        unit_price: item.unit_price || 0,
        amount: (item.quantity || 0) * (item.unit_price || 0),
        tva_rate: item.tva_rate,
        timbre_exempt: item.timbre_exempt,
        products: item.products,
      })));
    }
  };

  // Local, deliberately not Intl.NumberFormat with only minimumFractionDigits
  // set — that combination defaults maximumFractionDigits to 3, which is
  // exactly the "894,696 DA" 3-decimal glitch fixed elsewhere in this page.
  // draftInvoice.total_ttc is already rounded to 2 decimals at the source
  // (calculateTotals' round2), so this is just safe display formatting.
  const formatDockTotal = (amount: number) => {
    const formatted = (amount || 0).toFixed(2).replace('.', ',');
    const [intPart, decPart] = formatted.split(',');
    return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${decPart} DA`;
  };

  const submitInvoice = () => {
    if (licenseStatus?.state !== "active") {
      setLicenseBlockedOpen(true);
      return;
    }

    const validItems = items.filter(item => item.quantity > 0);

    if (!clientId || validItems.length === 0) {
      if (!clientId) toast.error("Veuillez sélectionner un client");
      if (validItems.length === 0) toast.error("Veuillez ajouter au moins un produit");
      return;
    }

    const payload = {
      client_id: clientId,
      invoice_date: invoiceDate,
      due_date: dueDate || undefined,
      notes: notes || undefined,
      header_note: headerNote || undefined,
      custom_title: draftInvoice.custom_title,
      // Proformas are numbered by the backend at save time (its own
      // PRO-<timestamp> sequence, separate from real invoices) — sending
      // the unresolved "PRO-..." preview placeholder as a real number would
      // both skip that and collide across every unsaved proforma.
      invoice_number: (isProforma && (!draftInvoice.invoice_number || draftInvoice.invoice_number === "PRO-..."))
        ? undefined
        : draftInvoice.invoice_number,
      invoice_type: documentType,
      payment_method: paymentMode,
      use_secondary_register: draftInvoice.use_secondary_register,
      selected_secondary_rc: draftInvoice.selected_secondary_rc || undefined,
      selected_secondary_address: draftInvoice.selected_secondary_address || undefined,
      // Never force a status for proformas — leaving it undefined keeps the
      // backend's own default on create ("issued") and, on update, keeps
      // whatever status the proforma already has (e.g. "converted") intact
      // instead of silently reverting it every time the form is saved.
      status: isProforma ? undefined : (isFromDraftProducts ? "paid" : "issued"),
      amount_paid: isFromDraftProducts ? draftInvoice.total_ttc : 0, // Auto-fill the paid amount
      discount: draftInvoice.discount_amount, // The flat amount for legacy/total displays
      discount_type: discountType,
      discount_value: discountType === 'percent' ? discountRate : discountAmount,
      tax_mode: taxMode,
      project_id: projectId || undefined,
      items: validItems.map(item => ({
        product_id: item.product_id || undefined,
        // Only meaningful when product_id is absent — a custom/one-off item.
        product_name: item.product_id ? undefined : item.product_name || undefined,
        product_code: item.product_id ? undefined : item.product_code || undefined,
        product_description: item.product_description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        // "Exonéré" forces every line to 0% at submit time regardless of
        // its own stored rate, matching the live totals/preview above.
        tva_rate: taxMode === 'exempt' ? 0 : (item.tva_rate === undefined ? 19.0 : item.tva_rate),
        timbre_exempt: item.timbre_exempt ?? false,
      })),
    };

    const listDestination = isProforma ? "/invoices?tab=proformas" : "/invoices";

    if (id) {
      // UPDATE MODE
      updateInvoice.mutate({ id, data: payload }, {
        onSuccess: () => {
          localStorage.removeItem(draftStorageKey);
          navigate(listDestination); // Or navigate back to detail
        }
      });
    } else {
      // CREATE MODE
      createInvoice.mutate(payload, {
        onSuccess: async (createdInvoice) => {
          localStorage.removeItem(draftStorageKey);

          if (isFromDraftProducts && advancePaymentConsumed > 0) {
            // Clear the draft products queue
            clearDrafts.mutate(clientId);

            // Deduct from client advance payment
            // Deduct from client advance payment via negative advance entry
            addAdvance.mutate({
              client_id: clientId,
              amount: -advancePaymentConsumed,
              date: new Date().toISOString(),
              payment_mode: "Déduction Facture",
              notes: `Déduction pour facture ${createdInvoice.invoice_number}`
            });
          }

          // toast handled in hook
          navigate(listDestination);
        },
      });
    }
  };

  // Status-aware toolbar message for an EXISTING invoice being reopened
  // (id set) — distinct from the localStorage-draft autosave indicator
  // below, which only ever applies to a brand-new, not-yet-saved invoice.
  // Without this, the toolbar simply showed nothing for a saved invoice
  // (that autosave block is gated on `!id`), which read as "this must
  // still be a draft" by omission — not a hardcoded string anywhere, just
  // a state this toolbar never accounted for.
  const existingInvoiceStatusDisplay = (() => {
    const status = draftInvoice.status;
    if (status === "paid") {
      return { dot: "bg-emerald-500", text: "text-emerald-600 font-medium", label: "Facture payée" };
    }
    if (status === "partial") {
      return { dot: "bg-blue-500", text: "text-blue-600 font-medium", label: "Paiement partiel" };
    }
    if (status === "issued" || status === "overdue") {
      return { dot: "bg-blue-500", text: "text-blue-600 font-medium", label: "Validée · En attente de paiement" };
    }
    if (status === "cancelled") {
      return { dot: "bg-rose-500", text: "text-rose-600 font-medium", label: "Facture annulée" };
    }
    // draft, converted, or no status yet loaded
    return { dot: "bg-amber-500", text: "text-muted-foreground", label: "Brouillon" };
  })();

  return (
        <main className="flex-1 flex flex-col min-h-0 w-full max-w-full overflow-x-hidden">
          {/* Single unified toolbar — replaces the old stacked title row +
              actions row + settings/totals card (~250px of vertical space
              before any of the actual document was visible). Sticky so it
              stays reachable while a long multi-page invoice scrolls
              underneath it. */}
          <header className="sticky top-0 h-10 w-full max-w-full border-b border-border/80 bg-background/95 backdrop-blur-sm px-4 flex items-center justify-between gap-4 shrink-0 z-30 overflow-hidden select-none">
            {/* Left Section — Navigation & Document Identity. The one
                section allowed to compress (title truncates, the
                autosave/reset block hides first) — `gap-4` on the header
                itself guarantees real space between sections regardless of
                how much (or little) `justify-between` has left to
                distribute, and every element here is a normal in-flow flex
                child (no absolute/relative positioning anywhere in this
                bar), so nothing can render on top of anything else. */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => navigate("/invoices")}
                    className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Retour</TooltipContent>
              </Tooltip>
              <div className="h-4 w-px bg-border shrink-0" aria-hidden="true" />
              {/* Never truncates — `truncate` needs a shrinkable ancestor
                  (`min-w-0`) to ever kick in, and that's exactly what made
                  this collapse to "No…" under any pressure. `shrink-0` here
                  and on the parent above means the autosave block (already
                  hidden below `xl`) is the only thing that ever gives way. */}
              <span className="text-xs font-semibold font-mono text-foreground shrink-0 whitespace-nowrap">
                {id
                  ? (isProforma ? "Modifier le proforma" : "Modifier la facture")
                  : (isProforma ? "Nouvelle facture" : "Nouvelle facture")}
                {(draftInvoice.invoice_number || nextInvoiceNumber) && (
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    N° {draftInvoice.invoice_number || nextInvoiceNumber}
                  </span>
                )}
              </span>
              {!id && (lastSavedAt || resetFeedback) && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground whitespace-nowrap">
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        resetFeedback ? "bg-amber-500" : "bg-emerald-500"
                      )}
                    />
                    {/* Below `lg` only the dot survives — the timestamp text
                        is the first thing to go once the window is tight,
                        well before anything load-bearing has to move. */}
                    <span className="hidden lg:inline">
                      {resetFeedback || `Enregistré à ${lastSavedAt?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                    </span>
                  </span>
                  {!resetFeedback && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setShowResetConfirm(true)}
                          className="h-6 w-6 rounded-md hover:bg-muted text-muted-foreground/70 hover:text-foreground flex items-center justify-center transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Réinitialiser le brouillon</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
              {/* Reopening a saved invoice (id set) — its real lifecycle
                  status, not the new-draft autosave indicator above. */}
              {id && (
                <span className={cn("inline-flex items-center gap-1.5 text-[10px] whitespace-nowrap shrink-0", existingInvoiceStatusDisplay.text)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", existingInvoiceStatusDisplay.dot)} />
                  <span className="hidden lg:inline">{existingInvoiceStatusDisplay.label}</span>
                </span>
              )}
            </div>

            {/* Center Section — Scoped Document Settings. Hidden below lg
                rather than wrapped, a 56px bar has no room to wrap into. */}
            <div className="hidden lg:flex items-center gap-3 shrink-0">
              <Select
                value={projectId || "none"}
                onValueChange={(value) => setProjectId(value === "none" ? "" : value)}
                disabled={!!lockedProjectId}
              >
                <SelectTrigger id="project_associe" className="w-[160px] h-7 text-xs font-medium rounded-md">
                  <SelectValue placeholder="Aucun projet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun projet</SelectItem>
                  {projects
                    ?.filter((p) => !clientId || p.client_id === clientId)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* RemixIcon components aren't forwardRef-wrapped — asChild
                      needs a real DOM-ref-capable element (Radix's Slot
                      clones its child and attaches a ref), so the icon is
                      wrapped in a span rather than passed directly. */}
                  <span className="inline-flex shrink-0">
                    <InfoIcon className="w-3.5 h-3.5 text-muted-foreground/60" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  Affecte cette facture à un projet pour suivre le chiffre d'affaires et la rentabilité dans les rapports analytiques.
                </TooltipContent>
              </Tooltip>

              <div className="h-4 w-px bg-border" aria-hidden="true" />

              <div className="inline-flex items-center h-[26px] p-0.5 bg-muted rounded-md text-[11px] font-medium gap-0.5">
                {([
                  ["standard", "Standard"],
                  ["exempt", "HT"],
                  ["ttc_direct", "TTC"],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTaxMode(mode)}
                    className={cn(
                      "px-2 h-full rounded-sm transition-colors",
                      taxMode === mode
                        ? "bg-card shadow-sm text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* RemixIcon components aren't forwardRef-wrapped — asChild
                      needs a real DOM-ref-capable element (Radix's Slot
                      clones its child and attaches a ref), so the icon is
                      wrapped in a span rather than passed directly. */}
                  <span className="inline-flex shrink-0">
                    <InfoIcon className="w-3.5 h-3.5 text-muted-foreground/60" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  {taxMode === "exempt"
                    ? "HT (Exonération) — Ventes exonérées de TVA (franchise de taxe, ANADE/NESDA, export). Mention légale d'exonération insérée en pied de page."
                    : taxMode === "ttc_direct"
                      ? "TTC Direct (Détaxation) — Prix saisis Toutes Taxes Comprises. Montant HT et TVA déduits automatiquement sans écarts."
                      : "Standard (Régime Réel) — Prix saisis en Hors Taxe. Calcul automatique de la TVA (19% ou 9%) et du timbre fiscal (1%) si paiement en espèces."}
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Right Section — secondary document actions only; the primary
                "Créer la facture" CTA lives in the floating dock below the
                header, not here (see its own comment for why). */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "gap-1.5 h-[30px] px-2.5 text-xs rounded-md font-medium",
                  customizeDrawerOpen && "bg-primary/10 text-primary border-primary/30"
                )}
                onClick={() => setCustomizeDrawerOpen((prev) => !prev)}
              >
                <Palette className="w-3.5 h-3.5" />
                Personnaliser
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 h-[30px] px-2.5 text-xs rounded-md font-medium"
                onClick={async () => {
                  if (!draftInvoice.clients || !draftInvoice.invoice_items || draftInvoice.invoice_items.length === 0) {
                    toast.error("Veuillez remplir les informations client et ajouter au moins un produit", {
                      id: "invoice-validation-error",
                    });
                    return;
                  }
                  const toastId = "download-invoice-pdf";
                  const resolvedAppearance = resolveInvoiceAppearance(draftInvoice, settings);
                  console.log('🚀 [PDF_EXPORT_PAYLOAD]', { invoiceId: draftInvoice?.id, resolvedAppearance });
                  try {
                    setIsDownloading(true);
                    toast.loading("Génération du PDF...", { id: toastId });
                    await generateInvoicePDF(
                      draftInvoice,
                      settings,
                      true,
                      undefined,
                      licenseStatus?.state === "active",
                      ({ path, blob, fileName }) => {
                        toast.success(isProforma ? "Facture proforma PDF générée" : "Facture PDF générée", {
                          id: toastId,
                          description: "Le fichier a été enregistré avec succès.",
                          action: {
                            label: "Ouvrir",
                            onClick: () => openSavedFile(path, blob),
                          },
                          duration: 5000,
                        });
                      }
                    );
                  } catch (error) {
                    console.error("PDF generation error:", error);
                    toast.error("Erreur lors de la génération du PDF", { id: toastId });
                  } finally {
                    setIsDownloading(false);
                  }
                }}
                disabled={isDownloading || !draftInvoice.clients || !draftInvoice.invoice_items || draftInvoice.invoice_items.length === 0}
              >
                {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {/* Collapses to "PDF" before the header ever has to
                    truncate or overflow anything load-bearing. */}
                <span className="hidden lg:inline">{isDownloading ? "Téléchargement..." : "Télécharger PDF"}</span>
                <span className="lg:hidden">{isDownloading ? "..." : "PDF"}</span>
              </Button>
            </div>
          </header>

          {/* Floating Action Dock — the primary "Créer la facture" CTA lives
              here instead of the header now: with navigation, document
              identity, autosave, project/TVA settings, and two secondary
              buttons already in that 56px bar, adding a third full-width
              button there is what clipped it at the viewport edge
              ("Créer la factur…"). A fixed dock in the workspace margin has
              no such budget — it never competes with the header's own
              content for space, so it can't overflow regardless of window
              width. */}
          <div
            className={cn(
              "fixed bottom-6 z-30 pointer-events-auto flex items-center gap-4 p-2 pl-5 bg-card/95 backdrop-blur-md border border-border/80 shadow-xl shadow-zinc-900/10 rounded-2xl transition-[right] duration-300 ease-out",
              customizeDrawerOpen ? "right-[calc(18rem+2rem)]" : "right-8"
            )}
          >
            <div className="text-right leading-tight">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total TTC</div>
              <span className="font-mono font-bold text-sm text-foreground">{formatDockTotal(draftInvoice.total_ttc)}</span>
            </div>
            <div className="h-6 w-px bg-border" aria-hidden="true" />
            <Button
              type="button"
              size="default"
              className="h-10 px-5 font-medium rounded-xl gap-2"
              onClick={submitInvoice}
              disabled={!clientId || items.every(i => i.quantity === 0) || createInvoice.isPending}
            >
              {(createInvoice.isPending || updateInvoice.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {createInvoice.isPending || updateInvoice.isPending
                ? "Traitement..."
                : (id ? "Mettre à jour" : (isProforma ? "Créer le proforma" : "Créer la facture"))}
            </Button>
          </div>

          {/* Canvas + Inspector share one flex row now, instead of the
              inspector being a `fixed` overlay with a guessed top offset —
              that offset only ever accounted for this page's own 56px
              toolbar, not the app's global Header sitting above it too, so
              the inspector's own header rendered hidden behind both bars
              stacked together. As a normal flex sibling it starts exactly
              where the canvas starts, whatever stacks above; the canvas's
              flex-1 also means it reflows on its own the moment the
              inspector mounts/unmounts, no manual margin needed. */}
          <div className="flex flex-1 w-full overflow-hidden relative min-h-0">
            {/* A plain, non-scrolling flex host. ScaleToFit itself (inside
                EditableInvoicePreview.tsx) owns the actual scroll region,
                the neutral backdrop, and the horizontal centering — kept
                there rather than duplicated here so there's exactly one
                place responsible for fitting the document to the viewport. */}
            <div className="flex-1 min-h-0 min-w-0 bg-zinc-100/60 dark:bg-zinc-950">
              <EditableInvoicePreview
                invoice={draftInvoice}
                onInvoiceChange={handleDraftInvoiceChange}
                clients={clients}
                products={products}
              />
            </div>

            <InvoiceCustomizeDrawer open={customizeDrawerOpen} onOpenChange={setCustomizeDrawerOpen} />
          </div>

          {/* Safety Confirmation Dialog for Resetting Draft */}
          <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Réinitialiser ce brouillon ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Voulez-vous réinitialiser ce brouillon ? Toutes les données non enregistrées seront perdues.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmReset}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Réinitialiser
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <LicenseBlockedModal open={licenseBlockedOpen} onOpenChange={setLicenseBlockedOpen} />
        </main>
  );
}
