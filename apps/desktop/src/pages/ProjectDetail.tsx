import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  RiArrowLeftLine as ArrowLeft,
  RiPencilLine as Pencil,
  RiAddLine as Plus,
  RiDeleteBinLine as Trash2,
  RiExternalLinkLine as ExternalLink,
  RiFileTextLine as FileText,
  RiCloseLine as CloseIcon,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  EmptyState,
  StatusBadge,
} from "@sordi/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { useProject, useProjectStats, useProjectProfitability, useSetFreelancerPaymentStatus } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useInvoices } from "@/hooks/useInvoices";
import { useEmployees } from "@/hooks/useEmployees";
import { useExpenses, useCreateExpense, useDeleteExpense } from "@/hooks/useExpenses";
import {
  useProjectTasks,
  useCreateProjectTask,
  useUpdateProjectTaskStatus,
  useDeleteProjectTask,
} from "@/hooks/useProjectTasks";
import {
  useProjectDeliverables,
  useCreateProjectDeliverable,
  useUpdateProjectDeliverable,
  useDeleteProjectDeliverable,
} from "@/hooks/useProjectDeliverables";
import { useAssignInvoiceToProject } from "@/hooks/useProjects";
import { getProjectStatus, serviceCategoryLabel } from "@/lib/projectOverview";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { ContractModal } from "@/components/project/ContractModal";
import type { Project, ProjectStats, Invoice, ProjectTaskStatus, Client } from "@/lib/database";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD", minimumFractionDigits: 0 }).format(amount);

const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "-");

const TASK_STATUS_LABELS: Record<ProjectTaskStatus, string> = {
  à_faire: "À faire",
  en_cours: "En cours",
  en_revision_interne: "En révision interne",
  envoye_client: "Envoyé au client",
  approuve: "Approuvé",
};
const TASK_STATUS_ORDER: ProjectTaskStatus[] = ["à_faire", "en_cours", "en_revision_interne", "envoye_client", "approuve"];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "deliverables" | "expenses">("overview");

  const { data: project, isLoading } = useProject(id);
  const { data: statsList } = useProjectStats(id);
  const stats = statsList?.[0];
  const { data: clients } = useClients();
  const { data: allInvoices } = useInvoices();

  const client = clients?.find((c) => c.id === project?.client_id);
  const linkedInvoices = useMemo(() => (allInvoices ?? []).filter((inv) => inv.project_id === id), [allInvoices, id]);

  if (isLoading || !project) {
    return <main className="flex-1 p-8 pt-4 text-muted-foreground">Chargement…</main>;
  }

  const status = getProjectStatus(project.status);

  return (
    <main className="flex-1 p-8 pt-4">
      <div className="max-w-[1200px] mx-auto w-full">
            <button
              onClick={() => navigate("/projects")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour aux projets
            </button>

            <div className="flex items-start justify-between mb-6 gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{project.name}</h1>
                  {status && <ProjectStatusBadge status={status} />}
                </div>
                <p className="text-muted-foreground mt-1">
                  {client?.name ?? "Client inconnu"}
                  {project.responsible_person && ` • ${project.responsible_person}`}
                </p>
              </div>
              <Button variant="outline" className="gap-2" onClick={() => navigate(`/projects/${project.id}/edit`)}>
                <Pencil className="w-4 h-4" />
                Modifier
              </Button>
            </div>

            {/* Tabs — plain buttons, matching Management.tsx's tab-bar pattern rather than @sordi/ui's Tabs primitive, since state also drives which section's data hooks are active */}
            <div className="flex items-center gap-1 p-1 bg-secondary/30 w-fit rounded-2xl border border-border/50 mb-6">
              {[
                { key: "overview" as const, label: "Aperçu" },
                { key: "tasks" as const, label: "Tâches" },
                { key: "deliverables" as const, label: "Livrables" },
                { key: "expenses" as const, label: "Dépenses" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-6 py-2.5 text-sm font-medium transition-all rounded-xl ${
                    activeTab === tab.key
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "overview" && <OverviewTab project={project} stats={stats} linkedInvoices={linkedInvoices} client={client} />}
            {activeTab === "tasks" && <TasksTab projectId={project.id} />}
            {activeTab === "deliverables" && <DeliverablesTab projectId={project.id} />}
            {activeTab === "expenses" && <ProjectExpensesTab projectId={project.id} />}
          </div>
    </main>
  );
}

function OverviewTab({
  project,
  stats,
  linkedInvoices,
  client,
}: {
  project: Project;
  stats: ProjectStats | undefined;
  linkedInvoices: Invoice[];
  client: Client | undefined;
}) {
  const navigate = useNavigate();
  const assignInvoice = useAssignInvoiceToProject();
  const { data: employees } = useEmployees();
  const setFreelancerPayment = useSetFreelancerPaymentStatus();
  const { data: profitability } = useProjectProfitability(project.id);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const budgetFacture = stats?.budget_facture ?? 0;
  const budgetPaye = stats?.budget_paye ?? 0;
  const ratio = project.planned_budget > 0 ? Math.min(1, budgetFacture / project.planned_budget) : 0;
  const overBudget = project.planned_budget > 0 && budgetFacture > project.planned_budget;
  const freelancer = employees?.find((e) => e.id === project.freelancer_id);
  const netMargin = profitability?.net_margin ?? 0;
  const marginPercentage = profitability?.margin_percentage ?? 0;
  const isProfitable = netMargin >= 0;
  const directExpenses = profitability?.direct_expenses ?? 0;
  const expenseRatio = project.planned_budget > 0 ? Math.min(1, directExpenses / project.planned_budget) : 0;
  const expenseOverBudget = project.planned_budget > 0 && directExpenses > project.planned_budget;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Budget prévu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono tabular-nums text-xl font-bold">{formatCurrency(project.planned_budget)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Budget facturé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`font-mono tabular-nums text-xl font-bold ${overBudget ? "text-destructive" : ""}`}>{formatCurrency(budgetFacture)}</div>
            {project.planned_budget > 0 && (
              <div className="h-1.5 mt-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${overBudget ? "bg-destructive" : "bg-primary"}`} style={{ width: `${ratio * 100}%` }} />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Budget payé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono tabular-nums text-xl font-bold text-green-600">{formatCurrency(budgetPaye)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Real profitability (HT revenue minus direct costs) — distinct from the
          planned-budget-consumption cards above, which are TTC-basis and don't
          account for any actual cost. See get_project_profitability. */}
      <Card className={isProfitable ? "border-green-600/20 bg-green-600/[0.03]" : "border-destructive/20 bg-destructive/[0.03]"}>
        <CardHeader>
          <CardTitle className="text-base">Rentabilité &amp; Finances Réelles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Chiffre d'Affaires Réalisé (HT)</p>
              <p className="font-mono tabular-nums text-xl font-bold mt-1">{formatCurrency(profitability?.revenue_ht ?? 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Encaissé</p>
              <p className="font-mono tabular-nums text-xl font-bold mt-1 text-green-600">{formatCurrency(profitability?.total_collected ?? 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dépenses &amp; Coûts Directs</p>
              <p className="font-mono tabular-nums text-xl font-bold mt-1 text-destructive">{formatCurrency(profitability?.direct_expenses ?? 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Marge Nette Réelle</p>
              <div className="flex items-center gap-2 mt-1">
                <p className={`font-mono tabular-nums text-xl font-bold ${isProfitable ? "text-green-600" : "text-destructive"}`}>
                  {formatCurrency(netMargin)}
                </p>
                <StatusBadge tone={isProfitable ? "success" : "error"}>
                  {marginPercentage >= 0 ? "+" : ""}
                  {marginPercentage.toFixed(1)}%
                </StatusBadge>
              </div>
            </div>
          </div>

          {/* Budget consumption — how much of the planned budget the
              project's actual costs have used up, distinct from the
              "Budget facturé" card above which compares revenue (not
              expenses) against the same budget figure. */}
          {project.planned_budget > 0 && (
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">Consommation du budget (dépenses)</span>
                <span className={`font-mono tabular-nums font-medium ${expenseOverBudget ? "text-destructive" : ""}`}>
                  {formatCurrency(directExpenses)} / {formatCurrency(project.planned_budget)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${expenseOverBudget ? "bg-destructive" : "bg-amber-500"}`} style={{ width: `${expenseRatio * 100}%` }} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* A different kind of money from the client-invoice-derived budget above:
          what the agency owes the freelancer, not what the client owes the agency.
          Kept as its own block rather than mixed into the budget cards. */}
      {project.freelancer_id && (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardHeader>
            <CardTitle className="text-base">Paiement freelance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{freelancer?.name ?? "Freelance"}</p>
                <p className="font-mono tabular-nums text-xl font-bold mt-1">
                  {project.montant_convenu != null ? formatCurrency(project.montant_convenu) : "Montant non défini"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {project.statut_paiement === "paye" ? (
                  <StatusBadge tone="success">Payé{project.date_paiement ? ` le ${formatDate(project.date_paiement)}` : ""}</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">Non payé</StatusBadge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={setFreelancerPayment.isPending}
                  onClick={() =>
                    setFreelancerPayment.mutate({
                      projectId: project.id,
                      statutPaiement: project.statut_paiement === "paye" ? "non_paye" : "paye",
                      datePaiement: project.statut_paiement === "paye" ? null : new Date().toISOString().slice(0, 10),
                    })
                  }
                >
                  {project.statut_paiement === "paye" ? "Marquer non payé" : "Marquer payé"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between py-2 border-b border-border/50 text-sm">
            <span className="text-muted-foreground">Date de début</span>
            <span className="font-medium">{formatDate(project.start_date)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/50 text-sm">
            <span className="text-muted-foreground">Échéance</span>
            <span className="font-medium">{formatDate(project.deadline)}</span>
          </div>
          <div className="flex justify-between py-2 items-start text-sm">
            <span className="text-muted-foreground">Catégories de service</span>
            <div className="flex flex-wrap gap-1.5 justify-end max-w-[70%]">
              {project.service_categories.length === 0 ? (
                <span className="font-medium">-</span>
              ) : (
                project.service_categories.map((key) => (
                  <span key={key} className="text-xs font-medium bg-secondary px-2 py-0.5 rounded-full">
                    {serviceCategoryLabel(key)}
                  </span>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Factures liées</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`/invoices/new?project_id=${project.id}`)}
            >
              <FileText className="w-4 h-4" />
              Nouvelle facture
            </Button>
            <Button
              size="sm"
              className="gap-2 bg-primary hover:bg-primary-hover text-primary-foreground"
              onClick={() => setContractModalOpen(true)}
            >
              <FileText className="w-4 h-4" />
              Générer un Contrat
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {linkedInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune facture liée. Liez une facture à ce projet depuis sa page de détail.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Montant TTC</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linkedInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(inv.invoice_date)}</TableCell>
                    <TableCell className="font-mono tabular-nums">{formatCurrency(inv.total_ttc ?? 0)}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => assignInvoice.mutate({ invoiceId: inv.id, projectId: null })}
                        className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-all text-muted-foreground"
                        title="Délier du projet"
                      >
                        <CloseIcon className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ContractModal
        open={contractModalOpen}
        onOpenChange={setContractModalOpen}
        initialProjectId={project.id}
        initialClientId={project.client_id}
      />
    </div>
  );
}

function TasksTab({ projectId }: { projectId: string }) {
  const { data: tasks } = useProjectTasks(projectId);
  const { data: employees } = useEmployees();
  const createTask = useCreateProjectTask();
  const updateStatus = useUpdateProjectTaskStatus();
  const deleteTask = useDeleteProjectTask();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState<string>("");
  const [newDueDate, setNewDueDate] = useState("");

  const employeeById = new Map((employees ?? []).map((e) => [e.id, e]));

  const handleCreate = () => {
    if (!newTitle.trim()) {
      toast.error("Le titre de la tâche est requis");
      return;
    }
    createTask.mutate(
      { project_id: projectId, title: newTitle.trim(), assigned_resource_id: newAssignee || null, due_date: newDueDate || null },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setNewTitle("");
          setNewAssignee("");
          setNewDueDate("");
        },
      }
    );
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Nouvelle tâche
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {!tasks || tasks.length === 0 ? (
            <div className="p-8">
              <EmptyState type="tasks" title="Aucune tâche" description="Ajoutez la première tâche de ce projet" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tâche</TableHead>
                  <TableHead>Assigné à</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Révisions</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.assigned_resource_id && employeeById.get(task.assigned_resource_id) ? (
                        <span className="flex items-center gap-2">
                          <EmployeeAvatar
                            size="sm"
                            photoPath={employeeById.get(task.assigned_resource_id)!.photo_path}
                            name={employeeById.get(task.assigned_resource_id)!.name}
                          />
                          {employeeById.get(task.assigned_resource_id)!.name}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={task.status}
                        onValueChange={(v) => updateStatus.mutate({ id: task.id, status: v as ProjectTaskStatus })}
                      >
                        <SelectTrigger className="w-[190px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_STATUS_ORDER.map((s) => (
                            <SelectItem key={s} value={s}>
                              {TASK_STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {task.revision_count > 0 ? task.revision_count : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(task.due_date)}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => deleteTask.mutate({ id: task.id, projectId })}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary transition-all text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle tâche</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Titre</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Maquette page d'accueil" />
            </div>
            <div className="space-y-1.5">
              <Label>Assigné à</Label>
              <Select value={newAssignee} onValueChange={setNewAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Non assigné" />
                </SelectTrigger>
                <SelectContent>
                  {employees?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Échéance</Label>
              <DatePicker value={newDueDate} onChange={setNewDueDate} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={createTask.isPending}>
              {createTask.isPending ? "Création…" : "Créer la tâche"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeliverablesTab({ projectId }: { projectId: string }) {
  const { data: deliverables } = useProjectDeliverables(projectId);
  const createDeliverable = useCreateProjectDeliverable();
  const updateDeliverable = useUpdateProjectDeliverable();
  const deleteDeliverable = useDeleteProjectDeliverable();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newLink, setNewLink] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error("Le nom du livrable est requis");
      return;
    }
    createDeliverable.mutate(
      { project_id: projectId, name: newName.trim(), type: newType || null, link_or_path: newLink || null },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setNewName("");
          setNewType("");
          setNewLink("");
        },
      }
    );
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Nouveau livrable
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {!deliverables || deliverables.length === 0 ? (
            <div className="p-8">
              <EmptyState type="deliverables" title="Aucun livrable" description="Ajoutez le premier livrable de ce projet" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lien</TableHead>
                  <TableHead>Livré</TableHead>
                  <TableHead>Approuvé</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliverables.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">{d.type || "-"}</TableCell>
                    <TableCell>
                      {d.link_or_path ? (
                        d.link_or_path.startsWith("http") ? (
                          <a
                            href={d.link_or_path}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Ouvrir
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground truncate max-w-[200px] inline-flex items-center gap-1" title={d.link_or_path}>
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            {d.link_or_path}
                          </span>
                        )
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={d.delivered_to_client}
                        onCheckedChange={(checked) =>
                          updateDeliverable.mutate({
                            id: d.id,
                            data: { name: d.name, type: d.type, link_or_path: d.link_or_path, delivered_to_client: checked, approved: d.approved },
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={d.approved}
                        onCheckedChange={(checked) =>
                          updateDeliverable.mutate({
                            id: d.id,
                            data: { name: d.name, type: d.type, link_or_path: d.link_or_path, delivered_to_client: d.delivered_to_client, approved: checked },
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => deleteDeliverable.mutate({ id: d.id, projectId })}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary transition-all text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau livrable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Logo final (SVG)" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Ex: Logo, Vidéo, Maquette…" />
            </div>
            <div className="space-y-1.5">
              <Label>Lien ou chemin du fichier</Label>
              <Input value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="https://... ou /chemin/local" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={createDeliverable.isPending}>
              {createDeliverable.isPending ? "Ajout…" : "Ajouter le livrable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectExpensesTab({ projectId }: { projectId: string }) {
  const { data: expenses, isLoading } = useExpenses(undefined, projectId);
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split("T")[0],
    category: "",
    description: "",
    amount: "",
  });

  const handleCreate = () => {
    const amount = parseFloat(formData.amount);
    if (!formData.category.trim() || !formData.amount || isNaN(amount) || amount <= 0) {
      toast.error("Le nom et un montant valide sont requis");
      return;
    }
    createExpense.mutate(
      {
        expense_date: formData.expense_date,
        category: formData.category.trim(),
        description: formData.description || undefined,
        amount,
        project_id: projectId,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setFormData({ expense_date: new Date().toISOString().split("T")[0], category: "", description: "", amount: "" });
        },
      }
    );
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Ajouter une dépense
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-sm text-muted-foreground">Chargement…</div>
          ) : !expenses || expenses.length === 0 ? (
            <div className="p-8">
              <EmptyState type="expenses" title="Aucune dépense" description="Ajoutez la première dépense directe de ce projet" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-muted-foreground">{formatDate(expense.expense_date)}</TableCell>
                    <TableCell>
                      <span className="px-3 py-1 bg-secondary rounded-full text-sm font-medium">{expense.category}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{expense.description || "-"}</TableCell>
                    <TableCell className="text-right font-mono font-medium text-destructive tabular-nums">
                      -{formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => deleteExpense.mutate(expense.id)}
                        className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-all text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une dépense au projet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <DatePicker
                  value={formData.expense_date}
                  onChange={(v) => setFormData({ ...formData, expense_date: v })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Montant (DA)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nom de la dépense</Label>
              <Input
                placeholder="Ex: Sous-traitance, Impression, Déplacement..."
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder="Description de la dépense"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={createExpense.isPending}>
              {createExpense.isPending ? "Enregistrement…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
