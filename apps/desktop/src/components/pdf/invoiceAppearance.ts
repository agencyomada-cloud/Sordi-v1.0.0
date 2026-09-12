import { resolveInvoicePdfFontFamily, type PDFSettings } from "./invoicePdfShared";

/**
 * Single source of truth for "how this document should look" — consumed by
 * the @react-pdf export pipeline (pdfGenerator.ts + the 3 PDF templates).
 * Previously each PDF template independently read raw fields off `settings`/
 * `invoice` with its own fallback chain, which is how `logo_size` and
 * `invoice_pdf_font` silently never reached the PDF at all (see
 * pdfGenerator.ts's `pdfSettings` object, fixed in the prior pass) — one
 * resolver computed once, here, removes that class of bug going forward:
 * there's exactly one place that decides the final value of each
 * customization, and every consumer reads from its output instead of
 * re-deriving its own fallback chain.
 */
export interface InvoiceAppearanceConfig {
  theme: 'structure' | 'epure' | 'moderne';
  primaryColor: string;
  /** The resolved font FAMILY NAME (e.g. "Montserrat"), already run through
   *  resolveInvoicePdfFontFamily — not the raw settings slug. */
  fontFamily: string;
  logoHeight: number;
  stampSize: number;
  status: string;
  showMontantEnLettres: boolean;
  showStamp: boolean;
  headerStyle?: 'solid' | 'minimal';
}

/**
 * The invoice PDF theme select stores plain slugs ('structure' | 'epure' |
 * 'moderne') already — never the accented display label ('Structuré' /
 * 'Épuré') a user sees in the drawer — so this defensive normalizer isn't
 * covering a bug we've actually observed in this codebase. Kept anyway as a
 * cheap safety net: it costs nothing and means a future caller that DOES
 * pass a display label (or a differently-cased/whitespace-padded value)
 * degrades to the correct theme instead of silently falling through to the
 * "Structuré" default for the wrong reason.
 */
export function normalizeThemeSlug(theme?: string | null): 'structure' | 'epure' | 'moderne' {
  if (!theme) return 'structure';
  const clean = theme.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (clean.includes('epure')) return 'epure';
  if (clean.includes('moderne')) return 'moderne';
  return 'structure';
}

/**
 * Builds the resolved appearance config from live `settings` (already the
 * up-to-the-second truth — the "Personnaliser" drawer writes straight to
 * this table via useUpdateSettings on every change, no separate in-memory
 * draft state to go stale relative to it) and the invoice record itself
 * (for its own status/stamp_size overrides). Called once in
 * pdfGenerator.ts and, for the DevTools diagnostic, once more at each
 * "Télécharger PDF" click site — both calls are pure and deterministic
 * given the same inputs, so there's no risk of the logged value
 * disagreeing with what the PDF actually renders.
 */
export function resolveInvoiceAppearance(invoice: any, settings?: PDFSettings | (Record<string, any> & { invoice_pdf_theme?: string })): InvoiceAppearanceConfig {
  // #476CFF is the one true app-wide default — every PDF template, every
  // read-only HTML canvas, and the interactive editor all fall back to this
  // exact value when settings.primary_color is unset. (A previous version
  // of this resolver used #2563EB here, a silent drift from that shared
  // default that would have shown a different "no custom color" blue in
  // the PDF/appearance-driven surfaces than everywhere else.)
  const primaryColor = (settings as any)?.primary_color || '#476CFF';
  return {
    theme: normalizeThemeSlug((settings as any)?.invoice_pdf_theme),
    primaryColor,
    fontFamily: resolveInvoicePdfFontFamily(settings as PDFSettings),
    // 65 matches the pre-resolver default hardcoded in each PDF template's
    // logoImage style (maxHeight: Number(settings?.logo_size) || 65).
    logoHeight: Number((settings as any)?.logo_size) || 65,
    // 180 matches the long-standing default used across the interactive
    // editor and all 3 PDF templates before this resolver existed — keep in
    // sync with InvoiceCustomizeDrawer.tsx / EditableInvoicePreview.tsx.
    stampSize: Number(invoice?.stamp_size || (settings as any)?.stamp_size) || 180,
    status: invoice?.status || 'draft',
    // No such toggles exist in the "Personnaliser" drawer today — each PDF
    // template derives these from the invoice's own tax/content flags
    // (getDocumentSectionFlags), a data-driven rule, not a user
    // customization switch. Declared here for the contract's sake and
    // defaulted true rather than wired to override that business logic.
    showMontantEnLettres: true,
    showStamp: true,
  };
}

/** Same luminance/contrast math used by the interactive editor's table
 *  header (see @/lib/colorContrast) — duplicated here as a pure hex-in,
 *  hex-out function so this module has no dependency on anything DOM-side. */
export function getAppearanceContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.45 ? '#18181B' : '#FFFFFF';
}
