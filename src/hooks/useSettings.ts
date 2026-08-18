
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export interface Settings {
    company_name: string;
    company_address: string;
    company_rc: string;
    company_nif: string;
    company_nis: string;
    company_ai: string;
    company_rib: string;
    company_bg?: string; // Background color for the document
    logo_bg_color?: string;
    logo_text_color?: string;
    company_phone?: string;
    company_phones?: string[] | string;
    company_email?: string; // Contact info
    company_extra_info?: string; // More details like "Capital Social", "Agrément", etc.
    logo_data?: string;
    logo_size?: string; // stored as string "64", "80" etc
    company_info_size?: string; // stored as string "9", "10" etc
    stamp_data?: string;
    stamp_size?: string; // stored as string "96", "120" etc
    signature_data?: string;
    signature_size?: string; // stored as string "96", "120" etc
    [key: string]: string | string[] | undefined;
}

export const useSettings = () => {
    return useQuery({
        queryKey: ["settings"],
        queryFn: async () => {
            const settings = await invoke<Settings>("get_settings");
            return settings;
        },
    });
};

export const useUpdateSetting = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ key, value }: { key: string; value: string }) => {
            await invoke("update_setting", { key, value });
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
            await invoke("update_settings", { settings });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["settings"] });
        },
    });
};
