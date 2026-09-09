import type { ProjectStatus } from "@/lib/projectOverview";
import { statusBadgeVariants } from "@sordi/ui";
import { cn } from "@/lib/utils";

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone: status.tone }), className)}>
      {status.label}
    </span>
  );
}
