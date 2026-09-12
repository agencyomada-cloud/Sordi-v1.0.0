import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TrialBanner } from "@/components/layout/TrialBanner";
import { HelpDrawer } from "@/components/layout/HelpDrawer";
import { OnboardingModal } from "@/components/OnboardingModal";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { PageHeaderProvider } from "@/hooks/usePageHeader";

const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

// The invoice editor canvas ("focus mode") wants the sidebar collapsed by
// default. Detected here via pathname rather than a mount-time event from
// the page itself: a child's useEffect runs BEFORE its parent's on initial
// mount (React fires effects bottom-up), so a "collapse now" event dispatched
// from NewInvoice.tsx's own mount effect fires before AppLayout's listener
// for it is even attached — dropped into the void on first navigation,
// which is exactly why the sidebar previously stayed expanded. Reading the
// route directly here has no such ordering dependency.
const FOCUS_MODE_ROUTE = /^\/(invoices\/new|invoices\/[^/]+\/edit|proformas\/new|invoices\/credit-note\/new)$/;

function loadCollapsed(): boolean {
  try {
    // AgentOps-blue direction defaults to the icon-only rail (matching the
    // reference's narrow w-16 sidebar); explicit user choice always wins.
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

/**
 * Mounted once by the protected-routes layout route (see App.tsx), instead
 * of every page independently rendering its own Sidebar/Header — that used
 * to remount both on every navigation, causing a visible flicker.
 */
export function AppLayout() {
  const [isCollapsed, setIsCollapsed] = useState(loadCollapsed);
  const location = useLocation();
  const navigate = useNavigate();

  // Entering a focus-mode route collapses the sidebar — a one-time nudge,
  // not a persisted preference change (skips the localStorage write
  // toggleCollapsed does), so the sidebar's own toggle button still works
  // normally for the rest of this session, and a fresh app launch goes back
  // to whatever the user actually has stored.
  const isFocusRoute = FOCUS_MODE_ROUTE.test(location.pathname);
  useEffect(() => {
    if (isFocusRoute) setIsCollapsed(true);
  }, [isFocusRoute]);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // localStorage unavailable (e.g. private mode) — collapse still works in-memory
      }
      return next;
    });
  };

  // Cmd+B (macOS) / Ctrl+B (Windows/Linux) — the standard native desktop
  // sidebar-toggle shortcut, same persisted state/localStorage write as the
  // sidebar's own toggle button (toggleCollapsed above), not a separate
  // transient UI-only collapse.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <PageHeaderProvider>
      {/* Edge-to-edge native shell — one unified window canvas divided by
          razor-thin 1px borders (Sidebar's border-e, Header's border-b),
          not floating cards on a gray backdrop. */}
      <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-background">
        <Sidebar collapsed={isCollapsed} onToggleCollapsed={toggleCollapsed} />
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <Header />
          <TrialBanner />
          {/* The actual content canvas — flex-1 so it fills the remaining
              window height below the titlebar, its own scroll container so
              the titlebar/sidebar never move regardless of page length. */}
          <main className="flex-1 bg-background overflow-y-auto flex flex-col">
            {/* Keyed by pathname so both the enter animation and the error
                boundary's reset happen together on every navigation — a
                crashed page doesn't leave a stale boundary (or a stale
                animation state) behind when you navigate away from it.
                AnimatePresence lets the outgoing page fade out while the
                incoming one fades in, instead of an abrupt cut; the eased
                curve (a gentle "ease-out expo") reads as a soft settle
                rather than a linear slide. */}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 flex flex-col min-h-0"
              >
                <RouteErrorBoundary onGoHome={() => navigate("/")}>
                  <Outlet />
                </RouteErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        <OnboardingModal />
        <HelpDrawer />
      </div>
    </PageHeaderProvider>
  );
}
