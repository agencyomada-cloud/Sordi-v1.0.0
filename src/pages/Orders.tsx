import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Eye, Search, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useOrders, useDeleteOrder } from "@/hooks/useOrders";
import { generateOrderPDF } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { db } from "@/lib/database";
import { useSettings } from "@/hooks/useSettings";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  confirmed: { label: "Confirmée", variant: "success" },
  delivered: { label: "Livrée", variant: "outline" },
  cancelled: { label: "Annulée", variant: "destructive" },
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const { data: orders, isLoading } = useOrders();
  const deleteOrder = useDeleteOrder();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrders = orders?.filter(order =>
    order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.clients?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-DZ", {
      style: "decimal",
      minimumFractionDigits: 2,
    }).format(amount) + " DA";
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteOrder.mutate(deleteId, {
        onSuccess: () => {
          toast.success("Commande supprimée avec succès");
          setDeleteId(null);
        },
        onError: () => {
          toast.error("Erreur lors de la suppression");
        }
      });
    }
  };

  const { data: settings } = useSettings();

  const handleDownloadPDF = async (orderId: string) => {
    try {
      const fullOrder = await db.orders.getById(orderId);
      if (!fullOrder) {
        toast.error("Impossible de récupérer les détails de la commande");
        return;
      }

      const items = await db.orders.getItems(orderId);

      if (!fullOrder.client_id) {
        toast.error("Cette commande n'a pas de client associé");
        return;
      }

      const client = await db.clients.getById(fullOrder.client_id);

      const orderForPDF = {
        ...fullOrder,
        order_items: items.map(item => ({
          ...item,
          products: item.products ? {
            code: item.products.code,
            name: item.products.name,
          } : undefined
        })),
        clients: client ? {
          name: client.name,
          address: client.address,
          city: client.city,
          wilaya: client.wilaya,
          phone: client.phone,
          email: client.email,
          nif: client.nif,
          nis: client.nis,
          rc: client.rc,
          ai: client.ai,
        } : undefined
      };

      await generateOrderPDF(orderForPDF, settings);
      toast.success("PDF téléchargé avec succès");
      toast.success("PDF téléchargé");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Erreur lors de la génération du PDF");
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
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Bons de Commande</h1>
              <p className="text-muted-foreground mt-1">Gérez vos bons de commande clients</p>
            </div>
            <Button onClick={() => navigate("/orders/new")}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau BC
            </Button>
          </div>

          {/* Stats */}
          <div className="mb-6">
            <div className="bg-card rounded-3xl p-6 shadow-card border border-border/30 flex items-center gap-5 w-fit">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center">
                <ClipboardList className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground tracking-tight">{orders?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Commandes</p>
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
                placeholder="Rechercher une commande..."
                className="pl-11"
              />
            </div>
          </div>

          <div className="bg-card rounded-3xl border border-border/30 shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Commande</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Livraison prévue</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead className="hidden sm:table-cell">Statut</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoading columns={7} rows={5} />
                ) : !filteredOrders || filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState
                        type="default"
                        title="Aucun bon de commande"
                        description={searchQuery ? "Essayez de modifier votre recherche" : "Créez votre premier bon de commande"}
                        action={!searchQuery ? {
                          label: "Créer une commande",
                          onClick: () => navigate("/orders/new")
                        } : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const statusConfig = STATUS_CONFIG[order.status || "draft"];
                    return (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell className="text-muted-foreground">{order.clients?.name || "-"}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {format(new Date(order.order_date), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {order.delivery_date
                            ? format(new Date(order.delivery_date), "dd MMM yyyy", { locale: fr })
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(order.total_ttc || 0)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => navigate(`/orders/${order.id}`)}
                              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadPDF(order.id)}
                              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all"
                            >
                              <ClipboardList className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteId(order.id)}
                              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </main>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le bon de commande ?</AlertDialogTitle>
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
