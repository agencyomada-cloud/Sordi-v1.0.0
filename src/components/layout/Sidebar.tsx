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
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

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
    const [expandedItems, setExpandedItems] = useState<string[]>(["Commandes", "Facturation", "Livraisons"]);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

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
        {/* Logo */}
        <div className="p-6">
          <img
            src={logoHorizontal}
            alt="Sordi"
            className="w-full h-auto object-contain max-h-16"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-hide">
          <ul className="space-y-1">
            {menuItems.map((item) => (
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
                    "w-full flex items-center gap-3 px-4 py-3 text-sm transition-all rounded-xl",
                    isActive(item.path, item.children)
                      ? "text-sidebar-primary bg-sidebar-accent"
                      : "text-sidebar-foreground/70 hover:text-sidebar-primary hover:bg-sidebar-accent/50"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {item.children && (
                    expandedItems.includes(item.label)
                      ? <RiArrowDownSLine className="w-4 h-4 opacity-40" />
                      : <RiArrowRightSLine className="w-4 h-4 opacity-40" />
                  )}
                </button>
                {item.children && expandedItems.includes(item.label) && (
                  <ul className="ml-8 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <li key={child.label}>
                        <button
                          onClick={() => handleNavigate(child.path)}
                          className={cn(
                            "w-full text-left px-4 py-2.5 text-sm transition-all rounded-xl",
                            location.pathname === child.path
                              ? "text-sidebar-primary bg-sidebar-accent"
                              : "text-sidebar-foreground/50 hover:text-sidebar-primary hover:bg-sidebar-accent/50"
                          )}
                        >
                          {child.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
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
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-sidebar-foreground/70 hover:text-destructive hover:bg-sidebar-accent/50 transition-all rounded-xl"
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
          className="fixed top-4 left-4 z-50 lg:hidden w-11 h-11 bg-card rounded-full shadow-card flex items-center justify-center transition-all hover:bg-secondary"
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
            "w-64 bg-sidebar flex-col h-screen hidden lg:flex rounded-r-3xl sticky top-0",
            className
          )}
        >
          <SidebarContent />
        </aside>

        {/* Mobile Sidebar */}
        <aside
          className={cn(
            "fixed top-0 left-0 w-64 bg-sidebar flex flex-col h-screen z-50 lg:hidden transition-transform duration-300 ease-out rounded-r-3xl",
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
