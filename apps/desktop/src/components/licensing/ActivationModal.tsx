import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@sordi/ui";
import {
  RiFileCopyLine as CopyIcon,
  RiCheckLine as CheckIcon,
  RiWhatsappLine as WhatsAppIcon,
  RiKeyLine as KeyIcon,
  RiInfinityLine as InfiniteIcon,
  RiRefreshLine as RefreshIcon,
  RiCustomerService2Line as SupportIcon,
  RiShieldCheckLine as ShieldIcon,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";
import { useActivateLicense } from "@/hooks/useLicense";
import {
  useMachineId,
  BARIDIMOB_PAYMENT_INFO,
  CPA_BANK_PAYMENT_INFO,
  buildWhatsAppActivationUrl,
} from "@/services/licensing";

interface ActivationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VALUE_HIGHLIGHTS = [
  { icon: InfiniteIcon, label: "Factures & devis illimités" },
  { icon: RefreshIcon, label: "Mises à jour incluses" },
  { icon: SupportIcon, label: "Support dédié WhatsApp" },
  { icon: ShieldIcon, label: "Données locales, jamais partagées" },
];

/** One "label + monospace value + copy button" row — the machine id and
 *  every payment field share this exact shape, so it's factored out once
 *  rather than repeated four times with slightly different className
 *  strings each time. */
function CopyField({ label, value, dense }: { label: string; value: string; dense?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast.success("Copié !");
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className={cn("flex items-center justify-between gap-2", dense ? "py-1" : "py-1.5")}>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="font-mono text-xs text-foreground tabular-nums truncate">{value}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "shrink-0 h-7 px-2 rounded-md border text-[11px] font-medium flex items-center gap-1.5 transition-all duration-150",
          copied
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        {copied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
        {copied ? "Copié" : "Copier"}
      </button>
    </div>
  );
}

/**
 * Two-column activation flow: left column establishes product value and
 * exposes the machine id (what the user sends us to get a key), right
 * column is a segmented "Activer ma clé" / "Commander & Paiement" tab flow.
 * Triggered from TrialBanner's "Activer la version complète" link.
 */
export function ActivationModal({ open, onOpenChange }: ActivationModalProps) {
  const { data: settings } = useSettings();
  const { data: machineId } = useMachineId();
  const activate = useActivateLicense();
  const [licenseKey, setLicenseKey] = useState("");

  const companyName = settings?.company_name?.trim() || "mon entreprise";
  const whatsappUrl = machineId ? buildWhatsAppActivationUrl(companyName, machineId) : undefined;

  const handleActivate = () => {
    if (!licenseKey.trim() || activate.isPending) return;
    activate.mutate(licenseKey.trim(), {
      onSuccess: () => {
        toast.success("Licence activée avec succès.");
        setLicenseKey("");
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
        toast.error(message || "Échec de l'activation. Vérifiez votre clé.");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 max-w-3xl w-[720px] rounded-xl border border-border/60 overflow-hidden bg-background shadow-2xl"
      >
        {/* Visually-hidden title/description for screen readers — the
            columns below carry the real visual heading. */}
        <DialogTitle className="sr-only">Activer Sordi Invoicing</DialogTitle>
        <DialogDescription className="sr-only">
          Envoyez votre identifiant machine et le reçu de paiement pour recevoir votre clé de licence, puis activez-la ici.
        </DialogDescription>

        <div className="flex max-h-[85vh]">
          {/* Left column — product value & machine identity */}
          <div className="w-[40%] shrink-0 bg-muted/40 border-r border-border/60 p-6 flex flex-col gap-6 overflow-y-auto">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 text-primary text-[11px] font-medium px-2.5 py-1 mb-3">
                <ShieldIcon className="w-3.5 h-3.5" />
                Version d'essai
              </div>
              <h2 className="text-lg font-semibold text-foreground leading-snug">
                Passez à la version complète
              </h2>
            </div>

            <ul className="space-y-3">
              {VALUE_HIGHLIGHTS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5 text-sm text-foreground/90">
                  <span className="shrink-0 w-6 h-6 rounded-md bg-background border border-border/60 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>

            <div className="mt-auto rounded-lg border border-border bg-background px-3 py-2.5">
              <CopyField label="Identifiant machine" value={machineId ?? "Génération en cours..."} />
              <p className="text-[10.5px] text-muted-foreground leading-relaxed pt-1">
                Envoyez cet identifiant avec votre reçu pour recevoir votre clé.
              </p>
            </div>
          </div>

          {/* Right column — action flow */}
          <div className="flex-1 min-w-0 p-6 overflow-y-auto">
            <Tabs defaultValue="activate" className="w-full">
              <TabsList className="grid grid-cols-2 w-full mb-5">
                <TabsTrigger value="activate">Activer ma clé</TabsTrigger>
                <TabsTrigger value="order">Commander & Paiement</TabsTrigger>
              </TabsList>

              <TabsContent
                value="activate"
                className="mt-0 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-left-1 duration-150"
              >
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Vous avez déjà reçu votre clé de licence par WhatsApp ou email ? Collez-la ci-dessous pour activer Sordi Invoicing.
                  </p>

                  <div className="space-y-1.5">
                    <Label htmlFor="activation-license-key" className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <KeyIcon className="w-3.5 h-3.5" />
                      Clé de licence
                    </Label>
                    <Input
                      id="activation-license-key"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-X"
                      autoComplete="off"
                      autoFocus
                      className="font-mono text-sm h-11"
                      onKeyDown={(e) => { if (e.key === "Enter") handleActivate(); }}
                    />
                  </div>

                  <Button
                    onClick={handleActivate}
                    disabled={!licenseKey.trim() || activate.isPending}
                    className="w-full h-11 text-sm font-medium"
                  >
                    {activate.isPending ? "Activation..." : "Valider ma licence"}
                  </Button>

                  <p className="text-[11px] text-muted-foreground text-center pt-1">
                    Pas encore de clé ?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        const trigger = document.querySelector<HTMLButtonElement>('[value="order"]');
                        trigger?.click();
                      }}
                      className="font-medium text-primary hover:underline"
                    >
                      Voir les moyens de paiement
                    </button>
                  </p>
                </div>
              </TabsContent>

              <TabsContent
                value="order"
                className="mt-0 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-right-1 duration-150"
              >
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-card px-3 py-2 divide-y divide-border/60">
                    <div className="pb-1">
                      <p className="text-xs font-semibold text-foreground">{BARIDIMOB_PAYMENT_INFO.label}</p>
                    </div>
                    <CopyField dense label="RIP" value={BARIDIMOB_PAYMENT_INFO.rip} />
                    <CopyField dense label="Numéro de compte" value={BARIDIMOB_PAYMENT_INFO.accountNumber} />
                    <CopyField dense label="Titulaire" value={BARIDIMOB_PAYMENT_INFO.accountHolder} />
                  </div>

                  <div className="rounded-lg border border-border bg-card px-3 py-2 divide-y divide-border/60">
                    <div className="pb-1">
                      <p className="text-xs font-semibold text-foreground">{CPA_BANK_PAYMENT_INFO.label}</p>
                      <p className="text-[11px] text-muted-foreground">Virement bancaire</p>
                    </div>
                    <CopyField dense label="RIB" value={CPA_BANK_PAYMENT_INFO.rib} />
                    <CopyField dense label="Titulaire" value={CPA_BANK_PAYMENT_INFO.accountHolder} />
                  </div>

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={!whatsappUrl}
                    onClick={(e) => { if (!whatsappUrl) e.preventDefault(); }}
                    className={cn(
                      "bg-primary text-primary-foreground font-medium w-full flex items-center justify-center gap-2 h-11 rounded-md transition-colors hover:bg-primary-hover text-sm",
                      !whatsappUrl && "opacity-50 pointer-events-none"
                    )}
                  >
                    <WhatsAppIcon className="w-4 h-4" />
                    Envoyer le reçu sur WhatsApp →
                  </a>

                  <p className="text-[11px] text-muted-foreground text-center leading-relaxed pt-1">
                    Votre clé de licence vous sera envoyée par WhatsApp après vérification du paiement.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
