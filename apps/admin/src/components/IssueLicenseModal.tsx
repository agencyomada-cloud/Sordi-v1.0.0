import { useState } from "react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sordi/ui";
import { RiFileCopyLine as CopyIcon, RiCheckLine as CheckIcon, RiWhatsappLine as WhatsAppIcon } from "@remixicon/react";
import type { DeviceRow } from "@/lib/adminApi";
import { useIssueLicense } from "@/hooks/useIssueLicense";

interface IssueLicenseModalProps {
  device: DeviceRow | null;
  onOpenChange: (open: boolean) => void;
}

// Matches src-tauri/src/bin/keygen.rs's own "annual | lifetime" convention
// (36 500 days ≈ 100 years — there's no separate "lifetime" claim on the
// wire, just a very long expiry).
const DURATION_OPTIONS = [
  { value: "365", label: "1 an" },
  { value: "730", label: "2 ans" },
  { value: "36500", label: "À vie" },
];

function buildWhatsAppMessage(machineId: string, token: string, validUntil: string): string {
  const formattedDate = new Date(validUntil).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  return (
    `Bonjour, voici votre clé d'activation Sordi Finance pour l'appareil ${machineId}.\n\n` +
    `Valide jusqu'au ${formattedDate}.\n\n` +
    `Collez ce code dans le champ "Activer ma clé" de l'application :\n\n${token}`
  );
}

export function IssueLicenseModal({ device, onOpenChange }: IssueLicenseModalProps) {
  const [validDays, setValidDays] = useState("365");
  const [copied, setCopied] = useState(false);
  const issueLicense = useIssueLicense();

  const open = device !== null;

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      issueLicense.reset();
      setCopied(false);
    }
    onOpenChange(nextOpen);
  };

  const handleIssue = () => {
    if (!device) return;
    const days = Number.parseInt(validDays, 10);
    issueLicense.mutate(
      { machineId: device.machineId, validDays: days, licenseType: days >= 36500 ? "lifetime" : "yearly" },
      {
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Échec de l'émission de la licence.");
        },
      }
    );
  };

  const handleCopyWhatsApp = () => {
    if (!issueLicense.data || !device) return;
    const message = buildWhatsAppMessage(device.machineId, issueLicense.data.token, issueLicense.data.valid_until);
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      toast.success("Message copié !");
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Émettre une licence</DialogTitle>
          <DialogDescription>
            {device ? (
              <>
                Pour l'appareil <span className="font-mono text-xs">{device.machineId}</span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {!issueLicense.data ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Durée</Label>
              <Select value={validDays} onValueChange={setValidDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleIssue} disabled={issueLicense.isPending} className="w-full">
              {issueLicense.isPending ? "Émission..." : "Émettre la licence"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Jeton signé</p>
              <p className="font-mono text-[11px] text-foreground break-all leading-relaxed">{issueLicense.data.token}</p>
            </div>

            <p className="text-xs text-muted-foreground">
              Valide jusqu'au{" "}
              {new Date(issueLicense.data.valid_until).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              .
            </p>

            <Button onClick={handleCopyWhatsApp} className="w-full flex items-center justify-center gap-2">
              {copied ? <CheckIcon className="w-4 h-4" /> : <WhatsAppIcon className="w-4 h-4" />}
              {copied ? "Copié !" : "Copier le message WhatsApp"}
            </Button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(issueLicense.data!.token);
                toast.success("Jeton copié !");
              }}
              className="w-full text-center text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5"
            >
              <CopyIcon className="w-3.5 h-3.5" />
              Copier uniquement le jeton
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
