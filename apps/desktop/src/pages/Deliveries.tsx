import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RiAddLine as Plus,
  RiMoreFill as MoreHorizontal,
  RiEyeLine as Eye,
  RiEditLine as Edit,
  RiCheckLine as Check,
  RiDeleteBinLine as Trash2,
  RiLoader4Line as Loader2,
  RiMailSendLine as MailIcon,
  RiFolderZipLine as FolderZip,
  RiFileCopyLine as Copy,
  RiDownloadLine as Download,
} from "@remixicon/react";
import {
  Button, StatusBadge, Checkbox, SearchInput, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  TableLoading, EmptyState, Tooltip, TooltipTrigger, TooltipContent,
} from "@sordi/ui";
import { useDeliveryNotes, useSetDeliveryStatus, useDeleteDeliveryNote } from "@/hooks/useDeliveryNotes";
import type { DeliveryNoteStatus } from "@/lib/database";
import { useClients } from "@/hooks/useClients";
import { toast } from "sonner";
import { useSettings } from "@/hooks/useSettings";
import { generateDeliveryNotePDF, generateDeliveryNotePDFBlob, buildDeliveryNotePDFData, blobToBase64, downloadBlobsAsZip } from "@/lib/pdfGenerator";
import { SendDocumentEmailModal } from "@/components/email/SendDocumentEmailModal";
import { BulkActionBar } from "@/components/BulkActionBar";
import type { DraftDeliveryInput } from "@/lib/emailDrafter";
import { useSecureSession } from "@/hooks/useSecureSession";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";

const STATUS_CONFIG: Record<DeliveryNoteStatus, { label: string; variant: "neutral" | "warning" | "success" }> = {
  draft: { label: "Brouillon", variant: "neutral" },
  printed: { label: "Imprimé", variant: "warning" },
  signed: { label: "Livré & Signé", variant: "success" },
};

export default function DeliveriesPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | DeliveryNoteStatus>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: clients } = useClients();
  const { data: deliveryNotes, isLoading } = useDeliveryNotes(
    undefined
  );
  const { data: settings } = useSettings();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const setDeliveryStatus = useSetDeliveryStatus();
  const deleteDeliveryNote = useDeleteDeliveryNote();
  const { executeSecuredAction } = useSecureSession();
  const [emailNoteId, setEmailNoteId] = useState<string | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedDeliveries, setSelectedDeliveries] = useState<string[]>([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkMarkingSigned, setIsBulkMarkingSigned] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const filteredNotes = deliveryNotes?.filter(note => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (note.delivery_number || "").toLowerCase().includes(q) ||
      (note.clients?.name || "").toLowerCase().includes(q);
    const matchesClient = filterClient === "all" || note.client_id === filterClient;
    const matchesStatus = filterStatus === "all" || (note.status || "draft") === filterStatus;
    return matchesSearch && matchesClient && matchesStatus;
  });



  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const calculateTotal = (items: any[]) => {
    return items?.reduce((sum, item) => sum + (item.quantity * (item.unit_price ?? item.products?.unit_price ?? 0)), 0) || 0;
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
      const pdfData = buildDeliveryNotePDFData(note);
      const saved = await generateDeliveryNotePDF(pdfData, settings);
      // First export moves a draft into "awaiting client validation" —
      // skipped if the user cancelled the save dialog, or the note is
      // already past this stage (printed/signed).
      if (saved && (note.status || "draft") === "draft") {
        setDeliveryStatus.mutate({ id, status: "printed" });
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleMarkSigned = (id: string) => {
    setDeliveryStatus.mutate({ id, status: "signed" }, {
      onSuccess: () => toast.success("Bon de livraison marqué comme signé"),
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await executeSecuredAction(() => {
      deleteDeliveryNote.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }, "Autoriser la suppression du bon de livraison");
  };

  const toggleAll = () => {
    if (selectedDeliveries.length === filteredNotes?.length) {
      setSelectedDeliveries([]);
    } else {
      setSelectedDeliveries(filteredNotes?.map((n) => n.id) || []);
    }
  };

  const toggleDelivery = (id: string) => {
    setSelectedDeliveries((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const clearSelection = () => setSelectedDeliveries([]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("ID copié dans le presse-papiers");
  };

  const handleBulkMarkSigned = async () => {
    setIsBulkMarkingSigned(true);
    try {
      const results = await Promise.allSettled(
        selectedDeliveries.map((id) => setDeliveryStatus.mutateAsync({ id, status: "signed" }))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        toast.success(`${results.length} bon${results.length > 1 ? "s" : ""} marqué${results.length > 1 ? "s" : ""} signé${results.length > 1 ? "s" : ""}`);
      } else {
        toast.error(`${failed} bon(s) sur ${results.length} n'ont pas pu être mis à jour`);
      }
      clearSelection();
    } finally {
      setIsBulkMarkingSigned(false);
    }
  };

  const handleBulkDownloadZip = async () => {
    setIsBulkDownloading(true);
    try {
      const results = await Promise.allSettled(
        selectedDeliveries.map(async (id) => {
          const note = deliveryNotes?.find((n) => n.id === id);
          if (!note) throw new Error("Bon introuvable");
          const pdfData = buildDeliveryNotePDFData(note);
          const blob = await generateDeliveryNotePDFBlob(pdfData, settings);
          return { blob, fileName: `BonLivraison-${pdfData.delivery_number || id}.pdf` };
        })
      );
      const files = results.filter((r): r is PromiseFulfilledResult<{ blob: Blob; fileName: string }> => r.status === "fulfilled").map((r) => r.value);
      const failed = results.length - files.length;

      if (files.length === 0) {
        toast.error("Aucun PDF n'a pu être généré");
        return;
      }

      await downloadBlobsAsZip(files, `Livraisons-${new Date().toISOString().split("T")[0]}.zip`);
      toast.success(
        failed === 0
          ? `${files.length} bon${files.length > 1 ? "s" : ""} téléchargé${files.length > 1 ? "s" : ""} (ZIP)`
          : `${files.length} bon(s) téléchargés, ${failed} en échec`
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
      const results = await Promise.allSettled(selectedDeliveries.map((id) => deleteDeliveryNote.mutateAsync(id)));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        toast.success(`${results.length} bon${results.length > 1 ? "s" : ""} supprimé${results.length > 1 ? "s" : ""}`);
      } else {
        toast.error(`${failed} bon(s) sur ${results.length} n'ont pas pu être supprimés`);
      }
      clearSelection();
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const emailNote = deliveryNotes?.find(n => n.id === emailNoteId);
  const emailPdfData = emailNote ? buildDeliveryNotePDFData(emailNote) : null;

  return (
    <>
      <main className="flex-1 p-8 pt-4">
          <div className="max-w-[1600px] mx-auto w-full">
          <div className="flex flex-col items-start xl:flex-row xl:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">Bons de livraison</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gérez vos livraisons et générez des factures · {deliveryNotes?.length || 0} bon{(deliveryNotes?.length || 0) > 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button variant="default" size="sm" className="h-[30px] px-3 text-xs rounded-md gap-1.5" onClick={() => navigate("/deliveries/new")}>
                <Plus className="w-3.5 h-3.5" />
                Nouveau bon
              </Button>
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
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | DeliveryNoteStatus)}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="draft">Brouillons</SelectItem>
                <SelectItem value="printed">Imprimés</SelectItem>
                <SelectItem value="signed">Signés</SelectItem>
              </SelectContent>
            </Select>

          </div>

          {/* Bulk action bar */}
          <BulkActionBar count={selectedDeliveries.length} onClear={clearSelection}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full text-xs"
              onClick={handleBulkMarkSigned}
              disabled={isBulkMarkingSigned}
            >
              {isBulkMarkingSigned ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Marquer comme Signés
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

          {/* Table */}
          <div className="border border-border/80 rounded-md bg-card overflow-hidden w-full">
          <Table>
            <TableHeader>
              <TableRow className="h-8 bg-muted/40 hover:bg-muted/40">
                <TableHead className="[&:has([role=checkbox])]:pl-5 px-3">
                  <Checkbox
                    checked={selectedDeliveries.length === filteredNotes?.length && filteredNotes?.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase px-3">N° BL</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Client</TableHead>
                <TableHead className="hidden md:table-cell text-[11px] font-semibold text-muted-foreground uppercase px-3">Date</TableHead>
                <TableHead numeric className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Montant</TableHead>
                <TableHead className="hidden sm:table-cell text-[11px] font-semibold text-muted-foreground uppercase px-3">Statut</TableHead>
                <TableHead className="w-14 text-[11px] font-semibold text-muted-foreground uppercase px-3"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoading columns={7} rows={5} />
              ) : filteredNotes?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      type="deliveries"
                      title="Aucun bon de livraison"
                      description={searchQuery ? "Essayez une autre recherche" : "Créez votre premier bon de livraison"}
                      action={searchQuery ? {
                        label: "Effacer la recherche",
                        onClick: () => setSearchQuery(""),
                      } : {
                        label: "Créer",
                        onClick: () => navigate("/deliveries/new"),
                      }}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredNotes?.map((note) => {
                  const statusConfig = STATUS_CONFIG[(note.status || "draft") as DeliveryNoteStatus];
                  return (
                  <TableRow
                    key={note.id}
                    className="h-8 text-xs border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => navigate(`/deliveries/${note.id}`)}
                  >
                    <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedDeliveries.includes(note.id)}
                        onCheckedChange={() => toggleDelivery(note.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium font-mono tabular-nums px-3">
                      {note.delivery_number}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[220px] px-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate">{note.clients?.name}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top">{note.clients?.name}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell px-3">
                      {formatDate(note.delivery_date)}
                    </TableCell>
                    <TableCell numeric className="font-medium px-3">
                      {formatCurrency(calculateTotal(note.delivery_note_items || []))}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell px-3">
                      <StatusBadge tone={statusConfig.variant}>{statusConfig.label}</StatusBadge>
                    </TableCell>
                    <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-all text-muted-foreground hover:text-foreground"
                              onClick={(e) => { e.stopPropagation(); handleCopyId(note.id); }}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Copier l'ID</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-all text-muted-foreground hover:text-foreground disabled:opacity-50"
                              onClick={(e) => { e.stopPropagation(); handleDownloadPDF(note.id); }}
                              disabled={downloadingId === note.id}
                            >
                              {downloadingId === note.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Télécharger PDF</TooltipContent>
                        </Tooltip>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-all">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/deliveries/${note.id}`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Voir détails
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/deliveries/${note.id}/edit`)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEmailNoteId(note.id); setEmailModalOpen(true); }}>
                              <MailIcon className="w-4 h-4 mr-2" />
                              Envoyer par email
                            </DropdownMenuItem>
                            {(note.status || "draft") !== "signed" && (
                              <DropdownMenuItem onClick={() => handleMarkSigned(note.id)}>
                                <Check className="w-4 h-4 mr-2" />
                                Marquer comme Signé
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setDeleteId(note.id)} className="text-destructive focus:text-destructive">
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
        title="Supprimer le bon de livraison"
        itemIdentifier={deliveryNotes?.find((d) => d.id === deleteId)?.delivery_number || "Bon de livraison"}
        description="Cette action est irréversible. Le bon de livraison sera définitivement supprimé."
        isLoading={deleteDeliveryNote.isPending}
        onConfirm={handleDelete}
      />

      <DeleteConfirmationModal
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title={`Supprimer ${selectedDeliveries.length} bon${selectedDeliveries.length > 1 ? "s" : ""} de livraison ?`}
        description={`Cette action est irréversible et supprimera définitivement ${selectedDeliveries.length > 1 ? "ces bons de livraison" : "ce bon de livraison"}.`}
        isLoading={isBulkDeleting}
        onConfirm={handleBulkDelete}
      />

      {emailPdfData && (
        <SendDocumentEmailModal
          open={emailModalOpen}
          onOpenChange={(next) => {
            setEmailModalOpen(next);
            if (!next) setEmailNoteId(null);
          }}
          recipientEmail={emailPdfData.client.email}
          fileName={`BonLivraison-${emailPdfData.delivery_number || "000"}.pdf`}
          draftInput={{
            docType: "delivery",
            documentNumber: emailPdfData.delivery_number,
            clientName: emailPdfData.client.name,
            documentDate: emailPdfData.delivery_date,
            senderCompany: settings?.company_name || "Sordi",
            items: emailPdfData.items.map((item) => ({
              name: item.product_name || "Article",
              quantity: item.quantity,
              unitPrice: item.unit_price,
            })),
          } satisfies DraftDeliveryInput}
          getPdfBase64={async () => {
            const blob = await generateDeliveryNotePDFBlob(emailPdfData, settings);
            return blobToBase64(blob);
          }}
        />
      )}
    </>
  );
}
