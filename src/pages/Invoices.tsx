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
  RiFileTextLine as FileText, 
  RiArrowLeftRightLine as ArrowRightLeft, 
  RiEditLine as Edit 
} from "@remixicon/react";
import { Button, Checkbox, SearchInput, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, TableLoading, EmptyState } from "@sordi/ui";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useInvoices, useDeleteInvoice, useConvertProforma, useUpdateInvoiceStatus, type InvoiceStatus, type InvoiceType } from "@/hooks/useInvoices";
import { generateInvoicePDF } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { db } from "@/lib/database";
import { useSettings } from "@/hooks/useSettings";
import { InvoicePreview } from "@/components/invoice/InvoicePreview";

const tabs = [
  { label: "Toutes", status: undefined, type: undefined },
  { label: "Factures", status: undefined, type: "invoice" as InvoiceType },
  { label: "Proformas", status: undefined, type: "proforma" as InvoiceType },
  { label: "Avoirs", status: undefined, type: "credit_note" as InvoiceType },
  { label: "Payées", status: "paid" as InvoiceStatus, type: undefined },
  { label: "Impayées", status: "issued" as InvoiceStatus, type: undefined },
];

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
  const updateStatus = useUpdateInvoiceStatus();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [pdfInvoice, setPdfInvoice] = useState<any>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

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
      deleteInvoice.mutate(invoiceToDelete);
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
      toast.success("Facture supprimée");
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

  const handleDownloadPDF = async (invoiceId: string, invoiceSummary: any) => {
    try {
      // Fetch full invoice details to get items
      const fullInvoice = await db.invoices.getById(invoiceId);
      if (!fullInvoice) {
        toast.error("Impossible de récupérer les détails de la facture");
        return;
      }

      // Fetch invoice items
      const items = await db.invoices.getItems(invoiceId);

      if (!fullInvoice.client_id) {
        toast.error("Cette facture n'a pas de client associé");
        return;
      }

      // Fetch client details
      const client = await db.clients.getById(fullInvoice.client_id);

      if (!client) {
        toast.error("Impossible de récupérer les détails du client");
        return;
      }

      // Construct complete invoice object for PDF generator
      const invoiceForPDF = {
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

      setPdfInvoice(invoiceForPDF);

      const promise = new Promise<string>(async (resolve, reject) => {
        // Wait for render
        await new Promise(r => setTimeout(r, 500));
        try {
          // Pass download=true by default
          const res = await generateInvoicePDF(invoiceForPDF, settings);
      toast.success("PDF téléchargé avec succès");
          resolve(res);
        } catch (e) {
          reject(e);
        } finally {
          setPdfInvoice(null);
        }
      });

      toast.promise(promise, {
        loading: "Génération du PDF...",
        success: "PDF téléchargé",
        error: "Erreur lors de la génération du PDF",
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Erreur inattendue");
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Off-screen Preview for PDF Generation */}
      <div className="fixed left-[-9999px] top-0 opacity-0 pointer-events-none z-[-100]">
        {pdfInvoice && <InvoicePreview invoice={pdfInvoice} />}
      </div>

      <Sidebar />

      {/* ... rest of the component ... */}

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 p-8 pt-4">
          <div className="max-w-[1600px] mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 animate-fade-in-down">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Factures</h1>
              <p className="text-muted-foreground mt-1">Gérez vos factures et avoirs</p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate("/invoices/credit-note/new")}>
                <MinusCircle className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Avoir</span>
              </Button>
              <Button variant="outline" onClick={() => navigate("/proformas/new")}>
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Proforma</span>
              </Button>
              <Button onClick={() => navigate("/invoices/new")}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle facture
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-4 mb-6 overflow-x-auto pb-2 animate-fade-in-up animation-delay-100">
            <div className="bg-card rounded-3xl p-5 shadow-card border border-border/30 flex items-center gap-4 min-w-fit card-hover">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground tracking-tight">{invoices?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total factures</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-3xl border border-border/30 shadow-card overflow-hidden animate-fade-in-up animation-delay-200">
            {/* Tabs and Search */}
            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/30">
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
                        : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </Button>
                ))}
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

            {/* Table */}
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
                  <TableHead>Montant</TableHead>
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
                    return (
                      <TableRow
                        key={invoice.id}
                        className="cursor-pointer"
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
                            <span className="font-medium">{invoice.invoice_number}</span>
                            {isCreditNote && (
                              <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">Avoir</span>
                            )}
                            {isProforma && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Proforma</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {invoice.clients?.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">
                          {formatDate(invoice.invoice_date)}
                        </TableCell>
                        <TableCell className={cn(
                          "font-medium tabular-nums",
                          isCreditNote ? "text-destructive" : ""
                        )}>
                          {isCreditNote ? "-" : ""}{formatCurrency(invoice.total_ttc)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className={cn(
                                    "inline-flex px-3 py-1 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 transition-opacity",
                                    statusStyles[invoice.status || "draft"]
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                  }}
                                >
                                  {statusLabels[invoice.status || "draft"]}
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
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="w-9 h-9 rounded-[6px] flex items-center justify-center hover:bg-secondary transition-all text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadPDF(invoice.id, invoice);
                              }}
                              title="Télécharger PDF"
                            >
                              <FileDown className="w-4 h-4" />
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="w-9 h-9 rounded-[6px] flex items-center justify-center hover:bg-secondary transition-all">
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Voir détails
                                </DropdownMenuItem>
                                {invoice.status !== "paid" && (
                                  <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Modifier
                                  </DropdownMenuItem>
                                )}
                                {!isCreditNote && invoice.status !== "paid" && (
                                  <DropdownMenuItem onClick={() => convertProforma.mutate(invoice.id)}>
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
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground rounded-full">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
