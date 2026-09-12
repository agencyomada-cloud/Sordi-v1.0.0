import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import {
  RiDatabase2Line as SystemIcon,
  RiExternalLinkLine as ExternalLinkIcon,
  RiCheckboxCircleLine as CheckIcon,
  RiClipboardLine as DiagnosticsIcon,
  RiCloseLine as CloseIcon,
} from "@remixicon/react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetClose,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Button,
  StatusBadge,
} from "@sordi/ui";
import { CopyChip } from "@/components/ui/copy-chip";
import { useAppDataDir } from "@/hooks/useAppDataDir";
import { useWorkspace } from "@/hooks/useWorkspace";
import { FALLBACK_APP_VERSION } from "@/lib/pdfGenerator";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "shortcuts", label: "Raccourcis" },
  { value: "guides", label: "Guides" },
  { value: "system", label: "Système" },
  { value: "support", label: "Support" },
];

const SHORTCUTS = [
  { keys: "⌘K / Ctrl+K", description: "Palette de commandes & navigation rapide" },
  { keys: "N", description: "Nouvelle entrée (sur Factures, Clients, Dépenses, etc.)" },
  { keys: "↑ / ↓ + Entrée", description: "Navigation et sélection dans les grilles" },
  { keys: "⌘B / Ctrl+B", description: "Afficher / Masquer la barre latérale" },
  { keys: "Échap", description: "Fermer tiroir / Réinitialiser filtres" },
];

const GUIDES = [
  {
    id: "cycle-commercial",
    title: "Cycle Commercial",
    summary: "Devis → Bon de Commande → Bon de Livraison → Facture",
    body: (
      <p>
        Le flux standard part d'un <strong>Devis (Proforma)</strong> envoyé au client, converti en{" "}
        <strong>Bon de Commande</strong> une fois accepté. La livraison génère un{" "}
        <strong>Bon de Livraison</strong> traçant les quantités sorties, puis la <strong>Facture</strong>{" "}
        clôture le cycle — chaque document reste lié au précédent pour un audit de bout en bout sans ressaisie.
      </p>
    ),
  },
  {
    id: "conformite-fiscale",
    title: "Conformité Fiscale Algérienne",
    summary: "Mentions obligatoires (NIF, NIS, RC, AI), Timbre Fiscal, TVA 19% / 9%",
    body: (
      <p>
        Chaque facture doit porter les mentions légales de l'entreprise —{" "}
        <strong>NIF, NIS, RC et AI</strong> — configurées une seule fois dans Paramètres puis reprises
        automatiquement sur tous les documents. Le <strong>Timbre Fiscal</strong> est calculé automatiquement
        selon le barème légal en vigueur dès qu'un règlement en espèces est enregistré, et la{" "}
        <strong>TVA</strong> s'applique au taux normal de <strong>19%</strong> ou au taux réduit de{" "}
        <strong>9%</strong> selon la nature du produit ou service facturé.
      </p>
    ),
  },
  {
    id: "rapprochement",
    title: "Rapprochement & Règlements",
    summary: "Paiements partiels, chèques en attente, soldes clients",
    body: (
      <p>
        Une facture peut recevoir plusieurs règlements successifs (espèces, chèque, virement) — le{" "}
        <strong>solde restant dû</strong> se met à jour après chaque paiement enregistré et le statut passe
        automatiquement à <em>Partielle</em> puis <em>Payée</em>. Les chèques en attente d'encaissement restent
        visibles jusqu'à leur date de valeur, et le solde global d'un client se consulte depuis sa fiche.
      </p>
    ),
  },
];

interface HelpArticle {
  id: string;
  tab: string;
  title: string;
  body: string;
}

/**
 * Enterprise Help Center — a slide-over sheet, not a page, so it never
 * interrupts whatever the user is doing on the page underneath. Mounted
 * once by AppLayout (sibling to Header/Sidebar, outside the routed
 * <Outlet/>), so opening it never remounts or resets the active page —
 * it's a fully separate component tree branch with its own local state.
 * Opens via the Header's "?" button (a plain window CustomEvent, the same
 * decoupled pattern Sidebar's command palette already uses for its Header
 * search trigger) or the bare "?" key from anywhere that isn't a text field.
 */
export function HelpDrawer() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("shortcuts");
  const [appVersion, setAppVersion] = useState(FALLBACK_APP_VERSION);
  const navigate = useNavigate();
  const { data: appDataDirPath } = useAppDataDir();
  const { isReady } = useWorkspace();

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  useEffect(() => {
    const handleOpenEvent = () => setOpen(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const hasOpenOverlay = !!document.querySelector('[role="dialog"], [role="alertdialog"]');
      if (e.key === "?" && !isTyping && !hasOpenOverlay && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("open-help-drawer", handleOpenEvent);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("open-help-drawer", handleOpenEvent);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Flat searchable index across every tab — typing filters across the
  // whole help center at once ("filter help articles dynamically"), not
  // just whatever tab happens to be open.
  const articles: HelpArticle[] = useMemo(
    () => [
      ...SHORTCUTS.map((s) => ({ id: s.keys, tab: "shortcuts", title: s.keys, body: s.description })),
      ...GUIDES.map((g) => ({ id: g.id, tab: "guides", title: g.title, body: g.summary })),
      {
        id: "donnees-locales",
        tab: "system",
        title: "Données locales & sauvegarde",
        body: "Emplacement des données locales SQLite et politique de sauvegarde, Intégrations & Sauvegarde",
      },
      {
        id: "exports-audit",
        tab: "system",
        title: "Exports d'audit conformes",
        body: "Exports CSV UTF-8 BOM, formats fiscaux",
      },
      { id: "support", tab: "support", title: "Support & Assistance", body: "Site officiel, email support, diagnostic système" },
    ],
    []
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return articles.filter((a) => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q));
  }, [search, articles]);

  const jumpToArticle = (article: HelpArticle) => {
    setTab(article.tab);
    setSearch("");
  };

  const handleCopyDiagnostics = () => {
    const diagnostics = {
      app_version: appVersion,
      os: navigator.platform,
      user_agent: navigator.userAgent,
      database_status: isReady ? "Opérationnelle" : "Initialisation",
      generated_at: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2)).then(
      () => toast.success("Informations de diagnostic copiées"),
      () => toast.error("Impossible de copier les informations de diagnostic")
    );
  };

  const card = "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 shadow-2xs space-y-2";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        hideClose
        overlayClassName="bg-black/30 backdrop-blur-sm"
        className="!w-[420px] !max-w-[420px] !p-0 !bg-neutral-50 dark:!bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col h-full gap-0"
      >
        {/* Header */}
        <div className="p-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-background shrink-0">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-xs font-semibold text-foreground">Centre d'aide &amp; Documentation</SheetTitle>
            <SheetClose asChild>
              <button
                type="button"
                aria-label="Fermer"
                className="h-6 w-6 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </SheetClose>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Sordi Entreprise — Guide opérationnel &amp; assistance</p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un article d'aide..."
            className="h-7 mt-2.5 px-2 text-xs bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/80 rounded-md focus:border-neutral-400 focus:outline-none placeholder:text-neutral-400 w-full"
          />
        </div>

        {/* Tabs */}
        {!searchResults && (
          <div className="p-3 pb-0 shrink-0">
            <div className="grid grid-cols-4 p-0.5 bg-neutral-200/70 dark:bg-neutral-800 rounded-lg h-7 gap-0.5">
              {TABS.map((t) => {
                const active = t.value === tab;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTab(t.value)}
                    className={cn(
                      "transition-all",
                      active
                        ? "bg-white dark:bg-neutral-700 text-foreground font-medium text-[11px] rounded-md shadow-xs flex items-center justify-center"
                        : "text-neutral-500 hover:text-foreground text-[11px] font-normal flex items-center justify-center"
                    )}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-3.5 space-y-2.5 overflow-y-auto flex-1">
          {searchResults ? (
            searchResults.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Aucun résultat pour « {search} »</p>
            ) : (
              <div className="space-y-1.5">
                {searchResults.map((article) => (
                  <button
                    key={`${article.tab}-${article.id}`}
                    onClick={() => jumpToArticle(article)}
                    className={cn(card, "w-full text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground truncate">{article.title}</span>
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground bg-neutral-100 dark:bg-neutral-800 rounded px-1.5 py-0.5">
                        {TABS.find((t) => t.value === article.tab)?.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{article.body}</p>
                  </button>
                ))}
              </div>
            )
          ) : (
            <>
              {tab === "shortcuts" && (
                <div className={card}>
                  {SHORTCUTS.map((shortcut, i) => (
                    <div
                      key={shortcut.keys}
                      className={cn(
                        "flex items-center justify-between text-xs py-1 border-b border-neutral-100 dark:border-neutral-800/60 gap-3",
                        i === SHORTCUTS.length - 1 && "border-0"
                      )}
                    >
                      <kbd className="h-5 min-w-5 px-1.5 inline-flex items-center justify-center font-mono text-[10px] font-semibold bg-muted border border-border rounded shadow-xs text-foreground shrink-0">
                        {shortcut.keys}
                      </kbd>
                      <span className="text-xs text-muted-foreground font-normal text-right truncate">{shortcut.description}</span>
                    </div>
                  ))}
                </div>
              )}

              {tab === "guides" && (
                <div className={card}>
                  <Accordion type="single" collapsible>
                    {GUIDES.map((guide) => (
                      <AccordionItem key={guide.id} value={guide.id} className="border-neutral-100 dark:border-neutral-800/60">
                        <AccordionTrigger className="py-2 text-xs font-semibold text-foreground hover:no-underline">
                          <span className="flex flex-col items-start text-left gap-0.5">
                            {guide.title}
                            <span className="text-[11px] font-normal text-muted-foreground">{guide.summary}</span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-2">
                          {guide.body}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}

              {tab === "system" && (
                <>
                  <div className={card}>
                    <div className="flex items-center gap-1.5">
                      <SystemIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold text-foreground">Données locales &amp; sauvegarde</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Toutes les données de l'entreprise sont stockées localement dans une base SQLite, sans dépendance à
                      une connexion internet.
                      {appDataDirPath && (
                        <>
                          {" "}
                          Emplacement actuel :{" "}
                          <code className="font-mono text-[10px] bg-neutral-100 dark:bg-neutral-800 rounded px-1 py-0.5 break-all">{appDataDirPath}</code>
                        </>
                      )}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] rounded-md"
                      onClick={() => {
                        setOpen(false);
                        navigate("/integrations");
                      }}
                    >
                      Intégrations &amp; Sauvegarde
                    </Button>
                  </div>
                  <div className={card}>
                    <div className="flex items-center gap-1.5">
                      <CheckIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold text-foreground">Exports d'audit conformes</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Tous les exports CSV (factures, clients, paiements, historique) sont générés en{" "}
                      <strong>UTF-8 avec BOM</strong> pour un affichage correct des caractères accentués dans Excel, et les
                      documents PDF respectent les formats fiscaux algériens en vigueur.
                    </p>
                  </div>
                </>
              )}

              {tab === "support" && (
                <>
                  <div className={card}>
                    <div>
                      <p className="text-xs font-semibold text-foreground">EURL OMADA AGENCY</p>
                      <p className="text-[11px] text-muted-foreground">Support Sordi Entreprise</p>
                    </div>

                    <button
                      onClick={() => openUrl("https://www.sordi.app").catch(() => {})}
                      className="w-full flex items-center justify-between gap-2 rounded-md border border-neutral-200 dark:border-neutral-700/80 px-2.5 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors text-left"
                    >
                      <span className="text-xs text-foreground">www.sordi.app</span>
                      <ExternalLinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </button>

                    <div className="group w-full flex items-center justify-between gap-2 rounded-md border border-neutral-200 dark:border-neutral-700/80 px-2.5 py-1.5">
                      <span className="text-xs text-foreground">contact@sordi.app</span>
                      <CopyChip value="contact@sordi.app" label="Copier l'email" />
                    </div>
                  </div>

                  <div className={card}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Diagnostic système</p>
                    <div className="flex items-center justify-between text-xs py-1 border-b border-neutral-100 dark:border-neutral-800/60">
                      <span className="text-muted-foreground">Version de l'application</span>
                      <span className="font-mono tabular-nums text-foreground">v{appVersion}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1 border-b border-neutral-100 dark:border-neutral-800/60 last:border-0">
                      <span className="text-muted-foreground">Base de données</span>
                      <StatusBadge tone={isReady ? "success" : "warning"}>{isReady ? "Opérationnelle" : "Initialisation"}</StatusBadge>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-md w-full gap-1.5" onClick={handleCopyDiagnostics}>
                      <DiagnosticsIcon className="w-3.5 h-3.5" />
                      Copier les informations de diagnostic
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
