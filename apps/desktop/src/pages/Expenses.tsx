import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  RiAddLine as Plus,
  RiDeleteBinLine as Trash2,
  RiPencilLine as Pencil,
  RiReceiptLine as Receipt,
  RiWallet3Line as Wallet,
  RiExpandUpDownLine as ChevronsUpDown,
  RiFolderChartLine as FolderIcon,
  RiStore2Line as StoreIcon,
  RiArrowDownSLine as ChevronDown,
} from "@remixicon/react";
import { Button, SearchInput, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableLoading, EmptyState, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, MultiSelect, Label, Input, Textarea, Popover, PopoverContent, PopoverTrigger, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Tooltip, TooltipTrigger, TooltipContent, Collapsible, CollapsibleTrigger, CollapsibleContent, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, StatusBadge } from "@sordi/ui";
import { MetricStrip } from "@/components/ui/metric-strip";
import { DatePicker } from "@/components/ui/date-picker";
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, useExpenseStats } from "@/hooks/useExpenses";
import { useProjects } from "@/hooks/useProjects";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { cn } from "@/lib/utils";
import { useTableKeyboardNav } from "@/hooks/useTableKeyboardNav";
import type { Expense } from "@/lib/database";
import { useLicenseGate } from "@/hooks/useLicenseGate";
import { LicenseBlockedModal } from "@/components/licensing/LicenseBlockedModal";

const isExpensePaid = (expense: Expense) => expense.is_paid !== false;

const formatPaymentMethod = (method: string | null | undefined) => {
  const key = (method || "").trim().toLowerCase();
  if (key === "cash" || key === "especes" || key === "espèces") return "Espèces";
  if (key === "cheque" || key === "chèque") return "Chèque";
  if (key === "transfer" || key === "virement") return "Virement";
  if (key === "card" || key === "carte") return "Carte";
  // No payment method was recorded — a cash/bank outlay is the overwhelmingly
  // common case for this app's expenses, so that's a more useful default
  // than a bare, unscannable dash.
  return "Espèces / Virement";
};

// Some pre-existing/imported rows carry French-language payment_method
// values ("virement", "especes", "carte") instead of the canonical English
// keys the Select below actually offers ("transfer", "cash", "card") — fed
// straight into the Select, those render as a blank trigger since nothing
// matches. Normalize to a canonical key before populating the edit form.
const normalizePaymentMethod = (method: string | null | undefined): string => {
  const key = (method || "").trim().toLowerCase();
  if (key === "especes" || key === "espèces") return "cash";
  if (key === "chèque") return "cheque";
  if (key === "virement") return "transfer";
  if (key === "carte") return "card";
  if (["cash", "cheque", "transfer", "card"].includes(key)) return key;
  return "cash";
};

const Expenses = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [projectComboOpen, setProjectComboOpen] = useState(false);
  const [supplierComboOpen, setSupplierComboOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending">("all");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [editFormData, setEditFormData] = useState({
    expense_date: "",
    category: "",
    description: "",
    amount: "",
    payment_method: "cash",
    project_id: "",
    is_paid: true,
  });
  const [editProjectComboOpen, setEditProjectComboOpen] = useState(false);

  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split("T")[0],
    category: "",
    description: "",
    amount: "",
    payment_method: "cash",
    reference: "",
    notes: "",
    project_id: "",
    supplier_id: "",
    is_paid: true,
  });

  const { data: expenses, isLoading } = useExpenses(undefined); // Fetch all expenses
  const { data: stats } = useExpenseStats(undefined); // Get stats for all
  // Year-scoped (defaults to the current year, same as the Dashboard) — kept
  // separate from the all-time `stats` above so the Charges/CA ratio below
  // never silently divides an all-time total by a single year's revenue.
  const { data: yearStats } = useDashboardStats();
  const { data: projects } = useProjects();
  const { data: suppliers } = useSuppliers();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const { requireActive, blockedOpen, setBlockedOpen } = useLicenseGate();
  const selectedProject = projects?.find((p) => p.id === formData.project_id);
  const selectedSupplier = suppliers?.find((s) => s.id === formData.supplier_id);
  const editSelectedProject = projects?.find((p) => p.id === editFormData.project_id);

  // "Nouvelle dépense associée" from the Suppliers page arrives as
  // /expenses?supplier_id=X — open the create dialog with that supplier
  // pre-selected and the advanced section expanded so it's visible, then
  // drop the param so it doesn't re-trigger on a later unrelated visit.
  useEffect(() => {
    const supplierId = searchParams.get("supplier_id");
    if (!supplierId) return;
    setFormData((prev) => ({ ...prev, supplier_id: supplierId }));
    setAdvancedOpen(true);
    setIsDialogOpen(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("supplier_id");
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(amount) + " DA";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireActive()) return;
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }
    createExpense.mutate({
      expense_date: formData.expense_date,
      category: formData.category,
      description: formData.description || undefined,
      amount,
      payment_method: formData.payment_method,
      reference: formData.reference || undefined,
      notes: formData.notes || undefined,
      project_id: formData.project_id || undefined,
      supplier_id: formData.supplier_id || undefined,
      is_paid: formData.is_paid,
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setAdvancedOpen(false);
        setFormData({
          expense_date: new Date().toISOString().split("T")[0],
          category: "",
          description: "",
          amount: "",
          payment_method: "cash",
          reference: "",
          notes: "",
          project_id: "",
          supplier_id: "",
          is_paid: true,
        });
      }
    });
  };

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setEditFormData({
      expense_date: expense.expense_date,
      category: expense.category,
      description: expense.description || "",
      amount: String(expense.amount),
      payment_method: normalizePaymentMethod(expense.payment_method),
      project_id: expense.project_id || "",
      is_paid: isExpensePaid(expense),
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    const amount = parseFloat(editFormData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }
    updateExpense.mutate({
      id: editingExpense.id,
      expense_date: editFormData.expense_date,
      category: editFormData.category,
      description: editFormData.description || undefined,
      amount,
      payment_method: editFormData.payment_method,
      project_id: editFormData.project_id || undefined,
      is_paid: editFormData.is_paid,
    }, {
      onSuccess: () => setEditingExpense(null),
    });
  };

  // Filter by search query, selected months, and payment status
  const filteredExpenses = expenses?.filter(expense => {
    const matchesSearch = expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.category.toLowerCase().includes(searchQuery.toLowerCase());

    // Convert expense date (YYYY-MM-DD) to month format (YYYY-MM)
    const expenseMonth = expense.expense_date.slice(0, 7);
    const matchesMonth = selectedMonths.length === 0 ||
      selectedMonths.some(m => {
        // selectedMonths contains month numbers like "1", "2", etc.
        // We need to check if the expense month matches
        const [year, month] = expenseMonth.split('-');
        return m === month.replace(/^0/, ''); // Remove leading zero
      });

    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "paid" ? isExpensePaid(expense) : !isExpensePaid(expense));

    return matchesSearch && matchesMonth && matchesStatus;
  }) || [];

  // Desktop keyboard ergonomics — N opens the new-expense dialog, Escape
  // clears the search box, ArrowUp/ArrowDown + Enter select and open a row.
  const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
    rows: filteredExpenses,
    onOpen: (expense: Expense) => openEditDialog(expense),
    onCreate: () => setIsDialogOpen(true),
    onEscape: () => setSearchQuery(""),
  });

  const paidCount = (expenses ?? []).filter(isExpensePaid).length;
  const pendingCount = (expenses ?? []).length - paidCount;

  // Charges/CA ratio needs both sides scoped to the same year — `stats` above
  // is all-time, so the numerator is recomputed here from the current year's
  // expenses only, to match `yearStats`'s current-year CA.
  const currentYear = new Date().getFullYear();
  const chargesThisYear = (expenses ?? [])
    .filter((e) => new Date(e.expense_date).getFullYear() === currentYear)
    .reduce((sum, e) => sum + e.amount, 0);
  const caThisYear = yearStats?.salesCumulatives.totalHt || 0;
  const chargesRatio = caThisYear > 0 ? (chargesThisYear / caThisYear) * 100 : 0;
  const topCategory = stats?.byCategory
    ? Object.entries(stats.byCategory).sort(([, a], [, b]) => (b as number) - (a as number))[0]
    : undefined;

  const monthOptions = [
    { value: "1", label: "Janvier" },
    { value: "2", label: "Février" },
    { value: "3", label: "Mars" },
    { value: "4", label: "Avril" },
    { value: "5", label: "Mai" },
    { value: "6", label: "Juin" },
    { value: "7", label: "Juillet" },
    { value: "8", label: "Août" },
    { value: "9", label: "Septembre" },
    { value: "10", label: "Octobre" },
    { value: "11", label: "Novembre" },
    { value: "12", label: "Décembre" },
  ];

  return (
    <>
      <main className="flex-1 p-8 pt-4">
          <div className="max-w-[1600px] mx-auto w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Dépenses &amp; Charges</h1>
              <p className="text-sm text-muted-foreground mt-1">Suivez et catégorisez vos dépenses et charges d'exploitation</p>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-[30px] px-3 text-xs font-medium rounded-md shadow-xs gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Nouvelle Charge
                  <kbd className="ml-1 text-[10px] font-mono text-primary-foreground/70 border border-primary-foreground/30 rounded px-1 py-px">N</kbd>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-xl border border-border/80 shadow-2xl p-5">
                <DialogHeader>
                  <DialogTitle>Ajouter une charge</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Date</Label>
                      <DatePicker
                        value={formData.expense_date}
                        onChange={(v) => setFormData({ ...formData, expense_date: v })}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Montant (DA)</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">Nom de la charge *</Label>
                    <Input
                      placeholder="Ex: Électricité, Carburant, Salaires..."
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">Statut</Label>
                    <div className="flex items-center gap-1 p-1 mt-1.5 bg-secondary/30 w-fit rounded-xl border border-border/50">
                      {([{ value: true, label: "Payée" }, { value: false, label: "À payer" }] as const).map((opt) => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => setFormData({ ...formData, is_paid: opt.value })}
                          className={cn(
                            "px-4 py-2 text-sm font-medium transition-all rounded-lg",
                            formData.is_paid === opt.value
                              ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">Description</Label>
                    <Input
                      placeholder="Description de la charge"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>

                  {/* Progressive disclosure — payment method/reference/project/
                      notes are all optional or default-valued, so they start
                      tucked away instead of front-loading the form. */}
                  <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`} />
                        Options avancées
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-4 animate-fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm text-muted-foreground">Mode de paiement</Label>
                          <Select
                            value={formData.payment_method}
                            onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
                          >
                            <SelectTrigger className="mt-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Espèces</SelectItem>
                              <SelectItem value="cheque">Chèque</SelectItem>
                              <SelectItem value="transfer">Virement</SelectItem>
                              <SelectItem value="card">Carte</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Référence</Label>
                          <Input
                            placeholder="N° facture, etc."
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            className="mt-1.5"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm text-muted-foreground">Projet associé (optionnel)</Label>
                        <Popover open={projectComboOpen} onOpenChange={setProjectComboOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              className="mt-1.5 w-full justify-between font-normal"
                            >
                              <span className="flex items-center gap-2 truncate">
                                <FolderIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                                {selectedProject?.name || "Aucun projet"}
                              </span>
                              <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Rechercher un projet..." />
                              <CommandList>
                                <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="__none__"
                                    onSelect={() => {
                                      setFormData({ ...formData, project_id: "" });
                                      setProjectComboOpen(false);
                                    }}
                                  >
                                    Aucun projet
                                  </CommandItem>
                                  {projects?.map((project) => (
                                    <CommandItem
                                      key={project.id}
                                      value={project.name}
                                      onSelect={() => {
                                        setFormData({ ...formData, project_id: project.id });
                                        setProjectComboOpen(false);
                                      }}
                                    >
                                      {project.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <Label className="text-sm text-muted-foreground">Fournisseur associé (optionnel)</Label>
                        <Popover open={supplierComboOpen} onOpenChange={setSupplierComboOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              className="mt-1.5 w-full justify-between font-normal"
                            >
                              <span className="flex items-center gap-2 truncate">
                                <StoreIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                                {selectedSupplier?.name || "Aucun fournisseur"}
                              </span>
                              <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Rechercher un fournisseur..." />
                              <CommandList>
                                <CommandEmpty>Aucun fournisseur trouvé.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="__none__"
                                    onSelect={() => {
                                      setFormData({ ...formData, supplier_id: "" });
                                      setSupplierComboOpen(false);
                                    }}
                                  >
                                    Aucun fournisseur
                                  </CommandItem>
                                  {suppliers?.map((supplier) => (
                                    <CommandItem
                                      key={supplier.id}
                                      value={supplier.name}
                                      onSelect={() => {
                                        setFormData({ ...formData, supplier_id: supplier.id });
                                        setSupplierComboOpen(false);
                                      }}
                                    >
                                      {supplier.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <Label className="text-sm text-muted-foreground">Notes</Label>
                        <Textarea
                          placeholder="Notes additionnelles..."
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          className="mt-1.5 rounded-xl"
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button type="submit" disabled={createExpense.isPending}>
                      {createExpense.isPending ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Metric strip — shared KPI ribbon component. */}
          <div className="mb-4">
            <MetricStrip
              cells={[
                { key: "total", label: "Total Charges", value: formatCurrency(stats?.total || 0), numericValue: stats?.total || 0, format: formatCurrency, icon: Receipt, sublabel: `${stats?.count || 0} charges` },
                {
                  key: "top_category",
                  label: "Dépense Principale",
                  value: topCategory ? formatCurrency(topCategory[1] as number) : formatCurrency(0),
                  numericValue: topCategory ? (topCategory[1] as number) : 0,
                  format: formatCurrency,
                  icon: Wallet,
                  sublabel: topCategory ? topCategory[0] : "-",
                },
                {
                  key: "ratio",
                  label: "Ratio Charges/CA",
                  value: `${chargesRatio.toFixed(1)}%`,
                  numericValue: chargesRatio,
                  format: (v) => `${v.toFixed(1)}%`,
                  icon: Receipt,
                  sublabel: `Exercice ${currentYear}`,
                },
              ]}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4 relative z-30">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              className="h-[30px] text-xs bg-background border-border/80 rounded-md"
              containerClassName="flex-1 max-w-sm"
            />

            <div className="w-full sm:w-80">
              <MultiSelect
                options={monthOptions}
                selected={selectedMonths}
                onChange={setSelectedMonths}
                placeholder="Filtrer par mois..."
                className="w-full"
              />
            </div>
          </div>

          {/* Payment-status filter — same segmented-pill pattern used
              elsewhere in the app for view tabs with counts. */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {([
              { key: "all", label: "Toutes", count: expenses?.length || 0 },
              { key: "paid", label: "Payées", count: paidCount },
              { key: "pending", label: "À payer", count: pendingCount },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all",
                  statusFilter === tab.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground"
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums",
                    statusFilter === tab.key ? "bg-primary-foreground/20" : "bg-secondary text-foreground/70"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Edge-to-edge desktop data grid. */}
          <div className="border border-border/80 rounded-md bg-card overflow-hidden w-full">
            <Table>
              <TableHeader>
                <TableRow className="h-8 bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Date</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Catégorie</TableHead>
                  <TableHead className="hidden md:table-cell text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Description</TableHead>
                  <TableHead className="hidden lg:table-cell text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Projet</TableHead>
                  <TableHead className="hidden sm:table-cell text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Mode</TableHead>
                  <TableHead numeric className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Montant</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Statut</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoading columns={8} rows={5} />
                ) : filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState
                        type="expenses"
                        title="Aucune charge"
                        description={searchQuery ? "Essayez une autre recherche" : "Ajoutez votre première charge"}
                        action={searchQuery ? {
                          label: "Effacer la recherche",
                          onClick: () => setSearchQuery(""),
                        } : {
                          label: "Ajouter",
                          onClick: () => setIsDialogOpen(true),
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ) : filteredExpenses.map((expense, index) => (
                  <TableRow
                    key={expense.id}
                    onDoubleClick={() => openEditDialog(expense)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={cn(
                      "h-8 text-xs border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer",
                      focusedIndex === index && "bg-muted/40 ring-1 ring-inset ring-ring/40"
                    )}
                  >
                    <TableCell className="text-muted-foreground">
                      {new Date(expense.expense_date).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <span className="px-3 py-1 bg-secondary rounded-full text-sm font-medium">
                        {expense.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell max-w-[240px]">
                      {expense.description ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block truncate">{expense.description}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top">{expense.description}</TooltipContent>
                        </Tooltip>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {expense.project_name ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                          <FolderIcon className="w-3 h-3" />
                          {expense.project_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">{formatPaymentMethod(expense.payment_method)}</TableCell>
                    <TableCell numeric className="font-medium text-destructive">
                      -{formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={isExpensePaid(expense) ? "success" : "warning"}>
                        {isExpensePaid(expense) ? "Payée" : "À payer"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => openEditDialog(expense)}
                              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-all"
                            >
                              <Pencil className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Modifier</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setExpenseToDelete(expense)}
                              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-all"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Supprimer</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </div>
      </main>

      {/* Edit Expense Modal — opened from the row's pencil action or a
          double-click on the row itself, pre-populated from the expense
          being edited. */}
      <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
        <DialogContent className="max-w-md rounded-xl border border-border/80 shadow-2xl p-5">
          <DialogHeader>
            <DialogTitle>Modifier la charge</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Date</Label>
                <DatePicker
                  value={editFormData.expense_date}
                  onChange={(v) => setEditFormData({ ...editFormData, expense_date: v })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Montant (DA)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={editFormData.amount}
                  onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                  required
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Catégorie *</Label>
              <Input
                placeholder="Ex: Électricité, Carburant, Salaires..."
                value={editFormData.category}
                onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Description</Label>
              <Input
                placeholder="Description de la charge"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Mode de paiement</Label>
                <Select
                  value={editFormData.payment_method}
                  onValueChange={(v) => setEditFormData({ ...editFormData, payment_method: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Espèces</SelectItem>
                    <SelectItem value="cheque">Chèque</SelectItem>
                    <SelectItem value="transfer">Virement</SelectItem>
                    <SelectItem value="card">Carte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Projet associé</Label>
                <Popover open={editProjectComboOpen} onOpenChange={setEditProjectComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="mt-1.5 w-full justify-between font-normal"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <FolderIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                        {editSelectedProject?.name || "Aucun projet"}
                      </span>
                      <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Rechercher un projet..." />
                      <CommandList>
                        <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => {
                              setEditFormData({ ...editFormData, project_id: "" });
                              setEditProjectComboOpen(false);
                            }}
                          >
                            Aucun projet
                          </CommandItem>
                          {projects?.map((project) => (
                            <CommandItem
                              key={project.id}
                              value={project.name}
                              onSelect={() => {
                                setEditFormData({ ...editFormData, project_id: project.id });
                                setEditProjectComboOpen(false);
                              }}
                            >
                              {project.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Statut</Label>
              <div className="flex items-center gap-1 p-1 mt-1.5 bg-secondary/30 w-fit rounded-xl border border-border/50">
                {([{ value: true, label: "Payée" }, { value: false, label: "À payer" }] as const).map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setEditFormData({ ...editFormData, is_paid: opt.value })}
                    className={cn(
                      "px-4 py-2 text-sm font-medium transition-all rounded-lg",
                      editFormData.is_paid === opt.value
                        ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setEditingExpense(null)}>
                Annuler
              </Button>
              <Button type="submit" disabled={updateExpense.isPending}>
                {updateExpense.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette charge ?</AlertDialogTitle>
            <AlertDialogDescription>
              {expenseToDelete && (
                <>
                  "{expenseToDelete.description || expenseToDelete.category}" — {formatCurrency(expenseToDelete.amount)} du{" "}
                  {expenseToDelete.expense_date}. Cette action est irréversible.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (expenseToDelete) deleteExpense.mutate(expenseToDelete.id);
                setExpenseToDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LicenseBlockedModal open={blockedOpen} onOpenChange={setBlockedOpen} />
    </>
  );
};

export default Expenses;
