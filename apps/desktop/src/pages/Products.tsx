import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import {
  RiPencilLine as Pencil,
  RiAddLine as Plus,
  RiBox3Line as Package,
  RiDeleteBinLine as Trash2,
  RiStarLine as StarIcon,
  RiMoneyDollarCircleLine as RevenueIcon,
  RiErrorWarningLine as AlertCircle,
  RiArrowDownSLine as ChevronDown,
  RiArrowRightSLine as ChevronRight,
} from "@remixicon/react";
import { Input, Button, DesktopSegmentedControl, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Label, TableLoading, EmptyState, Checkbox, Tooltip, TooltipTrigger, TooltipContent, StatusBadge } from "@sordi/ui";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";
import { MetricStrip } from "@/components/ui/metric-strip";
import { FacetedSearchInput, type SearchFacet } from "@/components/common/FacetedSearchInput";
import { GridGroupBySelect, type GroupByOption } from "@/components/common/GridGroupBySelect";
import { useTableKeyboardNav } from "@/hooks/useTableKeyboardNav";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import type { CreateProductData, Product } from "@/lib/database";
import { cn } from "@/lib/utils";
import { useLicenseGate } from "@/hooks/useLicenseGate";
import { LicenseBlockedModal } from "@/components/licensing/LicenseBlockedModal";

// Agency billing units, replacing the old weight/volume units (tonne, m³...).
// "Forfait / Projet" is the default — most agency work is scoped/quoted, not
// metered by weight like the old quarry catalogue.
const BILLING_UNITS = ["Forfait / Projet", "Taux Journalier (TJM / Jour)", "Heure", "Abonnement Mensuel", "Pack Annuel"];
// Sentinel for "Autre" in the Select — never stored as the actual unit
// value. Picking it reveals a free-text input instead, so a unit outside
// the fixed list (e.g. "Mot", "Page", "Session") can still be typed in.
const CUSTOM_UNIT_OPTION = "__custom__";

// This schema has no dedicated "type" column distinguishing a Service from
// a tangible Produit — every predefined billing unit above describes billed
// time/scope, not a physical item, so a catalog entry using one of them (or
// no unit at all) reads as a Service. A custom/free-text unit (the "Autre"
// option in the create/edit form) is the only real signal that something
// might be a Produit instead. This is a best-effort derived classification,
// not a stored fact.
function isServiceUnit(unit: string | null | undefined): boolean {
  return !unit || BILLING_UNITS.includes(unit);
}

function productCategoryLabel(product: Product): "Service" | "Produit" {
  return isServiceUnit(product.unit) ? "Service" : "Produit";
}

const CATALOG_TABS: { label: string; filter: (p: Product) => boolean }[] = [
  { label: "Tous", filter: () => true },
  { label: "Services", filter: (p) => isServiceUnit(p.unit) },
  { label: "Produits", filter: (p) => !isServiceUnit(p.unit) },
  { label: "Actifs", filter: (p) => p.is_active !== false },
  { label: "Archivés", filter: (p) => p.is_active === false },
];

const GROUP_BY_OPTIONS: GroupByOption[] = [
  { value: "none", label: "Aucun regroupement" },
  { value: "type", label: "Type (Service / Produit)" },
  { value: "tva", label: "Taux TVA" },
];

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
  const { data: products, isLoading, isError, refetch } = useProducts();
  // Deep-link target from the command palette's Catalogue & Services
  // results (?highlight=<id>) — scrolls the matching row into view and
  // briefly rings it so the destination of the palette jump is obvious.
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const highlightRowRef = useRef<HTMLTableRowElement>(null);
  // Current-year sales stats (same default scope as the Dashboard) — used
  // for the "Plus vendu" / "CA généré" metrics below.
  const { data: dashboardStats } = useDashboardStats();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFacets, setSearchFacets] = useState<SearchFacet[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [groupBy, setGroupBy] = useState("none");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { requireActive, blockedOpen, setBlockedOpen } = useLicenseGate();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const filteredProducts = products?.filter((p) => {
    if (!CATALOG_TABS[activeTab].filter(p)) return false;

    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      (p.code || "").toLowerCase().includes(q) ||
      (p.name || "").toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q) ||
      (p.unit || "").toLowerCase().includes(q);

    // Faceted pills — "number" = Réf/code, "client" = Catégorie
    // (Service/Produit, the same derived label the group-by uses), "amount"
    // = Prix HT >= value.
    const category = productCategoryLabel(p);
    const matchesFacets = searchFacets.every((facet) => {
      if (facet.field === "number") return (p.code || "").toLowerCase().includes(facet.value.toLowerCase());
      if (facet.field === "client") return category.toLowerCase().includes(facet.value.toLowerCase());
      if (facet.field === "amount") return p.unit_price >= parseFloat(facet.value);
      return true;
    });

    return matchesQuery && matchesFacets;
  });

  // Group-by buckets — groupBy === "none" yields one unlabeled bucket so
  // flat and grouped rendering share the same renderProductRow() below.
  const productGroups = useMemo(() => {
    const list = filteredProducts ?? [];
    if (groupBy === "none") {
      return [{ key: "__all__", title: "", products: list, total: 0 }];
    }
    const order: string[] = [];
    const map = new Map<string, { key: string; title: string; products: Product[]; total: number }>();
    for (const product of list) {
      let key: string;
      let title: string;
      if (groupBy === "type") {
        title = productCategoryLabel(product);
        key = `type:${title}`;
      } else {
        title = product.tva_rate === -1 ? "Exo" : `${(product.tva_rate && product.tva_rate > 0 ? product.tva_rate : 0)}%`;
        key = `tva:${title}`;
      }
      if (!map.has(key)) {
        map.set(key, { key, title, products: [], total: 0 });
        order.push(key);
      }
      const group = map.get(key)!;
      group.products.push(product);
      const tvaRate = product.tva_rate && product.tva_rate > 0 ? product.tva_rate : 0;
      group.total += product.unit_price * (1 + tvaRate / 100);
    }
    return order.map((key) => map.get(key)!);
  }, [filteredProducts, groupBy]);

  const groupPrefix = groupBy === "type" ? "Type" : groupBy === "tva" ? "TVA" : "";

  // Flat visible order (skips collapsed groups' rows) — keyboard nav and
  // the row-index-based focus highlight below must agree on this exact
  // order, whether grouping is on or off.
  const visibleProducts = useMemo(
    () => productGroups.flatMap((group) => (collapsedGroups.has(group.key) ? [] : group.products)),
    [productGroups, collapsedGroups]
  );
  const indexById = useMemo(
    () => new Map(visibleProducts.map((product, i) => [product.id, i])),
    [visibleProducts]
  );

  const toggleGroupCollapsed = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Desktop keyboard ergonomics — N opens the create dialog, Escape clears
  // the search box/facets, ArrowUp/ArrowDown + Enter select and open a row.
  const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
    rows: visibleProducts,
    onOpen: (product: Product) => startEdit(product),
    onCreate: () => setIsDialogOpen(true),
    onEscape: () => {
      setSearchQuery("");
      setSearchFacets([]);
    },
  });

  useEffect(() => {
    if (highlightId && highlightRowRef.current) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, products]);

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
    if (!requireActive()) return;
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
    if (!requireActive()) return;
    setEditingProduct(product);
    setIsEditDialogOpen(true);
  };

  const handleDelete = () => {
    if (!requireActive()) return;
    if (!productToDelete) return;
    deleteProduct.mutate(productToDelete, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setProductToDelete(null);
      },
    });
  };

  const handleUpdateProduct = () => {
    if (!requireActive()) return;
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

  // Row renderer shared by the flat list and the grouped-by view below —
  // `index` is always this product's position in the flat VISIBLE order
  // (visibleProducts), so keyboard-nav highlighting stays correct whether
  // grouping is on or off.
  const renderProductRow = (product: Product, index: number) => {
                    // -1 is the "Exo (TVA)" sentinel used throughout this
                    // page's TVA picker — exempt, so it contributes 0% to TTC
                    // just like the null/0 "non assujetti" case.
                    const tvaRate = product.tva_rate && product.tva_rate > 0 ? product.tva_rate : 0;
                    const priceTtc = product.unit_price * (1 + tvaRate / 100);
                    const isActive = product.is_active !== false;
                    const isHighlighted = product.id === highlightId;
                    return (
                    <TableRow
                      key={product.id}
                      ref={isHighlighted ? highlightRowRef : undefined}
                      className={cn(
                        "h-8 text-xs border-b border-border/40 hover:bg-muted/20 transition-colors group",
                        isHighlighted && "bg-primary/5 ring-1 ring-inset ring-primary/40",
                        focusedIndex === index && "bg-muted/40 ring-1 ring-inset ring-ring/40"
                      )}
                      dimmed={!isActive}
                      onMouseEnter={() => setFocusedIndex(index)}
                    >
                      <TableCell className="text-muted-foreground font-mono tabular-nums tracking-tight">{product.code}</TableCell>
                      <TableCell className="font-medium max-w-[240px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block truncate">{product.name}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top">{product.name}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">{product.unit || "-"}</TableCell>
                      <TableCell numeric className="font-mono tabular-nums font-medium">{formatCurrency(product.unit_price)}</TableCell>
                      <TableCell numeric className="hidden md:table-cell font-mono tabular-nums text-muted-foreground">
                        {product.tva_rate === -1 ? "Exo" : `${tvaRate}%`}
                      </TableCell>
                      <TableCell numeric className="font-mono font-semibold tabular-nums">{formatCurrency(priceTtc)}</TableCell>
                      <TableCell>
                        <StatusBadge tone={isActive ? "success" : "neutral"}>{isActive ? "Actif" : "Archivé"}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => startEdit(product)}
                                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-all"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Modifier</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => {
                                  if (!requireActive()) return;
                                  setProductToDelete(product.id);
                                  setDeleteDialogOpen(true);
                                }}
                                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Supprimer</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
  };

  return (
    <>
      <main className="flex-1 p-8 pt-4">
          <div className="max-w-[1600px] mx-auto w-full">
          <div className="h-9 mb-3 flex items-center justify-between gap-4">
            <h1 className="text-sm font-semibold text-foreground truncate">Catalogue &amp; Services</h1>
            <Dialog
              open={isDialogOpen}
              onOpenChange={(next) => {
                if (next && !requireActive()) return;
                setIsDialogOpen(next);
              }}
            >
              <DialogTrigger asChild>
                <Button className="h-[30px] px-3 text-xs font-medium rounded-md gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Nouveau service / produit
                  <kbd className="ml-1 text-[10px] font-mono text-primary-foreground/70 border border-primary-foreground/30 rounded px-1 py-px">N</kbd>
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-xl border border-border/80 shadow-2xl p-5">
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
          </div>

          {/* Tabs and Search — standardized 2-zone toolbar (mirrors
              Invoices.tsx): left zone is the status/type segmented filter +
              count badge, always `shrink-0` so it never gets squeezed by
              the right zone; right zone is `flex-1 justify-end max-w-xl`
              with FacetedSearchInput constrained to a fixed-footprint box
              instead of sizing itself off a bare className. */}
          <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-border/40 mb-3">
            <div className="flex items-center gap-2 shrink-0">
              <DesktopSegmentedControl
                className="h-[30px]"
                options={CATALOG_TABS.map((t, i) => ({ value: String(i), label: t.label }))}
                value={String(activeTab)}
                onChange={(v) => setActiveTab(Number(v))}
              />
              <span className="text-xs text-muted-foreground font-mono tabular-nums ps-2 shrink-0 whitespace-nowrap">
                {filteredProducts?.length || 0} article{(filteredProducts?.length || 0) > 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-1 justify-end max-w-xl">
              <div className="w-64 min-w-[200px] max-w-[280px]">
                <FacetedSearchInput
                  query={searchQuery}
                  onQueryChange={setSearchQuery}
                  facets={searchFacets}
                  onFacetsChange={setSearchFacets}
                  placeholder="Rechercher..."
                  fieldLabels={{ number: "Réf", client: "Catégorie", amount: "Prix" }}
                  className="w-full"
                />
              </div>
              <GridGroupBySelect value={groupBy} onChange={setGroupBy} options={GROUP_BY_OPTIONS} />
            </div>
          </div>

          {/* Edit Product Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="rounded-xl border border-border/80 shadow-2xl p-5">
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

          {/* Metric strip — shared KPI ribbon component. */}
          <div className="mb-6">
            <MetricStrip
              cells={[
                { key: "total", label: "Total Articles", value: String(products?.length || 0), numericValue: products?.length || 0, format: (v) => String(Math.round(v)), icon: Package },
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

          {/* Edge-to-edge desktop data grid — a clean bordered card instead
              of a borderless surface. */}
          <div className="border border-border/80 rounded-md bg-card overflow-hidden w-full">
            <Table>
              <TableHeader>
                <TableRow className="h-8 bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Réf</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Désignation / Service</TableHead>
                  <TableHead className="hidden lg:table-cell text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Unité</TableHead>
                  <TableHead numeric className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Prix HT</TableHead>
                  <TableHead numeric className="hidden md:table-cell text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">TVA</TableHead>
                  <TableHead numeric className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Prix TTC</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Statut</TableHead>
                  <TableHead className="w-14"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoading columns={8} rows={5} />
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState
                        icon={AlertCircle}
                        tone="destructive"
                        title="Échec du chargement des données"
                        description="Une erreur est survenue lors du chargement des services."
                        action={{ label: "Réessayer", onClick: () => refetch() }}
                      />
                    </TableCell>
                  </TableRow>
                ) : filteredProducts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState
                        type="products"
                        title="Aucun service"
                        description={searchQuery || searchFacets.length > 0 ? "Essayez une autre recherche" : "Créez votre première prestation"}
                        action={searchQuery || searchFacets.length > 0 ? {
                          label: "Effacer la recherche",
                          onClick: () => { setSearchQuery(""); setSearchFacets([]); },
                        } : {
                          label: "Créer",
                          onClick: () => setIsDialogOpen(true),
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  groupBy === "none" ? (
                    visibleProducts.map((product, index) => renderProductRow(product, index))
                  ) : (
                    productGroups.map((group) => {
                      const collapsed = collapsedGroups.has(group.key);
                      return (
                        <Fragment key={group.key}>
                          <TableRow className="h-7 bg-muted/40 hover:bg-muted/40 border-y border-border/40">
                            <TableCell colSpan={8} className="p-0">
                              <button
                                type="button"
                                onClick={() => toggleGroupCollapsed(group.key)}
                                className="w-full h-7 font-semibold text-xs px-3 flex items-center justify-between gap-3 text-left"
                              >
                                <span className="flex items-center gap-1.5 min-w-0">
                                  {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                  <span className="truncate">
                                    {groupPrefix}: {group.title} ({group.products.length} article{group.products.length > 1 ? "s" : ""})
                                  </span>
                                </span>
                                <span className="font-mono tabular-nums shrink-0">Total TTC: {formatCurrency(group.total)}</span>
                              </button>
                            </TableCell>
                          </TableRow>
                          {!collapsed && group.products.map((product) => renderProductRow(product, indexById.get(product.id) ?? -1))}
                        </Fragment>
                      );
                    })
                  )
                )}
              </TableBody>
            </Table>
          </div>
          </div>
      </main>

      <DeleteConfirmationModal
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Supprimer ce service ?"
        itemIdentifier={products?.find((p) => p.id === productToDelete)?.name}
        isLoading={deleteProduct.isPending}
        onConfirm={handleDelete}
      />

      <LicenseBlockedModal open={blockedOpen} onOpenChange={setBlockedOpen} />
    </>
  );
}
