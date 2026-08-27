import { LANGUAGES, type SupportedLanguage } from "@/i18n/languages";

// U+2066 LEFT-TO-RIGHT ISOLATE / U+2069 POP DIRECTIONAL ISOLATE. Without
// this, a digit-led string like "1 500 DA" gets its internal display order
// flipped by the browser's bidi algorithm when it sits inside an RTL block
// with no isolating boundary (e.g. rendered directly in an Arabic-language
// page) — the DOM text stays correct, only the paint order is wrong. Wrapping
// forces it to always render left-to-right internally, regardless of the
// surrounding paragraph direction.
function isolateLtr(text: string): string {
  return `⁦${text}⁩`;
}

/**
 * Locale-aware currency formatting — Algerian Dinar always renders with
 * Western (latn) digits in both languages, matching real Algerian
 * commercial/accounting documents (ICU's default numbering system for
 * ar-DZ is already latn, but it's pinned explicitly here rather than left
 * to the runtime's ICU data).
 */
export function formatCurrency(amount: number, language: SupportedLanguage): string {
  const { intlLocale, currencySymbol } = LANGUAGES[language];
  const formatted = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0, numberingSystem: "latn" }).format(amount);
  return isolateLtr(`${formatted} ${currencySymbol}`);
}

export function formatDate(date: string | Date, language: SupportedLanguage): string {
  const { intlLocale } = LANGUAGES[language];
  const d = typeof date === "string" ? new Date(date) : date;
  return isolateLtr(
    new Intl.DateTimeFormat(intlLocale, { year: "numeric", month: "2-digit", day: "2-digit", numberingSystem: "latn" }).format(d)
  );
}
