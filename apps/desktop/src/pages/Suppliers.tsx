import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RiAddLine as Plus,
  RiMoreFill as MoreHorizontal,
  RiPencilLine as Pencil,
  RiDeleteBinLine as Trash2,
  RiStore2Line as Store,
  RiWallet3Line as Wallet,
  RiCheckboxCircleLine as CheckCircle,
  RiScales3Line as Scales,
  RiReceiptLine as Receipt,
  RiErrorWarningLine as AlertCircle,
} from "@remixicon/react";
import {
  Button, SearchInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
  TableLoading, EmptyState, Tooltip, TooltipTrigger, TooltipContent, StatusBadge,
} from "@sordi/ui";
import { MetricStrip } from "@/components/ui/metric-strip";
import { useSuppliers, useDeleteSupplier, useRestoreSupplier, useSupplierPurchaseTotalsMap } from "@/hooks/useSuppliers";
import { NewSupplierDialog } from "@/components/NewSupplierDialog";
import type { Supplier } from "@/lib/database";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTableKeyboardNav } from "@/hooks/useTableKeyboardNav";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(amount) + " DA";

export default function SuppliersPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const { data: suppliers, isLoading, isError, refetch } = useSuppliers();
  const { data: purchaseTotalsBySupplierId } = useSupplierPurchaseTotalsMap();
  const deleteSupplier = useDeleteSupplier();
  const restoreSupplier = useRestoreSupplier();

  const categories = Array.from(new Set((suppliers ?? []).map((s) => s.category).filter(Boolean))) as string[];

  const activeCount = (suppliers ?? []).filter((s) => s.is_active !== false).length;
  const totalAchats = Array.from(purchaseTotalsBySupplierId.values()).reduce((sum, t) => sum + t.total_achats, 0);
  const totalSoldeDu = (suppliers ?? []).reduce((sum, s) => sum + (s.solde_du || 0), 0);
  const totalRegle = totalAchats - totalSoldeDu;

  const filteredSuppliers = suppliers?.filter((supplier) => {
    if (categoryFilter !== "all" && supplier.category !== categoryFilter) return false;
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase().trim();
    return (
      supplier.name.toLowerCase().includes(query) ||
      supplier.category?.toLowerCase().includes(query) ||
      supplier.phone?.toLowerCase().includes(query) ||
      supplier.email?.toLowerCase().includes(query) ||
      supplier.nif?.toLowerCase().includes(query) ||
      supplier.nis?.toLowerCase().includes(query) ||
      supplier.rc?.toLowerCase().includes(query) ||
      supplier.city?.toLowerCase().includes(query)
    );
  });

  const openCreateDialog = () => {
    setEditingSupplier(null);
    setDialogOpen(true);
  };

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setDialogOpen(true);
  };

  const openNewExpenseForSupplier = (supplier: Supplier) => {
    navigate(`/expenses?supplier_id=${supplier.id}`);
  };

  // Desktop keyboard ergonomics — N opens the new-supplier dialog, Escape
  // clears the search box, ArrowUp/ArrowDown + Enter select and open a row.
  const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
    rows: filteredSuppliers ?? [],
    onOpen: (supplier: Supplier) => openEditDialog(supplier),
    onCreate: () => openCreateDialog(),
    onEscape: () => setSearchQuery(""),
  });

  // Optimistic delete + Sonner undo toast (5s window) — the record is
  // actually deleted immediately; "Annuler" re-creates it via
  // useRestoreSupplier rather than reverting an in-flight mutation, since
  // the backend has no soft-delete to roll back to.
  const handleDelete = (supplier: Supplier) => {
    deleteSupplier.mutate(supplier.id);
    toast(`Fournisseur "${supplier.name}" supprimé`, {
      duration: 5000,
      action: {
        label: "Annuler",
        onClick: () => restoreSupplier.mutate(supplier),
      },
    });
  };

  return (
    <>
      <main className="flex-1 p-8 pt-4">
        <div className="max-w-[1600px] mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 animate-fade-in-down">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Fournisseurs & Prestataires</h1>
              <p className="text-xs text-slate-500 mt-1">Gérez vos fournisseurs et prestataires</p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                className="gap-1.5 h-[30px] px-3 text-xs rounded-md font-medium"
                onClick={openCreateDialog}
              >
                <Plus className="w-3.5 h-3.5" />
                Nouveau fournisseur
                <kbd className="text-[10px] font-mono text-primary-foreground/70 border border-primary-foreground/30 rounded px-1 py-px">N</kbd>
              </Button>
            </div>
          </div>

          {/* Metric strip */}
          <div className="mb-6 animate-fade-in-up animation-delay-100">
            <MetricStrip
              cells={[
                { key: "active", label: "Fournisseurs actifs", value: String(activeCount), numericValue: activeCount, format: (v) => String(Math.round(v)), icon: Store },
                { key: "achats", label: "Total Achats", value: formatCurrency(totalAchats), numericValue: totalAchats, format: formatCurrency, icon: Receipt },
                { key: "regle", label: "Total Réglé", value: formatCurrency(totalRegle), numericValue: totalRegle, format: formatCurrency, icon: CheckCircle },
                {
                  key: "solde",
                  label: "Solde Restant Dû",
                  value: formatCurrency(totalSoldeDu),
                  numericValue: totalSoldeDu,
                  format: formatCurrency,
                  icon: Scales,
                  trend: totalSoldeDu > 0 ? <StatusBadge tone="warning">Dû</StatusBadge> : <StatusBadge tone="neutral">Soldé</StatusBadge>,
                },
              ]}
            />
          </div>

          {/* Action & search bar — a single compact desktop row, not a
              stacked mobile-style filter block. */}
          <div className="flex items-center gap-2 mb-4 animate-fade-in-up animation-delay-150">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Rechercher par nom, catégorie, téléphone..."
              className="h-[30px] text-xs bg-background border-border/80 rounded-md"
              containerClassName="w-64"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-[30px] w-48 text-xs rounded-md border-border/80">
                <SelectValue placeholder="Toutes les catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="animate-fade-in-up animation-delay-200 border border-border/80 rounded-md bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="hidden md:table-cell">Catégorie</TableHead>
                  <TableHead className="hidden lg:table-cell">Téléphone</TableHead>
                  <TableHead numeric>Total Engagé</TableHead>
                  <TableHead numeric>Reste à Payer</TableHead>
                  <TableHead className="w-14"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoading columns={6} rows={5} />
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState
                        icon={AlertCircle}
                        tone="destructive"
                        title="Échec du chargement des données"
                        description="Une erreur est survenue lors du chargement des fournisseurs."
                        action={{ label: "Réessayer", onClick: () => refetch() }}
                      />
                    </TableCell>
                  </TableRow>
                ) : filteredSuppliers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      {/* Compact desktop empty state — the header's own
                          primary CTA already covers "create a supplier", so
                          this only ever offers a secondary action (clearing
                          a search) instead of a second, competing button. */}
                      <div className="flex flex-col items-center justify-center text-center py-12">
                        <Store className="size-8 text-muted-foreground/50 border border-border/60 rounded-md p-1.5 bg-muted/20 mb-2" strokeWidth={1.5} />
                        <p className="text-xs font-medium text-foreground">Aucun fournisseur</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {searchQuery ? "Essayez une autre recherche" : "Créez votre premier fournisseur"}
                        </p>
                        {searchQuery && (
                          <Button
                            variant="outline"
                            className="h-[30px] px-3 text-xs rounded-md mt-3"
                            onClick={() => setSearchQuery("")}
                          >
                            Effacer la recherche
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers?.map((supplier, index) => {
                    const totalAchatsForSupplier = purchaseTotalsBySupplierId.get(supplier.id)?.total_achats || 0;
                    const soldeDu = supplier.solde_du || 0;

                    return (
                      <ContextMenu key={supplier.id}>
                        <ContextMenuTrigger asChild>
                          <TableRow
                            className={cn(
                              "cursor-pointer",
                              focusedIndex === index && "bg-muted/40 ring-1 ring-inset ring-ring/40"
                            )}
                            dimmed={supplier.is_active === false}
                            onClick={() => openEditDialog(supplier)}
                            onMouseEnter={() => setFocusedIndex(index)}
                          >
                            <TableCell className="font-medium max-w-[240px]">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block truncate">{supplier.name}</span>
                                </TooltipTrigger>
                                <TooltipContent side="top">{supplier.name}</TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden md:table-cell">{supplier.category || "-"}</TableCell>
                            <TableCell className="text-muted-foreground hidden lg:table-cell">{supplier.phone || "-"}</TableCell>
                            <TableCell numeric className="font-mono tabular-nums">{formatCurrency(totalAchatsForSupplier)}</TableCell>
                            <TableCell numeric>
                              {soldeDu > 0 ? (
                                <StatusBadge tone="warning">{formatCurrency(soldeDu)}</StatusBadge>
                              ) : (
                                <StatusBadge tone="neutral">Soldé</StatusBadge>
                              )}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditDialog(supplier)}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Modifier
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openNewExpenseForSupplier(supplier)}>
                                    <Receipt className="w-4 h-4 mr-2" />
                                    Nouvelle dépense associée
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(supplier)}>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem onClick={() => openEditDialog(supplier)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Modifier
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => openNewExpenseForSupplier(supplier)}>
                            <Receipt className="w-4 h-4 mr-2" />
                            Nouvelle dépense associée
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem className="text-destructive" onClick={() => handleDelete(supplier)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>

      <NewSupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editingSupplier}
      />
    </>
  );
}
