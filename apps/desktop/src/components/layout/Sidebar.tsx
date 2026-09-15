import { useState, useEffect, useMemo, forwardRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Users,
  FileText,
  FileSpreadsheet,
  FileStack,
  Truck,
  Store,
  CreditCard,
  Package,
  ChevronDown,
  Receipt,
  ClipboardList,
  Menu,
  X,
  Settings,
  History,
  BarChart3,
  FolderKanban,
  Wallet,
  PieChart,
  UserCog,
  FileCheck2,
  Undo2,
  PanelLeft,
  PanelLeftClose,
  AlarmClock,
  Bell,
} from "lucide-react";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@sordi/ui";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";
import { useSidebarCounts } from "@/hooks/useSidebarCounts";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useProducts } from "@/hooks/useProducts";
import { useExpenses } from "@/hooks/useExpenses";
import { useActivities } from "@/hooks/useActivities";
import { getInvoiceStatusConfig } from "@/lib/invoiceStatus";
import { formatCurrency } from "@/lib/i18nFormat";
import { useModuleFlags, type ModuleKey } from "@/lib/moduleFlags";
import { SordiLogo } from "@/components/brand/SordiLogo";

// Command palette deep-search caps — Raycast/Linear-style, a handful of
// best matches per section rather than an unbounded scroll.
const MAX_RESULTS_PER_GROUP = 5;

interface NavItem {
  icon: React.ElementType;
  /** Key into the `navigation` i18n namespace — the display label is always
   *  resolved via t() at render/search time, never stored translated. */
  labelKey: string;
  path: string;
}

interface NavGroup {
  id: string;
  titleKey: string;
  items: NavItem[];
  /** Optional/secondary module this whole group belongs to — see
   *  `@/lib/moduleFlags`. Undefined means "always visible" (the core
   *  billing & finance sections plus the pinned system group). */
  moduleKey?: ModuleKey;
}

const topItem: NavItem = { icon: LayoutDashboard, labelKey: "dashboard", path: "/" };
const SordiIqIcon = ({ className }: { className?: string }) => {
  const location = useLocation();
  const active = location.pathname === "/sordi-iq";
  return (
    <SordiLogo
      bare
      className={cn(
        "shrink-0 transition-colors",
        active ? "text-[#FF2949]" : "text-[#FF2949]/80",
        className,
        "w-5 h-5"
      )}
    />
  );
};
const sordiIqItem: NavItem = { icon: SordiIqIcon, labelKey: "links.sordiIq", path: "/sordi-iq" };

// The core billing & finance suite — always visible, organized into 5 clean
// sections (Gestion commerciale / Catalogue / Trésorerie & Suivi / Tiers & Relations)
// plus the single-item "Vue d'ensemble" rendered separately below. Paths
// point at the sidebar-tree route aliases registered in App.tsx (e.g.
// /factures), which render the same page components as the canonical paths
// (/invoices) used by internal navigate()/Link calls elsewhere in the app.
// Kept as aliases rather than a full rename so nothing else in the codebase
// had to change.
//
// Catalogue is placed right below Gestion commerciale (master data
// referencing products & services used in sales documents).
const navGroups: NavGroup[] = [
  {
    id: "billing",
    titleKey: "groups.billing",
    items: [
      // Strict, flat order per the ERP-standard sales architecture: Devis
      // -> Factures Proforma -> Factures -> Avoirs, each its own
      // independent route (see App.tsx's /devis, /proformas, /factures,
      // /avoirs) — a quote, a proforma, a real invoice and a credit note
      // are 4 distinct, separately-numbered document types now (see
      // database.rs's generate_document_number), not tabs/variants of one
      // shared "Factures" page. No nested accordion here on purpose.
      { icon: FileSpreadsheet, labelKey: "links.quotes", path: "/devis" },
      { icon: FileStack, labelKey: "links.proformas", path: "/proformas" },
      { icon: FileText, labelKey: "links.invoicing", path: "/factures" },
      { icon: Undo2, labelKey: "links.creditNotes", path: "/avoirs" },
      { icon: ClipboardList, labelKey: "links.orders", path: "/commandes" },
      { icon: Truck, labelKey: "links.deliveries", path: "/deliveries" },
    ],
  },
  {
    id: "catalogue",
    titleKey: "groups.catalogue",
    items: [
      { icon: Package, labelKey: "links.catalogue", path: "/stocks" },
    ],
  },
  {
    id: "treasury",
    titleKey: "groups.treasury",
    items: [
      { icon: CreditCard, labelKey: "links.payments", path: "/payments" },
      { icon: Bell, labelKey: "links.relances", path: "/relances" },
      { icon: Receipt, labelKey: "links.expenses", path: "/charges" },
      { icon: BarChart3, labelKey: "links.analytics", path: "/analyses" },
    ],
  },
  {
    id: "relations",
    titleKey: "groups.relations",
    items: [
      { icon: Users, labelKey: "links.clients", path: "/clients" },
      { icon: Store, labelKey: "links.suppliers", path: "/fournisseurs" },
      { icon: PieChart, labelKey: "links.partners", path: "/associes" },
    ],
  },
];

// Secondary/optional modules — hidden from the sidebar by default (see
// `@/lib/moduleFlags`), toggled from Paramètres > "Modules optionnels".
// Their routes stay registered in App.tsx regardless of the flag, so a
// direct link or an in-app redirect into a disabled module still works —
// only the sidebar entry point disappears.
const optionalNavGroups: NavGroup[] = [
  {
    id: "hr",
    titleKey: "groups.hr",
    moduleKey: "hr",
    items: [
      { icon: Wallet, labelKey: "links.payroll", path: "/paie" },
      { icon: UserCog, labelKey: "links.employees", path: "/employes" },
    ],
  },
  {
    id: "projects",
    titleKey: "groups.projects",
    moduleKey: "projects",
    items: [
      { icon: FolderKanban, labelKey: "links.projects", path: "/projects" },
      { icon: FileCheck2, labelKey: "links.contracts", path: "/contracts" },
    ],
  },
];

// Consolidated system pillar — config, activity audit, and backups — kept
// as its own group (rendered separately, pinned at the very bottom of the
// nav, directly above the profile card) rather than folded into navGroups
// above, so it never scrolls away with the rest of the tree.
const systemGroup: NavGroup = {
  id: "system",
  titleKey: "groups.system",
  items: [
    { icon: Settings, labelKey: "links.settings", path: "/settings" },
    { icon: History, labelKey: "links.history", path: "/historique" },
  ],
};

const COLLAPSED_GROUPS_KEY = "sordi.sidebar.collapsedGroups";

function loadStringSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

interface SidebarProps {
  className?: string;
  /** Icon-only rail mode (desktop only — the mobile overlay always stays full width). */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(
  function Sidebar({ className, collapsed = false, onToggleCollapsed }, ref) {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation("navigation");
    const { isRtl, language } = useLanguage();
    const counts = useSidebarCounts();
    const moduleFlags = useModuleFlags();
    const visibleOptionalGroups = optionalNavGroups.filter((g) => !g.moduleKey || moduleFlags[g.moduleKey]);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => loadStringSet(COLLAPSED_GROUPS_KEY));
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Deep-search data sources — plain React Query caches already shared
    // with every other page (Invoices.tsx, Clients.tsx, etc.), not a
    // dedicated backend search endpoint. Sidebar is mounted once for the
    // whole session (see AppLayout), so these warm up in the background on
    // first load and the palette's own filtering below is then a synchronous
    // in-memory pass over already-cached arrays — no round trip, no
    // perceptible latency, whatever page the user is currently on.
    const { data: allInvoices } = useInvoices();
    const { data: allClients } = useClients();
    const { data: allSuppliers } = useSuppliers();
    const { data: allProducts } = useProducts();
    const { data: allExpenses } = useExpenses();
    const { activities: allActivities } = useActivities();

    const closeCommandPalette = (open: boolean) => {
      setIsCommandPaletteOpen(open);
      if (!open) setSearchQuery("");
    };

    const trimmedQuery = searchQuery.trim().toLowerCase();
    const hasQuery = trimmedQuery.length > 0;

    const matchedInvoices = useMemo(() => {
      if (!hasQuery || !allInvoices) return [];
      return allInvoices
        .filter((invoice) => {
          const clientName = invoice.clients?.name?.toLowerCase() || "";
          return (
            invoice.invoice_number?.toLowerCase().includes(trimmedQuery) ||
            clientName.includes(trimmedQuery) ||
            String(invoice.total_ttc ?? "").includes(trimmedQuery)
          );
        })
        .slice(0, MAX_RESULTS_PER_GROUP);
    }, [allInvoices, hasQuery, trimmedQuery]);

    // Clients and suppliers share one "Tiers" group — same row shape
    // (name / phone-city), just a different destination and icon.
    const matchedClients = useMemo(() => {
      if (!hasQuery || !allClients) return [];
      return allClients.filter(
        (client) =>
          client.name.toLowerCase().includes(trimmedQuery) ||
          (client.phone || "").toLowerCase().includes(trimmedQuery) ||
          (client.nif || "").toLowerCase().includes(trimmedQuery)
      );
    }, [allClients, hasQuery, trimmedQuery]);

    const matchedSuppliers = useMemo(() => {
      if (!hasQuery || !allSuppliers) return [];
      return allSuppliers.filter(
        (supplier) =>
          supplier.name.toLowerCase().includes(trimmedQuery) ||
          (supplier.phone || "").toLowerCase().includes(trimmedQuery) ||
          (supplier.nif || "").toLowerCase().includes(trimmedQuery)
      );
    }, [allSuppliers, hasQuery, trimmedQuery]);

    const matchedProducts = useMemo(() => {
      if (!hasQuery || !allProducts) return [];
      return allProducts
        .filter((product) => product.name.toLowerCase().includes(trimmedQuery) || product.code.toLowerCase().includes(trimmedQuery))
        .slice(0, MAX_RESULTS_PER_GROUP);
    }, [allProducts, hasQuery, trimmedQuery]);

    const matchedExpenses = useMemo(() => {
      if (!hasQuery || !allExpenses) return [];
      return allExpenses
        .filter(
          (expense) =>
            (expense.description || "").toLowerCase().includes(trimmedQuery) ||
            expense.category.toLowerCase().includes(trimmedQuery)
        )
        .slice(0, MAX_RESULTS_PER_GROUP);
    }, [allExpenses, hasQuery, trimmedQuery]);

    const matchedActivities = useMemo(() => {
      if (!hasQuery || !allActivities) return [];
      return allActivities
        .filter(
          (activity) =>
            activity.title.toLowerCase().includes(trimmedQuery) ||
            (activity.notes || "").toLowerCase().includes(trimmedQuery)
        )
        .slice(0, MAX_RESULTS_PER_GROUP);
    }, [allActivities, hasQuery, trimmedQuery]);

    const tiersResults = useMemo(
      () => [
        ...matchedClients.map((client) => ({ kind: "client" as const, record: client })),
        ...matchedSuppliers.map((supplier) => ({ kind: "supplier" as const, record: supplier })),
      ].slice(0, MAX_RESULTS_PER_GROUP),
      [matchedClients, matchedSuppliers]
    );

    // Only searches pages actually reachable from the sidebar right now —
    // a disabled module's pages disappear from quick search too, not just
    // the visible tree, consistent with "cleanly hide" in the brief.
    const searchableNavItems: NavItem[] = [
      topItem,
      sordiIqItem,
      ...navGroups.flatMap((g) => g.items),
      ...visibleOptionalGroups.flatMap((g) => g.items),
      ...systemGroup.items,
    ];
    const matchedPages = searchableNavItems.filter((item) =>
      t(item.labelKey).toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    // Instant actions — jump straight to the existing creation route for
    // each document type (the same routes their own page's "Nouveau..."
    // buttons already use), not a separate/duplicated creation path.
    const instantActions: { id: string; label: string; icon: React.ElementType; path: string }[] = [
      { id: "new-invoice", label: t("search.newInvoice", { defaultValue: "Créer une facture" }), icon: FileText, path: "/invoices/new" },
      { id: "new-quote", label: t("search.newQuote", { defaultValue: "Créer un devis" }), icon: FileSpreadsheet, path: "/proformas/new" },
      { id: "new-client", label: t("search.newClient", { defaultValue: "Ajouter un client" }), icon: Users, path: "/clients/new" },
    ];
    const matchedActions = instantActions.filter((a) =>
      a.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          setIsCommandPaletteOpen((prev) => {
            const next = !prev;
            if (!next) setSearchQuery("");
            return next;
          });
        }
      };
      // The visible search trigger lives in the Header now (a sibling
      // component, not a child), so it opens this dialog via a plain
      // window event instead of prop-drilling this state up through
      // AppLayout just for one click handler.
      const handleOpenEvent = () => setIsCommandPaletteOpen(true);
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("open-command-palette", handleOpenEvent);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("open-command-palette", handleOpenEvent);
      };
    }, []);

    const getBadgeCount = (labelKey: string): number | undefined => {
      switch (labelKey) {
        case "links.orders":
          return counts.orders;
        case "links.invoicing":
          return counts.invoices;
        case "links.deliveries":
          return counts.deliveries;
        case "links.history":
          return counts.history;
        case "links.relances":
          return counts.relances;
        // No dedicated "Rappels" nav entry yet (Phase 1 embeds activities
        // inside ClientDetail/InvoiceDetail inspector panels) — surface
        // overdue reminders as a subtle badge on the Dashboard link itself,
        // the one place every session starts.
        case "dashboard":
          return counts.activities;
        default:
          return undefined;
      }
    };

    const toggleGroup = (id: string) => {
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...next]));
        } catch {
          // localStorage unavailable (e.g. private mode) — collapse still works in-memory
        }
        return next;
      });
    };

    // Every document type (Devis/Proforma/Factures/Avoirs included) now has
    // its own distinct pathname — strict route isolation means no nav item
    // needs a ?query to tell itself apart from a sibling sharing the same
    // page component, so this is a plain pathname match.
    const isActive = (path: string) => location.pathname === path;

    const handleNavigate = (path: string) => {
      navigate(path);
      setIsMobileOpen(false);
    };

    const handleSelectSearchResult = (path: string) => {
      handleNavigate(path);
      closeCommandPalette(false);
    };

    // One shared pill style for every nav item — top-level (topItem) and
    // grouped items alike, collapsed rail included — rather than a separate
    // indented "tree" treatment for grouped items. A blue-tinted pill for
    // the active route (10% brand-blue rule: the accent shows up only here,
    // not as a heavy filled block) and a quiet slate hover for everything
    // else. The active icon already reads blue for free — lucide icons
    // inherit `currentColor`, and the active className sets text-blue-600.
    const renderNavItem = (item: NavItem) => {
      const label = t(item.labelKey);
      const count = getBadgeCount(item.labelKey);
      const active = isActive(item.path);
      return (
        <li key={item.path}>
          <button
            onClick={() => handleNavigate(item.path)}
            title={collapsed ? label : undefined}
            className={cn(
              "group w-full flex items-center gap-2 h-[30px] mx-1.5 rounded-md text-xs font-medium transition-colors",
              collapsed ? "justify-center px-0 mx-0" : "px-2.5",
              active
                // The active pill itself stays neutral (bg-muted) — only
                // the icon+label pick up the accent color, a small tint
                // rather than a solid Scarlet-filled row, so the sidebar
                // body stays in the muted dark scale exactly as intended.
                ? "bg-muted text-primary font-semibold border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
            )}
          >
            <item.icon className="w-4 h-4 stroke-[1.75] shrink-0" />
            {/* Always mounted (not conditionally rendered) so the collapse
                itself animates — width/opacity fade, not an instant pop. */}
            <span
              className={cn(
                "flex items-center gap-2 overflow-hidden transition-all duration-200 ease-in-out",
                collapsed ? "w-0 opacity-0" : "flex-1 opacity-100"
              )}
            >
              <span className="flex-1 text-start truncate whitespace-nowrap">{label}</span>
              {count !== undefined && count > 0 && (
                <span className="text-[10px] font-mono tabular-nums px-1.5 py-[1px] rounded bg-muted-foreground/10 text-muted-foreground transition-colors shrink-0">
                  {count}
                </span>
              )}
            </span>
          </button>
        </li>
      );
    };

    // One collapsible group's header + items — shared between the scrollable
    // navGroups list and the pinned systemGroup footer, so both stay
    // pixel-identical instead of two hand-duplicated render blocks. Every
    // item (grouped or not) renders through the same renderNavItem pill —
    // no nested accordion/tree treatment for any item, per the flat-routes
    // sales architecture (Devis/Factures Proforma/Factures/Avoirs are 4
    // independent flat links, not a parent+children disclosure).
    const renderGroup = (group: NavGroup, iconOnly: boolean) => {
      const groupCollapsed = !iconOnly && collapsedGroups.has(group.id);
      return (
        <div key={group.id} className="mt-1">
          {!iconOnly && (
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-expanded={!groupCollapsed}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors duration-150"
            >
              <span className="flex-1 text-start">{t(group.titleKey)}</span>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 stroke-[1.75] opacity-70 transition-transform duration-200",
                  groupCollapsed && "-rotate-90"
                )}
              />
            </button>
          )}
          {!groupCollapsed && (
            <ul className="space-y-1 animate-fade-in duration-200">
              {group.items.map((item) => renderNavItem(item))}
            </ul>
          )}
        </div>
      );
    };

    // A plain function, not a component defined via JSX usage below — a
    // function component declared inside another component's render body
    // gets a fresh type reference on every render, which makes React treat
    // it as a completely different component and fully unmount+remount
    // the whole subtree instead of reconciling it in place. That silently
    // broke every CSS transition inside it (freshly-mounted DOM nodes have
    // no "before" state to animate from) — including the collapse/expand
    // fades already meant to handle this. Calling it as SidebarContent({...})
    // instead of <SidebarContent ... /> keeps its output as part of
    // Sidebar's own element tree, so it reconciles instead of remounting.
    const SidebarContent = ({ iconOnly = false, showToggle = false }: { iconOnly?: boolean; showToggle?: boolean }) => (
      <>
        {/* Reserves clearance above the logo for the macOS traffic lights
            (see trafficLightPosition in tauri.conf.json) and makes that
            empty strip drag the window, since the titlebar itself is now
            an invisible overlay with no native drag surface of its own. */}
        <div data-tauri-drag-region className="h-9 w-full shrink-0" />

        {/* Wordmark / icon-only mark. Centers the icon when collapsed
            (matching the nav icons' own centering), left-aligns the
            wordmark when expanded. The two cross-fade via their own grid
            tracks (width genuinely interpolates 1fr->0fr, inverse of each
            other). */}
        <div
          className={cn(
            "flex items-center pt-8 pb-2 transition-[padding] duration-300 ease-in-out",
            iconOnly ? "justify-center px-3" : "justify-start px-4"
          )}
        >
          <div className="flex items-center min-w-0">
            <div
              className={cn(
                "grid overflow-hidden transition-[grid-template-columns,opacity] duration-300 ease-in-out",
                iconOnly ? "grid-cols-[0fr] opacity-0" : "grid-cols-[1fr] opacity-100"
              )}
            >
              <SordiLogo className="h-8 w-auto object-contain shrink-0 text-foreground" />
            </div>
            <div
              className={cn(
                "grid overflow-hidden transition-[grid-template-columns,opacity] duration-300 ease-in-out",
                iconOnly ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0"
              )}
            >
              <SordiLogo iconOnly className="h-7 w-7 shrink-0" />
            </div>
          </div>
        </div>

        {/* Collapse toggle — its own dedicated row, in normal document
            flow (not absolutely positioned, not floating on an edge or
            over a banner). Two prior attempts both failed: inside the logo
            row it competed for width and knocked the icon off-center;
            floating on the sidebar's border edge required guessing pixel
            offsets against other UI (traffic lights, the license banner)
            that shifted depending on what else was on screen. A plain
            in-flow row can never overlap anything above or below it — it's
            simply pushed down by the logo row and pushes the nav list down
            in turn, guaranteed by normal layout instead of coordinates. */}
        {showToggle && onToggleCollapsed && (
          <div className={cn("flex pb-3 transition-[padding] duration-300 ease-in-out", iconOnly ? "justify-center px-3" : "justify-end px-4")}>
            <button
              onClick={onToggleCollapsed}
              title={iconOnly ? t("expandMenu") : t("collapseMenu")}
              aria-label={iconOnly ? t("expandMenu") : t("collapseMenu")}
              className="h-6 w-6 shrink-0 rounded-md text-muted-foreground hover:bg-muted/80 hover:text-foreground flex items-center justify-center transition-colors"
            >
              {iconOnly ? (
                <PanelLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
              ) : (
                <PanelLeftClose className={cn("w-3.5 h-3.5", isRtl && "-scale-x-100")} strokeWidth={1.75} />
              )}
            </button>
          </div>
        )}

        {/* Company switcher and search moved to the top Header bar (next to
            the notification/new-invoice icons) — freeing this vertical
            space for nav categories, which is the part that actually
            benefits from more room as more groups get added. The command
            palette itself (state, dialog, ⌘K listener) stays owned here;
            the Header's search icon just dispatches an event to open it,
            see the "open-command-palette" listener below. */}

        {/* Navigation */}
        <nav className="flex-1 px-3 pb-4 overflow-y-auto scrollbar-hide flex flex-col">
          {/* "Vue d'ensemble" — a single-item group (just the dashboard), so
              it gets a plain label instead of the collapsible group header
              the multi-item groups below use (nothing to collapse). */}
          {!iconOnly && (
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("groups.overview")}
            </p>
          )}
          <ul className="space-y-1">
            {renderNavItem(topItem)}
            {renderNavItem(sordiIqItem)}
          </ul>

          {navGroups.map((group) => renderGroup(group, iconOnly))}
          {visibleOptionalGroups.map((group) => renderGroup(group, iconOnly))}

          {/* Système — pinned below all scrollable groups, never collapses
              out of view. Account identity/workspace/settings/sign-out
              moved to the Header's WorkspaceAccountMenu, so this is now
              the last thing in the sidebar — purely navigation, nothing
              else competing for the footer. */}
          <div className="mt-auto pt-3 pb-2 border-t border-sidebar-border/60">
            {renderGroup(systemGroup, iconOnly)}
          </div>
        </nav>
      </>
    );

    return (
      <>
        {/* Mobile Toggle Button */}
        <button
          className="fixed top-4 start-4 z-50 lg:hidden w-9 h-9 bg-card border border-border/80 rounded-md flex items-center justify-center transition-colors hover:bg-muted/60"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
        >
          {isMobileOpen ? <X className="w-5 h-5 stroke-[1.75]" /> : <Menu className="w-5 h-5 stroke-[1.75]" />}
        </button>

        {/* Mobile Overlay */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-foreground/20 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Desktop Sidebar — a continuous, edge-to-edge pane (flat, no
            rounded/floating "island" treatment, no blur): depth comes from
            the single 1px border-e, matching the rest of the native shell. */}
        <aside
          ref={ref}
          className={cn(
            // z-20: without an explicit z-index here, the sidebar loses to
            // later-painted siblings that create their own stacking context
            // (framer-motion's page-transition wrapper, any transformed
            // card) and the collapse/expand toggle button bleeding past
            // this element's own edge renders BEHIND them instead of on top.
            "relative z-20 shrink-0 flex-col h-screen hidden lg:flex sticky top-0 transition-all duration-300 ease-in-out bg-muted/20 border-e border-border/80",
            collapsed ? "w-16" : "w-56",
            className
          )}
        >
          {SidebarContent({ iconOnly: collapsed, showToggle: true })}
        </aside>

        {/* Mobile Sidebar */}
        <aside
          className={cn(
            "fixed top-0 start-0 w-56 flex flex-col h-screen z-50 lg:hidden transition-transform duration-300 ease-out bg-muted/20 border-e border-border/80",
            isMobileOpen ? "translate-x-0" : isRtl ? "translate-x-full" : "-translate-x-full"
          )}
        >
          {SidebarContent({})}
        </aside>

        {/* Command palette shell — search logic wired up in a future task */}
        <CommandDialog
          open={isCommandPaletteOpen}
          onOpenChange={closeCommandPalette}
          shouldFilter={false}
          title="Recherche globale"
          description="Palette de commandes pour navigation rapide"
        >
          <CommandInput
            placeholder={t("search.commandPlaceholder")}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {matchedInvoices.length === 0 &&
              tiersResults.length === 0 &&
              matchedProducts.length === 0 &&
              matchedExpenses.length === 0 &&
              matchedActivities.length === 0 &&
              matchedActions.length === 0 &&
              matchedPages.length === 0 && (
                <CommandEmpty>{t("search.noResults", { query: searchQuery })}</CommandEmpty>
              )}

            {/* Deep search results first — real business records the user
                typed a query for. Actions/Pages (existing nav shortcuts)
                stay below, and are the ONLY thing shown when the query is
                empty (their own filters already default to "match everything"
                on an empty string). */}
            {matchedInvoices.length > 0 && (
              <CommandGroup heading={t("search.invoices", { defaultValue: "Factures & Devis" })}>
                {matchedInvoices.map((invoice) => {
                  const statusConfig = getInvoiceStatusConfig(invoice.status);
                  return (
                    <CommandItem
                      key={`invoice-${invoice.id}`}
                      value={`invoice-${invoice.id}`}
                      onSelect={() => handleSelectSearchResult(`/invoices/${invoice.id}`)}
                      className="h-8 px-2.5 text-xs rounded-md"
                    >
                      <FileText className="w-3.5 h-3.5 me-2 shrink-0 opacity-70" />
                      <span className="flex-1 min-w-0 truncate">
                        <span className="font-medium">{invoice.invoice_number}</span>
                        {invoice.clients?.name && (
                          <span className="text-muted-foreground group-data-[selected=true]:text-foreground/80"> - {invoice.clients.name}</span>
                        )}
                      </span>
                      <span className="ms-2 shrink-0 font-mono tabular-nums font-semibold text-foreground">
                        {formatCurrency(invoice.total_ttc, language)} • {statusConfig.label}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {tiersResults.length > 0 && (
              <CommandGroup heading={t("search.tiers", { defaultValue: "Clients & Fournisseurs" })}>
                {tiersResults.map(({ kind, record }) => (
                  <CommandItem
                    key={`${kind}-${record.id}`}
                    value={`${kind}-${record.id}`}
                    onSelect={() =>
                      handleSelectSearchResult(kind === "client" ? `/clients/${record.id}` : "/fournisseurs")
                    }
                    className="h-8 px-2.5 text-xs rounded-md"
                  >
                    {kind === "client" ? (
                      <Users className="w-3.5 h-3.5 me-2 shrink-0 opacity-70" />
                    ) : (
                      <Store className="w-3.5 h-3.5 me-2 shrink-0 opacity-70" />
                    )}
                    <span className="flex-1 min-w-0 truncate">{record.name}</span>
                    <span className="ms-2 shrink-0 text-muted-foreground group-data-[selected=true]:text-foreground/80">
                      {[record.phone, record.city].filter(Boolean).join(" / ") || "—"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {matchedProducts.length > 0 && (
              <CommandGroup heading={t("search.products", { defaultValue: "Catalogue & Services" })}>
                {matchedProducts.map((product) => (
                  <CommandItem
                    key={`product-${product.id}`}
                    value={`product-${product.id}`}
                    onSelect={() => handleSelectSearchResult(`/products?highlight=${product.id}`)}
                    className="h-8 px-2.5 text-xs rounded-md"
                  >
                    <Package className="w-3.5 h-3.5 me-2 shrink-0 opacity-70" />
                    <span className="flex-1 min-w-0 truncate">{product.name}</span>
                    <span className="ms-2 shrink-0 font-mono tabular-nums font-semibold text-foreground">
                      {formatCurrency(product.unit_price, language)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {matchedExpenses.length > 0 && (
              <CommandGroup heading={t("search.expenses", { defaultValue: "Dépenses" })}>
                {matchedExpenses.map((expense) => (
                  <CommandItem
                    key={`expense-${expense.id}`}
                    value={`expense-${expense.id}`}
                    onSelect={() => handleSelectSearchResult("/expenses")}
                    className="h-8 px-2.5 text-xs rounded-md"
                  >
                    <Receipt className="w-3.5 h-3.5 me-2 shrink-0 opacity-70" />
                    <span className="flex-1 min-w-0 truncate">{expense.description || expense.category}</span>
                    <span className="ms-2 shrink-0 font-mono tabular-nums font-semibold text-foreground">
                      {formatCurrency(expense.amount, language)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {matchedActivities.length > 0 && (
              <CommandGroup heading={t("search.activities", { defaultValue: "Rappels & Activités" })}>
                {matchedActivities.map((activity) => {
                  const path =
                    activity.entity_type === "client"
                      ? `/clients/${activity.entity_id}`
                      : activity.entity_type === "supplier"
                        ? "/fournisseurs"
                        : `/invoices/${activity.entity_id}`;
                  const overdue = !activity.done_at && activity.due_date < new Date().toISOString().slice(0, 10);
                  return (
                    <CommandItem
                      key={`activity-${activity.id}`}
                      value={`activity-${activity.id}`}
                      onSelect={() => handleSelectSearchResult(path)}
                      className="h-8 px-2.5 text-xs rounded-md"
                    >
                      <AlarmClock className="w-3.5 h-3.5 me-2 shrink-0 opacity-70" />
                      <span className="flex-1 min-w-0 truncate">{activity.title}</span>
                      <span
                        className={cn(
                          "ms-2 shrink-0 font-mono tabular-nums",
                          overdue ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-muted-foreground"
                        )}
                      >
                        {activity.due_date}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {matchedActions.length > 0 && (
              <CommandGroup heading={t("search.actions", { defaultValue: "Actions" })}>
                {matchedActions.map((action) => (
                  <CommandItem key={action.id} value={`action-${action.id}`} onSelect={() => handleSelectSearchResult(action.path)} className="h-8 px-2.5 text-xs rounded-md">
                    <action.icon className="w-3.5 h-3.5 stroke-[1.75] me-2 shrink-0 opacity-70" />
                    {action.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {matchedPages.length > 0 && (
              <CommandGroup heading={t("search.pages")}>
                {matchedPages.map((item) => (
                  <CommandItem key={item.path} value={`page-${item.path}`} onSelect={() => handleSelectSearchResult(item.path)} className="h-8 px-2.5 text-xs rounded-md">
                    <item.icon className="w-4 h-4 stroke-[1.75] me-2 shrink-0 opacity-70" />
                    {t(item.labelKey)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </CommandDialog>
      </>
    );
  }
);

Sidebar.displayName = "Sidebar";
