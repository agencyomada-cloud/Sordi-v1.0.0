import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { FALLBACK_APP_VERSION } from "@/lib/pdfGenerator";

const logoHorizontal = "/brand/sordi-logo.svg";

// Purely decorative — this window has no IPC channel back to the main
// window's real bootstrap progress (SQLite init, workspace/company load,
// theme resolution all happen on their own, independent timelines), so
// this cycles on a plain timer instead of trying to wire one up. It only
// needs to *look* like real progress for however long the main window
// actually takes; the close_splashscreen command that tears this window
// down is invoked by the main window itself once it's truly ready (see
// App.tsx's useSplashDismissal), never by anything in here.
const STEPS = [
  "Initialisation du moteur SQLite...",
  "Vérification de l'espace entreprise...",
  "Préparation de l'interface...",
  "Prêt.",
];

export default function SplashScreen() {
  const [stepIndex, setStepIndex] = useState(0);
  const [version, setVersion] = useState(FALLBACK_APP_VERSION);

  useEffect(() => {
    document.documentElement.classList.add("splash-window");
    return () => document.documentElement.classList.remove("splash-window");
  }, []);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(FALLBACK_APP_VERSION));
  }, []);

  useEffect(() => {
    if (stepIndex >= STEPS.length - 1) return;
    const id = setTimeout(() => setStepIndex((i) => i + 1), 550);
    return () => clearTimeout(id);
  }, [stepIndex]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-transparent select-none" data-tauri-drag-region>
      <div
        className="w-[400px] h-[240px] rounded-2xl border border-border/80 bg-background shadow-2xl flex flex-col items-center justify-between py-8 px-6"
        data-tauri-drag-region
      >
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <img src={logoHorizontal} alt="Sordi" className="h-8 w-auto" draggable={false} />
          <span className="text-[10px] font-mono text-muted-foreground/70 tracking-wide">v{version}</span>
        </div>

        <div className="w-full flex flex-col items-center gap-2.5">
          {/* Thin indeterminate progress bar — a single sliding segment on
              a 1.5px track, no percentage (nothing here reflects a real
              measurable fraction of work). */}
          <div className="w-full h-[1.5px] bg-border/60 rounded-full overflow-hidden relative">
            <div className="absolute inset-y-0 w-1/3 bg-foreground/70 rounded-full animate-splash-indeterminate" />
          </div>
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums">{STEPS[stepIndex]}</span>
        </div>
      </div>
    </div>
  );
}
