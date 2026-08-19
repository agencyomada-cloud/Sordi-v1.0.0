
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/database";

export interface Settings {
    company_name: string;
    company_address: string;
    company_rc: string;
    company_nif: string;
    company_nis: string;
    company_ai: string;
    company_rib: string;
    company_bg?: string; // Background color for the document
    primary_color?: string;
    logo_bg_color?: string;
    logo_text_color?: string;
    company_phone?: string;
    company_phones?: string[] | string;
    company_email?: string; // Contact info
    company_website?: string;
    company_activity?: string;
    company_capital?: string;
    company_bank_agency?: string;
    company_extra_info?: string; // More details like "Capital Social", "Agrément", etc.
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
    [key: string]: string | string[] | undefined;
}

export const useSettings = () => {
    return useQuery({
        queryKey: ["settings"],
        queryFn: async () => {
            const settings = await db.settings.get();
            return settings as Settings;
        },
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
