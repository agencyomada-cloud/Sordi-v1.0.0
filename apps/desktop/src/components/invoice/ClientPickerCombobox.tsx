import { useEffect, useState, type ReactNode } from "react";
import { RiUserAddLine as UserPlus, RiCheckLine as Check } from "@remixicon/react";
import { Popover, PopoverContent, PopoverTrigger, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@sordi/ui";
import { cn } from "@/lib/utils";
import { CreateClientDialog } from "./CreateClientDialog";

interface ClientPickerComboboxProps {
  clients?: any[];
  selectedClientId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectClient: (client: any) => void;
  trigger: ReactNode;
  align?: "start" | "center" | "end";
  /** Same scaled-canvas fix as ProductPickerCombobox — see PopoverContent's
   *  own doc comment in packages/ui for why this is needed here. */
  container?: HTMLElement | null;
}

/**
 * Searchable client picker for the invoice editor's "Destinataire" field.
 * Mirrors ProductPickerCombobox's shape (search, empty-state fallback) but
 * for clients — when the typed name matches nothing, offers to create that
 * client on the spot via CreateClientDialog, then selects it immediately in
 * the current draft without leaving the invoice.
 */
export function ClientPickerCombobox({
  clients = [],
  selectedClientId,
  open,
  onOpenChange,
  onSelectClient,
  trigger,
  align = "start",
  container,
}: ClientPickerComboboxProps) {
  const [query, setQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const hasMatches = clients.some((c) => c.name?.toLowerCase().includes(query.trim().toLowerCase()));

  const handleSelect = (client: any) => {
    onSelectClient(client);
    onOpenChange(false);
  };

  const handleOpenCreate = () => {
    onOpenChange(false);
    setCreateDialogOpen(true);
  };

  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align={align} container={container}>
          <Command shouldFilter>
            <CommandInput
              autoFocus
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                // cmdk only auto-triggers a highlighted CommandItem on
                // Enter — CommandEmpty's button isn't one, so this has to
                // be wired explicitly (same pattern as ProductPickerCombobox).
                if (e.key === "Enter" && !hasMatches && query.trim()) {
                  e.preventDefault();
                  handleOpenCreate();
                }
              }}
              placeholder="Rechercher un client..."
            />
            <CommandList className="max-h-72">
              <CommandEmpty className="p-1">
                {query.trim() ? (
                  // hover:bg-muted/80, not hover:bg-accent — --accent is
                  // the same saturated blue as --primary in this app, so a
                  // text-primary label on a bg-accent hover turned
                  // blue-on-blue and vanished. Matches ProductPickerCombobox's
                  // identical fix for the same combobox action-row pattern.
                  <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="w-full flex items-center gap-2 rounded-sm px-2 py-2 text-left text-sm text-primary font-medium hover:bg-muted/80"
                  >
                    <UserPlus className="w-3.5 h-3.5 shrink-0" />
                    Créer le client «{query.trim()}»
                  </button>
                ) : (
                  <span className="block px-2 py-1 text-muted-foreground">Aucun client</span>
                )}
              </CommandEmpty>
              <CommandGroup>
                {clients.map((client) => (
                  <CommandItem key={client.id} value={client.name} onSelect={() => handleSelect(client)}>
                    <Check className={cn("mr-2 h-4 w-4", selectedClientId === client.id ? "opacity-100" : "opacity-0")} />
                    {client.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <CreateClientDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        initialName={query}
        onCreated={(client) => onSelectClient(client)}
      />
    </>
  );
}
