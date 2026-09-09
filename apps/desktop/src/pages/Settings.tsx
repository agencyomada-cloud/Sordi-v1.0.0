
import { useEffect, useState } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useActiveCompany, useUpdateActiveCompany, getCompanyPhoneList, getCompanyExtraInfoList } from "@/hooks/useActiveCompany";
import { useResetToFactoryState } from "@/hooks/useSystemReset";
import type { CreateCompanyData } from "@/lib/database";
import { Button, Switch, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@sordi/ui";
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
} from "@remixicon/react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDirDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { appDataDir, join } from "@tauri-apps/api/path";
import { notificationAudio } from "@/lib/notificationSound";
import { db } from "@/lib/database";
import { useQueryClient } from "@tanstack/react-query";
import { INVOICE_PDF_THEMES, INVOICE_PDF_FONTS } from "@/components/pdf/invoicePdfShared";
import { useSecureSession } from "@/hooks/useSecureSession";

const emptyCompanyForm: CreateCompanyData = {
    name: "",
    logo_base64: "",
    activity: "",
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

export default function SettingsPage() {
    const { data: settings, isLoading } = useSettings();
    const updateSettings = useUpdateSettings();
    const { company, isReady: isCompanyReady } = useActiveCompany();
    const updateActiveCompany = useUpdateActiveCompany();
    const { executeSecuredAction } = useSecureSession();
    const resetToFactoryState = useResetToFactoryState();
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [resetConfirmText, setResetConfirmText] = useState("");
    const [isBackingUp, setIsBackingUp] = useState(false);
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
        footer_logo_data: "",
        body_pattern_data: "",
        qr_code_data: "",
        invoice_pdf_theme: "structure",
        invoice_pdf_font: "montserrat",
        pdf_backup_directory: "",
    });

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
            setFormData(prev => ({
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
                footer_logo_data: settings.footer_logo_data ?? prev.footer_logo_data,
                body_pattern_data: settings.body_pattern_data ?? prev.body_pattern_data,
                qr_code_data: settings.qr_code_data ?? prev.qr_code_data,
                invoice_pdf_theme: settings.invoice_pdf_theme ?? prev.invoice_pdf_theme,
                invoice_pdf_font: settings.invoice_pdf_font ?? prev.invoice_pdf_font,
                pdf_backup_directory: settings.pdf_backup_directory ?? prev.pdf_backup_directory,
            }));
            setFormHydrated(true);
        }
    }, [settings]);

    useEffect(() => {
        if (company) {
            setCompanyFormData({
                name: company.name,
                logo_base64: company.logo_base64 || "",
                activity: company.activity || "",
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

    const handleBackupNow = async () => {
        setIsBackingUp(true);
        try {
            const path = await db.database.backup();
            const filename = path.split(/[\\/]/).pop() || path;
            const timestamp = new Date().toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "medium" });
            toast.success(`Sauvegarde créée : ${filename}`, { description: `${path} — ${timestamp}` });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error("Échec de la sauvegarde de la base de données", { description: message });
        } finally {
            setIsBackingUp(false);
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

    return (
                <main className="flex-1 p-8 space-y-8">
                    <div>
                        <h1 className="text-2xl font-bold">Paramètres</h1>
                        <p className="text-muted-foreground">Gérez les informations de votre entreprise et l'apparence des documents.</p>
                    </div>

                    <Tabs defaultValue="company" className="w-full">
                        <TabsList className="mb-6">
                            <TabsTrigger value="company">Informations Entreprise</TabsTrigger>
                            <TabsTrigger value="appearance">Apparence & Logo</TabsTrigger>
                            <TabsTrigger value="security">Sécurité</TabsTrigger>
                            <TabsTrigger value="notifications">Notifications & Sons</TabsTrigger>
                            <TabsTrigger value="email">Envoi d'Emails</TabsTrigger>
                        </TabsList>

                        <form onSubmit={handleSubmit}>
                            <div className="flex justify-end mb-4">
                                <Button type="submit" disabled={updateSettings.isPending || updateActiveCompany.isPending || !formHydrated || !companyFormHydrated} className="gap-2">
                                    {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Enregistrer les modifications
                                </Button>
                            </div>

                            <TabsContent value="company">
                                <div className="grid gap-6">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Identité de l'entreprise</CardTitle>
                                            <CardDescription>Ces informations apparaîtront sur vos factures et documents officiels.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="name">Nom de l'entreprise</Label>
                                                    <Input id="name" name="name" value={companyFormData.name} onChange={handleCompanyChange} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="address">Adresse complète</Label>
                                                    <Input id="address" name="address" value={companyFormData.address ?? ""} onChange={handleCompanyChange} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="rc">RC</Label>
                                                    <Input id="rc" name="rc" value={companyFormData.rc ?? ""} onChange={handleCompanyChange} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="nif">NIF</Label>
                                                    <Input id="nif" name="nif" value={companyFormData.nif ?? ""} onChange={handleCompanyChange} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="nis">NIS</Label>
                                                    <Input id="nis" name="nis" value={companyFormData.nis ?? ""} onChange={handleCompanyChange} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="article_imposition">AI</Label>
                                                    <Input id="article_imposition" name="article_imposition" value={companyFormData.article_imposition ?? ""} onChange={handleCompanyChange} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="cnas_adherent">N° Adhérent CNAS</Label>
                                                    <Input id="cnas_adherent" name="cnas_adherent" value={companyFormData.cnas_adherent ?? ""} onChange={handleCompanyChange} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="payroll_prime_panier_taux">Indemnité de panier — taux journalier (DA)</Label>
                                                    <Input id="payroll_prime_panier_taux" name="payroll_prime_panier_taux" type="number" min="0" value={formData.payroll_prime_panier_taux} onChange={handleChange} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="payroll_prime_transport">Indemnité de transport — montant mensuel (DA)</Label>
                                                    <Input id="payroll_prime_transport" name="payroll_prime_transport" type="number" min="0" value={formData.payroll_prime_transport} onChange={handleChange} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="rib">RIB (Compte Bancaire)</Label>
                                                    <Input id="rib" name="rib" value={companyFormData.rib ?? ""} onChange={handleCompanyChange} className="font-mono text-sm" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="bank_agency">Agence Bancaire</Label>
                                                    <Input id="bank_agency" name="bank_agency" value={companyFormData.bank_agency ?? ""} onChange={handleCompanyChange} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="capital">Capital Social</Label>
                                                    <Input id="capital" name="capital" value={companyFormData.capital ?? ""} onChange={handleCompanyChange} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="website">Site Web</Label>
                                                    <Input id="website" name="website" value={companyFormData.website ?? ""} onChange={handleCompanyChange} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <Label>Téléphones</Label>
                                                        <Button type="button" variant="outline" size="sm" onClick={() => setPhoneList([...phoneList, ""])} className="h-6 text-xs gap-1">
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
                                                                }} className="text-gray-400 hover:text-red-500">
                                                                    <span className="sr-only">Supprimer</span>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="email">Email</Label>
                                                    <Input id="email" name="email" value={companyFormData.email ?? ""} onChange={handleCompanyChange} placeholder="contact@..." />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <Label>Informations Complémentaires</Label>
                                                    <Button type="button" variant="outline" size="sm" onClick={addExtraInfo} className="h-7 text-xs gap-1">
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
                                                            />
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeExtraInfo(index)} className="text-gray-400 hover:text-red-500">
                                                                <span className="sr-only">Supprimer</span>
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    {extraInfoList.length === 0 && (
                                                        <p className="text-sm text-gray-400 italic py-2">Aucune information complémentaire.</p>
                                                    )}
                                                    <p className="text-[10px] text-gray-400">Ces informations s'afficheront en dessous de votre RC/NIF/NIS.</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <div className="flex justify-end mt-4">
                                        <Button type="submit" disabled={updateSettings.isPending || updateActiveCompany.isPending || !formHydrated || !companyFormHydrated} className="gap-2">
                                            {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Enregistrer les modifications
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="appearance">
                                <div className="grid gap-6">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Thème de la facture PDF</CardTitle>
                                            <CardDescription>Choisissez la mise en page utilisée pour générer vos factures, bons de livraison et commandes.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                {INVOICE_PDF_THEMES.map((theme) => {
                                                    const isSelected = (formData.invoice_pdf_theme || "structure") === theme.value;
                                                    return (
                                                        <button
                                                            key={theme.value}
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, invoice_pdf_theme: theme.value }))}
                                                            className={cn(
                                                                "text-left rounded-xl border p-4 transition-all",
                                                                isSelected
                                                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-sm font-semibold text-foreground">{theme.label}</span>
                                                                {isSelected && (
                                                                    <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                                                                        <RiCheckLine className="w-3 h-3 text-primary-foreground" />
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground leading-relaxed">{theme.description}</p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Police</CardTitle>
                                            <CardDescription>Choisissez la police de caractères utilisée dans vos factures, bons de livraison et commandes.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {INVOICE_PDF_FONTS.map((font) => {
                                                    const isSelected = (formData.invoice_pdf_font || "montserrat") === font.value;
                                                    return (
                                                        <button
                                                            key={font.value}
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, invoice_pdf_font: font.value }))}
                                                            className={cn(
                                                                "text-left rounded-xl border p-4 transition-all",
                                                                isSelected
                                                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-base font-semibold text-foreground" style={{ fontFamily: font.label }}>{font.label}</span>
                                                                {isSelected && (
                                                                    <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                                                                        <RiCheckLine className="w-3 h-3 text-primary-foreground" />
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground leading-relaxed">{font.description}</p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Sauvegarde PDF automatique</CardTitle>
                                            <CardDescription>Chaque facture, bon de commande ou bon de livraison généré est automatiquement enregistré dans ce dossier, sous <span className="font-mono text-xs">Client / Client - Numéro.pdf</span>.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 flex items-center gap-2 h-11 px-3 rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground overflow-hidden">
                                                    <FolderIcon className="w-4 h-4 shrink-0" />
                                                    <span className="truncate">{formData.pdf_backup_directory || "Aucun dossier sélectionné"}</span>
                                                </div>
                                                <Button type="button" variant="outline" onClick={handlePickBackupDirectory}>
                                                    Choisir un dossier
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Personnalisation des documents</CardTitle>
                                            <CardDescription>Personnalisez les couleurs et le logo de vos factures.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="primary_color">Couleur de la Barre Supérieure</Label>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            type="color"
                                                            id="primary_color"
                                                            name="primary_color"
                                                            value={formData.primary_color}
                                                            onChange={handleChange}
                                                            className="w-12 h-10 p-1 cursor-pointer"
                                                        />
                                                        <Input
                                                            type="text"
                                                            name="primary_color"
                                                            value={formData.primary_color}
                                                            onChange={handleChange}
                                                            className="font-mono uppercase"
                                                        />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">Change la couleur de la barre en haut du document.</p>
                                                </div>

                                                <div className="space-y-2 col-span-2">
                                                    <Label htmlFor="logo_upload">Logo de l'entreprise</Label>
                                                    <div className="flex gap-4 items-start">
                                                        <Input
                                                            key={companyFormData.logo_base64 ? "has-logo" : "no-logo"}
                                                            id="logo_upload"
                                                            type="file"
                                                            accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
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
                                                            <div className="flex items-center gap-3 ml-2">
                                                                <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded">✓ Déjà existant</span>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                    onClick={() => setCompanyFormData(prev => ({ ...prev, logo_base64: "" }))}
                                                                >
                                                                    Retirer / Mettre à jour
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">Format supporté : PNG, JPG. Le logo remplacera le logo "M" par défaut.</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="logo_size">Taille du Logo (hauteur en px)</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            id="logo_size"
                                                            name="logo_size"
                                                            value={formData.logo_size || "64"}
                                                            onChange={handleChange}
                                                            className="w-24"
                                                            min="32"
                                                            max="400"
                                                        />
                                                        <span className="text-sm text-muted-foreground">px</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="company_info_size">Taille texte informations entreprise</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            id="company_info_size"
                                                            name="company_info_size"
                                                            value={formData.company_info_size || "9"}
                                                            onChange={handleChange}
                                                            className="w-24"
                                                            min="6"
                                                            max="16"
                                                        />
                                                        <span className="text-sm text-muted-foreground">px</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-8 border p-8 rounded-lg bg-gray-50 flex justify-center">
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
                                                        <div className="text-xl font-bold p-2 bg-gray-100 rounded min-h-[40px] min-w-[100px] flex items-center justify-center">
                                                            {companyFormData.name || ""}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>


                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Cachet et Signature</CardTitle>
                                            <CardDescription>Ajoutez votre cachet électronique et votre signature pour qu'ils apparaissent sur les documents.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            {/* Cachet Électronique */}
                                            <div className="space-y-2">
                                                <Label htmlFor="stamp_upload">Cachet Électronique</Label>
                                                <div className="flex gap-4 items-start">
                                                    <Input
                                                        key={formData.stamp_data ? "has-stamp" : "no-stamp"}
                                                        id="stamp_upload"
                                                        type="file"
                                                        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
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
                                                        <div className="flex items-center gap-3 ml-2">
                                                            <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded">✓ Déjà existant</span>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => setFormData(prev => ({ ...prev, stamp_data: "" }))}
                                                            >
                                                                Retirer / Mettre à jour
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">Format supporté : PNG (fond transparent recommandé), JPG.</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="stamp_size">Taille du Cachet (hauteur en px)</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            id="stamp_size"
                                                            name="stamp_size"
                                                            value={formData.stamp_size || "96"}
                                                            onChange={handleChange}
                                                            className="w-24"
                                                            min="32"
                                                            max="400"
                                                        />
                                                        <span className="text-sm text-muted-foreground">px</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {formData.stamp_data && (
                                                <div className="mt-4 border p-4 rounded-lg bg-gray-50 flex justify-center">
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
                                                        <p className="text-xs text-muted-foreground mt-2">Aperçu du cachet</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Signature */}
                                            <div className="space-y-2 pt-4 border-t">
                                                <Label htmlFor="signature_upload">Signature</Label>
                                                <div className="flex gap-4 items-start">
                                                    <Input
                                                        key={formData.signature_data ? "has-signature" : "no-signature"}
                                                        id="signature_upload"
                                                        type="file"
                                                        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
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
                                                        <div className="flex items-center gap-3 ml-2">
                                                            <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded">✓ Déjà existant</span>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => setFormData(prev => ({ ...prev, signature_data: "" }))}
                                                            >
                                                                Retirer / Mettre à jour
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">Format supporté : PNG (fond transparent recommandé), JPG.</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="signature_size">Taille de la Signature (hauteur en px)</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            id="signature_size"
                                                            name="signature_size"
                                                            value={formData.signature_size || "96"}
                                                            onChange={handleChange}
                                                            className="w-24"
                                                            min="32"
                                                            max="400"
                                                        />
                                                        <span className="text-sm text-muted-foreground">px</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {formData.signature_data && (
                                                <div className="mt-4 border p-4 rounded-lg bg-gray-50 flex justify-center">
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
                                                        <p className="text-xs text-muted-foreground mt-2">Aperçu de la signature</p>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Éléments visuels</CardTitle>
                                            <CardDescription>Ajoutez le logo Groupe, le motif d'arrière-plan (Pattern Body) et le Code QR pour personnaliser entièrement le modèle.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            {/* Footer Group Logo */}
                                            <div className="space-y-2">
                                                <Label htmlFor="footer_logo_upload">Logo Groupe (Pied de page)</Label>
                                                <div className="flex gap-4 items-start">
                                                    <Input
                                                        key={formData.footer_logo_data ? "has-footer-logo" : "no-footer-logo"}
                                                        id="footer_logo_upload"
                                                        type="file"
                                                        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                const reader = new FileReader();
                                                                reader.onloadend = async () => {
                                                                    const base64String = reader.result as string;
                                                                    const compressed = await compressImage(base64String, 300);
                                                                    setFormData(prev => ({ ...prev, footer_logo_data: compressed }));
                                                                };
                                                                reader.readAsDataURL(file);
                                                            }
                                                        }}
                                                    />
                                                    {formData.footer_logo_data && (
                                                        <div className="flex items-center gap-3 ml-2">
                                                            <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded">✓ Déjà existant</span>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => setFormData(prev => ({ ...prev, footer_logo_data: "" }))}
                                                            >
                                                                Retirer / Mettre à jour
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">Logo affiché en bas à droite de la facture (Remplacera SORDI).</p>
                                            </div>

                                            {/* Pattern Body Background Image */}
                                            <div className="space-y-2 pt-4 border-t">
                                                <Label htmlFor="body_pattern_upload">Motif d'arrière-plan / Pattern Body</Label>
                                                <div className="flex gap-4 items-start">
                                                    <Input
                                                        key={formData.body_pattern_data ? "has-body-pattern" : "no-body-pattern"}
                                                        id="body_pattern_upload"
                                                        type="file"
                                                        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
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
                                                        <div className="flex items-center gap-3 ml-2">
                                                            <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded">✓ Déjà existant</span>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => setFormData(prev => ({ ...prev, body_pattern_data: "" }))}
                                                            >
                                                                Retirer / Mettre à jour
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">Image d'arrière-plan décorative pour le corps de la facture.</p>
                                            </div>

                                            {/* QR Code Image */}
                                            <div className="space-y-2 pt-4 border-t">
                                                <Label htmlFor="qr_code_upload">Code QR (Pied de page)</Label>
                                                <div className="flex gap-4 items-start">
                                                    <Input
                                                        key={formData.qr_code_data ? "has-qr-code" : "no-qr-code"}
                                                        id="qr_code_upload"
                                                        type="file"
                                                        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
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
                                                        <div className="flex items-center gap-3 ml-2">
                                                            <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded">✓ Déjà existant</span>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => setFormData(prev => ({ ...prev, qr_code_data: "" }))}
                                                            >
                                                                Retirer / Mettre à jour
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">Image QR Code affichée في أسفل الفاتورة بجانب الاتصال.</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <div className="flex justify-end mt-4">
                                        <Button type="submit" disabled={updateSettings.isPending || updateActiveCompany.isPending || !formHydrated || !companyFormHydrated} className="gap-2">
                                            {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Enregistrer les modifications
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>
                        </form>
                        <TabsContent value="security">
                                <Card className="max-w-2xl">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Lock className="w-5 h-5" />
                                            Sécurité du compte
                                        </CardTitle>
                                        <CardDescription>
                                            Modifiez votre mot de passe pour sécuriser l'accès à vos données.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <form onSubmit={handlePasswordChange} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                                                <div className="relative">
                                                    <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        id="currentPassword"
                                                        type="password"
                                                        className="pl-10"
                                                        value={securityData.currentPassword}
                                                        onChange={(e) => setSecurityData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                                                    <div className="relative">
                                                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            id="newPassword"
                                                            type="password"
                                                            className="pl-10"
                                                            value={securityData.newPassword}
                                                            onChange={(e) => setSecurityData(prev => ({ ...prev, newPassword: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
                                                    <div className="relative">
                                                        <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            id="confirmPassword"
                                                            type="password"
                                                            className="pl-10"
                                                            value={securityData.confirmPassword}
                                                            onChange={(e) => setSecurityData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <Button type="submit" disabled={isUpdatingPassword} className="gap-2">
                                                    {isUpdatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                    Mettre à jour le mot de passe
                                                </Button>
                                            </div>
                                        </form>
                                    </CardContent>
                                </Card>

                                <Card className="max-w-2xl">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <DatabaseIcon className="w-5 h-5 text-primary" />
                                            Base de données &amp; sauvegardes
                                        </CardTitle>
                                        <CardDescription>
                                            Crée une copie complète et cohérente de la base de données locale (VACUUM INTO — sûr à exécuter
                                            pendant que l'application est en cours d'utilisation), enregistrée dans le dossier « backups » de
                                            l'application.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex flex-wrap gap-3">
                                        <Button
                                            type="button"
                                            className="gap-2"
                                            onClick={handleBackupNow}
                                            disabled={isBackingUp}
                                        >
                                            {isBackingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            {isBackingUp ? "Sauvegarde en cours..." : "Exporter une sauvegarde"}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="gap-2"
                                            onClick={handleOpenBackupsFolder}
                                        >
                                            <FolderIcon className="w-4 h-4" />
                                            Ouvrir le dossier des sauvegardes
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card className="max-w-2xl border-destructive/40">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-destructive">
                                            <TrashIcon className="w-5 h-5" />
                                            Zone dangereuse
                                        </CardTitle>
                                        <CardDescription>
                                            Réinitialise l'espace « {company?.name || "cette entreprise"} » aux valeurs d'usine : tous les clients,
                                            fournisseurs, factures, paiements, dépenses, contrats, projets, bons de livraison, commandes et
                                            l'historique d'activité seront définitivement supprimés. Le profil de l'entreprise (nom, NIF, NIS, RC,
                                            coordonnées) ainsi que le logo, le cachet, la signature, le QR code et les couleurs seront également
                                            réinitialisés à vide. Les employés, les associés et le catalogue de services restent inchangés. Cette
                                            action est irréversible.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="gap-2 border-destructive text-destructive hover:bg-destructive/10"
                                            onClick={() => setResetDialogOpen(true)}
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                            Réinitialiser aux valeurs d'usine
                                        </Button>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="notifications">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <RiNotification3Line className="w-5 h-5 text-primary" />
                                            Paramètres des Notifications & Sons
                                        </CardTitle>
                                        <CardDescription>
                                            Gérez les retours sonores et testez le bon fonctionnement du système de notifications en temps réel.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-secondary/20">
                                            <div className="space-y-0.5">
                                                <Label className="text-sm font-semibold flex items-center gap-2">
                                                    {soundEnabled ? <RiVolumeUpLine className="w-4 h-4 text-primary" /> : <RiVolumeMuteLine className="w-4 h-4 text-muted-foreground" />}
                                                    Effets sonores des notifications
                                                </Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Jouer un carillon audio harmonieux lors des actions réussies, alertes et erreurs.
                                                </p>
                                            </div>
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
                                        </div>

                                        <div className="space-y-3">
                                            <Label className="text-sm font-semibold">Aperçu des tonalités sonores</Label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        notificationAudio.play("success");
                                                        toast.success("Tonalité de succès");
                                                    }}
                                                    className="border-emerald-500/30 hover:bg-emerald-50 text-emerald-700 dark:hover:bg-emerald-950/40 gap-2 h-11 active:scale-[0.98]"
                                                >
                                                    <RiCheckLine className="w-4 h-4 text-emerald-600" />
                                                    Son Succès
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        notificationAudio.play("error");
                                                        toast.error("Tonalité d'erreur");
                                                    }}
                                                    className="border-rose-500/30 hover:bg-rose-50 text-rose-700 dark:hover:bg-rose-950/40 gap-2 h-11 active:scale-[0.98]"
                                                >
                                                    <RiErrorWarningLine className="w-4 h-4 text-rose-600" />
                                                    Son Erreur
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        notificationAudio.play("warning");
                                                        toast.warning("Tonalité d'alerte");
                                                    }}
                                                    className="border-amber-500/30 hover:bg-amber-50 text-amber-700 dark:hover:bg-amber-950/40 gap-2 h-11 active:scale-[0.98]"
                                                >
                                                    <RiAlertLine className="w-4 h-4 text-amber-600" />
                                                    Son Alerte
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        notificationAudio.play("info");
                                                        toast.info("Tonalité d'information");
                                                    }}
                                                    className="border-primary/30 hover:bg-primary/5 text-primary gap-2 h-11 active:scale-[0.98]"
                                                >
                                                    <RiInformationLine className="w-4 h-4 text-primary" />
                                                    Son Information
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="email">
                                <Card className="max-w-2xl">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <RiMailLine className="w-5 h-5 text-primary" />
                                            Envoi d'Emails (Gmail / SMTP)
                                        </CardTitle>
                                        <CardDescription>
                                            Renseignez un compte Gmail pour envoyer vos factures, bons de commande et bons de livraison
                                            directement depuis Sordi. Sans configuration, l'envoi passera par votre client mail par défaut.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <form onSubmit={handleEmailSettingsSave} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="smtp_email">Email d'envoi</Label>
                                                <div className="relative">
                                                    <RiMailLine className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        id="smtp_email"
                                                        type="email"
                                                        placeholder="votre-email@gmail.com"
                                                        className="pl-10"
                                                        value={emailSettingsData.smtp_email}
                                                        onChange={(e) => setEmailSettingsData(prev => ({ ...prev, smtp_email: e.target.value }))}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="smtp_app_password">Mot de passe d'application</Label>
                                                <div className="relative">
                                                    <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        id="smtp_app_password"
                                                        type="password"
                                                        placeholder="xxxx xxxx xxxx xxxx"
                                                        className="pl-10"
                                                        value={emailSettingsData.smtp_app_password}
                                                        onChange={(e) => setEmailSettingsData(prev => ({ ...prev, smtp_app_password: e.target.value }))}
                                                    />
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Un mot de passe d'application Google — pas le mot de passe de votre compte.
                                                    Généré depuis myaccount.google.com/apppasswords (nécessite la validation en deux étapes).
                                                </p>
                                            </div>
                                            <div className="pt-2">
                                                <Button type="submit" disabled={updateSettings.isPending || updateActiveCompany.isPending || !formHydrated || !companyFormHydrated} className="gap-2">
                                                    {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                    Enregistrer
                                                </Button>
                                            </div>
                                        </form>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>

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
                </main>
    );
}
