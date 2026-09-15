import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RiAddLine as Plus,
  RiDeleteBinLine as Trash2,
  RiEyeLine as Eye,
  RiEditLine as Edit,
  RiDownloadLine as Download,
  RiMailSendLine as MailIcon,
  RiMoreFill as MoreHorizontal,
  RiCheckLine as Check,
  RiFolderZipLine as FolderZip,
  RiLoader4Line as Loader2,
} from "@remixicon/react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button, Checkbox, SearchInput, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, TableLoading, EmptyState, StatusBadge, Tooltip, TooltipTrigger, TooltipContent } from "@sordi/ui";
import { RiFileCopyLine as Copy } from "@remixicon/react";
import { useOrders, useDeleteOrder, useUpdateOrderStatus } from "@/hooks/useOrders";
import { generateOrderPDF, generateInvoicePDFBlob, blobToBase64, downloadBlobsAsZip, openSavedFile } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { db } from "@/lib/database";
import { useSettings } from "@/hooks/useSettings";
import { useLicenseStatus } from "@/hooks/useLicense";
import { SendDocumentEmailModal } from "@/components/email/SendDocumentEmailModal";
import { BulkActionBar } from "@/components/BulkActionBar";
import type { DraftOrderInput } from "@/lib/emailDrafter";
import { useSecureSession } from "@/hooks/useSecureSession";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";
import { useTableKeyboardNav } from "@/hooks/useTableKeyboardNav";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; variant: "neutral" | "success" | "warning" | "error" }> = {
  draft: { label: "Brouillon", variant: "neutral" },
  confirmed: { label: "Confirmée", variant: "success" },
  delivered: { label: "Livrée", variant: "neutral" },
  cancelled: { label: "Annulée", variant: "error" },
};

// Falls back instead of crashing the page for any status value this map
// doesn't cover (legacy data, a future status added elsewhere).
const FALLBACK_ORDER_STATUS = { label: "Statut inconnu", variant: "neutral" as const };
const getOrderStatusConfig = (status: string | null | undefined) =>
  STATUS_CONFIG[status || "draft"] || FALLBACK_ORDER_STATUS;

export default function OrdersPage() {
  const navigate = useNavigate();
  const { executeSecuredAction } = useSecureSession();
  const { data: orders, isLoading } = useOrders();
  const deleteOrder = useDeleteOrder();
  const updateOrderStatus = useUpdateOrderStatus();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkConfirming, setIsBulkConfirming] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const filteredOrders = orders?.filter(order => {
    const q = searchQuery.toLowerCase().trim();
    return (
      !q ||
      (order.order_number || "").toLowerCase().includes(q) ||
      (order.clients?.name || "").toLowerCase().includes(q)
    );
  });

  // Desktop keyboard ergonomics — N opens a new order, Escape clears the
  // search box, ArrowUp/ArrowDown + Enter select and open a row.
  const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
    rows: filteredOrders ?? [],
    onOpen: (order: any) => navigate(`/orders/${order.id}`),
    onCreate: () => navigate("/orders/new"),
    onEscape: () => setSearchQuery(""),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-DZ", {
      style: "decimal",
      minimumFractionDigits: 2,
    }).format(amount) + " DA";
  };

  const handleDelete = async () => {
    if (deleteId) {
      await executeSecuredAction(() => {
        deleteOrder.mutate(deleteId, {
          onSuccess: () => {
            setDeleteId(null);
          },
          onError: () => {
            toast.error("Erreur lors de la suppression");
          }
        });
      }, "Autoriser la suppression de la commande");
    }
  };

  const { data: settings } = useSettings();
  const { data: licenseStatus } = useLicenseStatus();
  const [emailTarget, setEmailTarget] = useState<any | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  // Shared by the single-row download and the bulk zip export.
  const buildOrderForPDF = async (orderId: string) => {
    const fullOrder = await db.orders.getById(orderId);
    if (!fullOrder) throw new Error("Impossible de récupérer les détails de la commande");

    const items = await db.orders.getItems(orderId);
    const client = fullOrder.client_id ? await db.clients.getById(fullOrder.client_id) : null;

    return {
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
  };

  const handleDownloadPDF = async (orderId: string) => {
    try {
      const orderForPDF = await buildOrderForPDF(orderId);
      await generateOrderPDF(orderForPDF, settings, true, undefined, licenseStatus?.license_state, ({ path, blob, fileName }) => {
        toast.success("PDF téléchargé avec succès", {
          description: `Enregistré sous : ${path || fileName}`,
          action: { label: "Ouvrir", onClick: () => openSavedFile(path, blob) },
          duration: 6000,
        });
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error(error instanceof Error ? error.message : "Erreur lors de la génération du PDF");
    }
  };

  const handleOpenEmailModal = async (orderId: string) => {
    try {
      const fullOrder = await db.orders.getById(orderId);
      if (!fullOrder) {
        toast.error("Impossible de récupérer les détails de la commande");
        return;
      }
      const items = await db.orders.getItems(orderId);
      const client = fullOrder.client_id ? await db.clients.getById(fullOrder.client_id) : null;

      setEmailTarget({
        ...fullOrder,
        order_items: items,
        clients: client ? { name: client.name, email: client.email } : undefined,
      });
      setEmailModalOpen(true);
    } catch (error) {
      console.error("Failed to load order for email:", error);
      toast.error("Impossible de préparer l'email pour cette commande");
    }
  };

  const toggleAll = () => {
    if (selectedOrders.length === filteredOrders?.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders?.map((o) => o.id) || []);
    }
  };

  const toggleOrder = (id: string) => {
    setSelectedOrders((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const clearSelection = () => setSelectedOrders([]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("ID copié dans le presse-papiers");
  };

  const handleBulkMarkConfirmed = async () => {
    setIsBulkConfirming(true);
    try {
      const results = await Promise.allSettled(
        selectedOrders.map((id) => updateOrderStatus.mutateAsync({ id, status: "confirmed" }))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        toast.success(`${results.length} commande${results.length > 1 ? "s" : ""} confirmée${results.length > 1 ? "s" : ""}`);
      } else {
        toast.error(`${failed} commande(s) sur ${results.length} n'ont pas pu être mises à jour`);
      }
      clearSelection();
    } finally {
      setIsBulkConfirming(false);
    }
  };

  const handleBulkDownloadZip = async () => {
    setIsBulkDownloading(true);
    try {
      const results = await Promise.allSettled(
        selectedOrders.map(async (id) => {
          const orderForPDF = await buildOrderForPDF(id);
          const blob = await generateInvoicePDFBlob(orderForPDF, settings, licenseStatus?.license_state);
          return { blob, fileName: `BonCommande-${orderForPDF.order_number || id}.pdf` };
        })
      );
      const files = results.filter((r): r is PromiseFulfilledResult<{ blob: Blob; fileName: string }> => r.status === "fulfilled").map((r) => r.value);
      const failed = results.length - files.length;

      if (files.length === 0) {
        toast.error("Aucun PDF n'a pu être généré");
        return;
      }

      await downloadBlobsAsZip(files, `Commandes-${new Date().toISOString().split("T")[0]}.zip`);
      toast.success(
        failed === 0
          ? `${files.length} commande${files.length > 1 ? "s" : ""} téléchargée${files.length > 1 ? "s" : ""} (ZIP)`
          : `${files.length} commande(s) téléchargées, ${failed} en échec`
      );
      clearSelection();
    } catch (error) {
      console.error("Bulk PDF download error:", error);
      toast.error("Erreur lors du téléchargement groupé");
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const results = await Promise.allSettled(selectedOrders.map((id) => deleteOrder.mutateAsync(id)));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        toast.success(`${results.length} commande${results.length > 1 ? "s" : ""} supprimée${results.length > 1 ? "s" : ""}`);
      } else {
        toast.error(`${failed} commande(s) sur ${results.length} n'ont pas pu être supprimées`);
      }
      clearSelection();
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <>
      <main className="flex-1 p-8 pt-4">
          <div className="max-w-[1600px] mx-auto w-full">
          <div className="flex flex-col items-start xl:flex-row xl:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Bons de Commande</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gérez vos bons de commande clients · {orders?.length || 0} commande{(orders?.length || 0) > 1 ? "s" : ""}
              </p>
            </div>
            <Button onClick={() => navigate("/orders/new")}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau BC
              <kbd className="ml-1.5 text-[10px] font-mono text-primary-foreground/70 border border-primary-foreground/30 rounded px-1 py-px">N</kbd>
            </Button>
          </div>

          {/* Search */}
          <div className="mb-6">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Rechercher une commande..."
              containerClassName="w-full md:w-80"
            />
          </div>

          {/* Bulk action bar */}
          <BulkActionBar count={selectedOrders.length} onClear={clearSelection}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full text-xs"
              onClick={handleBulkMarkConfirmed}
              disabled={isBulkConfirming}
            >
              {isBulkConfirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Marquer comme confirmées
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full text-xs"
              onClick={handleBulkDownloadZip}
              disabled={isBulkDownloading}
            >
              {isBulkDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderZip className="w-3.5 h-3.5" />}
              Télécharger en lot
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full text-xs text-destructive hover:text-destructive"
              onClick={() => setBulkDeleteDialogOpen(true)}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer la sélection
            </Button>
          </BulkActionBar>

          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="[&:has([role=checkbox])]:pl-5">
                    <Checkbox
                      checked={selectedOrders.length === filteredOrders?.length && filteredOrders?.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>N° Commande</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Livraison prévue</TableHead>
                  <TableHead numeric>Montant TTC</TableHead>
                  <TableHead className="hidden sm:table-cell">Statut</TableHead>
                  <TableHead className="w-14"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoading columns={8} rows={5} />
                ) : !filteredOrders || filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState
                        type="orders"
                        title="Aucun bon de commande"
                        description={searchQuery ? "Essayez une autre recherche" : "Créez votre premier bon de commande"}
                        action={searchQuery ? {
                          label: "Effacer la recherche",
                          onClick: () => setSearchQuery(""),
                        } : {
                          label: "Créer",
                          onClick: () => navigate("/orders/new"),
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order, index) => {
                    const statusConfig = getOrderStatusConfig(order.status);
                    return (
                      <TableRow
                        key={order.id}
                        className={cn(
                          "cursor-pointer",
                          focusedIndex === index && "bg-muted/40 ring-1 ring-inset ring-ring/40"
                        )}
                        dimmed={order.status === "cancelled"}
                        onClick={() => navigate(`/orders/${order.id}`)}
                        onMouseEnter={() => setFocusedIndex(index)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={() => toggleOrder(order.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium font-mono tabular-nums tracking-tight">{order.order_number}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[220px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">{order.clients?.name || "-"}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top">{order.clients?.name || "-"}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground whitespace-nowrap">
                          {/* date-fns' format() throws (not just prints
                              "Invalid Date") on a null/malformed timestamp —
                              a guard, not just optional chaining, is needed
                              here to keep one bad row from crashing the
                              whole table. */}
                          {order.order_date && !isNaN(new Date(order.order_date).getTime())
                            ? format(new Date(order.order_date), "dd MMM yyyy", { locale: fr })
                            : "-"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground whitespace-nowrap">
                          {order.delivery_date && !isNaN(new Date(order.delivery_date).getTime())
                            ? format(new Date(order.delivery_date), "dd MMM yyyy", { locale: fr })
                            : "-"}
                        </TableCell>
                        <TableCell numeric className="font-medium">
                          {formatCurrency(order.total_ttc || 0)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <StatusBadge tone={statusConfig.variant}>{statusConfig.label}</StatusBadge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all text-muted-foreground hover:text-foreground"
                                  onClick={(e) => { e.stopPropagation(); handleCopyId(order.id); }}
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Copier l'ID</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all text-muted-foreground hover:text-foreground"
                                  onClick={(e) => { e.stopPropagation(); handleDownloadPDF(order.id); }}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Télécharger PDF</TooltipContent>
                            </Tooltip>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all">
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/orders/${order.id}`)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Voir détails
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/orders/${order.id}/edit`)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenEmailModal(order.id)}>
                                  <MailIcon className="w-4 h-4 mr-2" />
                                  Envoyer par email
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDeleteId(order.id)} className="text-destructive focus:text-destructive">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          </div>
      </main>

      <DeleteConfirmationModal
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Supprimer le bon de commande"
        itemIdentifier={orders?.find((o) => o.id === deleteId)?.order_number || "Commande"}
        description="Cette action est irréversible. La commande sera définitivement supprimée."
        isLoading={deleteOrder.isPending}
        onConfirm={handleDelete}
      />

      <DeleteConfirmationModal
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title={`Supprimer ${selectedOrders.length} commande${selectedOrders.length > 1 ? "s" : ""} ?`}
        description={`Cette action est irréversible et supprimera définitivement ${selectedOrders.length > 1 ? "ces commandes" : "cette commande"}.`}
        isLoading={isBulkDeleting}
        onConfirm={handleBulkDelete}
      />

      {emailTarget && (
        <SendDocumentEmailModal
          open={emailModalOpen}
          onOpenChange={(next) => {
            setEmailModalOpen(next);
            if (!next) setEmailTarget(null);
          }}
          recipientEmail={emailTarget.clients?.email || emailTarget.supplier_email}
          fileName={`BonCommande-${emailTarget.order_number || "000"}.pdf`}
          draftInput={{
            docType: "order",
            documentNumber: emailTarget.order_number,
            clientName: emailTarget.clients?.name || emailTarget.supplier_name || "",
            documentDate: emailTarget.order_date,
            deliveryDate: emailTarget.delivery_date,
            totalTTC: emailTarget.total_ttc,
            senderCompany: settings?.company_name || "Sordi",
            items: (emailTarget.order_items || []).map((item: any) => ({
              name: item.product_name || item.products?.name || "Article",
              quantity: item.quantity,
              unitPrice: item.unit_price,
            })),
          } satisfies DraftOrderInput}
          getPdfBase64={async () => {
            const blob = await generateInvoicePDFBlob(emailTarget, settings, licenseStatus?.license_state);
            return blobToBase64(blob);
          }}
        />
      )}
    </>
  );
}
