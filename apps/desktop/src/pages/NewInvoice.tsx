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
  ToggleGroup,
  ToggleGroupItem,
  Label,
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
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { useProjects } from "@/hooks/useProjects";
import { useCreateInvoice, useUpdateInvoice, useInvoice } from "@/hooks/useInvoices";
import { EditableInvoicePreview } from "@/components/invoice/EditableInvoicePreview";
import { generateInvoicePDF, openSavedFile } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { db } from "@/lib/database";
import { useSettings } from "@/hooks/useSettings";
import { useLicenseStatus } from "@/hooks/useLicense";
import { useParams } from "react-router-dom";
import { useClearClientDraftProducts } from "@/hooks/useClientDraftProducts";
import { useAddClientAdvance } from "@/hooks/useClientAdvances";
import { useSecureSession } from "@/hooks/useSecureSession";

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

      // Restore secondary register fields from saved invoice
      setDraftInvoice(prev => ({
        ...prev,
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


    return {
      calcSubtotal,
      calcTva: totalTva,
      calcTimbre,
      calcTotal,
      finalDiscountAmount,
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-DZ", {
      style: "decimal",
      minimumFractionDigits: 2,
    }).format(amount) + " DA";
  };

  const submitInvoice = () => {
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

  return (
        <main className="flex-1 p-8">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Button variant="ghost" onClick={() => navigate("/invoices")} className="gap-2 mb-2 p-0 h-auto hover:bg-transparent hover:text-primary">
                <ArrowLeft className="w-4 h-4" />
                {isProforma ? "Retour aux factures/proformas" : "Retour aux factures"}
              </Button>
              <h1 className="text-2xl font-semibold text-foreground">
                {id
                  ? (isProforma ? "Modifier le proforma" : "Modifier la facture")
                  : (isProforma ? "Nouvelle Facture Proforma" : "Nouvelle facture")}
              </h1>
              <p className="text-muted-foreground">
                {id
                  ? `Modification ${isProforma ? "du proforma" : "de la facture"} ${draftInvoice.invoice_number}`
                  : (isProforma ? "Créer une facture proforma / devis" : "Créer une facture en mode interactif")}
              </p>
              {!id && (lastSavedAt || resetFeedback) && (
                <div className="flex items-center gap-2 mt-1.5 select-none">
                  {/* Ambient Auto-Save Indicator */}
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full ring-2",
                        resetFeedback ? "bg-amber-500 ring-amber-500/20" : "bg-emerald-500 ring-emerald-500/20"
                      )}
                    />
                    <span>
                      {resetFeedback || `Brouillon enregistré à ${lastSavedAt?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                    </span>
                  </span>

                  {!resetFeedback && (
                    <>
                      <span className="text-slate-200 select-none">•</span>

                      {/* Discrete Reset Action */}
                      <button
                        type="button"
                        onClick={() => setShowResetConfirm(true)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium text-slate-400 hover:text-rose-600 hover:bg-rose-50/60 transition-all group"
                        title="Effacer ce brouillon et recommencer à zéro"
                      >
                        <RotateCcw className="w-3 h-3 stroke-[2] text-slate-400 group-hover:text-rose-600 transition-colors" />
                        <span>Réinitialiser</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Actions Buttons */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (!draftInvoice.clients || !draftInvoice.invoice_items || draftInvoice.invoice_items.length === 0) {
                    toast.error("Veuillez remplir les informations client et ajouter au moins un produit", {
                      id: "invoice-validation-error",
                    });
                    return;
                  }
                  const toastId = "download-invoice-pdf";
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
                className="gap-2"
              >
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isDownloading ? "Téléchargement..." : "Télécharger PDF"}
              </Button>
              <Button
                type="button"
                onClick={submitInvoice}
                disabled={!clientId || items.every(i => i.quantity === 0) || createInvoice.isPending}
                className="gap-2"
              >
                {(createInvoice.isPending || updateInvoice.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {createInvoice.isPending || updateInvoice.isPending
                  ? "Traitement..."
                  : (id ? "Mettre à jour" : (isProforma ? "Créer le proforma" : "Créer la facture"))}
              </Button>
            </div>
          </div>

          <div className="space-y-6">

            {/* Settings + live totals — a single compact bar instead of three
                stacked full-width sections. Those took ~250px of vertical
                space before reaching the actual invoice document below,
                which is the one thing this page is actually for editing;
                on a laptop screen that left barely any room for it. The
                "why" text for each control moved into a tooltip instead of
                always-visible caption text. */}
            <div className="bg-card rounded-xl border border-border px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="project_associe" className="text-xs font-medium text-muted-foreground shrink-0">Projet</Label>
                <Select
                  value={projectId || "none"}
                  onValueChange={(value) => setProjectId(value === "none" ? "" : value)}
                  disabled={!!lockedProjectId}
                >
                  <SelectTrigger id="project_associe" className="w-40 h-8 text-xs">
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
                    <InfoIcon className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    {lockedProjectId
                      ? "Verrouillé — cette facture a été créée depuis la fiche du projet."
                      : "Optionnel — la facture compte dans le chiffre d'affaires et la rentabilité du projet choisi."}
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="h-6 w-px bg-border shrink-0" aria-hidden="true" />

              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground shrink-0">TVA</Label>
                <ToggleGroup
                  type="single"
                  value={taxMode}
                  onValueChange={(value) => {
                    if (value) setTaxMode(value as "standard" | "exempt" | "ttc_direct");
                  }}
                >
                  <ToggleGroupItem value="standard" className="text-xs px-2.5 h-8">
                    Standard
                  </ToggleGroupItem>
                  <ToggleGroupItem value="exempt" className="text-xs px-2.5 h-8">
                    Hors Taxe
                  </ToggleGroupItem>
                  <ToggleGroupItem value="ttc_direct" className="text-xs px-2.5 h-8">
                    TTC Direct
                  </ToggleGroupItem>
                </ToggleGroup>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    {taxMode === "exempt"
                      ? "Hors Taxe / Sans TVA — toutes les lignes passent à 0%."
                      : taxMode === "ttc_direct"
                        ? "TTC Direct — le prix saisi par ligne est un prix TTC ; le HT est recalculé automatiquement."
                        : "Standard — chaque ligne applique sa TVA catalogue (généralement 19%)."}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Live totals — pushed to the far end, inline instead of a
                  4-cell grid of their own. */}
              <div className="ml-auto flex items-center gap-5">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sous-total H.T</p>
                  <p className="text-sm font-mono tabular-nums tracking-tight font-semibold">{formatCurrency(draftInvoice.subtotal_ht || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total TVA</p>
                  <p className="text-sm font-mono tabular-nums tracking-tight font-semibold">{formatCurrency(draftInvoice.tva_amount || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Timbre</p>
                  <p className="text-sm font-mono tabular-nums tracking-tight font-semibold">{formatCurrency(draftInvoice.timbre || 0)}</p>
                </div>
                <div className="text-right border-l border-border pl-5">
                  <p className="text-[10px] uppercase tracking-wide text-primary">Total TTC</p>
                  <p className="text-base font-mono tabular-nums tracking-tight font-bold text-primary">{formatCurrency(draftInvoice.total_ttc || 0)}</p>
                </div>
              </div>
            </div>

            {/* Editable Preview */}
            <div className="bg-muted rounded-xl p-6 overflow-auto" style={{ maxHeight: 'calc(100vh - 170px)', minHeight: '500px' }}>
              <div className="flex justify-center">
                <EditableInvoicePreview
                  invoice={draftInvoice}
                  onInvoiceChange={handleDraftInvoiceChange}
                  clients={clients}
                  products={products}
                />
              </div>
            </div>
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
        </main>
  );
}
