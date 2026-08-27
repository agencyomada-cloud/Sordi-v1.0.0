import { useState, useEffect } from "react";
import {
  RiPencilLine as Pencil,
  RiAddLine as Plus,
  RiBox3Line as Package,
  RiDeleteBinLine as Trash2,
  RiStarLine as StarIcon,
  RiMoneyDollarCircleLine as RevenueIcon,
} from "@remixicon/react";
import { Input, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Label, TableLoading, EmptyState, Checkbox, SearchInput, Tooltip, TooltipTrigger, TooltipContent, StatusBadge } from "@sordi/ui";
import { MetricStrip } from "@/components/ui/metric-strip";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import type { CreateProductData, Product } from "@/lib/database";

// Agency billing units, replacing the old weight/volume units (tonne, m³...).
// "Forfait / Projet" is the default — most agency work is scoped/quoted, not
// metered by weight like the old quarry catalogue.
const BILLING_UNITS = ["Forfait / Projet", "Taux Journalier (TJM / Jour)", "Heure", "Abonnement Mensuel", "Pack Annuel"];
// Sentinel for "Autre" in the Select — never stored as the actual unit
// value. Picking it reveals a free-text input instead, so a unit outside
// the fixed list (e.g. "Mot", "Page", "Session") can still be typed in.
const CUSTOM_UNIT_OPTION = "__custom__";

const REFERENCE_PREFIX = "OM-";

// Next available OM-XXX reference — scans existing codes for the OM- prefix
// and increments past the highest numeric suffix found, so two products
// created back-to-back never collide even if some codes were hand-edited
// away from the auto-generated pattern.
function nextReference(products: Product[] | undefined): string {
  const used = (products ?? [])
    .map((p) => p.code)
    .filter((c) => c.startsWith(REFERENCE_PREFIX))
    .map((c) => parseInt(c.slice(REFERENCE_PREFIX.length), 10))
    .filter((n) => !isNaN(n));
  const next = (used.length > 0 ? Math.max(...used) : 0) + 1;
  return `${REFERENCE_PREFIX}${String(next).padStart(3, "0")}`;
}


export default function ProductsPage() {
  const { data: products, isLoading } = useProducts();
  // Current-year sales stats (same default scope as the Dashboard) — used
  // for the "Plus vendu" / "CA généré" metrics below.
  const { data: dashboardStats } = useDashboardStats();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const filteredProducts = products?.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (p.code || "").toLowerCase().includes(q) ||
      (p.name || "").toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q) ||
      (p.unit || "").toLowerCase().includes(q)
    );
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState({
    code: "",
    name: "",
    description: "",
    unit: BILLING_UNITS[0],
    unit_price: 0,
    tva_rate: 19.0 as number | null,
  });
  const [newProductExemptFromTimbre, setNewProductExemptFromTimbre] = useState(false);
  const [newProductPopoverOpen, setNewProductPopoverOpen] = useState(false);
  // Explicit "Autre" mode for the create form's unit picker — also turned
  // on automatically (see the Select below) whenever the current unit
  // isn't one of BILLING_UNITS, so a pre-filled custom value from a draft
  // still shows its free-text input instead of an empty Select.
  const [newProductCustomUnit, setNewProductCustomUnit] = useState(false);

  const resetNewProduct = () => {
    setNewProduct({ code: nextReference(products), name: "", description: "", unit: BILLING_UNITS[0], unit_price: 0, tva_rate: 19.0 });
    setNewProductExemptFromTimbre(false);
    setNewProductCustomUnit(false);
  };

  // Load draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem("draft_product");
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed) {
          setNewProduct(parsed);
          // Check if tva_rate was -1 (exempt from timbre logic handled in save/load?)
          // Actually we save the whole state, so just restoring is enough,
          // BUT we need to handle newProductExemptFromTimbre state if we want 100% restoration.
          // Let's assume we just save the product data for now or we add the boolean to what needs saving?
          // The current save logic below will save newProduct.
        }
      } catch (e) { }
    }
  }, []);

  // Suggest the next OM-XXX reference whenever the create dialog opens with
  // no code typed yet (a fresh dialog, or a draft that predates this field)
  // — never overwrites a code the user (or a restored draft) already set.
  useEffect(() => {
    if (!isDialogOpen) return;
    setNewProduct((prev) => (prev.code ? prev : { ...prev, code: nextReference(products) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDialogOpen]);

  // Save draft on change
  useEffect(() => {
    if (newProduct.code || newProduct.name) {
      localStorage.setItem("draft_product", JSON.stringify(newProduct));
    }
  }, [newProduct]);

  const handleCreateProduct = () => {
    if (!newProduct.code.trim() || !newProduct.name.trim()) return;
    createProduct.mutate({ ...newProduct, timbre_exempt: newProductExemptFromTimbre }, {
      onSuccess: () => {
        localStorage.removeItem("draft_product");
        setIsDialogOpen(false);
        resetNewProduct();
      },
    });
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setIsEditDialogOpen(true);
  };

  const handleDelete = () => {
    if (!productToDelete) return;
    deleteProduct.mutate(productToDelete, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setProductToDelete(null);
      },
    });
  };

  const handleUpdateProduct = () => {
    if (!editingProduct || !editProductData.code.trim() || !editProductData.name.trim()) return;
    updateProduct.mutate({ id: editingProduct.id, data: { ...editProductData, timbre_exempt: editProductExemptFromTimbre } }, {
      onSuccess: () => {
        setIsEditDialogOpen(false);
        setEditingProduct(null);
      },
    });
  };

  // State for editing product
  const [editProductData, setEditProductData] = useState({
    code: "",
    name: "",
    description: "",
    unit: "",
    unit_price: 0,
    tva_rate: 19.0 as number | null,
  });
  const [editProductExemptFromTimbre, setEditProductExemptFromTimbre] = useState(false);
  const [editProductPopoverOpen, setEditProductPopoverOpen] = useState(false);
  const [editProductCustomUnit, setEditProductCustomUnit] = useState(false);

  // Initialize edit form when product is selected
  useEffect(() => {
    if (editingProduct) {
      setEditProductData({
        code: editingProduct.code,
        name: editingProduct.name,
        description: editingProduct.description || "",
        unit: editingProduct.unit || "",
        unit_price: editingProduct.unit_price,
        tva_rate: editingProduct.tva_rate ?? 19.0,
      });
      // Use existing field or default to false
      setEditProductExemptFromTimbre(editingProduct.timbre_exempt === true);
      setEditProductCustomUnit(false);
    }
  }, [editingProduct]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-DZ", {
      style: "decimal",
      minimumFractionDigits: 2,
    }).format(amount) + " DA";
  };

  const productStats = dashboardStats?.productStats ?? [];
  const bestSeller = productStats.length > 0
    ? [...productStats].sort((a, b) => b.total_quantity - a.total_quantity)[0]
    : undefined;
  const caGenerated = productStats.reduce((sum, p) => sum + p.total_amount, 0);

  return (
    <>
      <main className="flex-1 p-8 pt-4">
          <div className="max-w-[1600px] mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Catalogue des Services &amp; Offres Digitales</h1>
              <p className="text-muted-foreground mt-1">Gestion des prestations créatives, développement web, forfaits marketing et abonnements.</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau Service / Produit
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl">
                <DialogHeader>
                  <DialogTitle>Ajouter un service ou produit</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Référence *</Label>
                      <Input
                        value={newProduct.code}
                        onChange={(e) => setNewProduct({ ...newProduct, code: e.target.value })}
                        placeholder="OM-001"
                        className="mt-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Unité de facturation</Label>
                      <Select
                        value={newProductCustomUnit || !BILLING_UNITS.includes(newProduct.unit) ? CUSTOM_UNIT_OPTION : newProduct.unit}
                        onValueChange={(value) => {
                          if (value === CUSTOM_UNIT_OPTION) {
                            setNewProductCustomUnit(true);
                            setNewProduct({ ...newProduct, unit: "" });
                          } else {
                            setNewProductCustomUnit(false);
                            setNewProduct({ ...newProduct, unit: value });
                          }
                        }}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BILLING_UNITS.map((unit) => (
                            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                          ))}
                          <SelectItem value={CUSTOM_UNIT_OPTION}>Autre (personnalisé)</SelectItem>
                        </SelectContent>
                      </Select>
                      {(newProductCustomUnit || !BILLING_UNITS.includes(newProduct.unit)) && (
                        <Input
                          value={newProduct.unit}
                          onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                          placeholder="Ex : Mot, Page, Session…"
                          className="mt-1.5"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Service / Prestation *</Label>
                    <Input
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      placeholder="Refonte identité visuelle"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Description</Label>
                    <Input
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      placeholder="Description de la prestation"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Prix unitaire (DA)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newProduct.unit_price}
                      onChange={(e) => setNewProduct({ ...newProduct, unit_price: parseFloat(e.target.value) || 0 })}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="border rounded-md p-3">
                      <Label className="text-sm font-semibold mb-3 block">TVA</Label>
                      <Popover
                        open={newProductPopoverOpen}
                        onOpenChange={setNewProductPopoverOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal h-11">
                            {newProduct.tva_rate === -1 ? "Exo (TVA)" :
                              newProduct.tva_rate === null || newProduct.tva_rate === 0 ? "0% (Non assujetti)" :
                                newProduct.tva_rate === undefined ? "19%" :
                                  `${newProduct.tva_rate}%`}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] p-3" align="center">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Taux Standards</h4>
                              <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" className="h-auto py-2 px-3 text-xs bg-transparent hover:bg-muted justify-start font-medium" onClick={() => { setNewProduct({ ...newProduct, tva_rate: 19 }); setNewProductPopoverOpen(false); }}>
                                  19%
                                </Button>
                                <Button variant="outline" className="h-auto py-2 px-3 text-xs bg-transparent hover:bg-muted justify-start font-medium" onClick={() => { setNewProduct({ ...newProduct, tva_rate: 9 }); setNewProductPopoverOpen(false); }}>
                                  9%
                                </Button>
                                <Button variant="outline" className="h-auto py-2 px-3 text-xs bg-transparent hover:bg-muted justify-start text-left whitespace-normal leading-tight min-h-[40px]" onClick={() => { setNewProduct({ ...newProduct, tva_rate: 0 }); setNewProductPopoverOpen(false); }}>
                                  0% (Non assujetti)
                                </Button>
                                <Button variant="outline" className="h-auto py-2 px-3 text-xs bg-transparent hover:bg-muted justify-start text-left whitespace-normal leading-tight min-h-[40px]" onClick={() => { setNewProduct({ ...newProduct, tva_rate: -1 }); setNewProductPopoverOpen(false); }}>
                                  Exo (TVA)
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2 pt-2 border-t">
                              <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Taux Personnalisé</h4>
                              <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                  <Input
                                    type="number"
                                    placeholder="Ex: 7"
                                    className="h-9 text-sm pr-8"
                                    min="0"
                                    step="0.01"
                                    value={newProduct.tva_rate && newProduct.tva_rate > 0 ? newProduct.tva_rate : ""}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                      setNewProduct({ ...newProduct, tva_rate: val });
                                    }}
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">%</span>
                                </div>
                                <Button size="sm" onClick={() => setNewProductPopoverOpen(false)}>OK</Button>
                              </div>
                            </div>

                            <div className="pt-2 border-t flex items-center space-x-2">
                              <Checkbox
                                id="new-product-timbre"
                                checked={newProductExemptFromTimbre}
                                onCheckedChange={(checked) => setNewProductExemptFromTimbre(checked === true)}
                              />
                              <label
                                htmlFor="new-product-timbre"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                Non assujetti au timbre
                              </label>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button
                      onClick={handleCreateProduct}
                      disabled={createProduct.isPending || !newProduct.code.trim() || !newProduct.name.trim()}
                    >
                      {createProduct.isPending ? "Création..." : "Créer"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Product Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="rounded-3xl">
                <DialogHeader>
                  <DialogTitle>Modifier le service / produit</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Référence *</Label>
                      <Input
                        value={editProductData.code}
                        onChange={(e) => setEditProductData({ ...editProductData, code: e.target.value })}
                        placeholder="OM-001"
                        className="mt-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Unité de facturation</Label>
                      <Select
                        value={editProductCustomUnit || !BILLING_UNITS.includes(editProductData.unit) ? CUSTOM_UNIT_OPTION : editProductData.unit}
                        onValueChange={(value) => {
                          if (value === CUSTOM_UNIT_OPTION) {
                            setEditProductCustomUnit(true);
                            setEditProductData({ ...editProductData, unit: "" });
                          } else {
                            setEditProductCustomUnit(false);
                            setEditProductData({ ...editProductData, unit: value });
                          }
                        }}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BILLING_UNITS.map((unit) => (
                            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                          ))}
                          <SelectItem value={CUSTOM_UNIT_OPTION}>Autre (personnalisé)</SelectItem>
                        </SelectContent>
                      </Select>
                      {(editProductCustomUnit || !BILLING_UNITS.includes(editProductData.unit)) && (
                        <Input
                          value={editProductData.unit}
                          onChange={(e) => setEditProductData({ ...editProductData, unit: e.target.value })}
                          placeholder="Ex : Mot, Page, Session…"
                          className="mt-1.5"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Service / Prestation *</Label>
                    <Input
                      value={editProductData.name}
                      onChange={(e) => setEditProductData({ ...editProductData, name: e.target.value })}
                      placeholder="Refonte identité visuelle"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Description</Label>
                    <Input
                      value={editProductData.description}
                      onChange={(e) => setEditProductData({ ...editProductData, description: e.target.value })}
                      placeholder="Description de la prestation"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Prix unitaire (DA)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editProductData.unit_price}
                      onChange={(e) => setEditProductData({ ...editProductData, unit_price: parseFloat(e.target.value) || 0 })}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="border rounded-md p-3">
                      <Label className="text-sm font-semibold mb-3 block">TVA</Label>
                      <Popover
                        open={editProductPopoverOpen}
                        onOpenChange={setEditProductPopoverOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal h-11">
                            {editProductData.tva_rate === -1 ? "Exo (TVA)" :
                              editProductData.tva_rate === null || editProductData.tva_rate === 0 ? "0% (Non assujetti)" :
                                editProductData.tva_rate === undefined ? "19%" :
                                  `${editProductData.tva_rate}%`}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] p-3" align="start">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Taux Standards</h4>
                              <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" className="h-auto py-2 px-3 text-xs bg-transparent hover:bg-muted justify-start font-medium" onClick={() => { setEditProductData({ ...editProductData, tva_rate: 19 }); setEditProductPopoverOpen(false); }}>
                                  19%
                                </Button>
                                <Button variant="outline" className="h-auto py-2 px-3 text-xs bg-transparent hover:bg-muted justify-start font-medium" onClick={() => { setEditProductData({ ...editProductData, tva_rate: 9 }); setEditProductPopoverOpen(false); }}>
                                  9%
                                </Button>
                                <Button variant="outline" className="h-auto py-2 px-3 text-xs bg-transparent hover:bg-muted justify-start text-left whitespace-normal leading-tight min-h-[40px]" onClick={() => { setEditProductData({ ...editProductData, tva_rate: 0 }); setEditProductPopoverOpen(false); }}>
                                  0% (Non assujetti)
                                </Button>
                                <Button variant="outline" className="h-auto py-2 px-3 text-xs bg-transparent hover:bg-muted justify-start text-left whitespace-normal leading-tight min-h-[40px]" onClick={() => { setEditProductData({ ...editProductData, tva_rate: -1 }); setEditProductPopoverOpen(false); }}>
                                  Exo (TVA)
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2 pt-2 border-t">
                              <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Taux Personnalisé</h4>
                              <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                  <Input
                                    type="number"
                                    placeholder="Ex: 7"
                                    className="h-9 text-sm pr-8"
                                    min="0"
                                    step="0.01"
                                    value={editProductData.tva_rate && editProductData.tva_rate > 0 ? editProductData.tva_rate : ""}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                      setEditProductData({ ...editProductData, tva_rate: val });
                                    }}
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">%</span>
                                </div>
                                <Button size="sm" onClick={() => setEditProductPopoverOpen(false)}>OK</Button>
                              </div>
                            </div>

                            <div className="pt-2 border-t flex items-center space-x-2">
                              <Checkbox
                                id="edit-product-timbre"
                                checked={editProductExemptFromTimbre}
                                onCheckedChange={(checked) => setEditProductExemptFromTimbre(checked === true)}
                              />
                              <label
                                htmlFor="edit-product-timbre"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                Non assujetti au timbre
                              </label>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button
                      onClick={handleUpdateProduct}
                      disabled={updateProduct.isPending || !editProductData.code.trim() || !editProductData.name.trim()}
                    >
                      {updateProduct.isPending ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Metric strip — shared KPI ribbon component. */}
          <div className="mb-6">
            <MetricStrip
              cells={[
                { key: "total", label: "Total Services & Produits", value: String(products?.length || 0), numericValue: products?.length || 0, format: (v) => String(Math.round(v)), icon: Package },
                {
                  key: "best_seller",
                  label: "Plus Vendu",
                  value: bestSeller ? bestSeller.product_name : "-",
                  icon: StarIcon,
                  sublabel: bestSeller ? `${new Intl.NumberFormat("fr-DZ").format(bestSeller.total_quantity)} unités · ${new Date().getFullYear()}` : undefined,
                },
                { key: "ca", label: "CA Généré", value: formatCurrency(caGenerated), numericValue: caGenerated, format: formatCurrency, icon: RevenueIcon, sublabel: `Exercice ${new Date().getFullYear()}` },
              ]}
            />
          </div>

          <div className="mb-6">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Rechercher par code, nom ou description..."
              containerClassName="w-full sm:w-80"
            />
          </div>

          {/* Table — borderless outer surface, resting directly on the page
              canvas, matching the Clients/Expenses table pattern. */}
          <div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Référence</TableHead>
                  <TableHead>Service / Prestation</TableHead>
                  <TableHead className="hidden lg:table-cell">Unité de facturation</TableHead>
                  <TableHead numeric>Prix unitaire HT</TableHead>
                  <TableHead numeric className="hidden md:table-cell">TVA</TableHead>
                  <TableHead numeric>Prix TTC</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-14"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoading columns={8} rows={5} />
                ) : filteredProducts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState
                        type="products"
                        title="Aucun service"
                        description={searchQuery ? "Essayez une autre recherche" : "Créez votre première prestation"}
                        action={searchQuery ? {
                          label: "Effacer la recherche",
                          onClick: () => setSearchQuery(""),
                        } : {
                          label: "Créer",
                          onClick: () => setIsDialogOpen(true),
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts?.map((product) => {
                    // -1 is the "Exo (TVA)" sentinel used throughout this
                    // page's TVA picker — exempt, so it contributes 0% to TTC
                    // just like the null/0 "non assujetti" case.
                    const tvaRate = product.tva_rate && product.tva_rate > 0 ? product.tva_rate : 0;
                    const priceTtc = product.unit_price * (1 + tvaRate / 100);
                    const isActive = product.is_active !== false;
                    return (
                    <TableRow key={product.id} className="group" dimmed={!isActive}>
                      <TableCell className="text-muted-foreground font-mono tabular-nums tracking-tight">{product.code}</TableCell>
                      <TableCell className="font-medium max-w-[240px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">{product.name}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top">{product.name}</TooltipContent>
                          </Tooltip>
                          {product.unit && (
                            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                              {product.unit}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">{product.unit || "-"}</TableCell>
                      <TableCell numeric>{formatCurrency(product.unit_price)}</TableCell>
                      <TableCell numeric className="hidden md:table-cell text-muted-foreground">
                        {product.tva_rate === -1 ? "Exo" : `${tvaRate}%`}
                      </TableCell>
                      <TableCell numeric className="font-medium">{formatCurrency(priceTtc)}</TableCell>
                      <TableCell>
                        <StatusBadge tone={isActive ? "success" : "neutral"}>{isActive ? "Actif" : "Archivé"}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => startEdit(product)}
                                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Modifier</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => {
                                  setProductToDelete(product.id);
                                  setDeleteDialogOpen(true);
                                }}
                                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Supprimer</TooltipContent>
                          </Tooltip>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce service ?</AlertDialogTitle>
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
    </>
  );
}
