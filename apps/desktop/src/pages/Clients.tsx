import { useMemo, useRef, useState } from "react";
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
  RiUserAddLine as UserAddIcon,
  RiMapPinLine as MapPinIcon,
  RiErrorWarningLine as AlertCircle,
} from "@remixicon/react";
import { Button, SearchInput, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, TableLoading, EmptyState, Tooltip, TooltipTrigger, TooltipContent } from "@sordi/ui";
import { MetricStrip } from "@/components/ui/metric-strip";
import { cn } from "@/lib/utils";
import { useClients, useCreateClient, useDeleteClient, useClientOverviewStatsMap, type CreateClientData } from "@/hooks/useClients";
import { exportToCSV, parseCSV, validateClientImport } from "@/lib/csvUtils";
import { computeClientStatus } from "@/lib/clientOverview";
import { ClientStatusBadge } from "@/components/ClientStatusBadge";
import { toast } from "sonner";
import { useSecureSession } from "@/hooks/useSecureSession";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";
import { useTableKeyboardNav } from "@/hooks/useTableKeyboardNav";

export default function ClientsPage() {
  const navigate = useNavigate();
  const { executeSecuredAction } = useSecureSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clients, isLoading, isError, refetch } = useClients();
  const { data: overviewStatsByClientId } = useClientOverviewStatsMap();
  const createClient = useCreateClient();
  const deleteClient = useDeleteClient();

  // These three derive from the full (now 100+) client list on every
  // render — memoized so they only re-run when the list or the search
  // query actually changes, not on every unrelated state update.
  const newThisMonth = useMemo(() => (clients ?? []).filter((c) => {
    const created = new Date(c.created_at);
    const now = new Date();
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  }).length, [clients]);
  const wilayasCovered = useMemo(
    () => new Set((clients ?? []).map((c) => c.wilaya).filter(Boolean)).size,
    [clients]
  );

  const filteredClients = useMemo(() => clients?.filter(client => {
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
  }), [clients, searchQuery]);

  // Desktop keyboard ergonomics — N opens a new client, Escape clears the
  // search box, ArrowUp/ArrowDown + Enter select and open a row.
  const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
    rows: filteredClients ?? [],
    onOpen: (client: any) => navigate(`/clients/${client.id}`),
    onCreate: () => navigate("/clients/new"),
    onEscape: () => setSearchQuery(""),
  });

  const handleDelete = async () => {
    if (!clientToDelete) return;
    await executeSecuredAction(() => {
      deleteClient.mutate(clientToDelete, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setClientToDelete(null);
        },
      });
    }, "Autoriser la suppression du client");
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
      const failedClients: string[] = [];
      for (const clientData of valid) {
        try {
          const clientToCreate: Omit<CreateClientData, "company_id"> = {
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
        } catch (err) {
          const label = clientData.name || clientData.code || "(sans nom)";
          failedClients.push(label);
          console.error(`Failed to import client "${label}":`, err);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} clients importés`);
      }
      if (failedClients.length > 0) {
        toast.error(
          `${failedClients.length} client(s) n'ont pas pu être importés : ${failedClients.slice(0, 5).join(", ")}${failedClients.length > 5 ? "…" : ""}`
        );
      }
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
    <>
      <main className="flex-1 p-8 pt-4">
          <div className="max-w-[1600px] mx-auto w-full">
          {/* Header — single compact desktop row, title/count left, search +
              utility icons + primary CTA right. */}
          <div className="h-9 mb-3 flex items-center justify-between gap-4 animate-fade-in-down">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-foreground truncate">Clients &amp; Relations</h1>
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground tabular-nums shrink-0">
                {clients?.length || 0}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".csv"
                className="hidden"
              />
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Rechercher par nom, code, téléphone..."
                className="h-[30px] w-64 text-xs bg-background border-border/80 rounded-md pl-7"
                containerClassName="shrink-0"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="h-[30px] w-[30px] rounded-md border border-border/80 bg-card flex items-center justify-center hover:bg-muted/60 transition-colors"
                title="Importer des clients"
              >
                <Upload className="w-3.5 h-3.5 text-muted-foreground" />
              </button>

              <button
                onClick={handleExport}
                disabled={!clients || clients.length === 0}
                className="h-[30px] w-[30px] rounded-md border border-border/80 bg-card flex items-center justify-center hover:bg-muted/60 transition-colors disabled:opacity-50"
                title="Exporter les clients"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
              </button>

              <Button className="h-[30px] px-3 text-xs font-medium rounded-md shadow-xs gap-1.5" onClick={() => navigate("/clients/new")}>
                <Plus className="w-3.5 h-3.5" />
                Nouveau client
                <kbd className="text-[10px] font-mono text-primary-foreground/70 border border-primary-foreground/30 rounded px-1 py-px">N</kbd>
              </Button>
            </div>
          </div>

          {/* Metric strip — shared KPI ribbon component (same shape as the
              Dashboard's Tier 2), replacing the old single floating stat box. */}
          <div className="mb-4 animate-fade-in-up animation-delay-100">
            <MetricStrip
              cells={[
                { key: "total", label: "Total Clients", value: String(clients?.length || 0), numericValue: clients?.length || 0, format: (v) => String(Math.round(v)), icon: Users },
                { key: "new", label: "Nouveaux ce mois", value: String(newThisMonth), numericValue: newThisMonth, format: (v) => String(Math.round(v)), icon: UserAddIcon },
                { key: "wilayas", label: "Wilayas couvertes", value: String(wilayasCovered), numericValue: wilayasCovered, format: (v) => String(Math.round(v)), icon: MapPinIcon },
              ]}
            />
          </div>

          {/* Edge-to-edge desktop data grid. */}
          <div className="animate-fade-in-up animation-delay-200 border border-border/80 rounded-md bg-card overflow-hidden w-full">
            <Table>
              <TableHeader>
                <TableRow className="h-8 bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Code</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nom</TableHead>
                  <TableHead className="hidden md:table-cell text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Téléphone</TableHead>
                  <TableHead className="hidden lg:table-cell text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Wilaya</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Statut</TableHead>
                  <TableHead className="w-14"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoading columns={6} rows={5} />
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState
                        icon={AlertCircle}
                        tone="destructive"
                        title="Échec du chargement des données"
                        description="Une erreur est survenue lors du chargement des clients."
                        action={{ label: "Réessayer", onClick: () => refetch() }}
                      />
                    </TableCell>
                  </TableRow>
                ) : filteredClients?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
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
                  filteredClients?.map((client, index) => (
                    <TableRow
                      key={client.id}
                      className={cn(
                        "h-8 text-xs border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer",
                        focusedIndex === index && "bg-muted/40 ring-1 ring-inset ring-ring/40"
                      )}
                      dimmed={client.is_active === false}
                      onClick={() => navigate(`/clients/${client.id}`)}
                      onMouseEnter={() => setFocusedIndex(index)}
                    >
                      <TableCell className="text-muted-foreground font-mono tabular-nums tracking-tight">{client.code || "-"}</TableCell>
                      <TableCell className="font-medium max-w-[240px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block truncate">{client.name}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top">{client.name}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">{client.phone || "-"}</TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">{client.wilaya || "-"}</TableCell>
                      <TableCell>
                        {(() => {
                          const stats = overviewStatsByClientId.get(client.id);
                          return stats ? <ClientStatusBadge status={computeClientStatus(stats)} /> : null;
                        })()}
                      </TableCell>
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

      <DeleteConfirmationModal
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Supprimer le client"
        itemIdentifier={clients?.find((c) => c.id === clientToDelete)?.name || "Client"}
        description="Cette action est irréversible. Toutes les données associées à ce client (factures, devis, historique) seront définitivement supprimées."
        isLoading={deleteClient.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
