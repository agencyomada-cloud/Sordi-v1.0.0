import { RiListUnordered as GroupIcon, RiCheckLine as CheckIcon } from "@remixicon/react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@sordi/ui";
import { cn } from "@/lib/utils";

export interface GroupByOption {
  value: string;
  label: string;
}

interface GridGroupBySelectProps {
  value: string;
  onChange: (value: string) => void;
  options: GroupByOption[];
  className?: string;
}

/**
 * Compact "Regrouper par..." trigger for a data grid — Odoo's group-by
 * facet, minus its own filtering concerns. The consuming page owns turning
 * `value` into actual bucketed rows; this is just the picker.
 */
export function GridGroupBySelect({ value, onChange, options, className }: GridGroupBySelectProps) {
  const active = options.find((option) => option.value === value) ?? options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-[30px] px-2.5 text-xs rounded-md gap-1.5", className)}>
          <GroupIcon className="w-3.5 h-3.5" />
          {active?.label ?? "Regrouper par..."}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => onChange(option.value)}>
            <span className="flex-1">{option.label}</span>
            {option.value === value && <CheckIcon className="w-3.5 h-3.5 ml-2" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
