import type { ProjectStatus } from "@/lib/projectOverview";
import { cn } from "@/lib/utils";

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
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
