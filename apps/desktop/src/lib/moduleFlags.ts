import { useEffect, useState } from "react";

// Secondary/optional feature modules — hidden from the sidebar by default so
// Sordi reads as a focused billing & finance suite out of the box. Toggled
// from Paramètres > "Modules optionnels" (see Settings.tsx). Stored in
// localStorage (per-device, like the notification-sound preference) rather
// than the `settings` DB table, since this is pure UI presentation state,
// not business data that needs to sync/back up with the rest of the app.
export type ModuleKey = "hr" | "deliveries" | "projects";

export const MODULE_KEYS: ModuleKey[] = ["hr", "deliveries", "projects"];

const STORAGE_KEY = "sordi.modules.enabled";
const MODULE_FLAGS_EVENT = "sordi-module-flags-changed";

const DEFAULT_FLAGS: Record<ModuleKey, boolean> = {
  hr: false,
  deliveries: false,
  projects: false,
};

export function loadModuleFlags(): Record<ModuleKey, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FLAGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_FLAGS, ...parsed };
  } catch {
    return { ...DEFAULT_FLAGS };
  }
}

export function isModuleEnabled(key: ModuleKey): boolean {
  return loadModuleFlags()[key];
}

export function setModuleEnabled(key: ModuleKey, enabled: boolean): void {
  const flags = loadModuleFlags();
  flags[key] = enabled;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch {
    // localStorage unavailable (e.g. private mode) — the toggle still
    // applies in-memory for the rest of this session via the event below.
  }
  window.dispatchEvent(new CustomEvent(MODULE_FLAGS_EVENT));
}

// The sidebar and the Settings toggles are separate mounted components, so a
// toggle in one doesn't re-render the other via React state alone — this
// hook re-reads localStorage on the custom event (same-tab change) and the
// native `storage` event (another window/tab), keeping every mounted
// consumer in sync immediately.
export function useModuleFlags(): Record<ModuleKey, boolean> {
  const [flags, setFlags] = useState(loadModuleFlags);
  useEffect(() => {
    const handler = () => setFlags(loadModuleFlags());
    window.addEventListener(MODULE_FLAGS_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(MODULE_FLAGS_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return flags;
}
