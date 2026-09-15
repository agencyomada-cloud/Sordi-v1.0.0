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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  StatusDot,
  statusBadgeVariants,
} from "@sordi/ui";
import { RiTimeLine as ClockIcon, RiCheckboxCircleLine as CheckIcon, RiPauseCircleLine as PauseIcon } from "@remixicon/react";
import { MetricStrip } from "@/components/ui/metric-strip";
import { useProjects, useDeleteProject, useProjectStatsMap, useUpdateProjectStatus } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useSecureSession } from "@/hooks/useSecureSession";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";
import { getProjectStatus, PROJECT_STATUS_OPTIONS, type ProjectStatusKey } from "@/lib/projectOverview";
import { cn } from "@/lib/utils";
import type { ProjectStats, ProjectLifecycleStatus } from "@/lib/database";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD", minimumFractionDigits: 0 }).format(amount);

const STATUS_FILTERS: { key: ProjectStatusKey | "all"; label: string }[] = [
  { key: "all", label: "Tous" },
  ...PROJECT_STATUS_OPTIONS,
];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { executeSecuredAction } = useSecureSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatusKey | "all">("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const { data: projects, isLoading } = useProjects();
  const { data: clients } = useClients();
  const { data: statsByProjectId } = useProjectStatsMap();
  const deleteProject = useDeleteProject();
  const updateProjectStatus = useUpdateProjectStatus();

  const clientNameById = useMemo(() => new Map((clients ?? []).map((c) => [c.id, c.name])), [clients]);

  // Explicit status field, straight off the project record — no longer
  // derived from payment collection or task data, so this is a plain
  // COUNT(*) grouped by projects.status.
  const statusCounts = useMemo(() => {
    const counts: Record<ProjectLifecycleStatus, number> = { en_cours: 0, termine: 0, en_pause: 0 };
    (projects ?? []).forEach((project) => {
      const key = getProjectStatus(project.status).key;
      counts[key]++;
    });
    return counts;
  }, [projects]);

  const rows = useMemo(() => {
    return (projects ?? [])
      .map((project) => {
        const stats = statsByProjectId.get(project.id);
        const status = getProjectStatus(project.status);
        return { project, stats, status };
      })
      .filter(({ project, status }) => {
        if (statusFilter !== "all" && status.key !== statusFilter) return false;
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

  const handleDelete = async () => {
    if (!projectToDelete) return;
    await executeSecuredAction(() => {
      deleteProject.mutate(projectToDelete, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setProjectToDelete(null);
        },
      });
    }, "Autoriser la suppression du projet");
  };

  return (
    <>
      <main className="flex-1 p-8 pt-4">
          <div className="max-w-[1600px] mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 animate-fade-in-down">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Projets &amp; Opérations</h1>
                <p className="text-sm text-muted-foreground mt-1">Suivez vos projets clients, tâches et livrables</p>
              </div>

              <Button variant="default" size="sm" className="h-[30px] px-3 text-xs rounded-md gap-1.5" onClick={() => navigate("/projects/new")}>
                <Plus className="w-3.5 h-3.5" />
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
                  { key: "en_pause", label: "En Pause", value: String(statusCounts.en_pause), numericValue: statusCounts.en_pause, format: (v) => String(Math.round(v)), icon: PauseIcon },
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

            <div className="animate-fade-in-up animation-delay-200 border border-border/80 rounded-md bg-card overflow-hidden w-full">
              <Table>
                <TableHeader>
                  <TableRow className="h-8 bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Projet</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Client</TableHead>
                    <TableHead className="hidden md:table-cell text-[11px] font-semibold text-muted-foreground uppercase px-3">Responsable</TableHead>
                    <TableHead numeric className="hidden lg:table-cell text-[11px] font-semibold text-muted-foreground uppercase px-3">Montant encaissé / Total facturé</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase px-3">Statut</TableHead>
                    <TableHead className="w-14 text-[11px] font-semibold text-muted-foreground uppercase px-3"></TableHead>
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
                        className="h-8 text-xs border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
                        dimmed={status.key === "termine"}
                        onClick={() => navigate(`/projects/${project.id}`)}
                      >
                        <TableCell className="font-medium max-w-[220px] px-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">{project.name}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top">{project.name}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-muted-foreground px-3">{clientNameById.get(project.client_id) ?? "-"}</TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell px-3">{project.responsible_person || "-"}</TableCell>
                        <TableCell numeric className="hidden lg:table-cell px-3">
                          {/* Purely informational — real cash collected vs. real
                              invoiced total, independent of operational status. */}
                          <BudgetCell stats={stats} />
                        </TableCell>
                        <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                          {/* Explicit, manually-set operational status — the
                              dropdown itself IS the quick-toggle; matching
                              items also live in the "..." action menu. */}
                          <Select
                            value={status.key}
                            onValueChange={(value) => updateProjectStatus.mutate({ id: project.id, status: value as ProjectLifecycleStatus })}
                          >
                            <SelectTrigger className={cn(statusBadgeVariants(), "h-7 w-fit gap-1.5 border-border")}>
                              <StatusDot tone={status.tone} />
                              <span>{status.label}</span>
                            </SelectTrigger>
                            <SelectContent>
                              {PROJECT_STATUS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-all">
                                <MoreHorizontal className="w-3.5 h-3.5" />
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
                              {PROJECT_STATUS_OPTIONS.filter((opt) => opt.key !== status.key).map((opt) => (
                                <DropdownMenuItem
                                  key={opt.key}
                                  onClick={() => updateProjectStatus.mutate({ id: project.id, status: opt.key })}
                                >
                                  <StatusDot tone={getProjectStatus(opt.key).tone} className="mr-2" />
                                  Marquer {opt.label}
                                </DropdownMenuItem>
                              ))}
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

      <DeleteConfirmationModal
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Supprimer le projet"
        itemIdentifier={projects?.find((p) => p.id === projectToDelete)?.name || "Projet"}
        description="Cette action est irréversible. Les tâches et livrables associés seront aussi supprimés. Les factures liées ne seront pas supprimées, seulement déliées."
        isLoading={deleteProject.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

/** Purely financial/informational — real cash collected (budget_paye) vs.
 *  the real invoiced total (budget_facture), from the payments ledger via
 *  get_project_stats. Deliberately has no relationship to projects.status:
 *  a project can be 100% collected and still "En cours" operationally, or
 *  "Terminé" with a balance still outstanding. */
function BudgetCell({ stats }: { stats: ProjectStats | undefined }) {
  const total = stats?.budget_facture ?? 0;
  if (!stats || total <= 0) {
    return <span className="text-muted-foreground font-mono tabular-nums tracking-tight">—</span>;
  }
  const collected = stats.budget_paye;
  const ratio = Math.min(1, collected / total);
  return (
    <div className="min-w-[140px] ms-auto">
      <p className="text-sm font-mono tabular-nums tracking-tight text-foreground">
        {formatCurrency(collected)} <span className="text-muted-foreground font-normal">/ {formatCurrency(total)}</span>
      </p>
      <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}
