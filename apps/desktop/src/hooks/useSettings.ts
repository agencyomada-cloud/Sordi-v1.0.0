
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
    company_legal_form?: string; // EURL, SARL, SPA, SNC, Auto-entrepreneur, ...
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
    body_pattern_data?: string;
    qr_code_data?: string;
    invoice_pdf_theme?: string; // 'structure' | 'epure' | 'moderne'
    invoice_pdf_font?: string; // 'montserrat' | 'inter' | 'poppins' | 'roboto' | 'cairo' | 'tajawal' — see INVOICE_PDF_FONTS
    // --- "Personnaliser" Smart Control Panel (InvoiceCustomizeDrawer) ---
    // All plain strings like every other key here, since this whole store is
    // a schemaless HashMap<String, String> on the Rust side (see
    // update_settings/get_settings in commands.rs) — no migration needed to
    // add a field, but booleans have no native representation and are
    // encoded as the literal strings "true"/"false" instead.
    show_stamp_signature?: string; // "true" | "false", default "true" — hides the cachet/signature from the live preview only (for printing blank invoices to stamp by hand); never touches stamp_data/signature_data themselves
    hide_empty_columns?: string; // "true" | "false", default TRUE — hides the Remise totals row when nothing was discounted (this was this app's unconditional, hardcoded behavior before this setting existed, so default true preserves it; false always shows the row, even at zero)
    show_amount_in_words?: string; // "true" | "false", default "false" — spell out the TTC total (legal/financial validity)
    pdf_backup_directory?: string; // local folder root for automated PDF backups (omada-agency branch only)
    smtp_email?: string; // Gmail sender address for in-app document email dispatch
    smtp_app_password?: string; // Gmail App Password (not the account password) for the address above
    current_language?: string; // 'fr' | 'ar' — workspace-wide UI language, see useLanguage
    // --- Sordi IQ (AI assistant) — see pages/SordiIQ.tsx and the
    // sordi_iq_chat Tauri command (src-tauri/src/sordi_iq.rs). The API key
    // is an OpenRouter key, entered by the user in Settings and stored here
    // like any other credential (smtp_app_password above) — never hardcoded
    // in source, never sent anywhere but the sordi_iq_chat command's own
    // OpenRouter request.
    sordi_iq_api_key?: string;
    sordi_iq_model?: string; // OpenRouter model slug, e.g. "anthropic/claude-3.5-sonnet" — see DEFAULT_MODEL in sordi_iq.rs
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
        company_legal_form: company.legal_form ?? undefined,
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
