import type { ClientStatus } from "@/lib/clientOverview";
import { statusBadgeVariants, StatusDot } from "@sordi/ui";
import { cn } from "@/lib/utils";

interface ClientStatusBadgeProps {
  status: ClientStatus;
  className?: string;
}

export function ClientStatusBadge({ status, className }: ClientStatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants(), className)}>
      <StatusDot tone={status.tone} />
      {status.label}
    </span>
  );
}
