import { useState } from "react";
import { RiFlashlightLine as UpdateIcon } from "@remixicon/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button } from "@sordi/ui";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";

/** Header-level "a newer build exists" nudge — renders nothing at all when
 *  up to date or the check hasn't resolved yet (silent by design, see
 *  useUpdateCheck's doc comment), so it never occupies layout space or
 *  competes with the rest of the header cluster unless there's actually
 *  something to say. */
export function UpdateBadge() {
  const { data } = useUpdateCheck();
  const [open, setOpen] = useState(false);

  if (!data?.update_available) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:inline-flex h-7 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors shrink-0"
      >
        <UpdateIcon className="w-3.5 h-3.5" />
        Mise à jour v{data.latest_version} disponible
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UpdateIcon className="w-4 h-4 text-primary" />
              Sordi Invoicing {data.latest_version}
            </DialogTitle>
            <DialogDescription>
              Vous utilisez la version {data.current_version}. Une nouvelle version est disponible.
            </DialogDescription>
          </DialogHeader>

          {data.release_notes && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground whitespace-pre-line max-h-60 overflow-y-auto">
              {data.release_notes}
            </div>
          )}

          <DialogFooter>
            <Button asChild className="w-full">
              <a href={data.download_url} target="_blank" rel="noreferrer">
                Télécharger la mise à jour
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
