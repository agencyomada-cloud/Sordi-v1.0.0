import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { RiNotification3Line, RiCheckDoubleLine, RiArrowRightSLine } from "@remixicon/react";
import { db } from "@/lib/database";
import { getEntityConfig, getEntityRoute } from "@/lib/activityLog";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@sordi/ui";

const LAST_SEEN_KEY = "sordi_notifications_last_seen";

/**
 * `created_at` is written by the Tauri/Rust side as *local* time
 * (`chrono::Local::now().to_rfc3339()`, e.g. `...T16:45:23+01:00`), while
 * `lastSeen` here is generated as UTC (`Date.toISOString()`, `...Z`).
 * Comparing those two strings directly with `>` is unreliable — same
 * instant, different textual representation — which is what made
 * "mark as read" seem to randomly not stick. Parsing both to an actual
 * instant before comparing works regardless of which offset either side
 * used.
 */
function isAfter(a: string, b: string): boolean {
  return new Date(a).getTime() > new Date(b).getTime();
}

export function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => {
    const stored = localStorage.getItem(LAST_SEEN_KEY);
    if (stored) return stored;
    const now = new Date().toISOString();
    localStorage.setItem(LAST_SEEN_KEY, now);
    return now;
  });

  const { data: logs } = useQuery({
    queryKey: ["activity_logs", "recent"],
    queryFn: () => db.history.getLogs(15),
    refetchInterval: 30_000,
  });

  const unreadCount = logs?.filter((log) => isAfter(log.created_at, lastSeen)).length ?? 0;

  const markAllAsRead = () => {
    const now = new Date().toISOString();
    localStorage.setItem(LAST_SEEN_KEY, now);
    setLastSeen(now);
    queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0) {
      markAllAsRead();
    }
  };

  const handleSelect = (entityType: string, entityId: string | null) => {
    setOpen(false);
    navigate(getEntityRoute(entityType, entityId));
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notifications"
          className="group relative p-2 rounded-lg text-slate-500 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-secondary transition-colors duration-150"
        >
          <RiNotification3Line className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12 group-hover:scale-110" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 rounded-2xl border border-border/60 bg-card text-card-foreground shadow-elevated p-0 overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 px-4 border-b border-border/40 bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground tracking-tight">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[11px] font-semibold text-primary bg-primary/10 tabular-nums px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {logs && logs.length > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Tout marquer comme lu"
            >
              <RiCheckDoubleLine className="w-3.5 h-3.5" />
              <span className="text-[11px]">Tout lire</span>
            </button>
          )}
        </div>

        {/* Notification Items list — bottom fade signals there's more to
            scroll instead of the list looking hard-clipped against the
            footer below it. */}
        <div className="relative">
          <div className="max-h-80 overflow-y-auto divide-y divide-border/20 p-1 scrollbar-thin">
            {!logs || logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                  <RiNotification3Line className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">Aucune notification pour le moment</p>
              </div>
            ) : (
              logs.map((log) => {
                const config = getEntityConfig(log.entity_type);
                const isUnread = isAfter(log.created_at, lastSeen);
                return (
                  <button
                    key={log.id}
                    onClick={() => handleSelect(log.entity_type, log.entity_id)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors",
                      isUnread ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="relative shrink-0 mt-0.5">
                      {/* Colored by entity type — same config.color the
                          Dashboard's Activité Récente already uses, so a
                          notification is scannable by type at a glance
                          instead of every icon reading as the same neutral
                          gray chip regardless of what it's about. */}
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4", config.color)}>
                        {config.icon}
                      </div>
                      {isUnread && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary ring-2 ring-card" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        "text-xs leading-snug line-clamp-2",
                        isUnread ? "font-semibold text-foreground" : "text-muted-foreground"
                      )}>
                        {log.description}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.2 rounded-full", config.color)}>
                          {config.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70">
                          · {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                    </div>
                    <RiArrowRightSLine className="w-4 h-4 text-muted-foreground/40 shrink-0 self-center" />
                  </button>
                );
              })
            )}
          </div>
          {logs && logs.length > 3 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-card to-transparent" />
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-border/40 bg-muted/20">
          <button
            onClick={() => {
              setOpen(false);
              navigate("/history");
            }}
            className="w-full py-1.5 rounded-full text-xs font-medium text-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors flex items-center justify-center gap-1"
          >
            <span>Voir tout l'historique d'activité</span>
            <RiArrowRightSLine className="w-3.5 h-3.5" />
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
