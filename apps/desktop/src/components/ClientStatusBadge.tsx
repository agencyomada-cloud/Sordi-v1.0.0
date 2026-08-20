import type { ClientStatus } from "@/lib/clientOverview";
import { cn } from "@/lib/utils";

interface ClientStatusBadgeProps {
  status: ClientStatus;
  className?: string;
}

export function ClientStatusBadge({ status, className }: ClientStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap",
        status.colorClass,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status.label}
    </span>
  );
}
