const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class WebApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface DownloadLeadInput {
  name: string;
  phone: string;
  company?: string;
  osType: "macos" | "windows";
}

export interface GenerateLicenseInput {
  organizationName: string;
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
  activatedAt: string | null;
  expiresAt: string;
  maxDevices: number;
  status: "active" | "expired" | "revoked";
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
  submitDownloadLead: async (input: DownloadLeadInput): Promise<{ downloadUrl: string }> => {
    const res = await fetch(`${API_BASE_URL}/leads/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) return parseJsonError(res);

    return res.json();
  },

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
};
