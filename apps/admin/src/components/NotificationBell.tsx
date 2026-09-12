import { Popover, PopoverContent, PopoverTrigger } from "@sordi/ui";
import { RiNotification3Line as BellIcon, RiWhatsappLine as WhatsAppIcon } from "@remixicon/react";
import { useLeadNotifications } from "@/hooks/useLeadNotifications";
import { buildWhatsAppLink } from "@/lib/whatsapp";

const OS_LABEL: Record<"macos" | "windows", string> = { macos: "macOS", windows: "Windows" };

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function NotificationBell() {
  const { leads, badgeCount, markAllSeen } = useLeadNotifications();

  return (
    <Popover onOpenChange={(open) => open && markAllSeen()}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Notifications"
        >
          <BellIcon className="w-4 h-4" />
          {badgeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border/60">
          <p className="text-sm font-semibold">Nouveaux prospects</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {leads.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">Aucun prospect pour le moment.</p>
          ) : (
            leads.slice(0, 10).map((lead) => (
              <div key={lead.id} className="px-4 py-3 border-b border-border/40 last:border-0 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{lead.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {lead.company || "—"} · {OS_LABEL[lead.osType]}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelative(lead.createdAt)}</p>
                </div>
                <a
                  href={buildWhatsAppLink(lead.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 transition-colors"
                  aria-label={`WhatsApp ${lead.name}`}
                >
                  <WhatsAppIcon className="w-3.5 h-3.5" />
                </a>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
