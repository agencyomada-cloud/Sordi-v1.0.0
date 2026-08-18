import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, MoreHorizontal, Pencil, Trash2, Eye, Download, Upload, Users, User, MapPin, FileText, Building2, CreditCard, Phone, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TableLoading } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useClients, useCreateClient, useUpdateClient, useDeleteClient, type CreateClientData } from "@/hooks/useClients";
import { exportToCSV, parseCSV, validateClientImport } from "@/lib/csvUtils";
import { toast } from "sonner";

export default function ClientsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultForm: CreateClientData = {
    name: "",
    code: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    wilaya: "",
    nif: "",
    nis: "",
    rc: "",
    secondary_rc: JSON.stringify([{ rc: "", address: "" }]), // Initialize as JSON string
    secondary_address: "",
    ai: "",
    activite: "",
    initial_balance: undefined,
    credit_limit: undefined,
    payment_terms_days: undefined,
    notes: "",
    advance_payment: undefined,
  };

  const [formData, setFormData] = useState<CreateClientData>(defaultForm);

  const { data: clients, isLoading, refetch } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const filteredClients = clients?.filter(client => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase().trim();

    // Search in multiple fields
    return (
      client.name.toLowerCase().includes(query) ||
      client.code?.toLowerCase().includes(query) ||
      client.phone?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.nif?.toLowerCase().includes(query) ||
      client.nis?.toLowerCase().includes(query) ||
      client.rc?.toLowerCase().includes(query) ||
      client.ai?.toLowerCase().includes(query) ||
      client.activite?.toLowerCase().includes(query) ||
      client.id.toLowerCase().includes(query) ||
      client.wilaya?.toLowerCase().includes(query) ||
      client.city?.toLowerCase().includes(query) ||
      client.address?.toLowerCase().includes(query)
    );
  });

  const resetForm = () => {
    setFormData(defaultForm);
    setEditingClient(null);
    setIsDialogOpen(false);
  };

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem("draft_client");
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        // Only populate if we are not editing
        if (!editingClient && parsed) {
          setFormData(parsed);
          // Optional: toast.info("Brouillon client restauré");
        }
      } catch (e) {
        console.error("Failed to parse client draft", e);
      }
    }
  }, []); // Run once on mount

  // Save to LocalStorage on change (ONLY if not editing)
  useEffect(() => {
    if (!editingClient) {
      // Only save if there is some data
      if (formData.name || formData.code || formData.email || formData.phone) {
        localStorage.setItem("draft_client", JSON.stringify(formData));
      }
    }
  }, [formData, editingClient]);

  // Restore draft when opening dialog for NEW client
  useEffect(() => {
    if (isDialogOpen && !editingClient) {
      const savedDraft = localStorage.getItem("draft_client");
      if (savedDraft) {
        try {
          setFormData(JSON.parse(savedDraft));
        } catch (e) { } // ignore
      } else {
        // If no draft, initialize with default values including the new secondary_rc structure
        setFormData({
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
          credit_limit: undefined,
          payment_terms_days: undefined,
          notes: "",
          initial_balance: undefined,
          advance_payment: undefined,
        });
      }
    }
  }, [isDialogOpen, editingClient]);

  // Helper to safely parse secondary_rc into an array of objects
  const parseSecondaryRc = (rcStr: string | null | undefined): { rc: string, address: string }[] => {
    if (!rcStr) return [{ rc: "", address: "" }];
    try {
      const parsed = JSON.parse(rcStr);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        return parsed;
      }
    } catch (e) {
      // It's probably the old format (newline or pipe separated string)
      const parts = rcStr.split(/[\n|,]/).map(s => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        return parts.map(p => ({ rc: p, address: "" }));
      }
    }
    return [{ rc: "", address: "" }];
  };

  const handleEdit = (client: any) => {
    setEditingClient(client.id);
    setFormData({
      name: client.name || "",
      code: client.code || "",
      phone: client.phone || "",
      contact_person: client.contact_person || "",
      email: client.email || "",
      address: client.address || "",
      city: client.city || "",
      wilaya: client.wilaya || "",
      nif: client.nif || "",
      nis: client.nis || "",
      rc: client.rc || "",
      secondary_rc: JSON.stringify(parseSecondaryRc(client.secondary_rc)), // Parse and stringify for consistency
      secondary_address: client.secondary_address || "",
      ai: client.ai || "",
      activite: client.activite || "",
      initial_balance: client.initial_balance,
      credit_limit: client.credit_limit,
      payment_terms_days: client.payment_terms_days,
      notes: client.notes,
      advance_payment: client.advance_payment,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingClient) {
      updateClient.mutate({ id: editingClient, ...formData }, {
        onSuccess: resetForm
      });
    } else {
      createClient.mutate(formData, {
        onSuccess: () => {
          localStorage.removeItem("draft_client");
          resetForm();
        }
      });
    }
  };

  const handleDelete = () => {
    if (!clientToDelete) return;
    deleteClient.mutate(clientToDelete, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setClientToDelete(null);
      },
    });
  };

  const handleExport = () => {
    if (!clients || clients.length === 0) {
      toast.error("Aucun client à exporter");
      return;
    }

    const columns = [
      { key: "code" as const, label: "Code" },
      { key: "name" as const, label: "Nom" },
      { key: "phone" as const, label: "Téléphone" },
      { key: "contact_person" as const, label: "Contact" },
      { key: "email" as const, label: "Email" },
      { key: "address" as const, label: "Adresse" },
      { key: "city" as const, label: "Ville" },
      { key: "wilaya" as const, label: "Wilaya" },
      { key: "nif" as const, label: "NIF" },
      { key: "nis" as const, label: "NIS" },
      { key: "rc" as const, label: "RC" },
      { key: "secondary_rc" as const, label: "RC Secondaire" },
      { key: "secondary_address" as const, label: "Adresse Secondaire" },
      { key: "ai" as const, label: "AI" },
      { key: "initial_balance" as const, label: "Solde Initial" },
      { key: "credit_limit" as const, label: "Plafond Crédit" },
      { key: "payment_terms_days" as const, label: "Délais Paiement (jours)" },
      { key: "notes" as const, label: "Notes" },
      { key: "advance_payment" as const, label: "Avance" },
    ];

    const exportData = clients.map(c => ({
      code: c.code,
      name: c.name,
      phone: c.phone,
      contact_person: c.contact_person,
      email: c.email,
      address: c.address,
      city: c.city,
      wilaya: c.wilaya,
      nif: c.nif,
      nis: c.nis,
      rc: c.rc,
      secondary_rc: c.secondary_rc,
      secondary_address: c.secondary_address,
      ai: c.ai,
      initial_balance: c.initial_balance,
      credit_limit: c.credit_limit,
      payment_terms_days: c.payment_terms_days,
      notes: c.notes,
      advance_payment: c.advance_payment,
    }));

    exportToCSV(exportData, `clients_${new Date().toISOString().split("T")[0]}`, columns);
    toast.success("Fichier CSV téléchargé avec succès");
    toast.success(`${clients.length} clients exportés`);
  };



  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const content = await file.text();
      const parsed = parseCSV(content);

      if (parsed.length === 0) {
        toast.error("Fichier CSV vide ou invalide");
        return;
      }

      const { valid, errors } = validateClientImport(parsed);

      if (errors.length > 0) {
        toast.error(`Erreurs de validation:\n${errors.slice(0, 3).join("\n")}`);
      }

      if (valid.length === 0) {
        toast.error("Aucun client valide à importer");
        return;
      }

      let successCount = 0;
      for (const clientData of valid) {
        try {
          const clientToCreate: CreateClientData = {
            name: clientData.name || "",
            code: clientData.code || "",
            phone: clientData.phone || "",
            contact_person: clientData.contact_person || "",
            email: clientData.email || "",
            address: clientData.address || "",
            city: clientData.city || "",
            wilaya: clientData.wilaya || "",
            nif: clientData.nif || "",
            nis: clientData.nis || "",
            rc: clientData.rc || "",
            secondary_rc: clientData.secondary_rc || JSON.stringify([{ rc: "", address: "" }]), // Ensure valid JSON string
            secondary_address: clientData.secondary_address || "",
            ai: clientData.ai || "",
            initial_balance: clientData.initial_balance ? parseFloat(clientData.initial_balance) : undefined,
            credit_limit: clientData.credit_limit ? parseFloat(clientData.credit_limit) : undefined,
            payment_terms_days: clientData.payment_terms_days ? parseInt(clientData.payment_terms_days) : undefined,
            notes: clientData.notes || "",
            advance_payment: clientData.advance_payment ? parseFloat(clientData.advance_payment) : undefined,
          };
          await new Promise<void>((resolve, reject) => {
            createClient.mutate(clientToCreate, {
              onSuccess: () => {
                successCount++;
                resolve();
              },
              onError: reject,
            });
          });
        } catch {
          // Continue with next client
        }
      }

      toast.success(`${successCount} clients importés`);
      refetch();
    } catch (error) {
      toast.error("Erreur lors de l'import");
      console.error(error);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 p-8 pt-4">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Clients</h1>
              <p className="text-muted-foreground mt-1">Gérez vos clients</p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".csv"
                className="hidden"
              />



              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-10 h-10 rounded-full bg-card shadow-card flex items-center justify-center hover:bg-secondary transition-all"
                title="Importer des clients"
              >
                <Upload className="w-4 h-4 text-muted-foreground" />
              </button>

              <button
                onClick={handleExport}
                disabled={!clients || clients.length === 0}
                className="w-10 h-10 rounded-full bg-card shadow-card flex items-center justify-center hover:bg-secondary transition-all"
                title="Exporter les clients"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
              </button>

              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                if (!open) resetForm(); // Reset form when closing via click outside or X
                else setIsDialogOpen(true);
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2" onClick={() => resetForm()}>
                    <Plus className="w-4 h-4" />
                    Nouveau client
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl rounded-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                  <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-background/95 backdrop-blur z-10">
                    <DialogTitle className="text-xl font-bold flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      {editingClient ? "Modifier le client" : "Nouveau client"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                      {/* Section: Informations Générales */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-primary font-semibold">
                          <User className="w-4 h-4" />
                          <h3>Informations Générales</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="md:col-span-2">
                            <Label className="text-sm font-medium text-foreground mb-1.5 block">Nom / Raison Sociale <span className="text-red-500">*</span></Label>
                            <Input
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              required
                              placeholder="SARL EXEMPLE"
                              className="h-11 rounded-xl bg-secondary/30 focus-visible:ring-primary/40 border-border/50"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-foreground mb-1.5 block">Code Client</Label>
                            <Input
                              value={formData.code}
                              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                              placeholder="CLI-001"
                              className="h-11 rounded-xl bg-secondary/30 focus-visible:ring-primary/40 border-border/50 uppercase"
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
                                className="h-11 pl-10 rounded-xl bg-secondary/30 focus-visible:ring-primary/40 border-border/50"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-foreground mb-1.5 block">Activité</Label>
                            <Input
                              value={formData.activite || ""}
                              onChange={(e) => setFormData({ ...formData, activite: e.target.value })}
                              placeholder="Concassage, BTP..."
                              className="h-11 rounded-xl bg-secondary/30 focus-visible:ring-primary/40 border-border/50"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section: Localisation & Contact */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-primary font-semibold pt-2 border-t border-border/50">
                          <MapPin className="w-4 h-4" />
                          <h3>Localisation & Contact</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <Label className="text-sm font-medium text-foreground mb-1.5 block">Personne de contact</Label>
                            <Input
                              value={formData.contact_person || ""}
                              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                              placeholder="Nom du contact"
                              className="h-11 rounded-xl bg-secondary/30 focus-visible:ring-primary/40 border-border/50"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-foreground mb-1.5 block">Adresse Email</Label>
                            <Input
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              placeholder="contact@exemple.dz"
                              className="h-11 rounded-xl bg-secondary/30 focus-visible:ring-primary/40 border-border/50"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-foreground mb-1.5 block">Wilaya / Ville</Label>
                            <Input
                              value={formData.wilaya}
                              onChange={(e) => setFormData({ ...formData, wilaya: e.target.value })}
                              placeholder="Sétif"
                              className="h-11 rounded-xl bg-secondary/30 focus-visible:ring-primary/40 border-border/50"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-sm font-medium text-foreground mb-1.5 block">Adresse Complète</Label>
                            <Textarea
                              value={formData.address}
                              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                              placeholder="Numéro, Rue, Bâtiment..."
                              className="rounded-xl bg-secondary/30 focus-visible:ring-primary/40 border-border/50 resize-none min-h-[80px]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section: Registre Secondaire (Fiscalité & Activité) */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-primary font-semibold pt-2 border-t border-border/50">
                          <FileText className="w-4 h-4" />
                          <h3>Registre Secondaire & Fiscalité</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                          <div>
                            <Label className="text-sm font-medium text-foreground mb-1.5 block">RC (Registre Commerce)</Label>
                            <Input
                              value={formData.rc}
                              onChange={(e) => setFormData({ ...formData, rc: e.target.value })}
                              placeholder="00 B 0000000"
                              className="h-11 rounded-xl bg-secondary/30 focus-visible:ring-primary/40 border-border/50 font-mono text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-foreground mb-1.5 block">NIF</Label>
                            <Input
                              value={formData.nif}
                              onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                              placeholder="00000000000"
                              className="h-11 rounded-xl bg-secondary/30 focus-visible:ring-primary/40 border-border/50 font-mono text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-foreground mb-1.5 block">NIS</Label>
                            <Input
                              value={formData.nis}
                              onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                              placeholder="00000000000"
                              className="h-11 rounded-xl bg-secondary/30 focus-visible:ring-primary/40 border-border/50 font-mono text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-foreground mb-1.5 block">AI (Art. Imposition)</Label>
                            <Input
                              value={formData.ai}
                              onChange={(e) => setFormData({ ...formData, ai: e.target.value })}
                              placeholder="00000000000"
                              className="h-11 rounded-xl bg-secondary/30 focus-visible:ring-primary/40 border-border/50 font-mono text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section: Succursales */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <div className="flex items-center gap-2 text-primary font-semibold">
                            <Building2 className="w-4 h-4" />
                            <h3>Registres Secondaires <span className="text-xs text-muted-foreground font-normal ml-1">(Optionnel)</span></h3>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 rounded-full text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
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
                            <div key={index} className="flex gap-4 items-start p-4 bg-secondary/10 border border-border/50 rounded-2xl group transition-all hover:border-primary/20 hover:bg-secondary/20">
                              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">RC Secondaire</Label>
                                  <Input
                                    value={item.rc}
                                    placeholder="Ex: 00 B 0000001"
                                    className="font-mono h-11 text-sm rounded-xl bg-background border-border/50 focus-visible:ring-primary/40"
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
                                    className="h-11 text-sm rounded-xl bg-background border-border/50 focus-visible:ring-primary/40"
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
                                  className="h-11 w-11 mt-[26px] rounded-xl flex items-center justify-center text-muted-foreground bg-background border border-border/50 hover:bg-destructive shadow-sm hover:text-destructive-foreground hover:border-destructive transition-all shrink-0"
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
                    <div className="flex justify-end items-center gap-3 p-6 pt-5 border-t border-border/50 bg-background/95 backdrop-blur z-10 mt-auto">
                      <Button type="button" variant="outline" className="rounded-xl h-11 px-6 border-border/50 hover:bg-secondary/50 font-medium" onClick={resetForm}>
                        Annuler
                      </Button>
                      <Button type="submit" className="rounded-xl h-11 px-8 gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all font-semibold" disabled={createClient.isPending || updateClient.isPending}>
                        {createClient.isPending || updateClient.isPending ? (
                          <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        ) : (
                          editingClient ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />
                        )}
                        {editingClient ? "Enregistrer" : "Créer le client"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Stats card */}
          <div className="mb-6">
            <div className="bg-card rounded-3xl p-6 shadow-card border border-border/30 flex items-center gap-5 w-fit">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center">
                <Users className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground tracking-tight">{clients?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Clients enregistrés</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, code, téléphone..."
                className="pl-11 h-11 bg-secondary/30 border-border/50 rounded-xl"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-card rounded-3xl border border-border/30 shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden md:table-cell">Téléphone</TableHead>
                  <TableHead className="hidden lg:table-cell">Wilaya</TableHead>
                  <TableHead className="w-14"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoading columns={5} rows={5} />
                ) : filteredClients?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <EmptyState
                        type="clients"
                        title="Aucun client"
                        description={searchQuery ? "Essayez une autre recherche" : "Créez votre premier client"}
                        action={!searchQuery ? {
                          label: "Créer",
                          onClick: () => setIsDialogOpen(true)
                        } : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients?.map((client) => (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/clients/${client.id}`)}
                    >
                      <TableCell className="text-muted-foreground font-mono">{client.code || "-"}</TableCell>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">{client.phone || "-"}</TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">{client.wilaya || "-"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/clients/${client.id}`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Voir
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(client)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setClientToDelete(client.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </main>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground rounded-full">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
