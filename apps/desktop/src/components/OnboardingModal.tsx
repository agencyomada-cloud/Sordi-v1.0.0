import { useEffect, useState } from "react";
import { open as openDirDialog } from "@tauri-apps/plugin-dialog";
import { Button, Dialog, DialogContent } from "@sordi/ui";
import { useSettings, useUpdateSetting } from "@/hooks/useSettings";
import {
  RiShieldCheckLine as ShieldCheck,
  RiFlashlightLine as Flash,
  RiWifiOffLine as Offline,
  RiFolder3Line as FolderIcon,
  RiArrowRightLine as ArrowRight,
} from "@remixicon/react";

type Step = 1 | 2;

/**
 * First-launch setup wizard. Fully self-contained: reads/writes its own
 * visibility off the `onboarding_completed` setting, so dropping
 * <OnboardingModal /> once into AppLayout is the entire integration.
 */
export function OnboardingModal() {
  const { data: settings, isLoading } = useSettings();
  const updateSetting = useUpdateSetting();

  const [step, setStep] = useState<Step>(1);
  const [backupDir, setBackupDir] = useState("");
  const [isPicking, setIsPicking] = useState(false);

  const open = !isLoading && settings?.onboarding_completed !== "true";

  // Pre-fill from any value already saved (e.g. wizard was skipped once,
  // then the user set a folder in Paramètres before ever finishing it).
  useEffect(() => {
    if (settings?.pdf_backup_directory) {
      setBackupDir(settings.pdf_backup_directory);
    }
  }, [settings?.pdf_backup_directory]);

  const complete = (savedDir?: string) => {
    if (savedDir) {
      updateSetting.mutate({ key: "pdf_backup_directory", value: savedDir });
    }
    updateSetting.mutate({ key: "onboarding_completed", value: "true" });
  };

  const handlePickDirectory = async () => {
    setIsPicking(true);
    try {
      const picked = await openDirDialog({ directory: true, multiple: false });
      if (typeof picked === "string") {
        setBackupDir(picked);
      }
    } finally {
      setIsPicking(false);
    }
  };

  const handleSkip = () => complete();
  const handleFinish = () => complete(backupDir || undefined);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Any dismissal (Escape, backdrop click, the corner X) counts as a
        // skip — the flag always gets written so the wizard can't silently
        // reappear on next launch after being closed one way or another.
        if (!nextOpen) handleSkip();
      }}
    >
      <DialogContent className="max-w-lg rounded-2xl border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl p-0 overflow-hidden gap-0">
        {step === 1 ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Bienvenue sur Sordi</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Sordi fonctionne <strong className="text-foreground">100% hors ligne</strong> — toutes vos
              données restent sur cet ordinateur, sans latence cloud et sans compromis sur la
              confidentialité. Conçu pour la gestion commerciale des entreprises algériennes.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3 text-left">
              <div className="rounded-xl border border-border/50 p-3">
                <Offline className="h-4 w-4 text-primary mb-1.5" />
                <p className="text-xs font-medium text-foreground">Hors ligne</p>
              </div>
              <div className="rounded-xl border border-border/50 p-3">
                <ShieldCheck className="h-4 w-4 text-primary mb-1.5" />
                <p className="text-xs font-medium text-foreground">Confidentiel</p>
              </div>
              <div className="rounded-xl border border-border/50 p-3">
                <Flash className="h-4 w-4 text-primary mb-1.5" />
                <p className="text-xs font-medium text-foreground">Instantané</p>
              </div>
            </div>

            <Button className="mt-8 w-full gap-2" size="lg" onClick={() => setStep(2)}>
              Continuer
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="p-8">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <FolderIcon className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Sauvegarde automatique des PDF</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Chaque facture, proforma et bon de livraison généré sera automatiquement enregistré
              sous forme de copie structurée dans le dossier de votre choix.
            </p>

            <div className="mt-5 flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 p-3">
              <FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm text-muted-foreground">
                {backupDir || "Aucun dossier sélectionné"}
              </span>
            </div>

            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={handlePickDirectory}
              disabled={isPicking}
            >
              {isPicking ? "Sélection..." : "Choisir un dossier"}
            </Button>

            <p className="mt-3 text-xs text-muted-foreground">
              Vous pourrez modifier ce dossier à tout moment dans les Paramètres.
            </p>

            <div className="mt-8 flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={handleSkip}>
                Ignorer
              </Button>
              <Button className="flex-1" onClick={handleFinish}>
                Terminer et commencer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
