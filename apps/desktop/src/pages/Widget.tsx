import { useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { RiCloseLine as Close, RiDraggable as DragHandle } from "@remixicon/react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { useDashboardStats } from "@/hooks/useDashboardStats";

/** "1.55M DA" / "320K DA" style — the widget is narrow, full currency
 *  formatting wraps or truncates the hero figures. */
const formatCompact = (amount: number) => {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M DA`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K DA`;
  return `${sign}${Math.round(abs)} DA`;
};

/**
 * Floating glance widget — a companion to the already-running, already-
 * authenticated main window (see tauri.conf.json's "widget" window and
 * widget.rs), not a second login session or a shrunk copy of the app shell.
 * No sidebar, no header, no routing — just this one card. Data comes from
 * the same useDashboardStats hook the main Dashboard uses.
 */
export default function Widget() {
  useEffect(() => {
    document.documentElement.classList.add("widget-window");
    return () => document.documentElement.classList.remove("widget-window");
  }, []);

  const { data: stats } = useDashboardStats();

  // The main Dashboard's own "Trésorerie Nette" card reads stats.yearly.profit
  // (the whole year's net cash position), not stats.currentMonth — using
  // currentMonth here made the widget show a misleading "0 DA" every time the
  // calendar rolls into a new month with nothing recorded yet, even though
  // the agency's actual reconciled cash position is very much non-zero.
  // currentMonth.profit is kept for the small "ce mois" delta badge only.
  const netCashflow = stats?.yearly.profit ?? 0;
  const monthDelta = stats?.currentMonth.profit ?? 0;
  const totalReceivables = stats?.payments.totalReceivables ?? 0;
  const outstandingCount = stats?.payments.outstandingInvoiceCount ?? 0;
  const isPositive = netCashflow >= 0;

  // Trailing 6 real months ending at the current one — sliced up to "now"
  // first so a month early in the year doesn't pull in the remaining
  // months of the year (which sit at 0 until they actually happen).
  const sparklineData = useMemo(() => {
    if (!stats?.monthlyData) return [];
    const upToNow = stats.monthlyData.slice(0, new Date().getMonth() + 1);
    return upToNow.slice(-6).map((m) => ({ value: m.profit }));
  }, [stats?.monthlyData]);

  const handleClose = () => {
    invoke("toggle_widget_window").catch(() => {});
  };

  // Every OS-native drag-session mechanism failed on this window across
  // several attempts: the declarative data-tauri-drag-region attribute,
  // startDragging() called both from a React synthetic handler and a raw
  // native listener, a dedicated small grab-handle icon, and even setting
  // isMovableByWindowBackground directly on the NSWindow (widget.rs) — the
  // OS-level resize handles at the edges are the ONLY thing that ever moved
  // this window, which never touches startDragging()'s code path at all.
  // Rather than keep guessing at which AppKit/WKWebView flag is blocking
  // that path, this drives the window manually instead: track the mouse in
  // plain JS while the button is held on the handle, and reposition the
  // window every frame via setPosition() — a basic window API that doesn't
  // depend on the OS's "start a drag session" machinery at all.
  const dragHandleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = dragHandleRef.current;
    if (!handle) return;

    let dragState: { startScreenX: number; startScreenY: number; startWinX: number; startWinY: number } | null = null;

    const onMouseMove = (e: MouseEvent) => {
      if (!dragState) return;
      // DOM MouseEvent screenX/Y are CSS pixels; setPosition()/outerPosition()
      // work in physical pixels — devicePixelRatio bridges the two, or the
      // window would drift at half/double speed on a Retina display.
      const dpr = window.devicePixelRatio || 1;
      const dx = (e.screenX - dragState.startScreenX) * dpr;
      const dy = (e.screenY - dragState.startScreenY) * dpr;
      getCurrentWindow()
        .setPosition(new PhysicalPosition(Math.round(dragState.startWinX + dx), Math.round(dragState.startWinY + dy)))
        .catch(() => {});
    };

    const onMouseUp = () => {
      dragState = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    const onMouseDown = async (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const pos = await getCurrentWindow().outerPosition();
      dragState = { startScreenX: e.screenX, startScreenY: e.screenY, startWinX: pos.x, startWinY: pos.y };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    handle.addEventListener("mousedown", onMouseDown);
    return () => {
      handle.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div className="w-screen h-screen flex items-center justify-center p-2">
      {/* The window itself is transparent + shadowless (tauri.conf.json) —
          this card is the only visible shape, with its own CSS shadow, so
          the drop shadow renders correctly around the rounded corners
          instead of as a rectangular halo behind them. Dragging lives
          entirely on the small handle icon below now (see the useEffect
          above) — the whole card is no longer a drag target. */}
      <div
        className="relative w-full h-full min-w-0 min-h-0 rounded-[28px] border border-border/40 dark:border-white/10 bg-background/85 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col select-none"
        style={{ pointerEvents: "auto" }}
      >
        <div className="flex items-center justify-between shrink-0 px-4 pt-3 pb-2">
          <div className="flex items-center gap-1.5 pointer-events-none">
            <span className="text-xs font-bold tracking-tight text-foreground">sordi</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          {/* Dedicated drag handle — driven by the manual mousemove/
              setPosition() tracking in the useEffect above. The HTML
              attribute is left on too: inert here (native drag-session
              dragging never worked on this window in testing), but free
              insurance in case a future platform/webview build handles it
              correctly where this one doesn't. */}
          <div
            ref={dragHandleRef}
            data-tauri-drag-region
            title="Déplacer le widget"
            className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-secondary cursor-grab active:cursor-grabbing transition-colors"
            style={{ pointerEvents: "auto" }}
          >
            <DragHandle className="w-4 h-4" />
          </div>
          <button
            onClick={handleClose}
            aria-label="Fermer le widget"
            className="relative z-10 w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            style={{ pointerEvents: "auto" }}
          >
            <Close className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bento split: Trésorerie (left) / Reste à Recouvrer (right) —
            grid + fluid text sizing so this reflows instead of clipping as
            the (now resizable) window is dragged smaller or larger. */}
        <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 px-4 pb-2">
          <div className="flex flex-col justify-center min-w-0">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Trésorerie</span>
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums truncate">
              {formatCompact(netCashflow)}
            </span>
            <span
              className={
                "mt-1.5 inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold " +
                (monthDelta >= 0
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400")
              }
            >
              {monthDelta >= 0 ? "+" : ""}
              {formatCompact(monthDelta)} ce mois
            </span>
          </div>

          <div className="flex flex-col justify-center min-w-0 border-s border-border/40 ps-4">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Reste à recouvrer</span>
            <span className="text-lg font-bold text-foreground tabular-nums truncate">{formatCompact(totalReceivables)}</span>
            <span className="mt-1.5 inline-flex w-fit items-center rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {outstandingCount} facture{outstandingCount > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Mini cashflow sparkline — trailing months, purely decorative
            trend context, no axes/labels/tooltip to keep it minimal. */}
        {sparklineData.length > 1 && (
          <div className="h-10 shrink-0 min-h-0 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData} margin={{ top: 2, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="widget-sparkline-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isPositive ? "#10B981" : "#F43F5E"} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={isPositive ? "#10B981" : "#F43F5E"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={isPositive ? "#10B981" : "#F43F5E"}
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill="url(#widget-sparkline-fill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
