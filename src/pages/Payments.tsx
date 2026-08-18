import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  CreditCard,
  Banknote,
  Building2,
  Receipt,
  MoreVertical,
  Calendar,
  Filter,
  X,
  ChevronDown
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { usePayments, useCreatePayment } from "@/hooks/usePayments";
import { useInvoices, useUpdateInvoiceStatus } from "@/hooks/useInvoices";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function PaymentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedInvoice = searchParams.get("invoice");

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(!!preselectedInvoice);

  // Filters
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");

  const defaultForm = {
    invoice_id: preselectedInvoice || "",
    payment_date: new Date().toISOString().split("T")[0],
    amount: "",
    payment_method: "cheque",
    cheque_number: "",
    bank_name: "",
    value_date: "",
    notes: "",
  };

  const [formData, setFormData] = useState(defaultForm);

  // Data Loading
  const { data: payments, isLoading: isLoadingPayments } = usePayments();
  const { data: invoices, isLoading: isLoadingInvoices } = useInvoices();

  const createPayment = useCreatePayment();
  const updateInvoiceStatus = useUpdateInvoiceStatus();

  // Derived Data: Enriched Invoices
  // We want to list INVOICES with their payment status
  const enrichedInvoices = useMemo(() => {
    if (!invoices) return [];
    // Filter to only include actual invoices (exclude credit notes, proformas)
    const onlyInvoices = invoices.filter(i => i.invoice_type === 'invoice');

    return onlyInvoices.map(invoice => {
      // Calculate paid amount from payments list
      const invoicePayments = payments?.filter(p => p.invoice_id === invoice.id) || [];
      const calculatedPaid = invoicePayments.reduce((sum, p) => sum + p.amount, 0);

      return {
        ...invoice,
        calculated_paid: calculatedPaid,
        calculated_balance: (invoice.total_ttc || 0) - calculatedPaid
      };
    }).sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());
  }, [invoices, payments]);

  // Unique Clients for Filter
  const uniqueClients = useMemo(() => {
    const clients = new Set<string>();
    enrichedInvoices.forEach(i => {
      if (i.clients?.name) clients.add(i.clients.name);
    });
    return Array.from(clients).sort();
  }, [enrichedInvoices]);

  const filteredInvoices = useMemo(() => {
    return enrichedInvoices.filter(invoice => {
      const search = searchQuery.toLowerCase();
      const invoiceNumber = invoice.invoice_number.toLowerCase();
      const clientName = invoice.clients?.name?.toLowerCase() || "";
      const matchesSearch = invoiceNumber.includes(search) || clientName.includes(search) || search === "";

      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
      const matchesClient = clientFilter === "all" || clientName === clientFilter.toLowerCase();

      const iDate = new Date(invoice.invoice_date);
      const matchesDateStart = !dateStart || iDate >= new Date(dateStart);
      const matchesDateEnd = !dateEnd || iDate <= new Date(dateEnd);

      return matchesSearch && matchesStatus && matchesClient && matchesDateStart && matchesDateEnd;
    });
  }, [enrichedInvoices, searchQuery, statusFilter, clientFilter, dateStart, dateEnd]);

  // Global Stats (Cash Flow)
  const stats = useMemo(() => {
    if (!payments) return { total: 0, cash: 0, cheque: 0, transfer: 0, count: 0 };
    let total = 0;
    let cash = 0;
    let cheque = 0;
    let transfer = 0;

    payments.forEach(p => {
      const amount = p.amount || 0;
      total += amount;
      if (p.payment_method === 'cash') cash += amount;
      else if (p.payment_method === 'cheque') cheque += amount;
      else if (p.payment_method === 'transfer') transfer += amount;
    });

    return { total, cash, cheque, transfer, count: payments.length };
  }, [payments]);

  // Helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-DZ", {
      style: "decimal",
      minimumFractionDigits: 2,
    }).format(amount) + " DA";
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "dd MMM yyyy", { locale: fr });
  };

  const resetForm = () => {
    setFormData(defaultForm);
    setIsDialogOpen(false);
  };

  const openPaymentDialog = (invoiceId?: string) => {
    setFormData({
      ...defaultForm,
      invoice_id: invoiceId || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      amount: parseFloat(formData.amount),
      cheque_number: formData.cheque_number || undefined,
      bank_name: formData.bank_name || undefined,
      value_date: formData.value_date || undefined,
      notes: formData.notes || undefined,
    };

    createPayment.mutate(payload, { onSuccess: resetForm });
  };

  const handleStatusChange = (id: string, newStatus: any) => {
    // Standard status update
    updateInvoiceStatus.mutate({ id, status: newStatus });

    // Automation: If status is set to PAID, checks if we need to auto-create a payment for the balance
    if (newStatus === "paid") {
      const invoice = enrichedInvoices.find(i => i.id === id);
      if (invoice) {
        const remaining = invoice.calculated_balance || 0;
        if (remaining > 0) {
          // Auto-create payment for the remaining amount
          const payload = {
            invoice_id: id,
            // Use today's date
            payment_date: new Date().toISOString().split("T")[0],
            amount: remaining,
            // Default to cash for auto-payments
            payment_method: "cash",
            notes: "Règlement automatique suite au changement de statut",
          };

          createPayment.mutate(payload, {
            onSuccess: () => {
              toast.success(`Paiement de ${formatCurrency(remaining)} créé automatiquement`);
            },
            onError: (err) => {
              console.error("Auto-payment failed", err);
              toast.error("Erreur lors de la création du paiement automatique");
            }
          });
        }
      }
    }
  };

  const statusOptions = [
    { value: "draft", label: "Brouillon" },
    { value: "issued", label: "Émise" },
    { value: "paid", label: "Payée" },
    { value: "cancelled", label: "Annulée" },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />

        <main className="flex-1 p-6 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Suivi des Règlements</h1>
              <p className="text-muted-foreground">État des factures et paiements</p>
            </div>
            <Button onClick={() => openPaymentDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau paiement
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title="Total Encaissé"
              value={formatCurrency(stats.total)}
              subValue={`${stats.count} paiements`}
              icon={Receipt}
              className="bg-primary text-primary-foreground"
              iconClassName="text-primary bg-primary-foreground/20"
            />
            <StatsCard
              title="Espèces"
              value={formatCurrency(stats.cash)}
              icon={Banknote}
              iconClassName="text-green-500 bg-green-500/10"
            />
            <StatsCard
              title="Chèques"
              value={formatCurrency(stats.cheque)}
              icon={CreditCard}
              iconClassName="text-blue-500 bg-blue-500/10"
            />
            <StatsCard
              title="Virements"
              value={formatCurrency(stats.transfer)}
              icon={Building2}
              iconClassName="text-purple-500 bg-purple-500/10"
            />
          </div>

          {/* Filters */}
          <div className="bg-card rounded-2xl border shadow-sm p-4 mb-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher facture, client..."
                  className="pl-9 bg-background"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Tous les clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les clients</SelectItem>
                    {uniqueClients.map(client => (
                      <SelectItem key={client} value={client}>{client}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Tous statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="issued">Émise</SelectItem>
                    <SelectItem value="paid">Payée</SelectItem>
                    <SelectItem value="cancelled">Annulée</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2 bg-secondary/30 border border-border/50 rounded-xl px-4 h-11 transition-colors">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    className="bg-transparent text-sm w-28 outline-none placeholder:text-muted-foreground"
                  />
                  <span className="text-muted-foreground">-</span>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    className="bg-transparent text-sm w-28 outline-none placeholder:text-muted-foreground"
                  />
                  {(dateStart || dateEnd) && (
                    <button onClick={() => { setDateStart(""); setDateEnd(""); }} className="ml-2 hover:bg-muted rounded-full p-1">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Table - Invoice Centric */}
          <div className="bg-card rounded-2xl border shadow-sm overflow-hidden flex-1">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white border-b">
                    <th className="px-6 py-4 text-left font-bold text-gray-400 uppercase text-xs tracking-wider">N° FACTURE</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-400 uppercase text-xs tracking-wider">DATE</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-400 uppercase text-xs tracking-wider">ÉCHÉANCE</th>
                    <th className="px-6 py-4 text-right font-bold text-gray-400 uppercase text-xs tracking-wider">MONTANT TTC</th>
                    <th className="px-6 py-4 text-right font-bold text-gray-400 uppercase text-xs tracking-wider">PAYÉ</th>
                    <th className="px-6 py-4 text-right font-bold text-gray-400 uppercase text-xs tracking-wider">SOLDE</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-400 uppercase text-xs tracking-wider w-40">STATUT</th>
                    <th className="px-4 py-4 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoadingInvoices ? (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Chargement...</td></tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">Aucune facture trouvée</td></tr>
                  ) : (
                    filteredInvoices.map((invoice: any) => {
                      const paid = invoice.calculated_paid || 0;
                      const total = invoice.total_ttc || 0;
                      const balance = invoice.calculated_balance || 0;

                      return (
                        <tr key={invoice.id} className="hover:bg-gray-50/80 transition-colors group">
                          <td className="px-6 py-4 font-bold text-gray-900">{invoice.invoice_number}</td>
                          <td className="px-6 py-4 text-gray-600">{formatDate(invoice.invoice_date)}</td>
                          <td className="px-6 py-4 text-gray-600">{formatDate(invoice.due_date)}</td>
                          <td className="px-6 py-4 text-right font-bold text-gray-900 tabular-nums">
                            {formatCurrency(total)}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-emerald-500 tabular-nums">
                            {formatCurrency(paid)}
                          </td>
                          <td className="px-6 py-4 text-right font-medium tabular-nums">
                            <span className={balance > 0 ? "text-red-500" : "text-gray-400"}>
                              {formatCurrency(balance)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <Select
                              value={invoice.status || 'sent'}
                              onValueChange={(val) => handleStatusChange(invoice.id, val)}
                            >
                              <SelectTrigger className="h-9 border-gray-200 bg-gray-50/50 hover:bg-white transition-colors">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openPaymentDialog(invoice.id)}>
                                  <CreditCard className="w-4 h-4 mr-2" /> Ajouter un paiement
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}`)}>
                                  <Receipt className="w-4 h-4 mr-2" /> Voir la facture
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* Create Payment Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogContent className="sm:max-w-[500px] rounded-3xl">
            <DialogHeader>
              <DialogTitle>Enregistrer un paiement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Facture</Label>
                <Select
                  value={formData.invoice_id}
                  onValueChange={(value) => setFormData({ ...formData, invoice_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une facture" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredInvoices // Show all filtered invoices
                      .filter(i => i.calculated_balance > 0 || i.id === formData.invoice_id)
                      .map((invoice: any) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number} - {invoice.clients?.name} ({formatCurrency(invoice.calculated_balance)} restant)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Montant</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mode de paiement</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cheque">Chèque</SelectItem>
                    <SelectItem value="cash">Espèces</SelectItem>
                    <SelectItem value="transfer">Virement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.payment_method === "cheque" && (
                <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-xl">
                  <div className="space-y-2">
                    <Label className="text-xs">N° Chèque</Label>
                    <Input
                      value={formData.cheque_number}
                      onChange={(e) => setFormData({ ...formData, cheque_number: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Banque</Label>
                    <Input
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-xs">Date de valeur</Label>
                    <Input
                      type="date"
                      value={formData.value_date}
                      onChange={(e) => setFormData({ ...formData, value_date: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes (Optionnel)</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={createPayment.isPending}>
                  {createPayment.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function StatsCard({ title, value, subValue, icon: Icon, className, iconClassName }: any) {
  return (
    <div className={`p-6 rounded-3xl border shadow-sm flex items-center gap-4 ${className || "bg-card"}`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconClassName || "bg-secondary"}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-medium opacity-80">{title}</p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {subValue && <p className="text-xs opacity-60 mt-0.5">{subValue}</p>}
      </div>
    </div>
  );
}
