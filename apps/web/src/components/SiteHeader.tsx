import { useState } from "react";
import { Download, Menu, X } from "lucide-react";
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
  const [mobileOpen, setMobileOpen] = useState(false);

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
            <span className="hidden sm:inline">Télécharger l'application</span>
            <span className="sm:hidden">Télécharger</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileOpen}
            className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-full text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="md:hidden border-t border-neutral-200/80 bg-white px-6 py-4 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="py-2.5 text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
            >
              {link.label}
            </a>
          ))}
          <a
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className="py-2.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Accès Admin
          </a>
        </nav>
      )}
    </header>
  );
}
