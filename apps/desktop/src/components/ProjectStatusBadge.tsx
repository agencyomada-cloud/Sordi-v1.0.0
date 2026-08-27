import type { ProjectStatus } from "@/lib/projectOverview";
import { statusBadgeVariants, StatusDot } from "@sordi/ui";
import { cn } from "@/lib/utils";

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants(), className)}>
      <StatusDot tone={status.tone} />
      {status.label}
    </span>
  );
}
