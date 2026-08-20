import { useState, useEffect, forwardRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  RiDashboardLine,
  RiGroupLine,
  RiFileTextLine,
  RiTruckLine,
  RiBankCardLine,
  RiBox3Line,
  RiArrowDownSLine,
  RiSearchLine,
  RiReceiptLine,
  RiLogoutBoxRLine,
  RiFileList3Line,
  RiMenuLine,
  RiCloseLine,
  RiSettings3Line,
  RiHistoryLine,
  RiBarChartBoxLine,
  RiVipCrownLine,
  RiQuestionLine,
} from "@remixicon/react";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, Button } from "@sordi/ui";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarCounts } from "@/hooks/useSidebarCounts";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { useLicenseStatus } from "@/hooks/useLicense";

const logoHorizontal = "/brand/logo-horizontal.svg";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

const topItem: NavItem = { icon: RiDashboardLine, label: "Tableau de bord", path: "/" };

const navGroups: NavGroup[] = [
  {
    id: "transactions",
    title: "Transactions",
    items: [
      { icon: RiFileTextLine, label: "Facturation", path: "/invoices" },
      { icon: RiBankCardLine, label: "Paiements", path: "/payments" },
      { icon: RiFileList3Line, label: "Commandes", path: "/orders" },
      { icon: RiTruckLine, label: "Livraisons", path: "/deliveries" },
    ],
  },
  {
    id: "gestion",
    title: "Gestion",
    items: [
      { icon: RiGroupLine, label: "Clients", path: "/clients" },
      { icon: RiBox3Line, label: "Produits", path: "/products" },
      { icon: RiReceiptLine, label: "Charges", path: "/expenses" },
    ],
  },
  {
    id: "pilotage",
    title: "Pilotage",
    items: [
      { icon: RiBarChartBoxLine, label: "Analyses", path: "/analyses" },
      { icon: RiHistoryLine, label: "Historique", path: "/history" },
    ],
  },
];

const pinnedItem: NavItem = { icon: RiSettings3Line, label: "Paramètres", path: "/settings" };

// Derived, not hand-duplicated, so it can't drift from the groups above.
const allNavItems: NavItem[] = [topItem, ...navGroups.flatMap((g) => g.items), pinnedItem];

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
}

export const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(
  function Sidebar({ className }, ref) {
    const navigate = useNavigate();
    const location = useLocation();
    const { signOut, user } = useAuth();
    const { data: licenseStatus } = useLicenseStatus();
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
      item.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
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

    const getBadgeCount = (label: string): number | undefined => {
      switch (label) {
        case "Commandes":
          return counts.orders;
        case "Facturation":
          return counts.invoices;
        case "Livraisons":
          return counts.deliveries;
        case "Historique":
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

    const isActive = (path: string) => location.pathname === path;

    const daysRemaining = (() => {
      if (!licenseStatus?.expires_at) return null;
      const diffMs = new Date(licenseStatus.expires_at).getTime() - Date.now();
      return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    })();

    const handleLogout = async () => {
      await signOut();
      navigate('/auth');
    };

    const handleNavigate = (path: string) => {
      navigate(path);
      setIsMobileOpen(false);
    };

    const handleSelectSearchResult = (path: string) => {
      handleNavigate(path);
      closeCommandPalette(false);
    };

    const renderNavItem = (item: NavItem) => {
      const count = getBadgeCount(item.label);
      const active = isActive(item.path);
      return (
        <li key={item.label}>
          <button
            onClick={() => handleNavigate(item.path)}
            className={cn(
              "group w-full flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 rounded-[6px] active:scale-[0.98]",
              active
                ? "text-sidebar-primary bg-sidebar-accent shadow-sm font-semibold translate-x-1"
                : "text-sidebar-foreground/70 hover:text-sidebar-primary hover:bg-sidebar-accent/50 hover:translate-x-1"
            )}
          >
            <item.icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110 shrink-0" />
            <span className="flex-1 text-left font-medium truncate">{item.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  "text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-[4px] transition-all duration-200 shrink-0",
                  active
                    ? "bg-primary text-primary-foreground"
                    : item.label === "Historique"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted/80 text-muted-foreground group-hover:bg-sidebar-accent group-hover:text-foreground"
                )}
              >
                {count}
              </span>
            )}
          </button>
        </li>
      );
    };

    const SidebarContent = () => (
      <>
        {/* Logo & Version */}
        <div className="px-6 py-5 flex items-center gap-2.5">
          <img
            src={logoHorizontal}
            alt="Sordi"
            className="h-8 w-auto object-contain"
          />
          <span className="text-[11px] font-semibold text-muted-foreground/60 select-none tracking-tight">
            v1.0.0
          </span>
        </div>

        {/* Search / command palette trigger */}
        <div className="px-3 pb-3">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-[6px] border border-sidebar-border bg-sidebar-foreground/[0.03] text-sidebar-foreground/45 hover:bg-sidebar-accent/60 hover:border-sidebar-primary/35 hover:text-sidebar-foreground/60 transition-all duration-150"
          >
            <RiSearchLine className="w-[15px] h-[15px] shrink-0" />
            <span className="flex-1 text-left font-medium">Rechercher…</span>
            <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-[4px] bg-sidebar-foreground/10 text-sidebar-foreground/50">
              ⌘K
            </span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pb-4 overflow-y-auto scrollbar-hide flex flex-col">
          <ul className="space-y-1">
            {renderNavItem(topItem)}
          </ul>

          {navGroups.map((group) => {
            const collapsed = collapsedGroups.has(group.id);
            return (
              <div key={group.id} className="mt-2">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={!collapsed}
                  className="w-full flex items-center gap-1.5 px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors duration-150"
                >
                  <span className="flex-1 text-left">{group.title}</span>
                  <RiArrowDownSLine
                    className={cn(
                      "w-3.5 h-3.5 opacity-70 transition-transform duration-200",
                      collapsed && "-rotate-90"
                    )}
                  />
                </button>
                {!collapsed && (
                  <ul className="space-y-1 animate-fade-in duration-200">
                    {group.items.map((item) => renderNavItem(item))}
                  </ul>
                )}
              </div>
            );
          })}

          {/* Paramètres — pinned below all groups, never collapses */}
          <div className="mt-auto pt-3 border-t border-sidebar-border/60">
            <ul className="space-y-1">
              {renderNavItem(pinnedItem)}
            </ul>
          </div>
        </nav>

        {/* License status card — deliberately distinct from nav items (tinted card, not a list row) so it doesn't read as a navigation destination */}
        {licenseStatus && (
          <div className="px-3 pb-3">
            {licenseStatus.state === "active" ? (
              <div className="flex items-center gap-3 px-3.5 py-3 rounded-[10px] bg-primary/[0.07] border border-primary/15">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <RiVipCrownLine className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-sidebar-foreground truncate">Sordi Pro</p>
                  <p className="text-[11px] text-sidebar-foreground/55 truncate">
                    {daysRemaining !== null
                      ? `Expire dans ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""}`
                      : "Licence active"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-[10px] bg-gradient-to-br from-primary/10 to-primary/[0.03] border border-primary/20 p-3.5 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <RiVipCrownLine className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-sidebar-foreground leading-tight">Passez à Sordi Pro</p>
                    <p className="text-[11px] text-sidebar-foreground/55 leading-tight">Débloquez toutes les fonctionnalités</p>
                  </div>
                </div>
                <Button size="sm" className="w-full shadow-sm" onClick={() => handleNavigate("/upgrade")}>
                  Passer à Pro
                </Button>
              </div>
            )}
          </div>
        )}

        {/* User & Logout */}
        <div className="p-4 border-t border-sidebar-border/50">
          {/* Centre d'aide — mailto placeholder until a real help page exists */}
          <a
            href="mailto:contact@sordi.app"
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-sidebar-foreground/70 hover:text-sidebar-primary hover:bg-sidebar-accent/50 transition-all rounded-[6px]"
          >
            <RiQuestionLine className="w-5 h-5" />
            <span className="font-medium">Centre d'aide</span>
          </a>
          {user && (
            <div className="px-4 py-2 text-xs text-sidebar-foreground/40 truncate">
              {user.email}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-sidebar-foreground/70 hover:text-destructive hover:bg-sidebar-accent/50 transition-all rounded-[6px]"
          >
            <RiLogoutBoxRLine className="w-5 h-5" />
            <span className="font-medium">Déconnexion</span>
          </button>
        </div>
      </>
    );

    return (
      <>
        {/* Mobile Toggle Button */}
        <button
          className="fixed top-4 left-4 z-50 lg:hidden w-11 h-11 bg-card rounded-[6px] shadow-card flex items-center justify-center transition-all hover:bg-secondary"
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
            "w-64 shrink-0 bg-sidebar flex-col h-screen hidden lg:flex rounded-r-[6px] sticky top-0",
            className
          )}
        >
          <SidebarContent />
        </aside>

        {/* Mobile Sidebar */}
        <aside
          className={cn(
            "fixed top-0 left-0 w-64 bg-sidebar flex flex-col h-screen z-50 lg:hidden transition-transform duration-300 ease-out rounded-r-[6px]",
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContent />
        </aside>

        {/* Command palette shell — search logic wired up in a future task */}
        <CommandDialog open={isCommandPaletteOpen} onOpenChange={closeCommandPalette} shouldFilter={false}>
          <CommandInput
            placeholder="Rechercher une page, un client, une facture…"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {matchedPages.length === 0 &&
              !isBelowMinLength &&
              !isSearchFetching &&
              (searchResults?.clients.length ?? 0) === 0 &&
              (searchResults?.invoices.length ?? 0) === 0 && (
                <CommandEmpty>Aucun résultat pour « {searchQuery} ».</CommandEmpty>
              )}

            {matchedPages.length > 0 && (
              <CommandGroup heading="Pages">
                {matchedPages.map((item) => (
                  <CommandItem key={item.path} value={`page-${item.path}`} onSelect={() => handleSelectSearchResult(item.path)}>
                    <item.icon className="w-4 h-4 mr-2 shrink-0 opacity-70" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!!searchResults?.clients.length && (
              <CommandGroup heading="Clients">
                {searchResults.clients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`client-${client.id}`}
                    onSelect={() => handleSelectSearchResult(`/clients/${client.id}`)}
                  >
                    <span className="flex-1 truncate">{client.name}</span>
                    {client.code && <span className="ml-2 text-xs text-muted-foreground shrink-0">{client.code}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!!searchResults?.invoices.length && (
              <CommandGroup heading="Factures">
                {searchResults.invoices.map((invoice) => (
                  <CommandItem
                    key={invoice.id}
                    value={`invoice-${invoice.id}`}
                    onSelect={() => handleSelectSearchResult(`/invoices/${invoice.id}`)}
                  >
                    <span className="font-medium shrink-0">{invoice.invoice_number}</span>
                    {invoice.client_name && <span className="flex-1 ml-2 truncate text-muted-foreground">{invoice.client_name}</span>}
                    <span className="ml-2 text-xs text-muted-foreground shrink-0 tabular-nums">
                      {invoice.total_ttc.toLocaleString("fr-DZ", { maximumFractionDigits: 0 })} DA
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {isBelowMinLength && searchQuery.length > 0 && matchedPages.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">Continuez à taper pour rechercher…</div>
            )}
          </CommandList>
        </CommandDialog>
      </>
    );
  }
);

Sidebar.displayName = "Sidebar";
