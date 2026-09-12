import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster, Button, Input, Label } from "@sordi/ui";
import {
  RiLockLine as LockIcon,
  RiFileCopyLine as CopyIcon,
  RiCheckLine as CheckIcon,
  RiKey2Line as KeyIcon,
  RiLogoutBoxRLine as LogoutIcon,
  RiForbidLine as RevokeIcon,
  RiTimeLine as ExtendIcon,
  RiRefreshLine as RefreshIcon,
} from "@remixicon/react";
import { webApi, WebApiError, type License } from "@/lib/webApi";

// The entered value IS the admin secret — never compared against anything
// baked into the client bundle (a VITE_* value ships in plaintext to every
// visitor). It's only ever validated server-side, the first time it's used
// to call the API; a 401/403 there is the sole source of truth for "wrong
// secret".
const SESSION_KEY = "sordi-admin-secret";

type Plan = "annual" | "lifetime";

const PLAN_DAYS: Record<Plan, number> = { annual: 365, lifetime: 3650 };

// The public marketing site is light-only by design (see index.css), but
// this internal tool intentionally opts into the .dark token set — it's
// operated by the founder/sales team, not a client-facing surface, so it
// gets the "console" look rather than matching the storefront.
function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      {children}
      <Toaster theme="dark" />
    </div>
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
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl shadow-black/40"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
            <LockIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-50">Accès administrateur</h1>
            <p className="mt-1 text-sm text-zinc-400">Entrez le secret admin pour continuer.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-secret" className="text-zinc-300">
            Secret admin
          </Label>
          <Input
            id="admin-secret"
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="••••••••••••"
            className="h-11 border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-primary/30"
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
      toast.error("Impossible de copier la clé.");
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="shrink-0 gap-1.5 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50"
    >
      {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <CopyIcon className="h-3.5 w-3.5" />}
      {copied ? "Copié !" : label}
    </Button>
  );
}

// Only the prefix/suffix are shown by default — the full key is one click
// away via CopyButton without ever having to display it in full on screen
// (a shoulder-surf/screenshot risk on a page a salesperson might have open
// on a shared device).
function maskKey(key: string) {
  if (key.length <= 12) return key;
  return `${key.slice(0, 6)}••••••${key.slice(-4)}`;
}

function statusMeta(status: License["status"], expiresAt: string): { label: string; className: string } {
  if (status === "revoked") {
    return { label: "Révoquée", className: "bg-zinc-800 text-zinc-400 border-zinc-700" };
  }
  if (status === "active" && new Date(expiresAt) < new Date()) {
    return { label: "Expirée", className: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
  }
  if (status === "expired") {
    return { label: "Expirée", className: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
  }
  return { label: "Active", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
}

function GenerateLicenseForm({ adminSecret, onCreated }: { adminSecret: string; onCreated: () => void }) {
  const [clientName, setClientName] = useState("");
  const [plan, setPlan] = useState<Plan>("annual");
  const [durationDays, setDurationDays] = useState(PLAN_DAYS.annual);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<{ licenseKey: string; organizationName: string } | null>(null);

  const handlePlanChange = (next: Plan) => {
    setPlan(next);
    setDurationDays(PLAN_DAYS[next]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      const result = await webApi.generateLicense({ organizationName: clientName.trim(), expiresAt }, adminSecret);
      setLastGenerated({ licenseKey: result.licenseKey, organizationName: result.organizationName });
      toast.success("Licence générée !");
      setClientName("");
      onCreated();
    } catch (error) {
      toast.error(error instanceof WebApiError ? error.message : "Une erreur est survenue. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-2xl shadow-black/40">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
          <KeyIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-50">Générer une licence</h2>
          <p className="text-sm text-zinc-400">Pour un client payé manuellement (virement/espèces).</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="client-name" className="text-zinc-300">
            Nom du client
          </Label>
          <Input
            id="client-name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Nom de l'entreprise ou du client"
            required
            className="h-11 border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-primary/30"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="plan" className="text-zinc-300">
              Plan
            </Label>
            <select
              id="plan"
              value={plan}
              onChange={(e) => handlePlanChange(e.target.value as Plan)}
              className="flex h-11 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <option value="annual">Annuel</option>
              <option value="lifetime">À vie</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="duration" className="text-zinc-300">
              Durée (jours)
            </Label>
            <Input
              id="duration"
              type="number"
              min={1}
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value) || 0)}
              className="h-11 border-zinc-800 bg-zinc-950 text-zinc-100 focus-visible:ring-primary/30"
            />
          </div>
        </div>

        <Button type="submit" disabled={!clientName.trim() || isSubmitting} className="w-full h-11">
          {isSubmitting ? "Génération..." : "Générer la clé"}
        </Button>
      </form>

      {lastGenerated && (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-100">{lastGenerated.organizationName}</p>
            <p className="mt-1 break-all rounded-md bg-zinc-950 px-2 py-1 font-mono text-xs text-primary/90">
              {lastGenerated.licenseKey}
            </p>
          </div>
          <CopyButton text={lastGenerated.licenseKey} label="Copier la clé" />
        </div>
      )}
    </div>
  );
}

function ExtendPopover({ onExtend }: { onExtend: (days: number) => void }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(365);

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50"
      >
        <ExtendIcon className="h-3.5 w-3.5" />
        Prolonger
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={1}
        value={days}
        onChange={(e) => setDays(Number(e.target.value) || 0)}
        className="h-8 w-20 border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
        autoFocus
      />
      <Button
        type="button"
        size="sm"
        className="h-8"
        disabled={days <= 0}
        onClick={() => {
          onExtend(days);
          setOpen(false);
        }}
      >
        OK
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        onClick={() => setOpen(false)}
      >
        Annuler
      </Button>
    </div>
  );
}

function LicenseTable({ adminSecret, onInvalidSecret }: { adminSecret: string; onInvalidSecret: () => void }) {
  const [licenses, setLicenses] = useState<License[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const result = await webApi.listLicenses(adminSecret, search || undefined);
      setLicenses(result.licenses);
    } catch (error) {
      if (error instanceof WebApiError && (error.status === 401 || error.status === 403)) {
        toast.error("Secret admin invalide.");
        onInvalidSecret();
        return;
      }
      toast.error(error instanceof WebApiError ? error.message : "Impossible de charger les licences.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRevoke = async (license: License) => {
    if (!window.confirm(`Révoquer la licence de "${license.organizationName}" ? Cette action est définitive.`)) return;
    setBusyId(license.id);
    try {
      await webApi.revokeLicense(license.id, adminSecret);
      toast.success("Licence révoquée.");
      await load();
    } catch (error) {
      toast.error(error instanceof WebApiError ? error.message : "Impossible de révoquer la licence.");
    } finally {
      setBusyId(null);
    }
  };

  const handleExtend = async (license: License, days: number) => {
    setBusyId(license.id);
    try {
      await webApi.extendLicense(license.id, days, adminSecret);
      toast.success(`Licence prolongée de ${days} jour(s).`);
      await load();
    } catch (error) {
      toast.error(error instanceof WebApiError ? error.message : "Impossible de prolonger la licence.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-2xl shadow-black/40">
      <div className="flex flex-col gap-3 border-b border-zinc-800 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-50">Licences</h2>
          <p className="text-sm text-zinc-400">{licenses ? `${licenses.length} licence(s)` : "Chargement..."}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Rechercher un client..."
            className="h-9 w-56 border-zinc-800 bg-zinc-950 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={load}
            disabled={isLoading}
            className="gap-1.5 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50"
          >
            <RefreshIcon className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-5 py-3 font-medium">Client</th>
              <th className="px-5 py-3 font-medium">Clé</th>
              <th className="px-5 py-3 font-medium">Expiration</th>
              <th className="px-5 py-3 font-medium">Statut</th>
              <th className="px-5 py-3 font-medium">Appareils</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {licenses === null && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-zinc-500">
                  Chargement des licences...
                </td>
              </tr>
            )}
            {licenses !== null && licenses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-zinc-500">
                  Aucune licence trouvée.
                </td>
              </tr>
            )}
            {licenses?.map((license) => {
              const meta = statusMeta(license.status, license.expiresAt);
              const isRevoked = license.status === "revoked";
              const isBusy = busyId === license.id;
              return (
                <tr key={license.id} className="border-b border-zinc-800/60 last:border-0">
                  <td className="px-5 py-3 font-medium text-zinc-100">{license.organizationName}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-300">
                        {maskKey(license.licenseKey)}
                      </span>
                      <CopyButton text={license.licenseKey} label="Copier" />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-zinc-300">
                    {new Date(license.expiresAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${meta.className}`}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-zinc-300">
                    {license.deviceCount} / {license.maxDevices}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {!isRevoked && <ExtendPopover onExtend={(days) => handleExtend(license, days)} />}
                      {!isRevoked && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleRevoke(license)}
                          className="gap-1.5 border-red-900/50 bg-red-950/30 text-red-400 hover:bg-red-950/60 hover:text-red-300"
                        >
                          <RevokeIcon className="h-3.5 w-3.5" />
                          Révoquer
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminApp() {
  const [adminSecret, setAdminSecret] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));
  const [refreshKey, setRefreshKey] = useState(0);

  const unlock = (secret: string) => {
    sessionStorage.setItem(SESSION_KEY, secret);
    setAdminSecret(secret);
  };

  const invalidateSecret = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAdminSecret(null);
  };

  if (!adminSecret) {
    return (
      <AdminShell>
        <PasswordGate onUnlock={unlock} />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Administration Sordi</h1>
            <p className="text-sm text-zinc-400">Gestion des licences</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={invalidateSecret}
            className="shrink-0 gap-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <LogoutIcon className="h-3.5 w-3.5" />
            Changer de secret
          </Button>
        </div>

        <div className="mb-8">
          <GenerateLicenseForm adminSecret={adminSecret} onCreated={() => setRefreshKey((k) => k + 1)} />
        </div>

        <LicenseTable key={refreshKey} adminSecret={adminSecret} onInvalidSecret={invalidateSecret} />
      </div>
    </AdminShell>
  );
}
