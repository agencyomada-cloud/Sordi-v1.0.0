import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "@/lib/adminApi";

const LAST_SEEN_KEY = "sordi_admin_last_seen_lead_id";

function getLastSeenId(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

function setLastSeenId(id: string): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, id);
  } catch {
    // Private browsing / storage disabled — the bell just won't remember
    // "seen" across a reload, which is a harmless degradation here.
  }
}

/** Polls the leads list every 10s (same cadence as the devices auto-refresh
 *  toggle) and toasts once for each lead newer than the last one this
 *  browser has seen — toasts fire in chronological order so an admin who
 *  was away doesn't get them newest-first. Returns the leads list plus an
 *  unseen count for the header bell badge; calling markAllSeen clears it. */
export function useLeadNotifications() {
  const { data } = useQuery({
    queryKey: ["leads"],
    queryFn: () => adminApi.listLeads(),
    select: (d) => d.leads,
    refetchInterval: 10_000,
  });

  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;

    if (knownIds.current === null) {
      // First load this session — seed silently, no retroactive toasts for
      // leads that arrived before this admin session opened.
      knownIds.current = new Set(data.map((l) => l.id));
      return;
    }

    const unseen = data.filter((l) => !knownIds.current!.has(l.id));
    // Oldest-first so a burst of leads toasts in the order they arrived.
    for (const lead of [...unseen].reverse()) {
      toast.success(`🚀 Nouveau prospect : ${lead.name}`, {
        description: lead.company || `+213${lead.phone}`,
      });
      knownIds.current.add(lead.id);
    }
  }, [data]);

  const lastSeenId = getLastSeenId();
  const unseenCount = data && lastSeenId ? data.findIndex((l) => l.id === lastSeenId) : data?.length ?? 0;
  const badgeCount = unseenCount === -1 ? data?.length ?? 0 : unseenCount;

  const markAllSeen = () => {
    if (data && data.length > 0) setLastSeenId(data[0].id);
  };

  return { leads: data ?? [], badgeCount, markAllSeen };
}
