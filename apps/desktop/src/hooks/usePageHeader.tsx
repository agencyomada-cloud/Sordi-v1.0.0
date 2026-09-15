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
// Each entry checks both the canonical English path and the French
// sidebar-tree alias (see Sidebar.tsx's navGroups comment) — list pages
// don't call useSetPageHeader themselves, so this fallback map is the
// only thing that titles them, and the sidebar links exclusively via the
// French aliases. Checking only the English path left the header showing
// the generic "Sordi" fallback on almost every primary section.
const ROUTE_TITLES: Array<{ test: (path: string) => boolean; title: string }> = [
  { test: (p) => p === "/", title: "Tableau de bord" },
  // Checked before the generic /invoices|/factures fallback below — each of
  // the 4 sales document types now has its own strictly-isolated route
  // (see App.tsx and Sidebar.tsx's "Ventes" group), so each gets its own
  // breadcrumb title instead of the old shared "Facturation" for all of them.
  { test: (p) => p.startsWith("/devis"), title: "Devis" },
  { test: (p) => p.startsWith("/proformas"), title: "Factures Proforma" },
  { test: (p) => p.startsWith("/avoirs"), title: "Avoirs" },
  { test: (p) => p.startsWith("/invoices") || p.startsWith("/factures"), title: "Facturation" },
  { test: (p) => p.startsWith("/payments"), title: "Paiements" },
  { test: (p) => p.startsWith("/orders") || p.startsWith("/commandes"), title: "Commandes" },
  { test: (p) => p.startsWith("/deliveries") || p.startsWith("/livraisons"), title: "Livraisons" },
  { test: (p) => p.startsWith("/clients"), title: "Clients" },
  { test: (p) => p.startsWith("/projects"), title: "Projets" },
  { test: (p) => p.startsWith("/products") || p.startsWith("/stocks"), title: "Produits" },
  { test: (p) => p.startsWith("/expenses") || p.startsWith("/charges"), title: "Charges" },
  { test: (p) => p.startsWith("/fournisseurs"), title: "Fournisseurs" },
  { test: (p) => p.startsWith("/contracts"), title: "Contrats" },
  { test: (p) => p.startsWith("/analyses"), title: "Analyses" },
  { test: (p) => p.startsWith("/history") || p.startsWith("/historique"), title: "Historique" },
  { test: (p) => p.startsWith("/employees") || p.startsWith("/management") || p.startsWith("/employes"), title: "Employés" },
  { test: (p) => p.startsWith("/payroll") || p.startsWith("/paie"), title: "Paie" },
  { test: (p) => p.startsWith("/associes") || p.startsWith("/partners"), title: "Associés" },
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
