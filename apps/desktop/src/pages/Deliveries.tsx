import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RiAddLine as Plus,
  RiMoreFill as MoreHorizontal,
  RiFileTextLine as FileText,
  RiTruckLine as Truck,
  RiEyeLine as Eye,
  RiLoader4Line as Loader2
} from "@remixicon/react";
import { Button, SearchInput, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TableLoading, EmptyState } from "@sordi/ui";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useDeliveryNotes } from "@/hooks/useDeliveryNotes";
import { useClients } from "@/hooks/useClients";
import { toast } from "sonner";
import { useSettings } from "@/hooks/useSettings";
import { useLicenseStatus } from "@/hooks/useLicense";
import { generateDeliveryNotePDF } from "@/lib/pdfGenerator";

export default function DeliveriesPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClient, setFilterClient] = useState<string>("all");



  const { data: clients } = useClients();
  const { data: deliveryNotes, isLoading } = useDeliveryNotes(
    undefined
  );
  const { data: settings } = useSettings();
  const { data: licenseStatus } = useLicenseStatus();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);


  const filteredNotes = deliveryNotes?.filter(note => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (note.delivery_number || "").toLowerCase().includes(q) ||
      (note.clients?.name || "").toLowerCase().includes(q);
    const matchesClient = filterClient === "all" || note.client_id === filterClient;
    return matchesSearch && matchesClient;
  });



  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const calculateTotal = (items: any[]) => {
    return items?.reduce((sum, item) => sum + (item.quantity * (item.products?.unit_price || 0)), 0) || 0;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-DZ", {
      style: "decimal",
      minimumFractionDigits: 2,
    }).format(amount) + " DA";
  };



  const handleDownloadPDF = async (id: string) => {
    const note = deliveryNotes?.find(n => n.id === id);
    if (!note) return;

    try {
      setDownloadingId(id);
      await generateDeliveryNotePDF(note as any, settings, true, undefined, licenseStatus?.state === "active");
      toast.success("PDF téléchargé avec succès");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 p-8 pt-4">
          <div className="max-w-[1600px] mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Bons de livraison</h1>
              <p className="text-muted-foreground mt-1">Gérez vos livraisons et générez des factures</p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Button onClick={() => navigate("/deliveries/new")}>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau bon
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-6">
            <div className="bg-card rounded-3xl p-6 shadow-card border border-border/30 flex items-center gap-5 w-fit">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center">
                <Truck className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground tracking-tight">{deliveryNotes?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Bons de livraison</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              containerClassName="w-full sm:w-80"
            />
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Tous les clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les clients</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>N° BL</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead className="w-14"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoading columns={5} rows={5} />
              ) : filteredNotes?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState
                      type="deliveries"
                      title="Aucun bon de livraison trouvé"
                      description={searchQuery ? "Essayez de modifier votre recherche" : "Créez votre premier bon de livraison"}
                      action={searchQuery ? {
                        label: "Effacer la recherche",
                        onClick: () => setSearchQuery(""),
                      } : {
                        label: "Créer un bon",
                        onClick: () => navigate("/deliveries/new"),
                      }}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredNotes?.map((note) => (
                  <TableRow
                    key={note.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/deliveries/${note.id}`)}
                  >
                    <TableCell className="font-medium">
                      {note.delivery_number}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {note.clients?.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {formatDate(note.delivery_date)}
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {formatCurrency(calculateTotal(note.delivery_note_items || []))}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-9 h-9 rounded-[6px] flex items-center justify-center hover:bg-secondary transition-all">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/deliveries/${note.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Voir détails
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadPDF(note.id)} disabled={downloadingId === note.id}>
                            {downloadingId === note.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                            {downloadingId === note.id ? "Téléchargement..." : "Télécharger PDF"}
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
    </div>
  );
}
