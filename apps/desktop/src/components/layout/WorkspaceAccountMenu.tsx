import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  RiCheckLine as CheckIcon,
  RiArrowDownSLine as ChevronIcon,
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
          {/* Understated trigger — a small neutral initial chip, not an
              oversized bright-blue avatar badge on a full pill-height button. */}
          <button className="h-7 max-w-[200px] flex items-center gap-1.5 pl-1 pr-2 rounded-md border border-border/60 bg-transparent hover:bg-muted/60 transition-colors duration-150">
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-muted text-foreground text-[10px] font-semibold shrink-0">
              {initial}
            </span>
            <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
              {activeCompany?.name ?? "Sélectionner"}
            </span>
            <ChevronIcon className="w-3 h-3 shrink-0 text-muted-foreground/60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-popover/95 border border-border/80 rounded-md p-1 shadow-xl backdrop-blur-md select-none text-xs">
          {/* Account/workspace identity — the active company, not the raw
              session email, is the headline: this menu is primarily a
              workspace switcher, so it should read as "where am I" first. */}
          <div className="px-2.5 py-1.5 border-b border-border/50 mb-1">
            <p className="font-semibold text-foreground text-xs truncate">
              {activeCompany?.name ?? "Sélectionner"}
            </p>
            {user && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                <span className="truncate">{user.email}</span>
              </p>
            )}
          </div>

          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-2.5 py-1">
            Entreprises
          </DropdownMenuLabel>
          {companies.map((company) => (
            <DropdownMenuItem
              key={company.id}
              onClick={() => switchCompany(company.id)}
              className="h-7 px-2.5 rounded text-xs flex items-center justify-between hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
            >
              <span className="flex-1 min-w-0 truncate">{company.name}</span>
              {company.id === activeCompanyId && (
                <CheckIcon className="size-3.5 text-foreground shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onClick={() => setCreateDialogOpen(true)}
            className="h-7 px-2.5 rounded text-xs flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            + Nouvelle entreprise...
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Compact utility strip — language and theme unified into one
              segmented-control track instead of two separately-styled
              plain-text/icon rows, so both read as the same kind of
              control. */}
          <div className="px-2 py-1.5 border-t border-border/50">
            <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-md border border-border/50 w-fit">
              <LanguageSwitcher />
              <div className="w-px h-4 bg-border/60 mx-0.5" aria-hidden="true" />
              <div className="flex items-center gap-0.5">
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
                        "flex items-center justify-center h-6 w-6 rounded transition-colors duration-150 border",
                        active
                          ? "bg-card dark:bg-white/[0.08] text-foreground shadow-sm border-border dark:border-white/[0.1]"
                          : "text-muted-foreground hover:text-foreground border-transparent"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => navigate("/settings")} className="h-7 px-2.5 rounded hover:bg-accent hover:text-accent-foreground flex items-center justify-between cursor-pointer">
            <span className="flex items-center gap-2">
              <SettingsIcon className="w-3.5 h-3.5 text-muted-foreground" />
              Paramètres
            </span>
            <span className="text-[10px] text-muted-foreground/70 font-mono">⌘,</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleLogout}
            className="h-7 px-2.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center gap-2 cursor-pointer"
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
