// `?? fallback` alone isn't enough: some hosts (Dokploy included) pass an
// unset build arg through as an empty string rather than omitting it
// entirely, and "" ?? fallback still evaluates to "" since "" is not
// null/undefined. That silently turned every API call into a same-origin
// relative request (fetch("/licenses") against sordi.app itself, not
// api.sordi.app) instead of failing loudly — treat blank the same as unset.
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export class WebApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type ContactStatus = "a_contacter" | "en_cours" | "converti" | "non_interesse";

export interface GenerateLicenseInput {
  organizationName: string;
  phone: string;
  email: string;
  expiresAt: string;
  maxDevices?: number;
}

export interface GeneratedLicenseResult {
  licenseKey: string;
  organizationName: string;
  expiresAt: string;
}

export interface License {
  id: string;
  clientReferenceId: string;
  licenseKey: string;
  organizationName: string;
  phone: string | null;
  email: string | null;
  activatedAt: string | null;
  expiresAt: string;
  maxDevices: number;
  status: "active" | "expired" | "revoked";
  contactStatus: ContactStatus;
  createdAt: string;
  deviceCount: number;
}

async function parseJsonError(res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  const message =
    (body && typeof body === "object" && "message" in body && typeof body.message === "string" && body.message) ||
    "Une erreur est survenue. Réessayez.";
  throw new WebApiError(res.status, message);
}

export const webApi = {
  generateLicense: async (input: GenerateLicenseInput, adminSecret: string): Promise<GeneratedLicenseResult> => {
    const res = await fetch(`${API_BASE_URL}/licenses/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) return parseJsonError(res);

    return res.json();
  },

  listLicenses: async (adminSecret: string, search?: string): Promise<{ licenses: License[] }> => {
    const url = new URL(`${API_BASE_URL}/licenses`);
    if (search) url.searchParams.set("search", search);

    const res = await fetch(url, {
      headers: { "x-admin-secret": adminSecret },
    });

    if (!res.ok) return parseJsonError(res);

    return res.json();
  },

  revokeLicense: async (id: string, adminSecret: string): Promise<{ license: License }> => {
    const res = await fetch(`${API_BASE_URL}/licenses/${id}/revoke`, {
      method: "PATCH",
      headers: { "x-admin-secret": adminSecret },
    });

    if (!res.ok) return parseJsonError(res);

    return res.json();
  },

  extendLicense: async (id: string, days: number, adminSecret: string): Promise<{ license: License }> => {
    const res = await fetch(`${API_BASE_URL}/licenses/${id}/extend`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({ days }),
    });

    if (!res.ok) return parseJsonError(res);

    return res.json();
  },

  updateContactStatus: async (
    id: string,
    contactStatus: ContactStatus,
    adminSecret: string
  ): Promise<{ license: License }> => {
    const res = await fetch(`${API_BASE_URL}/licenses/${id}/contact-status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({ contactStatus }),
    });

    if (!res.ok) return parseJsonError(res);

    return res.json();
  },
};
