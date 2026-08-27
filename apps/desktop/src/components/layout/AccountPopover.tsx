import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  RiSunLine as SunIcon,
  RiMoonLine as MoonIcon,
  RiSettings3Line as SettingsIcon,
  RiLogoutBoxRLine as LogoutIcon,
  RiUserLine as UserIcon,
  RiArrowDownSLine as ChevronIcon,
} from "@remixicon/react";
import { Popover, PopoverTrigger, PopoverContent } from "@sordi/ui";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

const THEME_OPTIONS: { value: "light" | "dark"; label: string; icon: React.ElementType }[] = [
  { value: "light", label: "Clair", icon: SunIcon },
  { value: "dark", label: "Sombre", icon: MoonIcon },
];

interface AccountPopoverProps {
  /** Icon-only rail mode — just the avatar circle, no email/chevron. */
  iconOnly?: boolean;
}

/**
 * The single "Account Card" the sidebar footer collapses down to — user
 * identity, language, theme, and settings/logout all live behind one
 * trigger instead of being scattered across separate footer rows.
 */
export function AccountPopover({ iconOnly = false }: AccountPopoverProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  // next-themes' theme value is undefined during SSR/first paint — avoid
  // rendering a toggle that doesn't reflect the real resolved theme yet.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-2.5 py-2.5 rounded-xl hover:bg-sidebar-accent/50 transition-all text-left",
            iconOnly ? "justify-center px-0" : "px-3"
          )}
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground shrink-0">
            <UserIcon className="w-4 h-4" />
          </span>
          {!iconOnly && (
            <>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground">
                {user?.email || "Compte"}
              </span>
              <ChevronIcon className={cn("w-3.5 h-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-200", open && "rotate-180")} />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-56 rounded-2xl border border-neutral-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-md dark:border-neutral-800/80 dark:bg-[#15161A]/95"
      >
        {user && (
          <div className="flex items-center gap-2 px-2 py-2 mb-1 border-b border-border/50">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 px-1 py-1.5">
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
                    active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-1 pt-1 border-t border-border/50">
          <button
            onClick={() => { setOpen(false); navigate("/settings"); }}
            className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-muted-foreground" />
            Paramètres
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
          >
            <LogoutIcon className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
