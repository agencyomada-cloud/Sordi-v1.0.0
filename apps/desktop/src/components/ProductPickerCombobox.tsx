import { useEffect, useState, type ReactNode } from "react";
import { RiAddLine as Plus } from "@remixicon/react";
import { Popover, PopoverContent, PopoverTrigger, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@sordi/ui";

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
}: ProductPickerComboboxProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const excluded = new Set(excludeProductIds.filter(Boolean).map(String));
  const availableProducts = products.filter((p) => !excluded.has(String(p.id)));

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

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align={align}>
        <Command shouldFilter>
          <CommandInput
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Rechercher par nom ou référence…"
          />
          <CommandList className="max-h-72">
            <CommandEmpty className="p-1">
              {query.trim() ? (
                <button
                  type="button"
                  onClick={handleAddCustom}
                  className="w-full flex items-center gap-2 rounded-sm px-2 py-2 text-left text-sm text-primary hover:bg-accent"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  Ajouter «{query.trim()}» comme article personnalisé
                </button>
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
