import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
    RiAddLine as Plus,
    RiPencilLine as Pencil,
    RiDeleteBinLine as Trash2,
    RiMoreFill as MoreHorizontal,
    RiGroupLine as ActiveIcon,
    RiArchiveLine as ArchivedIcon,
    RiWallet3Line as PayrollIcon,
    RiHandCoinLine as PaidIcon,
} from "@remixicon/react";
import { Card, CardContent, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Label, Input, Skeleton, EmptyState, SearchInput } from "@sordi/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { MetricStrip } from "@/components/ui/metric-strip";
import { useEmployees, useEmployeeHrStats, useEmployeePayrollSummaries } from "@/hooks/useEmployees";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { cn } from "@/lib/utils";

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(Math.round(amount)) + " DA";

const formatMonthLabel = (month: string) => {
    const [y, m] = month.split("-");
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};

const isEmployeeActive = (emp: { is_active: boolean | null }) => emp.is_active !== false;

type FilterTab = "all" | "active" | "inactive";

const EmployeesSection = () => {
    const navigate = useNavigate();
    const { data: employees, isLoading, createEmployee, updateEmployee, deleteEmployee } = useEmployees();
    const currentYear = String(new Date().getFullYear());
    const { data: hrStats } = useEmployeeHrStats(currentYear);
    const { data: payrollSummaries } = useEmployeePayrollSummaries();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<any>(null);
    const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<FilterTab>("all");
    const [search, setSearch] = useState("");

    const payrollByEmployee = useMemo(() => {
        const map = new Map<string, { total_paid: number; last_paid_month: string | null; last_paid_amount: number | null }>();
        for (const s of payrollSummaries ?? []) map.set(s.employee_id, s);
        return map;
    }, [payrollSummaries]);

    const activeEmployees = useMemo(() => (employees ?? []).filter(isEmployeeActive), [employees]);
    const inactiveEmployees = useMemo(() => (employees ?? []).filter((e) => !isEmployeeActive(e)), [employees]);

    const tabCounts: Record<FilterTab, number> = {
        all: employees?.length ?? 0,
        active: activeEmployees.length,
        inactive: inactiveEmployees.length,
    };

    const tabs: { key: FilterTab; label: string }[] = [
        { key: "all", label: "Tous" },
        { key: "active", label: "Actifs" },
        { key: "inactive", label: "Inactifs / Archivés" },
    ];

    const baseList = activeTab === "active" ? activeEmployees : activeTab === "inactive" ? inactiveEmployees : [...activeEmployees, ...inactiveEmployees];
    const query = search.trim().toLowerCase();
    const visibleEmployees = query ? baseList.filter((e) => e.name.toLowerCase().includes(query)) : baseList;

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
        is_active: true,
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
            is_active: true,
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
            is_active: isEmployeeActive(emp),
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error("Le nom complet est requis");
            return;
        }
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <Card key={i} className="rounded-2xl">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                                <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2 rounded-full" />
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-3">
                                <Skeleton className="h-3 flex-1" />
                                <Skeleton className="h-3 w-16 shrink-0" />
                            </div>
                        </CardContent>
                    </Card>
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
                                    {/* Only meaningful once the employee already exists — a brand
                                        new hire always starts active (see create_employee), so this
                                        toggle would be misleading on the create form. */}
                                    {editingEmployee && (
                                        <div>
                                            <Label>Statut</Label>
                                            <div className="flex items-center gap-1 p-1 mt-1.5 bg-secondary/30 w-fit rounded-xl border border-border/50">
                                                {([{ value: true, label: "Actif" }, { value: false, label: "Inactif" }] as const).map((opt) => (
                                                    <button
                                                        key={String(opt.value)}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, is_active: opt.value })}
                                                        className={`px-4 py-2 text-sm font-medium transition-all rounded-lg ${
                                                            formData.is_active === opt.value
                                                                ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                                                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
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
                                            <DatePicker
                                                presets={false}
                                                value={formData.hire_date}
                                                onChange={(v) => setFormData({ ...formData, hire_date: v })}
                                                className="mt-1.5"
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

            {/* Executive HR statistics — effectif actif/archivé, masse salariale
                courante et total réellement versé cette année, pour donner un
                aperçu financier immédiat avant de parcourir l'équipe. */}
            <MetricStrip
                cells={[
                    {
                        key: "active",
                        label: "Effectif Actif",
                        value: String(hrStats?.active_count ?? activeEmployees.length),
                        numericValue: hrStats?.active_count ?? activeEmployees.length,
                        format: (v) => String(Math.round(v)),
                        icon: ActiveIcon,
                    },
                    {
                        key: "archived",
                        label: "Collaborateurs Archivés",
                        value: String(hrStats?.inactive_count ?? inactiveEmployees.length),
                        numericValue: hrStats?.inactive_count ?? inactiveEmployees.length,
                        format: (v) => String(Math.round(v)),
                        icon: ArchivedIcon,
                    },
                    {
                        key: "monthly_payroll",
                        label: "Masse Salariale Mensuelle",
                        value: formatCurrency(hrStats?.monthly_payroll ?? 0),
                        numericValue: hrStats?.monthly_payroll ?? 0,
                        format: formatCurrency,
                        icon: PayrollIcon,
                        sublabel: "Salaires de base — équipe active",
                    },
                    {
                        key: "total_paid",
                        label: `Total Versé ${currentYear}`,
                        value: formatCurrency(hrStats?.total_paid_year ?? 0),
                        numericValue: hrStats?.total_paid_year ?? 0,
                        format: formatCurrency,
                        icon: PaidIcon,
                        sublabel: "Bulletins de paie réglés",
                    },
                ]}
            />

            {/* Segmented view (Tous/Actifs/Inactifs) + recherche en temps réel. */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all",
                                activeTab === t.key
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-card text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground"
                            )}
                        >
                            {t.label}
                            <span
                                className={cn(
                                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums",
                                    activeTab === t.key ? "bg-primary-foreground/20" : "bg-secondary text-foreground/70"
                                )}
                            >
                                {tabCounts[t.key]}
                            </span>
                        </button>
                    ))}
                </div>
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Rechercher un employé..."
                    containerClassName="w-full sm:w-64"
                />
            </div>

            {/* High-density team directory grid — active staff on a crisp white
                surface with an emerald "Actif" badge; archived staff recede on a
                muted slate surface with a gray "Archivé" badge and their lifetime
                payout instead of ongoing salary details. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {employees?.length === 0 ? (
                    <div className="col-span-full">
                        <EmptyState
                            type="employees"
                            title="Aucun employé"
                            description="Ajoutez votre premier employé pour commencer à suivre l'équipe"
                            action={{ label: "Ajouter", onClick: () => setIsDialogOpen(true) }}
                        />
                    </div>
                ) : visibleEmployees.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                        Aucun employé ne correspond à ces filtres.
                    </div>
                ) : (
                    visibleEmployees.map((emp) => {
                        const active = isEmployeeActive(emp);
                        const summary = payrollByEmployee.get(emp.id);
                        return (
                            <Card
                                key={emp.id}
                                onClick={() => navigate(`/employees/${emp.id}`)}
                                className={cn(
                                    "group relative rounded-2xl cursor-pointer transition-all duration-150",
                                    active
                                        ? "bg-card border-border/50 hover:border-primary/30"
                                        : "bg-slate-50/80 dark:bg-slate-900/30 border-border/30 opacity-75 hover:opacity-100"
                                )}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <EmployeeAvatar photoPath={emp.photo_path} name={emp.name} className="h-11 w-11 text-sm shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-sm text-foreground truncate">{emp.name}</h3>
                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary truncate max-w-full">
                                                    {emp.role || "Aucun rôle"}
                                                </span>
                                                {active ? (
                                                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                                                        Actif
                                                    </span>
                                                ) : (
                                                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60 dark:bg-muted dark:text-muted-foreground dark:border-border">
                                                        Archivé
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div
                                            className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full -mt-1 -mr-1">
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
                                    </div>

                                    {active ? (
                                        <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Salaire de base</span>
                                                <span className="font-semibold font-mono tabular-nums text-foreground">
                                                    {emp.base_salary != null ? formatCurrency(emp.base_salary) : "—"}
                                                </span>
                                            </div>
                                            <div className="text-xs">
                                                <span className="text-muted-foreground">Dernier versement</span>
                                                <div className="mt-0.5 font-medium text-foreground">
                                                    {summary?.last_paid_month
                                                        ? `${formatMonthLabel(summary.last_paid_month)} · ${formatCurrency(summary.last_paid_amount ?? 0)}`
                                                        : "Aucun"}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">Total versé</span>
                                            <span className="font-semibold font-mono tabular-nums text-foreground">
                                                {formatCurrency(summary?.total_paid ?? 0)}
                                            </span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })
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
                        <AlertDialogAction onClick={handleDelete} disabled={deleteEmployee.isPending} className="bg-destructive text-destructive-foreground rounded-xl">
                            {deleteEmployee.isPending ? "Suppression..." : "Supprimer"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default EmployeesSection;
