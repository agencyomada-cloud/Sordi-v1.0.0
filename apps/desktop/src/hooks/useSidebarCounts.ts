import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/database";

const LAST_SEEN_KEY = "sordi_notifications_last_seen";

export function useSidebarCounts() {
  // Unpaid/pending invoices
  const { data: invoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => db.invoices.getAll(),
    staleTime: 30_000,
  });

  // Orders in draft or confirmed
  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: () => db.orders.getAll(),
    staleTime: 30_000,
  });

  // Delivery notes not yet invoiced
  const { data: deliveries } = useQuery({
    queryKey: ["delivery-notes"],
    queryFn: () => db.deliveryNotes.getAll(),
    staleTime: 30_000,
  });

  // Unread activity logs
  const { data: logs } = useQuery({
    queryKey: ["activity_logs", "recent"],
    queryFn: () => db.history.getLogs(20),
    staleTime: 30_000,
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

  const unreadLogsCount = logs?.filter(
    (log) => log.created_at > lastSeen
  ).length || 0;

  return {
    invoices: unpaidInvoicesCount,
    orders: pendingOrdersCount,
    deliveries: pendingDeliveriesCount,
    history: unreadLogsCount,
  };
}
