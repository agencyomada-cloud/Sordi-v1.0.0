import { useState, useEffect } from "react";
import { 
  RiPencilLine as Pencil, 
  RiAddLine as Plus, 
  RiBox3Line as Package, 
  RiDeleteBinLine as Trash2 
} from "@remixicon/react";
import { Input, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Popover, PopoverContent, PopoverTrigger, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Label, TableLoading, RadioGroup, RadioGroupItem, Checkbox, SearchInput } from "@sordi/ui";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import type { CreateProductData, Product } from "@/lib/database";


export default function ProductsPage() {
  const { data: products, isLoading } = useProducts();
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
    unit: "",
    unit_price: 0,
    tva_rate: 19.0 as number | null,
  });
  const [newProductExemptFromTimbre, setNewProductExemptFromTimbre] = useState(false);
  const [newProductPopoverOpen, setNewProductPopoverOpen] = useState(false);

  const resetNewProduct = () => {
    setNewProduct({ code: "", name: "", description: "", unit: "", unit_price: 0, tva_rate: 19.0 });
    setNewProductExemptFromTimbre(false);
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
    }
  }, [editingProduct]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-DZ", {
      style: "decimal",
      minimumFractionDigits: 2,
    }).format(amount) + " DA";
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 p-8 pt-4">
          <div className="max-w-[1600px] mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Produits</h1>
              <p className="text-muted-foreground mt-1">Gérez les prix des produits de la carrière</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau produit
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl">
                <DialogHeader>
                  <DialogTitle>Ajouter un produit</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Code *</Label>
                      <Input
                        value={newProduct.code}
                        onChange={(e) => setNewProduct({ ...newProduct, code: e.target.value })}
                        placeholder="GRV01"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Unité</Label>
                      <Input
                        value={newProduct.unit}
                        onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                        placeholder="tonne"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Nom du produit *</Label>
                    <Input
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      placeholder="Gravier 8/15"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Description</Label>
                    <Input
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      placeholder="Description du produit"
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
                  <DialogTitle>Modifier le produit</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Code *</Label>
                      <Input
                        value={editProductData.code}
                        onChange={(e) => setEditProductData({ ...editProductData, code: e.target.value })}
                        placeholder="GRV01"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Unité</Label>
                      <Input
                        value={editProductData.unit}
                        onChange={(e) => setEditProductData({ ...editProductData, unit: e.target.value })}
                        placeholder="tonne"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Nom du produit *</Label>
                    <Input
                      value={editProductData.name}
                      onChange={(e) => setEditProductData({ ...editProductData, name: e.target.value })}
                      placeholder="Gravier 8/15"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Description</Label>
                    <Input
                      value={editProductData.description}
                      onChange={(e) => setEditProductData({ ...editProductData, description: e.target.value })}
                      placeholder="Description du produit"
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

          {/* Stats & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="bg-card rounded-3xl p-6 shadow-card border border-border/30 flex items-center gap-5 w-fit">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center">
                <Package className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground tracking-tight">{products?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Produits actifs</p>
              </div>
            </div>

            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Rechercher par code, nom ou description..."
              containerClassName="w-full sm:w-80"
            />
          </div>

          <div className="bg-card rounded-3xl border border-border/30 shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Unité</TableHead>
                  <TableHead className="text-right">Prix unitaire</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoading columns={6} rows={5} />
                ) : filteredProducts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Aucun produit trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts?.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono font-medium">{product.code}</TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">{product.description || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{product.unit}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">{formatCurrency(product.unit_price)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => startEdit(product)}
                            className="w-9 h-9 rounded-[6px] flex items-center justify-center hover:bg-secondary transition-all"
                            title="Modifier"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setProductToDelete(product.id);
                              setDeleteDialogOpen(true);
                            }}
                            className="w-9 h-9 rounded-[6px] flex items-center justify-center hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-all"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
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
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
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
