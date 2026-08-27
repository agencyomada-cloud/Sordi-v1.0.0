import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSettings, useUpdateSetting } from "@/hooks/useSettings";
import {
  LANGUAGES,
  LANGUAGE_STORAGE_KEY,
  applyDocumentDirection,
  isSupportedLanguage,
  type SupportedLanguage,
} from "@/i18n/languages";

/**
 * Single source of truth for the active language: i18next holds it in
 * memory, localStorage caches it for an instant correct `dir` on next boot
 * (read synchronously in src/i18n/index.ts, before React even mounts), and
 * the `settings` table is the durable, workspace-wide record — the same
 * key/value store every other company-wide preference (theme colors, PDF
 * template, ...) already lives in.
 */
export function useLanguage() {
  const { i18n } = useTranslation();
  const { data: settings } = useSettings();
  const updateSetting = useUpdateSetting();

  const language = isSupportedLanguage(i18n.language) ? i18n.language : "fr";

  // Reconciles with the workspace-level setting once it loads — covers the
  // case where the SQLite-backed value differs from this browser's cached
  // localStorage copy (e.g. a fresh profile, or the setting was changed
  // from another session).
  useEffect(() => {
    const stored = settings?.current_language;
    if (isSupportedLanguage(stored) && stored !== language) {
      i18n.changeLanguage(stored);
      applyDocumentDirection(stored);
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, stored);
      } catch {
        // localStorage unavailable — in-memory language still switches correctly
      }
    }
    // Only re-run when the persisted setting itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.current_language]);

  const setLanguage = useCallback(
    (next: SupportedLanguage) => {
      if (next === language) return;
      i18n.changeLanguage(next);
      applyDocumentDirection(next);
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      } catch {
        // localStorage unavailable — in-memory language still switches correctly
      }
      updateSetting.mutate({ key: LANGUAGE_STORAGE_KEY, value: next });
    },
    [i18n, language, updateSetting]
  );

  return { language, meta: LANGUAGES[language], setLanguage, isRtl: LANGUAGES[language].dir === "rtl" };
}
