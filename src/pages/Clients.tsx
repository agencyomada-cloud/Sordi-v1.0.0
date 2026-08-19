import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RiAddLine as Plus,
  RiMoreFill as MoreHorizontal,
  RiPencilLine as Pencil,
  RiDeleteBinLine as Trash2,
  RiEyeLine as Eye,
  RiDownloadLine as Download,
  RiUploadLine as Upload,
  RiGroupLine as Users,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TableLoading } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useClients, useCreateClient, useDeleteClient, type CreateClientData } from "@/hooks/useClients";
import { exportToCSV, parseCSV, validateClientImport } from "@/lib/csvUtils";
import { toast } from "sonner";

export default function ClientsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clients, isLoading, refetch } = useClients();
  const createClient = useCreateClient();
  const deleteClient = useDeleteClient();

  const filteredClients = clients?.filter(client => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase().trim();

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
            secondary_rc: clientData.secondary_rc || JSON.stringify([{ rc: "", address: "" }]),
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
          <div className="max-w-[1600px] mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 animate-fade-in-down">
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
                className="w-10 h-10 rounded-[6px] bg-card shadow-card flex items-center justify-center hover:bg-secondary transition-all active:scale-[0.96]"
                title="Importer des clients"
              >
                <Upload className="w-4 h-4 text-muted-foreground" />
              </button>

              <button
                onClick={handleExport}
                disabled={!clients || clients.length === 0}
                className="w-10 h-10 rounded-[6px] bg-card shadow-card flex items-center justify-center hover:bg-secondary transition-all active:scale-[0.96]"
                title="Exporter les clients"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
              </button>

              <Button className="gap-2" onClick={() => navigate("/clients/new")}>
                <Plus className="w-4 h-4" />
                Nouveau client
              </Button>
            </div>
          </div>

          {/* Stats card */}
          <div className="mb-6 animate-fade-in-up animation-delay-100">
            <div className="bg-card rounded-[6px] p-6 shadow-card border border-border/30 flex items-center gap-5 w-fit card-hover">
              <div className="w-14 h-14 bg-primary rounded-[6px] flex items-center justify-center">
                <Users className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground tracking-tight tabular-nums">{clients?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Clients enregistrés</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6 animate-fade-in-up animation-delay-150">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Rechercher par nom, code, téléphone..."
              containerClassName="w-full md:w-80"
            />
          </div>

          {/* Table */}
          <div className="bg-card rounded-[6px] border border-border/30 shadow-card overflow-hidden animate-fade-in-up animation-delay-200">
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
                        action={searchQuery ? {
                          label: "Effacer la recherche",
                          onClick: () => setSearchQuery(""),
                        } : {
                          label: "Créer",
                          onClick: () => navigate("/clients/new"),
                        }}
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
                            <button className="w-9 h-9 rounded-[6px] flex items-center justify-center hover:bg-secondary transition-all">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/clients/${client.id}`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Voir
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/clients/${client.id}/edit`)}>
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
          </div>
        </main>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
