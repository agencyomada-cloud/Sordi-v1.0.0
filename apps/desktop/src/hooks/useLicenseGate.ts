import { useState } from "react";
import { useLicenseStatus } from "@/hooks/useLicense";

/**
 * Client-side mirror of require_active_license() (license.rs) — used to
 * proactively block a write action and show LicenseBlockedModal BEFORE the
 * Tauri call round-trips and fails, rather than only reacting to the error
 * afterward. This is UX only: the real enforcement stays server/Rust-side
 * (require_active_license() on every gated command), so a stale/bypassed
 * client check here can never grant actual unlicensed write access.
 *
 * Usage: `const { isReadOnly, requireActive } = useLicenseGate();` then
 * wrap a submit handler's first line with
 * `if (!requireActive()) return;` and render
 * `<LicenseBlockedModal open={blockedOpen} onOpenChange={setBlockedOpen} />`
 * using the `blockedOpen`/`setBlockedOpen` this hook returns.
 */
export function useLicenseGate() {
  const { data: status } = useLicenseStatus();
  const [blockedOpen, setBlockedOpen] = useState(false);

  const isReadOnly = status?.state !== "active";

  /** Returns true if the caller may proceed, false (and opens the blocking
   *  modal) if not. */
  const requireActive = () => {
    if (isReadOnly) {
      setBlockedOpen(true);
      return false;
    }
    return true;
  };

  return { isReadOnly, requireActive, blockedOpen, setBlockedOpen };
}
