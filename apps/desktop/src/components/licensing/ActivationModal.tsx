import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button, Input, Label } from "@sordi/ui";
import {
  RiKeyLine as KeyIcon,
  RiInfinityLine as InfiniteIcon,
  RiRefreshLine as RefreshIcon,
  RiCustomerService2Line as SupportIcon,
  RiShieldCheckLine as ShieldIcon,
} from "@remixicon/react";
import { useActivateLicense } from "@/hooks/useLicense";

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

/**
 * Focused activation flow: left column establishes product value (Pro
 * benefits only — no machine id here, see WorkspaceAccountMenu.tsx for
 * that), right column is purely "enter your key, validate it". No
 * payment/banking flow lives in this modal anymore — ordering a license
 * happens outside the app; this is activation only.
 */
export function ActivationModal({ open, onOpenChange }: ActivationModalProps) {
  const activate = useActivateLicense();
  const [licenseKey, setLicenseKey] = useState("");

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
        className="p-0 gap-0 max-w-2xl w-[640px] rounded-xl border border-border/60 overflow-hidden bg-background shadow-2xl"
      >
        {/* Visually-hidden title/description for screen readers — the
            columns below carry the real visual heading. */}
        <DialogTitle className="sr-only">Activer Sordi Invoicing</DialogTitle>
        <DialogDescription className="sr-only">
          Saisissez votre clé de licence pour activer la version complète de Sordi Invoicing.
        </DialogDescription>

        <div className="flex max-h-[85vh]">
          {/* Left column — product value only */}
          <div className="w-[42%] shrink-0 bg-muted/40 border-r border-border/60 p-6 flex flex-col gap-6 overflow-y-auto">
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
          </div>

          {/* Right column — activation only */}
          <div className="flex-1 min-w-0 p-6 flex flex-col justify-center overflow-y-auto">
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
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
