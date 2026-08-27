import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  RiAddLine as Plus,
  RiBankCardLine as CreditCard,
  RiCashLine as Banknote,
  RiBuildingLine as Building2,
  RiReceiptLine as Receipt,
  RiMore2Fill as MoreVertical,
  RiFilter3Line as Filter,
  RiCloseLine as X,
  RiHistoryLine as HistoryIcon,
  RiDeleteBinLine as Trash2,
  RiAttachment2 as AttachmentIcon,
  RiFileTextLine as FileIcon,
  RiImageLine as ImageIcon,
} from "@remixicon/react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";

import { Input, Button, Label, SearchInput, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableLoading, EmptyState, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sordi/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { MetricStrip } from "@/components/ui/metric-strip";
import { cn } from "@/lib/utils";
import { usePayments, useCreatePayment, useDeletePayment, useRestorePayment, usePaymentAttachments, useAddPaymentAttachment, useDeletePaymentAttachment } from "@/hooks/usePayments";
import { useInvoices, useUpdateInvoiceStatus } from "@/hooks/useInvoices";
import { useEmployees } from "@/hooks/useEmployees";
import { useAppDataDir, resolveAppDataAbsolutePath, resolveAppDataFileUrl } from "@/hooks/useAppDataDir";
import type { Payment } from "@/lib/database";
import { toast } from "sonner";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg"]);

/** One payment's proof-of-payment scans — a thumbnail for images, a plain
 *  file icon for PDFs, both opening in the OS default viewer on click since
 *  a PDF isn't renderable inline. Fetched per-payment (usePaymentAttachments
 *  is `enabled` only while its dialog row is visible), not eagerly for the
 *  whole history list, since most payments have none. */
function PaymentAttachmentsList({ paymentId, appDataDirPath }: { paymentId: string; appDataDirPath: string | undefined }) {
  const { data: attachments } = usePaymentAttachments(paymentId);
  const deleteAttachment = useDeletePaymentAttachment();
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  useMemo(() => {
    if (!appDataDirPath || !attachments) return;
    attachments.forEach((a) => {
      const ext = a.file_path.split(".").pop()?.toLowerCase() || "";
      if (IMAGE_EXTENSIONS.has(ext) && !thumbnails[a.id]) {
        resolveAppDataFileUrl(appDataDirPath, a.file_path).then((url) => {
          setThumbnails((prev) => ({ ...prev, [a.id]: url }));
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments, appDataDirPath]);

  const handleOpen = async (relativePath: string) => {
    if (!appDataDirPath) return;
    try {
      const absolute = await resolveAppDataAbsolutePath(appDataDirPath, relativePath);
      await openPath(absolute);
    } catch (error) {
      toast.error(`Impossible d'ouvrir la pièce justificative: ${error}`);
    }
  };

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((a) => {
        const ext = a.file_path.split(".").pop()?.toLowerCase() || "";
        const isImage = IMAGE_EXTENSIONS.has(ext);
        return (
          <div key={a.id} className="group/attach relative">
            <button
              type="button"
              onClick={() => handleOpen(a.file_path)}
              title={a.file_name}
              className="w-12 h-12 rounded-lg border border-border/50 overflow-hidden flex items-center justify-center bg-muted/40 hover:bg-muted transition-colors"
            >
              {isImage && thumbnails[a.id] ? (
                <img src={thumbnails[a.id]} alt={a.file_name} className="w-full h-full object-cover" />
              ) : isImage ? (
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
              ) : (
                <FileIcon className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); deleteAttachment.mutate(a); }}
              title="Supprimer la pièce justificative"
              className="absolute -top-1.5 -end-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground items-center justify-center opacity-0 group-hover/attach:opacity-100 transition-opacity hidden group-hover/attach:flex"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function PaymentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedInvoice = searchParams.get("invoice");

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(!!preselectedInvoice);
  const [historyInvoiceId, setHistoryInvoiceId] = useState<string | null>(null);

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
    employee_id: "",
  };

  const [formData, setFormData] = useState(defaultForm);
  // Attachment picked in the "Nouveau paiement" dialog — uploaded right
  // after the payment itself is created, since add_payment_attachment
  // needs a real payment_id to copy the file under.
  const [pendingAttachmentPath, setPendingAttachmentPath] = useState<string | null>(null);

  // Data Loading
  const { data: payments, isLoading: isLoadingPayments } = usePayments();
  const { data: invoices, isLoading: isLoadingInvoices } = useInvoices();
  const { data: employees } = useEmployees();
  const { data: appDataDirPath } = useAppDataDir();

  const createPayment = useCreatePayment();
  const deletePayment = useDeletePayment();
  const restorePayment = useRestorePayment();
  const updateInvoiceStatus = useUpdateInvoiceStatus();
  const addAttachment = useAddPaymentAttachment();
  const deleteAttachment = useDeletePaymentAttachment();

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
    const endOfDay = dateEnd ? new Date(dateEnd) : null;
    if (endOfDay) endOfDay.setHours(23, 59, 59, 999);

    return enrichedInvoices.filter(invoice => {
      const search = searchQuery.toLowerCase().trim();
      const invoiceNumber = (invoice.invoice_number || "").toLowerCase();
      const clientName = (invoice.clients?.name || "").toLowerCase();
      const matchesSearch = !search || invoiceNumber.includes(search) || clientName.includes(search);

      const matchesStatus = statusFilter === "all" || invoice.status?.toLowerCase() === statusFilter.toLowerCase();
      const matchesClient = clientFilter === "all" || clientName === clientFilter.toLowerCase();

      const iDate = new Date(invoice.invoice_date);
      const matchesDateStart = !dateStart || iDate >= new Date(dateStart);
      const matchesDateEnd = !endOfDay || iDate <= endOfDay;

      return matchesSearch && matchesStatus && matchesClient && matchesDateStart && matchesDateEnd;
    });
  }, [enrichedInvoices, searchQuery, statusFilter, clientFilter, dateStart, dateEnd]);

  const employeeById = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e])), [employees]);

  // Payments for the invoice whose "Historique" dialog is currently open,
  // newest first — this is where an individual payment actually gets deleted
  // from, since the main table is invoice-centric (one row per invoice, all
  // its payments summed into "Payé") and has no per-payment row of its own.
  const historyInvoice = historyInvoiceId ? enrichedInvoices.find((i) => i.id === historyInvoiceId) : null;
  const historyPayments = useMemo(
    () => (payments ?? [])
      .filter((p) => p.invoice_id === historyInvoiceId)
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()),
    [payments, historyInvoiceId],
  );

  // Most recent payment per invoice — powers the row dropdown's direct
  // "Supprimer le dernier paiement" action, so undoing the last settlement
  // doesn't require opening the Historique dialog first.
  const getLatestPayment = (invoiceId: string): Payment | undefined =>
    (payments ?? [])
      .filter((p) => p.invoice_id === invoiceId)
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0];

  // For the "Enregistrer un paiement" dialog's Facture dropdown — deliberately
  // NOT filteredInvoices, which tracks this page's table filters (search,
  // status, client, date range). Reusing it here meant the dropdown could
  // silently show zero options whenever a filter was left active on the page.
  const payableInvoices = useMemo(
    () => enrichedInvoices.filter((i) => i.calculated_balance > 0 || i.id === formData.invoice_id),
    [enrichedInvoices, formData.invoice_id],
  );

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
    setPendingAttachmentPath(null);
    setIsDialogOpen(false);
  };

  const openPaymentDialog = (invoiceId?: string) => {
    setFormData({
      ...defaultForm,
      invoice_id: invoiceId || "",
    });
    setPendingAttachmentPath(null);
    setIsDialogOpen(true);
  };

  const handlePickAttachment = async () => {
    const picked = await openFileDialog({
      filters: [{ name: "Pièce justificative", extensions: ["png", "jpg", "jpeg", "pdf"] }],
      multiple: false,
    });
    if (typeof picked === "string") {
      setPendingAttachmentPath(picked);
    }
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
      employee_id: formData.employee_id || undefined,
    };

    createPayment.mutate(payload, {
      onSuccess: (payment) => {
        if (pendingAttachmentPath) {
          const fileName = pendingAttachmentPath.split(/[\\/]/).pop() || "piece-justificative";
          addAttachment.mutate({ paymentId: payment.id, sourcePath: pendingAttachmentPath, fileName });
        }
        resetForm();
      },
    });
  };

  // Optimistic delete + Sonner undo toast (5s window) — the payment is
  // actually deleted immediately (recalculating amount_paid/balance_due/
  // status server-side via update_invoice_payment_status), and "Annuler"
  // re-creates it via useRestorePayment rather than reverting an in-flight
  // mutation, since the backend has no soft-delete. Any attachment on the
  // payment is not recoverable — delete_payment removes the files from disk.
  const handleDeletePayment = (payment: Payment) => {
    deletePayment.mutate(payment.id);
    toast(`Paiement de ${formatCurrency(payment.amount)} supprimé`, {
      duration: 5000,
      action: {
        label: "Annuler",
        onClick: () => restorePayment.mutate(payment),
      },
    });
  };

  const handleOpenAttachment = async (relativePath: string) => {
    if (!appDataDirPath) return;
    try {
      const absolute = await resolveAppDataAbsolutePath(appDataDirPath, relativePath);
      await openPath(absolute);
    } catch (error) {
      toast.error(`Impossible d'ouvrir la pièce justificative: ${error}`);
    }
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
    <>
      <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto w-full">
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

          {/* Metric strip — shared KPI ribbon component (same shape as the
              Dashboard's Tier 2), replacing the old StatsCard grid. */}
          <div className="mb-6">
            <MetricStrip
              cells={[
                { key: "total", label: "Total Encaissé", value: formatCurrency(stats.total), numericValue: stats.total, format: formatCurrency, icon: Receipt, sublabel: `${stats.count} paiements` },
                { key: "cash", label: "Espèces", value: formatCurrency(stats.cash), numericValue: stats.cash, format: formatCurrency, icon: Banknote },
                { key: "cheque", label: "Chèques", value: formatCurrency(stats.cheque), numericValue: stats.cheque, format: formatCurrency, icon: CreditCard },
                { key: "transfer", label: "Virements", value: formatCurrency(stats.transfer), numericValue: stats.transfer, format: formatCurrency, icon: Building2 },
              ]}
            />
          </div>

          {/* Filters */}
          <div className="bg-card rounded-2xl border shadow-sm p-4 mb-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Rechercher facture, client..."
                containerClassName="flex-1"
              />

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

                <div className="flex items-center gap-2 bg-secondary/30 border border-border/50 rounded-xl px-2 h-11 transition-colors">
                  <DatePicker
                    value={dateStart}
                    onChange={setDateStart}
                    placeholder="Début"
                    className="h-8 w-32 border-none bg-transparent px-1.5 hover:bg-muted/60"
                  />
                  <span className="text-muted-foreground">-</span>
                  <DatePicker
                    value={dateEnd}
                    onChange={setDateEnd}
                    placeholder="Fin"
                    className="h-8 w-32 border-none bg-transparent px-1.5 hover:bg-muted/60"
                  />
                  {(dateStart || dateEnd) && (
                    <button onClick={() => { setDateStart(""); setDateEnd(""); }} className="ml-1 hover:bg-muted rounded-full p-1 shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Table - Invoice Centric */}
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>N° Facture</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="hidden md:table-cell">Échéance</TableHead>
                <TableHead className="text-right">Montant TTC</TableHead>
                <TableHead className="text-right">Payé</TableHead>
                <TableHead className="text-right">Solde</TableHead>
                <TableHead className="w-40">Statut</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingInvoices || isLoadingPayments ? (
                <TableLoading columns={8} rows={5} numericColumns={[3, 4, 5]} />
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState
                      type="invoices"
                      title="Aucune facture"
                      description={searchQuery ? "Essayez une autre recherche" : "Créez une facture pour commencer à suivre ses règlements"}
                      action={searchQuery
                        ? { label: "Effacer la recherche", onClick: () => setSearchQuery("") }
                        : { label: "Créer une facture", onClick: () => navigate("/invoices/new") }}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice: any) => {
                  const paid = invoice.calculated_paid || 0;
                  const total = invoice.total_ttc || 0;
                  const balance = invoice.calculated_balance || 0;
                  const isCancelled = invoice.status === "cancelled";

                  const rowActions = (
                    <>
                      <DropdownMenuItem onClick={() => openPaymentDialog(invoice.id)}>
                        <CreditCard className="w-4 h-4 mr-2" /> Ajouter un paiement
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}`)}>
                        <Receipt className="w-4 h-4 mr-2" /> Voir la facture
                      </DropdownMenuItem>
                      {paid > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30 flex items-center gap-2 text-xs font-medium"
                            onClick={() => setHistoryInvoiceId(invoice.id)}
                          >
                            <HistoryIcon className="w-3.5 h-3.5" /> Historique des paiements
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30 flex items-center gap-2 text-xs font-medium"
                            onClick={() => {
                              const latest = getLatestPayment(invoice.id);
                              if (latest) handleDeletePayment(latest);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Supprimer un règlement
                          </DropdownMenuItem>
                        </>
                      )}
                    </>
                  );

                  return (
                    <ContextMenu key={invoice.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow className="group" dimmed={isCancelled}>
                          <TableCell className="font-semibold">{invoice.invoice_number}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(invoice.invoice_date)}</TableCell>
                          <TableCell className="text-muted-foreground hidden md:table-cell">{formatDate(invoice.due_date)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatCurrency(total)}
                          </TableCell>
                          <TableCell className={cn("text-right font-medium tabular-nums", isCancelled ? "text-muted-foreground" : "text-stat-positive")}>
                            {formatCurrency(paid)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            <span className={isCancelled ? "text-muted-foreground" : balance > 0 ? "text-destructive" : "text-muted-foreground"}>
                              {formatCurrency(balance)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={invoice.status || 'sent'}
                              onValueChange={(val) => handleStatusChange(invoice.id, val)}
                            >
                              <SelectTrigger className="h-9 bg-secondary/30">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {rowActions}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => openPaymentDialog(invoice.id)}>
                          <CreditCard className="w-4 h-4 mr-2" /> Ajouter un paiement
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => navigate(`/invoices/${invoice.id}`)}>
                          <Receipt className="w-4 h-4 mr-2" /> Voir la facture
                        </ContextMenuItem>
                        {paid > 0 && (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              className="text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30 flex items-center gap-2 text-xs font-medium"
                              onClick={() => setHistoryInvoiceId(invoice.id)}
                            >
                              <HistoryIcon className="w-3.5 h-3.5" /> Historique des paiements
                            </ContextMenuItem>
                            <ContextMenuItem
                              className="text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30 flex items-center gap-2 text-xs font-medium"
                              onClick={() => {
                                const latest = getLatestPayment(invoice.id);
                                if (latest) handleDeletePayment(latest);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Supprimer un règlement
                            </ContextMenuItem>
                          </>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
      </main>

      {/* Payment history dialog — the main table is invoice-centric (one row
          per invoice, all its payments summed into "Payé"), so this is where
          an individual payment actually gets deleted from. */}
      <Dialog open={!!historyInvoiceId} onOpenChange={(open) => !open && setHistoryInvoiceId(null)}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle>Historique des paiements — {historyInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {historyPayments.length === 0 ? (
              <EmptyState type="payments" title="Aucun paiement" description="Aucun règlement n'a encore été enregistré pour cette facture" className="py-8" />
            ) : (
              historyPayments.map((p) => {
                const operator = p.employee_id ? employeeById.get(p.employee_id) : undefined;
                return (
                  <div key={p.id} className="rounded-xl border border-border/50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono font-semibold tabular-nums tracking-tight">{formatCurrency(p.amount)}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatDate(p.payment_date)}
                          {p.payment_method ? ` · ${p.payment_method === "cash" ? "Espèces" : p.payment_method === "cheque" ? "Chèque" : "Virement"}` : ""}
                          {p.cheque_number ? ` · N° ${p.cheque_number}` : ""}
                          {operator ? ` · Encaissé par ${operator.name}` : ""}
                          {p.notes ? ` · ${p.notes}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeletePayment(p)}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary transition-all shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                    <PaymentAttachmentsList paymentId={p.id} appDataDirPath={appDataDirPath} />
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setHistoryInvoiceId(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  disabled={isLoadingInvoices}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingInvoices ? "Chargement…" : "Sélectionner une facture"} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Every unpaid invoice, independent of the page's own search/status/client/date
                        filters — those are for the background table, not this dialog. Reusing them
                        here left the dropdown empty whenever a filter was still active from browsing
                        the list. */}
                    {payableInvoices.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Aucune facture avec un solde restant</div>
                    ) : (
                      payableInvoices.map((invoice: any) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number} - {invoice.clients?.name} ({formatCurrency(invoice.calculated_balance)} restant)
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <DatePicker
                    value={formData.payment_date}
                    onChange={(v) => setFormData({ ...formData, payment_date: v })}
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
                    <DatePicker
                      value={formData.value_date}
                      onChange={(v) => setFormData({ ...formData, value_date: v })}
                      className="bg-background"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Encaissé par</Label>
                <Select
                  value={formData.employee_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, employee_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Non renseigné" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non renseigné</SelectItem>
                    {(employees ?? []).map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}{emp.role ? ` — ${emp.role}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pièce Justificative (Optionnel)</Label>
                {pendingAttachmentPath ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/40 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {IMAGE_EXTENSIONS.has(pendingAttachmentPath.split(".").pop()?.toLowerCase() || "") ? (
                        <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm truncate">{pendingAttachmentPath.split(/[\\/]/).pop()}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingAttachmentPath(null)}
                      className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-secondary transition-all shrink-0"
                    >
                      <X className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="w-full" onClick={handlePickAttachment}>
                    <AttachmentIcon className="w-4 h-4 mr-2" />
                    Joindre un reçu, relevé bancaire ou chèque
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Formats acceptés : PNG, JPG, PDF.</p>
              </div>

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
    </>
  );
}
