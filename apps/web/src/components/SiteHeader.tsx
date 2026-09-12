import { Download } from "lucide-react";
import { SordiLogo } from "./SordiLogo";

interface SiteHeaderProps {
  onDownload: () => void;
}

const NAV_LINKS = [
  { label: "Fonctionnalités", href: "#fonctionnalites" },
  { label: "Tarifs", href: "#tarifs" },
  { label: "Témoignages", href: "#temoignages" },
  { label: "FAQ", href: "#faq" },
];

export function SiteHeader({ onDownload }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center">
          <SordiLogo className="h-6 w-auto text-neutral-900" />
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-500">
          {NAV_LINKS.map((link) => (
            <a key={link.label} href={link.href} className="hover:text-neutral-900 transition-colors">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <a
            href="/admin"
            className="hidden sm:inline text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Accès Admin
          </a>
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-sm shadow-primary/20 hover:bg-primary-hover transition-colors"
          >
            <Download className="w-4 h-4" />
            Télécharger l'application
          </button>
        </div>
      </div>
    </header>
  );
}
