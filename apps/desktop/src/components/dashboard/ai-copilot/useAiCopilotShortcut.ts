import { useEffect, type RefObject } from "react";

/**
 * Cmd+K / Ctrl+K — scoped entirely to whenever the AI Copilot bar is
 * mounted, which is only on the Dashboard (Index.tsx), where this bar
 * lives. Registered on the capture phase specifically so it wins the race
 * against Sidebar.tsx's own global Cmd+K handler (the command palette),
 * which attaches in the default bubble phase — `stopImmediatePropagation`
 * (not just `stopPropagation`) is required to also block that other bubble
 * listener on the same `window` target.
 *
 * This is a deliberate, narrow override: everywhere else in the app (this
 * component unmounted, i.e. any page other than the Dashboard), Cmd+K
 * still opens the command palette exactly as before — zero behavior
 * change outside the one page this bar lives on.
 */
export function useAiCopilotShortcut(inputRef: RefObject<HTMLInputElement>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopImmediatePropagation();
        inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [inputRef]);
}
