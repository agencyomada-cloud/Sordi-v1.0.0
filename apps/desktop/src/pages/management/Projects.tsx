import { useState } from "react";
import { 
    RiAddLine as Plus, 
    RiPencilLine as Pencil, 
    RiDeleteBinLine as Trash2, 
    RiMoreFill as MoreHorizontal, 
    RiBriefcaseLine as Briefcase, 
    RiUserLine as User, 
    RiTargetLine as Target 
} from "@remixicon/react";
import { Card, CardContent, Button, Progress, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Label, Input, Slider, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sordi/ui";
import { useProjects } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";

const ProjectsSection = () => {
    const { data: projects, isLoading, createProject, updateProject, deleteProject } = useProjects();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        client_name: "",
        team_members: "",
        progress: 0,
        status: "En cours",
        color: "bg-blue-500",
    });

    const resetForm = () => {
        setFormData({
            name: "",
            client_name: "",
            team_members: "",
            progress: 0,
            status: "En cours",
            color: "bg-blue-500",
        });
        setEditingProject(null);
    };

    const handleEdit = (project: any) => {
        setEditingProject(project);
        setFormData({
            name: project.name,
            client_name: project.client_name || "",
            team_members: project.team_members || "",
            progress: project.progress,
            status: project.status || "En cours",
            color: project.color || "bg-blue-500",
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingProject) {
            updateProject.mutate({ id: editingProject.id, data: formData }, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    resetForm();
                }
            });
        } else {
            createProject.mutate(formData, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    resetForm();
                }
            });
        }
    };

    const handleDelete = () => {
        if (deletingProjectId) {
            deleteProject.mutate(deletingProjectId, {
                onSuccess: () => {
                    setIsDeleteDialogOpen(false);
                    setDeletingProjectId(null);
                }
            });
        }
    };

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map(i => (
                    <Card key={i} className="h-40 animate-pulse bg-secondary/20 rounded-3xl" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    if (!open) resetForm();
                    setIsDialogOpen(open);
                }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 rounded-xl">
                            <Plus className="w-4 h-4" />
                            Nouveau projet
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md rounded-3xl">
                        <DialogHeader>
                            <DialogTitle>{editingProject ? "Modifier le projet" : "Nouveau projet"}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                            <div className="space-y-4">
                                <div>
                                    <Label>Nom du projet *</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        placeholder="Ex: Refonte Site Web"
                                        className="mt-1.5 rounded-xl"
                                    />
                                </div>
                                <div>
                                    <Label>Client</Label>
                                    <Input
                                        value={formData.client_name}
                                        onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                                        placeholder="Nom du client ou interne"
                                        className="mt-1.5 rounded-xl"
                                    />
                                </div>
                                <div>
                                    <Label>Équipe (membres séparés par des virgules)</Label>
                                    <Input
                                        value={formData.team_members}
                                        onChange={(e) => setFormData({ ...formData, team_members: e.target.value })}
                                        placeholder="Ahmed, Sarah, Karim..."
                                        className="mt-1.5 rounded-xl"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <Label>Statut</Label>
                                        <Select
                                            value={formData.status}
                                            onValueChange={(val) => setFormData({ ...formData, status: val })}
                                        >
                                            <SelectTrigger className="mt-1.5 rounded-xl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="En cours">En cours</SelectItem>
                                                <SelectItem value="En attente">En attente</SelectItem>
                                                <SelectItem value="Terminé">Terminé</SelectItem>
                                                <SelectItem value="Annulé">Annulé</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Couleur</Label>
                                        <Select
                                            value={formData.color}
                                            onValueChange={(val) => setFormData({ ...formData, color: val })}
                                        >
                                            <SelectTrigger className="mt-1.5 rounded-xl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="bg-blue-500">Bleu</SelectItem>
                                                <SelectItem value="bg-green-500">Vert</SelectItem>
                                                <SelectItem value="bg-orange-500">Orange</SelectItem>
                                                <SelectItem value="bg-purple-500">Violet</SelectItem>
                                                <SelectItem value="bg-red-500">Rouge</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <Label>Progression</Label>
                                        <span className="text-sm font-bold">{formData.progress}%</span>
                                    </div>
                                    <Slider
                                        value={[formData.progress]}
                                        onValueChange={(val) => setFormData({ ...formData, progress: val[0] })}
                                        max={100}
                                        step={5}
                                        className="py-4"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl">
                                    Annuler
                                </Button>
                                <Button type="submit" disabled={createProject.isPending || updateProject.isPending} className="rounded-xl">
                                    {editingProject ? "Modifier" : "Ajouter"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {projects?.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-muted-foreground bg-secondary/10 rounded-3xl border border-dashed border-border/50">
                        Aucun projet enregistré
                    </div>
                ) : (
                    projects?.map((project) => (
                        <Card key={project.id} className="overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 rounded-3xl group relative">
                            <CardContent className="p-6">
                                <div className="absolute top-4 right-4">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl">
                                            <DropdownMenuItem onClick={() => handleEdit(project)}>
                                                <Pencil className="w-4 h-4 mr-2" />
                                                Modifier
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={() => {
                                                    setDeletingProjectId(project.id);
                                                    setIsDeleteDialogOpen(true);
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Supprimer
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-foreground mb-1">{project.name}</h3>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                            <User className="w-3.5 h-3.5" />
                                            {project.client_name || "Client interne"}
                                        </p>
                                    </div>
                                    <span className={cn(
                                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                        project.status === "Terminé" ? "bg-green-500/10 text-green-500" :
                                            project.status === "En attente" ? "bg-orange-500/10 text-orange-500" :
                                                project.status === "Annulé" ? "bg-red-500/10 text-red-500" :
                                                    "bg-blue-500/10 text-blue-500"
                                    )}>
                                        {project.status || "En cours"}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground font-medium">Progression</span>
                                        <span className="font-bold text-foreground">{project.progress}%</span>
                                    </div>
                                    <Progress value={project.progress} className="h-2.5 bg-secondary/50" indicatorClassName={project.color || "bg-primary"} />
                                </div>

                                <div className="mt-6 flex items-center justify-between">
                                    <div className="flex -space-x-2">
                                        {(project.team_members || "").split(",").filter(Boolean).map((name, i) => (
                                            <div key={i} className="w-8 h-8 rounded-full border-2 border-card bg-secondary flex items-center justify-center text-[10px] font-bold uppercase" title={name.trim()}>
                                                {name.trim().substring(0, 2)}
                                            </div>
                                        ))}
                                        {!(project.team_members) && (
                                            <div className="w-8 h-8 rounded-full border-2 border-card bg-secondary/50 flex items-center justify-center text-[10px] text-muted-foreground italic">
                                                -
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                                        Équipe: {(project.team_members || "").split(",").length || 0} membres
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce projet ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. Toutes les données liées à ce projet seront définitivement supprimées.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground rounded-xl">
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ProjectsSection;
