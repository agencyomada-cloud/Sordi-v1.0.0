import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RiAddLine as Plus,
  RiMoreFill as MoreHorizontal,
  RiPencilLine as Pencil,
  RiDeleteBinLine as Trash2,
  RiEyeLine as Eye,
  RiFolderChartLine as FolderIcon,
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
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@sordi/ui";
import { RiTimeLine as ClockIcon, RiCheckboxCircleLine as CheckIcon, RiAlarmWarningLine as WarningIcon } from "@remixicon/react";
import { MetricStrip, MetricTrendBadge } from "@/components/ui/metric-strip";
import { useProjects, useDeleteProject, useProjectStatsMap } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { computeProjectStatus, type ProjectStatusKey } from "@/lib/projectOverview";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import type { ProjectStats } from "@/lib/database";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD", minimumFractionDigits: 0 }).format(amount);

const STATUS_FILTERS: { key: ProjectStatusKey | "all"; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "en_retard", label: "En retard" },
  { key: "depassement_budgetaire", label: "Dépassement budgétaire" },
  { key: "a_risque", label: "À risque" },
  { key: "en_cours", label: "En cours" },
  { key: "nouveau", label: "Nouveau" },
  { key: "termine", label: "Terminé" },
];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatusKey | "all">("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const { data: projects, isLoading } = useProjects();
  const { data: clients } = useClients();
  const { data: statsByProjectId } = useProjectStatsMap();
  const deleteProject = useDeleteProject();

  const clientNameById = useMemo(() => new Map((clients ?? []).map((c) => [c.id, c.name])), [clients]);

  const statusCounts = useMemo(() => {
    const counts = { en_cours: 0, termine: 0, a_risque: 0 };
    (projects ?? []).forEach((project) => {
      const stats = statsByProjectId.get(project.id);
      const key = stats ? computeProjectStatus(stats).key : null;
      if (key === "en_cours" || key === "nouveau") counts.en_cours++;
      else if (key === "termine") counts.termine++;
      else if (key === "a_risque" || key === "en_retard" || key === "depassement_budgetaire") counts.a_risque++;
    });
    return counts;
  }, [projects, statsByProjectId]);

  const rows = useMemo(() => {
    return (projects ?? [])
      .map((project) => {
        const stats = statsByProjectId.get(project.id);
        const status = stats ? computeProjectStatus(stats) : null;
        return { project, stats, status };
      })
      .filter(({ project, status }) => {
        if (statusFilter !== "all" && status?.key !== statusFilter) return false;
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase().trim();
        const clientName = clientNameById.get(project.client_id) ?? "";
        return (
          project.name.toLowerCase().includes(query) ||
          clientName.toLowerCase().includes(query) ||
          (project.responsible_person ?? "").toLowerCase().includes(query)
        );
      });
  }, [projects, statsByProjectId, statusFilter, searchQuery, clientNameById]);

  const handleDelete = () => {
    if (!projectToDelete) return;
    deleteProject.mutate(projectToDelete, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setProjectToDelete(null);
      },
    });
  };

  return (
    <>
      <main className="flex-1 p-8 pt-4">
          <div className="max-w-[1600px] mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 animate-fade-in-down">
              <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Projets</h1>
                <p className="text-muted-foreground mt-1">Suivez vos projets clients, tâches et livrables</p>
              </div>

              <Button className="gap-2" onClick={() => navigate("/projects/new")}>
                <Plus className="w-4 h-4" />
                Nouveau projet
              </Button>
            </div>

            {/* Metric strip — shared KPI ribbon component (same shape as the
                Dashboard's Tier 2), replacing the old StatsCard grid. */}
            <div className="mb-6 animate-fade-in-up animation-delay-100">
              <MetricStrip
                cells={[
                  { key: "total", label: "Total Projets", value: String(projects?.length || 0), numericValue: projects?.length || 0, format: (v) => String(Math.round(v)), icon: FolderIcon },
                  { key: "en_cours", label: "En Cours", value: String(statusCounts.en_cours), numericValue: statusCounts.en_cours, format: (v) => String(Math.round(v)), icon: ClockIcon },
                  {
                    key: "a_risque",
                    label: "À Risque",
                    value: String(statusCounts.a_risque),
                    numericValue: statusCounts.a_risque,
                    format: (v) => String(Math.round(v)),
                    icon: WarningIcon,
                    trend: (
                      <MetricTrendBadge good={statusCounts.a_risque === 0}>
                        {statusCounts.a_risque > 0 ? "Attention requise" : "RAS"}
                      </MetricTrendBadge>
                    ),
                  },
                  { key: "termine", label: "Terminés", value: String(statusCounts.termine), numericValue: statusCounts.termine, format: (v) => String(Math.round(v)), icon: CheckIcon },
                ]}
              />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2 animate-fade-in-up animation-delay-150">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                    statusFilter === f.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="mb-6 animate-fade-in-up animation-delay-150">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Rechercher par nom, client, responsable..."
                containerClassName="w-full md:w-80"
              />
            </div>

            <div className="animate-fade-in-up animation-delay-200">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Projet</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="hidden md:table-cell">Responsable</TableHead>
                    <TableHead numeric className="hidden lg:table-cell">Budget facturé / prévu</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-14"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableLoading columns={6} rows={5} />
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <EmptyState
                          type="projects"
                          title="Aucun projet"
                          description={searchQuery ? "Essayez une autre recherche" : "Créez votre premier projet"}
                          action={
                            searchQuery
                              ? { label: "Effacer la recherche", onClick: () => setSearchQuery("") }
                              : { label: "Créer", onClick: () => navigate("/projects/new") }
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map(({ project, stats, status }) => (
                      <TableRow
                        key={project.id}
                        className="cursor-pointer"
                        dimmed={status?.key === "termine"}
                        onClick={() => navigate(`/projects/${project.id}`)}
                      >
                        <TableCell className="font-medium max-w-[220px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">{project.name}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top">{project.name}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{clientNameById.get(project.client_id) ?? "-"}</TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{project.responsible_person || "-"}</TableCell>
                        <TableCell numeric className="hidden lg:table-cell">
                          <BudgetCell stats={stats} plannedBudget={project.planned_budget} />
                        </TableCell>
                        <TableCell>{status && <ProjectStatusBadge status={status} />}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-all">
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Voir
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}/edit`)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setProjectToDelete(project.id);
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce projet ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les tâches et livrables associés seront aussi supprimés. Les factures liées ne seront pas
              supprimées, seulement déliées.
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

function BudgetCell({ stats, plannedBudget }: { stats: ProjectStats | undefined; plannedBudget: number }) {
  if (!stats || plannedBudget <= 0) {
    return <span className="text-muted-foreground font-mono tabular-nums tracking-tight">{formatCurrency(plannedBudget)}</span>;
  }
  const ratio = Math.min(1, stats.budget_facture / plannedBudget);
  const overBudget = stats.budget_facture > plannedBudget;
  return (
    <div className="min-w-[140px] ms-auto">
      <p className={`text-sm font-mono tabular-nums tracking-tight ${overBudget ? "text-destructive font-medium" : "text-foreground"}`}>
        {formatCurrency(stats.budget_facture)} <span className="text-muted-foreground font-normal">/ {formatCurrency(plannedBudget)}</span>
      </p>
      <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${overBudget ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
