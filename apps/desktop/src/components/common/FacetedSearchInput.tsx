import { useMemo, useRef, useState } from "react";
import { RiCloseLine as CloseIcon } from "@remixicon/react";
import { cn } from "@/lib/utils";

export interface SearchFacet {
  id: string;
  /** Machine key a consumer's filter predicate switches on (e.g. "number", "client", "amount"). */
  field: string;
  /** Short label shown in the pill, e.g. "Client", "N°", "Montant". */
  fieldLabel: string;
  /** Raw value used for filtering. */
  value: string;
  /** Optional override for what the pill displays after the label (defaults to `value`). */
  displayValue?: string;
}

export interface FacetSuggestion {
  field: string;
  fieldLabel: string;
  /** The suggestion row's own text, e.g. `Rechercher "acme" par Client`. */
  description: string;
  value: string;
  displayValue?: string;
}

/** Odoo-style default suggestion set: search by reference/number, by client,
 *  or — only when the typed text actually parses as a number — a "≥ amount"
 *  facet. A non-numeric query never offers a nonsensical amount filter. */
function defaultBuildSuggestions(query: string, labels: { number: string; client: string; amount: string }): FacetSuggestion[] {
  const suggestions: FacetSuggestion[] = [
    { field: "number", fieldLabel: labels.number, description: `Rechercher "${query}" par ${labels.number}`, value: query },
    { field: "client", fieldLabel: labels.client, description: `Rechercher "${query}" par ${labels.client}`, value: query },
  ];
  const numeric = Number(query.replace(/[^0-9.,]/g, "").replace(",", "."));
  if (query.trim() !== "" && Number.isFinite(numeric) && numeric > 0) {
    suggestions.push({
      field: "amount",
      fieldLabel: labels.amount,
      description: `Filtrer par ${labels.amount} (≥ ${query} DA)`,
      value: String(numeric),
      displayValue: `≥ ${query} DA`,
    });
  }
  return suggestions;
}

interface FacetedSearchInputProps {
  query: string;
  onQueryChange: (query: string) => void;
  facets: SearchFacet[];
  onFacetsChange: (facets: SearchFacet[]) => void;
  /** Override the default number/client/amount suggestion set. */
  buildSuggestions?: (query: string) => FacetSuggestion[];
  placeholder?: string;
  className?: string;
  /** Labels used by the default suggestion builder — ignored when `buildSuggestions` is passed. */
  fieldLabels?: { number?: string; client?: string; amount?: string };
}

/**
 * Compact Odoo-style faceted search bar: applied filters render as inline
 * removable pills, and typing a plain query surfaces an instant "search by…"
 * suggestion menu instead of only ever doing one flat substring match.
 * Purely a controlled input over `facets`/`query` — interpreting what a
 * facet's `field` means (contains vs. ">=", which columns it touches) is the
 * consuming page's job, same as it already owned the old plain-text search.
 */
export function FacetedSearchInput({
  query,
  onQueryChange,
  facets,
  onFacetsChange,
  buildSuggestions,
  placeholder = "Rechercher...",
  className,
  fieldLabels,
}: FacetedSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const labels = {
    number: fieldLabels?.number ?? "Numéro / Réf",
    client: fieldLabels?.client ?? "Client",
    amount: fieldLabels?.amount ?? "Montant",
  };

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return buildSuggestions ? buildSuggestions(query) : defaultBuildSuggestions(query, labels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, buildSuggestions]);

  const applySuggestion = (suggestion: FacetSuggestion) => {
    onFacetsChange([
      ...facets,
      {
        id: `${suggestion.field}-${Date.now()}`,
        field: suggestion.field,
        fieldLabel: suggestion.fieldLabel,
        value: suggestion.value,
        displayValue: suggestion.displayValue,
      },
    ]);
    onQueryChange("");
    setOpen(false);
    setHighlightIndex(0);
    inputRef.current?.focus();
  };

  const removeFacet = (id: string) => {
    onFacetsChange(facets.filter((f) => f.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && query === "" && facets.length > 0) {
      removeFacet(facets[facets.length - 1].id);
      return;
    }
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && suggestions.length > 0) {
      e.preventDefault();
      applySuggestion(suggestions[Math.min(highlightIndex, suggestions.length - 1)]);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div
      className={cn(
        "relative bg-background border border-border/80 rounded-md px-2 text-xs flex items-center gap-1.5 flex-wrap min-h-[30px] py-1",
        className
      )}
    >
      {facets.map((facet) => (
        <span
          key={facet.id}
          className="h-5 px-1.5 bg-muted/70 text-foreground rounded text-[11px] font-medium inline-flex items-center gap-1 border border-border/40 shrink-0"
        >
          {facet.fieldLabel}: {facet.displayValue ?? facet.value}
          <button
            type="button"
            onClick={() => removeFacet(facet.id)}
            className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={`Retirer le filtre ${facet.fieldLabel}`}
          >
            <CloseIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setOpen(e.target.value.trim() !== "");
          setHighlightIndex(0);
        }}
        onFocus={() => query.trim() && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={handleKeyDown}
        placeholder={facets.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[60px] bg-transparent outline-none placeholder:text-muted-foreground text-xs h-5"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[260px] z-50 bg-popover border border-border rounded-md shadow-md py-1">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.field}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applySuggestion(suggestion)}
              className={cn(
                "w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted/60 transition-colors",
                index === highlightIndex && "bg-muted/60"
              )}
            >
              {suggestion.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
