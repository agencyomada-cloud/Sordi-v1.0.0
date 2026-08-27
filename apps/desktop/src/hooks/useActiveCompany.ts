import { useMutation, useQueryClient } from "@tanstack/react-query";
import { db, type Company, type CreateCompanyData } from "@/lib/database";
import { useWorkspace } from "@/hooks/useWorkspace";

// Company-profile fields (name, logo, fiscal identity, contact info) live on
// the active `companies` row — the source of truth for anything printed on
// an invoice/delivery-note header or footer. Unrelated settings (PDF theme,
// security, SMTP, sounds, styling) stay in the flat `settings` store via
// useSettings — this hook only ever touches the active Company.
export function useActiveCompany() {
  const { activeCompanyId, companies, isReady } = useWorkspace();
  const company = companies.find((c) => c.id === activeCompanyId) ?? null;
  return { company, isReady };
}

export function useUpdateActiveCompany() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useWorkspace();

  return useMutation({
    mutationFn: async (data: CreateCompanyData): Promise<Company> => {
      return await db.companies.update(activeCompanyId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

// Parses a Company's JSON-encoded `phones` column into a plain string[],
// falling back to the single `phone` field or an empty list — mirrors the
// old company_phones/company_phone dual-key parsing that used to live in
// each PDF/HTML shared helper.
export function getCompanyPhoneList(company: Pick<Company, "phone" | "phones"> | null | undefined): string[] {
  if (!company) return [];
  if (company.phones) {
    try {
      const parsed = JSON.parse(company.phones);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fall through to single phone
    }
  }
  return company.phone ? [company.phone] : [];
}

// Parses a Company's JSON-encoded `extra_info` column into a plain
// string[], mirroring company_extra_info's old JSON-list handling.
export function getCompanyExtraInfoList(company: Pick<Company, "extra_info"> | null | undefined): string[] {
  if (!company?.extra_info) return [];
  try {
    const parsed = JSON.parse(company.extra_info);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
