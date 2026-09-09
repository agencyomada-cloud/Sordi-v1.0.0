import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  RiArrowLeftLine as ArrowLeft,
  RiErrorWarningFill as WarningIcon,
  RiAddLine as Plus,
  RiPencilLine as Pencil,
  RiCameraLine as Camera,
  RiCloseLine as Close,
  RiUploadCloud2Line as Upload,
  RiFileTextLine as FileIcon,
  RiExternalLinkLine as ExternalLink,
  RiDeleteBinLine as Trash2,
  RiUserSearchLine as NotFoundIcon,
} from "@remixicon/react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  StatusBadge,
  Skeleton,
  EmptyState,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@sordi/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import type { CreateEmployeeData } from "@/lib/database";
import { toast } from "sonner";
import { useEmployees, useSetEmployeePhoto, useRemoveEmployeePhoto } from "@/hooks/useEmployees";
import { useEmployeeDocuments, useAddEmployeeDocument, useDeleteEmployeeDocument } from "@/hooks/useEmployeeDocuments";
import { useAppDataDir, resolveAppDataAbsolutePath } from "@/hooks/useAppDataDir";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import {
  useEmployeeAbsenceStats,
  useEmployeeAdvances,
  useEmployeeAdvanceTotals,
  useCreateEmployeeAdvance,
  useSetEmployeeAdvanceDeducted,
  usePayrollRuns,
  useRunPayroll,
} from "@/hooks/usePayroll";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD", minimumFractionDigits: 0 }).format(amount);

const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "-");

const currentMonth = new Date().toISOString().slice(0, 7);

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: employees, isLoading, updateEmployee, deleteEmployee } = useEmployees();
  const employee = employees?.find((e) => e.id === id);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDelete = () => {
    if (!id) return;
    deleteEmployee.mutate(id, { onSuccess: () => navigate("/management") });
  };

  const { data: absenceStats } = useEmployeeAbsenceStats(id, currentMonth);
  const { data: advances } = useEmployeeAdvances(id);
  const { data: advanceTotals } = useEmployeeAdvanceTotals(id);
  const { data: payrollRuns } = usePayrollRuns(id);
  const runPayroll = useRunPayroll();
  const createAdvance = useCreateEmployeeAdvance();
  const setAdvanceDeducted = useSetEmployeeAdvanceDeducted();
  const setPhoto = useSetEmployeePhoto();
  const removePhoto = useRemoveEmployeePhoto();
  const { data: documents } = useEmployeeDocuments(id);
  const addDocument = useAddEmployeeDocument();
  const deleteDocument = useDeleteEmployeeDocument();
  const { data: appDataDirPath } = useAppDataDir();

  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().slice(0, 10));

  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [pendingDocPath, setPendingDocPath] = useState<string | null>(null);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "",
    email: "",
    phone: "",
    address: "",
    base_salary: "",
    hire_date: "",
    contract_type: "Temps plein" as "Temps plein" | "Freelance",
    rib: "",
    external_code: "",
  });

  const openEditDialog = () => {
    if (!employee) return;
    setEditForm({
      name: employee.name,
      role: employee.role || "",
      email: employee.email || "",
      phone: employee.phone || "",
      address: employee.address || "",
      base_salary: employee.base_salary != null ? String(employee.base_salary) : "",
      hire_date: employee.hire_date || "",
      contract_type: employee.contract_type === "Freelance" ? "Freelance" : "Temps plein",
      rib: employee.rib || "",
      external_code: employee.external_code || "",
    });
    setEditDialogOpen(true);
  };

  const handleUpdateEmployee = () => {
    if (!id) return;
    if (!editForm.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    const isFreelance = editForm.contract_type === "Freelance";
    const payload: Omit<CreateEmployeeData, "company_id"> = {
      ...editForm,
      // Freelancers don't punch in/out or have a monthly salary — clear
      // these rather than leave stale values hidden behind the toggle.
      base_salary: isFreelance ? null : editForm.base_salary ? Number(editForm.base_salary) : null,
      external_code: isFreelance ? null : editForm.external_code || null,
      hire_date: editForm.hire_date || null,
      contract_type: editForm.contract_type,
      rib: editForm.rib || null,
    };
    updateEmployee.mutate(
      { id, data: payload },
      { onSuccess: () => setEditDialogOpen(false) }
    );
  };

  const handlePickPhoto = async () => {
    if (!id) return;
    const picked = await openFileDialog({
      filters: [{ name: "Image", extensions: ["jpg", "jpeg", "png"] }],
      multiple: false,
    });
    if (typeof picked === "string") {
      setPhoto.mutate({ employeeId: id, sourcePath: picked });
    }
  };

  const handlePickDocument = async () => {
    const picked = await openFileDialog({ multiple: false });
    if (typeof picked === "string") {
      setPendingDocPath(picked);
      setDocName(picked.split(/[\\/]/).pop() || "");
      setDocType("");
      setDocDialogOpen(true);
    }
  };

  const handleConfirmAddDocument = () => {
    if (!id || !pendingDocPath) return;
    if (!docName.trim()) {
      toast.error("Le nom du document est requis");
      return;
    }
    addDocument.mutate(
      { employeeId: id, sourcePath: pendingDocPath, name: docName.trim(), docType: docType.trim() || null },
      { onSuccess: () => { setDocDialogOpen(false); setPendingDocPath(null); } }
    );
  };

  const handleOpenDocument = async (relativePath: string) => {
    if (!appDataDirPath) return;
    try {
      const absolute = await resolveAppDataAbsolutePath(appDataDirPath, relativePath);
      await openPath(absolute);
    } catch (error) {
      toast.error(`Impossible d'ouvrir le document: ${error}`);
    }
  };

  const handleCreateAdvance = () => {
    if (!id) return;
    const amount = Number(advanceAmount);
    if (!amount || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }
    createAdvance.mutate(
      { employee_id: id, amount, date_taken: advanceDate },
      {
        onSuccess: () => {
          setAdvanceDialogOpen(false);
          setAdvanceAmount("");
        },
      }
    );
  };

  const handleRunPayroll = () => {
    if (!id) return;
    runPayroll.mutate({ employeeId: id, month: currentMonth });
  };

  if (isLoading) {
    return (
      <main className="flex-1 p-8 pt-4">
        <div className="max-w-[1100px] mx-auto w-full space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </main>
    );
  }

  // Not a loading state — the fetch resolved and no employee in the list
  // matches this id (deleted, or a stale/invalid URL). Previously this
  // fell through the isLoading branch above and showed "Chargement…"
  // forever instead of ever telling the user the employee doesn't exist.
  if (!employee) {
    return (
      <main className="flex-1 p-8 pt-4 flex items-center justify-center">
        <div className="max-w-sm">
          <EmptyState
            icon={NotFoundIcon}
            title="Employé introuvable"
            description="Cet employé n'existe plus ou a été supprimé."
          />
          <Button onClick={() => navigate("/management")} className="w-full">
            Retour aux employés
          </Button>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="flex-1 p-8 pt-4">
        <div className="max-w-[1100px] mx-auto w-full">
            <button
              onClick={() => navigate("/management")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour aux employés
            </button>

            <div className="flex items-start justify-between mb-6 gap-4">
              <div className="flex items-start gap-4">
                <div className="relative group shrink-0">
                  <EmployeeAvatar photoPath={employee.photo_path} name={employee.name} size="lg" />
                  <button
                    onClick={handlePickPhoto}
                    disabled={setPhoto.isPending}
                    title="Changer la photo"
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white"
                  >
                    <Camera className="w-6 h-6" />
                  </button>
                  {employee.photo_path && (
                    <button
                      onClick={() => removePhoto.mutate(employee.id)}
                      disabled={removePhoto.isPending}
                      title="Supprimer la photo"
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                    >
                      <Close className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold">{employee.name}</h1>
                    {absenceStats?.flagged && (
                      <StatusBadge tone="error" className="gap-1.5">
                        <WarningIcon className="w-3.5 h-3.5" />
                        {absenceStats.absence_days} jours d'absence ce mois
                      </StatusBadge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1">
                    {employee.role || "Aucun rôle"}
                    {employee.contract_type && ` • ${employee.contract_type}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="gap-2" onClick={openEditDialog}>
                  <Pencil className="w-4 h-4" />
                  Modifier
                </Button>
                <Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </Button>
                <Button onClick={handleRunPayroll} disabled={runPayroll.isPending || !employee.base_salary}>
                  {runPayroll.isPending ? "Calcul…" : `Calculer la paie (${currentMonth})`}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Salaire de base</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{employee.base_salary ? formatCurrency(employee.base_salary) : "Non défini"}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Avances en attente</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-orange-600">{formatCurrency(advanceTotals?.total_pending ?? 0)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total avances à ce jour</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{formatCurrency(advanceTotals?.total_taken ?? 0)}</div>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Informations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between py-2 border-b border-border/50 text-sm">
                  <span className="text-muted-foreground">Date d'embauche</span>
                  <span className="font-medium">{formatDate(employee.hire_date)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50 text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{employee.email || "-"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50 text-sm">
                  <span className="text-muted-foreground">Téléphone</span>
                  <span className="font-medium">{employee.phone || "-"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50 text-sm">
                  <span className="text-muted-foreground">Adresse</span>
                  <span className="font-medium">{employee.address || "-"}</span>
                </div>
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-muted-foreground">RIB</span>
                  <span className="font-medium">{employee.rib || "-"}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Documents</CardTitle>
                <Button size="sm" variant="outline" className="gap-2" onClick={handlePickDocument}>
                  <Upload className="w-4 h-4" />
                  Ajouter un document
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {!documents || documents.length === 0 ? (
                  <EmptyState type="default" icon={FileIcon} title="Aucun document" description="Ajoutez un document pour cet employé" className="py-8" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Ajouté le</TableHead>
                        <TableHead className="w-44"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-2">
                              <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                              {doc.name}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{doc.doc_type || "-"}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(doc.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleOpenDocument(doc.file_path)}>
                                <ExternalLink className="w-3.5 h-3.5" />
                                Ouvrir
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                disabled={deleteDocument.isPending}
                                onClick={() => deleteDocument.mutate({ id: doc.id, employeeId: doc.employee_id })}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Avances</CardTitle>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => setAdvanceDialogOpen(true)}>
                  <Plus className="w-4 h-4" />
                  Nouvelle avance
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {!advances || advances.length === 0 ? (
                  <EmptyState type="payroll" title="Aucune avance" description="Aucune avance n'a été enregistrée pour cet employé" className="py-8" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Déduite en</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {advances.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{formatDate(a.date_taken)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(a.amount)}</TableCell>
                          <TableCell className="text-muted-foreground">{a.month_to_deduct}</TableCell>
                          <TableCell>
                            <button
                              type="button"
                              disabled={setAdvanceDeducted.isPending}
                              onClick={() => setAdvanceDeducted.mutate({ id: a.id, deducted: !a.deducted })}
                              title="Cliquer pour changer le statut"
                              className="disabled:opacity-50"
                            >
                              {a.deducted ? (
                                <StatusBadge tone="success">Déduite</StatusBadge>
                              ) : (
                                <StatusBadge tone="warning">En attente</StatusBadge>
                              )}
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historique de paie</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!payrollRuns || payrollRuns.length === 0 ? (
                  <EmptyState type="payroll" title="Aucun bulletin de paie" description="Aucun bulletin n'a encore été calculé pour cet employé" className="py-8" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mois</TableHead>
                        <TableHead>Absences</TableHead>
                        <TableHead>Déduction absences</TableHead>
                        <TableHead>Primes</TableHead>
                        <TableHead>Déduction avance</TableHead>
                        <TableHead>Net à payer</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollRuns.map((run) => (
                        <TableRow key={run.id} className="cursor-pointer" onClick={() => navigate(`/payroll?month=${run.month}&employee=${run.employee_id}`)}>
                          <TableCell className="font-medium">{run.month}</TableCell>
                          <TableCell className="text-muted-foreground">{run.absence_days}</TableCell>
                          <TableCell className="text-muted-foreground">{formatCurrency(run.absence_deduction)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatCurrency(run.primes)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatCurrency(run.avance_deduction)}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(run.net_a_payer)}</TableCell>
                          <TableCell>
                            {run.paid ? (
                              <StatusBadge tone="success">Payé</StatusBadge>
                            ) : (
                              <StatusBadge tone="warning">En attente</StatusBadge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
      </main>

      <Dialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle avance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Montant</Label>
              <Input type="number" min="0" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} placeholder="10000" />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <DatePicker value={advanceDate} onChange={setAdvanceDate} />
              <p className="text-xs text-muted-foreground">
                Sera déduite automatiquement du mois suivant.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateAdvance} disabled={createAdvance.isPending}>
              {createAdvance.isPending ? "Enregistrement…" : "Enregistrer l'avance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l'employé</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom complet</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ahmed Benali"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rôle / Poste</Label>
              <Input
                value={editForm.role}
                onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                placeholder="Chef de projet"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@exemple.dz"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Téléphone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="0550 00 00 00"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Adresse</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="Alger, Algérie"
              />
            </div>

            <div className="border-t border-border/50 pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Type de contrat</Label>
                <div className="flex items-center gap-1 p-1 bg-secondary/30 w-fit rounded-xl border border-border/50">
                  {(["Temps plein", "Freelance"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEditForm((p) => ({ ...p, contract_type: type }))}
                      className={`px-4 py-2 text-sm font-medium transition-all rounded-lg ${
                        editForm.contract_type === type
                          ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Date d'embauche</Label>
                  <DatePicker
                    presets={false}
                    value={editForm.hire_date}
                    onChange={(v) => setEditForm((p) => ({ ...p, hire_date: v }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>RIB</Label>
                  <Input
                    value={editForm.rib}
                    onChange={(e) => setEditForm((p) => ({ ...p, rib: e.target.value }))}
                  />
                </div>

                {editForm.contract_type === "Temps plein" && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Salaire de base</Label>
                      <Input
                        type="number"
                        min="0"
                        value={editForm.base_salary}
                        onChange={(e) => setEditForm((p) => ({ ...p, base_salary: e.target.value }))}
                        placeholder="45000"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Code appareil</Label>
                      <Input
                        value={editForm.external_code}
                        onChange={(e) => setEditForm((p) => ({ ...p, external_code: e.target.value }))}
                        placeholder="Numéro pointeuse"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateEmployee} disabled={updateEmployee.isPending}>
              {updateEmployee.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={docDialogOpen} onOpenChange={(open) => { setDocDialogOpen(open); if (!open) setPendingDocPath(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom du document</Label>
              <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Carte d'identité" />
            </div>
            <div className="space-y-1.5">
              <Label>Type (optionnel)</Label>
              <Input value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="CNI, Diplôme, Contrat…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDocDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmAddDocument} disabled={addDocument.isPending}>
              {addDocument.isPending ? "Ajout…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet employé ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données liées à cet employé (bulletins de paie, avances, documents) seront supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteEmployee.isPending} className="bg-destructive text-destructive-foreground rounded-xl">
              {deleteEmployee.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
