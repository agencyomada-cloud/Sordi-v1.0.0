import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  RiArrowLeftLine as ArrowLeft,
  RiUserLine as User,
  RiMapPinLine as MapPin,
  RiFileTextLine as FileText,
  RiBuildingLine as Building2,
  RiWallet3Line as Wallet,
  RiPhoneLine as Phone,
  RiSaveLine as Save,
  RiAddLine as Plus,
  RiDeleteBinLine as Trash2,
  RiLoader4Line as Loader2,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useClient, useCreateClient, useUpdateClient, type CreateClientData } from "@/hooks/useClients";
import { toast } from "sonner";

const defaultForm: CreateClientData = {
  name: "",
  code: "",
  phone: "",
  contact_person: "",
  email: "",
  address: "",
  city: "",
  wilaya: "",
  nif: "",
  nis: "",
  rc: "",
  secondary_rc: JSON.stringify([{ rc: "", address: "" }]),
  secondary_address: "",
  ai: "",
  activite: "",
  initial_balance: undefined,
  credit_limit: undefined,
  payment_terms_days: undefined,
  notes: "",
  advance_payment: undefined,
};

// Helper to safely parse secondary_rc into an array of objects
const parseSecondaryRc = (rcStr: string | null | undefined): { rc: string, address: string }[] => {
  if (!rcStr) return [{ rc: "", address: "" }];
  try {
    const parsed = JSON.parse(rcStr);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
      return parsed;
    }
  } catch (e) {
    const parts = rcStr.split(/[\n|,]/).map(s => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts.map(p => ({ rc: p, address: "" }));
    }
  }
  return [{ rc: "", address: "" }];
};

export default function NewClientPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const { data: existingClient, isLoading: isLoadingClient } = useClient(id);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const [formData, setFormData] = useState<CreateClientData>(defaultForm);
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);

  // New client: restore an in-progress draft (or start clean). Editing: load
  // the real record — never mix the two.
  useEffect(() => {
    if (isEditing) return;
    if (hasLoadedDraft) return;
    const savedDraft = localStorage.getItem("draft_client");
    if (savedDraft) {
      try {
        setFormData(JSON.parse(savedDraft));
        toast.info("Brouillon restauré");
      } catch {
        // ignore corrupt draft
      }
    }
    setHasLoadedDraft(true);
  }, [isEditing, hasLoadedDraft]);

  useEffect(() => {
    if (!isEditing || !existingClient) return;
    setFormData({
      name: existingClient.name || "",
      code: existingClient.code || "",
      phone: existingClient.phone || "",
      contact_person: existingClient.contact_person || "",
      email: existingClient.email || "",
      address: existingClient.address || "",
      city: existingClient.city || "",
      wilaya: existingClient.wilaya || "",
      nif: existingClient.nif || "",
      nis: existingClient.nis || "",
      rc: existingClient.rc || "",
      secondary_rc: JSON.stringify(parseSecondaryRc(existingClient.secondary_rc)),
      secondary_address: existingClient.secondary_address || "",
      ai: existingClient.ai || "",
      activite: existingClient.activite || "",
      initial_balance: existingClient.initial_balance ?? undefined,
      credit_limit: existingClient.credit_limit ?? undefined,
      payment_terms_days: existingClient.payment_terms_days ?? undefined,
      notes: existingClient.notes ?? "",
      advance_payment: existingClient.advance_payment ?? undefined,
    });
  }, [isEditing, existingClient]);

  // Persist the new-client draft as the user types (never for edits — an
  // edit should never silently overwrite the record with a stale draft).
  useEffect(() => {
    if (isEditing) return;
    if (formData.name || formData.code || formData.email || formData.phone) {
      localStorage.setItem("draft_client", JSON.stringify(formData));
    }
  }, [formData, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing && id) {
      updateClient.mutate({ id, ...formData }, {
        onSuccess: () => navigate(`/clients/${id}`),
      });
    } else {
      createClient.mutate(formData, {
        onSuccess: (created) => {
          localStorage.removeItem("draft_client");
          navigate(`/clients/${created.id}`);
        },
      });
    }
  };

  const isSaving = createClient.isPending || updateClient.isPending;

  if (isEditing && isLoadingClient) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-8">
          <form onSubmit={handleSubmit}>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate(isEditing ? `/clients/${id}` : "/clients")}
                  className="gap-2 mb-2 p-0 h-auto hover:bg-transparent hover:text-primary"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {isEditing ? "Retour au client" : "Retour aux clients"}
                </Button>
                <h1 className="text-2xl font-semibold text-foreground">
                  {isEditing ? "Modifier le client" : "Nouveau client"}
                </h1>
                <p className="text-muted-foreground">
                  {isEditing ? `Modification de ${existingClient?.name}` : "Ajouter un client à votre répertoire"}
                </p>
              </div>

              <Button type="submit" disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
                {isSaving ? "Enregistrement..." : (isEditing ? "Enregistrer" : "Créer le client")}
              </Button>
            </div>

            <div className="max-w-4xl space-y-6">
              {/* Informations Générales */}
              <div className="bg-card rounded-[6px] border border-border/50 p-6 space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <User className="w-4 h-4" />
                  <h3>Informations Générales</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">
                      Nom / Raison Sociale <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="SARL EXEMPLE"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">Code Client</Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="CLI-001"
                      className="uppercase"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">Numéro de Téléphone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="0555 00 00 00"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">Activité</Label>
                    <Input
                      value={formData.activite || ""}
                      onChange={(e) => setFormData({ ...formData, activite: e.target.value })}
                      placeholder="Concassage, BTP..."
                    />
                  </div>
                </div>
              </div>

              {/* Localisation & Contact */}
              <div className="bg-card rounded-[6px] border border-border/50 p-6 space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <MapPin className="w-4 h-4" />
                  <h3>Localisation &amp; Contact</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">Personne de contact</Label>
                    <Input
                      value={formData.contact_person || ""}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      placeholder="Nom du contact"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">Adresse Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contact@exemple.dz"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">Wilaya / Ville</Label>
                    <Input
                      value={formData.wilaya}
                      onChange={(e) => setFormData({ ...formData, wilaya: e.target.value })}
                      placeholder="Sétif"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">Adresse Complète</Label>
                    <Textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Numéro, Rue, Bâtiment..."
                      className="resize-none min-h-[80px]"
                    />
                  </div>
                </div>
              </div>

              {/* Registre & Fiscalité */}
              <div className="bg-card rounded-[6px] border border-border/50 p-6 space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <FileText className="w-4 h-4" />
                  <h3>Registre &amp; Fiscalité</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">RC (Registre Commerce)</Label>
                    <Input
                      value={formData.rc}
                      onChange={(e) => setFormData({ ...formData, rc: e.target.value })}
                      placeholder="00 B 0000000"
                      className="font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">NIF</Label>
                    <Input
                      value={formData.nif}
                      onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                      placeholder="00000000000"
                      className="font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">NIS</Label>
                    <Input
                      value={formData.nis}
                      onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                      placeholder="00000000000"
                      className="font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">AI (Art. Imposition)</Label>
                    <Input
                      value={formData.ai}
                      onChange={(e) => setFormData({ ...formData, ai: e.target.value })}
                      placeholder="00000000000"
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Finances — previously tracked in state and exported to CSV
                  with no way to actually enter them from the UI. */}
              <div className="bg-card rounded-[6px] border border-border/50 p-6 space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <Wallet className="w-4 h-4" />
                  <h3>Finances</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">Solde initial (DA)</Label>
                    <Input
                      type="number"
                      value={formData.initial_balance ?? ""}
                      onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">Avance (DA)</Label>
                    <Input
                      type="number"
                      value={formData.advance_payment ?? ""}
                      onChange={(e) => setFormData({ ...formData, advance_payment: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">Plafond de crédit (DA)</Label>
                    <Input
                      type="number"
                      value={formData.credit_limit ?? ""}
                      onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="Illimité"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">Délai de paiement (jours)</Label>
                    <Input
                      type="number"
                      value={formData.payment_terms_days ?? ""}
                      onChange={(e) => setFormData({ ...formData, payment_terms_days: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="30"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">Notes</Label>
                    <Textarea
                      value={formData.notes ?? ""}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Notes internes sur ce client..."
                      className="resize-none min-h-[70px]"
                    />
                  </div>
                </div>
              </div>

              {/* Registres Secondaires */}
              <div className="bg-card rounded-[6px] border border-border/50 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary font-semibold">
                    <Building2 className="w-4 h-4" />
                    <h3>Registres Secondaires <span className="text-xs text-muted-foreground font-normal ml-1">(Optionnel)</span></h3>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20"
                    onClick={() => {
                      const list = parseSecondaryRc(formData.secondary_rc);
                      list.push({ rc: "", address: "" });
                      setFormData({ ...formData, secondary_rc: JSON.stringify(list) });
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Ajouter
                  </Button>
                </div>

                <div className="space-y-3">
                  {parseSecondaryRc(formData.secondary_rc).map((item, index, arr) => (
                    <div key={index} className="flex gap-4 items-start p-4 bg-secondary/20 border border-border/50 rounded-[6px]">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">RC Secondaire</Label>
                          <Input
                            value={item.rc}
                            placeholder="Ex: 00 B 0000001"
                            className="font-mono text-sm bg-background"
                            onChange={(e) => {
                              const newList = [...arr];
                              newList[index].rc = e.target.value;
                              setFormData({ ...formData, secondary_rc: JSON.stringify(newList) });
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Adresse de la Succursale</Label>
                          <Input
                            value={item.address}
                            placeholder="Zone Industrielle, Alger"
                            className="bg-background"
                            onChange={(e) => {
                              const newList = [...arr];
                              newList[index].address = e.target.value;
                              setFormData({ ...formData, secondary_rc: JSON.stringify(newList) });
                            }}
                          />
                        </div>
                      </div>

                      {arr.length > 1 && (
                        <button
                          type="button"
                          className="h-11 w-11 mt-[26px] rounded-[6px] flex items-center justify-center text-muted-foreground bg-background border border-border/50 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all shrink-0"
                          onClick={() => {
                            const newList = [...arr];
                            newList.splice(index, 1);
                            setFormData({ ...formData, secondary_rc: JSON.stringify(newList) });
                          }}
                          title="Supprimer cette succursale"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
