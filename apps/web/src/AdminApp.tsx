import { useEffect, useMemo, useState } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Toaster,
  Button,
  Input,
  Label,
  Badge,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TooltipProvider,
} from "@sordi/ui";
import {
  RiLockLine as LockIcon,
  RiFileCopyLine as CopyIcon,
  RiCheckLine as CheckIcon,
  RiKey2Line as KeyIcon,
  RiLogoutBoxRLine as LogoutIcon,
  RiForbidLine as RevokeIcon,
  RiTimeLine as ExtendIcon,
  RiRefreshLine as RefreshIcon,
  RiPhoneLine as PhoneIcon,
  RiWhatsappLine as WhatsappIcon,
  RiDeleteBinLine as DeleteIcon,
  RiSunLine as SunIcon,
  RiMoonLine as MoonIcon,
  RiNotification3Line as BellIcon,
  RiMoreLine as MoreIcon,
  RiAddLine as AddIcon,
  RiCloseLine as CloseIcon,
  RiArrowUpSLine as SortAscIcon,
  RiArrowDownSLine as SortDescIcon,
  RiArrowUpDownLine as SortIcon,
  RiComputerLine as DeviceIcon,
  RiArrowLeftSLine as PrevIcon,
  RiArrowRightSLine as NextIcon,
  RiVipCrownLine as LifetimeIcon,
} from "@remixicon/react";
import { webApi, WebApiError, type ContactStatus, type License, type PlanType, type DeviceActivation } from "@/lib/webApi";

// ---------------------------------------------------------------------------
// Session / constants
// ---------------------------------------------------------------------------

// The entered value IS the admin secret — never compared against anything
// baked into the client bundle. Only ever validated server-side, on first
// use; a 401/403 there is the sole source of truth for "wrong secret".
const SESSION_KEY = "sordi-admin-secret";
const NOTIFICATIONS_READ_KEY = "sordi-admin-notifications-read";
const PAGE_SIZE = 10;
const POLL_INTERVAL_MS = 30_000;

type Plan = "trial7" | "trial14" | "annual";
const PLAN_DAYS: Record<Plan, number> = { trial7: 7, trial14: 14, annual: 365 };
const PLAN_LABELS: Record<Plan, string> = {
  trial7: "Essai 7 jours",
  trial14: "Essai 14 jours",
  annual: "Annuel (365 jours)",
};
const PLAN_TO_PLAN_TYPE: Record<Plan, PlanType> = { trial7: "trial", trial14: "trial", annual: "annual" };

const PLAN_TYPE_LABELS: Record<PlanType, string> = { trial: "Essai", annual: "Annuel", lifetime: "À vie" };
const PLAN_TYPE_BADGE: Record<PlanType, "outline" | "default" | "secondary"> = {
  trial: "outline",
  annual: "default",
  lifetime: "secondary",
};

const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  a_contacter: "À contacter",
  en_cours: "En cours",
  converti: "Converti (Payé)",
  non_interesse: "Non intéressé",
};
const CONTACT_STATUS_BADGE: Record<ContactStatus, "warning" | "default" | "success" | "draft"> = {
  a_contacter: "warning",
  en_cours: "default",
  converti: "success",
  non_interesse: "draft",
};

type EffectiveStatus = "active" | "expired" | "revoked";
const EFFECTIVE_STATUS_LABELS: Record<EffectiveStatus, string> = {
  active: "Active",
  expired: "Expirée",
  revoked: "Révoquée",
};
const EFFECTIVE_STATUS_BADGE: Record<EffectiveStatus, "success" | "warning" | "draft"> = {
  active: "success",
  expired: "warning",
  revoked: "draft",
};

function effectiveStatus(license: License): EffectiveStatus {
  if (license.status === "revoked") return "revoked";
  return new Date(license.expiresAt) < new Date() ? "expired" : "active";
}

function daysRemaining(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

// Only the prefix/suffix are shown by default — the full key is one click
// away via CopyButton without ever having to display it in full on screen.
function maskKey(key: string) {
  if (key.length <= 12) return key;
  return `${key.slice(0, 6)}••••••${key.slice(-4)}`;
}

// Best-effort digit normalization for tel:/wa.me links.
function phoneDigits(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

/** Internal console, not the public storefront (which stays light-only by
 *  design — see index.css) — defaults to dark to match this tool's
 *  existing identity, but is a real, persisted next-themes toggle now
 *  rather than a hardcoded `dark` class with no way out. `enableSystem` is
 *  deliberately off: an admin console's look shouldn't silently flip with
 *  the operator's OS setting, only with an explicit click. */
export function AdminApp() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange storageKey="sordi-admin-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AdminAppInner />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function AdminAppInner() {
  const [adminSecret, setAdminSecret] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));

  const unlock = (secret: string) => {
    sessionStorage.setItem(SESSION_KEY, secret);
    setAdminSecret(secret);
  };

  const invalidateSecret = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAdminSecret(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {adminSecret ? (
        <Dashboard adminSecret={adminSecret} onInvalidSecret={invalidateSecret} onLogout={invalidateSecret} />
      ) : (
        <PasswordGate onUnlock={unlock} />
      )}
      <Toaster />
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Avoids a light/dark mismatch flash on first paint (next-themes reads
  // localStorage after mount) — same guard pattern already used by
  // apps/desktop's own theme toggle (WorkspaceAccountMenu.tsx).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-8 w-8" />;

  const isDark = theme === "dark";
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      {isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </Button>
  );
}

function PasswordGate({ onUnlock }: { onUnlock: (secret: string) => void }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    onUnlock(value);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
            <LockIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Accès administrateur</h1>
            <p className="mt-1 text-sm text-muted-foreground">Entrez le secret admin pour continuer.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-secret">Secret admin</Label>
          <Input
            id="admin-secret"
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="••••••••••••"
          />
        </div>
        <Button type="submit" className="w-full h-11" disabled={!value}>
          Déverrouiller
        </Button>
      </form>
    </div>
  );
}

function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copié !");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Impossible de copier.");
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0 gap-1.5">
      {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-500" /> : <CopyIcon className="h-3.5 w-3.5" />}
      {copied ? "Copié !" : label}
    </Button>
  );
}

function WhatsAppLink({ phone, message, children }: { phone: string; message?: string; children: React.ReactNode }) {
  const digits = phoneDigits(phone);
  const url = `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex">
      {children}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Data layer — one polled query, everything else (KPIs, table, notifications)
// derives from it. `refetchInterval` is the "polling automatique périodique"
// half of the two options the spec offered; the query cache itself is what
// makes every consumer re-render together without prop drilling.
// ---------------------------------------------------------------------------

function useLicensesQuery(adminSecret: string, onInvalidSecret: () => void) {
  const query = useQuery({
    queryKey: ["admin", "licenses"],
    queryFn: () => webApi.listLicenses(adminSecret, undefined),
    refetchInterval: POLL_INTERVAL_MS,
  });

  useEffect(() => {
    if (query.error instanceof WebApiError && (query.error.status === 401 || query.error.status === 403)) {
      toast.error("Secret admin invalide.");
      onInvalidSecret();
    }
  }, [query.error, onInvalidSecret]);

  return query;
}

// ---------------------------------------------------------------------------
// Notifications — derived from the license list, not a persisted event log
// (no separate table/route exists for discrete events; everything here is
// recomputed from data already fetched for the table). Read/unread state
// is tracked client-side (localStorage) since there is no per-admin login,
// just a single shared secret — no server-side "who read what" to model.
// ---------------------------------------------------------------------------

type NotificationKind = "new_lead" | "expiring_soon" | "converted";

interface AdminNotification {
  id: string;
  kind: NotificationKind;
  license: License;
  message: string;
  at: string;
}

function computeNotifications(licenses: License[]): AdminNotification[] {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const notifications: AdminNotification[] = [];

  for (const license of licenses) {
    const createdMsAgo = now - new Date(license.createdAt).getTime();
    if (createdMsAgo >= 0 && createdMsAgo <= DAY) {
      notifications.push({
        id: `new_lead:${license.id}`,
        kind: "new_lead",
        license,
        message: `Nouveau prospect : ${license.organizationName} vient de démarrer un essai gratuit`,
        at: license.createdAt,
      });
    }

    if (license.planType === "trial" && effectiveStatus(license) === "active") {
      const days = daysRemaining(license.expiresAt);
      if (days >= 0 && days <= 2) {
        notifications.push({
          id: `expiring_soon:${license.id}`,
          kind: "expiring_soon",
          license,
          message: `Essai expirant sous 48h : ${license.organizationName} (action recommandée : relance)`,
          at: license.expiresAt,
        });
      }
    }

    if (license.contactStatus === "converti") {
      const updatedMsAgo = now - new Date(license.updatedAt).getTime();
      if (updatedMsAgo >= 0 && updatedMsAgo <= 2 * DAY) {
        notifications.push({
          id: `converted:${license.id}`,
          kind: "converted",
          license,
          message: `Licence convertie : ${license.organizationName} est passé en forfait payant`,
          at: license.updatedAt,
        });
      }
    }
  }

  return notifications.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function useReadNotifications() {
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(NOTIFICATIONS_READ_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  const persist = (next: Set<string>) => {
    setReadIds(next);
    try {
      localStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify([...next]));
    } catch {
      // localStorage unavailable — read state just won't persist across reloads.
    }
  };

  const markRead = (id: string) => persist(new Set(readIds).add(id));
  const markAllRead = (ids: string[]) => persist(new Set([...readIds, ...ids]));

  return { readIds, markRead, markAllRead };
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

const NOTIFICATION_ICON: Record<NotificationKind, React.ElementType> = {
  new_lead: AddIcon,
  expiring_soon: ExtendIcon,
  converted: CheckIcon,
};

function NotificationBell({ licenses }: { licenses: License[] }) {
  const notifications = useMemo(() => computeNotifications(licenses), [licenses]);
  const { readIds, markRead, markAllRead } = useReadNotifications();
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="relative">
          <BellIcon className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={() => markAllRead(notifications.map((n) => n.id))}
              className="text-xs font-medium text-primary hover:underline"
            >
              Marquer tout comme lu
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune notification pour le moment.</p>
          )}
          {notifications.map((n) => {
            const Icon = NOTIFICATION_ICON[n.kind];
            const isUnread = !readIds.has(n.id);
            return (
              <div
                key={n.id}
                onClick={() => isUnread && markRead(n.id)}
                className={`flex gap-3 border-b border-border/60 px-4 py-3 last:border-0 ${isUnread ? "bg-primary/[0.04] cursor-pointer" : ""}`}
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-foreground">{n.message}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">{relativeTime(n.at)}</span>
                    {n.license.phone && (
                      <WhatsAppLink phone={n.license.phone} message={`Bonjour ${n.license.organizationName},`}>
                        <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-emerald-500 hover:bg-emerald-500/10">
                          <WhatsappIcon className="h-3 w-3" />
                          WhatsApp
                        </span>
                      </WhatsAppLink>
                    )}
                  </div>
                </div>
                {isUnread && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Generate license dialog
// ---------------------------------------------------------------------------

function GenerateLicenseDialog({ adminSecret, onCreated }: { adminSecret: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<Plan>("trial14");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<{ licenseKey: string; organizationName: string } | null>(null);

  const reset = () => {
    setClientName("");
    setPhone("");
    setEmail("");
    setPlan("trial14");
    setLastGenerated(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !phone.trim() || !email.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const expiresAt = new Date(Date.now() + PLAN_DAYS[plan] * 24 * 60 * 60 * 1000).toISOString();
      const result = await webApi.generateLicense(
        {
          organizationName: clientName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          expiresAt,
          planType: PLAN_TO_PLAN_TYPE[plan],
        },
        adminSecret
      );
      setLastGenerated({ licenseKey: result.licenseKey, organizationName: result.organizationName });
      toast.success("Licence générée !");
      onCreated();
    } catch (error) {
      toast.error(error instanceof WebApiError ? error.message : "Une erreur est survenue. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyIcon className="h-4 w-4 text-primary" />
            Générer une licence
          </DialogTitle>
          <DialogDescription>Essai ou vente manuelle (virement/espèces).</DialogDescription>
        </DialogHeader>

        {lastGenerated ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="truncate text-sm font-medium text-foreground">{lastGenerated.organizationName}</p>
              <p className="mt-1 break-all rounded-md bg-muted px-2 py-1 font-mono text-xs text-primary">
                {lastGenerated.licenseKey}
              </p>
            </div>
            <div className="flex gap-2">
              <CopyButton text={lastGenerated.licenseKey} label="Copier la clé" />
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Fermer
              </Button>
              <Button type="button" className="flex-1" onClick={reset}>
                Générer une autre
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="client-name">Nom du client</Label>
              <Input
                id="client-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nom de l'entreprise ou du client"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="client-phone">Téléphone</Label>
                <Input id="client-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05 XX XX XX XX" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-email">Email</Label>
                <Input id="client-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@email.com" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan">Type de licence</Label>
              <Select value={plan} onValueChange={(v) => setPlan(v as Plan)}>
                <SelectTrigger id="plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PLAN_LABELS) as Plan[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {PLAN_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={!clientName.trim() || !phone.trim() || !email.trim() || isSubmitting}>
                {isSubmitting ? "Génération..." : "Générer la clé"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Device details dialog — "Voir détails & empreintes de machines"
// ---------------------------------------------------------------------------

function DeviceDetailsDialog({
  license,
  adminSecret,
  open,
  onOpenChange,
  onChanged,
}: {
  license: License | null;
  adminSecret: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [activations, setActivations] = useState<DeviceActivation[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !license) {
      setActivations(null);
      return;
    }
    setIsLoading(true);
    webApi
      .listActivations(license.id, adminSecret)
      .then((res) => setActivations(res.activations))
      .catch(() => toast.error("Impossible de charger les appareils."))
      .finally(() => setIsLoading(false));
  }, [open, license, adminSecret]);

  if (!license) return null;

  const handleUnlink = async (fingerprint: string) => {
    setUnlinking(fingerprint);
    try {
      await webApi.unlinkDevice(license.id, fingerprint, adminSecret);
      toast.success("Appareil délié.");
      setActivations((prev) => prev?.filter((a) => a.deviceFingerprint !== fingerprint) ?? prev);
      onChanged();
    } catch (error) {
      toast.error(error instanceof WebApiError ? error.message : "Impossible de délier cet appareil.");
    } finally {
      setUnlinking(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DeviceIcon className="h-4 w-4 text-primary" />
            {license.organizationName}
          </DialogTitle>
          <DialogDescription>
            {license.deviceCount} / {license.maxDevices} appareil(s) activé(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Chargement...</p>}
          {!isLoading && activations?.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucun appareil activé pour l'instant.</p>
          )}
          {activations?.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-foreground">{a.deviceFingerprint}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Activé {relativeTime(a.activatedAt)} · Vérifié {relativeTime(a.lastVerifiedAt)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={unlinking === a.deviceFingerprint}
                onClick={() => handleUnlink(a.deviceFingerprint)}
                className="shrink-0 gap-1.5 text-destructive hover:bg-destructive/10"
              >
                <CloseIcon className="h-3.5 w-3.5" />
                Délier
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// KPI cards
// ---------------------------------------------------------------------------

function KpiCards({ licenses }: { licenses: License[] }) {
  const kpis = useMemo(() => {
    const essaisActifs = licenses.filter((l) => l.planType === "trial" && effectiveStatus(l) === "active").length;
    const conversions = licenses.filter((l) => l.contactStatus === "converti").length;
    const leadsAContacter = licenses.filter((l) => l.contactStatus === "a_contacter").length;
    const taux = licenses.length > 0 ? Math.round((conversions / licenses.length) * 100) : 0;
    return { essaisActifs, conversions, leadsAContacter, taux };
  }, [licenses]);

  const cards = [
    { label: "Essais actifs", value: kpis.essaisActifs },
    { label: "Conversions payantes", value: kpis.conversions },
    { label: "Leads à contacter", value: kpis.leadsAContacter },
    { label: "Taux de conversion", value: `${kpis.taux}%` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

type SortKey = "organizationName" | "expiresAt" | "createdAt" | "deviceCount";

function SortableHead({
  label,
  sortKey,
  currentKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  direction: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentKey === sortKey;
  const Icon = !isActive ? SortIcon : direction === "asc" ? SortAscIcon : SortDescIcon;
  return (
    <TableHead>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TableHead>
  );
}

function LicenseRowMenu({
  license,
  adminSecret,
  onChanged,
  onViewDetails,
}: {
  license: License;
  adminSecret: string;
  onChanged: () => void;
  onViewDetails: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(365);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isRevoked = license.status === "revoked";

  const run = async (action: () => Promise<unknown>, successMessage: string, failMessage: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(successMessage);
      onChanged();
    } catch (error) {
      toast.error(error instanceof WebApiError ? error.message : failMessage);
    } finally {
      setBusy(false);
    }
  };

  const whatsappMessage = `Bonjour ${license.organizationName}, `;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" disabled={busy}>
            <MoreIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onViewDetails}>
            <DeviceIcon className="mr-2 h-3.5 w-3.5" />
            Voir détails & appareils
          </DropdownMenuItem>
          {license.phone && (
            <DropdownMenuItem asChild>
              <WhatsAppLink phone={license.phone} message={whatsappMessage}>
                <span className="flex w-full items-center text-emerald-500">
                  <WhatsappIcon className="mr-2 h-3.5 w-3.5" />
                  Contacter sur WhatsApp
                </span>
              </WhatsAppLink>
            </DropdownMenuItem>
          )}
          {!isRevoked && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => run(() => webApi.convertToPaid(license.id, 365, "annual", adminSecret), "Licence convertie en Annuel.", "Impossible de convertir la licence.")}
              >
                <CheckIcon className="mr-2 h-3.5 w-3.5" />
                Convertir en Annuel
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => run(() => webApi.convertToPaid(license.id, 36_500, "lifetime", adminSecret), "Licence convertie à vie.", "Impossible de convertir la licence.")}
              >
                <LifetimeIcon className="mr-2 h-3.5 w-3.5" />
                Convertir à vie
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExtendOpen(true)}>
                <ExtendIcon className="mr-2 h-3.5 w-3.5" />
                Prolonger l'échéance
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setRevokeOpen(true)} className="text-destructive focus:text-destructive">
                <RevokeIcon className="mr-2 h-3.5 w-3.5" />
                Révoquer
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
            <DeleteIcon className="mr-2 h-3.5 w-3.5" />
            Supprimer définitivement
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Prolonger l'échéance</DialogTitle>
            <DialogDescription>{license.organizationName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="extend-days">Nombre de jours à ajouter</Label>
            <Input id="extend-days" type="number" min={1} value={extendDays} onChange={(e) => setExtendDays(Number(e.target.value) || 0)} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={extendDays <= 0 || busy}
              onClick={async () => {
                await run(() => webApi.extendLicense(license.id, extendDays, adminSecret), `Licence prolongée de ${extendDays} jour(s).`, "Impossible de prolonger la licence.");
                setExtendOpen(false);
              }}
              className="w-full"
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer cette licence ?</AlertDialogTitle>
            <AlertDialogDescription>
              La licence de "{license.organizationName}" sera immédiatement invalidée. Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => run(() => webApi.revokeLicense(license.id, adminSecret), "Licence révoquée.", "Impossible de révoquer la licence.")}
            >
              Révoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement cette licence ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ceci efface aussi l'empreinte de l'appareil associé, permettant à cette machine de recommencer l'essai depuis le début. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => run(() => webApi.deleteLicense(license.id, adminSecret), "Licence supprimée.", "Impossible de supprimer la licence.")}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function Dashboard({
  adminSecret,
  onInvalidSecret,
  onLogout,
}: {
  adminSecret: string;
  onInvalidSecret: () => void;
  onLogout: () => void;
}) {
  const { data, isLoading, isFetching, isError, error, refetch } = useLicensesQuery(adminSecret, onInvalidSecret);
  const licenses = data?.licenses ?? [];

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const [planFilter, setPlanFilter] = useState<"all" | PlanType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | EffectiveStatus>("all");
  const [contactFilter, setContactFilter] = useState<"all" | ContactStatus>("all");
  const [quotaReached, setQuotaReached] = useState(false);
  const [expiringSoonOnly, setExpiringSoonOnly] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [detailsLicense, setDetailsLicense] = useState<License | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const hasActiveFilters =
    debouncedSearch !== "" || planFilter !== "all" || statusFilter !== "all" || contactFilter !== "all" || quotaReached || expiringSoonOnly;

  const resetFilters = () => {
    setSearch("");
    setPlanFilter("all");
    setStatusFilter("all");
    setContactFilter("all");
    setQuotaReached(false);
    setExpiringSoonOnly(false);
  };

  // Reset to page 1 whenever any filter/search/sort changes so the user
  // never lands on an out-of-range page after narrowing the result set.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, planFilter, statusFilter, contactFilter, quotaReached, expiringSoonOnly, sortKey, sortDir]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return licenses.filter((l) => {
      if (q) {
        const haystack = [l.organizationName, l.phone ?? "", l.email ?? "", l.licenseKey, ...l.deviceFingerprints]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (planFilter !== "all" && l.planType !== planFilter) return false;
      if (statusFilter !== "all" && effectiveStatus(l) !== statusFilter) return false;
      if (contactFilter !== "all" && l.contactStatus !== contactFilter) return false;
      if (quotaReached && l.deviceCount < l.maxDevices) return false;
      if (expiringSoonOnly && !(effectiveStatus(l) === "active" && daysRemaining(l.expiresAt) <= 3)) return false;
      return true;
    });
  }, [licenses, debouncedSearch, planFilter, statusFilter, contactFilter, quotaReached, expiringSoonOnly]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "organizationName") cmp = a.organizationName.localeCompare(b.organizationName);
      else if (sortKey === "expiresAt") cmp = new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
      else if (sortKey === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortKey === "deviceCount") cmp = a.deviceCount - b.deviceCount;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Administration Sordi</h1>
          <p className="text-sm text-muted-foreground">Prospects et licences (essai → payant)</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell licenses={licenses} />
          <ThemeToggle />
          <Button type="button" variant="ghost" size="sm" onClick={onLogout} className="gap-1.5 text-muted-foreground">
            <LogoutIcon className="h-3.5 w-3.5" />
            Changer de secret
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6">
        <KpiCards licenses={licenses} />
      </div>

      {/* Toolbar */}
      <Card className="mb-4">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher : nom, téléphone, email, clé, empreinte machine..."
              className="h-9 flex-1 min-w-[240px]"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
              <RefreshIcon className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <GenerateLicenseDialog adminSecret={adminSecret} onCreated={() => refetch()} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={planFilter} onValueChange={(v) => setPlanFilter(v as typeof planFilter)}>
              <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les plans</SelectItem>
                <SelectItem value="trial">Essai</SelectItem>
                <SelectItem value="annual">Annuel</SelectItem>
                <SelectItem value="lifetime">À vie</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs">
                <SelectValue placeholder="État" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les états</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expirée</SelectItem>
                <SelectItem value="revoked">Révoquée</SelectItem>
              </SelectContent>
            </Select>

            <Select value={contactFilter} onValueChange={(v) => setContactFilter(v as typeof contactFilter)}>
              <SelectTrigger className="h-8 w-auto min-w-[150px] text-xs">
                <SelectValue placeholder="Pipeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tout le pipeline</SelectItem>
                {(Object.keys(CONTACT_STATUS_LABELS) as ContactStatus[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {CONTACT_STATUS_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={() => setQuotaReached((v) => !v)}
              className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
                quotaReached ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              Quota atteint (2/2)
            </button>
            <button
              type="button"
              onClick={() => setExpiringSoonOnly((v) => !v)}
              className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
                expiringSoonOnly ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              Expire bientôt (≤ 3 jours)
            </button>

            {hasActiveFilters && (
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5 text-muted-foreground">
                <CloseIcon className="h-3.5 w-3.5" />
                Réinitialiser les filtres
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isError && (
            <div className="border-b border-destructive/30 bg-destructive/5 px-5 py-3 text-sm text-destructive">
              {error instanceof WebApiError ? error.message : "Impossible de charger les licences."} — vérifiez que
              l'API a bien été redéployée, et que le secret admin correspond à{" "}
              <code className="text-destructive">LICENSE_ADMIN_SECRET</code>.
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Client" sortKey="organizationName" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                  <TableHead>Téléphone & Email</TableHead>
                  <TableHead>Clé</TableHead>
                  <TableHead>Type</TableHead>
                  <SortableHead label="Expiration" sortKey="expiresAt" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                  <TableHead>Pipeline</TableHead>
                  <SortableHead label="Appareils" sortKey="deviceCount" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      Chargement des licences...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      Aucune licence ne correspond à ces critères.
                    </TableCell>
                  </TableRow>
                )}
                {paged.map((license) => {
                  const status = effectiveStatus(license);
                  const digits = license.phone ? phoneDigits(license.phone) : null;
                  const days = daysRemaining(license.expiresAt);
                  return (
                    <TableRow key={license.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{license.organizationName}</div>
                        <Badge variant={EFFECTIVE_STATUS_BADGE[status]} className="mt-1">
                          {EFFECTIVE_STATUS_LABELS[status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                          {license.phone && (
                            <div className="flex items-center gap-1.5">
                              <span>{license.phone}</span>
                              {digits && (
                                <>
                                  <a href={`tel:+${digits}`} title="Appeler" className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                                    <PhoneIcon className="h-3.5 w-3.5" />
                                  </a>
                                  <WhatsAppLink phone={license.phone} message={`Bonjour ${license.organizationName}, `}>
                                    <span className="rounded-md p-1 text-emerald-500 hover:bg-secondary">
                                      <WhatsappIcon className="h-3.5 w-3.5" />
                                    </span>
                                  </WhatsAppLink>
                                </>
                              )}
                            </div>
                          )}
                          {license.email && <span className="text-muted-foreground">{license.email}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">{maskKey(license.licenseKey)}</span>
                          <CopyButton text={license.licenseKey} label="Copier" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={PLAN_TYPE_BADGE[license.planType]}>{PLAN_TYPE_LABELS[license.planType]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-foreground">{new Date(license.expiresAt).toLocaleDateString("fr-FR")}</div>
                        {status !== "revoked" && (
                          <span
                            className={`text-xs ${days <= 3 ? "font-medium text-destructive" : days <= 7 ? "font-medium text-amber-500" : "text-muted-foreground"}`}
                          >
                            {days < 0 ? "expirée" : days === 0 ? "expire aujourd'hui" : `${days} j restants`}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={CONTACT_STATUS_BADGE[license.contactStatus]}>{CONTACT_STATUS_LABELS[license.contactStatus]}</Badge>
                      </TableCell>
                      <TableCell>
                        {license.deviceCount} / {license.maxDevices}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <LicenseRowMenu
                            license={license}
                            adminSecret={adminSecret}
                            onChanged={() => refetch()}
                            onViewDetails={() => {
                              setDetailsLicense(license);
                              setDetailsOpen(true);
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Page {page} sur {totalPages} · {sorted.length} licence(s)
              </p>
              <div className="flex items-center gap-1.5">
                <Button type="button" variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <PrevIcon className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <NextIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DeviceDetailsDialog
        license={detailsLicense}
        adminSecret={adminSecret}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onChanged={() => refetch()}
      />
    </div>
  );
}
