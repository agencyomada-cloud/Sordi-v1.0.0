
import { useEffect, useState } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn, compressImage } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
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
  RiAlertLine
} from "@remixicon/react";
import { invoke } from "@tauri-apps/api/core";
import { notificationAudio } from "@/lib/notificationSound";
import { db } from "@/lib/database";
import { useQueryClient } from "@tanstack/react-query";
import { INVOICE_PDF_THEMES } from "@/components/pdf/invoicePdfShared";

export default function SettingsPage() {
    const { data: settings, isLoading } = useSettings();
    const updateSettings = useUpdateSettings();
    const queryClient = useQueryClient();
    const [soundEnabled, setSoundEnabled] = useState(() => notificationAudio.isEnabled());

    const [formData, setFormData] = useState({
        company_name: "",
        company_address: "",
        company_rc: "",
        company_nif: "",
        company_nis: "",
        company_ai: "",
        company_rib: "",
        company_capital: "50 000 000DA",
        company_bank_agency: "",
        company_website: "",
        company_phone: "",
        company_email: "",
        company_extra_info: "",
        primary_color: "#0067F2",
        logo_bg_color: "#000000",
        logo_text_color: "#FFFFFF",
        logo_data: "",
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
    });

    const [extraInfoList, setExtraInfoList] = useState<string[]>([]);
    const [phoneList, setPhoneList] = useState<string[]>([]);
    const [securityData, setSecurityData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    useEffect(() => {
        if (settings) {
            setFormData(prev => ({
                ...prev,
                ...settings,
            }));

            // Initialize phone list
            if (settings.company_phones) {
                try {
                    const parsed = typeof settings.company_phones === 'string' && settings.company_phones.startsWith('[')
                        ? JSON.parse(settings.company_phones)
                        : (Array.isArray(settings.company_phones) ? settings.company_phones : [settings.company_phones]);
                    setPhoneList(parsed);
                } catch(e) {
                    setPhoneList(settings.company_phone ? [settings.company_phone] : []);
                }
            } else if (settings.company_phone) {
                setPhoneList(settings.company_phone.split(/[\n,;]/).map(p => p.trim()).filter(Boolean));
            } else {
                setPhoneList([]);
            }

            // Initialize extra info list directly from settings
            try {
                const info = settings.company_extra_info;
                if (info) {
                    if (info.startsWith('[')) {
                        setExtraInfoList(JSON.parse(info));
                    } else {
                        setExtraInfoList([info]);
                    }
                } else {
                    setExtraInfoList([]);
                }
            } catch (e) {
                if (settings.company_extra_info) {
                    setExtraInfoList([settings.company_extra_info]);
                } else {
                    setExtraInfoList([]);
                }
            }
        }
    }, [settings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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
        setFormData((prev) => ({
            ...prev,
            company_extra_info: JSON.stringify(list)
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateSettings.mutate(formData, {
            onSuccess: () => {
                toast.success("Paramètres enregistrés avec succès");
                // Force reload text color or other non-reactive CSS vars if needed
            },
            onError: () => {
                toast.error("Erreur lors de l'enregistrement");
            }
        });
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

    if (isLoading) {
        return (
            <div className="flex min-h-screen bg-background items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Header />
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
                        </TabsList>

                        <form onSubmit={handleSubmit}>
                            <div className="flex justify-end mb-4">
                                <Button type="submit" disabled={updateSettings.isPending} className="gap-2">
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
                                                    <Label htmlFor="company_name">Nom de l'entreprise</Label>
                                                    <Input id="company_name" name="company_name" value={formData.company_name} onChange={handleChange} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="company_address">Adresse complète</Label>
                                                    <Input id="company_address" name="company_address" value={formData.company_address} onChange={handleChange} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="company_rc">RC</Label>
                                                    <Input id="company_rc" name="company_rc" value={formData.company_rc} onChange={handleChange} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="company_nif">NIF</Label>
                                                    <Input id="company_nif" name="company_nif" value={formData.company_nif} onChange={handleChange} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="company_nis">NIS</Label>
                                                    <Input id="company_nis" name="company_nis" value={formData.company_nis} onChange={handleChange} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="company_ai">AI</Label>
                                                    <Input id="company_ai" name="company_ai" value={formData.company_ai} onChange={handleChange} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="company_rib">RIB (Compte Bancaire)</Label>
                                                    <Input id="company_rib" name="company_rib" value={formData.company_rib} onChange={handleChange} className="font-mono text-sm" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="company_bank_agency">Agence Bancaire</Label>
                                                    <Input id="company_bank_agency" name="company_bank_agency" value={formData.company_bank_agency} onChange={handleChange} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="company_capital">Capital Social</Label>
                                                    <Input id="company_capital" name="company_capital" value={formData.company_capital} onChange={handleChange} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="company_website">Site Web</Label>
                                                    <Input id="company_website" name="company_website" value={formData.company_website} onChange={handleChange} />
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
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            company_phones: JSON.stringify(filtered),
                                                                            company_phone: filtered.join(", ")
                                                                        }));
                                                                    }}
                                                                    placeholder="Ex: 0550 00 00 00"
                                                                />
                                                                <Button type="button" variant="ghost" size="icon" onClick={() => {
                                                                    const updated = phoneList.filter((_, i) => i !== idx);
                                                                    setPhoneList(updated);
                                                                    const filtered = updated.filter(Boolean);
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        company_phones: JSON.stringify(filtered),
                                                                        company_phone: filtered.join(", ")
                                                                    }));
                                                                }} className="text-gray-400 hover:text-red-500">
                                                                    <span className="sr-only">Supprimer</span>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                                </Button>
                                                            </div>
                                                        ))}
                                                        {phoneList.length === 0 && (
                                                            <Input
                                                                value={formData.company_phone || ""}
                                                                onChange={(e) => {
                                                                    handleChange(e);
                                                                    setPhoneList([e.target.value]);
                                                                }}
                                                                placeholder="+213 ..."
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="company_email">Email</Label>
                                                    <Input id="company_email" name="company_email" value={formData.company_email || ""} onChange={handleChange} placeholder="contact@..." />
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
                                        <Button type="submit" disabled={updateSettings.isPending} className="gap-2">
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
                                                                "text-left rounded-[6px] border p-4 transition-all",
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
                                                                        setFormData(prev => ({ ...prev, logo_data: compressed }));
                                                                    };
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                        />
                                                        {formData.logo_data && (
                                                            <div className="flex items-center gap-3 ml-2">
                                                                <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded">✓ Déjà existant</span>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                    onClick={() => setFormData(prev => ({ ...prev, logo_data: "" }))}
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
                                                    {formData.logo_data ? (
                                                        <img
                                                            src={formData.logo_data}
                                                            alt="Logo"
                                                            className="object-contain"
                                                            style={{
                                                                width: `${formData.logo_size || 160}px`,
                                                                maxHeight: "100px"
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="text-xl font-bold p-2 bg-gray-100 rounded min-h-[40px] min-w-[100px] flex items-center justify-center">
                                                            {formData.company_name || ""}
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
                                                            max="200"
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
                                                            max="200"
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
                                        <Button type="submit" disabled={updateSettings.isPending} className="gap-2">
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
                                        <div className="flex items-center justify-between p-4 rounded-[6px] border border-border/50 bg-secondary/20">
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
                        </Tabs>
                </main>
            </div>
        </div>
    );
}
