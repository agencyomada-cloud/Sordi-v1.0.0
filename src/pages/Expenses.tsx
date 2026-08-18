import { useState } from "react";
import { Plus, Trash2, Search, Receipt, Wallet } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useExpenses, useCreateExpense, useDeleteExpense, useExpenseStats } from "@/hooks/useExpenses";

const Expenses = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split("T")[0],
    category: "",
    description: "",
    amount: "",
    payment_method: "cash",
    reference: "",
    notes: "",
  });

  const { data: expenses, isLoading } = useExpenses(undefined); // Fetch all expenses
  const { data: stats } = useExpenseStats(undefined); // Get stats for all
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();

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
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setFormData({
          expense_date: new Date().toISOString().split("T")[0],
          category: "",
          description: "",
          amount: "",
          payment_method: "cash",
          reference: "",
          notes: "",
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
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 p-8 pt-4">
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Date</Label>
                      <Input
                        type="date"
                        value={formData.expense_date}
                        onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                        required
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

                  <div className="grid grid-cols-2 gap-4">
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
                    <Label className="text-sm text-muted-foreground">Notes</Label>
                    <Textarea
                      placeholder="Notes additionnelles..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="mt-1.5 rounded-xl"
                    />
                  </div>

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

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-card rounded-3xl p-6 shadow-card border border-border/30 flex items-center gap-5">
              <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center">
                <Receipt className="w-7 h-7 text-destructive" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground tracking-tight">
                  {formatCurrency(stats?.total || 0)}
                </p>
                <p className="text-sm text-muted-foreground">{stats?.count || 0} charges</p>
              </div>
            </div>

            {stats?.byCategory && Object.entries(stats.byCategory).slice(0, 2).map(([cat, amount]) => (
              <div key={cat} className="bg-card rounded-3xl p-6 shadow-card border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{cat}</span>
                </div>
                <p className="text-2xl font-bold text-foreground tracking-tight">
                  {formatCurrency(amount as number)}
                </p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                className="pl-11 h-11 bg-secondary/30 border-border/50 rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

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

          {/* Table */}
          <div className="bg-card rounded-3xl border border-border/30 shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead className="hidden sm:table-cell">Mode</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="w-14"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      Aucune charge trouvée
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
                    <TableCell className="text-muted-foreground hidden md:table-cell">{expense.description || "-"}</TableCell>
                    <TableCell className="capitalize text-muted-foreground hidden sm:table-cell">{expense.payment_method}</TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      -{formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => deleteExpense.mutate(expense.id)}
                        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Expenses;
