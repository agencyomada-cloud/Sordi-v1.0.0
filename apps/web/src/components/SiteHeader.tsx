import { Button } from "@sordi/ui";
import { RiShieldCheckLine as LogoIcon } from "@remixicon/react";

interface SiteHeaderProps {
  onDownload: () => void;
}

export function SiteHeader({ onDownload }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center">
            <LogoIcon className="w-4 h-4 text-slate-700" />
          </div>
          <span className="font-semibold text-sm text-slate-900">Sordi Finance</span>
        </div>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-slate-500">
          <a href="#fonctionnalites" className="hover:text-slate-900 transition-colors">
            Fonctionnalités
          </a>
          <a href="#tarifs" className="hover:text-slate-900 transition-colors">
            Tarifs
          </a>
          <a href="#faq" className="hover:text-slate-900 transition-colors">
            FAQ
          </a>
        </nav>
        <Button size="sm" onClick={onDownload}>
          Télécharger
        </Button>
      </div>
    </header>
  );
}
