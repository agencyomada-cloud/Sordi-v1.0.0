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
export type PlanType = "trial" | "annual" | "lifetime";

export interface GenerateLicenseInput {
  organizationName: string;
  phone: string;
  email: string;
  expiresAt: string;
  maxDevices?: number;
  planType?: PlanType;
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
  planType: PlanType;
  createdAt: string;
  updatedAt: string;
  deviceCount: number;
  deviceFingerprints: string[];
}

export interface DeviceActivation {
  id: string;
  licenseId: string;
  deviceFingerprint: string;
  activatedAt: string;
  lastVerifiedAt: string;
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

  // Hard delete — for resetting a test machine's device fingerprint so it
  // can restart onboarding from zero, distinct from revoke (which only
  // marks the license inactive but leaves the row and its activation on
  // record).
  deleteLicense: async (id: string, adminSecret: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/licenses/${id}`, {
      method: "DELETE",
      headers: { "x-admin-secret": adminSecret },
    });

    if (!res.ok) return parseJsonError(res);
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

  // Manual override for the rare miscategorized case — doesn't touch
  // expiresAt or contactStatus, just the plan identity itself.
  updatePlanType: async (id: string, planType: PlanType, adminSecret: string): Promise<{ license: License }> => {
    const res = await fetch(`${API_BASE_URL}/licenses/${id}/plan-type`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({ planType }),
    });

    if (!res.ok) return parseJsonError(res);

    return res.json();
  },

  // Device-quota stepper next to the "N/M postes" table column — the API
  // refuses (409) a value below the license's current activation count.
  updateMaxDevices: async (id: string, maxDevices: number, adminSecret: string): Promise<{ license: License }> => {
    const res = await fetch(`${API_BASE_URL}/licenses/${id}/max-devices`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({ maxDevices }),
    });

    if (!res.ok) return parseJsonError(res);

    return res.json();
  },

  // Atomic "extend + mark paid" — replaces composing extendLicense +
  // updateContactStatus as two separate calls, which never updated
  // planType and left a converted license looking like a trial forever
  // from the desktop app's perspective.
  convertToPaid: async (
    id: string,
    days: number,
    planType: "annual" | "lifetime",
    adminSecret: string
  ): Promise<{ license: License }> => {
    const res = await fetch(`${API_BASE_URL}/licenses/${id}/convert-to-paid`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({ days, planType }),
    });

    if (!res.ok) return parseJsonError(res);

    return res.json();
  },

  listActivations: async (id: string, adminSecret: string): Promise<{ activations: DeviceActivation[] }> => {
    const res = await fetch(`${API_BASE_URL}/licenses/${id}/activations`, {
      headers: { "x-admin-secret": adminSecret },
    });

    if (!res.ok) return parseJsonError(res);

    return res.json();
  },

  // "Délier l'appareil" — frees one device slot without touching the
  // license itself.
  unlinkDevice: async (id: string, deviceFingerprint: string, adminSecret: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/licenses/${id}/activations`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({ deviceFingerprint }),
    });

    if (!res.ok) return parseJsonError(res);
  },
};
