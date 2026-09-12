import { useState } from "react";
import { RiFileCopyLine as CopyIcon, RiCheckLine as CheckIcon } from "@remixicon/react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@sordi/ui";
import { cn } from "@/lib/utils";

/**
 * Hoverable inline copy affordance for critical fiscal/reference fields
 * (invoice number, client NIF/NIS/RC, ...) — hidden until the wrapping
 * element (which must carry the `group` class) is hovered, then reveals a
 * small copy icon that swaps to a green checkmark with a transient
 * "Copié" tooltip on click. Never renders for an empty value.
 */
export function CopyChip({ value, label = "Copier", className }: { value?: string | null; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Tooltip open={copied || undefined}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={label}
          className={cn(
            "inline-flex items-center justify-center w-4 h-4 rounded shrink-0 opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity duration-150",
            copied && "opacity-100",
            className
          )}
        >
          {copied ? <CheckIcon className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <CopyIcon className="w-3 h-3 text-muted-foreground" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{copied ? "Copié" : label}</TooltipContent>
    </Tooltip>
  );
}
