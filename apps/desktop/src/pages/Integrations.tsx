import { useEffect, useState, type ComponentType } from "react";
import { toast } from "sonner";
import {
  Button,
  StatusBadge,
  type StatusBadgeTone,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@sordi/ui";
import {
  RiMailLine,
  RiFileExcel2Line as SheetsIcon,
  RiCalendarEventLine as CalendarIcon,
  RiKeyLine as KeyRound,
  RiSaveLine as Save,
  RiLoader4Line as Loader2,
} from "@remixicon/react";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useIntegrations } from "@/hooks/useIntegrations";

interface CardBadge {
  label: string;
  tone: StatusBadgeTone;
}

function IntegrationCard({
  icon: Icon,
  iconClassName,
  title,
  badge,
  description,
  footnote,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  title: string;
  badge: CardBadge;
  description: string;
  footnote?: string;
  action: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-3xl border border-border/30 shadow-card p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${iconClassName}`}>
          <Icon className="w-5 h-5" />
        </div>
        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{description}</p>
        {footnote && <p className="text-xs text-muted-foreground mt-2">{footnote}</p>}
      </div>
      {action}
    </div>
  );
}

export default function IntegrationsPage() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const integrations = useIntegrations();

  const [gmailDrawerOpen, setGmailDrawerOpen] = useState(false);
  const [form, setForm] = useState({ smtp_email: "", smtp_app_password: "" });

  useEffect(() => {
    if (settings) {
      setForm({
        smtp_email: settings.smtp_email || "",
        smtp_app_password: settings.smtp_app_password || "",
      });
    }
  }, [settings, gmailDrawerOpen]);

  const handleSaveGmail = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate(
      { smtp_email: form.smtp_email, smtp_app_password: form.smtp_app_password },
      {
        onSuccess: () => {
          toast.success(form.smtp_email ? "Compte Gmail connecté" : "Paramètres d'envoi mis à jour");
          setGmailDrawerOpen(false);
        },
        onError: () => toast.error("Erreur lors de l'enregistrement"),
      }
    );
  };

  const notifyComingSoon = (name: string) => {
    toast.info(`${name} — bientôt disponible`, {
      description: "Cette intégration nécessite une configuration Google Cloud (client OAuth) qui n'est pas encore en place.",
    });
  };

  return (
    <main className="flex-1 p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Intégrations</h1>
        <p className="text-sm text-muted-foreground mt-1">Connectez Sordi à vos outils Google Workspace et services externes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <IntegrationCard
          icon={RiMailLine}
          iconClassName="bg-blue-500/10 text-blue-600"
          title="Gmail & Messagerie"
          badge={integrations.gmail.connected ? { label: "Connecté", tone: "success" } : { label: "Disponible", tone: "neutral" }}
          description="Envoyez vos factures, devis et bons de livraison par email avec rédaction assistée par IA."
          footnote={integrations.gmail.connected ? integrations.gmail.senderEmail || undefined : undefined}
          action={
            <Button
              variant={integrations.gmail.connected ? "outline" : "default"}
              className="w-full gap-2"
              onClick={() => setGmailDrawerOpen(true)}
            >
              {integrations.gmail.connected ? "Gérer la connexion" : "Configurer SMTP"}
            </Button>
          }
        />

        <IntegrationCard
          icon={SheetsIcon}
          iconClassName="bg-emerald-500/10 text-emerald-600"
          title="Google Sheets"
          badge={{ label: "Bientôt disponible", tone: "neutral" }}
          description="Synchronisez vos ventes, charges et déclarations fiscales automatiquement vers des feuilles de calcul Google Sheets."
          action={
            <Button variant="outline" className="w-full gap-2" onClick={() => notifyComingSoon("Google Sheets")}>
              Connecter Sheets
            </Button>
          }
        />

        <IntegrationCard
          icon={CalendarIcon}
          iconClassName="bg-amber-500/10 text-amber-600"
          title="Google Calendar"
          badge={{ label: "Bientôt disponible", tone: "neutral" }}
          description="Planifiez les dates d'échéances de paiement, relances clients et rendez-vous de livraison."
          action={
            <Button variant="outline" className="w-full gap-2" onClick={() => notifyComingSoon("Google Calendar")}>
              Connecter Calendar
            </Button>
          }
        />
      </div>

      <Sheet open={gmailDrawerOpen} onOpenChange={setGmailDrawerOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <RiMailLine className="w-5 h-5 text-primary" />
              Connecter Gmail
            </SheetTitle>
            <SheetDescription>
              Renseignez votre adresse Gmail et un mot de passe d'application pour activer l'envoi direct des documents depuis Sordi.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSaveGmail} className="mt-6 flex flex-col h-[calc(100%-6rem)]">
            <div className="space-y-4 flex-1">
              <div className="space-y-2">
                <Label htmlFor="integrations-smtp-email">Email d'envoi</Label>
                <div className="relative">
                  <RiMailLine className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="integrations-smtp-email"
                    type="email"
                    placeholder="votre-email@gmail.com"
                    className="pl-10"
                    value={form.smtp_email}
                    onChange={(e) => setForm((prev) => ({ ...prev, smtp_email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="integrations-smtp-password">Mot de passe d'application</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="integrations-smtp-password"
                    type="password"
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="pl-10"
                    value={form.smtp_app_password}
                    onChange={(e) => setForm((prev) => ({ ...prev, smtp_app_password: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Un mot de passe d'application Google — pas le mot de passe de votre compte. Généré depuis
                  myaccount.google.com/apppasswords (nécessite la validation en deux étapes).
                </p>
              </div>
            </div>

            <SheetFooter>
              <Button type="submit" disabled={updateSettings.isPending} className="gap-2">
                {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </main>
  );
}
