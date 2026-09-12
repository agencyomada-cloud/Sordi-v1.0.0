import { useEffect, useState } from "react";
import {
  RiBuildingLine as Building2,
  RiMapPinLine as MapPin,
  RiFileTextLine as FileText,
} from "@remixicon/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Button, Input, Label, Textarea,
} from "@sordi/ui";
import { useCreateSupplier, useUpdateSupplier } from "@/hooks/useSuppliers";
import type { CreateSupplierData, Supplier } from "@/lib/database";

const defaultForm: Omit<CreateSupplierData, "company_id"> = {
  name: "",
  category: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  rc: "",
  nif: "",
  nis: "",
  solde_du: undefined,
  notes: "",
};

interface NewSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present -> editing that supplier. Absent/null -> creating a new one. */
  supplier?: Supplier | null;
}

const sectionChipClass = "flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider";
const inputClass = "mt-1.5 h-8 text-xs";

export function NewSupplierDialog({ open, onOpenChange, supplier }: NewSupplierDialogProps) {
  const isEditing = !!supplier;
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();

  const [formData, setFormData] = useState<Omit<CreateSupplierData, "company_id">>(defaultForm);

  // Reset to the supplier being edited (or a clean form) every time the
  // dialog opens — mirrors the AlertDialog/Dialog reset pattern used by
  // Partners.tsx's create/edit dialog rather than persisting stale state
  // between a create and the next edit.
  useEffect(() => {
    if (!open) return;
    if (supplier) {
      setFormData({
        name: supplier.name,
        category: supplier.category || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        address: supplier.address || "",
        city: supplier.city || "",
        rc: supplier.rc || "",
        nif: supplier.nif || "",
        nis: supplier.nis || "",
        solde_du: supplier.solde_du ?? undefined,
        notes: supplier.notes || "",
      });
    } else {
      setFormData(defaultForm);
    }
  }, [open, supplier]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing && supplier) {
      updateSupplier.mutate({ id: supplier.id, ...formData }, {
        onSuccess: () => onOpenChange(false),
      });
    } else {
      createSupplier.mutate(formData, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const isSaving = createSupplier.isPending || updateSupplier.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Modifier ${supplier?.name}` : "Nouveau fournisseur"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto pr-2 space-y-5 py-3">
            {/* Informations Générales */}
            <div className="space-y-3">
              <div className={sectionChipClass}>
                <Building2 className="w-3.5 h-3.5" />
                Informations Générales
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Raison sociale <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="SARL EXEMPLE"
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Catégorie / Service</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Imprimerie, Matières premières..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Solde dû initial (DA)</Label>
                  <Input
                    type="number"
                    value={formData.solde_du ?? ""}
                    onChange={(e) => setFormData({ ...formData, solde_du: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Coordonnées */}
            <div className="space-y-3">
              <div className={sectionChipClass}>
                <MapPin className="w-3.5 h-3.5" />
                Coordonnées
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Téléphone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0555 00 00 00"
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@fournisseur.dz"
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ville</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Sétif"
                    className={inputClass}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Adresse</Label>
                  <Textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Numéro, Rue, Zone Industrielle..."
                    className="mt-1.5 resize-none min-h-[60px] text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Identifiants Fiscaux */}
            <div className="space-y-3">
              <div className={sectionChipClass}>
                <FileText className="w-3.5 h-3.5" />
                Identifiants Fiscaux
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">RC</Label>
                  <Input
                    value={formData.rc}
                    onChange={(e) => setFormData({ ...formData, rc: e.target.value })}
                    placeholder="00 B 0000000"
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">NIF</Label>
                  <Input
                    value={formData.nif}
                    onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                    placeholder="00000000000"
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">NIS</Label>
                  <Input
                    value={formData.nis}
                    onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                    placeholder="00000000000"
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notes internes sur ce fournisseur..."
                  className="mt-1.5 resize-none min-h-[60px] text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t mt-3">
            <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs rounded-md" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="h-8 px-3 text-xs rounded-md font-medium"
            >
              {isSaving ? "Enregistrement..." : isEditing ? "Enregistrer" : "Créer le fournisseur"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
