import { Button } from "@sordi/ui";
import { RiAppleFill as AppleIcon, RiWindowsFill as WindowsIcon, RiArrowRightLine as ArrowIcon } from "@remixicon/react";
import { InvoiceSandbox } from "./InvoiceSandbox";
import { DesktopShowcase } from "./DesktopShowcase";

interface HeroProps {
  onDownload: (os: "macos" | "windows") => void;
}

export function Hero({ onDownload }: HeroProps) {
  return (
    <section className="relative bg-white">
      <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 text-xs font-medium px-3.5 py-1.5 mb-6 text-slate-600">
          Conçu pour les entreprises et freelances algériens
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-[-0.03em] text-balance max-w-3xl mx-auto text-slate-900">
          La gestion financière des entreprises modernes, repensée.
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-500 max-w-xl mx-auto text-balance">
          Facturation, devis, trésorerie et créances — 100% hors-ligne, 100% local, sans abonnement cloud imposé.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={() => onDownload("macos")}
            className="h-11 px-6 flex items-center gap-2 transition-colors duration-200"
          >
            <AppleIcon className="w-4 h-4" />
            Télécharger gratuitement
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => onDownload("windows")}
            className="h-11 px-6 flex items-center gap-2 border-slate-200 hover:bg-slate-50 transition-colors duration-200"
          >
            <WindowsIcon className="w-4 h-4" />
            Version Windows
          </Button>
        </div>

        <a
          href="#fonctionnalites"
          className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          Voir les fonctionnalités
          <ArrowIcon className="w-3.5 h-3.5" />
        </a>

        {/* Interactive sandbox — a live, editable invoice calculator. */}
        <InvoiceSandbox />

        {/* Real desktop app screenshot in an authentic macOS window frame
            (falls back to a stylized dashboard mockup until a real
            screenshot is dropped in — see DesktopShowcase.tsx). */}
        <DesktopShowcase />
      </div>
    </section>
  );
}
