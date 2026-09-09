import type { ClientStatus } from "@/lib/clientOverview";
import { statusBadgeVariants } from "@sordi/ui";
import { cn } from "@/lib/utils";

interface ClientStatusBadgeProps {
  status: ClientStatus;
  className?: string;
}

export function ClientStatusBadge({ status, className }: ClientStatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone: status.tone }), className)}>
      {status.label}
    </span>
  );
}
