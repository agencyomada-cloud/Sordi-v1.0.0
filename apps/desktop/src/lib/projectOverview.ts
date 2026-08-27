/**
 * Display logic for project status — same split as clientOverview.ts: raw
 * numbers come from get_project_stats (Rust), every threshold/priority rule
 * lives here so the projects list and the project detail page can't drift
 * into disagreeing about a project's status. omada-agency branch only.
 */
import type { ProjectStats } from "./database";
import type { StatusBadgeTone } from "@sordi/ui";

export const SERVICE_CATEGORIES = [
  {
    key: "branding",
    label: "Branding",
    services: ["Logo design", "Brand guidelines"],
  },
  {
    key: "design_graphique",
    label: "Design graphique",
    services: ["Social media design", "Packaging design"],
  },
  {
    key: "marketing_digital",
    label: "Marketing digital",
    services: ["Social media marketing", "Sponsoring"],
  },
  {
    key: "developpement",
    label: "Développement",
    services: ["Website development", "Software development"],
  },
  {
    key: "production_video",
    label: "Production vidéo",
    services: ["Motion graphics", "Video 3D", "Filming", "Social media video"],
  },
] as const;

export type ServiceCategoryKey = (typeof SERVICE_CATEGORIES)[number]["key"];

export function serviceCategoryLabel(key: string): string {
  return SERVICE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export type ProjectStatusKey = "termine" | "nouveau" | "en_retard" | "depassement_budgetaire" | "a_risque" | "en_cours";

export interface ProjectStatus {
  key: ProjectStatusKey;
  label: string;
  tone: StatusBadgeTone;
}

const STATUS_STYLES: Record<ProjectStatusKey, { label: string; tone: StatusBadgeTone }> = {
  termine: { label: "Terminé", tone: "success" },
  nouveau: { label: "Nouveau", tone: "neutral" },
  en_retard: { label: "En retard", tone: "error" },
  depassement_budgetaire: { label: "Dépassement budgétaire", tone: "error" },
  a_risque: { label: "À risque", tone: "warning" },
  en_cours: { label: "En cours", tone: "neutral" },
};

/** progress = fraction of tasks approved. undefined when there are no tasks yet. */
export function computeProjectProgress(stats: ProjectStats): number | undefined {
  if (stats.task_count === 0) return undefined;
  return stats.tasks_approved_count / stats.task_count;
}

/** How far through its own timeline the project is, 0..1+. undefined without both dates. */
export function computeTimeElapsed(stats: ProjectStats, now: Date = new Date()): number | undefined {
  if (!stats.start_date || !stats.deadline) return undefined;
  const start = new Date(stats.start_date).getTime();
  const end = new Date(stats.deadline).getTime();
  if (end <= start) return undefined;
  return (now.getTime() - start) / (end - start);
}

const AT_RISK_PACE_MARGIN = 0.2;

/**
 * Status — first match wins:
 *   1. Terminé — all tasks approved (checked first: a late-but-finished
 *      project isn't "late" anymore, completion is the more useful signal).
 *   2. Nouveau — no tasks yet, nothing to evaluate.
 *   3. En retard — not complete, past deadline.
 *   4. Dépassement budgétaire — not complete, not overdue, invoiced more
 *      than planned.
 *   5. À risque — not complete, not overdue, not over budget, but pace
 *      (time elapsed vs. progress) is lagging its own timeline by more than
 *      20 points.
 *   6. En cours — default, on track.
 */
export function computeProjectStatus(stats: ProjectStats, now: Date = new Date()): ProjectStatus {
  const progress = computeProjectProgress(stats);

  if (progress !== undefined && progress >= 1) {
    return { key: "termine", ...STATUS_STYLES.termine };
  }
  if (stats.task_count === 0) {
    return { key: "nouveau", ...STATUS_STYLES.nouveau };
  }

  const isOverdue = !!stats.deadline && now.getTime() > new Date(stats.deadline).getTime();
  if (isOverdue) {
    return { key: "en_retard", ...STATUS_STYLES.en_retard };
  }

  const isOverBudget = stats.planned_budget > 0 && stats.budget_facture > stats.planned_budget;
  if (isOverBudget) {
    return { key: "depassement_budgetaire", ...STATUS_STYLES.depassement_budgetaire };
  }

  const timeElapsed = computeTimeElapsed(stats, now);
  const behindPace = timeElapsed !== undefined && progress !== undefined && timeElapsed - progress > AT_RISK_PACE_MARGIN;
  if (behindPace) {
    return { key: "a_risque", ...STATUS_STYLES.a_risque };
  }

  return { key: "en_cours", ...STATUS_STYLES.en_cours };
}
