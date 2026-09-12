import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ_ITEMS = [
  {
    question: "Comment installer Sordi Invoicing sur mon Mac ?",
    answer:
      "Téléchargez le fichier .dmg, ouvrez-le, puis glissez l'application dans votre dossier Applications. Aucune configuration supplémentaire n'est nécessaire — l'application est prête dès le premier lancement.",
  },
  {
    question: "Mes données sont-elles en sécurité ?",
    answer:
      "Oui. Sordi Invoicing fonctionne entièrement hors-ligne : vos données restent stockées localement sur votre ordinateur, jamais sur un serveur cloud tiers. Vous seul y avez accès — c'est une question de souveraineté de vos données autant que de sécurité.",
  },
  {
    question: "Ai-je besoin d'internet pour utiliser l'application ?",
    answer:
      "Non. L'application fonctionne 100% hors-ligne. Une connexion internet n'est utile que pour l'activation de la licence ou les mises à jour, jamais pour votre travail quotidien.",
  },
  {
    question: "Comment fonctionne la licence ?",
    answer:
      "Chaque licence est liée à un poste de travail. Après l'essai gratuit de 14 jours, vous choisissez un forfait annuel ou à vie ; votre clé d'activation vous est envoyée par email dès confirmation du paiement.",
  },
  {
    question: "Comment obtenir de l'aide si j'ai un problème ?",
    answer:
      "Notre équipe support est disponible par email ou WhatsApp, en français ou en arabe, pour répondre rapidement à vos questions techniques ou de facturation.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 bg-neutral-50/60 border-t border-neutral-200/80">
      <div className="max-w-2xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900">Questions fréquentes</h2>
        </div>

        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={item.question} className="rounded-xl border border-neutral-200/80 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-4 text-left"
                >
                  <span className="text-sm font-medium text-neutral-900">{item.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <p className="px-4 pb-4 text-sm text-neutral-500 leading-relaxed">{item.answer}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
