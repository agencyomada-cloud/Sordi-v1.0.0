import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster, Button, Input, Label } from "@sordi/ui";
import {
  RiLockLine as LockIcon,
  RiFileCopyLine as CopyIcon,
  RiCheckLine as CheckIcon,
  RiKey2Line as KeyIcon,
  RiLogoutBoxRLine as LogoutIcon,
} from "@remixicon/react";
import { webApi, WebApiError } from "@/lib/webApi";

// The entered value IS the admin secret — never compared against anything
// baked into the client bundle (a VITE_* value ships in plaintext to every
// visitor). It's only ever validated server-side, the first time it's used
// to call POST /licenses/create; a 401/403 there is the sole source of
// truth for "wrong secret".
const SESSION_KEY = "sordi-admin-secret";

type Plan = "annual" | "lifetime";

const PLAN_DAYS: Record<Plan, number> = { annual: 365, lifetime: 3650 };

interface GeneratedLicense {
  licenseKey: string;
  organizationName: string;
  expiresAt: string;
  createdAt: string;
}

// The public marketing site is light-only by design (see index.css), but
// this internal tool intentionally opts into the .dark token set — it's
// operated by the founder/sales team, not a client-facing surface, so it
// gets the "console" look rather than matching the storefront.
function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      <div className="flex min-h-screen items-center justify-center p-4">{children}</div>
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
  );
}

function CopyButton({ text }: { text: string }) {
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
      {copied ? "Copié !" : "Copier la clé"}
    </Button>
  );
}

function LicenseGenerator({
  adminSecret,
  onInvalidSecret,
  onLogout,
}: {
  adminSecret: string;
  onInvalidSecret: () => void;
  onLogout: () => void;
}) {
  const [clientName, setClientName] = useState("");
  const [plan, setPlan] = useState<Plan>("annual");
  const [durationDays, setDurationDays] = useState(PLAN_DAYS.annual);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generated, setGenerated] = useState<GeneratedLicense[]>(() => {
    try {
      const raw = sessionStorage.getItem("sordi-admin-generated");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("sordi-admin-generated", JSON.stringify(generated));
    } catch {
      // sessionStorage unavailable — history just won't persist across reloads.
    }
  }, [generated]);

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
      const result = await webApi.generateLicense(
        { organizationName: clientName.trim(), expiresAt },
        adminSecret
      );
      setGenerated((prev) => [
        { licenseKey: result.licenseKey, organizationName: result.organizationName, expiresAt: result.expiresAt, createdAt: new Date().toISOString() },
        ...prev,
      ]);
      toast.success("Licence générée !");
      setClientName("");
    } catch (error) {
      if (error instanceof WebApiError && (error.status === 401 || error.status === 403)) {
        toast.error("Secret admin invalide.");
        onInvalidSecret();
        return;
      }
      toast.error(error instanceof WebApiError ? error.message : "Une erreur est survenue. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-lg">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <KeyIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-50">Génération de licences</h1>
            <p className="text-sm text-zinc-400">Créer une clé pour un client payé manuellement.</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="shrink-0 gap-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <LogoutIcon className="h-3.5 w-3.5" />
          Changer de secret
        </Button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-2xl shadow-black/40"
      >
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

      {generated.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-zinc-400">Licences générées cette session</h2>
          <div className="space-y-2">
            {generated.map((lic) => (
              <div
                key={lic.licenseKey + lic.createdAt}
                className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{lic.organizationName}</p>
                  <p className="mt-1 break-all rounded-md bg-zinc-950 px-2 py-1 font-mono text-xs text-primary/90">
                    {lic.licenseKey}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">Expire le {new Date(lic.expiresAt).toLocaleDateString("fr-FR")}</p>
                </div>
                <CopyButton text={lic.licenseKey} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminApp() {
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
    <AdminShell>
      {adminSecret ? (
        <LicenseGenerator adminSecret={adminSecret} onInvalidSecret={invalidateSecret} onLogout={invalidateSecret} />
      ) : (
        <PasswordGate onUnlock={unlock} />
      )}
    </AdminShell>
  );
}
