import {
  RiPhoneLine as CallIcon,
  RiMailLine as EmailIcon,
  RiCalendarEventLine as MeetingIcon,
  RiCheckboxLine as TodoIcon,
  RiDeleteBinLine as Trash2,
} from "@remixicon/react";
import { Checkbox, Skeleton, EmptyState } from "@sordi/ui";
import { cn } from "@/lib/utils";
import { useActivities, useCompleteActivity, useDeleteActivity } from "@/hooks/useActivities";
import type { Activity, ActivityEntityType, ActivityKind } from "@/lib/database";

const ACTIVITY_ICONS: Record<ActivityKind, React.ElementType> = {
  call: CallIcon,
  email: EmailIcon,
  meeting: MeetingIcon,
  todo: TodoIcon,
};

function formatDueDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}

interface ActivityListProps {
  entityType: ActivityEntityType;
  entityId: string;
}

/**
 * Dense, keyboard-friendly follow-up list embedded in a record's inspector
 * panel (ClientDetail, InvoiceDetail) — a micro-checkbox marks a task done
 * in place, no dialog round-trip; overdue open tasks read in rose, done
 * ones fade and strike through rather than disappearing (recent history
 * stays visible without a separate "completed" view).
 */
export function ActivityList({ entityType, entityId }: ActivityListProps) {
  const { activities, isLoading } = useActivities(entityType, entityId);
  const completeActivity = useCompleteActivity();
  const deleteActivity = useDeleteActivity();
  const today = new Date().toISOString().slice(0, 10);

  if (isLoading) {
    return (
      <div className="border border-border/60 rounded-md bg-card overflow-hidden divide-y divide-border/40">
        {[1, 2].map((i) => (
          <div key={i} className="h-8 flex items-center gap-2 px-2.5">
            <Skeleton className="h-3.5 w-3.5 rounded-sm" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="border border-border/60 rounded-md bg-card">
        <EmptyState size="compact" type="default" title="Aucun rappel" description="Aucune activité planifiée pour cet enregistrement" />
      </div>
    );
  }

  return (
    <div className="border border-border/60 rounded-md bg-card overflow-hidden divide-y divide-border/40">
      {activities.map((activity: Activity) => {
        const isDone = !!activity.done_at;
        const overdue = !isDone && activity.due_date < today;
        const Icon = ACTIVITY_ICONS[activity.activity_type] ?? TodoIcon;
        return (
          <div
            key={activity.id}
            className={cn(
              "h-8 flex items-center gap-2 px-2.5 text-xs group hover:bg-muted/20 transition-colors",
              isDone && "opacity-50"
            )}
          >
            <Checkbox
              checked={isDone}
              disabled={isDone || completeActivity.isPending}
              onCheckedChange={() => !isDone && completeActivity.mutate(activity.id)}
            />
            <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className={cn("flex-1 min-w-0 truncate", isDone && "line-through")}>{activity.title}</span>
            <span
              className={cn(
                "font-mono tabular-nums text-[11px] shrink-0",
                overdue ? "text-rose-600 dark:text-rose-400 font-medium" : "text-muted-foreground"
              )}
            >
              {formatDueDate(activity.due_date)}
            </span>
            <button
              onClick={() => deleteActivity.mutate(activity.id)}
              className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-destructive transition-all shrink-0"
              title="Supprimer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
