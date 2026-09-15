import { useEffect, useState } from "react";
import {
  Button, Label, Slider, Switch,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@sordi/ui";
import { RiCloseLine as CloseIcon, RiCheckLine as CheckIcon } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { INVOICE_PDF_THEMES, INVOICE_PDF_FONTS, getAutoContrastTextColor } from "@/components/pdf/invoicePdfShared";

const ACCENT_PRESETS = [
  { label: "Bleu Nuit", value: "#1E40AF" },
  { label: "Émeraude", value: "#065F46" },
  { label: "Anthracite", value: "#27272A" },
  { label: "Bordeaux", value: "#831843" },
  { label: "Violet", value: "#5B21B6" },
];

// A settings value read out of the schemaless string-only `settings` store
// (see useSettings.ts's own note) — booleans are encoded as the literal
// strings "true"/"false", so every switch in this panel reads through this
// instead of a `=== "true"` check repeated at every call site (which would
// silently read a genuinely-absent key as OFF instead of applying the
// stated default).
function readBoolSetting(value: string | undefined, defaultValue: boolean): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

// Miniature wireframes standing in for a real thumbnail per template — just
// enough visual difference (header shape, band color, line density) to read
// at a glance which layout is which.
function TemplateGlyph({ theme, accent }: { theme: string; accent: string }) {
  if (theme === "moderne") {
    return (
      <svg width="40" height="30" viewBox="0 0 40 30" fill="none">
        <rect x="0.5" y="0.5" width="39" height="29" rx="2.5" fill="white" stroke="currentColor" strokeOpacity="0.15" />
        <rect x="0.5" y="0.5" width="39" height="8" rx="2.5" fill={accent} fillOpacity="0.85" />
        <rect x="4" y="13" width="32" height="2" rx="1" fill="currentColor" fillOpacity="0.25" />
        <rect x="4" y="18" width="24" height="2" rx="1" fill="currentColor" fillOpacity="0.15" />
        <rect x="4" y="23" width="18" height="2" rx="1" fill="currentColor" fillOpacity="0.15" />
      </svg>
    );
  }
  if (theme === "epure") {
    return (
      <svg width="40" height="30" viewBox="0 0 40 30" fill="none">
        <rect x="0.5" y="0.5" width="39" height="29" rx="2.5" fill="white" stroke="currentColor" strokeOpacity="0.15" />
        <rect x="4" y="5" width="14" height="2" rx="1" fill="currentColor" fillOpacity="0.3" />
        <rect x="4" y="13" width="32" height="1" fill="currentColor" fillOpacity="0.15" />
        <rect x="4" y="17" width="20" height="1.5" rx="0.75" fill="currentColor" fillOpacity="0.2" />
        <rect x="4" y="21" width="20" height="1.5" rx="0.75" fill="currentColor" fillOpacity="0.2" />
        <rect x="4" y="25" width="12" height="1.5" rx="0.75" fill={accent} fillOpacity="0.7" />
      </svg>
    );
  }
  return (
    <svg width="40" height="30" viewBox="0 0 40 30" fill="none">
      <rect x="0.5" y="0.5" width="39" height="29" rx="2.5" fill="white" stroke="currentColor" strokeOpacity="0.15" />
      <rect x="4" y="4" width="10" height="6" rx="1" fill="currentColor" fillOpacity="0.15" />
      <rect x="26" y="4" width="10" height="2" rx="1" fill={accent} fillOpacity="0.7" />
      <rect x="4" y="14" width="32" height="1" fill="currentColor" fillOpacity="0.25" />
      <rect x="4" y="18" width="32" height="1.5" rx="0.75" fill="currentColor" fillOpacity="0.15" />
      <rect x="4" y="22" width="32" height="1.5" rx="0.75" fill="currentColor" fillOpacity="0.15" />
      <rect x="22" y="26" width="14" height="2" rx="1" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}

interface InvoiceCustomizeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The "Personnaliser" panel — a real-time branding AND document-behavior
 * customizer for the invoice editor, all read from and written straight to
 * the same global `settings` used by Paramètres > Apparence & Logo. No
 * separate draft-local state: writing through `useUpdateSettings`
 * invalidates the `settings` query, which `EditableInvoicePreview` already
 * subscribes to via `useSettings`, so the live canvas re-renders
 * immediately without any extra plumbing between this drawer and the
 * invoice document.
 *
 * Every setting here — Modèle, Couleur d'accent, Typographie,
 * Cachet & Signature, Masquer les colonnes vides, Afficher le montant en
 * lettres, Dimensions — is global per company, not per document type, so it
 * applies identically no matter which of Facture/Devis/Proforma/Avoir is
 * currently open: see resolveHtmlInvoiceData (invoiceHtmlShared.ts) for the
 * web preview and resolveInvoiceData (invoicePdfShared.ts) for the exported
 * PDF, both of which every document-type renderer already goes through.
 *
 * Previously this panel also had "Type de tableau" and "Taille du texte"
 * controls. Both are removed: table-row styling only ever had 3 hardcoded
 * variants with no real typographic scaling behind them, and "text size"
 * was a CSS `zoom` standing in for real font-size control across dozens of
 * hardcoded per-element sizes — closer to a zoom function than actual
 * typography. Removed instead of left half-working.
 *
 * Visual language: strict 4px corners (`rounded-[4px]`) on every card/
 * button/input in THIS panel specifically — a deliberate, scoped choice
 * distinct from the app's own global 6px `--radius` token (src/index.css),
 * not a request to re-theme the whole app. Color swatches stay circular
 * (a color dot, not a framing element).
 *
 * Deliberately NOT built on the shared Sheet/Dialog primitive: a design
 * inspector's whole point is to compare a change against the live canvas
 * as you make it, and Sheet's Radix-modal semantics (full-screen `bg-black/80`
 * overlay, focus trap) exist specifically to block interaction with — and
 * visibility of — whatever is behind it.
 *
 * Also deliberately NOT `fixed` with a hardcoded top offset — that requires
 * knowing the exact pixel height of everything stacked above it (the app's
 * own global Header component, *plus* this page's own toolbar), and a wrong
 * guess buries this panel's header behind them. Mounted instead as a normal
 * flex sibling of the canvas (see NewInvoice.tsx), it starts exactly where
 * the canvas starts, however many bars stack above — no pixel math, and
 * nothing to get wrong on the next added toolbar.
 *
 * Header/content split: the outer `<aside>` is a plain flex column with NO
 * overflow of its own — the header is a direct, `shrink-0` child (never
 * scrolls), and the settings list below it is the ONLY scroll container
 * (`flex-1 overflow-y-auto`). Making the header `sticky` inside a scrolling
 * ancestor (the previous structure) is exactly the kind of thing that looks
 * right until a nested scroll/stacking-context quirk breaks it — a
 * dedicated non-scrolling header is the version that can't regress.
 */
export function InvoiceCustomizeDrawer({ open, onOpenChange }: InvoiceCustomizeDrawerProps) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [logoSize, setLogoSize] = useState(() => Number(settings?.logo_size) || 60);
  const [stampSize, setStampSize] = useState(() => Number(settings?.stamp_size) || 96);

  const currentTheme = settings?.invoice_pdf_theme || "structure";
  const currentFont = settings?.invoice_pdf_font || "montserrat";
  const currentColor = settings?.primary_color || "#FF2949";
  const showStampSignature = readBoolSetting(settings?.show_stamp_signature, true);
  const hideEmptyColumns = readBoolSetting(settings?.hide_empty_columns, true);
  const showAmountInWords = readBoolSetting(settings?.show_amount_in_words, false);

  // Auto-Contrast — recomputed live off whatever accent color is currently
  // selected, so the swatch below always demonstrates the exact color the
  // preview/PDF header and totals band compute for real.
  const autoContrastText = getAutoContrastTextColor(currentColor);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <aside className="w-72 shrink-0 border-l border-border/80 bg-card h-full flex flex-col z-20 transition-all">
      <div className="h-10 border-b border-border/80 px-4 flex items-center justify-between shrink-0 sticky top-0 z-20 bg-background">
        <span className="text-xs font-semibold text-foreground">Personnaliser</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-[4px]"
          onClick={() => onOpenChange(false)}
          aria-label="Fermer"
        >
          <CloseIcon className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-5">
        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Modèle</Label>
          <div className="grid grid-cols-3 gap-2">
            {INVOICE_PDF_THEMES.map((theme) => {
              const active = currentTheme === theme.value;
              return (
                <button
                  key={theme.value}
                  type="button"
                  onClick={() => updateSettings.mutate({ invoice_pdf_theme: theme.value })}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-[4px] py-2.5 px-2 text-xs transition-colors",
                    active
                      ? "ring-2 ring-primary bg-primary/5 border border-primary text-primary font-semibold"
                      : "border border-border hover:border-primary/40 text-muted-foreground"
                  )}
                >
                  <TemplateGlyph theme={theme.value} accent={currentColor} />
                  {theme.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-border/60">
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Couleur d'accent</Label>
          <div className="flex flex-wrap items-center gap-2.5">
            {ACCENT_PRESETS.map((preset) => {
              const active = currentColor.toLowerCase() === preset.value.toLowerCase();
              return (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.label}
                  onClick={() => updateSettings.mutate({ primary_color: preset.value })}
                  className={cn(
                    "w-7 h-7 rounded-full transition-transform hover:scale-110 relative shrink-0",
                    active && "ring-2 ring-offset-2 ring-foreground ring-offset-card"
                  )}
                  style={{ backgroundColor: preset.value }}
                >
                  {active && <CheckIcon className="w-3.5 h-3.5 text-white absolute inset-0 m-auto" />}
                </button>
              );
            })}
            <label
              className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer overflow-hidden relative shrink-0 transition-transform hover:scale-110"
              title="Couleur personnalisée"
            >
              <input
                type="color"
                value={currentColor}
                onChange={(e) => updateSettings.mutate({ primary_color: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <span
                className="h-full w-full rounded-full"
                style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
              />
            </label>
          </div>

          {/* Auto-Contrast — live demonstration, not a separate setting: the
              text color shown here is always derived from currentColor via
              getAutoContrastTextColor, the same formula the preview/PDF
              totals band and table header use against this exact accent. */}
          <div className="flex items-center gap-2 pt-1">
            <div
              className="h-7 w-14 rounded-[4px] flex items-center justify-center text-xs font-semibold shrink-0"
              style={{ backgroundColor: currentColor, color: autoContrastText }}
            >
              Aa
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Contraste automatique — texte {autoContrastText === "#FFFFFF" ? "blanc" : "anthracite"} calculé pour rester lisible sur cet accent.
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-border/60">
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Typographie</Label>
          <Select
            value={currentFont}
            onValueChange={(value) => updateSettings.mutate({ invoice_pdf_font: value })}
          >
            <SelectTrigger className="h-8 text-xs rounded-[4px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVOICE_PDF_FONTS.map((font) => (
                <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.label }}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 pt-4 border-t border-border/60">
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cachet & Signature</Label>
          <div className="flex items-start justify-between gap-3 rounded-[4px] border border-border px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="toggle-stamp-signature" className="text-xs font-medium text-foreground cursor-pointer">
                Afficher le cachet et la signature
              </Label>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Désactivez pour imprimer un document vierge à tamponner/signer à la main — vos images restent enregistrées.
              </p>
            </div>
            <Switch
              id="toggle-stamp-signature"
              checked={showStampSignature}
              onCheckedChange={(checked) => updateSettings.mutate({ show_stamp_signature: String(checked) })}
              className="shrink-0 mt-0.5"
            />
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-border/60">
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Visibilité</Label>

          <div className="flex items-start justify-between gap-3 rounded-[4px] border border-border px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="toggle-hide-empty-columns" className="text-xs font-medium text-foreground cursor-pointer">
                Masquer les colonnes vides
              </Label>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Ex. Remise, si elle vaut 0 sur toutes les lignes.
              </p>
            </div>
            <Switch
              id="toggle-hide-empty-columns"
              checked={hideEmptyColumns}
              onCheckedChange={(checked) => updateSettings.mutate({ hide_empty_columns: String(checked) })}
              className="shrink-0 mt-0.5"
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-[4px] border border-border px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="toggle-amount-in-words" className="text-xs font-medium text-foreground cursor-pointer">
                Afficher le montant en lettres
              </Label>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Recommandé pour la validité légale du document.
              </p>
            </div>
            <Switch
              id="toggle-amount-in-words"
              checked={showAmountInWords}
              onCheckedChange={(checked) => updateSettings.mutate({ show_amount_in_words: String(checked) })}
              className="shrink-0 mt-0.5"
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border/60">
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Dimensions</Label>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Hauteur du logo</Label>
              <span className="text-[11px] font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-[4px]">
                {logoSize}px
              </span>
            </div>
            <Slider
              value={[logoSize]}
              min={30}
              max={65}
              step={1}
              onValueChange={([v]) => {
                setLogoSize(v);
                updateSettings.mutate({ logo_size: String(v) });
              }}
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Taille du cachet</Label>
              <span className="text-[11px] font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-[4px]">
                {stampSize}px
              </span>
            </div>
            <Slider
              value={[stampSize]}
              min={60}
              max={130}
              step={1}
              onValueChange={([v]) => {
                setStampSize(v);
                updateSettings.mutate({ stamp_size: String(v) });
              }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
