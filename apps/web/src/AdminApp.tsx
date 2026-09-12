import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster, Button, Input, Label } from "@sordi/ui";
import { RiLockLine as LockIcon, RiFileCopyLine as CopyIcon, RiKey2Line as KeyIcon } from "@remixicon/react";
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

function PasswordGate({ onUnlock }: { onUnlock: (secret: string) => void }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    onUnlock(value);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <LockIcon className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Accès administrateur</h1>
          <p className="text-sm text-muted-foreground">Entrez le secret admin pour continuer.</p>
        </div>
        <Input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Secret admin"
          className="h-11"
        />
        <Button type="submit" className="w-full h-11" disabled={!value}>
          Déverrouiller
        </Button>
      </form>
    </div>
  );
}

function LicenseGenerator({ adminSecret, onInvalidSecret }: { adminSecret: string; onInvalidSecret: () => void }) {
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

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast.success("Clé copiée !");
    } catch {
      toast.error("Impossible de copier la clé.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <KeyIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Génération de licences</h1>
          <p className="text-sm text-muted-foreground">Créer une clé pour un client payé manuellement.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="client-name">Nom du client</Label>
          <Input
            id="client-name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Nom de l'entreprise ou du client"
            required
            className="h-11"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="plan">Plan</Label>
            <select
              id="plan"
              value={plan}
              onChange={(e) => handlePlanChange(e.target.value as Plan)}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="annual">Annuel</option>
              <option value="lifetime">À vie</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="duration">Durée (jours)</Label>
            <Input
              id="duration"
              type="number"
              min={1}
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value) || 0)}
              className="h-11"
            />
          </div>
        </div>

        <Button type="submit" disabled={!clientName.trim() || isSubmitting} className="w-full h-11">
          {isSubmitting ? "Génération..." : "Générer la clé"}
        </Button>
      </form>

      {generated.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Licences générées cette session</h2>
          <div className="space-y-2">
            {generated.map((lic) => (
              <div
                key={lic.licenseKey + lic.createdAt}
                className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{lic.organizationName}</p>
                  <p className="break-all font-mono text-xs text-muted-foreground">{lic.licenseKey}</p>
                  <p className="text-xs text-muted-foreground">Expire le {new Date(lic.expiresAt).toLocaleDateString("fr-FR")}</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => copyKey(lic.licenseKey)}>
                  <CopyIcon className="h-3.5 w-3.5" />
                  Copier la clé
                </Button>
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
    <div className="min-h-screen bg-background">
      {adminSecret ? (
        <LicenseGenerator adminSecret={adminSecret} onInvalidSecret={invalidateSecret} />
      ) : (
        <PasswordGate onUnlock={unlock} />
      )}
      <Toaster />
    </div>
  );
}
