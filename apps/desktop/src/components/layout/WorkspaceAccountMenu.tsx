import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  RiArrowDownSLine as ChevronIcon,
  RiSunLine as SunIcon,
  RiMoonLine as MoonIcon,
  RiSettings3Line as SettingsIcon,
  RiLogoutBoxRLine as LogoutIcon,
  RiWhatsappLine as WhatsAppIcon,
  RiKeyLine as KeyIcon,
  RiFileCopyLine as CopyIcon,
  RiCheckLine as CheckIcon,
} from "@remixicon/react";
import { Pencil } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
  Tooltip, TooltipTrigger, TooltipContent,
} from "@sordi/ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyAvatarSeed } from "@/hooks/useCompanyAvatarSeed";
import { useLicenseDecision, buildWhatsAppSupportUrl, useMachineId } from "@/services/licensing";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ActivationModal } from "@/components/licensing/ActivationModal";
import { AvatarGeneratorDialog } from "@/components/layout/AvatarGeneratorDialog";
import { CompanyAvatar } from "@/components/layout/CompanyAvatar";

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
  const { activeCompanyId, companies, isReady } = useWorkspace();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { state: licenseState, daysRemaining, expiresAt } = useLicenseDecision();
  const { data: machineId } = useMachineId();
  const [machineIdCopied, setMachineIdCopied] = useState(false);
  const [activationOpen, setActivationOpen] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  // Controlled (not left uncontrolled) specifically so opening the avatar
  // generator can close the dropdown itself first — otherwise the Dialog
  // opens layered on top of a still-open DropdownMenuContent.
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarSeed, setAvatarSeed] = useCompanyAvatarSeed(activeCompanyId);
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

  const handleCopyMachineId = () => {
    if (!machineId) return;
    navigator.clipboard.writeText(machineId).then(() => {
      setMachineIdCopied(true);
      toast.success("Identifiant machine copié");
      window.setTimeout(() => setMachineIdCopied(false), 1500);
    });
  };

  if (!isReady) return null;

  const isPro = licenseState === "PAID_ACTIVE";
  const expiryFormatted = expiresAt
    ? new Date(expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // Subscription summary shown in the new "Abonnement" section — a single
  // small lookup rather than scattering this if/else across the JSX below.
  const subscription = (() => {
    switch (licenseState) {
      case "PAID_ACTIVE":
        return { dot: "bg-emerald-500", label: "Licence Active", formula: "Sordi Pro — Annuel" };
      case "TRIAL_ACTIVE":
        return { dot: "bg-amber-500", label: "Période d'essai", formula: "Essai 14 jours" };
      case "PAID_EXPIRED":
        return { dot: "bg-rose-500", label: "Licence expirée", formula: "Sordi Pro" };
      case "TRIAL_EXPIRED":
        return { dot: "bg-rose-500", label: "Essai terminé", formula: "Essai 14 jours" };
      case "REVOKED":
        return { dot: "bg-rose-500", label: "Licence révoquée", formula: "Sordi Pro" };
      default:
        return { dot: "bg-muted-foreground", label: "Non activée", formula: "Aucune licence" };
    }
  })();

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          {/* Understated trigger — a small neutral avatar chip, not an
              oversized bright-blue avatar badge on a full pill-height button. */}
          <button className="h-7 max-w-[200px] flex items-center gap-1.5 pl-1 pr-2 rounded-md border border-border/60 bg-transparent hover:bg-muted/60 transition-colors duration-150">
            <CompanyAvatar seed={avatarSeed} size={20} className="rounded-md shrink-0" />
            <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
              {activeCompany?.name ?? "Sélectionner"}
            </span>
            {isPro && (
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* Minimal, subtle-Scarlet chip — a quiet reward for a
                      paying customer, not a loud upsell badge. */}
                  <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                    Pro
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  ✓ Licence Sordi Pro active{expiryFormatted ? ` jusqu'au ${expiryFormatted}` : ""}
                </TooltipContent>
              </Tooltip>
            )}
            <ChevronIcon className="w-3 h-3 shrink-0 text-muted-foreground/60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-[260px] bg-popover/95 border border-border/50 rounded-2xl p-3 shadow-xl backdrop-blur-xl select-none text-xs space-y-3"
        >
          {/* Account/workspace identity — the active company, not the raw
              session email, is the headline: this menu is primarily a
              workspace switcher, so it should read as "where am I" first.
              The avatar itself is a real button (not decorative): closes
              this dropdown first (see `menuOpen`/`setMenuOpen`), THEN opens
              the generator dialog, so the Dialog never ends up layered on
              top of a still-open DropdownMenuContent. */}
          <div className="flex items-center gap-2.5 px-0.5">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setAvatarDialogOpen(true);
              }}
              title="Changer l'avatar"
              className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CompanyAvatar seed={avatarSeed} size={36} className="rounded-full" />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Pencil className="w-3.5 h-3.5 text-white" />
              </span>
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm truncate">
                {activeCompany?.name ?? "Sélectionner"}
              </p>
              {user && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate">{user.email}</span>
                </div>
              )}
            </div>
          </div>

          <DropdownMenuSeparator />

          {/* Compact utility strip — language and theme unified into one
              segmented-control track instead of two separately-styled
              plain-text/icon rows, so both read as the same kind of
              control. */}
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

          <DropdownMenuSeparator className="my-0" />

          {/* Abonnement — a discreet status pill (color keyed off the same
              subscription lookup) instead of raw trailing text, plus the
              formula/échéance underneath for the full picture. */}
          <div>
            <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-0.5 py-1">
              Abonnement
            </DropdownMenuLabel>
            <div className="px-0.5 space-y-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  isPro
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : licenseState === "TRIAL_ACTIVE"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-muted text-muted-foreground"
                )}
              >
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", subscription.dot)} />
                {subscription.label}
              </span>
              <p className="text-[11px] text-muted-foreground">{subscription.formula}</p>
              {expiryFormatted && (
                <p className="text-[11px] text-muted-foreground">
                  Échéance : {expiryFormatted}
                  {daysRemaining !== null && ` (${daysRemaining} j restants)`}
                </p>
              )}
            </div>
          </div>

          <DropdownMenuSeparator className="my-0" />

          {/* Actions & Support */}
          <div>
            <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-0.5 py-1">
              Actions & Support
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <a
                href={buildWhatsAppSupportUrl(activeCompany?.name)}
                target="_blank"
                rel="noreferrer"
                className="h-8 px-2 rounded-md flex items-center gap-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
              >
                <WhatsAppIcon className="w-4 h-4" />
                Support & Assistance
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setActivationOpen(true)}
              className="h-8 px-2 rounded-md hover:bg-accent hover:text-accent-foreground flex items-center gap-2 cursor-pointer"
            >
              <KeyIcon className="w-4 h-4 text-muted-foreground" />
              Gérer ma licence / Saisir une clé
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/settings")}
              className="h-8 px-2 rounded-md hover:bg-accent hover:text-accent-foreground flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <SettingsIcon className="w-4 h-4 text-muted-foreground" />
                Paramètres
              </span>
              <span className="text-[10px] text-muted-foreground/70 font-mono">⌘,</span>
            </DropdownMenuItem>
          </div>

          {/* Sign-out — set apart with its own soft divider rather than
              another DropdownMenuSeparator, so it visually reads as the
              one destructive/exit action rather than just another item in
              the Actions & Support list above it. */}
          <div className="border-t border-border/40 pt-2">
            <DropdownMenuItem
              onClick={handleLogout}
              className="h-8 px-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center gap-2 cursor-pointer"
            >
              <LogoutIcon className="w-4 h-4" />
              Déconnexion
            </DropdownMenuItem>
            {/* Version — moved here from the sidebar header, a more
                conventional place for build info than the primary nav. */}
            <p className="px-2 pt-1.5 text-[10px] font-mono text-muted-foreground/50 select-none">Sordi Invoicing v1.0.0</p>
            {/* Machine ID — relocated from the license activation modal
                (that modal is activation-only now); this is the one place
                a user needs it, to send along when requesting a key. */}
            <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-0.5">
              <span className="text-[10px] font-mono text-muted-foreground/50 truncate select-none">
                ID: {machineId ?? "…"}
              </span>
              <button
                type="button"
                onClick={handleCopyMachineId}
                disabled={!machineId}
                title="Copier l'identifiant machine"
                className={cn(
                  "shrink-0 h-5 w-5 rounded flex items-center justify-center transition-colors disabled:opacity-40",
                  machineIdCopied ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/60 hover:text-foreground"
                )}
              >
                {machineIdCopied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <ActivationModal open={activationOpen} onOpenChange={setActivationOpen} />
      <AvatarGeneratorDialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen} currentSeed={avatarSeed} onSave={setAvatarSeed} />
    </>
  );
}
