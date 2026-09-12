import { useEffect, useState } from "react";

/**
 * Desktop keyboard ergonomics shared by the main list pages (Invoices,
 * Clients, Suppliers): `N` triggers that page's own primary "create"
 * action, `Escape` clears the page's own search box, and ArrowUp/ArrowDown
 * + Enter let a row be selected and opened without touching the mouse.
 *
 * Deliberately a plain `window` keydown listener, not row-level tabIndex/
 * focus management — the existing table rows already have their own click
 * handlers (and inline action buttons/dropdowns) that this must not
 * interfere with; `focusedIndex` only drives a visual highlight class the
 * caller applies itself.
 */
export function useTableKeyboardNav<T>({
  rows,
  onOpen,
  onCreate,
  onEscape,
}: {
  rows: T[];
  onOpen: (row: T) => void;
  /** Called on `N` — omit to opt this page out of the shortcut entirely. */
  onCreate?: () => void;
  /** Called on `Escape` — typically clears the page's search query. */
  onEscape?: () => void;
}) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // A filter/search change can shrink the row list out from under a
  // previously-focused index (or change what it points at) — reset rather
  // than silently keep a stale/misleading highlight.
  useEffect(() => {
    setFocusedIndex(null);
  }, [rows.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (e.key === "Escape") {
        onEscape?.();
        return;
      }

      // Never hijack N/arrows while the user is typing anywhere, or while
      // any Radix dialog/sheet/dropdown/alert is open — those already own
      // keyboard focus (form fields, their own arrow-key menus, etc.).
      const hasOpenOverlay = !!document.querySelector('[role="dialog"], [role="alertdialog"], [role="listbox"]');
      if (isTyping || hasOpenOverlay) return;

      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (onCreate) {
          e.preventDefault();
          onCreate();
        }
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (rows.length === 0) return;
        e.preventDefault();
        setFocusedIndex((prev) => {
          if (prev === null) return e.key === "ArrowDown" ? 0 : rows.length - 1;
          const delta = e.key === "ArrowDown" ? 1 : -1;
          return Math.min(rows.length - 1, Math.max(0, prev + delta));
        });
        return;
      }

      if (e.key === "Enter" && focusedIndex !== null && rows[focusedIndex]) {
        e.preventDefault();
        onOpen(rows[focusedIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, focusedIndex, onOpen, onCreate, onEscape]);

  return { focusedIndex, setFocusedIndex };
}
