import { useEffect, useState, type ReactNode } from "react";
import { RiAddLine as Plus, RiLoader4Line as Loader2 } from "@remixicon/react";
import { Popover, PopoverContent, PopoverTrigger, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@sordi/ui";
import { useCreateProduct } from "@/hooks/useProducts";

interface ProductPickerComboboxProps {
  products?: any[];
  /** product_id values already on the document — excluded from the search
   *  results so the same catalog item can't be listed (and added) twice. */
  excludeProductIds?: (string | undefined)[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProduct: (product: any) => void;
  onAddCustomItem: (name: string) => void;
  trigger: ReactNode;
  /** Index the newly added line will land at (callers pass items.length) —
   *  used to auto-focus its quantity field once the row exists in the DOM. */
  nextIndex: number;
  formatCurrency?: (n: number) => string;
  align?: "start" | "center" | "end";
  /** Same scaled-canvas fix used by ClientPickerCombobox — see
   *  PopoverContent's own doc comment in packages/ui for why. */
  container?: HTMLElement | null;
}

function focusLineQuantity(index: number) {
  // Double rAF: one frame for React to commit the new row, one for the
  // browser to paint it, before the DOM node we're targeting exists.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>(
        `[data-line-index="${index}"][data-line-field="quantity"]`
      );
      el?.focus();
      el?.select();
    });
  });
}

/**
 * Searchable product line-item picker — replaces the old "dump the entire
 * catalog into a scrollable list" popover. Search matches name or reference
 * code (cmdk's built-in fuzzy filter via CommandItem's keywords); when
 * nothing matches, offers to add the typed text as a one-off custom line
 * that doesn't need to exist in the product catalog.
 */
export function ProductPickerCombobox({
  products = [],
  excludeProductIds = [],
  open,
  onOpenChange,
  onSelectProduct,
  onAddCustomItem,
  trigger,
  nextIndex,
  formatCurrency,
  align = "start",
  container,
}: ProductPickerComboboxProps) {
  const [query, setQuery] = useState("");
  const createProduct = useCreateProduct();

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const excluded = new Set(excludeProductIds.filter(Boolean).map(String));
  const availableProducts = products.filter((p) => !excluded.has(String(p.id)));
  const hasMatches = availableProducts.some((p) =>
    p.name?.toLowerCase().includes(query.trim().toLowerCase()) || p.code?.toLowerCase().includes(query.trim().toLowerCase())
  );

  const handleSelect = (product: any) => {
    onSelectProduct(product);
    onOpenChange(false);
    focusLineQuantity(nextIndex);
  };

  const handleAddCustom = () => {
    const name = query.trim();
    if (!name) return;
    onAddCustomItem(name);
    onOpenChange(false);
    focusLineQuantity(nextIndex);
  };

  // "+ Enregistrer au catalogue" — saves the typed name as a real product
  // (auto-generated reference code, since the catalog requires one) so it's
  // searchable/reusable on future invoices, then still uses it as this
  // line's item exactly like handleAddCustom.
  const handleSaveToCatalogue = async () => {
    const name = query.trim();
    if (!name || createProduct.isPending) return;
    try {
      const code = `CUSTOM-${Date.now().toString(36).toUpperCase()}`;
      await createProduct.mutateAsync({ code, name, unit_price: 0 });
      onAddCustomItem(name);
      onOpenChange(false);
      focusLineQuantity(nextIndex);
    } catch {
      // useCreateProduct's mutation already toasts the error.
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align={align} container={container}>
        <Command shouldFilter>
          <CommandInput
            autoFocus
            value={query}
            onValueChange={setQuery}
            onKeyDown={(e) => {
              // Enter with no catalog match uses the typed text directly as
              // a one-off custom line — cmdk only auto-selects a
              // highlighted CommandItem on Enter, and CommandEmpty's button
              // isn't one, so this has to be wired explicitly.
              if (e.key === "Enter" && !hasMatches && query.trim()) {
                e.preventDefault();
                handleAddCustom();
              }
            }}
            placeholder="Rechercher par nom ou référence…"
          />
          <CommandList className="max-h-72">
            <CommandEmpty className="p-1">
              {query.trim() ? (
                <div className="space-y-0.5">
                  {/* hover:bg-muted/80, not hover:bg-accent — this app's
                      --accent token is the same saturated blue as --primary,
                      so a text-primary label on a bg-accent hover used to
                      turn blue-on-blue and vanish. A subtle neutral hover
                      (Odoo/Apple HIG desktop convention) keeps the accent
                      color legible against it instead of fighting it. */}
                  <button
                    type="button"
                    onClick={handleAddCustom}
                    className="w-full flex items-center gap-2 rounded-sm px-2 py-2 text-left text-sm text-primary font-medium hover:bg-muted/80"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    Ajouter «{query.trim()}» comme article personnalisé
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveToCatalogue}
                    disabled={createProduct.isPending}
                    className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  >
                    {createProduct.isPending ? <Loader2 className="w-3 h-3 shrink-0 animate-spin" /> : <Plus className="w-3 h-3 shrink-0" />}
                    Enregistrer au catalogue pour réutilisation future
                  </button>
                </div>
              ) : (
                <span className="block px-2 py-1 text-muted-foreground">Aucun produit</span>
              )}
            </CommandEmpty>
            {availableProducts.length > 0 && (
              <CommandGroup heading="Produits">
                {availableProducts.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.name}
                    keywords={p.code ? [p.code] : undefined}
                    onSelect={() => handleSelect(p)}
                    className="group flex items-center justify-between gap-3"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium">{p.name}</span>
                      {p.code && (
                        <span className="text-xs text-muted-foreground truncate group-data-[selected=true]:text-accent-foreground/80">
                          Réf: {p.code}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground/80">
                      {formatCurrency ? formatCurrency(p.unit_price || 0) : `${p.unit_price ?? 0}`}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
