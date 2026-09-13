import { motion } from "framer-motion";
import { Sparkles, Check, X, AlertTriangle, Info, Plus, Trash2 } from "lucide-react";
import { Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@sordi/ui";
import { EntityCombobox } from "./EntityCombobox";
import type { CopilotContext, CopilotInvoiceLine, CopilotPaymentMethod, CopilotResult } from "./types";

interface AiCopilotResultProps {
  phase: "processing" | "result" | "error";
  draft: CopilotResult | null;
  error: string | null;
  context: CopilotContext;
  onChange: (next: CopilotResult) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

const ACTION_LABEL: Record<"CREATE_EXPENSE" | "CREATE_INVOICE" | "CREATE_CLIENT" | "CREATE_PRODUCT", string> = {
  CREATE_EXPENSE: "Nouvelle Dépense",
  CREATE_INVOICE: "Nouvelle Facture",
  CREATE_CLIENT: "Nouveau Client",
  CREATE_PRODUCT: "Nouveau Produit",
};

const PAYMENT_METHOD_OPTIONS: { value: CopilotPaymentMethod; label: string }[] = [
  { value: "cash", label: "Espèces" },
  { value: "transfer", label: "Virement" },
  { value: "cheque", label: "Chèque" },
  { value: "card", label: "Carte" },
];

function lineTotal(line: CopilotInvoiceLine): number {
  return line.quantity * line.unitPrice;
}

/** Right-aligned "DA" adornment for a numeric input — a plain absolutely-
 *  positioned label rather than a real input addon component (none exists
 *  in @sordi/ui), kept purely visual/non-interactive. */
function DaInput({ value, onChange, placeholder }: { value: number | ""; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Input
        type="number"
        placeholder={placeholder}
        className="h-8 text-xs font-mono pr-7"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-muted-foreground">
        DA
      </span>
    </div>
  );
}

/** The accordion's expanded content — a processing shimmer, an error
 *  state, an out-of-scope dismissal, or a fully in-place EDITABLE review
 *  card. Every field here is live-bound to `draft` via `onChange`; nothing
 *  is persisted until the caller's onConfirm actually calls the create
 *  mutations — this component never touches the database itself. */
export function AiCopilotResult({ phase, draft, error, context, onChange, onConfirm, onCancel, isSaving }: AiCopilotResultProps) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="overflow-hidden"
    >
      {/* No BorderBeam here — the animated stroke belongs to the input
          bar alone. Rendering it here too doubled the effect on screen at
          once, right below the bar that already carries it. */}
      <div className="mt-2 rounded-lg border border-border/80 bg-white dark:bg-neutral-900 overflow-hidden">
        {phase === "processing" ? (
          <div className="p-4 space-y-3">
            {/* No second orb, no sliding progress bar — the bar's own
                orb icon above is the only "analyzing" animation; this is
                deliberately just static text. */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">Analyse en cours...</div>
          </div>
        ) : phase === "error" ? (
          <div className="p-4 flex items-start gap-2.5 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : draft?.action === "OUT_OF_SCOPE" ? (
          <div className="p-4 flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div className="flex-1 space-y-3">
              <p className="text-sm text-foreground">{draft.message}</p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onCancel}>
                <X className="w-3.5 h-3.5" />
                Fermer
              </Button>
            </div>
          </div>
        ) : draft && draft.action !== "SET_APP_SETTINGS" ? (
          // SET_APP_SETTINGS never actually reaches this component — it's
          // executed immediately by AiCopilotBar with no review card at
          // all (see its own doc comment) — this guard exists only so
          // TypeScript can narrow `draft.action` cleanly below.
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1">
                <Sparkles className="w-3 h-3" />
                {ACTION_LABEL[draft.action]}
              </span>
              <span className="text-[10px] text-muted-foreground">Rien n'est enregistré tant que vous ne confirmez pas</span>
            </div>

            {draft.action === "CREATE_CLIENT" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0 col-span-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Nom</p>
                  <Input className="h-8 text-xs" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Téléphone</p>
                  <Input
                    className="h-8 text-xs"
                    value={draft.phone ?? ""}
                    onChange={(e) => onChange({ ...draft, phone: e.target.value || null })}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Email</p>
                  <Input
                    className="h-8 text-xs"
                    value={draft.email ?? ""}
                    onChange={(e) => onChange({ ...draft, email: e.target.value || null })}
                  />
                </div>
              </div>
            ) : draft.action === "CREATE_PRODUCT" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0 col-span-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Nom</p>
                  <Input className="h-8 text-xs" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Prix de vente</p>
                  <DaInput value={draft.sellPrice} onChange={(v) => onChange({ ...draft, sellPrice: Number(v) || 0 })} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Prix d'achat</p>
                  <DaInput
                    value={draft.buyPrice ?? ""}
                    placeholder="Aucun"
                    onChange={(v) => onChange({ ...draft, buyPrice: v === "" ? null : Number(v) || 0 })}
                  />
                </div>
              </div>
            ) : draft.action === "CREATE_EXPENSE" ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Montant</p>
                  <DaInput value={draft.amount} onChange={(v) => onChange({ ...draft, amount: Number(v) || 0 })} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Catégorie</p>
                  <Select value={draft.category} onValueChange={(v) => onChange({ ...draft, category: v })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(context.categories.includes(draft.category) ? context.categories : [draft.category, ...context.categories]).map(
                        (cat) => (
                          <SelectItem key={cat} value={cat} className="text-xs">
                            {cat}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Fournisseur</p>
                  <EntityCombobox
                    entities={context.suppliers}
                    selectedId={draft.supplierId}
                    freeTextName={draft.supplierName ?? ""}
                    placeholder="Aucun"
                    searchPlaceholder="Rechercher un fournisseur..."
                    emptyLabel="Aucun fournisseur trouvé."
                    onSelect={(entity) =>
                      onChange({ ...draft, supplierId: entity?.id ?? null, supplierName: entity?.name ?? draft.supplierName })
                    }
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Paiement</p>
                  <div className="grid grid-cols-2 gap-1">
                    {PAYMENT_METHOD_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange({ ...draft, paymentMethod: opt.value })}
                        className={`h-8 rounded-md text-[11px] font-medium transition-colors border ${
                          draft.paymentMethod === opt.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-transparent text-muted-foreground border-border hover:bg-muted/60"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Client</p>
                      {draft.newClient && (
                        <span className="text-[9px] font-semibold text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                          Nouveau client
                        </span>
                      )}
                    </div>
                    <EntityCombobox
                      entities={context.clients}
                      selectedId={draft.clientId}
                      freeTextName={draft.clientName}
                      placeholder="Sélectionner..."
                      searchPlaceholder="Rechercher un client..."
                      emptyLabel="Aucun client trouvé."
                      onSelect={(entity) =>
                        onChange({
                          ...draft,
                          clientId: entity?.id ?? null,
                          clientName: entity?.name ?? draft.clientName,
                          isNewClient: !entity,
                          newClient: entity ? null : draft.newClient,
                        })
                      }
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Acompte</p>
                    <DaInput
                      value={draft.advancePayment ?? ""}
                      placeholder="Aucun"
                      onChange={(v) => onChange({ ...draft, advancePayment: v === "" ? null : Number(v) || 0 })}
                    />
                  </div>
                </div>

                <div className="rounded-md border border-border/60 overflow-hidden">
                  <div className="grid grid-cols-[1fr_56px_88px_88px_28px] gap-1.5 px-2 py-1 bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span>Désignation</span>
                    <span>Qté</span>
                    <span>P.U. (DA)</span>
                    <span>Total</span>
                    <span />
                  </div>
                  {draft.items.map((line, i) => (
                    <div key={i} className="grid grid-cols-[1fr_56px_88px_88px_28px] gap-1.5 px-2 py-1.5 items-center border-t border-border/40">
                      <Input
                        className="h-7 text-xs"
                        value={line.description}
                        onChange={(e) => {
                          const items = [...draft.items];
                          items[i] = { ...line, description: e.target.value };
                          onChange({ ...draft, items });
                        }}
                      />
                      <Input
                        type="number"
                        className="h-7 text-xs font-mono"
                        value={line.quantity}
                        onChange={(e) => {
                          const items = [...draft.items];
                          const quantity = Number(e.target.value) || 0;
                          items[i] = { ...line, quantity, total: quantity * line.unitPrice };
                          onChange({ ...draft, items, totalAmount: items.reduce((sum, l) => sum + lineTotal(l), 0) });
                        }}
                      />
                      <Input
                        type="number"
                        className="h-7 text-xs font-mono"
                        value={line.unitPrice}
                        onChange={(e) => {
                          const items = [...draft.items];
                          const unitPrice = Number(e.target.value) || 0;
                          items[i] = { ...line, unitPrice, total: line.quantity * unitPrice };
                          onChange({ ...draft, items, totalAmount: items.reduce((sum, l) => sum + lineTotal(l), 0) });
                        }}
                      />
                      <span className="text-xs font-mono tabular-nums text-muted-foreground truncate">
                        {new Intl.NumberFormat("fr-DZ").format(lineTotal(line))}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const items = draft.items.filter((_, idx) => idx !== i);
                          onChange({ ...draft, items, totalAmount: items.reduce((sum, l) => sum + lineTotal(l), 0) });
                        }}
                        disabled={draft.items.length <= 1}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ ...draft, items: [...draft.items, { itemId: null, description: "", quantity: 1, unitPrice: 0, total: 0 }] })
                    }
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-primary border-t border-border/40 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Ajouter une ligne
                  </button>
                </div>

                <div className="flex justify-end text-sm">
                  <span className="text-muted-foreground mr-2">Total :</span>
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    {new Intl.NumberFormat("fr-DZ").format(draft.totalAmount)} DA
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" className="gap-1.5" onClick={onConfirm} disabled={isSaving}>
                <Check className="w-3.5 h-3.5" />
                {isSaving ? "Enregistrement..." : "Confirmer & Enregistrer"}
                {!isSaving && <span className="ml-1 text-[10px] font-mono opacity-80 bg-black/10 rounded px-1">↵</span>}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onCancel} disabled={isSaving}>
                <X className="w-3.5 h-3.5" />
                Annuler
                <span className="ml-1 text-[10px] font-mono opacity-60">Esc</span>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
