import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@sordi/ui";

const FAQ_ITEMS = [
  {
    question: "Comment puis-je payer ma licence ?",
    answer:
      "Vous pouvez régler par BaridiMob/CCP ou par virement bancaire CPA. Une fois le paiement confirmé, votre clé de licence vous est envoyée directement par email.",
  },
  {
    question: "Mes données sont-elles en sécurité ?",
    answer:
      "Oui. Sordi Finance fonctionne entièrement hors-ligne : vos données restent stockées localement sur votre ordinateur, jamais sur un serveur cloud tiers. Vous seul y avez accès.",
  },
  {
    question: "Ai-je besoin d'internet pour utiliser l'application ?",
    answer:
      "Non. L'application fonctionne 100% hors-ligne. Une connexion internet n'est utile que pour l'activation de la licence ou les mises à jour, jamais pour votre travail quotidien.",
  },
  {
    question: "Comment obtenir de l'aide si j'ai un problème ?",
    answer:
      "Notre équipe support est disponible par email, en français ou en arabe, pour répondre rapidement à vos questions techniques ou de facturation.",
  },
  {
    question: "Puis-je utiliser Sordi Finance sur plusieurs ordinateurs ?",
    answer:
      "Chaque licence est liée à un poste de travail. Pour un usage sur plusieurs machines, contactez notre équipe support par email pour discuter d'une offre adaptée.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="py-20">
      <div className="max-w-2xl mx-auto px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Questions fréquentes</h2>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={item.question} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-sm font-medium">{item.question}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
