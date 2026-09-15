import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@sordi/ui";
import { toast } from "sonner";
import {
  RiArrowLeftLine,
  RiBankCardLine,
  RiWhatsappLine,
  RiMailLine,
  RiKeyLine,
  RiCheckboxCircleFill,
} from "@remixicon/react";
import { useLicenseStatus, useActivateLicense } from "@/hooks/useLicense";

// TODO: replace with Sordi's real payment-collection details once available.
const SORDI_PAYMENT_INFO = {
  bankName: "CCP",
  rib: "0000 0000 0000 0000 00",
  accountName: "SORDI SARL",
  whatsapp: "+213 000 00 00 00",
  email: "contact@sordi.app",
};

export default function UpgradePage() {
  const navigate = useNavigate();
  const { data: status } = useLicenseStatus();
  const [licenseKey, setLicenseKey] = useState("");
  const activate = useActivateLicense();

  const isActive = status?.state === "active";

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;
    activate.mutate(licenseKey.trim(), {
      onSuccess: () => {
        toast.success("Licence activée avec succès.");
        setLicenseKey("");
      },
      onError: (error: unknown) => {
        const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
        toast.error(message || "Échec de l'activation.");
      },
    });
  };

  return (
    <main className="flex-1 p-8 space-y-8 max-w-2xl">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <RiArrowLeftLine className="w-4 h-4" />
              Retour
            </button>
            <h1 className="text-2xl font-bold text-foreground">Passer à Sordi Pro</h1>
            <p className="text-muted-foreground">
              Effectuez un virement bancaire, puis activez votre licence avec la clé que nous vous enverrons.
            </p>
          </div>

          {isActive ? (
            <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800/40">
              <CardContent className="pt-6 flex items-center gap-3">
                <RiCheckboxCircleFill className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">Votre licence Sordi Pro est active</p>
                  {status?.expires_at && (
                    <p className="text-sm text-emerald-700/80 dark:text-emerald-400/70">
                      Valide jusqu'au {new Date(status.expires_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <RiBankCardLine className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">1. Effectuez le virement</CardTitle>
                  </div>
                  <CardDescription>Utilisez les coordonnées bancaires ci-dessous.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Banque</span>
                    <span className="font-medium">{SORDI_PAYMENT_INFO.bankName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Titulaire du compte</span>
                    <span className="font-medium">{SORDI_PAYMENT_INFO.accountName}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">RIB</span>
                    <span className="font-medium tabular-nums">{SORDI_PAYMENT_INFO.rib}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <RiWhatsappLine className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">2. Envoyez votre justificatif</CardTitle>
                  </div>
                  <CardDescription>
                    Envoyez une copie du virement par WhatsApp ou par e-mail, nous vous enverrons votre clé de licence en retour.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <a
                    href={`https://wa.me/${SORDI_PAYMENT_INFO.whatsapp.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 py-2 text-primary hover:underline"
                  >
                    <RiWhatsappLine className="w-4 h-4" />
                    {SORDI_PAYMENT_INFO.whatsapp}
                  </a>
                  <a
                    href={`mailto:${SORDI_PAYMENT_INFO.email}`}
                    className="flex items-center gap-2 py-2 text-primary hover:underline"
                  >
                    <RiMailLine className="w-4 h-4" />
                    {SORDI_PAYMENT_INFO.email}
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <RiKeyLine className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">3. Activez votre licence</CardTitle>
                  </div>
                  <CardDescription>Une fois votre clé reçue, entrez-la ci-dessous.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleActivate} className="flex gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="license-key" className="sr-only">Clé de licence</Label>
                      <Input
                        id="license-key"
                        value={licenseKey}
                        onChange={(e) => setLicenseKey(e.target.value)}
                        placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-X"
                        autoComplete="off"
                      />
                    </div>
                    <Button type="submit" disabled={!licenseKey.trim() || activate.isPending}>
                      {activate.isPending ? "Activation…" : "Activer"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </>
          )}
    </main>
  );
}
