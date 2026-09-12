import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";

// A splash this brief flashing on and back off reads as a glitch, not
// polish — this is the floor, not a fixed delay: bootstrap can (and
// usually does) take longer, in which case this contributes nothing.
const MIN_SPLASH_MS = 800;

/**
 * Fires exactly once per app launch, from inside the "main" window only:
 * once the workspace (active company) has resolved and the theme has
 * settled, waits out whatever's left of the 800ms floor and then tells
 * Rust to reveal "main" and tear down "splashscreen" (see
 * splashscreen.rs). No-ops entirely outside Tauri (`pnpm dev` in a plain
 * browser) — there is no splashscreen window to close there, and no
 * bootstrap gap worth covering for a hot-reloading dev server anyway.
 */
export function useSplashDismissal() {
  // isReady (companies list loaded — see useWorkspace's own doc comment)
  // is the "active company profile verification" signal; resolvedTheme
  // only becomes non-undefined once next-themes has resolved system/saved
  // preference and applied it, i.e. the "theme readiness" signal.
  const { isReady } = useWorkspace();
  const { resolvedTheme } = useTheme();
  const mountedAtRef = useRef(Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    if (!isTauri || firedRef.current || !isReady || !resolvedTheme) return;
    firedRef.current = true;

    const elapsed = Date.now() - mountedAtRef.current;
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);

    const id = setTimeout(() => {
      // A window that was never created as "splashscreen" (e.g. this
      // build's tauri.conf.json predates it) makes this command a no-op
      // on the Rust side, not an error — nothing to catch/report here.
      invoke("close_splashscreen").catch(() => {});
    }, remaining);

    return () => clearTimeout(id);
  }, [isReady, resolvedTheme]);
}
