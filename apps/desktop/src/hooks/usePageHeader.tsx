import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface PageHeaderState {
  title: string;
  breadcrumb?: BreadcrumbItem[];
}

interface PageHeaderContextValue {
  header: PageHeaderState | null;
  setHeader: (state: PageHeaderState | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<PageHeaderState | null>(null);
  const value = useMemo(() => ({ header, setHeader }), [header]);
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

// Static path -> title fallback so every route gets a sensible header with zero
// per-page wiring. Pages that want a richer trail (a client or document name)
// override it via useSetPageHeader; everything else falls back to this map,
// mirrored from the sidebar's nav labels.
const ROUTE_TITLES: Array<{ test: (path: string) => boolean; title: string }> = [
  { test: (p) => p === "/", title: "Tableau de bord" },
  { test: (p) => p.startsWith("/invoices"), title: "Facturation" },
  { test: (p) => p.startsWith("/payments"), title: "Paiements" },
  { test: (p) => p.startsWith("/orders"), title: "Commandes" },
  { test: (p) => p.startsWith("/deliveries"), title: "Livraisons" },
  { test: (p) => p.startsWith("/clients"), title: "Clients" },
  { test: (p) => p.startsWith("/projects"), title: "Projets" },
  { test: (p) => p.startsWith("/products"), title: "Produits" },
  { test: (p) => p.startsWith("/expenses"), title: "Charges" },
  { test: (p) => p.startsWith("/analyses"), title: "Analyses" },
  { test: (p) => p.startsWith("/history"), title: "Historique" },
  { test: (p) => p.startsWith("/employees") || p.startsWith("/management"), title: "Employés" },
  { test: (p) => p.startsWith("/payroll"), title: "Paie" },
  { test: (p) => p.startsWith("/integrations"), title: "Intégrations" },
  { test: (p) => p.startsWith("/settings"), title: "Paramètres" },
  { test: (p) => p.startsWith("/upgrade"), title: "Abonnement" },
];

function fallbackTitle(pathname: string): string {
  return ROUTE_TITLES.find((r) => r.test(pathname))?.title ?? "Sordi";
}

/** Read by Header.tsx — returns the current page's title/breadcrumb, falling
 *  back to a path-derived title when the page hasn't set one explicitly. */
export function usePageHeaderState(): PageHeaderState {
  const location = useLocation();
  const ctx = useContext(PageHeaderContext);
  if (ctx?.header) return ctx.header;
  return { title: fallbackTitle(location.pathname) };
}

/** Called by a page to set its own header title/breadcrumb — typically a
 *  detail page surfacing the entity it's viewing (e.g. "Facturation / INV-0042"). */
export function useSetPageHeader(title: string, breadcrumb?: BreadcrumbItem[]) {
  const ctx = useContext(PageHeaderContext);
  const location = useLocation();
  const breadcrumbKey = breadcrumb ? JSON.stringify(breadcrumb) : "";

  useEffect(() => {
    if (!ctx) return;
    ctx.setHeader({ title, breadcrumb });
    return () => ctx.setHeader(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, breadcrumbKey, location.pathname]);
}
