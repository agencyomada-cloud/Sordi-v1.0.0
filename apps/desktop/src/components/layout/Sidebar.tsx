import { useState, forwardRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  RiDashboardLine,
  RiGroupLine,
  RiFileTextLine,
  RiTruckLine,
  RiBankCardLine,
  RiBox3Line,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiReceiptLine,
  RiLogoutBoxRLine,
  RiFileList3Line,
  RiMenuLine,
  RiCloseLine,
  RiSettings3Line,
  RiHistoryLine,
  RiBarChartBoxLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarCounts } from "@/hooks/useSidebarCounts";

const logoHorizontal = "/brand/logo-horizontal.svg";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path?: string;
  children?: { label: string; path: string }[];
}

const menuItems: NavItem[] = [
  { icon: RiDashboardLine, label: "Tableau de bord", path: "/" },
  { icon: RiGroupLine, label: "Clients", path: "/clients" },
  { icon: RiFileList3Line, label: "Commandes", path: "/orders" },
  { icon: RiFileTextLine, label: "Facturation", path: "/invoices" },
  { icon: RiTruckLine, label: "Livraisons", path: "/deliveries" },
  { icon: RiBankCardLine, label: "Paiements", path: "/payments" },
  { icon: RiReceiptLine, label: "Charges", path: "/expenses" },
  { icon: RiBox3Line, label: "Produits", path: "/products" },

  { icon: RiBarChartBoxLine, label: "Analyses", path: "/analyses" },
  { icon: RiSettings3Line, label: "Paramètres", path: "/settings" },
  { icon: RiHistoryLine, label: "Historique", path: "/history" },
];

interface SidebarProps {
  className?: string;
}

export const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(
  function Sidebar({ className }, ref) {
    const navigate = useNavigate();
    const location = useLocation();
    const { signOut, user } = useAuth();
    const counts = useSidebarCounts();
    const [expandedItems, setExpandedItems] = useState<string[]>(["Commandes", "Facturation", "Livraisons"]);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

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

    const toggleExpand = (label: string) => {
      setExpandedItems(prev =>
        prev.includes(label)
          ? prev.filter(item => item !== label)
          : [...prev, label]
      );
    };

    const isActive = (path?: string, children?: { path: string }[]) => {
      if (path) return location.pathname === path;
      return children?.some(c => location.pathname === c.path);
    };

    const handleLogout = async () => {
      await signOut();
      navigate('/auth');
    };

    const handleNavigate = (path: string) => {
      navigate(path);
      setIsMobileOpen(false);
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

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-hide">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const count = getBadgeCount(item.label);
              return (
                <li key={item.label}>
                  <button
                    onClick={() => {
                      if (item.path) {
                        handleNavigate(item.path);
                      } else if (item.children) {
                        toggleExpand(item.label);
                      }
                    }}
                    className={cn(
                      "group w-full flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 rounded-[6px] active:scale-[0.98]",
                      isActive(item.path, item.children)
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
                          isActive(item.path, item.children)
                            ? "bg-primary text-primary-foreground"
                            : item.label === "Historique"
                              ? "bg-primary/15 text-primary"
                              : "bg-muted/80 text-muted-foreground group-hover:bg-sidebar-accent group-hover:text-foreground"
                        )}
                      >
                        {count}
                      </span>
                    )}
                    {item.children && (
                      <span className="transition-transform duration-200 shrink-0">
                        {expandedItems.includes(item.label)
                          ? <RiArrowDownSLine className="w-4 h-4 opacity-50" />
                          : <RiArrowRightSLine className="w-4 h-4 opacity-50" />}
                      </span>
                    )}
                  </button>
                  {item.children && expandedItems.includes(item.label) && (
                    <ul className="ml-8 mt-1 space-y-1 animate-fade-in duration-200">
                      {item.children.map((child) => (
                        <li key={child.label}>
                          <button
                            onClick={() => handleNavigate(child.path)}
                            className={cn(
                              "w-full text-left px-4 py-2.5 text-sm transition-all duration-200 rounded-[6px] active:scale-[0.98]",
                              location.pathname === child.path
                                ? "text-sidebar-primary bg-sidebar-accent font-semibold translate-x-1"
                                : "text-sidebar-foreground/50 hover:text-sidebar-primary hover:bg-sidebar-accent/50 hover:translate-x-0.5"
                            )}
                          >
                            {child.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User & Logout */}
        <div className="p-4 border-t border-sidebar-border/50">
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
      </>
    );
  }
);

Sidebar.displayName = "Sidebar";
