import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RiArrowLeftLine as ArrowLeft } from "@remixicon/react";
import {
  Button,
  Input,
  Label,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sordi/ui";
import { useProject, useCreateProject, useUpdateProject, type CreateProjectData } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useEmployees } from "@/hooks/useEmployees";
import { SERVICE_CATEGORIES } from "@/lib/projectOverview";
import { toast } from "sonner";

const emptyForm: CreateProjectData = {
  client_id: "",
  name: "",
  service_categories: [],
  responsible_person: "",
  start_date: "",
  deadline: "",
  planned_budget: 0,
  freelancer_id: null,
  montant_convenu: null,
};

export default function NewProjectPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const { data: existingProject } = useProject(id);
  const { data: clients } = useClients();
  const { data: employees } = useEmployees();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const freelancers = employees?.filter((e) => e.contract_type === "Freelance") ?? [];

  const [formData, setFormData] = useState<CreateProjectData>(emptyForm);

  useEffect(() => {
    if (existingProject) {
      setFormData({
        client_id: existingProject.client_id,
        name: existingProject.name,
        service_categories: existingProject.service_categories,
        responsible_person: existingProject.responsible_person ?? "",
        start_date: existingProject.start_date ?? "",
        deadline: existingProject.deadline ?? "",
        planned_budget: existingProject.planned_budget,
        freelancer_id: existingProject.freelancer_id,
        montant_convenu: existingProject.montant_convenu,
      });
    }
  }, [existingProject]);

  const toggleCategory = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      service_categories: prev.service_categories.includes(key)
        ? prev.service_categories.filter((k) => k !== key)
        : [...prev.service_categories, key],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id) {
      toast.error("Sélectionnez un client");
      return;
    }
    if (!formData.name.trim()) {
      toast.error("Le nom du projet est requis");
      return;
    }

    if (isEditMode && id) {
      updateProject.mutate(
        { id, data: formData },
        { onSuccess: () => navigate(`/projects/${id}`) }
      );
    } else {
      createProject.mutate(formData, {
        onSuccess: (project) => navigate(`/projects/${project.id}`),
      });
    }
  };

  const isPending = createProject.isPending || updateProject.isPending;

  return (
    <main className="flex-1 p-8 pt-4">
          <div className="max-w-2xl mx-auto w-full">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>

            <h1 className="text-2xl font-bold mb-6">{isEditMode ? "Modifier le projet" : "Nouveau projet"}</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nom du projet</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Refonte identité visuelle"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client">Client</Label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData((p) => ({ ...p, client_id: v }))}>
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Catégories de service</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {SERVICE_CATEGORIES.map((cat) => (
                    <label
                      key={cat.key}
                      className="flex items-center gap-2 px-3 py-2 rounded-[6px] border border-border/50 cursor-pointer hover:bg-secondary/40 transition-colors"
                    >
                      <Checkbox
                        checked={formData.service_categories.includes(cat.key)}
                        onCheckedChange={() => toggleCategory(cat.key)}
                      />
                      <span className="text-sm">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="responsible">Responsable</Label>
                <Select
                  value={formData.responsible_person || "none"}
                  onValueChange={(v) => setFormData((p) => ({ ...p, responsible_person: v === "none" ? "" : v }))}
                >
                  <SelectTrigger id="responsible">
                    <SelectValue placeholder="Sélectionner un responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun responsable</SelectItem>
                    {employees?.map((e) => (
                      <SelectItem key={e.id} value={e.name}>
                        {e.name}
                      </SelectItem>
                    ))}
                    {/* A pre-existing free-text name (from before this was a picker) that
                        doesn't match any current employee — kept selectable so editing an
                        older project doesn't silently blank out its responsible person. */}
                    {formData.responsible_person && !employees?.some((e) => e.name === formData.responsible_person) && (
                      <SelectItem value={formData.responsible_person}>{formData.responsible_person} (ancien)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="start_date">Date de début</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deadline">Échéance</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={formData.deadline ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, deadline: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="planned_budget">Budget prévu (DA)</Label>
                <Input
                  id="planned_budget"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.planned_budget}
                  onChange={(e) => setFormData((p) => ({ ...p, planned_budget: Number(e.target.value) || 0 }))}
                />
                <p className="text-xs text-muted-foreground">
                  Le budget facturé réel se calcule automatiquement à partir des factures liées à ce projet.
                </p>
              </div>

              {/* Only relevant when a freelancer is doing the work — a separate lump-sum owed to them, distinct from the client budget above */}
              <div className="space-y-1.5 rounded-[6px] border border-border/50 p-4">
                <Label htmlFor="freelancer">Freelance assigné (optionnel)</Label>
                <Select
                  value={formData.freelancer_id ?? "none"}
                  onValueChange={(v) => setFormData((p) => ({ ...p, freelancer_id: v === "none" ? null : v, montant_convenu: v === "none" ? null : p.montant_convenu }))}
                >
                  <SelectTrigger id="freelancer">
                    <SelectValue placeholder="Aucun freelance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun freelance</SelectItem>
                    {freelancers.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.freelancer_id && (
                  <div className="pt-2 space-y-1.5">
                    <Label htmlFor="montant_convenu">Montant convenu (DA)</Label>
                    <Input
                      id="montant_convenu"
                      type="number"
                      min="0"
                      value={formData.montant_convenu ?? ""}
                      onChange={(e) => setFormData((p) => ({ ...p, montant_convenu: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="Montant total accordé pour ce projet"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Enregistrement…" : isEditMode ? "Enregistrer" : "Créer le projet"}
                </Button>
              </div>
            </form>
          </div>
    </main>
  );
}
