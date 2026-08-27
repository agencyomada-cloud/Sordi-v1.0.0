import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  RiAddLine as Plus,
  RiDeleteBinLine as Trash2,
  RiReceiptLine as Receipt,
  RiWallet3Line as Wallet,
  RiExpandUpDownLine as ChevronsUpDown,
  RiFolderChartLine as FolderIcon,
  RiStore2Line as StoreIcon,
  RiArrowDownSLine as ChevronDown,
} from "@remixicon/react";
import { Button, SearchInput, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableLoading, EmptyState, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, MultiSelect, Label, Input, Textarea, Popover, PopoverContent, PopoverTrigger, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Tooltip, TooltipTrigger, TooltipContent, Collapsible, CollapsibleTrigger, CollapsibleContent } from "@sordi/ui";
import { MetricStrip } from "@/components/ui/metric-strip";
import { DatePicker } from "@/components/ui/date-picker";
import { useExpenses, useCreateExpense, useDeleteExpense, useExpenseStats } from "@/hooks/useExpenses";
import { useProjects } from "@/hooks/useProjects";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useDashboardStats } from "@/hooks/useDashboardStats";

const Expenses = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [projectComboOpen, setProjectComboOpen] = useState(false);
  const [supplierComboOpen, setSupplierComboOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
  const deleteExpense = useDeleteExpense();
  const selectedProject = projects?.find((p) => p.id === formData.project_id);
  const selectedSupplier = suppliers?.find((s) => s.id === formData.supplier_id);

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
    createExpense.mutate({
      expense_date: formData.expense_date,
      category: formData.category,
      description: formData.description || undefined,
      amount: parseFloat(formData.amount),
      payment_method: formData.payment_method,
      reference: formData.reference || undefined,
      notes: formData.notes || undefined,
      project_id: formData.project_id || undefined,
      supplier_id: formData.supplier_id || undefined,
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
        });
      }
    });
  };

  // Filter by search query and selected months
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

    return matchesSearch && matchesMonth;
  }) || [];

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
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Charges & Dépenses</h1>
              <p className="text-muted-foreground mt-1">Gérez vos charges et suivez vos dépenses</p>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle Charge
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-3xl">
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
          <div className="mb-6">
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
          <div className="flex flex-col sm:flex-row gap-4 mb-6 relative z-30">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
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

          {/* Table — borderless outer surface, resting directly on the page canvas. */}
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead className="hidden lg:table-cell">Projet</TableHead>
                  <TableHead className="hidden sm:table-cell">Mode</TableHead>
                  <TableHead numeric>Montant</TableHead>
                  <TableHead className="w-14"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoading columns={7} rows={5} />
                ) : filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
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
                ) : filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
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
                    <TableCell className="capitalize text-muted-foreground hidden sm:table-cell">{expense.payment_method}</TableCell>
                    <TableCell numeric className="font-medium text-destructive">
                      -{formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => deleteExpense.mutate(expense.id)}
                              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all"
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
    </>
  );
};

export default Expenses;
