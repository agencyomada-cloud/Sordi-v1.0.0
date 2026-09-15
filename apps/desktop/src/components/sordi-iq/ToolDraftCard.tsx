import { RiLoader4Line as Loader2, RiPencilLine as Pencil, RiCheckLine as Check } from "@remixicon/react";
import { Button, Card, CardContent, CardHeader, Input, Label } from "@sordi/ui";
import { cn } from "@/lib/utils";
import { TOOL_DRAFT_LABELS, type ToolDraft } from "./types";

interface ToolDraftCardProps {
  draft: ToolDraft;
  onFieldChange: (field: string, value: string | number) => void;
  onConfirm: () => void;
  onOpenEditor: () => void;
}

/** Field metadata per tool — drives which <Input>s the compact card shows
 *  inline (label, key into ToolDraftFields, input type). The full drawer
 *  (ToolDraftsDrawer.tsx) renders the same list, just roomier. */
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
 * One pending tool call, rendered as an editable card inside the chat
 * stream — the human-in-the-loop review step for every write action.
 * Nothing is written to the database until [Confirmer] is clicked; the
 * card locks (status "saved"/"error") once it has been.
 */
export function ToolDraftCard({ draft, onFieldChange, onConfirm, onOpenEditor }: ToolDraftCardProps) {
  const locked = draft.status === "saving" || draft.status === "saved" || draft.status === "error";
  const fields = fieldsFor(draft.toolName) as { key: string; label: string; type: "text" | "number" | "date" }[];
  const values = draft.fields as unknown as Record<string, string | number>;

  if (draft.status === "saved" || draft.status === "error") {
    return (
      <Card
        className={cn(
          "border",
          draft.status === "saved" ? "bg-emerald-500/10 border-emerald-500/30" : "bg-destructive/10 border-destructive/30"
        )}
      >
        <CardContent className="p-3">
          <p className={cn("text-sm font-medium", draft.status === "saved" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
            {draft.resultMessage}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-muted/40 border-border">
      <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between space-y-0">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{TOOL_DRAFT_LABELS[draft.toolName]}</span>
        <span className="text-[10px] text-muted-foreground">En attente de validation</span>
      </CardHeader>
      <CardContent className="p-3 pt-2 space-y-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          {fields.map((f) => (
            <div key={f.key} className={cn("space-y-1", (f.key === "description" || f.key === "name") && "col-span-2")}>
              <Label className="text-[11px] text-muted-foreground">{f.label}</Label>
              <Input
                type={f.type}
                value={values[f.key] ?? ""}
                disabled={draft.status === "saving"}
                onChange={(e) => onFieldChange(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={onOpenEditor} disabled={locked}>
            <Pencil className="w-3 h-3" />
            Modifier
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1.5 text-xs bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 border-0"
            onClick={onConfirm}
            disabled={locked}
          >
            {draft.status === "saving" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Confirmer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
