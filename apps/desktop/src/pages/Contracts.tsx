import { useMemo, useState } from "react";
import {
  RiAddLine as Plus,
  RiMoreFill as MoreHorizontal,
  RiEyeLine as Eye,
  RiPrinterLine as PrinterIcon,
  RiDeleteBinLine as Trash2,
  RiFileTextLine as FileTextIcon,
  RiCheckboxCircleLine as CheckIcon,
  RiTimeLine as ClockIcon,
} from "@remixicon/react";
import {
  Button,
  SearchInput,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  TableLoading,
  EmptyState,
} from "@sordi/ui";
import { MetricStrip } from "@/components/ui/metric-strip";
import { useContracts, useDeleteContract } from "@/hooks/useContracts";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { CONTRACT_SERVICE_CATALOG, getPaymentSplit } from "@/lib/contractServices";
import { ContractModal } from "@/components/project/ContractModal";
import { PDFViewerModal } from "@/components/pdf/PDFViewerModal";
import { generateContractPDFBlob } from "@/lib/pdfGenerator";
import type { Contract } from "@/lib/database";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD", minimumFractionDigits: 0 }).format(amount);

const formatDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const TVA_RATE = 19;

export default function ContractsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewContract, setPreviewContract] = useState<Contract | null>(null);

  const { data: contracts, isLoading } = useContracts();
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const { company } = useActiveCompany();
  const deleteContract = useDeleteContract();

  const clientById = useMemo(() => new Map((clients ?? []).map((c) => [c.id, c])), [clients]);
  const projectById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);

  const rows = useMemo(() => {
    return (contracts ?? []).filter((c) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().trim();
      const clientName = clientById.get(c.client_id)?.name ?? "";
      const projectName = c.project_id ? projectById.get(c.project_id)?.name ?? "" : "";
      return (
        c.contract_ref.toLowerCase().includes(query) ||
        clientName.toLowerCase().includes(query) ||
        projectName.toLowerCase().includes(query)
      );
    });
  }, [contracts, searchQuery, clientById, projectById]);

  // "Signés" isn't tracked as a distinct status yet (no signature workflow
  // in the schema) — every saved contract counts as "en cours" until that
  // lands, so the metric strip shows total/en-cours/signés as 0 rather
  // than fabricate a signed count with no backing data.
  const metrics = {
    total: contracts?.length ?? 0,
    enCours: contracts?.length ?? 0,
    signes: 0,
  };

  const handleDelete = () => {
    if (!contractToDelete) return;
    deleteContract.mutate(contractToDelete, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setContractToDelete(null);
      },
    });
  };

  const handlePreview = async (contract: Contract) => {
    const client = clientById.get(contract.client_id);
    const project = contract.project_id ? projectById.get(contract.project_id) : undefined;
    const splitDef = getPaymentSplit(contract.payment_split);

    const blob = await generateContractPDFBlob({
      contractRef: contract.contract_ref,
      issueDate: contract.created_at,
      omada: {
        name: company?.name || "OMADA MARKETING & DIGITAL SOLUTIONS",
        address: company?.address || "Sétif, Algérie",
        rc: company?.rc || "",
        nif: company?.nif || "",
        nis: company?.nis || "",
        ai: company?.article_imposition || "",
        phone: company?.phone || undefined,
      },
      client: {
        name: client?.name || "",
        address: client?.address || "",
        rc: client?.rc || "",
        nif: client?.nif || "",
        nis: client?.nis || "",
        ai: client?.ai || "",
        representative: client?.contact_person || undefined,
      },
      projectName: project?.name,
      projectDescription: "",
      selectedServices: contract.selected_services,
      totalHt: contract.total_amount_ht,
      tvaRate: contract.tva_rate,
      totalTva: contract.tva_amount,
      totalTtc: contract.total_amount_ttc,
      paymentSplitLabel: splitDef.label,
      tranches: contract.invoices.map((inv) => {
        const trancheDef = splitDef.tranches.find((t) => t.role === inv.role) ?? splitDef.tranches[0];
        return {
          label: trancheDef.label,
          percentLabel: `${Math.round(trancheDef.fraction * 100)}%`,
          ref: inv.invoice_number,
          amountTtc: inv.amount_ttc,
          condition: trancheDef.condition,
        };
      }),
    });

    setPreviewBlob(blob);
    setPreviewContract(contract);
    setPreviewOpen(true);
  };

  const handlePrint = async (contract: Contract) => {
    await handlePreview(contract);
  };

  return (
    <>
      <main className="flex-1 p-8 pt-4">
        <div className="max-w-[1600px] mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 animate-fade-in-down">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Contrats</h1>
              <p className="text-muted-foreground mt-1">Générez et gérez les contrats de prestation de services clients</p>
            </div>

            <Button className="gap-2 bg-[#EB3B48] hover:bg-[#D82F3C] text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" />
              Nouveau Contrat
            </Button>
          </div>

          <div className="mb-6 animate-fade-in-up animation-delay-100">
            <MetricStrip
              cells={[
                { key: "total", label: "Total Contrats", value: String(metrics.total), numericValue: metrics.total, format: (v) => String(Math.round(v)), icon: FileTextIcon },
                { key: "en_cours", label: "En cours", value: String(metrics.enCours), numericValue: metrics.enCours, format: (v) => String(Math.round(v)), icon: ClockIcon },
                { key: "signes", label: "Signés", value: String(metrics.signes), numericValue: metrics.signes, format: (v) => String(Math.round(v)), icon: CheckIcon },
              ]}
            />
          </div>

          <div className="mb-6 animate-fade-in-up animation-delay-150">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Rechercher par référence, client, projet..."
              containerClassName="w-full md:w-80"
            />
          </div>

          <div className="animate-fade-in-up animation-delay-200">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Réf Contrat</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Projet lié</TableHead>
                  <TableHead className="hidden lg:table-cell">Services</TableHead>
                  <TableHead numeric>Montant TTC</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="w-14"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoading columns={7} rows={5} />
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState
                        type="invoices"
                        title="Aucun contrat"
                        description={searchQuery ? "Essayez une autre recherche" : "Créez votre premier contrat client"}
                        action={
                          searchQuery
                            ? { label: "Effacer la recherche", onClick: () => setSearchQuery("") }
                            : { label: "Créer", onClick: () => setCreateOpen(true) }
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((contract) => {
                    const client = clientById.get(contract.client_id);
                    const project = contract.project_id ? projectById.get(contract.project_id) : undefined;
                    const serviceLabels = contract.selected_services
                      .map((key) => CONTRACT_SERVICE_CATALOG.find((s) => s.key === key)?.label)
                      .filter(Boolean);
                    return (
                      <TableRow key={contract.id} className="cursor-pointer" onClick={() => handlePreview(contract)}>
                        <TableCell className="font-medium font-mono text-xs">{contract.contract_ref}</TableCell>
                        <TableCell className="text-muted-foreground">{client?.name ?? "-"}</TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{project?.name ?? "-"}</TableCell>
                        <TableCell className="hidden lg:table-cell max-w-[220px] truncate text-xs text-muted-foreground">
                          {serviceLabels.join(", ") || "-"}
                        </TableCell>
                        <TableCell numeric className="font-mono tabular-nums">{formatCurrency(contract.total_amount_ttc)}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">{formatDate(contract.created_at)}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all">
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handlePreview(contract)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Aperçu
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePrint(contract)}>
                                <PrinterIcon className="w-4 h-4 mr-2" />
                                Imprimer PDF
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setContractToDelete(contract.id);
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
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>

      <ContractModal open={createOpen} onOpenChange={setCreateOpen} />

      <PDFViewerModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        pdfBlob={previewBlob}
        fileName={`Contrat-${previewContract?.contract_ref ?? "contrat"}.pdf`}
        title="Aperçu du Contrat"
        pdfBase64={null}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce contrat ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le contrat sera définitivement supprimé.
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
    </>
  );
}
