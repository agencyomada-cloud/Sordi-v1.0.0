import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    RiUserLine as User,
    RiPhoneLine as Phone,
    RiMailLine as Mail,
    RiMapPinLine as MapPin,
    RiAddLine as Plus,
    RiPencilLine as Pencil,
    RiDeleteBinLine as Trash2,
    RiMoreFill as MoreHorizontal
} from "@remixicon/react";
import { Card, CardContent, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Label, Input, TableLoading } from "@sordi/ui";
import { useEmployees } from "@/hooks/useEmployees";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";

const EmployeesSection = () => {
    const navigate = useNavigate();
    const { data: employees, isLoading, createEmployee, updateEmployee, deleteEmployee } = useEmployees();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<any>(null);
    const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        role: "",
        email: "",
        phone: "",
        address: "",
        base_salary: "",
        hire_date: "",
        contract_type: "Temps plein",
        rib: "",
        external_code: "",
    });

    const resetForm = () => {
        setFormData({
            name: "",
            role: "",
            email: "",
            phone: "",
            address: "",
            base_salary: "",
            hire_date: "",
            contract_type: "Temps plein",
            rib: "",
            external_code: "",
        });
        setEditingEmployee(null);
    };

    const handleEdit = (emp: any) => {
        setEditingEmployee(emp);
        setFormData({
            name: emp.name,
            role: emp.role || "",
            email: emp.email || "",
            phone: emp.phone || "",
            address: emp.address || "",
            base_salary: emp.base_salary != null ? String(emp.base_salary) : "",
            hire_date: emp.hire_date || "",
            contract_type: emp.contract_type === "Freelance" ? "Freelance" : "Temps plein",
            rib: emp.rib || "",
            external_code: emp.external_code || "",
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const isFreelance = formData.contract_type === "Freelance";
        const payload = {
            ...formData,
            // Freelancers don't punch in/out or have a monthly salary — clear
            // these rather than leave stale values hidden behind the toggle.
            base_salary: isFreelance ? null : formData.base_salary ? Number(formData.base_salary) : null,
            external_code: isFreelance ? null : formData.external_code || null,
            hire_date: formData.hire_date || null,
            contract_type: formData.contract_type || null,
            rib: formData.rib || null,
        };
        if (editingEmployee) {
            updateEmployee.mutate({ id: editingEmployee.id, data: payload }, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    resetForm();
                }
            });
        } else {
            createEmployee.mutate(payload, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    resetForm();
                }
            });
        }
    };

    const handleDelete = () => {
        if (deletingEmployeeId) {
            deleteEmployee.mutate(deletingEmployeeId, {
                onSuccess: () => {
                    setIsDeleteDialogOpen(false);
                    setDeletingEmployeeId(null);
                }
            });
        }
    };

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <Card key={i} className="h-48 animate-pulse bg-secondary/20 rounded-3xl" />
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
                            Nouveau employé
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md rounded-3xl">
                        <DialogHeader>
                            <DialogTitle>{editingEmployee ? "Modifier l'employé" : "Nouvel employé"}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                            <div className="space-y-4">
                                <div>
                                    <Label>Nom complet *</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        placeholder="Ahmed Benali"
                                        className="mt-1.5 rounded-xl"
                                    />
                                </div>
                                <div>
                                    <Label>Rôle / Poste</Label>
                                    <Input
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        placeholder="Chef de projet"
                                        className="mt-1.5 rounded-xl"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label>Email</Label>
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="email@exemple.dz"
                                            className="mt-1.5 rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <Label>Téléphone</Label>
                                        <Input
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="0550 00 00 00"
                                            className="mt-1.5 rounded-xl"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label>Adresse</Label>
                                    <Input
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Alger, Algérie"
                                        className="mt-1.5 rounded-xl"
                                    />
                                </div>
                                <div className="border-t border-border/50 pt-4 space-y-4">
                                    <div>
                                        <Label>Type de contrat</Label>
                                        <div className="flex items-center gap-1 p-1 mt-1.5 bg-secondary/30 w-fit rounded-xl border border-border/50">
                                            {(["Temps plein", "Freelance"] as const).map((type) => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, contract_type: type })}
                                                    className={`px-4 py-2 text-sm font-medium transition-all rounded-lg ${
                                                        formData.contract_type === type
                                                            ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                                                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                                    }`}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label>Date d'embauche</Label>
                                            <Input
                                                type="date"
                                                value={formData.hire_date}
                                                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                                                className="mt-1.5 rounded-xl"
                                            />
                                        </div>
                                        <div>
                                            <Label>RIB</Label>
                                            <Input
                                                value={formData.rib}
                                                onChange={(e) => setFormData({ ...formData, rib: e.target.value })}
                                                className="mt-1.5 rounded-xl"
                                            />
                                        </div>

                                        {/* Salaire/pointage only apply to salaried staff — freelancers are paid a lump sum per project instead (see the project's "Paiement freelance" block) */}
                                        {formData.contract_type === "Temps plein" && (
                                            <>
                                                <div>
                                                    <Label>Salaire de base</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        value={formData.base_salary}
                                                        onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                                                        placeholder="45000"
                                                        className="mt-1.5 rounded-xl"
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Code appareil</Label>
                                                    <Input
                                                        value={formData.external_code}
                                                        onChange={(e) => setFormData({ ...formData, external_code: e.target.value })}
                                                        placeholder="Numéro pointeuse"
                                                        className="mt-1.5 rounded-xl"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl">
                                    Annuler
                                </Button>
                                <Button type="submit" disabled={createEmployee.isPending || updateEmployee.isPending} className="rounded-xl">
                                    {editingEmployee ? "Modifier" : "Ajouter"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {employees?.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-muted-foreground bg-secondary/10 rounded-3xl border border-dashed border-border/50">
                        Aucun employé enregistré
                    </div>
                ) : (
                    employees?.map((emp) => (
                        <Card
                            key={emp.id}
                            onClick={() => navigate(`/employees/${emp.id}`)}
                            className="overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 rounded-3xl group relative cursor-pointer"
                        >
                            <CardContent className="p-6">
                                <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl">
                                            <DropdownMenuItem onClick={() => handleEdit(emp)}>
                                                <Pencil className="w-4 h-4 mr-2" />
                                                Modifier
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={() => {
                                                    setDeletingEmployeeId(emp.id);
                                                    setIsDeleteDialogOpen(true);
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Supprimer
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="flex items-start gap-4">
                                    <EmployeeAvatar photoPath={emp.photo_path} name={emp.name} className="h-16 w-16 text-xl" />
                                    <div className="flex-1 min-w-0 pr-6">
                                        <h3 className="font-bold text-lg text-foreground truncate">{emp.name}</h3>
                                        <p className="text-sm text-primary font-medium truncate">{emp.role || "Aucun rôle"}</p>
                                    </div>
                                </div>

                                <div className="mt-6 space-y-3">
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group/item">
                                        <Mail className="w-4 h-4 shrink-0" />
                                        <span className="truncate">{emp.email || "-"}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group/item">
                                        <Phone className="w-4 h-4 shrink-0" />
                                        <span>{emp.phone || "-"}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group/item">
                                        <MapPin className="w-4 h-4 shrink-0" />
                                        <span className="truncate">{emp.address || "-"}</span>
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
                        <AlertDialogTitle>Supprimer cet employé ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. Toutes les données liées à cet employé seront supprimées.
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

export default EmployeesSection;
