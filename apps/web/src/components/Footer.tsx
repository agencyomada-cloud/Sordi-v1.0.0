import { Wallet, Landmark, ShieldCheck, MessageCircle } from "lucide-react";
import { SordiLogo } from "./SordiLogo";
import { buildWhatsAppSupportUrl } from "@/lib/support";

interface FooterProps {
  onDownload: () => void;
}

const PRODUIT_LINKS = [
  { label: "Fonctionnalités", href: "#fonctionnalites" },
  { label: "Tarifs", href: "#tarifs" },
  { label: "Témoignages", href: "#temoignages" },
  { label: "FAQ", href: "#faq" },
];

const LEGAL_LINKS = [
  { label: "Conditions d'utilisation", href: "#" },
  { label: "Politique de confidentialité", href: "#" },
  { label: "Mentions légales", href: "#" },
];

const PAYMENT_METHODS = [
  { icon: Wallet, label: "BaridiMob" },
  { icon: ShieldCheck, label: "CCP" },
  { icon: Landmark, label: "Virement bancaire CPA" },
];

export function Footer({ onDownload }: FooterProps) {
  return (
    <footer className="bg-white border-t border-neutral-200/80">
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-10">
        {/* Pre-footer CTA banner */}
        <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/60 p-10 md:p-14 text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900 mb-3">
            Prenez le contrôle de vos finances
          </h2>
          <p className="text-sm text-neutral-500 max-w-md mx-auto mb-6">
            Aucune carte bancaire requise. Aucun engagement. Installez et commencez à facturer en quelques minutes.
          </p>
          <button
            type="button"
            onClick={onDownload}
            className="h-12 px-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-primary-hover transition-colors"
          >
            Télécharger gratuitement
          </button>
        </div>

        {/* 4-column footer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <SordiLogo className="h-6 w-auto text-neutral-900 mb-3" />
            <p className="text-xs text-neutral-500 leading-relaxed max-w-[220px]">
              Le logiciel de gestion financière hors-ligne pensé pour les entreprises et freelances algériens.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Produit</h3>
            <ul className="space-y-2">
              {PRODUIT_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Légal</h3>
            <ul className="space-y-2 mb-4">
              {LEGAL_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <a
              href={buildWhatsAppSupportUrl()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Support WhatsApp
            </a>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
              Moyens de paiement locaux
            </h3>
            <ul className="space-y-2.5">
              {PAYMENT_METHODS.map((method) => (
                <li key={method.label} className="flex items-center gap-2 text-sm text-neutral-500">
                  <method.icon className="w-4 h-4 shrink-0" />
                  {method.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-neutral-200/80 pt-6 text-center">
          <p className="text-xs text-neutral-400">© 2026 Sordi Invoicing. Conçu avec soin pour les entreprises algériennes.</p>
        </div>
      </div>
    </footer>
  );
}
