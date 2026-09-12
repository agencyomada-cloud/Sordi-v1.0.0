
import { useEffect, useMemo, useState } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useActiveCompany, useUpdateActiveCompany, getCompanyPhoneList, getCompanyExtraInfoList } from "@/hooks/useActiveCompany";
import { useResetToFactoryState } from "@/hooks/useSystemReset";
import type { CreateCompanyData } from "@/lib/database";
import { Button, Switch, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@sordi/ui";
import { cn, compressImage } from "@/lib/utils";
import { toast } from "sonner";
import {
  RiAddLine as Plus,
  RiLoader4Line as Loader2,
  RiSaveLine as Save,
  RiLockLine as Lock,
  RiShieldCheckLine as ShieldCheck,
  RiKeyLine as KeyRound,
  RiNotification3Line,
  RiVolumeUpLine,
  RiVolumeMuteLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiInformationLine,
  RiAlertLine,
  RiFolder3Line as FolderIcon,
  RiMailLine,
  RiDeleteBinLine as TrashIcon,
  RiDatabase2Line as DatabaseIcon,
  RiTeamLine,
  RiTruckLine,
  RiFolderChartLine,
  RiRadarLine as RadarIcon,
} from "@remixicon/react";
import { Building2, Paintbrush, Bell, Boxes, Sparkles, CheckCircle2 } from "lucide-react";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";
import { useTelemetryStatus, useSetTelemetryEnabled } from "@/hooks/useTelemetry";
import { invoke } from "@tauri-apps/api/core";
import { open as openDirDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { appDataDir, join } from "@tauri-apps/api/path";
import { notificationAudio } from "@/lib/notificationSound";
import { db } from "@/lib/database";
import { useQueryClient } from "@tanstack/react-query";
import { INVOICE_PDF_THEMES, INVOICE_PDF_FONTS } from "@/components/pdf/invoicePdfShared";
import { useSecureSession } from "@/hooks/useSecureSession";
import { MODULE_KEYS, useModuleFlags, setModuleEnabled, type ModuleKey } from "@/lib/moduleFlags";

const MODULE_META: Record<ModuleKey, { icon: React.ElementType; title: string; description: string }> = {
    hr: {
        icon: RiTeamLine,
        title: "Gestion RH & Pointage",
        description: "Équipe & Salaires et Employés & Contrats dans la barre latérale.",
    },
    deliveries: {
        icon: RiTruckLine,
        title: "Bons de livraison",
        description: "Suivi des livraisons clients dans la barre latérale.",
    },
    projects: {
        icon: RiFolderChartLine,
        title: "Projets & Contrats",
        description: "Gestion de projets et contrats dans la barre latérale.",
    },
};

const emptyCompanyForm: CreateCompanyData = {
    name: "",
    logo_base64: "",
    activity: "",
    legal_form: "",
    rc: "",
    nif: "",
    nis: "",
    article_imposition: "",
    cnas_adherent: "",
    rib: "",
    capital: "50 000 000DA",
    bank_agency: "",
    website: "",
    phone: "",
    phones: "",
    email: "",
    address: "",
    extra_info: "",
};

const LEGAL_FORMS = ["EURL", "SARL", "SPA", "SNC", "Auto-entrepreneur", "Personne physique / Établissement individuel"];

type Category = "identity" | "appearance" | "security" | "notifications" | "telemetry" | "modules";

const NAV_ITEMS: { key: Category; label: string; icon: React.ElementType }[] = [
    { key: "identity", label: "Identité & Entreprise", icon: Building2 },
    { key: "appearance", label: "Apparence & Documents", icon: Paintbrush },
    { key: "security", label: "Sécurité & Session", icon: ShieldCheck },
    { key: "notifications", label: "Notifications & Alertes", icon: Bell },
    { key: "telemetry", label: "Télémétrie & Diagnostics", icon: RadarIcon },
    { key: "modules", label: "Modules Optionnels", icon: Boxes },
];

/** macOS System Settings "grouped inset" card — a titled section with a
 *  hairline-divided body, replacing the old shadcn Card/CardHeader/
 *  CardTitle/CardDescription/CardContent stack everywhere on this page. */
function SettingsGroup({ title, description, children, tone }: { title: string; description?: React.ReactNode; children: React.ReactNode; tone?: "destructive" }) {
    return (
        <div className={cn("bg-card border rounded-md overflow-hidden mb-6", tone === "destructive" ? "border-destructive/40" : "border-border/80")}>
            <div className="px-4 py-3 border-b border-border/60">
                <h3 className={cn("text-xs font-semibold", tone === "destructive" ? "text-destructive" : "text-foreground")}>{title}</h3>
                {description && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
            </div>
            <div className="p-4 space-y-4">
                {children}
            </div>
        </div>
    );
}

/** One label-left/control-right row inside a SettingsGroup — the plain
 *  "single input" fields use this; rows with bespoke content (file uploads,
 *  theme pickers, dynamic lists) keep their own layout instead. */
function SettingsRow({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-6 -mx-4 px-4 py-1 hover:bg-muted/20 transition-colors rounded-sm">
            <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">{label}</p>
                {helper && <p className="text-[11px] text-muted-foreground mt-0.5">{helper}</p>}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

const rowInputClass = "h-8 w-72 text-xs bg-background border-border rounded-md px-2.5 focus-visible:ring-1";

export default function SettingsPage() {
    const { data: settings, isLoading } = useSettings();
    const updateSettings = useUpdateSettings();
    const { company, isReady: isCompanyReady } = useActiveCompany();
    const updateActiveCompany = useUpdateActiveCompany();
    const { executeSecuredAction } = useSecureSession();
    const resetToFactoryState = useResetToFactoryState();
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [resetConfirmText, setResetConfirmText] = useState("");
    const [isSeedingDemo, setIsSeedingDemo] = useState(false);
    const [isClearingDemo, setIsClearingDemo] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [lastBackupInfo, setLastBackupInfo] = useState<{ timestamp: string; size: number } | null>(null);
    const [restoreSourcePath, setRestoreSourcePath] = useState<string | null>(null);
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [companyFormData, setCompanyFormData] = useState<CreateCompanyData>(emptyCompanyForm);
    const [companyFormHydrated, setCompanyFormHydrated] = useState(false);
    // `formData` starts as hardcoded empty defaults and is only populated
    // from the real `settings` by the effect below — that effect fires one
    // commit after `isLoading` first flips to false, so there's a narrow
    // window where the form is visible/interactive but `formData` is still
    // empty. Saving in that window would silently overwrite real saved
    // values (e.g. stamp/signature images) with blanks. This flag closes
    // that window by keeping the submit button disabled until the first
    // hydration from `settings` has actually happened.
    const [formHydrated, setFormHydrated] = useState(false);
    const queryClient = useQueryClient();
    const [soundEnabled, setSoundEnabled] = useState(() => notificationAudio.isEnabled());
    const { data: telemetryStatus } = useTelemetryStatus();
    const setTelemetryEnabled = useSetTelemetryEnabled();
    const moduleFlags = useModuleFlags();
    const [activeCategory, setActiveCategory] = useState<Category>("identity");
    const { data: updateInfo } = useUpdateCheck();

    const [formData, setFormData] = useState({
        payroll_prime_panier_taux: "",
        payroll_prime_transport: "",
        primary_color: "#0067F2",
        logo_bg_color: "#000000",
        logo_text_color: "#FFFFFF",
        logo_size: "64",
        company_info_size: "9",
        stamp_data: "",
        stamp_size: "96",
        signature_data: "",
        signature_size: "96",
        body_pattern_data: "",
        qr_code_data: "",
        invoice_pdf_theme: "structure",
        invoice_pdf_font: "montserrat",
        pdf_backup_directory: "",
    });

    // Snapshots of the last-saved state — compared against the live form
    // state below to drive the sticky "unsaved changes" bar and the header's
    // "✓ Enregistré" indicator, instead of a floating save button that's
    // always visible whether or not there's anything to save.
    const [savedSnapshot, setSavedSnapshot] = useState<{ formData: typeof formData; companyFormData: CreateCompanyData } | null>(null);

    const [extraInfoList, setExtraInfoList] = useState<string[]>([]);
    const [phoneList, setPhoneList] = useState<string[]>([]);
    const [securityData, setSecurityData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [emailSettingsData, setEmailSettingsData] = useState({
        smtp_email: "",
        smtp_app_password: "",
    });

    useEffect(() => {
        if (settings) {
            // Pick only the string fields this form actually owns, instead
            // of spreading the whole `settings` object: `settings` also
            // carries company_* fields mapped in from the active company
            // (see companyToSettingsFields in useSettings.ts), and
            // `company_phones` there is a string[], not a string. Spreading
            // it into formData meant the Save button later sent that array
            // to the Rust `update_settings` command, which expects
            // HashMap<String, String> — the array fails deserialization,
            // the whole save silently falls back to a no-op mock, and every
            // field in the form (including a freshly uploaded stamp/logo)
            // appeared to save but was never actually written to disk.
            setFormData(prev => {
                const next = {
                    ...prev,
                    payroll_prime_panier_taux: settings.payroll_prime_panier_taux ?? prev.payroll_prime_panier_taux,
                    payroll_prime_transport: settings.payroll_prime_transport ?? prev.payroll_prime_transport,
                    primary_color: settings.primary_color ?? prev.primary_color,
                    logo_bg_color: settings.logo_bg_color ?? prev.logo_bg_color,
                    logo_text_color: settings.logo_text_color ?? prev.logo_text_color,
                    logo_size: settings.logo_size ?? prev.logo_size,
                    company_info_size: settings.company_info_size ?? prev.company_info_size,
                    stamp_data: settings.stamp_data ?? prev.stamp_data,
                    stamp_size: settings.stamp_size ?? prev.stamp_size,
                    signature_data: settings.signature_data ?? prev.signature_data,
                    signature_size: settings.signature_size ?? prev.signature_size,
                    body_pattern_data: settings.body_pattern_data ?? prev.body_pattern_data,
                    qr_code_data: settings.qr_code_data ?? prev.qr_code_data,
                    invoice_pdf_theme: settings.invoice_pdf_theme ?? prev.invoice_pdf_theme,
                    invoice_pdf_font: settings.invoice_pdf_font ?? prev.invoice_pdf_font,
                    pdf_backup_directory: settings.pdf_backup_directory ?? prev.pdf_backup_directory,
                };
                return next;
            });
            setFormHydrated(true);
        }
    }, [settings]);

    useEffect(() => {
        if (company) {
            setCompanyFormData({
                name: company.name,
                logo_base64: company.logo_base64 || "",
                activity: company.activity || "",
                legal_form: company.legal_form || "",
                rc: company.rc || "",
                nif: company.nif || "",
                nis: company.nis || "",
                article_imposition: company.article_imposition || "",
                cnas_adherent: company.cnas_adherent || "",
                rib: company.rib || "",
                capital: company.capital || "",
                bank_agency: company.bank_agency || "",
                website: company.website || "",
                phone: company.phone || "",
                phones: company.phones || "",
                email: company.email || "",
                address: company.address || "",
                extra_info: company.extra_info || "",
            });
            setCompanyFormHydrated(true);
            setPhoneList(getCompanyPhoneList(company));
            setExtraInfoList(getCompanyExtraInfoList(company));
        }
    }, [company]);

    useEffect(() => {
        if (settings) {
            setEmailSettingsData({
                smtp_email: settings.smtp_email || "",
                smtp_app_password: settings.smtp_app_password || "",
            });
        }
    }, [settings]);

    // Once both halves have hydrated for the first time, that's the
    // baseline "nothing to save yet" snapshot — recomputed after every
    // successful save below, never on every keystroke (that would make
    // the form look clean the instant you finish hydrating it, correctly
    // once, and then immediately stop tracking further edits against it).
    useEffect(() => {
        if (formHydrated && companyFormHydrated && !savedSnapshot) {
            setSavedSnapshot({ formData, companyFormData });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formHydrated, companyFormHydrated]);

    const isDirty = useMemo(() => {
        if (!savedSnapshot) return false;
        return (
            JSON.stringify(formData) !== JSON.stringify(savedSnapshot.formData) ||
            JSON.stringify(companyFormData) !== JSON.stringify(savedSnapshot.companyFormData)
        );
    }, [formData, companyFormData, savedSnapshot]);

    const handleDiscardChanges = () => {
        if (!savedSnapshot) return;
        setFormData(savedSnapshot.formData);
        setCompanyFormData(savedSnapshot.companyFormData);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setCompanyFormData(prev => ({ ...prev, [name]: value }));
    };

    const addExtraInfo = () => {
        const newList = [...extraInfoList, ""];
        setExtraInfoList(newList);
        handleExtraInfoChange(newList);
    };

    const removeExtraInfo = (index: number) => {
        const newList = [...extraInfoList];
        newList.splice(index, 1);
        setExtraInfoList(newList);
        handleExtraInfoChange(newList);
    };

    const updateExtraInfo = (index: number, value: string) => {
        const newList = [...extraInfoList];
        newList[index] = value;
        setExtraInfoList(newList);
        handleExtraInfoChange(newList);
    };

    const handleExtraInfoChange = (list: string[]) => {
        setCompanyFormData((prev) => ({
            ...prev,
            extra_info: JSON.stringify(list)
        }));
    };

    const handlePickBackupDirectory = async () => {
        const picked = await openDirDialog({ directory: true, multiple: false });
        if (typeof picked === "string") {
            setFormData(prev => ({ ...prev, pdf_backup_directory: picked }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // formData/companyFormData haven't been hydrated from the real
        // settings/company yet — saving now would overwrite everything
        // (including uploaded stamp/signature images, or the company's
        // fiscal identity) with the hardcoded empty defaults they started
        // from.
        if (!formHydrated || !companyFormHydrated) return;

        await executeSecuredAction(() => {
            updateSettings.mutate(formData, {
                onError: () => {
                    toast.error("Erreur lors de l'enregistrement");
                }
            });
            updateActiveCompany.mutate(companyFormData, {
                onSuccess: () => {
                    toast.success("Paramètres enregistrés avec succès");
                    setSavedSnapshot({ formData, companyFormData });
                },
                onError: () => {
                    toast.error("Erreur lors de l'enregistrement de l'entreprise");
                }
            });
        }, "Autoriser la modification des coordonnées légales et bancaires");
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!securityData.currentPassword || !securityData.newPassword || !securityData.confirmPassword) {
            toast.error("Veuillez remplir tous les champs");
            return;
        }

        if (securityData.newPassword !== securityData.confirmPassword) {
            toast.error("Les nouveaux mots de passe ne correspondent pas");
            return;
        }

        setIsUpdatingPassword(true);
        try {
            const isValid = await invoke<boolean>('check_password', { password: securityData.currentPassword });
            if (!isValid) {
                toast.error("Mot de passe actuel incorrect");
                return;
            }

            await invoke('set_password', { newPassword: securityData.newPassword });
            toast.success("Mot de passe mis à jour avec succès");
            setSecurityData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch (err) {
            toast.error("Erreur lors de la mise à jour du mot de passe");
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const resetConfirmTarget = company?.name || "";
    const canConfirmReset = resetConfirmTarget.length > 0 && resetConfirmText.trim() === resetConfirmTarget;

    const handleConfirmReset = () => {
        if (!canConfirmReset) return;
        resetToFactoryState.mutate(undefined, {
            onSuccess: () => {
                setResetDialogOpen(false);
                setResetConfirmText("");
            },
        });
    };

    // Invalidates every list this demo data touches so the UI reflects the
    // seed/clear immediately without a manual refresh.
    const invalidateDemoDataQueries = () => {
        ["clients", "products", "invoices", "expenses", "dashboard"].forEach((key) => {
            queryClient.invalidateQueries({ queryKey: [key] });
        });
    };

    const handleSeedDemoData = async () => {
        if (!company?.id) return;
        setIsSeedingDemo(true);
        try {
            const message = await invoke<string>("seed_demo_data", { companyId: company.id });
            toast.success("Données de démonstration créées", { description: message });
            invalidateDemoDataQueries();
        } catch (err) {
            toast.error("Erreur lors de la création des données de démonstration", {
                description: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setIsSeedingDemo(false);
        }
    };

    const handleClearDemoData = async () => {
        if (!company?.id) return;
        setIsClearingDemo(true);
        try {
            const message = await invoke<string>("clear_demo_data", { companyId: company.id });
            toast.success("Données de démonstration supprimées", { description: message });
            invalidateDemoDataQueries();
        } catch (err) {
            toast.error("Erreur lors de la suppression des données de démonstration", {
                description: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setIsClearingDemo(false);
        }
    };

    const refreshLastBackupInfo = async () => {
        try {
            const info = await db.database.getLastBackupInfo();
            setLastBackupInfo(info ? { timestamp: info[0], size: info[1] } : null);
        } catch {
            // Best-effort readout — leave the last known value on screen.
        }
    };

    useEffect(() => {
        refreshLastBackupInfo();
    }, []);

    const handleBackupNow = async () => {
        // "User-chosen folder" per spec: pick a destination directory via
        // the native dialog, then write a timestamped file into it — rather
        // than a bare "export" that always lands in the app's own backups/
        // folder with no say from the user.
        const folder = await openDirDialog({ directory: true, multiple: false, title: "Choisir un dossier de sauvegarde" });
        if (!folder || Array.isArray(folder)) return;

        setIsBackingUp(true);
        try {
            const timestamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
            const destPath = await join(folder, `sordi_backup_manuel_${timestamp}.db`);
            const path = await db.database.backup(destPath);
            const filename = path.split(/[\\/]/).pop() || path;
            const displayTimestamp = new Date().toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "medium" });
            toast.success(`Sauvegarde créée : ${filename}`, { description: `${path} — ${displayTimestamp}` });
            refreshLastBackupInfo();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error("Échec de la sauvegarde de la base de données", { description: message });
        } finally {
            setIsBackingUp(false);
        }
    };

    const handlePickRestoreFile = async () => {
        const picked = await openDirDialog({
            directory: false,
            multiple: false,
            title: "Choisir une sauvegarde à restaurer",
            filters: [{ name: "Base de données Sordi", extensions: ["db"] }],
        });
        if (!picked || Array.isArray(picked)) return;
        setRestoreSourcePath(picked);
        setRestoreDialogOpen(true);
    };

    const handleConfirmRestore = async () => {
        if (!restoreSourcePath) return;
        setIsRestoring(true);
        try {
            toast.info("Restauration en cours — l'application va redémarrer...");
            await db.database.restore(restoreSourcePath);
        } catch (error) {
            // The app restarting mid-request can surface as a rejected
            // promise even on success (the IPC channel drops) — only show
            // an error if it's clearly something else (e.g. file missing).
            const message = error instanceof Error ? error.message : String(error);
            if (message && !message.toLowerCase().includes("restart")) {
                toast.error("Échec de la restauration", { description: message });
            }
        } finally {
            setIsRestoring(false);
            setRestoreDialogOpen(false);
            setRestoreSourcePath(null);
        }
    };

    const handleOpenBackupsFolder = async () => {
        try {
            const dataDir = await appDataDir();
            const backupsDir = await join(dataDir, "backups");
            await openPath(backupsDir);
        } catch {
            toast.error("Impossible d'ouvrir le dossier des sauvegardes", {
                description: "Aucune sauvegarde n'a peut-être encore été créée — cliquez d'abord sur « Exporter une sauvegarde ».",
            });
        }
    };

    const handleEmailSettingsSave = (e: React.FormEvent) => {
        e.preventDefault();
        updateSettings.mutate(
            { smtp_email: emailSettingsData.smtp_email, smtp_app_password: emailSettingsData.smtp_app_password },
            {
                onSuccess: () => toast.success("Paramètres d'envoi d'emails enregistrés"),
                onError: () => toast.error("Erreur lors de l'enregistrement"),
            }
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const activeNav = NAV_ITEMS.find((n) => n.key === activeCategory)!;
    // The identity/appearance categories share one form (see handleSubmit)
    // — the other categories own their own separate <form> nested inside
    // their content, so the outer form must not wrap them (invalid nested
    // <form> tags).
    const isFormCategory = activeCategory === "identity" || activeCategory === "appearance";

    const categoryDescriptions: Record<Category, string> = {
        identity: "Coordonnées légales, bancaires et fiscales imprimées sur vos documents.",
        appearance: "Thème, police, logo, cachet et signature utilisés sur vos factures.",
        security: "Mot de passe, sauvegardes de la base de données et zone dangereuse.",
        notifications: "Retours sonores et envoi d'emails (Gmail / SMTP).",
        modules: "Activez les modules secondaires dont vous avez besoin.",
    };

    const content = (
        <>
            {activeCategory === "identity" && (
                <SettingsGroup title="Identité de l'entreprise" description="Ces informations apparaîtront sur vos factures et documents officiels.">
                    <SettingsRow label="Nom de l'entreprise">
                        <Input id="name" name="name" value={companyFormData.name} onChange={handleCompanyChange} className={rowInputClass} />
                    </SettingsRow>
                    <SettingsRow label="Forme juridique">
                        <Select
                            value={companyFormData.legal_form || ""}
                            onValueChange={(value) => setCompanyFormData(prev => ({ ...prev, legal_form: value }))}
                        >
                            <SelectTrigger className={rowInputClass}>
                                <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                            <SelectContent>
                                {LEGAL_FORMS.map((form) => (
                                    <SelectItem key={form} value={form}>{form}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingsRow>
                    <SettingsRow label="Adresse complète">
                        <Input id="address" name="address" value={companyFormData.address ?? ""} onChange={handleCompanyChange} className={rowInputClass} />
                    </SettingsRow>
                    <SettingsRow label="RC">
                        <Input id="rc" name="rc" value={companyFormData.rc ?? ""} onChange={handleCompanyChange} className={rowInputClass} />
                    </SettingsRow>
                    <SettingsRow label="NIF">
                        <Input id="nif" name="nif" value={companyFormData.nif ?? ""} onChange={handleCompanyChange} className={rowInputClass} />
                    </SettingsRow>
                    <SettingsRow label="NIS">
                        <Input id="nis" name="nis" value={companyFormData.nis ?? ""} onChange={handleCompanyChange} className={rowInputClass} />
                    </SettingsRow>
                    <SettingsRow label="Article d'Imposition (AI)">
                        <Input id="article_imposition" name="article_imposition" value={companyFormData.article_imposition ?? ""} onChange={handleCompanyChange} className={rowInputClass} />
                    </SettingsRow>
                    <SettingsRow label="N° Adhérent CNAS">
                        <Input id="cnas_adherent" name="cnas_adherent" value={companyFormData.cnas_adherent ?? ""} onChange={handleCompanyChange} className={rowInputClass} />
                    </SettingsRow>
                    <SettingsRow label="Capital Social">
                        <Input id="capital" name="capital" value={companyFormData.capital ?? ""} onChange={handleCompanyChange} className={rowInputClass} />
                    </SettingsRow>
                    <SettingsRow label="Site Web">
                        <Input id="website" name="website" value={companyFormData.website ?? ""} onChange={handleCompanyChange} className={rowInputClass} />
                    </SettingsRow>
                    <SettingsRow label="Email">
                        <Input id="email" name="email" value={companyFormData.email ?? ""} onChange={handleCompanyChange} placeholder="contact@..." className={rowInputClass} />
                    </SettingsRow>
                </SettingsGroup>
            )}

            {activeCategory === "identity" && (
                <SettingsGroup title="Coordonnées bancaires">
                    <SettingsRow label="RIB (Compte Bancaire)">
                        <Input id="rib" name="rib" value={companyFormData.rib ?? ""} onChange={handleCompanyChange} className={cn(rowInputClass, "font-mono")} />
                    </SettingsRow>
                    <SettingsRow label="Agence Bancaire">
                        <Input id="bank_agency" name="bank_agency" value={companyFormData.bank_agency ?? ""} onChange={handleCompanyChange} className={rowInputClass} />
                    </SettingsRow>
                </SettingsGroup>
            )}

            {activeCategory === "identity" && (
                <SettingsGroup title="Indemnités de paie" description="Utilisées par les bulletins de paie (module RH).">
                    <SettingsRow label="Indemnité de panier — taux journalier (DA)">
                        <Input id="payroll_prime_panier_taux" name="payroll_prime_panier_taux" type="number" min="0" value={formData.payroll_prime_panier_taux} onChange={handleChange} className={rowInputClass} />
                    </SettingsRow>
                    <SettingsRow label="Indemnité de transport — montant mensuel (DA)">
                        <Input id="payroll_prime_transport" name="payroll_prime_transport" type="number" min="0" value={formData.payroll_prime_transport} onChange={handleChange} className={rowInputClass} />
                    </SettingsRow>
                </SettingsGroup>
            )}

            {activeCategory === "identity" && (
                <SettingsGroup title="Téléphones">
                    <div className="flex justify-end -mt-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => setPhoneList([...phoneList, ""])} className="h-6 text-[11px] gap-1">
                            <Plus className="w-3 h-3" /> Ajouter
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {phoneList.map((ph, idx) => (
                            <div key={idx} className="flex gap-2">
                                <Input
                                    value={ph}
                                    onChange={(e) => {
                                        const updated = [...phoneList];
                                        updated[idx] = e.target.value;
                                        setPhoneList(updated);
                                        const filtered = updated.filter(Boolean);
                                        setCompanyFormData(prev => ({
                                            ...prev,
                                            phones: JSON.stringify(filtered),
                                            phone: filtered.join(", ")
                                        }));
                                    }}
                                    placeholder="Ex: 0550 00 00 00"
                                    className="h-8 text-xs max-w-sm"
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => {
                                    const updated = phoneList.filter((_, i) => i !== idx);
                                    setPhoneList(updated);
                                    const filtered = updated.filter(Boolean);
                                    setCompanyFormData(prev => ({
                                        ...prev,
                                        phones: JSON.stringify(filtered),
                                        phone: filtered.join(", ")
                                    }));
                                }} className="text-muted-foreground hover:text-destructive h-8 w-8">
                                    <span className="sr-only">Supprimer</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </Button>
                            </div>
                        ))}
                        {phoneList.length === 0 && (
                            <Input
                                value={companyFormData.phone ?? ""}
                                onChange={(e) => {
                                    handleCompanyChange(e);
                                    setPhoneList([e.target.value]);
                                }}
                                placeholder="+213 ..."
                                className="h-8 text-xs max-w-sm"
                            />
                        )}
                    </div>
                </SettingsGroup>
            )}

            {activeCategory === "identity" && (
                <SettingsGroup title="Informations complémentaires" description="Ces informations s'afficheront en dessous de votre RC/NIF/NIS.">
                    <div className="flex justify-end -mt-1">
                        <Button type="button" variant="outline" size="sm" onClick={addExtraInfo} className="h-6 text-[11px] gap-1">
                            <Plus className="w-3 h-3" /> Ajouter
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {extraInfoList.map((info, index) => (
                            <div key={index} className="flex gap-2">
                                <Input
                                    value={info}
                                    onChange={(e) => updateExtraInfo(index, e.target.value)}
                                    placeholder="Ex: Capital social: 100.000 DA"
                                    className="h-8 text-xs max-w-sm"
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeExtraInfo(index)} className="text-muted-foreground hover:text-destructive h-8 w-8">
                                    <span className="sr-only">Supprimer</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </Button>
                            </div>
                        ))}
                        {extraInfoList.length === 0 && (
                            <p className="text-xs text-muted-foreground italic py-1">Aucune information complémentaire.</p>
                        )}
                    </div>
                </SettingsGroup>
            )}

            {activeCategory === "appearance" && (
                <SettingsGroup title="Thème de la facture PDF" description="Choisissez la mise en page utilisée pour générer vos factures, bons de livraison et commandes.">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {INVOICE_PDF_THEMES.map((theme) => {
                            const isSelected = (formData.invoice_pdf_theme || "structure") === theme.value;
                            return (
                                <button
                                    key={theme.value}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, invoice_pdf_theme: theme.value }))}
                                    className={cn(
                                        "text-left rounded-md border p-3 transition-all",
                                        isSelected
                                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                                            : "border-border hover:border-primary/40 hover:bg-muted/30"
                                    )}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-semibold text-foreground">{theme.label}</span>
                                        {isSelected && (
                                            <span className="w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center shrink-0">
                                                <RiCheckLine className="w-2.5 h-2.5 text-primary-foreground" />
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">{theme.description}</p>
                                </button>
                            );
                        })}
                    </div>
                </SettingsGroup>
            )}

            {activeCategory === "appearance" && (
                <SettingsGroup title="Police" description="Choisissez la police de caractères utilisée dans vos factures, bons de livraison et commandes.">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {INVOICE_PDF_FONTS.map((font) => {
                            const isSelected = (formData.invoice_pdf_font || "montserrat") === font.value;
                            return (
                                <button
                                    key={font.value}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, invoice_pdf_font: font.value }))}
                                    className={cn(
                                        "text-left rounded-md border p-3 transition-all",
                                        isSelected
                                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                                            : "border-border hover:border-primary/40 hover:bg-muted/30"
                                    )}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-sm font-semibold text-foreground" style={{ fontFamily: font.label }}>{font.label}</span>
                                        {isSelected && (
                                            <span className="w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center shrink-0">
                                                <RiCheckLine className="w-2.5 h-2.5 text-primary-foreground" />
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">{font.description}</p>
                                </button>
                            );
                        })}
                    </div>
                </SettingsGroup>
            )}

            {activeCategory === "appearance" && (
                <SettingsGroup title="Sauvegarde PDF automatique" description={<>Chaque facture, bon de commande ou bon de livraison généré est automatiquement enregistré dans ce dossier, sous <span className="font-mono">Client / Client - Numéro.pdf</span>.</>}>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-background text-xs text-muted-foreground overflow-hidden">
                            <FolderIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{formData.pdf_backup_directory || "Aucun dossier sélectionné"}</span>
                        </div>
                        <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={handlePickBackupDirectory}>
                            Choisir un dossier
                        </Button>
                    </div>
                </SettingsGroup>
            )}

            {activeCategory === "appearance" && (
                <SettingsGroup title="Personnalisation des documents" description="Personnalisez les couleurs et le logo de vos factures.">
                    <SettingsRow label="Couleur de la barre supérieure">
                        <div className="flex gap-2">
                            <Input
                                type="color"
                                id="primary_color"
                                name="primary_color"
                                value={formData.primary_color}
                                onChange={handleChange}
                                className="w-8 h-8 p-1 cursor-pointer rounded-md"
                            />
                            <Input
                                type="text"
                                name="primary_color"
                                value={formData.primary_color}
                                onChange={handleChange}
                                className="font-mono uppercase h-8 w-32 text-xs"
                            />
                        </div>
                    </SettingsRow>

                    <div className="pt-2 border-t border-border/60">
                        <p className="text-xs font-medium text-foreground mb-2">Logo de l'entreprise</p>
                        <div className="flex gap-4 items-start">
                            <Input
                                key={companyFormData.logo_base64 ? "has-logo" : "no-logo"}
                                id="logo_upload"
                                type="file"
                                accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                                className="h-8 text-xs"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = async () => {
                                            const base64String = reader.result as string;
                                            const compressed = await compressImage(base64String, 400); // 400px width is plenty for PDF
                                            setCompanyFormData(prev => ({ ...prev, logo_base64: compressed }));
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                            {companyFormData.logo_base64 && (
                                <div className="flex items-center gap-3 ml-2 shrink-0">
                                    <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">✓ Déjà existant</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs"
                                        onClick={() => setCompanyFormData(prev => ({ ...prev, logo_base64: "" }))}
                                    >
                                        Supprimer le logo
                                    </Button>
                                </div>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1.5">Format supporté : PNG, JPG. Sans logo, un en-tête typographique sera utilisé.</p>
                    </div>

                    <SettingsRow label="Taille du logo (hauteur en px)">
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                id="logo_size"
                                name="logo_size"
                                value={formData.logo_size || "64"}
                                onChange={handleChange}
                                className="w-20 h-8 text-xs"
                                min="32"
                                max="400"
                            />
                            <span className="text-[11px] text-muted-foreground">px</span>
                        </div>
                    </SettingsRow>

                    <SettingsRow label="Taille texte informations entreprise">
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                id="company_info_size"
                                name="company_info_size"
                                value={formData.company_info_size || "9"}
                                onChange={handleChange}
                                className="w-20 h-8 text-xs"
                                min="6"
                                max="16"
                            />
                            <span className="text-[11px] text-muted-foreground">px</span>
                        </div>
                    </SettingsRow>

                    <div className="mt-2 border border-border/60 p-6 rounded-md bg-muted/20 flex justify-center">
                        {/* Preview of the Logo Area */}
                        <div className="flex items-center gap-3">
                            {companyFormData.logo_base64 ? (
                                <img
                                    src={companyFormData.logo_base64}
                                    alt="Logo"
                                    className="object-contain"
                                    style={{
                                        width: `${formData.logo_size || 160}px`,
                                        maxHeight: "100px"
                                    }}
                                />
                            ) : (
                                <div className="text-lg font-bold p-2 bg-muted rounded-md min-h-[40px] min-w-[100px] flex items-center justify-center">
                                    {companyFormData.name || ""}
                                </div>
                            )}
                        </div>
                    </div>
                </SettingsGroup>
            )}

            {activeCategory === "appearance" && (
                <SettingsGroup title="Cachet et Signature" description="Ajoutez votre cachet électronique et votre signature pour qu'ils apparaissent sur les documents.">
                    {/* Cachet Électronique */}
                    <div>
                        <p className="text-xs font-medium text-foreground mb-2">Cachet électronique</p>
                        <div className="flex gap-4 items-start">
                            <Input
                                key={formData.stamp_data ? "has-stamp" : "no-stamp"}
                                id="stamp_upload"
                                type="file"
                                accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                                className="h-8 text-xs"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = async () => {
                                            const base64String = reader.result as string;
                                            const compressed = await compressImage(base64String, 300);
                                            setFormData(prev => ({ ...prev, stamp_data: compressed }));
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                            {formData.stamp_data && (
                                <div className="flex items-center gap-3 ml-2 shrink-0">
                                    <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">✓ Déjà existant</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs"
                                        onClick={() => setFormData(prev => ({ ...prev, stamp_data: "" }))}
                                    >
                                        Retirer / Mettre à jour
                                    </Button>
                                </div>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1.5">Format supporté : PNG (fond transparent recommandé), JPG.</p>
                    </div>

                    <SettingsRow label="Taille du cachet (hauteur en px)">
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                id="stamp_size"
                                name="stamp_size"
                                value={formData.stamp_size || "96"}
                                onChange={handleChange}
                                className="w-20 h-8 text-xs"
                                min="32"
                                max="400"
                            />
                            <span className="text-[11px] text-muted-foreground">px</span>
                        </div>
                    </SettingsRow>

                    {formData.stamp_data && (
                        <div className="border border-border/60 p-4 rounded-md bg-muted/20 flex justify-center">
                            <div className="text-center">
                                <img
                                    src={formData.stamp_data}
                                    alt="Cachet"
                                    style={{
                                        height: formData.stamp_size ? `${formData.stamp_size}px` : "96px",
                                        maxWidth: 'none'
                                    }}
                                    className="object-contain mx-auto"
                                />
                                <p className="text-[11px] text-muted-foreground mt-2">Aperçu du cachet</p>
                            </div>
                        </div>
                    )}

                    {/* Signature */}
                    <div className="pt-4 border-t border-border/60">
                        <p className="text-xs font-medium text-foreground mb-2">Signature</p>
                        <div className="flex gap-4 items-start">
                            <Input
                                key={formData.signature_data ? "has-signature" : "no-signature"}
                                id="signature_upload"
                                type="file"
                                accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                                className="h-8 text-xs"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = async () => {
                                            const base64String = reader.result as string;
                                            const compressed = await compressImage(base64String, 300);
                                            setFormData(prev => ({ ...prev, signature_data: compressed }));
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                            {formData.signature_data && (
                                <div className="flex items-center gap-3 ml-2 shrink-0">
                                    <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">✓ Déjà existant</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs"
                                        onClick={() => setFormData(prev => ({ ...prev, signature_data: "" }))}
                                    >
                                        Retirer / Mettre à jour
                                    </Button>
                                </div>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1.5">Format supporté : PNG (fond transparent recommandé), JPG.</p>
                    </div>

                    <SettingsRow label="Taille de la signature (hauteur en px)">
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                id="signature_size"
                                name="signature_size"
                                value={formData.signature_size || "96"}
                                onChange={handleChange}
                                className="w-20 h-8 text-xs"
                                min="32"
                                max="400"
                            />
                            <span className="text-[11px] text-muted-foreground">px</span>
                        </div>
                    </SettingsRow>

                    {formData.signature_data && (
                        <div className="border border-border/60 p-4 rounded-md bg-muted/20 flex justify-center">
                            <div className="text-center">
                                <img
                                    src={formData.signature_data}
                                    alt="Signature"
                                    style={{
                                        height: formData.signature_size ? `${formData.signature_size}px` : "96px",
                                        maxWidth: 'none'
                                    }}
                                    className="object-contain mx-auto"
                                />
                                <p className="text-[11px] text-muted-foreground mt-2">Aperçu de la signature</p>
                            </div>
                        </div>
                    )}
                </SettingsGroup>
            )}

            {activeCategory === "appearance" && (
                <SettingsGroup title="Éléments visuels" description="Ajoutez le motif d'arrière-plan (Pattern Body) et le Code QR pour personnaliser entièrement le modèle.">
                    {/* Pattern Body Background Image */}
                    <div>
                        <p className="text-xs font-medium text-foreground mb-2">Motif d'arrière-plan / Pattern Body</p>
                        <div className="flex gap-4 items-start">
                            <Input
                                key={formData.body_pattern_data ? "has-body-pattern" : "no-body-pattern"}
                                id="body_pattern_upload"
                                type="file"
                                accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                                className="h-8 text-xs"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = async () => {
                                            const base64String = reader.result as string;
                                            const compressed = await compressImage(base64String, 500);
                                            setFormData(prev => ({ ...prev, body_pattern_data: compressed }));
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                            {formData.body_pattern_data && (
                                <div className="flex items-center gap-3 ml-2 shrink-0">
                                    <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">✓ Déjà existant</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs"
                                        onClick={() => setFormData(prev => ({ ...prev, body_pattern_data: "" }))}
                                    >
                                        Retirer / Mettre à jour
                                    </Button>
                                </div>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1.5">Image d'arrière-plan décorative pour le corps de la facture.</p>
                    </div>

                    {/* QR Code Image */}
                    <div className="pt-4 border-t border-border/60">
                        <p className="text-xs font-medium text-foreground mb-2">Code QR (pied de page)</p>
                        <div className="flex gap-4 items-start">
                            <Input
                                key={formData.qr_code_data ? "has-qr-code" : "no-qr-code"}
                                id="qr_code_upload"
                                type="file"
                                accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                                className="h-8 text-xs"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = async () => {
                                            const base64String = reader.result as string;
                                            const compressed = await compressImage(base64String, 200);
                                            setFormData(prev => ({ ...prev, qr_code_data: compressed }));
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                            {formData.qr_code_data && (
                                <div className="flex items-center gap-3 ml-2 shrink-0">
                                    <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">✓ Déjà existant</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs"
                                        onClick={() => setFormData(prev => ({ ...prev, qr_code_data: "" }))}
                                    >
                                        Retirer / Mettre à jour
                                    </Button>
                                </div>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1.5">Image QR Code affichée en bas de la facture, à côté du contact.</p>
                    </div>
                </SettingsGroup>
            )}

            {activeCategory === "security" && (
                <>
                    <SettingsGroup title="Mot de passe" description="Modifiez votre mot de passe pour sécuriser l'accès à vos données.">
                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <SettingsRow label="Mot de passe actuel">
                                <Input
                                    type="password"
                                    className={rowInputClass}
                                    value={securityData.currentPassword}
                                    onChange={(e) => setSecurityData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                />
                            </SettingsRow>
                            <SettingsRow label="Nouveau mot de passe">
                                <Input
                                    type="password"
                                    className={rowInputClass}
                                    value={securityData.newPassword}
                                    onChange={(e) => setSecurityData(prev => ({ ...prev, newPassword: e.target.value }))}
                                />
                            </SettingsRow>
                            <SettingsRow label="Confirmer le nouveau mot de passe">
                                <Input
                                    type="password"
                                    className={rowInputClass}
                                    value={securityData.confirmPassword}
                                    onChange={(e) => setSecurityData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                />
                            </SettingsRow>
                            <div className="flex justify-end pt-1">
                                <Button type="submit" variant="outline" disabled={isUpdatingPassword} className="gap-1.5 h-[30px] px-3 text-xs font-medium rounded-md">
                                    {isUpdatingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    Mettre à jour le mot de passe
                                </Button>
                            </div>
                        </form>
                    </SettingsGroup>

                    <SettingsGroup title="Base de données & sauvegardes" description="Crée une copie complète et cohérente de la base de données locale (VACUUM INTO — sûr à exécuter pendant que l'application est en cours d'utilisation), enregistrée dans le dossier « backups » de l'application.">
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                className="gap-1.5 h-[30px] px-3 text-xs rounded-md"
                                onClick={handleBackupNow}
                                disabled={isBackingUp}
                            >
                                {isBackingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                {isBackingUp ? "Sauvegarde en cours..." : "Créer une sauvegarde manuelle"}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5 h-[30px] px-3 text-xs rounded-md border-destructive/50 text-destructive hover:bg-destructive/10"
                                onClick={handlePickRestoreFile}
                            >
                                <DatabaseIcon className="w-3.5 h-3.5" />
                                Restaurer depuis une sauvegarde
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5 h-[30px] px-3 text-xs rounded-md"
                                onClick={handleOpenBackupsFolder}
                            >
                                <FolderIcon className="w-3.5 h-3.5" />
                                Ouvrir le dossier des sauvegardes
                            </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Une sauvegarde automatique est également créée à chaque démarrage et fermeture de
                            l'application (les 7 dernières sont conservées, les plus anciennes sont purgées).
                            {lastBackupInfo ? (
                                <>
                                    {" "}Dernière sauvegarde :{" "}
                                    <span className="font-medium text-foreground">
                                        {new Date(lastBackupInfo.timestamp).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                                    </span>{" "}
                                    ({(lastBackupInfo.size / 1024 / 1024).toFixed(2)} Mo)
                                </>
                            ) : (
                                " Aucune sauvegarde trouvée pour le moment."
                            )}
                        </p>
                    </SettingsGroup>

                    <SettingsGroup tone="destructive" title="Zone dangereuse" description={`Réinitialise l'espace « ${company?.name || "cette entreprise"} » aux valeurs d'usine : tous les clients, fournisseurs, factures, paiements, dépenses, contrats, projets, bons de livraison, commandes et l'historique d'activité seront définitivement supprimés. Le profil de l'entreprise (nom, NIF, NIS, RC, coordonnées) ainsi que le logo, le cachet, la signature, le QR code et les couleurs seront également réinitialisés à vide. Les employés, les associés et le catalogue de services restent inchangés. Cette action est irréversible.`}>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-[30px] px-3 text-xs rounded-md border-destructive text-destructive hover:bg-destructive/10"
                            onClick={() => setResetDialogOpen(true)}
                        >
                            <TrashIcon className="w-3.5 h-3.5" />
                            Réinitialiser aux valeurs d'usine
                        </Button>
                    </SettingsGroup>

                    <SettingsGroup title="Développeur — Données de démonstration" description="Injecte un jeu de données réaliste (3 clients, 3 services, 4 factures couvrant chaque statut, 2 dépenses) pour auditer la densité de l'interface. Chaque ligne créée est identifiable (préfixe « [DÉMO] ») et peut être supprimée d'un clic sans toucher au profil de l'entreprise ni aux paramètres réels.">
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5 h-[30px] px-3 text-xs rounded-md"
                                onClick={handleSeedDemoData}
                                disabled={isSeedingDemo || !company?.id}
                            >
                                {isSeedingDemo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DatabaseIcon className="w-3.5 h-3.5" />}
                                Générer les données de démonstration
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5 h-[30px] px-3 text-xs rounded-md border-destructive/50 text-destructive hover:bg-destructive/10"
                                onClick={handleClearDemoData}
                                disabled={isClearingDemo || !company?.id}
                            >
                                {isClearingDemo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrashIcon className="w-3.5 h-3.5" />}
                                Supprimer les données de démonstration
                            </Button>
                        </div>
                    </SettingsGroup>

                    <SettingsGroup title="À propos" description="Version installée de Sordi Invoicing.">
                        {updateInfo?.update_available ? (
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
                                <div className="flex items-center gap-2 text-sm text-foreground">
                                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                                    Version {updateInfo.current_version} — une mise à jour ({updateInfo.latest_version}) est disponible
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                Version {updateInfo?.current_version ?? "—"} (à jour)
                            </div>
                        )}
                    </SettingsGroup>
                </>
            )}

            {activeCategory === "notifications" && (
                <>
                    <SettingsGroup title="Sons & notifications" description="Gérez les retours sonores et testez le bon fonctionnement du système de notifications en temps réel.">
                        <SettingsRow label="Effets sonores des notifications" helper="Jouer un carillon audio harmonieux lors des actions réussies, alertes et erreurs.">
                            <Switch
                                checked={soundEnabled}
                                onCheckedChange={(checked) => {
                                    setSoundEnabled(checked);
                                    notificationAudio.setEnabled(checked);
                                    if (checked) {
                                        notificationAudio.play("success");
                                        toast.success("Effets sonores activés");
                                    } else {
                                        toast.info("Effets sonores désactivés");
                                    }
                                }}
                            />
                        </SettingsRow>

                        <div className="pt-3 border-t border-border/60">
                            <p className="text-xs font-medium text-foreground mb-2">Aperçu des tonalités sonores</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        notificationAudio.play("success");
                                        toast.success("Tonalité de succès");
                                    }}
                                    className="border-emerald-500/30 hover:bg-emerald-50 text-emerald-700 dark:hover:bg-emerald-950/40 gap-1.5 h-8 text-xs active:scale-[0.98]"
                                >
                                    <RiCheckLine className="w-3.5 h-3.5 text-emerald-600" />
                                    Son Succès
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        notificationAudio.play("error");
                                        toast.error("Tonalité d'erreur");
                                    }}
                                    className="border-rose-500/30 hover:bg-rose-50 text-rose-700 dark:hover:bg-rose-950/40 gap-1.5 h-8 text-xs active:scale-[0.98]"
                                >
                                    <RiErrorWarningLine className="w-3.5 h-3.5 text-rose-600" />
                                    Son Erreur
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        notificationAudio.play("warning");
                                        toast.warning("Tonalité d'alerte");
                                    }}
                                    className="border-amber-500/30 hover:bg-amber-50 text-amber-700 dark:hover:bg-amber-950/40 gap-1.5 h-8 text-xs active:scale-[0.98]"
                                >
                                    <RiAlertLine className="w-3.5 h-3.5 text-amber-600" />
                                    Son Alerte
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        notificationAudio.play("info");
                                        toast.info("Tonalité d'information");
                                    }}
                                    className="border-primary/30 hover:bg-primary/5 text-primary gap-1.5 h-8 text-xs active:scale-[0.98]"
                                >
                                    <RiInformationLine className="w-3.5 h-3.5 text-primary" />
                                    Son Information
                                </Button>
                            </div>
                        </div>
                    </SettingsGroup>

                    <SettingsGroup title="Envoi d'emails (Gmail / SMTP)" description="Renseignez un compte Gmail pour envoyer vos factures, bons de commande et bons de livraison directement depuis Sordi. Sans configuration, l'envoi passera par votre client mail par défaut.">
                        <form onSubmit={handleEmailSettingsSave} className="space-y-4">
                            <SettingsRow label="Email d'envoi">
                                <Input
                                    type="email"
                                    placeholder="votre-email@gmail.com"
                                    className={rowInputClass}
                                    value={emailSettingsData.smtp_email}
                                    onChange={(e) => setEmailSettingsData(prev => ({ ...prev, smtp_email: e.target.value }))}
                                />
                            </SettingsRow>
                            <SettingsRow label="Mot de passe d'application" helper="Un mot de passe d'application Google — pas le mot de passe de votre compte. Généré depuis myaccount.google.com/apppasswords (nécessite la validation en deux étapes).">
                                <Input
                                    type="password"
                                    placeholder="xxxx xxxx xxxx xxxx"
                                    className={rowInputClass}
                                    value={emailSettingsData.smtp_app_password}
                                    onChange={(e) => setEmailSettingsData(prev => ({ ...prev, smtp_app_password: e.target.value }))}
                                />
                            </SettingsRow>
                            <div className="flex justify-end pt-1">
                                <Button type="submit" variant="outline" disabled={updateSettings.isPending} className="gap-1.5 h-[30px] px-3 text-xs font-medium rounded-md">
                                    {updateSettings.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    Enregistrer
                                </Button>
                            </div>
                        </form>
                    </SettingsGroup>
                </>
            )}

            {activeCategory === "telemetry" && (
                <>
                    <SettingsGroup
                        title="Télémétrie & Diagnostics"
                        description="Un signal de présence anonyme, envoyé au maximum une fois par jour, pour nous aider à savoir combien d'installations sont réellement actives."
                    >
                        <SettingsRow
                            label="Envoyer un diagnostic anonyme"
                            helper="Activé par défaut. Désactivez à tout moment — ce réglage fonctionne même sans licence active."
                        >
                            <Switch
                                checked={telemetryStatus?.enabled ?? true}
                                onCheckedChange={(checked) => {
                                    setTelemetryEnabled.mutate(checked, {
                                        onSuccess: () => toast.success(checked ? "Télémétrie activée" : "Télémétrie désactivée"),
                                        onError: () => toast.error("Impossible de mettre à jour ce réglage."),
                                    });
                                }}
                                disabled={setTelemetryEnabled.isPending}
                            />
                        </SettingsRow>

                        <div className="pt-3 border-t border-border/60 space-y-2">
                            <p className="text-xs font-medium text-foreground">Ce qui est envoyé — rien d'autre</p>
                            <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                                <li>Un identifiant machine anonyme (aucun lien avec votre identité)</li>
                                <li>La version de l'application</li>
                                <li>Le nombre total de factures, clients et dépenses (jamais leur contenu)</li>
                            </ul>
                            <p className="text-[11px] text-muted-foreground">
                                Aucune donnée personnelle n'est envoyée : ni le nom de votre entreprise, ni votre numéro de
                                téléphone, ni le détail d'un client, d'une facture ou d'une dépense.
                            </p>
                        </div>

                        <div className="pt-3 border-t border-border/60">
                            <SettingsRow label="Dernier envoi">
                                <span className="text-xs font-mono text-muted-foreground">
                                    {telemetryStatus?.lastSentAt
                                        ? new Date(telemetryStatus.lastSentAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
                                        : "Aucun envoi pour le moment"}
                                </span>
                            </SettingsRow>
                        </div>
                    </SettingsGroup>
                </>
            )}

            {activeCategory === "modules" && (
                <SettingsGroup title="Modules optionnels" description="Sordi démarre en suite de facturation épurée. Activez ici les modules secondaires dont vous avez besoin — ils apparaissent aussitôt dans la barre latérale, sans perdre l'accès à leurs pages si vous y étiez déjà.">
                    {MODULE_KEYS.map((key) => {
                        const meta = MODULE_META[key];
                        return (
                            <SettingsRow key={key} label={meta.title} helper={meta.description}>
                                <Switch
                                    checked={moduleFlags[key]}
                                    onCheckedChange={(checked) => {
                                        setModuleEnabled(key, checked);
                                        toast.success(checked ? `${meta.title} activé` : `${meta.title} désactivé`);
                                    }}
                                />
                            </SettingsRow>
                        );
                    })}
                </SettingsGroup>
            )}
        </>
    );

    return (
        <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left navigation pane */}
            <nav className="w-52 shrink-0 border-r border-border/70 p-2 space-y-0.5 select-none overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                    const active = activeCategory === item.key;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setActiveCategory(item.key)}
                            className={cn(
                                "w-full h-[30px] px-2.5 rounded-md text-xs flex items-center gap-2 transition-colors",
                                active
                                    ? "bg-muted text-foreground font-semibold"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            <item.icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate text-start">{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Right content pane */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
                    <div className="flex items-start justify-between gap-4 mb-5">
                        <div>
                            <h2 className="text-sm font-semibold tracking-tight text-foreground mb-1">{activeNav.label}</h2>
                            <p className="text-xs text-muted-foreground">{categoryDescriptions[activeCategory]}</p>
                        </div>
                        {isFormCategory && (
                            <span className={cn(
                                "text-[11px] font-mono shrink-0 pt-0.5",
                                isDirty ? "text-transparent select-none" : "text-muted-foreground"
                            )}>
                                ✓ Enregistré
                            </span>
                        )}
                    </div>

                    {isFormCategory ? (
                        <form onSubmit={handleSubmit}>{content}</form>
                    ) : (
                        content
                    )}
                </div>

                {/* Sticky "unsaved changes" bar — replaces the old floating
                    save button that was always visible whether or not there
                    was anything to save. Only ever shown for the
                    identity/appearance categories, the two that share
                    handleSubmit. */}
                {isFormCategory && isDirty && (
                    <div className="shrink-0 border-t border-border/80 bg-card/95 backdrop-blur-sm px-6 py-2.5 flex items-center justify-between animate-fade-in-up">
                        <span className="text-xs text-muted-foreground">Modifications non enregistrées</span>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={handleDiscardChanges}>
                                Annuler
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                className="h-7 text-xs gap-1.5"
                                disabled={updateSettings.isPending || updateActiveCompany.isPending || !formHydrated || !companyFormHydrated}
                                onClick={handleSubmit}
                            >
                                {updateSettings.isPending || updateActiveCompany.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Enregistrer
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <AlertDialog open={restoreDialogOpen} onOpenChange={(open) => { if (!isRestoring) { setRestoreDialogOpen(open); if (!open) setRestoreSourcePath(null); } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restaurer cette sauvegarde ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Toutes les données actuelles (clients, factures, paiements, paramètres...) seront
                            remplacées par le contenu de « {restoreSourcePath?.split(/[\\/]/).pop()} ». Une copie de
                            sécurité de vos données actuelles sera créée automatiquement avant la restauration.
                            L'application redémarrera pour terminer l'opération. Cette action ne peut pas être annulée
                            autrement qu'en restaurant à nouveau une sauvegarde précédente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isRestoring}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmRestore}
                            disabled={isRestoring}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isRestoring ? "Restauration..." : "Restaurer et redémarrer"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={resetDialogOpen} onOpenChange={(open) => { setResetDialogOpen(open); if (!open) setResetConfirmText(""); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Réinitialiser aux valeurs d'usine ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action supprimera définitivement tous les clients, fournisseurs, factures, paiements, dépenses,
                            contrats, projets, bons de livraison, commandes et l'historique d'activité de « {resetConfirmTarget} ».
                            Elle ne peut pas être annulée. Pour confirmer, tapez le nom de l'entreprise ci-dessous.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2 py-2">
                        <Label htmlFor="reset-confirm">Nom de l'entreprise</Label>
                        <Input
                            id="reset-confirm"
                            value={resetConfirmText}
                            onChange={(e) => setResetConfirmText(e.target.value)}
                            placeholder={resetConfirmTarget}
                            autoComplete="off"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmReset}
                            disabled={!canConfirmReset || resetToFactoryState.isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {resetToFactoryState.isPending ? "Réinitialisation..." : "Réinitialiser définitivement"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
