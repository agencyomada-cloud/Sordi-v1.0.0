import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button } from "@sordi/ui";
import { RiLockLine as LockIcon, RiWhatsappLine as WhatsAppIcon } from "@remixicon/react";
import { useSettings } from "@/hooks/useSettings";
import { useMachineId, buildWhatsAppActivationUrl } from "@/services/licensing";
import { ActivationModal } from "@/components/licensing/ActivationModal";

interface LicenseBlockedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Blocking alert shown the instant a write action is attempted with no
 * active license (useLicenseGate's requireActive) — distinct from
 * TrialBanner, which is a passive, dismissible-by-navigation strip. This
 * is a modal precisely because the user just tried to do something that
 * cannot happen, and needs to be told why before being routed to either
 * paste a key they already have (ActivationModal) or ask for one
 * (WhatsApp).
 */
export function LicenseBlockedModal({ open, onOpenChange }: LicenseBlockedModalProps) {
  const { data: settings } = useSettings();
  const { data: machineId } = useMachineId();
  const [activationOpen, setActivationOpen] = useState(false);

  const companyName = settings?.company_name?.trim() || "mon entreprise";
  const whatsappUrl = machineId ? buildWhatsAppActivationUrl(companyName, machineId) : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden gap-0">
          <div className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
              <LockIcon className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle asChild>
              <h2 className="text-lg font-semibold text-foreground">Période d'essai terminée</h2>
            </DialogTitle>
            <DialogDescription asChild>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Votre période d'essai de 14 jours est terminée. Veuillez activer votre licence pour continuer à
                créer des factures et gérer votre activité.
              </p>
            </DialogDescription>

            <div className="mt-6 flex flex-col gap-2">
              <Button
                className="h-11 w-full gap-2"
                onClick={() => {
                  onOpenChange(false);
                  setActivationOpen(true);
                }}
              >
                Activer ma licence
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full gap-2"
                asChild
                disabled={!whatsappUrl}
              >
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!whatsappUrl}
                  onClick={(e) => {
                    if (!whatsappUrl) e.preventDefault();
                  }}
                >
                  <WhatsAppIcon className="h-4 w-4 text-emerald-600" />
                  Nous contacter sur WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ActivationModal open={activationOpen} onOpenChange={setActivationOpen} />
    </>
  );
}
