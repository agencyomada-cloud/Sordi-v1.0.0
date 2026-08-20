import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  RiArrowLeftLine as ArrowLeft, 
  RiFileTextLine as FileText, 
  RiArrowRightUpLine as TrendingUp, 
  RiArrowRightDownLine as TrendingDown, 
  RiTimeLine as Clock, 
  RiBox3Line as Package, 
  RiCloseLine as X, 
  RiPencilLine as Pencil, 
  RiDownloadLine as Download, 
  RiUserLine as User, 
  RiPhoneLine as Phone, 
  RiMailLine as Mail, 
  RiMapPinLine as MapPin, 
  RiBuildingLine as Building2, 
  RiBankLine as Landmark, 
  RiCheckboxCircleLine as BadgeCheck, 
  RiBankCardLine as CreditCard, 
  RiCalendarLine as CalendarDays, 
  RiScales3Line as Scale, 
  RiHashtag as Hash, 
  RiErrorWarningLine as AlertCircle 
} from "@remixicon/react";
import { Button, Badge, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from "@sordi/ui";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useClient, useUpdateClient, useClientOverviewStats, type CreateClientData } from "@/hooks/useClients";
import { useInvoices, useUpdateInvoiceStatus, type InvoiceStatus } from "@/hooks/useInvoices";
import { computeAveragePaymentDelay, computePurchaseFrequency, computeClientStatus } from "@/lib/clientOverview";
import { ClientStatusBadge } from "@/components/ClientStatusBadge";
import { useClientProducts } from "@/hooks/useClientProducts";
import { useProducts } from "@/hooks/useProducts";
import { useClientDraftProducts, useAddClientDraftProduct, useUpdateClientDraftProductQuantity, useDeleteClientDraftProduct, useClearClientDraftProducts } from "@/hooks/useClientDraftProducts";
import { useClientAdvances, useAddClientAdvance, useUpdateClientAdvance, useDeleteClientAdvance } from "@/hooks/useClientAdvances";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  issued: { label: "Émise", variant: "outline" },
  paid: { label: "Payée", variant: "default" },
  partial: { label: "Partielle", variant: "outline" },
  overdue: { label: "En retard", variant: "destructive" },
  cancelled: { label: "Annulée", variant: "secondary" },
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Filters state
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>();
  const [selectedYear, setSelectedYear] = useState<number | undefined>();

  // Draft Products State
  const [draftProductSearch, setDraftProductSearch] = useState("");
  const [draftQuantity, setDraftQuantity] = useState<number>(1);
  const [draftDiscountType, setDraftDiscountType] = useState<'percent' | 'amount'>('percent');
  const [draftDiscountRate, setDraftDiscountRate] = useState<number>(0);
  const [draftDiscountAmount, setDraftDiscountAmount] = useState<number>(0);

  // Add Advance State
  const [isAddAdvanceDialogOpen, setIsAddAdvanceDialogOpen] = useState(false);
  const [addAdvanceAmount, setAddAdvanceAmount] = useState<number>(0);
  const [addAdvanceDate, setAddAdvanceDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [addAdvancePaymentMode, setAddAdvancePaymentMode] = useState("Chèque");
  const [addAdvanceBank, setAddAdvanceBank] = useState("");
  const [addAdvanceReference, setAddAdvanceReference] = useState("");
  const [addAdvanceIssuerName, setAddAdvanceIssuerName] = useState("");
  const [addAdvanceNote, setAddAdvanceNote] = useState("");
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);

  // Advance history filter state
  const [advanceFilterMode, setAdvanceFilterMode] = useState("all");
  const [advanceFilterDateFrom, setAdvanceFilterDateFrom] = useState("");
  const [advanceFilterDateTo, setAdvanceFilterDateTo] = useState("");

  // Edit State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateClientData>({
    name: "",
    code: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    wilaya: "",
    nif: "",
    nis: "",
    rc: "",
    secondary_rc: "",
    secondary_address: "",
    ai: "",
    contact_person: "",
    notes: "",
    initial_balance: 0,
    advance_payment: 0,
    credit_limit: 0,
    payment_terms_days: 0,
  });

  // Build month filter (YYYY-MM format)
  const monthFilter = useMemo(() => {
    if (selectedYear && selectedMonth) {
      return `${selectedYear}-${selectedMonth}`;
    }
    return selectedMonth;
  }, [selectedYear, selectedMonth]);

  const { data: client, isLoading: isLoadingClient } = useClient(id);
  const { data: overviewStatsList } = useClientOverviewStats(id);
  const overviewStats = overviewStatsList?.[0];
  const { data: allInvoices, isLoading: isLoadingInvoices } = useInvoices();
  const { data: products } = useProducts();
  const { data: clientProducts, isLoading: isLoadingProducts, error: productsError } = useClientProducts(
    id,
    {
      productId: selectedProductId,
      month: monthFilter,
      year: selectedYear && !selectedMonth ? selectedYear : undefined,
    }
  );
  const { data: draftProducts } = useClientDraftProducts(id);
  const addDraft = useAddClientDraftProduct();
  const updateDraftQty = useUpdateClientDraftProductQuantity();
  const deleteDraft = useDeleteClientDraftProduct();
  const clearDrafts = useClearClientDraftProducts();

  const { data: clientAdvances } = useClientAdvances(id);
  const addClientAdvance = useAddClientAdvance();
  const updateClientAdvance = useUpdateClientAdvance();
  const deleteClientAdvance = useDeleteClientAdvance();

  const updateStatus = useUpdateInvoiceStatus();
  const updateClient = useUpdateClient();

  const queryClient = useQueryClient();

  // Helper to safely parse secondary_rc into an array of objects
  const parseSecondaryRc = (rcStr: string | null | undefined): { rc: string, address: string }[] => {
    if (!rcStr) return [{ rc: "", address: "" }];
    try {
      const parsed = JSON.parse(rcStr);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        return parsed;
      }
    } catch (e) {
      // It's probably the old format (newline or pipe separated string)
      const parts = rcStr.split(/[\n|,]/).map(s => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        return parts.map(p => ({ rc: p, address: "" }));
      }
    }
    return [{ rc: "", address: "" }];
  };

  // Handle Edit Click
  const handleEditClick = () => {
    if (client) {
      setFormData({
        name: client.name || "",
        code: client.code || "",
        phone: client.phone || "",
        email: client.email || "",
        address: client.address || "",
        city: client.city || "",
        wilaya: client.wilaya || "",
        nif: client.nif || "",
        nis: client.nis || "",
        rc: client.rc || "",
        secondary_rc: JSON.stringify(parseSecondaryRc(client.secondary_rc)),
        secondary_address: client.secondary_address || "",
        ai: client.ai || "",
        contact_person: client.contact_person || "",
        notes: client.notes || "",
        initial_balance: client.initial_balance || 0,
        advance_payment: client.advance_payment || 0,
        credit_limit: client.credit_limit || 0,
        payment_terms_days: client.payment_terms_days || 0,
      });
      setIsEditDialogOpen(true);
    }
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    updateClient.mutate({ id, ...formData }, {
      onSuccess: () => {
        setIsEditDialogOpen(false);
      }
    });
  };

  const downloadInvoicesCSV = () => {
    const headers = ["N° Facture", "Date", "Échéance", "Montant TTC", "Payé", "Solde", "Statut"];
    const rows = clientInvoices.map(inv => [
      inv.invoice_number,
      format(new Date(inv.invoice_date), "dd/MM/yyyy"),
      inv.due_date ? format(new Date(inv.due_date), "dd/MM/yyyy") : "-",
      inv.total_ttc || 0,
      inv.amount_paid || 0,
      inv.balance_due || 0,
      inv.status || "draft"
    ]);
    // Add BOM for Excel UTF-8 support
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Factures_${client?.name || "Client"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get available years and months from invoices
  const availableYears = useMemo(() => {
    if (!allInvoices) return [];
    const years = new Set<number>();
    allInvoices.forEach(inv => {
      if (inv.client_id === id) {
        const year = new Date(inv.invoice_date).getFullYear();
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allInvoices, id]);

  const months = [
    { value: "01", label: "Janvier" },
    { value: "02", label: "Février" },
    { value: "03", label: "Mars" },
    { value: "04", label: "Avril" },
    { value: "05", label: "Mai" },
    { value: "06", label: "Juin" },
    { value: "07", label: "Juillet" },
    { value: "08", label: "Août" },
    { value: "09", label: "Septembre" },
    { value: "10", label: "Octobre" },
    { value: "11", label: "Novembre" },
    { value: "12", label: "Décembre" },
  ];

  // Calculate totals
  const totals = useMemo(() => {
    if (!clientProducts || clientProducts.length === 0) {
      return { totalQuantity: 0, totalAmount: 0, unit: "" };
    }
    // Use the unit of the first product as a representative for the total
    const representativeUnit = clientProducts[0]?.unit || "";

    return clientProducts.reduce(
      (acc, p) => ({
        ...acc,
        totalQuantity: acc.totalQuantity + (p.total_quantity || 0),
        totalAmount: acc.totalAmount + (p.total_amount || 0),
      }),
      { totalQuantity: 0, totalAmount: 0, unit: representativeUnit }
    );
  }, [clientProducts]);

  const hasFilters = selectedProductId || monthFilter || (selectedYear && !selectedMonth);

  const clearFilters = () => {
    setSelectedProductId(undefined);
    setSelectedMonth(undefined);
    setSelectedYear(undefined);
  };

  // Filter invoices for this client
  const clientInvoices = allInvoices?.filter(inv => inv.client_id === id) || [];

  // Calculate stats
  const stats = {
    total: clientInvoices.length,
    totalAmount: clientInvoices.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0),
    paid: clientInvoices.filter(inv => inv.status === "paid").length,
    paidAmount: clientInvoices.filter(inv => inv.status === "paid").reduce((sum, inv) => sum + (inv.total_ttc || 0), 0),
    unpaid: clientInvoices.filter(inv => ["issued", "partial", "overdue"].includes(inv.status || "")).length,
    unpaidAmount: clientInvoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0),
  };

  const handleStatusChange = (invoiceId: string, newStatus: InvoiceStatus) => {
    updateStatus.mutate(
      { id: invoiceId, status: newStatus },
      {
        onSuccess: () => {
          // Invalidate client products when invoice status changes
          if (id) {
            // The query will be invalidated by the hook, but we can also do it here
          }
        },
      }
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-DZ", {
      style: "currency",
      currency: "DZD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const draftTotals = useMemo(() => {
    let subtotalHtBeforeDiscount = 0;
    let tvaAmount = 0;

    draftProducts?.forEach(p => {
      subtotalHtBeforeDiscount += p.amount;

      // Attempt to get product info for tva rate if not in draft
      const productInfo = products?.find(prod => prod.id === p.product_id);
      const tvaRate = p.tva_rate ?? productInfo?.tva_rate ?? 19.0;

      // TVA calculated on GROSS HT (before discount)
      const itemTva = (tvaRate > 0) ? (p.amount * (tvaRate / 100)) : 0;
      tvaAmount += itemTva;
    });

    const calculatedDiscount = draftDiscountType === 'percent'
      ? subtotalHtBeforeDiscount * (draftDiscountRate / 100)
      : draftDiscountAmount;

    let subtotalHt = subtotalHtBeforeDiscount - calculatedDiscount;
    if (subtotalHt < 0) subtotalHt = 0;

    const totalTtc = subtotalHt + tvaAmount;
    const ttcAvantRemise = subtotalHtBeforeDiscount + tvaAmount;

    return { subtotalHtBeforeDiscount, calculatedDiscount, subtotalHt, tvaAmount, totalTtc, ttcAvantRemise };
  }, [draftProducts, products, draftDiscountType, draftDiscountRate, draftDiscountAmount]);

  const totalDraftAmount = draftTotals.totalTtc;

  // Calculate true advance payment dynamically from history explicitly to prevent bugs from desynced old data
  const calculatedAdvancePayment = useMemo(() => {
    if (!clientAdvances || clientAdvances.length === 0) return 0;
    return clientAdvances.reduce((sum, adv) => sum + (adv.amount || 0), 0);
  }, [clientAdvances]);

  const advancePayment = calculatedAdvancePayment;
  const remainingAdvance = advancePayment - totalDraftAmount;

  // Filtered advances for the history table
  const filteredAdvances = useMemo(() => {
    if (!clientAdvances) return [];
    return clientAdvances.filter((adv) => {
      if (advanceFilterMode !== "all" && adv.payment_mode !== advanceFilterMode) return false;
      if (advanceFilterDateFrom) {
        const advDate = adv.date.split("T")[0];
        if (advDate < advanceFilterDateFrom) return false;
      }
      if (advanceFilterDateTo) {
        const advDate = adv.date.split("T")[0];
        if (advDate > advanceFilterDateTo) return false;
      }
      return true;
    });
  }, [clientAdvances, advanceFilterMode, advanceFilterDateFrom, advanceFilterDateTo]);

  const handleExportAdvancesCSV = () => {
    if (!filteredAdvances || filteredAdvances.length === 0) return;
    const headers = ["Date", "Mode de paiement", "Banque", "Référence", "Émetteur", "Notes", "Montant (DA)"];
    const rows = filteredAdvances.map((adv) => [
      format(new Date(adv.date), "dd/MM/yyyy"),
      adv.payment_mode,
      adv.bank || "",
      adv.reference || "",
      adv.issuer_name || "",
      adv.notes || "",
      adv.amount.toFixed(2),
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `avances_${client?.name || "client"}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddDraftProduct = () => {
    if (!id || !draftProductSearch) return;

    // Find product to get unit price
    const product = products?.find(p => p.id === draftProductSearch);
    if (!product) return;

    const amountHt = draftQuantity * product.unit_price;
    const itemTvaRate = product.tva_rate ?? 19.0;
    const itemTva = (itemTvaRate > 0) ? (amountHt * (itemTvaRate / 100)) : 0;
    const amountTtc = amountHt + itemTva;

    if (totalDraftAmount + amountTtc > advancePayment) {
      toast.warning("Attention: Le montant a dépassé l'avance disponible. Le reste sera négatif.");
      // We no longer return here, allowing the product to be added
    }

    addDraft.mutate({
      client_id: id,
      product_id: product.id,
      quantity: draftQuantity,
      unit_price: product.unit_price,
    }, {
      onSuccess: () => {
        setDraftProductSearch("");
        setDraftQuantity(1);
      }
    });
  };

  const handleAddAdvanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || addAdvanceAmount <= 0 || !id) return;

    const requiresBankDetails = addAdvancePaymentMode === "Chèque" || addAdvancePaymentMode === "Virement";
    if (requiresBankDetails && (!addAdvanceBank.trim() || !addAdvanceReference.trim())) {
      toast.error("Veuillez saisir la banque et le numéro de référence pour ce mode de paiement.");
      return;
    }

    const payload = {
      client_id: id,
      amount: addAdvanceAmount,
      date: addAdvanceDate,
      payment_mode: addAdvancePaymentMode,
      reference: requiresBankDetails ? addAdvanceReference : undefined,
      bank: requiresBankDetails ? addAdvanceBank : undefined,
      issuer_name: requiresBankDetails ? addAdvanceIssuerName : undefined,
      notes: addAdvanceNote || undefined,
    };

    const cleanupForm = () => {
      setIsAddAdvanceDialogOpen(false);
      setEditingAdvanceId(null);
      setAddAdvanceAmount(0);
      setAddAdvanceDate(format(new Date(), "yyyy-MM-dd"));
      setAddAdvancePaymentMode("Chèque");
      setAddAdvanceBank("");
      setAddAdvanceReference("");
      setAddAdvanceIssuerName("");
      setAddAdvanceNote("");
    };

    if (editingAdvanceId) {
      updateClientAdvance.mutate({ id: editingAdvanceId, ...payload }, {
        onSuccess: cleanupForm
      });
    } else {
      addClientAdvance.mutate(payload, {
        onSuccess: cleanupForm
      });
    }
  };

  const handleEditAdvance = (advance: any) => {
    setEditingAdvanceId(advance.id);
    setAddAdvanceAmount(advance.amount);
    setAddAdvanceDate(advance.date);
    setAddAdvancePaymentMode(advance.payment_mode);
    setAddAdvanceReference(advance.reference || "");
    setAddAdvanceBank(advance.bank || "");
    setAddAdvanceIssuerName(advance.issuer_name || "");
    setAddAdvanceNote(advance.notes || "");
    setIsAddAdvanceDialogOpen(true);
  };

  const handleDeleteAdvance = (advanceId: string) => {
    if (!id) return;
    deleteClientAdvance.mutate({ id: advanceId, client_id: id });
  };

  const handleGenerateInvoiceFromDrafts = () => {
    if (!draftProducts || draftProducts.length === 0 || !client) return;

    const invoiceItems = draftProducts.map(p => ({
      product_id: p.product_id,
      quantity: p.quantity,
      unit_price: p.unit_price,
      amount: p.amount,
      tva_rate: p.tva_rate,
      timbre_exempt: p.timbre_exempt,
      products: {
        code: p.product_code || "",
        name: p.product_name || "",
      }
    }));

    const draftData = {
      source: 'draft_products',
      clientId: client.id,
      items: invoiceItems,
      advance_payment_consumed: totalDraftAmount, // Record how much of advance is consumed
      discountRate: draftDiscountType === 'percent' ? draftDiscountRate : 0,
      discountAmount: draftDiscountType === 'amount' ? draftDiscountAmount : 0,
      discountType: draftDiscountType,
    };

    localStorage.setItem("draft_invoice", JSON.stringify(draftData));
    navigate("/invoices/new");
  };

  if (isLoadingClient || isLoadingInvoices || isLoadingProducts) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-8">
            <div className="text-center py-12 text-muted-foreground">Chargement...</div>
          </main>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-8">
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">Client non trouvé</p>
              <Button onClick={() => navigate("/clients")}>Retour aux clients</Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/clients")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-foreground">{client.name}</h1>
              <p className="text-muted-foreground">
                {client.code && `${client.code} • `}
                {client.wilaya || "Algérie"}
              </p>
            </div>
            <Button className="gap-2 rounded-full" onClick={handleEditClick}>
              <Pencil className="w-4 h-4" />
              Modifier
            </Button>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="overview">Aperçu</TabsTrigger>
              <TabsTrigger value="invoices">Factures</TabsTrigger>
              <TabsTrigger value="products">Produits achetés</TabsTrigger>
              <TabsTrigger value="advances">Avances & Pré-paiements</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0">
              {/* Aperçu — computed entirely from invoices/payments at query time, never stored */}
              {overviewStats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Chiffre d'affaires total</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold">{formatCurrency(overviewStats.total_revenue)}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Client depuis</CardTitle>
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold">
                        {format(new Date(overviewStats.client_since), "d MMM yyyy", { locale: fr })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Délai de paiement moyen</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold">{computeAveragePaymentDelay(overviewStats).display}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Fréquence d'achat</CardTitle>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-base font-bold leading-snug">{computePurchaseFrequency(overviewStats).display}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Statut</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ClientStatusBadge status={computeClientStatus(overviewStats)} />
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Factures</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalAmount)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Payées</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
                    <p className="text-xs text-muted-foreground">{formatCurrency(stats.paidAmount)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">En Attente</CardTitle>
                    <Clock className="h-4 w-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">{stats.unpaid}</div>
                    <p className="text-xs text-muted-foreground">{formatCurrency(stats.unpaidAmount)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Solde Dû</CardTitle>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.unpaidAmount)}</div>
                    <p className="text-xs text-muted-foreground">À recouvrer</p>
                  </CardContent>
                </Card>
              </div>

              {/* Client Info - PREMIUM REDESIGN */}
              <div className="mb-6">
                <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">

                  {/* ── Profile Header ── */}
                  <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-muted/30">
                    <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow">
                      <span className="text-primary-foreground text-2xl font-black select-none">
                        {client.name?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold text-foreground leading-tight truncate">{client.name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {client.code && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium bg-background border border-border text-muted-foreground px-2 py-0.5 rounded-md">
                            <Hash className="w-3 h-3" />{client.code}
                          </span>
                        )}
                        {(client.city || client.wilaya) && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPin className="w-3 h-3" />{[client.city, client.wilaya].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    {client.notes && (
                      <p className="hidden xl:block max-w-sm text-xs text-muted-foreground italic border-l border-border pl-4 leading-relaxed line-clamp-2">
                        {client.notes}
                      </p>
                    )}
                  </div>

                  {/* ── Info Sections ── */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">

                    {/* Contact */}
                    <div className="p-5 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-border">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Contact</span>
                      </div>
                      <div className="space-y-2.5">
                        <div className="flex items-start gap-3">
                          <User className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Personne de contact</p>
                            <p className="text-sm font-medium text-foreground mt-0.5">{client.contact_person || <span className="text-muted-foreground/30">—</span>}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Phone className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Téléphone</p>
                            <p className="text-sm font-medium text-foreground mt-0.5">{client.phone || <span className="text-muted-foreground/30">—</span>}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Mail className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Email</p>
                            <p className="text-sm font-medium text-foreground mt-0.5 truncate" title={client.email || ""}>{client.email || <span className="text-muted-foreground/30">—</span>}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Adresse</p>
                            <p className="text-sm font-medium text-foreground mt-0.5 leading-snug">{client.address || <span className="text-muted-foreground/30">—</span>}</p>
                            {client.secondary_address && (
                              <p className="text-xs text-muted-foreground mt-1 leading-snug border-t border-border/40 pt-1">
                                {client.secondary_address}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Fiscal */}
                    <div className="p-5 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-border">
                        <Landmark className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Informations Fiscales</span>
                      </div>
                      <div className="space-y-3">
                        {[
                          { icon: BadgeCheck, label: "NIF", value: client.nif },
                          { icon: Hash, label: "NIS", value: client.nis },
                          { icon: Building2, label: "RC Principal", value: client.rc },
                          { icon: Scale, label: "AI", value: client.ai },
                        ].map(({ icon: Icon, label, value }) => (
                          <div key={label} className="flex items-start gap-2">
                            <Icon className="w-3.5 h-3.5 text-muted-foreground/40 mt-1 shrink-0" />
                            <div className="flex-1 flex items-center justify-between gap-2">
                              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide shrink-0">{label}</p>
                              <p className="text-sm font-mono font-semibold text-foreground text-right">{value || <span className="text-muted-foreground/30 font-sans font-normal">—</span>}</p>
                            </div>
                          </div>
                        ))}
                        {client.secondary_rc && parseSecondaryRc(client.secondary_rc).filter(rc => rc.rc).length > 0 && (
                          <div className="flex items-start gap-2 pt-2 border-t border-border/40">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground/40 mt-1 shrink-0" />
                            <div className="flex-1 flex items-start justify-between gap-2">
                              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide shrink-0 pt-0.5">RC Secondaire</p>
                              <div className="text-right flex flex-col gap-1">
                                {parseSecondaryRc(client.secondary_rc).filter(rc => rc.rc).map((item, idx) => (
                                  <p key={idx} className="text-sm font-mono font-semibold text-foreground">
                                    {item.rc}
                                    {item.address && <span className="text-xs font-sans font-normal text-muted-foreground ml-1 block">({item.address})</span>}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Conditions */}
                    <div className="p-5 space-y-3 md:col-span-2 xl:col-span-1">
                      <div className="flex items-center gap-2 pb-2 border-b border-border">
                        <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Conditions & Solde</span>
                      </div>
                      <div className="space-y-2.5">
                        <div className="flex items-start gap-3">
                          <CreditCard className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Limite de crédit</p>
                            <p className="text-sm font-medium text-foreground mt-0.5">{client.credit_limit ? formatCurrency(client.credit_limit) : <span className="text-muted-foreground/30">—</span>}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CalendarDays className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Délai de paiement</p>
                            <p className="text-sm font-medium text-foreground mt-0.5">{client.payment_terms_days ? `${client.payment_terms_days} jours` : <span className="text-muted-foreground/30">—</span>}</p>
                          </div>
                        </div>
                        {client.initial_balance ? (
                          <div className="flex items-start gap-3 mt-1 bg-orange-50 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-800/30 rounded-lg px-3 py-2.5">
                            <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[10px] text-orange-600/80 uppercase tracking-wide font-semibold">Dette Antérieure</p>
                              <p className="text-base font-bold text-orange-600 mt-0.5">{formatCurrency(client.initial_balance)}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Dette Antérieure</p>
                              <p className="text-sm text-muted-foreground/30 mt-0.5">—</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="advances" className="mt-0">
              {/* Pre-payment / Draft Products Section */}
              <Card className="mb-6 border-blue-200">
                <CardHeader className="bg-blue-50/50 border-b border-blue-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg text-blue-900 flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-blue-500" />
                        Gestion d'Avance (Chèque / Pré-paiement)
                      </CardTitle>
                      <p className="text-sm text-blue-700 mt-1">
                        Enregistrez les achats non facturés payés via une avance.
                      </p>
                    </div>
                    <div className="flex items-center gap-6 bg-white p-3 rounded-xl border shadow-sm">
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Avance Totale</p>
                        <p className="font-bold text-base text-blue-600">{formatCurrency(advancePayment)}</p>
                      </div>
                      <div className="w-px h-8 bg-border"></div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Consommé</p>
                        <p className="font-bold text-base text-orange-500">{formatCurrency(totalDraftAmount)}</p>
                      </div>
                      <div className="w-px h-8 bg-border"></div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Reste</p>
                        <p className={`font-bold text-base ${remainingAdvance < 0 ? 'text-red-500' : 'text-green-600'}`}>{formatCurrency(remainingAdvance)}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setIsAddAdvanceDialogOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Ajouter une avance
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {/* Add form */}
                  <div className="flex items-end gap-3 mb-6 bg-muted/30 p-4 rounded-xl">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs font-semibold">Produit</Label>
                      <Select
                        value={draftProductSearch}
                        onValueChange={setDraftProductSearch}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Sélectionner un produit" />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.code} - {p.name} ({formatCurrency(p.unit_price)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32 space-y-1.5">
                      <Label className="text-xs font-semibold">Quantité</Label>
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        value={draftQuantity}
                        onChange={e => setDraftQuantity(parseFloat(e.target.value) || 0)}
                        className="bg-white"
                      />
                    </div>
                    <Button
                      onClick={handleAddDraftProduct}
                      disabled={!draftProductSearch || draftQuantity <= 0 || addDraft.isPending}
                    >
                      Ajouter
                    </Button>
                  </div>

                  {/* Draft List */}
                  {draftProducts && draftProducts.length > 0 ? (
                    <div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produit</TableHead>
                            <TableHead className="text-right">Prix U. HT</TableHead>
                            <TableHead className="text-right">Qté</TableHead>
                            <TableHead className="text-right">Montant HT</TableHead>
                            <TableHead className="text-center">TVA</TableHead>
                            <TableHead className="text-right">Total TTC</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {draftProducts.map((draft) => {
                            const productInfo = products?.find(prod => prod.id === draft.product_id);
                            const tvaRate = draft.tva_rate ?? productInfo?.tva_rate ?? 19.0;
                            const itemTva = (tvaRate > 0) ? (draft.amount * (tvaRate / 100)) : 0;
                            const itemTtc = draft.amount + itemTva;

                            return (
                              <TableRow key={draft.id}>
                                <TableCell className="font-medium">
                                  {draft.product_code && <span className="text-muted-foreground mr-2 font-mono text-xs">{draft.product_code}</span>}
                                  {draft.product_name}
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(draft.unit_price)}</TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={draft.quantity}
                                    onChange={(e) => {
                                      const newQty = parseFloat(e.target.value);
                                      if (newQty > 0) {
                                        updateDraftQty.mutate({ id: draft.id, quantity: newQty, client_id: id! });
                                      }
                                    }}
                                    className="w-20 h-8 text-right ml-auto"
                                  />
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">{formatCurrency(draft.amount)}</TableCell>
                                <TableCell className="text-center text-xs text-muted-foreground">{tvaRate}%</TableCell>
                                <TableCell className="text-right font-semibold text-blue-700">{formatCurrency(itemTtc)}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteDraft.mutate({ id: draft.id, client_id: id! })}
                                    disabled={deleteDraft.isPending}
                                  >
                                    <X className="h-4 w-4 text-red-500" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>

                      {/* Totals Summary */}
                      <div className="flex justify-end mt-4 px-4">
                        <div className="w-80 space-y-3 border p-4 rounded-xl bg-gray-50/50 shadow-sm">
                          <div className="flex justify-between items-center text-sm text-muted-foreground">
                            <span>Sous-total HT</span>
                            <span className="font-medium text-foreground">{formatCurrency(draftTotals.subtotalHtBeforeDiscount)}</span>
                          </div>

                          {/* Discount Section */}
                          <div className="flex items-center justify-between gap-4 pt-2 border-t border-dashed">
                            <span className="text-sm font-medium">Remise</span>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                step={draftDiscountType === 'percent' ? "0.1" : "1"}
                                value={draftDiscountType === 'percent' ? draftDiscountRate : draftDiscountAmount}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  if (draftDiscountType === 'percent') setDraftDiscountRate(val);
                                  else setDraftDiscountAmount(val);
                                }}
                                className="w-20 h-8 text-right px-2"
                              />
                              <Select
                                value={draftDiscountType}
                                onValueChange={(val: 'percent' | 'amount') => setDraftDiscountType(val)}
                              >
                                <SelectTrigger className="w-[60px] h-8 px-2">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percent">%</SelectItem>
                                  <SelectItem value="amount">DA</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-sm text-muted-foreground pt-2 border-t border-dashed">
                            <span>Net HT</span>
                            <span className="font-medium text-foreground">{formatCurrency(draftTotals.subtotalHt)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm text-muted-foreground">
                            <span>TVA</span>
                            <span className="font-medium text-foreground">{formatCurrency(draftTotals.tvaAmount)}</span>
                          </div>

                          <div className="flex justify-between items-center text-sm text-muted-foreground border-t pt-2 mt-2">
                            <span>TTC (avant remise)</span>
                            <span className="font-medium text-foreground">{formatCurrency(draftTotals.ttcAvantRemise)}</span>
                          </div>

                          {draftTotals.calculatedDiscount > 0 && (
                            <div className="flex justify-between text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
                              <span>Remise déduite</span>
                              <span>- {formatCurrency(draftTotals.calculatedDiscount)}</span>
                            </div>
                          )}

                          <div className="flex justify-between items-center font-bold text-lg border-t pt-2 mt-2 text-blue-900">
                            <span>Consommé (TTC Final)</span>
                            <span>{formatCurrency(draftTotals.totalTtc)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex justify-end items-center gap-4 pt-4 border-t">
                        <Button
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            clearDrafts.mutate(id!);
                          }}
                          disabled={clearDrafts.isPending}
                        >
                          Vider la liste
                        </Button>
                        <Button
                          onClick={handleGenerateInvoiceFromDrafts}
                          className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        >
                          Générer la facture ({formatCurrency(totalDraftAmount)})
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                      Aucun produit enregistré sur l'avance.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Historique des Avances */}
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">Historique des Avances / Paiements</CardTitle>
                        {filteredAdvances.length > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {filteredAdvances.length} entrée{filteredAdvances.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportAdvancesCSV}
                        disabled={filteredAdvances.length === 0}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Export CSV
                      </Button>
                    </div>
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={advanceFilterMode} onValueChange={setAdvanceFilterMode}>
                        <SelectTrigger className="w-[180px] h-8 text-sm">
                          <SelectValue placeholder="Mode de paiement" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous les modes</SelectItem>
                          <SelectItem value="Chèque">Chèque</SelectItem>
                          <SelectItem value="Espèces">Espèces</SelectItem>
                          <SelectItem value="Virement">Virement</SelectItem>
                          <SelectItem value="Déduction Facture">Déduction Facture</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="date"
                        value={advanceFilterDateFrom}
                        onChange={(e) => setAdvanceFilterDateFrom(e.target.value)}
                        className="w-[150px] h-8 text-sm"
                        placeholder="Du"
                      />
                      <span className="text-muted-foreground text-sm">→</span>
                      <Input
                        type="date"
                        value={advanceFilterDateTo}
                        onChange={(e) => setAdvanceFilterDateTo(e.target.value)}
                        className="w-[150px] h-8 text-sm"
                        placeholder="Au"
                      />
                      {(advanceFilterMode !== "all" || advanceFilterDateFrom || advanceFilterDateTo) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setAdvanceFilterMode("all");
                            setAdvanceFilterDateFrom("");
                            setAdvanceFilterDateTo("");
                          }}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Réinitialiser
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Informations Bancaires</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!filteredAdvances || filteredAdvances.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            {!clientAdvances || clientAdvances.length === 0
                              ? "Aucune avance enregistrée pour ce client."
                              : "Aucune avance ne correspond aux filtres sélectionnés."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAdvances.map((adv) => (
                          <TableRow key={adv.id} className={adv.amount < 0 ? "bg-red-50/40" : ""}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {format(new Date(adv.date), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell>
                              <Badge variant={adv.amount < 0 ? "destructive" : "outline"}>{adv.payment_mode}</Badge>
                            </TableCell>
                            <TableCell>
                              {(adv.payment_mode === "Chèque" || adv.payment_mode === "Virement") ? (
                                <div className="text-sm">
                                  {adv.bank && <span className="block"><span className="text-muted-foreground">Banque:</span> {adv.bank}</span>}
                                  {adv.reference && <span className="block font-mono"><span className="text-muted-foreground leading-none">Réf:</span> {adv.reference}</span>}
                                  {adv.issuer_name && <span className="block"><span className="text-muted-foreground">Émetteur:</span> {adv.issuer_name}</span>}
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {adv.notes || "-"}
                            </TableCell>
                            <TableCell className={`text-right font-bold ${adv.amount < 0 ? "text-red-600" : "text-blue-600"}`}>
                              {adv.amount > 0 ? "+" : ""}{formatCurrency(adv.amount)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditAdvance(adv)}
                                >
                                  <Pencil className="h-4 w-4 text-blue-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteAdvance(adv.id)}
                                  disabled={deleteClientAdvance.isPending}
                                >
                                  <X className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="products" className="mt-0">
              {/* Products Purchased */}
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">Produits achetés ({clientProducts?.length || 0})</CardTitle>
                      </div>
                      {clientProducts && clientProducts.length > 0 && (
                        <div className="flex gap-4 text-sm">
                          <div className="text-muted-foreground">
                            <span className="font-medium">Quantité totale:</span>{" "}
                            {totals.totalQuantity.toLocaleString("fr-FR", {
                              minimumFractionDigits: 3,
                              maximumFractionDigits: 3,
                            })}
                            {totals.unit && ` ${totals.unit}`}
                          </div>
                          <div className="text-muted-foreground">
                            <span className="font-medium">Montant total:</span> {formatCurrency(totals.totalAmount)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                      <Select
                        value={selectedProductId || "all"}
                        onValueChange={(value) => setSelectedProductId(value === "all" ? undefined : value)}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Tous les produits" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous les produits</SelectItem>
                          {products?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.code} - {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={selectedMonth || "all"}
                        onValueChange={(value) => setSelectedMonth(value === "all" ? undefined : value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Tous les mois" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous les mois</SelectItem>
                          {months.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={selectedYear?.toString() || "all"}
                        onValueChange={(value) => setSelectedYear(value === "all" ? undefined : parseInt(value))}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Année" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Toutes les années</SelectItem>
                          {availableYears.map((y) => (
                            <SelectItem key={y} value={y.toString()}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {hasFilters && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearFilters}
                          className="gap-2"
                        >
                          <X className="h-4 w-4" />
                          Réinitialiser
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-right">Quantité totale</TableHead>
                        <TableHead className="text-right">Prix unitaire moyen</TableHead>
                        <TableHead className="text-right">Montant total HT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingProducts ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Chargement des produits...
                          </TableCell>
                        </TableRow>
                      ) : productsError ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-red-500">
                            Erreur lors du chargement des produits
                          </TableCell>
                        </TableRow>
                      ) : !clientProducts || clientProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            {hasFilters
                              ? "Aucun produit trouvé avec les filtres sélectionnés"
                              : "Aucun produit trouvé dans les factures de ce client"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {clientProducts.map((product) => {
                            const avgPrice = product.total_quantity > 0
                              ? product.total_amount / product.total_quantity
                              : 0;
                            return (
                              <TableRow key={product.product_id}>
                                <TableCell className="font-medium font-mono text-sm">
                                  {product.product_code}
                                </TableCell>
                                <TableCell className="font-medium">{product.product_name}</TableCell>
                                <TableCell className="text-right">
                                  <span className="font-medium">
                                    {product.total_quantity.toLocaleString("fr-FR", {
                                      minimumFractionDigits: 3,
                                      maximumFractionDigits: 3,
                                    })}
                                  </span>
                                  <span className="text-muted-foreground ml-1 text-sm">
                                    {product.unit}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {formatCurrency(avgPrice)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(product.total_amount)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {/* Totals Row */}
                          {clientProducts.length > 0 && (
                            <TableRow className="bg-muted/50 font-bold">
                              <TableCell colSpan={2} className="text-right">
                                TOTAL
                              </TableCell>
                              <TableCell className="text-right">
                                {totals.totalQuantity.toLocaleString("fr-FR", {
                                  minimumFractionDigits: 3,
                                  maximumFractionDigits: 3,
                                })}
                                {totals.unit && ` ${totals.unit}`}
                              </TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(totals.totalAmount)}
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices" className="mt-0">
              {/* Invoices Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Factures ({clientInvoices.length})</CardTitle>
                  <Button variant="outline" size="sm" onClick={downloadInvoicesCSV}>
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Facture</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Échéance</TableHead>
                        <TableHead className="text-right">Montant TTC</TableHead>
                        <TableHead className="text-right">Payé</TableHead>
                        <TableHead className="text-right">Solde</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Aucune facture pour ce client
                          </TableCell>
                        </TableRow>
                      ) : (
                        clientInvoices.map((invoice) => {
                          const validStatus = (invoice.status && STATUS_CONFIG[invoice.status as InvoiceStatus]) ? invoice.status as InvoiceStatus : "draft";
                          const statusConfig = STATUS_CONFIG[validStatus];
                          return (
                            <TableRow key={invoice.id}>
                              <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                              <TableCell>
                                {format(new Date(invoice.invoice_date), "dd MMM yyyy", { locale: fr })}
                              </TableCell>
                              <TableCell>
                                {invoice.due_date
                                  ? format(new Date(invoice.due_date), "dd MMM yyyy", { locale: fr })
                                  : "-"
                                }
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(invoice.total_ttc || 0)}
                              </TableCell>
                              <TableCell className="text-right text-green-600">
                                {formatCurrency(invoice.amount_paid || 0)}
                              </TableCell>
                              <TableCell className="text-right text-red-600">
                                {formatCurrency(invoice.balance_due || 0)}
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={validStatus}
                                  onValueChange={(value) => handleStatusChange(invoice.id, value as InvoiceStatus)}
                                  disabled={updateStatus.isPending}
                                >
                                  <SelectTrigger className="w-[130px]">
                                    <SelectValue placeholder={statusConfig.label} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="draft">Brouillon</SelectItem>
                                    <SelectItem value="issued">Émise</SelectItem>
                                    <SelectItem value="paid">Payée</SelectItem>
                                    <SelectItem value="partial">Partielle</SelectItem>
                                    <SelectItem value="overdue">En retard</SelectItem>
                                    <SelectItem value="cancelled">Annulée</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div >

      {/* Edit Dialog */}
      < Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} >
        <DialogContent className="max-w-2xl rounded-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Modifier les informations de {client.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto pr-2 space-y-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-primary/70">Informations Générales</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Nom / Raison Sociale *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Code Client</Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Personne de contact</Label>
                    <Input
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-primary/70">Contact & Localisation</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Téléphone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Adresse</Label>
                    <Textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="mt-1.5 rounded-xl"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Ville</Label>
                    <Input
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Wilaya</Label>
                    <Input
                      value={formData.wilaya}
                      onChange={(e) => setFormData({ ...formData, wilaya: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* Fiscal Info */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-primary/70">Informations Fiscales</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">NIF</Label>
                    <Input
                      value={formData.nif}
                      onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                      className="mt-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">NIS</Label>
                    <Input
                      value={formData.nis}
                      onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                      className="mt-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">RC Principal</Label>
                    <Input
                      value={formData.rc}
                      onChange={(e) => setFormData({ ...formData, rc: e.target.value })}
                      className="mt-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">AI</Label>
                    <Input
                      value={formData.ai}
                      onChange={(e) => setFormData({ ...formData, ai: e.target.value })}
                      className="mt-1.5 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Secondary Register Section */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-primary/70">Succursales / Registres Secondaires <span className="text-xs font-normal normal-case text-muted-foreground">(optionnel)</span></p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center h-6 mb-2">
                    <Label className="text-xs text-muted-foreground">Liste des succursales</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        const list = parseSecondaryRc(formData.secondary_rc);
                        list.push({ rc: "", address: "" });
                        setFormData({ ...formData, secondary_rc: JSON.stringify(list) });
                      }}
                    >
                      + Ajouter
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {parseSecondaryRc(formData.secondary_rc).map((item, index, arr) => (
                      <div key={index} className="flex gap-2 items-start relative p-3 bg-muted/20 border rounded-lg">
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1.5 block">RC Secondaire</Label>
                            <Input
                              value={item.rc}
                              placeholder="Ex: 00 B 0000001"
                              className="font-mono h-8 text-sm"
                              onChange={(e) => {
                                const newList = [...arr];
                                newList[index].rc = e.target.value;
                                setFormData({ ...formData, secondary_rc: JSON.stringify(newList) });
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1.5 block">Adresse Secondaire</Label>
                            <Input
                              value={item.address}
                              placeholder="Ex: Zone Industrielle, Alger"
                              className="h-8 text-sm w-full"
                              onChange={(e) => {
                                const newList = [...arr];
                                newList[index].address = e.target.value;
                                setFormData({ ...formData, secondary_rc: JSON.stringify(newList) });
                              }}
                            />
                          </div>
                        </div>

                        {arr.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 mt-6 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                            onClick={() => {
                              const newList = [...arr];
                              newList.splice(index, 1);
                              setFormData({ ...formData, secondary_rc: JSON.stringify(newList) });
                            }}
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Financial Info */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-primary/70">Conditions Commerciales</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Limite de crédit</Label>
                    <Input
                      type="number"
                      value={formData.credit_limit || ""}
                      onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Délai de paiement (jours)</Label>
                    <Input
                      type="number"
                      value={formData.payment_terms_days || ""}
                      onChange={(e) => setFormData({ ...formData, payment_terms_days: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Solde Initial (Dette Antérieure)</Label>
                    <Input
                      type="number"
                      value={formData.initial_balance || ""}
                      onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-semibold text-blue-600">Avance (Chèque / Pré-paiement)</Label>
                    <Input
                      type="number"
                      value={calculatedAdvancePayment}
                      disabled
                      className="mt-1.5 border-blue-200 bg-gray-50 cursor-not-allowed font-medium text-blue-700"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Gérée via l'historique des avances (Total calculé)</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <Button type="button" variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="rounded-full">
                Annuler
              </Button>
              <Button type="submit" disabled={updateClient.isPending} className="rounded-full px-8">
                {updateClient.isPending ? "Mise à jour..." : "Enregistrer les modifications"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog >

      {/* Add Advance Dialog */}
      < Dialog open={isAddAdvanceDialogOpen} onOpenChange={setIsAddAdvanceDialogOpen} >
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Ajouter une avance</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddAdvanceSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-muted-foreground">Date de paiement *</Label>
                <Input
                  type="date"
                  value={addAdvanceDate}
                  onChange={(e) => setAddAdvanceDate(e.target.value)}
                  className="mt-1.5"
                  required
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-muted-foreground">Montant de l'avance *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={addAdvanceAmount || ""}
                  onChange={(e) => setAddAdvanceAmount(parseFloat(e.target.value) || 0)}
                  className="mt-1.5 text-lg font-bold text-blue-600"
                  required
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Mode de paiement *</Label>
              <Select value={addAdvancePaymentMode} onValueChange={setAddAdvancePaymentMode}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chèque">Chèque</SelectItem>
                  <SelectItem value="Virement">Virement Bancaire</SelectItem>
                  <SelectItem value="Espèces">Espèces</SelectItem>
                  <SelectItem value="Carte">Carte Bancaire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(addAdvancePaymentMode === "Chèque" || addAdvancePaymentMode === "Virement") && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-xl border">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Banque *</Label>
                  <Input
                    value={addAdvanceBank}
                    onChange={(e) => setAddAdvanceBank(e.target.value)}
                    placeholder="Ex: BEA, BNA, CPA..."
                    className="mt-1.5"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">
                    {addAdvancePaymentMode === "Chèque" ? "Numéro de chèque *" : "Référence virement *"}
                  </Label>
                  <Input
                    value={addAdvanceReference}
                    onChange={(e) => setAddAdvanceReference(e.target.value)}
                    placeholder="Ex: 1234567"
                    className="mt-1.5 font-mono"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">
                    Nom sur le {addAdvancePaymentMode === "Chèque" ? "chèque" : "virement"} (Optionnel)
                  </Label>
                  <Input
                    value={addAdvanceIssuerName}
                    onChange={(e) => setAddAdvanceIssuerName(e.target.value)}
                    placeholder="Ex: Nom complet ou raison sociale de l'émetteur"
                    className="mt-1.5"
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground">Autres observations (Optionnel)</Label>
              <Textarea
                value={addAdvanceNote}
                onChange={(e) => setAddAdvanceNote(e.target.value)}
                placeholder="Notes supplémentaires..."
                className="mt-1.5 rounded-xl"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-6">
              <Button type="button" variant="ghost" onClick={() => setIsAddAdvanceDialogOpen(false)} className="rounded-full">
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={
                  updateClient.isPending ||
                  addAdvanceAmount <= 0 ||
                  ((addAdvancePaymentMode === "Chèque" || addAdvancePaymentMode === "Virement") && (!addAdvanceBank.trim() || !addAdvanceReference.trim()))
                }
                className="rounded-full bg-blue-600 hover:bg-blue-700"
              >
                {updateClient.isPending ? "Ajout..." : "Confirmer l'avance"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog >
    </div >
  );
}
