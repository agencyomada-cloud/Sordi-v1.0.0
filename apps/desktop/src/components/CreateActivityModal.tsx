import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sordi/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { useCreateActivity } from "@/hooks/useActivities";
import type { ActivityEntityType, ActivityKind } from "@/lib/database";

const ACTIVITY_TYPES: { value: ActivityKind; label: string }[] = [
  { value: "call", label: "Appel" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Réunion" },
  { value: "todo", label: "À faire" },
];

function defaultDueDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface CreateActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: ActivityEntityType;
  entityId: string;
  /** Shown under the modal title for context, e.g. the client's name or
   *  the invoice number this reminder is attached to. */
  entityLabel?: string;
}

/**
 * Ultra-compact desktop quick-modal for scheduling an Activité & Rappel
 * (Odoo-chatter-style follow-up) against one record. Esc closes it for
 * free (native Radix Dialog behavior); ⌘Enter/Ctrl+Enter submits without
 * reaching for the mouse.
 */
export function CreateActivityModal({ open, onOpenChange, entityType, entityId, entityLabel }: CreateActivityModalProps) {
  const createActivity = useCreateActivity();
  const [title, setTitle] = useState("");
  const [activityType, setActivityType] = useState<ActivityKind>("todo");
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setActivityType("todo");
      setDueDate(defaultDueDate());
      setNotes("");
    }
  }, [open]);

  const handleSubmit = () => {
    if (!title.trim() || createActivity.isPending) return;
    createActivity.mutate(
      {
        entity_type: entityType,
        entity_id: entityId,
        title: title.trim(),
        activity_type: activityType,
        due_date: dueDate,
        notes: notes.trim() || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[380px] max-w-[380px] rounded-xl border border-border/60 bg-card shadow-xs p-4 gap-0"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
      >
        <div className="space-y-0.5 mb-3">
          <DialogTitle className="text-xs font-semibold text-foreground leading-none">Nouveau rappel</DialogTitle>
          {entityLabel && <p className="text-[11px] text-muted-foreground truncate">{entityLabel}</p>}
        </div>

        <div className="space-y-2.5">
          <div>
            <Label className="text-[11px] text-muted-foreground">Titre *</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Rappeler le client au sujet de la facture..."
              className="mt-1 h-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Type</Label>
              <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityKind)}>
                <SelectTrigger className="mt-1 h-8 text-xs rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Échéance</Label>
              <DatePicker value={dueDate} onChange={setDueDate} className="mt-1 h-8 text-xs" presets={false} />
            </div>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Détails additionnels (optionnel)"
              className="mt-1 h-8 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
          <kbd className="text-[10px] font-mono text-muted-foreground border border-border/60 rounded px-1 py-px">Échap</kbd>
          <div className="flex gap-1.5">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs rounded-md" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs rounded-md gap-1.5"
              onClick={handleSubmit}
              disabled={!title.trim() || createActivity.isPending}
            >
              {createActivity.isPending ? "Création..." : "Créer"}
              <kbd className="text-[9px] font-mono text-primary-foreground/70 border border-primary-foreground/30 rounded px-1 py-px">⌘⏎</kbd>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
