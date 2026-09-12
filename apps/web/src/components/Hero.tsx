import { useMemo } from "react";
import { Apple, PlayCircle } from "lucide-react";
import { detectOS } from "@/lib/detectOS";
import { FloatingCards } from "./FloatingCards";

interface HeroProps {
  onDownload: (os: "macos" | "windows") => void;
}

export function Hero({ onDownload }: HeroProps) {
  const os = useMemo(detectOS, []);

  return (
    <section id="top" className="relative bg-white overflow-hidden">
      <div className="max-w-5xl mx-auto px-6 pt-20 pb-4 text-center relative z-10">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold px-3.5 py-1.5 mb-7">
          ⚡ Version Desktop macOS disponible — 14 jours d'essai gratuit
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-[-0.03em] text-balance max-w-3xl mx-auto text-neutral-900">
          La clarté financière, enfin simple pour votre entreprise.
        </h1>

        <p className="mt-5 text-base sm:text-lg text-neutral-500 max-w-xl mx-auto text-balance">
          Facturation, devis et trésorerie pour entreprises et indépendants — 100% hors-ligne, vos données ne quittent jamais votre machine.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onDownload("macos")}
            className="h-12 px-6 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-primary-hover transition-colors"
          >
            <Apple className="w-4 h-4" />
            {os === "macos" ? "Télécharger pour macOS (.dmg)" : "Télécharger l'application"}
          </button>
          <a
            href="#demo"
            className="h-12 px-6 inline-flex items-center gap-2 rounded-full border border-neutral-200/80 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            Voir la démo vidéo
          </a>
        </div>

        <p className="mt-4 text-xs text-neutral-400">Aucune carte bancaire requise · Installation en moins de 2 minutes</p>
      </div>

      <FloatingCards />
    </section>
  );
}
