/**
 * Display logic for project status. The operational lifecycle status
 * (en_cours/termine/en_pause) is an explicit, manually-set field on the
 * project record itself (projects.status) — deliberately NOT derived from
 * payment collection or task data, so a client paying 100% upfront doesn't
 * silently mark the deliverables "done", and a project that's fully
 * delivered but only half-invoiced doesn't stay stuck "in progress". The
 * financial collection figures (budget_facture/budget_paye, still sourced
 * from get_project_stats) remain a completely separate, purely
 * informational concern — see the Dashboard's "Santé & Rentabilité des
 * Projets" widget and the Projets table's "Budget facturé / prévu" column.
 */
import type { ProjectLifecycleStatus } from "./database";
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

export type ProjectStatusKey = ProjectLifecycleStatus;

export interface ProjectStatus {
  key: ProjectStatusKey;
  label: string;
  tone: StatusBadgeTone;
}

export const PROJECT_STATUS_OPTIONS: { key: ProjectLifecycleStatus; label: string }[] = [
  { key: "en_cours", label: "En cours" },
  { key: "termine", label: "Terminé" },
  { key: "en_pause", label: "En pause" },
];

export const PROJECT_STATUS_STYLES: Record<ProjectStatusKey, { label: string; tone: StatusBadgeTone }> = {
  en_cours: { label: "En cours", tone: "info" },
  termine: { label: "Terminé", tone: "success" },
  en_pause: { label: "En pause", tone: "warning" },
};

/** Safe lookup — falls back to "en_cours" for null/unrecognized values
 *  (e.g. a project row from before this column existed) instead of
 *  throwing, same defensive pattern as getInvoiceStatusConfig. */
export function getProjectStatus(status: string | null | undefined): ProjectStatus {
  const key = (status && status in PROJECT_STATUS_STYLES ? status : "en_cours") as ProjectStatusKey;
  return { key, ...PROJECT_STATUS_STYLES[key] };
}
