import { useState } from "react";
import { RiErrorWarningLine } from "@remixicon/react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label } from "@sordi/ui";
import { toast } from "sonner";
import { useLicenseStatus, useActivateLicense, useLicenseBackgroundVerify } from "@/hooks/useLicense";

export function LicenseBanner() {
  useLicenseBackgroundVerify();
  const { data: status } = useLicenseStatus();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const activate = useActivateLicense();

  if (!status || status.state === "active") {
    return null;
  }

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;
    activate.mutate(licenseKey.trim(), {
      onSuccess: () => {
        toast.success("Licence activée avec succès.");
        setIsDialogOpen(false);
        setLicenseKey("");
      },
      onError: (error: unknown) => {
        // Tauri rejects a Result::Err(String) command with the raw string,
        // not an Error instance — this is the message from apps/api or
        // license.rs (e.g. "Invalid or expired license.", or the device
        // limit message), not a generic wrapper.
        const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
        toast.error(message || "Échec de l'activation.");
      },
    });
  };

  return (
    <>
      <div className="flex items-center justify-center gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-sm">
        <RiErrorWarningLine className="w-4 h-4 shrink-0" />
        <span>
          {status.state === "not_activated"
            ? "Votre licence Sordi n'est pas activée sur cet appareil."
            : "Votre licence Sordi a expiré."}{" "}
          La création et la modification sont désactivées — la consultation et l'export restent disponibles.
        </span>
        <Button size="sm" variant="outline" className="shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100" onClick={() => setIsDialogOpen(true)}>
          Activer ma licence
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Activer votre licence</DialogTitle>
            <DialogDescription>Entrez la clé de licence fournie lors de votre achat.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleActivate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="license-key">Clé de licence</Label>
              <Input
                id="license-key"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-X"
                autoFocus
                autoComplete="off"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!licenseKey.trim() || activate.isPending}>
                {activate.isPending ? "Activation…" : "Activer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
