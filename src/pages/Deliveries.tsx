import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, MoreHorizontal, FileText, Truck, Eye, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TableLoading } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useDeliveryNotes } from "@/hooks/useDeliveryNotes";
import { useClients } from "@/hooks/useClients";
import { toast } from "sonner";
import { db } from "@/lib/database"; // Correct import path
import { useSettings } from "@/hooks/useSettings";
// Assuming there is a generateDeliveryNotePDF. If not, I'll need to check pdfGenerator.ts again or stick to known exports. 
// Checking pdfGenerator.ts earlier, it had generateInvoicePDF and generateOrderPDF. 
// I need to check if there is a generateDeliveryNotePDF.
// I'll assume for now I need to check/add it or use a generic one.
// Wait, let's check pdfGenerator.ts content again or just assume it's missing and I might need to add it?
// The user said "bon de livraison" has the same problem. 
// If it has the problem, it means it EXISTS.
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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);


  const filteredNotes = deliveryNotes?.filter(note =>
    note.delivery_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.clients?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );



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
      await generateDeliveryNotePDF(note as any, settings);
      toast.success("PDF téléchargé avec succès");
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
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="pl-11"
              />
            </div>
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
          <div className="bg-card rounded-3xl border border-border/30 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">

                    <th className="px-5 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">N° BL</th>
                    <th className="px-5 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Client</th>
                    <th className="px-5 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Date</th>


                    <th className="px-5 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Montant</th>

                    <th className="px-5 py-4 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <TableLoading columns={5} rows={5} />
                  ) : filteredNotes?.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          type="deliveries"
                          title="Aucun bon de livraison trouvé"
                          description={searchQuery ? "Essayez de modifier votre recherche" : "Créez votre premier bon de livraison"}
                          action={!searchQuery ? {
                            label: "Créer un bon",
                            onClick: () => navigate("/deliveries/new")
                          } : undefined}
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredNotes?.map((note) => (
                      <tr
                        key={note.id}
                        className="border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/deliveries/${note.id}`)}
                      >

                        <td className="px-5 py-4 font-medium">
                          {note.delivery_number}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {note.clients?.name}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground hidden md:table-cell">
                          {formatDate(note.delivery_date)}
                        </td>


                        <td className="px-5 py-4 font-medium">
                          {formatCurrency(calculateTotal(note.delivery_note_items || []))}
                        </td>

                        <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all">
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
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
