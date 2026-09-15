import { RiLoader4Line as Loader2, RiCheckDoubleLine as CheckDouble } from "@remixicon/react";
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
  Input,
  Label,
  Separator,
} from "@sordi/ui";
import { TOOL_DRAFT_LABELS, type ToolDraft } from "./types";

interface ToolDraftsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: ToolDraft[];
  onFieldChange: (draftId: string, field: string, value: string | number) => void;
  onConfirm: (draftId: string) => void;
  onConfirmAll: () => void;
}

function fieldsFor(toolName: ToolDraft["toolName"]): { key: string; label: string; type: "text" | "number" | "date" }[] {
  switch (toolName) {
    case "create_client":
    case "create_supplier":
      return [
        { key: "name", label: "Nom", type: "text" },
        { key: "phone", label: "Téléphone", type: "text" },
      ];
    case "create_expense":
      return [
        { key: "category", label: "Catégorie", type: "text" },
        { key: "amount", label: "Montant (DZD)", type: "number" },
        { key: "description", label: "Description", type: "text" },
        { key: "date", label: "Date", type: "date" },
      ];
    case "create_invoice":
      return [
        { key: "client_name", label: "Client", type: "text" },
        { key: "description", label: "Désignation", type: "text" },
        { key: "amount", label: "Montant HT (DZD)", type: "number" },
        { key: "date", label: "Date", type: "date" },
      ];
  }
}

/**
 * The full editor for a batch of pending tool drafts — opened via a single
 * draft card's [Modifier] button, but shows every pending draft from that
 * same assistant turn (the "multi-item batch" review surface: a bulk
 * invoice/expense/client creation shows up here as one list, each row
 * independently editable and confirmable, plus a single "Confirmer tout").
 */
export function ToolDraftsDrawer({ open, onOpenChange, drafts, onFieldChange, onConfirm, onConfirmAll }: ToolDraftsDrawerProps) {
  const pending = drafts.filter((d) => d.status === "pending" || d.status === "saving");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Réviser {pending.length > 1 ? `${pending.length} actions` : "l'action"} avant validation</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {drafts.map((draft, idx) => {
              const locked = draft.status !== "pending";
              const fields = fieldsFor(draft.toolName) as { key: string; label: string; type: "text" | "number" | "date" }[];
              const values = draft.fields as unknown as Record<string, string | number>;
              return (
                <div key={draft.id}>
                  {idx > 0 && <Separator className="mb-4" />}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground">{TOOL_DRAFT_LABELS[draft.toolName]}</span>
                    {draft.status !== "pending" && (
                      <span className="text-[11px] text-muted-foreground">{draft.status === "saving" ? "Enregistrement..." : draft.resultMessage}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {fields.map((f) => (
                      <div key={f.key} className={(f.key === "description" || f.key === "name") ? "col-span-2 space-y-1" : "space-y-1"}>
                        <Label className="text-xs text-muted-foreground">{f.label}</Label>
                        <Input
                          type={f.type}
                          value={values[f.key] ?? ""}
                          disabled={locked}
                          onChange={(e) => onFieldChange(draft.id, f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  {draft.status === "pending" && (
                    <div className="flex justify-end mt-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => onConfirm(draft.id)}>
                        Confirmer cette action
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <DrawerFooter>
            {pending.length > 0 && (
              <Button
                type="button"
                onClick={onConfirmAll}
                className="gap-1.5 bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 border-0"
                disabled={pending.some((d) => d.status === "saving")}
              >
                {pending.some((d) => d.status === "saving") ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckDouble className="w-4 h-4" />}
                Confirmer tout ({pending.length})
              </Button>
            )}
            <DrawerClose asChild>
              <Button type="button" variant="outline">Fermer</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
