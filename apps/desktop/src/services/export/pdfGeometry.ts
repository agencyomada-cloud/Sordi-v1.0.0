/**
 * Shared A4 page geometry for every @react-pdf/renderer document template
 * (InvoicePDFDocument, InvoiceTemplateEpure, InvoiceTemplateModerne, and any
 * future one). Previously each template redeclared the same page-size,
 * margin, and logo-clamp constants (plus an identical explanatory comment)
 * independently — a branding tweak applied to one template silently didn't
 * propagate to the others. Centralizing them here means every template
 * stays byte-for-byte in sync with the same physical page.
 *
 * These are the exact values already in production use — importing them
 * changes nothing about how any existing document renders.
 */

/** A4 physical page size in PDF points (72pt/inch), matching the
 *  screen preview's 210mm × 297mm at 96 CSS px/inch: 793.7px × 1122.5px. */
export const A4_WIDTH_PT = 595.28;
export const A4_HEIGHT_PT = 841.89;

/** Exact 1:1 proportional match between screen CSS (210mm = 793.7px) and
 *  PDF points (595.28pt): 595.28 / 793.700787 = 0.75 pt/px. Use this to
 *  convert any on-screen pixel measurement (e.g. a slider value) into the
 *  equivalent PDF point value without drifting from the live preview. */
export const PX_TO_PT_SCALE = 0.75;

/** Standard executive print margin — 52pt (~18.5mm) — so a logo/company
 *  block's left edge lands on the same vertical grid line as the client
 *  block, item table, and legal footer text below it. */
export const STANDARD_MARGIN_PT = 52;

/** Default/max logo box a document header renders into, screen-equivalent
 *  to a clamped `h-12 w-auto` (48px tall) treatment scaled to PDF points. */
export const LOGO_MAX_HEIGHT_PT = 65;
export const LOGO_MAX_WIDTH_PT = 180;

/** Resolve the logo's max render height for a given settings row, honoring
 *  a per-company override (`logo_size`) and falling back to the standard
 *  clamp — the same fallback every template already applied inline. */
export function resolveLogoMaxHeight(settings?: { logo_size?: number | string | null }): number {
  return Number(settings?.logo_size) || LOGO_MAX_HEIGHT_PT;
}

/** Shared react-pdf `page` style base — spread this into a template's own
 *  StyleSheet.create({ page: { ...PDF_PAGE_BASE, ... } }) call so page
 *  dimensions can never drift between templates. */
export const PDF_PAGE_BASE = {
  width: A4_WIDTH_PT,
  height: A4_HEIGHT_PT,
} as const;
