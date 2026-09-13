import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button, Popover, PopoverTrigger, PopoverContent, Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@sordi/ui";
import type { CopilotContextEntity } from "./types";

interface EntityComboboxProps {
  entities: CopilotContextEntity[];
  /** The currently selected real id, or null when the name below is a
   *  free-text/not-yet-created entity (the AI's own suggestion). */
  selectedId: string | null;
  /** Shown on the trigger when selectedId is null — the AI's best guess
   *  at a name, kept editable by picking a real entity from the list. */
  freeTextName: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  onSelect: (entity: CopilotContextEntity | null) => void;
}

/** Compact combobox for switching the matched client/supplier inline in
 *  the review card — same Popover+Command pattern already used for the
 *  Expenses page's own supplier/project pickers, just sized for a drawer
 *  row instead of a full form field. */
export function EntityCombobox({
  entities,
  selectedId,
  freeTextName,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  onSelect,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = entities.find((e) => e.id === selectedId);
  const displayName = selected?.name ?? freeTextName ?? placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full h-8 justify-between px-2.5 font-normal text-xs">
          <span className="truncate flex items-center gap-1.5">
            {displayName}
            {!selected && freeTextName && <span className="text-[10px] text-primary shrink-0">(nouveau)</span>}
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {entities.map((entity) => (
                <CommandItem
                  key={entity.id}
                  value={entity.name}
                  onSelect={() => {
                    onSelect(entity);
                    setOpen(false);
                  }}
                >
                  {entity.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
