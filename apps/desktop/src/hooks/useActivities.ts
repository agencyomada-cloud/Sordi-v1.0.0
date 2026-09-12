import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { mapErrorToUserMessage } from "@/lib/errorMapper";
import { logError } from "@/lib/errorLogger";
import { db, type Activity, type ActivityEntityType, type CreateActivityData } from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";

/** Today as a plain YYYY-MM-DD string, matching the DatePicker-sourced
 *  due_date format — a lexical string comparison against it is enough to
 *  classify overdue/today, no date-library parsing needed. */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Odoo-chatter-style follow-up tasks (Activités & Rappels). Pass no args to
 * list every open/closed activity company-wide (the Dashboard's "Mes
 * Tâches" cell and the Command Palette's "Rappels" group both do this);
 * pass entityType (+ optionally entityId) to scope to one record's
 * inspector panel (ClientDetail, InvoiceDetail) or one record type.
 */
export function useActivities(entityType?: ActivityEntityType, entityId?: string) {
  const { activeCompanyId, isReady } = useWorkspace();

  const query = useQuery({
    queryKey: ["activities", activeCompanyId, entityType, entityId],
    queryFn: () => db.activities.list(activeCompanyId, entityType, entityId),
    enabled: isReady,
    // Activity mutations invalidate this key explicitly — a 5-minute
    // staleTime avoids re-fetching on every window refocus (this hook is
    // mounted repeatedly: Sidebar's command palette, the Dashboard, and
    // every ClientDetail/InvoiceDetail page).
    staleTime: 1000 * 60 * 5,
  });

  const activities = query.data ?? [];
  // Recomputed by every mounting consumer (Sidebar, Dashboard, record
  // detail pages) on every render — memoize so it only re-runs when the
  // underlying list actually changes.
  const { pendingActivities, overdueCount, todayCount } = useMemo(() => {
    const today = todayStr();
    const pending = activities.filter((a) => !a.done_at);
    return {
      pendingActivities: pending,
      overdueCount: pending.filter((a) => a.due_date < today).length,
      todayCount: pending.filter((a) => a.due_date === today).length,
    };
  }, [activities]);

  return { ...query, activities, pendingActivities, overdueCount, todayCount };
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useWorkspace();

  return useMutation({
    mutationFn: async (data: Omit<CreateActivityData, "company_id">) => {
      if (!data.title.trim()) throw new Error("Le titre du rappel est requis");
      return await db.activities.create({ ...data, company_id: activeCompanyId });
    },
    onSuccess: (activity: Activity) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-counts"] });
      db.history.log({
        action: "CREATE",
        entity_type: "ACTIVITY",
        entity_id: activity?.id || null,
        description: `Rappel créé: ${activity?.title || ""}`,
      });
      toast.success("Rappel créé");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || mapErrorToUserMessage(error));
      logError("Activity creation error", error);
    },
  });
}

export function useCompleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.activities.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-counts"] });
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || mapErrorToUserMessage(error));
      logError("Activity completion error", error);
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.activities.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-counts"] });
      toast.success("Rappel supprimé");
    },
    onError: (error: unknown) => {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
      toast.error(message || mapErrorToUserMessage(error));
      logError("Activity deletion error", error);
    },
  });
}
