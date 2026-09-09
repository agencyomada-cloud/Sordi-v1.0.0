import { useState, useEffect, forwardRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Users,
  FileText,
  FileSpreadsheet,
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
  Plug,
  FileCheck2,
  ChevronLeft,
} from "lucide-react";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@sordi/ui";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";
import { useSidebarCounts } from "@/hooks/useSidebarCounts";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { formatCurrency } from "@/lib/i18nFormat";

const logoHorizontal = "/brand/sordi-logo.svg";

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
}

const topItem: NavItem = { icon: LayoutDashboard, labelKey: "dashboard", path: "/" };

// Tree-hierarchy groups — paths point at the sidebar-tree route aliases
// registered in App.tsx (e.g. /factures), which render the same page
// components as the canonical paths (/invoices) used by internal
// navigate()/Link calls elsewhere in the app. Kept as aliases rather than a
// full rename so nothing else in the codebase had to change.
const navGroups: NavGroup[] = [
  {
    id: "finance",
    titleKey: "groups.finance",
    items: [
      { icon: FileText, labelKey: "links.invoicing", path: "/factures" },
      { icon: CreditCard, labelKey: "links.payments", path: "/payments" },
      { icon: FileSpreadsheet, labelKey: "links.quotes", path: "/devis?tab=proformas" },
      { icon: Receipt, labelKey: "links.expenses", path: "/charges" },
      { icon: Truck, labelKey: "links.deliveries", path: "/livraisons" },
    ],
  },
  {
    id: "operations",
    titleKey: "groups.operations",
    items: [
      { icon: FolderKanban, labelKey: "links.projects", path: "/projects" },
      { icon: FileCheck2, labelKey: "links.contracts", path: "/contracts" },
      { icon: Package, labelKey: "links.catalogue", path: "/stocks" },
    ],
  },
  {
    id: "relations",
    titleKey: "groups.relations",
    items: [
      { icon: Users, labelKey: "links.clients", path: "/clients" },
      { icon: Store, labelKey: "links.suppliers", path: "/fournisseurs" },
      { icon: ClipboardList, labelKey: "links.orders", path: "/commandes" },
    ],
  },
  {
    id: "hr",
    titleKey: "groups.hr",
    items: [
      { icon: Wallet, labelKey: "links.payroll", path: "/paie" },
      { icon: UserCog, labelKey: "links.employees", path: "/employes" },
    ],
  },
  {
    id: "governance",
    titleKey: "groups.governance",
    items: [
      { icon: BarChart3, labelKey: "links.analytics", path: "/analyses" },
      { icon: PieChart, labelKey: "links.partners", path: "/associes" },
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
    { icon: Plug, labelKey: "links.integrations", path: "/integrations" },
  ],
};

// Derived, not hand-duplicated, so it can't drift from the groups above.
const allNavItems: NavItem[] = [topItem, ...navGroups.flatMap((g) => g.items), ...systemGroup.items];

const COLLAPSED_GROUPS_KEY = "sordi.sidebar.collapsedGroups";

function loadCollapsedGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY);
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
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(loadCollapsedGroups);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const { data: searchResults, isFetching: isSearchFetching, isBelowMinLength } = useGlobalSearch(searchQuery);

    const closeCommandPalette = (open: boolean) => {
      setIsCommandPaletteOpen(open);
      if (!open) setSearchQuery("");
    };

    const matchedPages = allNavItems.filter((item) =>
      t(item.labelKey).toLowerCase().includes(searchQuery.trim().toLowerCase())
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

    // Nav items normally carry a bare pathname, but "Devis" links to
    // /devis?tab=proformas — strip the query string before comparing so
    // that item still lights up as active once you're actually there.
    const isActive = (path: string) => location.pathname === path.split("?")[0];

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
              "group w-full flex items-center gap-2.5 rounded-xl py-2 text-[13px] transition-all active:scale-[0.98]",
              collapsed ? "justify-center px-0" : "px-3",
              active
                ? "bg-blue-50 text-blue-600 font-semibold shadow-xs dark:bg-sidebar-accent dark:text-sidebar-accent-foreground"
                : "text-slate-600 font-normal hover:text-slate-900 hover:bg-slate-100/70 dark:text-sidebar-foreground/75 dark:hover:text-sidebar-primary dark:hover:bg-accent-soft"
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
                <span
                  className={cn(
                    "text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full transition-all duration-200 shrink-0",
                    active
                      ? "bg-blue-600/15 text-blue-600 dark:bg-sidebar-accent-foreground/15 dark:text-sidebar-accent-foreground"
                      : item.labelKey === "links.history"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted/80 text-muted-foreground group-hover:bg-sidebar-accent group-hover:text-foreground"
                  )}
                >
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
    // no separate indented "tree" treatment for grouped items.
    const renderGroup = (group: NavGroup, iconOnly: boolean) => {
      const groupCollapsed = !iconOnly && collapsedGroups.has(group.id);
      return (
        <div key={group.id} className="mt-1">
          {!iconOnly && (
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-expanded={!groupCollapsed}
              className="w-full flex items-center gap-1.5 px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-500 dark:hover:text-neutral-300 transition-colors duration-150"
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
    const SidebarContent = ({ iconOnly = false }: { iconOnly?: boolean }) => (
      <>
        {/* Reserves clearance above the logo for the macOS traffic lights
            (see trafficLightPosition in tauri.conf.json) and makes that
            empty strip drag the window, since the titlebar itself is now
            an invisible overlay with no native drag surface of its own. */}
        <div data-tauri-drag-region className="h-9 w-full shrink-0" />

        {/* Wordmark & Version — fades/collapses away in the icon-only rail
            (same "always mounted, animate width/opacity" treatment
            renderNavItem uses) instead of hard-swapping visibility, so it
            doesn't pop instantly while the <aside> is still 300ms into its
            own width transition. */}
        <div
          className={cn(
            "flex items-center py-5 transition-all duration-300 ease-in-out",
            iconOnly ? "px-3 justify-center gap-0" : "px-6 gap-2.5"
          )}
        >
          <div
            className={cn(
              // grid-template-columns 1fr/0fr (not width/max-width) — a
              // flex item with no fixed size can't animate to/from its
              // "auto" width, it just snaps; max-width didn't animate here
              // either (browser applied it in under one frame). A grid
              // track size genuinely interpolates between two fr values.
              "grid overflow-hidden transition-[grid-template-columns,opacity] duration-300 ease-in-out",
              iconOnly ? "grid-cols-[0fr] opacity-0" : "grid-cols-[1fr] opacity-100"
            )}
          >
            <div className="flex items-center gap-2.5 overflow-hidden whitespace-nowrap min-w-0">
              <img
                src={logoHorizontal}
                alt="Sordi"
                className="h-6 w-auto object-contain dark:invert shrink-0"
              />
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 select-none dark:bg-muted dark:text-muted-foreground">
                v1.0.4
              </span>
            </div>
          </div>
        </div>

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
            <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t("groups.overview")}
            </p>
          )}
          <ul className="space-y-1">
            {renderNavItem(topItem)}
          </ul>

          {navGroups.map((group) => renderGroup(group, iconOnly))}

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
          className="fixed top-4 start-4 z-50 lg:hidden w-11 h-11 bg-card rounded-full shadow-card flex items-center justify-center transition-all hover:bg-secondary"
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

        {/* Desktop Sidebar */}
        <aside
          ref={ref}
          className={cn(
            // z-20: without an explicit z-index here, the sidebar loses to
            // later-painted siblings that create their own stacking context
            // (framer-motion's page-transition wrapper, any transformed
            // card) and the collapse/expand toggle button bleeding past
            // this element's own edge renders BEHIND them instead of on top.
            // Clean, bright translucent surface — barely-there blur over
            // the flat canvas, hairline border instead of a glowing frame.
            // Dark mode keeps the original solid surface.
            "relative z-20 shrink-0 flex-col h-screen hidden lg:flex rounded-e-2xl sticky top-0 transition-all duration-300 ease-in-out bg-white/70 backdrop-blur-xl border-e border-slate-200/50 dark:bg-sidebar dark:backdrop-blur-none dark:border-transparent",
            collapsed ? "w-16" : "w-64",
            className
          )}
        >
          {SidebarContent({ iconOnly: collapsed })}

          {onToggleCollapsed && (
            <button
              onClick={onToggleCollapsed}
              title={collapsed ? t("expandMenu") : t("collapseMenu")}
              aria-label={collapsed ? t("expandMenu") : t("collapseMenu")}
              // Vertically centered on the sidebar edge (not pinned to the
              // header row) — a fixed, predictable spot that doesn't compete
              // with the logo/wordmark above it or drift as that header's
              // content changes width. Minimal pill, seamlessly aligned with
              // the sidebar's own hairline border rather than a bold filled
              // accent button.
              className="absolute -end-3 top-1/2 -translate-y-1/2 z-30 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 active:scale-95 transition-all duration-200 dark:bg-card dark:border-border"
            >
              {/* One icon, rotated — not an icon swap — so the click reads as a hinge, not a flicker.
                  Mirrored in RTL first (the sidebar now sits on the opposite edge), then the
                  collapse rotation applies on top of that base orientation. */}
              <ChevronLeft
                className={cn(
                  "w-3.5 h-3.5 stroke-[1.75] transition-transform duration-300",
                  isRtl && "-scale-x-100",
                  collapsed && "rotate-180"
                )}
              />
            </button>
          )}
        </aside>

        {/* Mobile Sidebar */}
        <aside
          className={cn(
            "fixed top-0 start-0 w-64 flex flex-col h-screen z-50 lg:hidden transition-transform duration-300 ease-out rounded-e-2xl bg-white/70 backdrop-blur-xl border-e border-slate-200/50 dark:bg-sidebar dark:backdrop-blur-none dark:border-transparent",
            isMobileOpen ? "translate-x-0" : isRtl ? "translate-x-full" : "-translate-x-full"
          )}
        >
          {SidebarContent({})}
        </aside>

        {/* Command palette shell — search logic wired up in a future task */}
        <CommandDialog open={isCommandPaletteOpen} onOpenChange={closeCommandPalette} shouldFilter={false}>
          <CommandInput
            placeholder={t("search.commandPlaceholder")}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {matchedPages.length === 0 &&
              !isBelowMinLength &&
              !isSearchFetching &&
              (searchResults?.clients.length ?? 0) === 0 &&
              (searchResults?.invoices.length ?? 0) === 0 && (
                <CommandEmpty>{t("search.noResults", { query: searchQuery })}</CommandEmpty>
              )}

            {matchedPages.length > 0 && (
              <CommandGroup heading={t("search.pages")}>
                {matchedPages.map((item) => (
                  <CommandItem key={item.path} value={`page-${item.path}`} onSelect={() => handleSelectSearchResult(item.path)}>
                    <item.icon className="w-4 h-4 stroke-[1.75] me-2 shrink-0 opacity-70" />
                    {t(item.labelKey)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!!searchResults?.clients.length && (
              <CommandGroup heading={t("search.clients")}>
                {searchResults.clients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`client-${client.id}`}
                    onSelect={() => handleSelectSearchResult(`/clients/${client.id}`)}
                  >
                    <span className="flex-1 truncate">{client.name}</span>
                    {client.code && <span className="ms-2 text-xs text-muted-foreground shrink-0">{client.code}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!!searchResults?.invoices.length && (
              <CommandGroup heading={t("search.invoices")}>
                {searchResults.invoices.map((invoice) => (
                  <CommandItem
                    key={invoice.id}
                    value={`invoice-${invoice.id}`}
                    onSelect={() => handleSelectSearchResult(`/invoices/${invoice.id}`)}
                  >
                    <span className="font-medium shrink-0">{invoice.invoice_number}</span>
                    {invoice.client_name && <span className="flex-1 ms-2 truncate text-muted-foreground">{invoice.client_name}</span>}
                    <span className="ms-2 text-xs text-muted-foreground shrink-0 tabular-nums">
                      {formatCurrency(invoice.total_ttc, language)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {isBelowMinLength && searchQuery.length > 0 && matchedPages.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">{t("search.continueTyping")}</div>
            )}
          </CommandList>
        </CommandDialog>
      </>
    );
  }
);

Sidebar.displayName = "Sidebar";
