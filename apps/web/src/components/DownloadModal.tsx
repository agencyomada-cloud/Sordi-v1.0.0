import { useState } from "react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Label,
} from "@sordi/ui";
import { RiAppleFill as AppleIcon, RiWindowsFill as WindowsIcon, RiLockLine as LockIcon } from "@remixicon/react";
import { webApi } from "@/lib/webApi";

interface DownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  osType: "macos" | "windows";
}

const OS_LABEL: Record<"macos" | "windows", string> = { macos: "macOS", windows: "Windows" };
const OS_ICON: Record<"macos" | "windows", React.ElementType> = { macos: AppleIcon, windows: WindowsIcon };

// Slightly stronger/larger focus ring than @sordi/ui's dense-desktop-app
// default (focus-visible:ring-2 ring-ring/20) — a marketing-page form
// benefits from a more visible, premium-feeling accent state than a
// data-table-adjacent input does.
const REFINED_FOCUS_RING = "h-11 focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:border-primary";

/** Triggers the actual installer download by navigating the browser to the
 *  URL the server returns (its own DOWNLOAD_URL_MACOS/WINDOWS env var) —
 *  this component never hardcodes a download target itself. */
function triggerDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// Static fallback so the actual file download never depends on the lead
// API being reachable — the API is a nice-to-have for lead capture, but a
// visitor clicking "Télécharger" must always get their file even if the
// API call fails, times out, or the backend is down.
const FALLBACK_DOWNLOAD_URL: Record<"macos" | "windows", string> = {
  macos: "/downloads/sordi-finance-mac.dmg",
  windows: "/downloads/sordi-finance-win.exe",
};

export function DownloadModal({ open, onOpenChange, osType }: DownloadModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const Icon = OS_ICON[osType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || isSubmitting) return;

    setIsSubmitting(true);

    // The lead-capture call is best-effort analytics, not a gate on the
    // download itself: a visitor must get their file even if the API is
    // unreachable, slow, or returns an error.
    let downloadUrl: string = FALLBACK_DOWNLOAD_URL[osType];
    try {
      const result = await webApi.submitDownloadLead({
        name: name.trim(),
        phone: phone.trim(),
        company: company.trim() || undefined,
        osType,
      });
      downloadUrl = result.downloadUrl;
    } catch (error) {
      console.error("Lead capture failed, proceeding with fallback download", error);
    }

    triggerDownload(downloadUrl);
    toast.success("Téléchargement lancé !");
    onOpenChange(false);
    setName("");
    setPhone("");
    setCompany("");
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md backdrop-blur-xl bg-popover/95">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            Télécharger pour {OS_LABEL[osType]}
          </DialogTitle>
          <DialogDescription>
            Quelques informations avant de commencer votre essai gratuit de 14 jours.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Nom complet</Label>
            <Input
              id="lead-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Votre nom"
              autoFocus
              required
              className={REFINED_FOCUS_RING}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-phone">Numéro de téléphone professionnel</Label>
            <Input
              id="lead-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ""))}
              placeholder="05 XX XX XX XX"
              inputMode="tel"
              required
              className={REFINED_FOCUS_RING}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-company">Nom de l'entreprise (optionnel)</Label>
            <Input
              id="lead-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Nom de votre entreprise"
              className={REFINED_FOCUS_RING}
            />
          </div>

          <Button type="submit" disabled={!name.trim() || !phone.trim() || isSubmitting} className="w-full h-11">
            {isSubmitting ? "Préparation..." : "Télécharger gratuitement"}
          </Button>

          <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <LockIcon className="w-3 h-3" />
            Vos données restent 100% locales • Sans engagement
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
