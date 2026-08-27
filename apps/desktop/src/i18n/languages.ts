export type SupportedLanguage = "fr" | "ar";

export const LANGUAGE_STORAGE_KEY = "current_language";
export const DEFAULT_LANGUAGE: SupportedLanguage = "fr";

export interface LanguageMeta {
  code: SupportedLanguage;
  /** Always shown in the language's own script, regardless of the active locale. */
  nativeName: string;
  dir: "ltr" | "rtl";
  /** Passed to Intl.NumberFormat/DateTimeFormat for locale-aware figures. */
  intlLocale: string;
  currencySymbol: string;
}

export const LANGUAGES: Record<SupportedLanguage, LanguageMeta> = {
  fr: { code: "fr", nativeName: "Français", dir: "ltr", intlLocale: "fr-DZ", currencySymbol: "DA" },
  ar: { code: "ar", nativeName: "العربية", dir: "rtl", intlLocale: "ar-DZ", currencySymbol: "د.ج" },
};

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return value === "fr" || value === "ar";
}

/** Applies dir/lang/rtl-class to the document root — called on boot and on every switch. */
export function applyDocumentDirection(language: SupportedLanguage): void {
  const { dir } = LANGUAGES[language];
  const root = document.documentElement;
  root.setAttribute("dir", dir);
  root.setAttribute("lang", language);
  root.classList.toggle("rtl", dir === "rtl");
}
