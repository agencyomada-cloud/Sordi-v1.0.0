import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label } from "@sordi/ui";
import { RiLoader4Line as Loader2 } from "@remixicon/react";
import { useCreateClient } from "@/hooks/useClients";
import { toast } from "sonner";
import { useLicenseGate } from "@/hooks/useLicenseGate";
import { LicenseBlockedModal } from "@/components/licensing/LicenseBlockedModal";

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fills "Nom" with whatever the user had already typed into the
   *  search box that came up empty — the whole point of this dialog is to
   *  not make them retype it. */
  initialName: string;
  onCreated: (client: any) => void;
}

/**
 * Minimal quick-create dialog for the "+ Créer le client…" row in the
 * invoice editor's client picker — essential fields only (Nom, RC, NIF,
 * Adresse), not the full Clients page form. Created client is inserted into
 * the database, selected in the current invoice draft, and the dialog
 * closes — no navigation away from the invoice, no draft loss.
 */
export function CreateClientDialog({ open, onOpenChange, initialName, onCreated }: CreateClientDialogProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [rc, setRc] = useState("");
  const [nif, setNif] = useState("");
  const [address, setAddress] = useState("");
  const createClient = useCreateClient();
  const { requireActive, blockedOpen, setBlockedOpen } = useLicenseGate();

  useEffect(() => {
    if (open) {
      setName(initialName);
      setPhone("");
      setRc("");
      setNif("");
      setAddress("");
    }
  }, [open, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireActive()) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Le nom du client est requis");
      return;
    }
    try {
      const client = await createClient.mutateAsync({
        name: trimmedName,
        phone: phone.trim() || undefined,
        rc: rc.trim() || undefined,
        nif: nif.trim() || undefined,
        address: address.trim() || undefined,
      } as any);
      onCreated(client);
      onOpenChange(false);
    } catch {
      // useCreateClient's mutation already toasts the error.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Créer un nouveau client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-client-name">Nom *</Label>
            <Input id="new-client-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="new-client-phone">Téléphone</Label>
              <Input id="new-client-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-nif">NIF</Label>
              <Input id="new-client-nif" value={nif} onChange={(e) => setNif(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="new-client-rc">RC</Label>
              <Input id="new-client-rc" value={rc} onChange={(e) => setRc(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-address">Adresse</Label>
              <Input id="new-client-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={createClient.isPending} className="gap-2">
              {createClient.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Créer et sélectionner
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <LicenseBlockedModal open={blockedOpen} onOpenChange={setBlockedOpen} />
    </Dialog>
  );
}
