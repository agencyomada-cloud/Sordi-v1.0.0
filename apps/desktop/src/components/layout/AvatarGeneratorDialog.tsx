import { useEffect, useState } from "react";
import { Dices } from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@sordi/ui";
import { CompanyAvatar } from "./CompanyAvatar";

interface AvatarGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The seed currently saved (not necessarily what's shown mid-session —
   *  the dialog previews its own local `seed` state until "Enregistrer"). */
  currentSeed: string;
  onSave: (seed: string) => void;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Lets the user re-roll a DiceBear "shapes" avatar and commit the new
 *  seed. Nothing is saved until "Enregistrer" is clicked — closing or
 *  cancelling discards whatever was previewed, same "confirm before it's
 *  real" convention as the rest of this app's dialogs. */
export function AvatarGeneratorDialog({ open, onOpenChange, currentSeed, onSave }: AvatarGeneratorDialogProps) {
  const [seed, setSeed] = useState(currentSeed);

  // Re-sync the preview to the actually-saved seed every time the dialog
  // OPENS (not just on first mount) — otherwise reopening after a
  // previously cancelled session would show that discarded preview
  // instead of what's really saved.
  useEffect(() => {
    if (open) setSeed(currentSeed);
  }, [open, currentSeed]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Avatar de l'entreprise</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <CompanyAvatar seed={seed} size={112} className="rounded-2xl border border-border/60" />
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setSeed(randomSeed())}>
            <Dices className="w-4 h-4" />
            🎲 Générer un nouveau
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(seed);
              onOpenChange(false);
            }}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
