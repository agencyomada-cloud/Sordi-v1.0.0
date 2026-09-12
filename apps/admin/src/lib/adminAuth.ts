import { useCallback, useSyncExternalStore } from "react";

// sessionStorage (not localStorage) — survives a page reload within the
// same tab/session (per the task's explicit requirement), but clears when
// the browser tab/window is closed, so an admin key never silently persists
// forever on a shared machine the way localStorage would.
const STORAGE_KEY = "sordi_admin_key";

type Listener = () => void;
const listeners = new Set<Listener>();

function getSnapshot(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function notify() {
  listeners.forEach((l) => l());
}

export function setAdminKey(key: string): void {
  sessionStorage.setItem(STORAGE_KEY, key);
  notify();
}

export function clearAdminKey(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  notify();
}

export function getAdminKey(): string | null {
  return getSnapshot();
}

/** Reactive read of the stored admin key — re-renders every subscriber the
 *  moment login/logout calls setAdminKey/clearAdminKey, so route guards and
 *  the header's logout button never fall out of sync with each other. */
export function useAdminKey(): string | null {
  const subscribe = useCallback((onStoreChange: Listener) => {
    listeners.add(onStoreChange);
    return () => listeners.delete(onStoreChange);
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
