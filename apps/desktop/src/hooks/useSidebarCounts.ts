import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";

const LAST_SEEN_KEY = "sordi_notifications_last_seen";

export function useSidebarCounts() {
  const { activeCompanyId, isReady } = useWorkspace();

  // Unpaid/pending invoices
  const { data: invoices } = useQuery({
    queryKey: ["invoices", activeCompanyId],
    queryFn: () => db.invoices.getAll(activeCompanyId),
    staleTime: 30_000,
    enabled: isReady,
  });

  // Orders in draft or confirmed
  const { data: orders } = useQuery({
    queryKey: ["orders", activeCompanyId],
    queryFn: () => db.orders.getAll(activeCompanyId),
    staleTime: 30_000,
    enabled: isReady,
  });

  // Delivery notes not yet invoiced
  const { data: deliveries } = useQuery({
    queryKey: ["delivery-notes", activeCompanyId],
    queryFn: () => db.deliveryNotes.getAll(activeCompanyId),
    staleTime: 30_000,
    enabled: isReady,
  });

  // Unread activity logs
  const { data: logs } = useQuery({
    queryKey: ["activity_logs", "recent"],
    queryFn: () => db.history.getLogs(20),
    staleTime: 30_000,
  });

  // Overdue Activités & Rappels (chatter-lite follow-ups) — company-wide,
  // not scoped to one record, since this only feeds the Dashboard nav
  // item's badge count.
  const { data: activities } = useQuery({
    queryKey: ["activities", activeCompanyId],
    queryFn: () => db.activities.list(activeCompanyId),
    staleTime: 30_000,
    enabled: isReady,
  });

  const lastSeen = localStorage.getItem(LAST_SEEN_KEY) || new Date(0).toISOString();

  const unpaidInvoicesCount = invoices?.filter(
    (i) => i.invoice_type === "invoice" && (i.status === "unpaid" || i.status === "overdue")
  ).length || 0;

  const pendingOrdersCount = orders?.filter(
    (o) => o.status === "draft" || o.status === "pending"
  ).length || 0;

  const pendingDeliveriesCount = deliveries?.filter(
    (d) => !d.is_invoiced
  ).length || 0;

  // `created_at` is written server-side as local time (`+01:00`-style
  // offset) while `lastSeen` is UTC (`Z`) — comparing the raw strings with
  // `>` is unreliable since they're different textual representations of
  // time. Parsing both to an actual instant compares correctly regardless
  // of which offset either side used (see NotificationBell.tsx's isAfter).
  const unreadLogsCount = logs?.filter(
    (log) => new Date(log.created_at).getTime() > new Date(lastSeen).getTime()
  ).length || 0;

  const today = new Date().toISOString().slice(0, 10);
  const overdueActivitiesCount = activities?.filter(
    (a) => !a.done_at && a.due_date < today
  ).length || 0;

  // Genuinely past-due invoices (> 0 days), for the "Relances" nav badge —
  // driven by due_date rather than the `status` column, since "overdue" is
  // a display label an invoice can carry without it ever being recomputed,
  // while an "issued"/"partial" invoice whose due_date has quietly passed
  // still needs to show up here. Mirrors Index.tsx's receivablesList logic.
  const overdueInvoicesCount = invoices?.filter(
    (i) =>
      i.invoice_type === "invoice" &&
      i.status !== "cancelled" &&
      i.status !== "draft" &&
      (i.balance_due || 0) > 0 &&
      !!i.due_date &&
      i.due_date < today
  ).length || 0;

  return {
    invoices: unpaidInvoicesCount,
    orders: pendingOrdersCount,
    deliveries: pendingDeliveriesCount,
    history: unreadLogsCount,
    activities: overdueActivitiesCount,
    relances: overdueInvoicesCount,
  };
}
