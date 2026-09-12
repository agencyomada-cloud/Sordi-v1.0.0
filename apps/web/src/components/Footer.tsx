import { Button } from "@sordi/ui";
import {
  RiShieldCheckLine as LogoIcon,
  RiSecurePaymentLine as BaridiMobIcon,
  RiWallet3Line as CcpIcon,
  RiBankLine as BankIcon,
  RiMailLine as EmailIcon,
} from "@remixicon/react";

const SUPPORT_EMAIL = "support@sordi.finance";

interface FooterProps {
  onDownload: () => void;
}

const PRODUIT_LINKS = [
  { label: "Fonctionnalités", href: "#fonctionnalites" },
  { label: "Tarifs", href: "#tarifs" },
  { label: "FAQ", href: "#faq" },
];

const LEGAL_LINKS = [
  { label: "Conditions d'utilisation", href: "#" },
  { label: "Politique de confidentialité", href: "#" },
  { label: "Mentions légales", href: "#" },
];

const PAYMENT_METHODS = [
  { icon: BaridiMobIcon, label: "BaridiMob" },
  { icon: CcpIcon, label: "CCP" },
  { icon: BankIcon, label: "Virement bancaire CPA" },
];

export function Footer({ onDownload }: FooterProps) {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-10">
        {/* Pre-footer CTA banner */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 md:p-14 text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mb-3">
            Prenez le contrôle de vos finances
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Aucune carte bancaire requise. Aucun engagement. Installez et commencez à facturer en quelques minutes.
          </p>
          <Button size="lg" onClick={onDownload} className="h-11 px-6">
            Télécharger gratuitement
          </Button>
        </div>

        {/* 4-column footer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center">
                <LogoIcon className="w-4 h-4 text-slate-700" />
              </div>
              <span className="font-semibold text-sm text-slate-900">Sordi Finance</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-[220px]">
              Le logiciel de gestion financière hors-ligne pensé pour les entreprises et freelances algériens.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Produit</h3>
            <ul className="space-y-2">
              {PRODUIT_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Légal</h3>
            <ul className="space-y-2 mb-4">
              {LEGAL_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors"
            >
              <EmailIcon className="w-4 h-4" />
              Contacter le support
            </a>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Moyens de paiement locaux
            </h3>
            <ul className="space-y-2.5">
              {PAYMENT_METHODS.map((method) => (
                <li key={method.label} className="flex items-center gap-2 text-sm text-slate-500">
                  <method.icon className="w-4 h-4 shrink-0" />
                  {method.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-6 text-center">
          <p className="text-xs text-slate-400">© 2026 Sordi Finance. Conçu avec soin pour les entreprises algériennes.</p>
        </div>
      </div>
    </footer>
  );
}
