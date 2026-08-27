import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { OnboardingModal } from "@/components/OnboardingModal";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { PageHeaderProvider } from "@/hooks/usePageHeader";

const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
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
      <div className="flex min-h-screen bg-background">
        <Sidebar collapsed={isCollapsed} onToggleCollapsed={toggleCollapsed} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          {/* Keyed by pathname so both the enter animation and the error
              boundary's reset happen together on every navigation — a
              crashed page doesn't leave a stale boundary (or a stale
              animation state) behind when you navigate away from it. */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-0"
          >
            <RouteErrorBoundary>
              <Outlet />
            </RouteErrorBoundary>
          </motion.div>
        </div>
        <OnboardingModal />
      </div>
    </PageHeaderProvider>
  );
}
