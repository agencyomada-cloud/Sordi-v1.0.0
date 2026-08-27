import { useState, useEffect, forwardRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  RiDashboardLine,
  RiGroupLine,
  RiFileTextLine,
  RiFileList2Line,
  RiTruckLine,
  RiStore2Line,
  RiBankCardLine,
  RiBox3Line,
  RiArrowDownSLine,
  RiSearchLine,
  RiReceiptLine,
  RiFileList3Line,
  RiMenuLine,
  RiCloseLine,
  RiSettings3Line,
  RiHistoryLine,
  RiBarChartBoxLine,
  RiFolderChartLine,
  RiWalletLine,
  RiPieChartLine,
  RiUserSettingsLine,
  RiPlugLine,
  RiFileShield2Line,
  RiArrowLeftSLine as ChevronLeft,
} from "@remixicon/react";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@sordi/ui";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";
import { AccountPopover } from "@/components/layout/AccountPopover";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { useSidebarCounts } from "@/hooks/useSidebarCounts";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { formatCurrency } from "@/lib/i18nFormat";

const logoIcon = "/brand/sordi-icon.svg";
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

const topItem: NavItem = { icon: RiDashboardLine, labelKey: "dashboard", path: "/" };

// Tree-hierarchy groups — paths point at the sidebar-tree route aliases
// registered in App.tsx (e.g. /factures), which render the same page
// components as the canonical paths (/invoices) used by internal
// navigate()/Link calls elsewhere in the app. Kept as aliases rather than a
// full rename so nothing else in the codebase had to change.
const navGroups: NavGroup[] = [
  {
    id: "sales",
    titleKey: "groups.sales",
    items: [
      { icon: RiFileTextLine, labelKey: "links.invoicing", path: "/factures" },
      { icon: RiFileList2Line, labelKey: "links.quotes", path: "/devis?tab=proformas" },
      { icon: RiTruckLine, labelKey: "links.deliveries", path: "/livraisons" },
      { icon: RiFileShield2Line, labelKey: "links.contracts", path: "/contracts" },
      { icon: RiGroupLine, labelKey: "links.clients", path: "/clients" },
    ],
  },
  {
    id: "purchasing",
    titleKey: "groups.purchasing",
    items: [
      { icon: RiReceiptLine, labelKey: "links.expenses", path: "/charges" },
      { icon: RiStore2Line, labelKey: "links.suppliers", path: "/fournisseurs" },
      { icon: RiFileList3Line, labelKey: "links.orders", path: "/commandes" },
    ],
  },
  {
    id: "operations",
    titleKey: "groups.operations",
    items: [
      { icon: RiFolderChartLine, labelKey: "links.projects", path: "/projects" },
      { icon: RiWalletLine, labelKey: "links.payroll", path: "/paie" },
      { icon: RiBox3Line, labelKey: "links.catalogue", path: "/stocks" },
    ],
  },
  // Payments has no dedicated slot in the new spec'd tree — kept in
  // Pilotage & RH rather than dropped, so it doesn't lose its sidebar entry.
  {
    id: "pilotage",
    titleKey: "groups.pilotage",
    items: [
      { icon: RiBankCardLine, labelKey: "links.payments", path: "/payments" },
      { icon: RiBarChartBoxLine, labelKey: "links.analytics", path: "/analyses" },
      { icon: RiUserSettingsLine, labelKey: "links.employees", path: "/employes" },
      { icon: RiPieChartLine, labelKey: "links.partners", path: "/associes" },
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
    { icon: RiSettings3Line, labelKey: "links.settings", path: "/settings" },
    { icon: RiHistoryLine, labelKey: "links.history", path: "/historique" },
    { icon: RiPlugLine, labelKey: "links.integrations", path: "/integrations" },
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
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
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
              "group w-full flex items-center py-3 text-sm transition-all duration-200 rounded-xl active:scale-[0.98]",
              // gap-3 must itself be conditional — a flex `gap` still reserves
              // space between the icon and the label span even while that
              // span is animated down to w-0, which is what was nudging the
              // icon off-center in the collapsed circle.
              collapsed ? "justify-center px-0 gap-0" : "px-4 gap-3",
              active
                ? cn(
                    // Soft accent-tint pill (Crimson/Coral Red rebrand spec:
                    // bg-[#FDF1F2] text-[#EB3B48] — same tokens as
                    // sidebar-accent/sidebar-accent-foreground) instead of a
                    // solid full-saturation fill, so the active item reads
                    // as a gentle highlight rather than a loud block.
                    "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
                    !collapsed && (isRtl ? "-translate-x-1" : "translate-x-1")
                  )
                : cn(
                    "text-sidebar-foreground/60 hover:text-sidebar-primary hover:bg-sidebar-accent/60",
                    !collapsed && (isRtl ? "hover:-translate-x-1" : "hover:translate-x-1")
                  )
            )}
          >
            <item.icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110 shrink-0" />
            {/* Always mounted (not conditionally rendered) so the collapse
                itself animates — width/opacity fade, not an instant pop. */}
            <span
              className={cn(
                "flex items-center gap-2 overflow-hidden transition-all duration-200 ease-in-out",
                collapsed ? "w-0 opacity-0" : "flex-1 opacity-100"
              )}
            >
              <span className="flex-1 text-start font-medium truncate whitespace-nowrap">{label}</span>
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    "text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full transition-all duration-200 shrink-0",
                    active
                      ? "bg-sidebar-accent-foreground/15 text-sidebar-accent-foreground"
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

    // Sub-items inside a collapsible group render with the tree-hierarchy
    // treatment (indent + left guide line on the group's <ul>) instead of
    // renderNavItem's pill style — used only inside navGroups/systemGroup,
    // never for topItem. Active state is a flat, symmetrical rounded pill —
    // deliberately no left border/edge accent of its own (that artifact,
    // stacked on top of the group's already-present guide line, read as a
    // stray red tail rather than a clean highlight).
    const renderSubNavItem = (item: NavItem) => {
      const label = t(item.labelKey);
      const count = getBadgeCount(item.labelKey);
      const active = isActive(item.path);
      return (
        <li key={item.path}>
          <button
            onClick={() => handleNavigate(item.path)}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition-colors",
              active
                ? "bg-[#FDF1F2] dark:bg-[#EB3B48]/10 text-[#EB3B48] font-semibold"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50"
            )}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-start truncate">{label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  "text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full shrink-0",
                  active ? "bg-[#EB3B48]/15 text-[#EB3B48]" : "bg-muted/80 text-muted-foreground"
                )}
              >
                {count}
              </span>
            )}
          </button>
        </li>
      );
    };

    // One collapsible group's header + items — shared between the scrollable
    // navGroups list and the pinned systemGroup footer, so both stay
    // pixel-identical instead of two hand-duplicated render blocks.
    const renderGroup = (group: NavGroup, iconOnly: boolean) => {
      const groupCollapsed = !iconOnly && collapsedGroups.has(group.id);
      return (
        <div key={group.id} className="mt-2">
          {!iconOnly && (
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-expanded={!groupCollapsed}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors duration-150"
            >
              <span className="flex-1 text-start">{t(group.titleKey)}</span>
              <RiArrowDownSLine
                className={cn(
                  "w-3.5 h-3.5 opacity-70 transition-transform duration-200",
                  groupCollapsed && "-rotate-90"
                )}
              />
            </button>
          )}
          {!groupCollapsed && (
            iconOnly ? (
              <ul className="space-y-1 animate-fade-in duration-200">
                {group.items.map((item) => renderNavItem(item))}
              </ul>
            ) : (
              // Tree guide line — indented sub-items hang off a left border
              // so an open group visually reads as a branch of its header,
              // per the tree-hierarchy spec.
              <ul className="space-y-1 animate-fade-in duration-200 ms-3 ps-3 border-s border-neutral-200 dark:border-neutral-800">
                {group.items.map((item) => renderSubNavItem(item))}
              </ul>
            )
          )}
        </div>
      );
    };

    const SidebarContent = ({ iconOnly = false }: { iconOnly?: boolean }) => (
      <>
        {/* Reserves clearance above the logo for the macOS traffic lights
            (see trafficLightPosition in tauri.conf.json) and makes that
            empty strip drag the window, since the titlebar itself is now
            an invisible overlay with no native drag surface of its own. */}
        <div data-tauri-drag-region className="h-9 w-full shrink-0" />

        {/* Logo & Version */}
        <div className={cn("py-5", iconOnly ? "px-3 flex justify-center" : "px-6")}>
          {iconOnly ? (
            <img src={logoIcon} alt="Sordi" title="Sordi" className="h-6 w-6 rounded-lg" />
          ) : (
            <div className="flex items-center gap-2.5">
              <img
                src={logoHorizontal}
                alt="Sordi"
                className="h-6 w-auto object-contain dark:invert"
              />
              <span className="text-[11px] font-semibold text-muted-foreground/60 select-none tracking-tight">
                v1.0.3
              </span>
            </div>
          )}
        </div>

        {/* Company / workspace switcher */}
        <WorkspaceSwitcher iconOnly={iconOnly} />

        {/* Search / command palette trigger */}
        <div className="px-3 pb-3 pt-2">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            title={iconOnly ? t("search.shortcutHint") : undefined}
            className={cn(
              "w-full flex items-center gap-2 py-2.5 text-sm rounded-xl border border-sidebar-border bg-sidebar-foreground/[0.03] text-sidebar-foreground/45 hover:bg-sidebar-accent/60 hover:border-sidebar-primary/35 hover:text-sidebar-foreground/60 transition-all duration-150",
              iconOnly ? "justify-center px-0" : "px-3"
            )}
          >
            <RiSearchLine className="w-[15px] h-[15px] shrink-0" />
            {!iconOnly && (
              <>
                <span className="flex-1 text-start font-medium">{t("search.placeholder")}</span>
                <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full bg-sidebar-foreground/10 text-sidebar-foreground/50">
                  ⌘K
                </span>
              </>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pb-4 overflow-y-auto scrollbar-hide flex flex-col">
          {/* "Vue d'ensemble" — a single-item group (just the dashboard), so
              it gets a plain label instead of the collapsible group header
              the multi-item groups below use (nothing to collapse). */}
          {!iconOnly && (
            <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              {t("groups.overview")}
            </p>
          )}
          <ul className="space-y-1">
            {renderNavItem(topItem)}
          </ul>

          {navGroups.map((group) => renderGroup(group, iconOnly))}

          {/* Système — pinned below all scrollable groups, never collapses
              out of view, directly above the profile card. */}
          <div className="mt-auto pt-3 border-t border-sidebar-border/60">
            {renderGroup(systemGroup, iconOnly)}
          </div>
        </nav>

        {/* Account — a single card opening a popover with language, theme,
            settings and logout, instead of the email/logout footer rows. */}
        <div className="p-4 border-t border-sidebar-border/50">
          <AccountPopover iconOnly={iconOnly} />
        </div>
      </>
    );

    return (
      <>
        {/* Mobile Toggle Button */}
        <button
          className="fixed top-4 start-4 z-50 lg:hidden w-11 h-11 bg-card rounded-full shadow-card flex items-center justify-center transition-all hover:bg-secondary"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
        >
          {isMobileOpen ? <RiCloseLine className="w-5 h-5" /> : <RiMenuLine className="w-5 h-5" />}
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
            "relative shrink-0 bg-sidebar flex-col h-screen hidden lg:flex rounded-e-2xl sticky top-0 transition-all duration-300 ease-in-out",
            collapsed ? "w-16" : "w-64",
            className
          )}
        >
          <SidebarContent iconOnly={collapsed} />

          {onToggleCollapsed && (
            <button
              onClick={onToggleCollapsed}
              title={collapsed ? t("expandMenu") : t("collapseMenu")}
              className="absolute -end-3 top-[3.75rem] z-30 w-6 h-6 rounded-full bg-card border border-border shadow-card flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-all duration-200"
            >
              {/* One icon, rotated — not an icon swap — so the click reads as a hinge, not a flicker.
                  Mirrored in RTL first (the sidebar now sits on the opposite edge), then the
                  collapse rotation applies on top of that base orientation. */}
              <ChevronLeft
                className={cn(
                  "w-3.5 h-3.5 transition-transform duration-300",
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
            "fixed top-0 start-0 w-64 bg-sidebar flex flex-col h-screen z-50 lg:hidden transition-transform duration-300 ease-out rounded-e-2xl",
            isMobileOpen ? "translate-x-0" : isRtl ? "translate-x-full" : "-translate-x-full"
          )}
        >
          <SidebarContent />
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
                    <item.icon className="w-4 h-4 me-2 shrink-0 opacity-70" />
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
