import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { OnboardingModal } from "@/components/OnboardingModal";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { PageHeaderProvider } from "@/hooks/usePageHeader";

const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

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

  return (
    <PageHeaderProvider>
      {/* Flat, bright, ultra-clean canvas — body already sets the same
          #F8FAFC tone, this just keeps the layout wrapper opaque so no
          transparent void ever shows through to the OS layer. */}
      <div className="flex min-h-screen bg-[#F8FAFC]">
        <Sidebar collapsed={isCollapsed} onToggleCollapsed={toggleCollapsed} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
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
        </div>
        <OnboardingModal />
      </div>
    </PageHeaderProvider>
  );
}
