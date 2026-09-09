import { useState } from "react";
import {
  RiBuildingLine as BuildingIcon,
  RiImageAddLine as ImageIcon,
  RiCloseLine as CloseIcon,
} from "@remixicon/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Button, Input, Label,
} from "@sordi/ui";
import { cn, compressImage } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { CreateCompanyData } from "@/lib/database";

const emptyForm: CreateCompanyData = {
  name: "",
  logo_base64: "",
  activity: "",
  rc: "",
  nif: "",
  nis: "",
  article_imposition: "",
  address: "",
  phone: "",
  email: "",
};

interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCompanyDialog({ open, onOpenChange }: CreateCompanyDialogProps) {
  const { createCompany, isCreatingCompany } = useWorkspace();
  const [formData, setFormData] = useState<CreateCompanyData>(emptyForm);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const compressed = await compressImage(base64String, 400);
      setFormData((prev) => ({ ...prev, logo_base64: compressed }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    await createCompany(formData);
    setFormData(emptyForm);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Créer une nouvelle entreprise</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto pr-2 space-y-6 py-2">
            {/* Nom + Logo */}
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <Label className="mb-1.5 block text-xs">Logo</Label>
                <label
                  htmlFor="company-logo-upload"
                  className={cn(
                    "relative flex items-center justify-center w-16 h-16 rounded-2xl border border-dashed border-border bg-secondary/40 cursor-pointer overflow-hidden hover:border-primary/50 transition-colors",
                  )}
                >
                  {formData.logo_base64 ? (
                    <>
                      <img src={formData.logo_base64} alt="Logo" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setFormData((prev) => ({ ...prev, logo_base64: "" }));
                        }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-foreground/70 text-background flex items-center justify-center"
                      >
                        <CloseIcon className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  )}
                  <input
                    id="company-logo-upload"
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </label>
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="company-name">Nom de l'entreprise *</Label>
                <Input
                  id="company-name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Omada Agency"
                />
                <Input
                  value={formData.activity ?? ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, activity: e.target.value }))}
                  placeholder="Secteur d'activité"
                />
              </div>
            </div>

            {/* Coordonnées fiscales */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <BuildingIcon className="w-4 h-4" />
                Coordonnées fiscales
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="company-rc">RC</Label>
                  <Input id="company-rc" value={formData.rc ?? ""} onChange={(e) => setFormData((prev) => ({ ...prev, rc: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-nif">NIF</Label>
                  <Input id="company-nif" value={formData.nif ?? ""} onChange={(e) => setFormData((prev) => ({ ...prev, nif: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-nis">NIS</Label>
                  <Input id="company-nis" value={formData.nis ?? ""} onChange={(e) => setFormData((prev) => ({ ...prev, nis: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-ai">Article d'imposition</Label>
                  <Input id="company-ai" value={formData.article_imposition ?? ""} onChange={(e) => setFormData((prev) => ({ ...prev, article_imposition: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Coordonnées de contact */}
            <div className="space-y-3">
              <div className="text-primary font-semibold text-sm">Coordonnées de contact</div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="company-address">Adresse</Label>
                  <Input id="company-address" value={formData.address ?? ""} onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="company-phone">Téléphone</Label>
                    <Input id="company-phone" value={formData.phone ?? ""} onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="company-email">Email</Label>
                    <Input id="company-email" type="email" value={formData.email ?? ""} onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-border/60">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!formData.name.trim() || isCreatingCompany}
              className="bg-primary hover:bg-primary-hover text-primary-foreground"
            >
              {isCreatingCompany ? "Création..." : "Créer l'espace"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
