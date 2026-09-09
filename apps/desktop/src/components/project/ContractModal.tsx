import { useEffect, useMemo, useState } from "react";
import {
  RiFileTextLine as FileTextIcon,
  RiCheckLine as CheckIcon,
} from "@remixicon/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Button, Label, Input, Textarea,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@sordi/ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ContractServiceKey, ContractPaymentSplit } from "@/lib/database";
import { CONTRACT_SERVICE_CATALOG, CONTRACT_PAYMENT_SPLITS, getPaymentSplit } from "@/lib/contractServices";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useCreateContract } from "@/hooks/useContracts";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { useInvoices } from "@/hooks/useInvoices";
import { generateContractPDFBlob, generateContractPDF } from "@/lib/pdfGenerator";
import { PDFViewerModal } from "@/components/pdf/PDFViewerModal";

const TVA_RATE = 19;

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD", minimumFractionDigits: 0 }).format(amount);

interface ContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selects and locks the client/project when opened from a project's own page. Omit for the standalone "+ Nouveau Contrat" flow. */
  initialProjectId?: string;
  initialClientId?: string;
}

export function ContractModal({ open, onOpenChange, initialProjectId, initialClientId }: ContractModalProps) {
  const { company } = useActiveCompany();
  const createContract = useCreateContract();
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const { data: allInvoices } = useInvoices();

  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [selectedServices, setSelectedServices] = useState<ContractServiceKey[]>([]);
  const [paymentSplit, setPaymentSplit] = useState<ContractPaymentSplit>("50_50");
  const [totalHt, setTotalHt] = useState<string>("");
  const [trancheInvoiceIds, setTrancheInvoiceIds] = useState<(string | null)[]>([null, null]);
  const [description, setDescription] = useState("");
  const [representative, setRepresentative] = useState("");
  const [representativeTitle, setRepresentativeTitle] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewRef, setPreviewRef] = useState<string | null>(null);

  // Re-seed the locked client/project whenever the modal is (re)opened from
  // a project's own page — otherwise a prior standalone session's leftover
  // state would bleed into the next open.
  useEffect(() => {
    if (open) {
      setClientId(initialClientId ?? "");
      setProjectId(initialProjectId ?? "");
    }
  }, [open, initialClientId, initialProjectId]);

  const client = clients?.find((c) => c.id === clientId);
  const project = projects?.find((p) => p.id === projectId);
  const splitDef = getPaymentSplit(paymentSplit);

  // Projects belonging to the selected client only — picking a client
  // resets an incompatible project selection rather than leaving a stale
  // cross-client pairing in place.
  const clientProjects = useMemo(
    () => (projects ?? []).filter((p) => p.client_id === clientId),
    [projects, clientId]
  );
  useEffect(() => {
    if (projectId && !clientProjects.some((p) => p.id === projectId)) setProjectId("");
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Existing invoices for this client (optionally narrowed to the project)
  // — offered as an optional source to populate a tranche's reference/amount
  // instead of a typed placeholder, never required.
  const linkableInvoices = useMemo(() => {
    if (!clientId) return [];
    return (allInvoices ?? []).filter((inv) => inv.client_id === clientId && (!projectId || inv.project_id === projectId));
  }, [allInvoices, clientId, projectId]);

  const toggleService = (key: ContractServiceKey) => {
    setSelectedServices((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const parsedHt = parseFloat(totalHt) || 0;
  const totalTva = parsedHt * (TVA_RATE / 100);
  const totalTtc = parsedHt + totalTva;

  // Reset tranche invoice picks whenever the split shape changes (2 vs 3
  // tranches) so a leftover pick from "30/40/30" doesn't silently survive
  // into a "50/50" contract's 2-element array.
  useEffect(() => {
    setTrancheInvoiceIds(new Array(splitDef.tranches.length).fill(null));
  }, [paymentSplit]); // eslint-disable-line react-hooks/exhaustive-deps

  const canGenerate = !!client && selectedServices.length > 0 && parsedHt > 0;

  const resetForm = () => {
    setClientId(initialClientId ?? "");
    setProjectId(initialProjectId ?? "");
    setSelectedServices([]);
    setPaymentSplit("50_50");
    setTotalHt("");
    setTrancheInvoiceIds([null, null]);
    setDescription("");
    setRepresentative("");
    setRepresentativeTitle("");
  };

  const handleClose = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  // A milestone with no linked invoice still gets a printable placeholder
  // reference (per-role, e.g. "FAC-ACOMPTE") — never blocks PDF generation.
  const placeholderRef = (role: string) => `FAC-${role.toUpperCase()}`;

  const buildTranches = () => {
    return splitDef.tranches.map((t, idx) => {
      const linkedInvoice = allInvoices?.find((inv) => inv.id === trancheInvoiceIds[idx]);
      const amountTtc = totalTtc * t.fraction;
      return {
        role: t.role,
        label: t.label,
        ref: linkedInvoice?.invoice_number || placeholderRef(t.role),
        amountTtc: linkedInvoice?.total_ttc ?? amountTtc,
        invoiceId: linkedInvoice?.id ?? null,
      };
    });
  };

  // Shared by both the preview button and the save flow's own PDF export —
  // contractRef is a caller-supplied placeholder for the former (nothing is
  // saved yet) or the real OM-CTR-{year}-{seq} ref for the latter.
  const buildPdfPayload = (contractRef: string): Parameters<typeof generateContractPDF>[0] | null => {
    if (!client) return null;
    const tranches = buildTranches();
    return {
      contractRef,
      issueDate: new Date().toISOString(),
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
        name: client.name,
        address: client.address || "",
        rc: client.rc || "",
        nif: client.nif || "",
        nis: client.nis || "",
        ai: client.ai || "",
        representative: representative || client.contact_person || undefined,
        representativeTitle: representativeTitle || undefined,
      },
      projectName: project?.name,
      projectDescription: description,
      selectedServices,
      totalHt: parsedHt,
      tvaRate: TVA_RATE,
      totalTva,
      totalTtc,
      paymentSplitLabel: splitDef.label,
      tranches: tranches.map((t) => ({
        label: t.label,
        percentLabel: `${Math.round(splitDef.tranches.find((st) => st.role === t.role)!.fraction * 100)}%`,
        ref: t.ref,
        amountTtc: t.amountTtc,
        condition: splitDef.tranches.find((st) => st.role === t.role)!.condition,
      })),
    };
  };

  // "Aperçu / Exporter PDF" — pure preview, never touches the database.
  // Independent of the save action below, so a user can inspect the layout
  // as many times as they like without creating anything.
  const handlePreview = async () => {
    const payload = buildPdfPayload("OM-CTR-APERÇU");
    if (!canGenerate || !payload) return;
    const blob = await generateContractPDFBlob(payload);
    setPreviewBlob(blob);
    setPreviewRef(null);
    setPreviewOpen(true);
  };

  // "Enregistrer le contrat" — the primary action. Persists straight from
  // the form; does not require the preview to have been opened first.
  const handleSave = async () => {
    if (!client) return;
    if (parsedHt <= 0) {
      toast.error("Le montant total HT doit être supérieur à 0.");
      return;
    }
    if (selectedServices.length === 0) {
      toast.error("Sélectionnez au moins une prestation.");
      return;
    }
    const tranches = buildTranches();
    try {
      await createContract.mutateAsync({
        project_id: projectId || null,
        client_id: client.id,
        selected_services: selectedServices,
        payment_split: paymentSplit,
        total_amount_ht: parsedHt,
        tva_rate: TVA_RATE,
        tva_amount: totalTva,
        total_amount_ttc: totalTtc,
        invoices: tranches.map((t) => ({
          id: t.invoiceId ?? t.ref,
          invoice_number: t.ref,
          amount_ttc: t.amountTtc,
          role: t.role as "acompte" | "tranche_2" | "solde",
        })),
      });
      // useCreateContract's onSuccess already shows the "créé et enregistré" toast.
      handleClose(false);
    } catch (error) {
      // useCreateContract's onError already toasts a message for this —
      // just log for diagnostics.
      console.error("Contract creation failed:", error);
    }
  };

  return (
    <>
      {/* Closed (but not unmounted, so its state survives) while the PDF
          preview is open — Radix stacks two simultaneously-open Dialogs'
          overlays in a way that can leave the older one intercepting
          pointer events, silently swallowing clicks on the preview's own
          floating save button. */}
      <Dialog open={open && !previewOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-xl rounded-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileTextIcon className="w-5 h-5 text-primary" />
              Nouveau Contrat
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto pr-2 space-y-5 py-2">
            {/* Step 1 — Client & Project */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="contract-client">Client *</Label>
                <Select value={clientId} onValueChange={setClientId} disabled={!!initialClientId}>
                  <SelectTrigger id="contract-client">
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract-project">Projet lié (optionnel)</Label>
                <Select
                  value={projectId || "none"}
                  onValueChange={(v) => setProjectId(v === "none" ? "" : v)}
                  disabled={!!initialProjectId || !clientId}
                >
                  <SelectTrigger id="contract-project">
                    <SelectValue placeholder="Aucun projet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun projet</SelectItem>
                    {clientProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Step 2 — Services */}
            <div className="space-y-2">
              <Label>Prestations couvertes par le contrat</Label>
              <div className="flex flex-wrap gap-1.5">
                {CONTRACT_SERVICE_CATALOG.map((service) => {
                  const active = selectedServices.includes(service.key);
                  return (
                    <button
                      key={service.key}
                      type="button"
                      onClick={() => toggleService(service.key)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {active && <CheckIcon className="w-3 h-3" />}
                      {service.label}
                    </button>
                  );
                })}
              </div>
              {selectedServices.length === 0 && (
                <p className="text-xs text-muted-foreground">Sélectionnez au moins une prestation pour générer le contrat.</p>
              )}
            </div>

            {/* Step 3 — Financials & payment terms */}
            <div className="space-y-2">
              <Label htmlFor="contract-ht">Montant Total HT (DZD) *</Label>
              <Input
                id="contract-ht"
                type="number"
                min="0"
                value={totalHt}
                onChange={(e) => setTotalHt(e.target.value)}
                placeholder="0"
              />
              {parsedHt > 0 && (
                <div className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">TVA 19% : {formatCurrency(totalTva)}</span>
                  <span className="font-bold">Total TTC : {formatCurrency(totalTtc)}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Répartition des paiements</Label>
              <div className="grid grid-cols-1 gap-1.5">
                {CONTRACT_PAYMENT_SPLITS.map((split) => (
                  <button
                    key={split.key}
                    type="button"
                    onClick={() => setPaymentSplit(split.key)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-all",
                      paymentSplit === split.key
                        ? "border-primary bg-accent-soft font-semibold"
                        : "border-border hover:border-primary/40 hover:bg-secondary/40"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-4 h-4 rounded-full border shrink-0 flex items-center justify-center",
                          paymentSplit === split.key ? "border-primary bg-primary" : "border-muted-foreground/40"
                        )}
                      >
                        {paymentSplit === split.key && <CheckIcon className="w-2.5 h-2.5 text-white" />}
                      </span>
                      {split.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional invoice linking per tranche */}
            {parsedHt > 0 && (
              <div className="space-y-2">
                <Label>Rattachement de factures (optionnel)</Label>
                <div className="space-y-1.5">
                  {splitDef.tranches.map((tranche, idx) => (
                    <div key={tranche.role} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-32 shrink-0 truncate">
                        {tranche.label} ({Math.round(tranche.fraction * 100)}%)
                      </span>
                      <Select
                        value={trancheInvoiceIds[idx] ?? "placeholder"}
                        onValueChange={(v) =>
                          setTrancheInvoiceIds((prev) => prev.map((id, i) => (i === idx ? (v === "placeholder" ? null : v) : id)))
                        }
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Référence provisoire" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="placeholder">
                            Référence provisoire ({placeholderRef(tranche.role)})
                          </SelectItem>
                          {linkableInvoices.map((inv) => (
                            <SelectItem key={inv.id} value={inv.id}>
                              {inv.invoice_number} — {formatCurrency(inv.total_ttc ?? 0)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                {linkableInvoices.length === 0 && !!clientId && (
                  <p className="text-xs text-muted-foreground">
                    Aucune facture existante pour ce client — des références provisoires seront utilisées, sans bloquer la génération du contrat.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="contract-description">Description détaillée du projet</Label>
              <Textarea
                id="contract-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez le périmètre des prestations pour l'Article 1 du contrat..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="contract-rep">Représentant du client</Label>
                <Input
                  id="contract-rep"
                  value={representative}
                  onChange={(e) => setRepresentative(e.target.value)}
                  placeholder={client?.contact_person || "Nom du représentant"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract-rep-title">Qualité</Label>
                <Input
                  id="contract-rep-title"
                  value={representativeTitle}
                  onChange={(e) => setRepresentativeTitle(e.target.value)}
                  placeholder="Gérant, Directeur..."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center gap-2 pt-4 mt-2 border-t border-border/60">
            <Button type="button" variant="ghost" onClick={() => handleClose(false)}>
              Annuler
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!canGenerate}
                onClick={handlePreview}
                className="border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 px-4 py-2.5 rounded-xl text-sm transition-colors"
              >
                Aperçu / Exporter PDF
              </Button>
              <Button
                type="submit"
                disabled={!canGenerate || createContract.isPending}
                onClick={handleSave}
                className="bg-primary hover:bg-primary-hover text-primary-foreground font-medium px-5 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                {createContract.isPending ? "Enregistrement..." : "Enregistrer le contrat"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PDFViewerModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        pdfBlob={previewBlob}
        fileName={`Contrat-${previewRef ?? client?.name ?? "nouveau"}.pdf`}
        title="Aperçu du Contrat"
      />
    </>
  );
}
