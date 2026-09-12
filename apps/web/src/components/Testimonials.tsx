const TESTIMONIALS = [
  {
    quote: "On a arrêté Excel du jour au lendemain. La facturation prend maintenant deux minutes au lieu d'une heure.",
    author: "Sarah B.",
    role: "Gérante, SARL Atlas Digital",
  },
  {
    quote: "Le fait que tout reste sur notre machine, sans abonnement cloud, a été décisif pour notre comptable.",
    author: "Yacine M.",
    role: "Fondateur, EURL Nomad Solutions",
  },
  {
    quote: "Le mode hors-ligne est bluffant — je facture même sans connexion sur les chantiers.",
    author: "Karim T.",
    role: "Indépendant, Kahina Trading",
  },
];

export function Testimonials() {
  return (
    <section id="temoignages" className="py-24 bg-neutral-50/60 border-t border-neutral-200/80">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900">
            Ils ont repris le contrôle de leur facturation
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t) => (
            <div key={t.author} className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
              <p className="text-sm text-neutral-700 leading-relaxed mb-5">"{t.quote}"</p>
              <div>
                <p className="text-sm font-semibold text-neutral-900">{t.author}</p>
                <p className="text-xs text-neutral-400">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
