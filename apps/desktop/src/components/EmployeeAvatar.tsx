import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@sordi/ui";
import { useAppDataDir, resolveAppDataFileUrl } from "@/hooks/useAppDataDir";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-10 w-10 text-sm",
  lg: "h-24 w-24 text-2xl",
} as const;

// Deterministic, not random — the same person gets the same fallback color
// everywhere (list row, detail page, task row), not a new one per render.
const FALLBACK_COLORS = [
  "bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500",
  "bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-pink-500",
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

interface EmployeeAvatarProps {
  photoPath?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Reusable everywhere an employee is shown — list rows, detail header, task assignee. */
export function EmployeeAvatar({ photoPath, name, size = "md", className }: EmployeeAvatarProps) {
  const { data: appDataDirPath } = useAppDataDir();
  const { data: photoUrl } = useQuery({
    queryKey: ["employee-photo-url", appDataDirPath, photoPath],
    queryFn: () => resolveAppDataFileUrl(appDataDirPath!, photoPath!),
    enabled: !!appDataDirPath && !!photoPath,
    staleTime: Infinity,
  });

  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <Avatar className={cn(SIZE_CLASSES[size], "shrink-0", className)}>
      {photoUrl && <AvatarImage src={photoUrl} alt={name} className="object-cover" />}
      <AvatarFallback className={cn(colorForName(name), "text-white font-semibold")}>{initial}</AvatarFallback>
    </Avatar>
  );
}
