import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, applyDocumentDirection, isSupportedLanguage } from "./languages";

import frCommon from "./locales/fr/common.json";
import frNavigation from "./locales/fr/navigation.json";
import frInvoicing from "./locales/fr/invoicing.json";
import frPartners from "./locales/fr/partners.json";
import arCommon from "./locales/ar/common.json";
import arNavigation from "./locales/ar/navigation.json";
import arInvoicing from "./locales/ar/invoicing.json";
import arPartners from "./locales/ar/partners.json";

function readInitialLanguage(): "fr" | "ar" {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupportedLanguage(stored)) return stored;
  } catch {
    // localStorage unavailable (e.g. private mode) — fall back to the default
  }
  return DEFAULT_LANGUAGE;
}

const initialLanguage = readInitialLanguage();

// Applied synchronously before React mounts so the very first paint already
// has the correct dir/lang — avoids a flash of the wrong layout direction.
applyDocumentDirection(initialLanguage);

i18n.use(initReactI18next).init({
  resources: {
    fr: { common: frCommon, navigation: frNavigation, invoicing: frInvoicing, partners: frPartners },
    ar: { common: arCommon, navigation: arNavigation, invoicing: arInvoicing, partners: arPartners },
  },
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  ns: ["common", "navigation", "invoicing", "partners"],
  defaultNS: "common",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
