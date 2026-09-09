
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, type Company } from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getCompanyPhoneList, getCompanyExtraInfoList } from "@/hooks/useActiveCompany";

export interface Settings {
    // Company-profile fields are the source of truth on the `companies`
    // table (see useActiveCompany) — mapped back onto these legacy key
    // names here so the many PDF/HTML document renderers that already
    // consume `settings.company_*` keep working unchanged.
    company_name?: string;
    legal_name?: string;
    company_address?: string;
    company_rc?: string;
    company_nif?: string;
    company_nis?: string;
    company_ai?: string;
    company_activity?: string;
    company_cnas_adherent?: string; // N° Adhérent CNAS — payroll/bulletin de paie only (omada-agency branch only)
    payroll_prime_panier_taux?: string; // daily rate (DA) — indemnité de panier, bulletin de paie only
    payroll_prime_transport?: string; // flat monthly amount (DA) — indemnité de transport, bulletin de paie only
    company_rib?: string;
    company_bg?: string; // Background color for the document
    primary_color?: string;
    logo_bg_color?: string;
    logo_text_color?: string;
    company_phone?: string;
    company_phones?: string[] | string;
    company_email?: string;
    company_website?: string;
    company_capital?: string;
    company_bank_agency?: string;
    company_extra_info?: string;
    logo_data?: string;
    logo_size?: string; // stored as string "64", "80" etc
    company_info_size?: string; // stored as string "9", "10" etc
    stamp_data?: string;
    stamp_size?: string; // stored as string "96", "120" etc
    signature_data?: string;
    signature_size?: string; // stored as string "96", "120" etc
    footer_logo_data?: string;
    body_pattern_data?: string;
    qr_code_data?: string;
    invoice_pdf_theme?: string; // 'structure' | 'epure' | 'moderne'
    invoice_pdf_font?: string; // 'montserrat' | 'inter' | 'poppins' | 'roboto'
    pdf_backup_directory?: string; // local folder root for automated PDF backups (omada-agency branch only)
    smtp_email?: string; // Gmail sender address for in-app document email dispatch
    smtp_app_password?: string; // Gmail App Password (not the account password) for the address above
    current_language?: string; // 'fr' | 'ar' — workspace-wide UI language, see useLanguage
    [key: string]: string | string[] | undefined;
}

/** Maps the active Company row back onto the legacy company_* Settings keys. */
function companyToSettingsFields(company: Company | null): Partial<Settings> {
    if (!company) return {};
    return {
        company_name: company.name,
        company_address: company.address ?? undefined,
        company_rc: company.rc ?? undefined,
        company_nif: company.nif ?? undefined,
        company_nis: company.nis ?? undefined,
        company_ai: company.article_imposition ?? undefined,
        company_activity: company.activity ?? undefined,
        company_cnas_adherent: company.cnas_adherent ?? undefined,
        company_rib: company.rib ?? undefined,
        company_phone: company.phone ?? undefined,
        company_phones: getCompanyPhoneList(company),
        company_email: company.email ?? undefined,
        company_website: company.website ?? undefined,
        company_capital: company.capital ?? undefined,
        company_bank_agency: company.bank_agency ?? undefined,
        company_extra_info: JSON.stringify(getCompanyExtraInfoList(company)),
        logo_data: company.logo_base64 ?? undefined,
    };
}

export const useSettings = () => {
    const { activeCompanyId, companies, isReady } = useWorkspace();
    const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? null;

    return useQuery({
        queryKey: ["settings", activeCompanyId],
        queryFn: async () => {
            const settings = await db.settings.get();
            return { ...settings, ...companyToSettingsFields(activeCompany) } as Settings;
        },
        enabled: isReady,
    });
};

export const useUpdateSetting = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ key, value }: { key: string; value: string }) => {
            await db.settings.update(key, value);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["settings"] });
        },
    });
};

export const useUpdateSettings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (settings: Partial<Settings>) => {
            await db.settings.updateAll(settings as Record<string, string>);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["settings"] });
        },
    });
};
