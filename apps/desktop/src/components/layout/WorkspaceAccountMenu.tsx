import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  RiBuildingLine as BuildingIcon,
  RiCheckLine as CheckIcon,
  RiArrowDownSLine as ChevronIcon,
  RiAddLine as AddIcon,
  RiSunLine as SunIcon,
  RiMoonLine as MoonIcon,
  RiSettings3Line as SettingsIcon,
  RiLogoutBoxRLine as LogoutIcon,
} from "@remixicon/react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@sordi/ui";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { CreateCompanyDialog } from "@/components/layout/CreateCompanyDialog";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

const THEME_OPTIONS: { value: "light" | "dark"; label: string; icon: React.ElementType }[] = [
  { value: "light", label: "Clair", icon: SunIcon },
  { value: "dark", label: "Sombre", icon: MoonIcon },
];

/**
 * Single header pill replacing the former pair of separate controls: the
 * "EURL OMADA A..." WorkspaceSwitcher (right side of the Header) and the
 * AccountPopover (bottom of the Sidebar). Workspace switching and account
 * identity/settings/sign-out now live behind one trigger, freeing the
 * sidebar footer entirely and giving the header one coherent "who/where am
 * I" control instead of two disconnected ones.
 */
export function WorkspaceAccountMenu() {
  const { activeCompanyId, companies, switchCompany, isReady } = useWorkspace();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  // next-themes' theme value is undefined during SSR/first paint — avoid
  // rendering a toggle that doesn't reflect the real resolved theme yet.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const activeCompany = companies.find((c) => c.id === activeCompanyId);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out failed:", err);
    } finally {
      navigate("/auth");
    }
  };

  if (!isReady) return null;

  const initial = (activeCompany?.name ?? "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-11 max-w-[240px] flex items-center gap-2 pl-1.5 pr-2.5 rounded-full bg-white/80 dark:bg-card/80 border border-slate-200/80 dark:border-border/60 shadow-xs hover:bg-slate-50 dark:hover:bg-secondary transition-all duration-200">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
              {initial}
            </span>
            <span className="min-w-0 flex flex-col items-start leading-tight py-0.5">
              <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
                {activeCompany?.name ?? "Sélectionner"}
              </span>
              <span className="text-[10.5px] text-muted-foreground truncate max-w-[140px]">
                {user?.email || "Compte"}
              </span>
            </span>
            <ChevronIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 rounded-2xl p-1.5">
          {user && (
            <div className="flex items-center gap-2 px-2.5 py-2">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
            </div>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <BuildingIcon className="w-3.5 h-3.5" />
            Entreprises
          </DropdownMenuLabel>
          {companies.map((company) => (
            <DropdownMenuItem
              key={company.id}
              onClick={() => switchCompany(company.id)}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 cursor-pointer"
            >
              <span className="flex-1 min-w-0 truncate text-sm">{company.name}</span>
              {company.id === activeCompanyId && (
                <CheckIcon className="w-4 h-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onClick={() => setCreateDialogOpen(true)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 cursor-pointer text-primary"
          >
            <span className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <AddIcon className="w-3.5 h-3.5" />
            </span>
            <span className="text-sm font-medium">Créer une nouvelle entreprise</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <LanguageSwitcher />
            <div role="group" className="flex items-center rounded-full border border-border bg-secondary/50 p-0.5">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = mounted && theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    aria-pressed={active}
                    title={option.label}
                    className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-full transition-all duration-150",
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => navigate("/settings")} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer">
            <SettingsIcon className="w-3.5 h-3.5 text-muted-foreground" />
            Paramètres
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleLogout}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-500/10"
          >
            <LogoutIcon className="w-3.5 h-3.5" />
            Déconnexion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateCompanyDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </>
  );
}
