import { getAdminKey } from "./adminAuth";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class AdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Thin fetch wrapper — attaches the admin key from sessionStorage (see
 *  adminAuth.ts) as x-admin-key on every call, since that's the same header
 *  apps/api's requireAdminKey checks for every /admin/* route. A 401 here
 *  always means the stored key is wrong/stale, never an expired session
 *  (there is no session — the key itself IS the credential). */
async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const adminKey = getAdminKey();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(adminKey ? { "x-admin-key": adminKey } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "message" in body && typeof body.message === "string" && body.message) ||
      (body && typeof body === "object" && "error" in body && typeof body.error === "string" && body.error) ||
      `Request failed (${res.status})`;
    throw new AdminApiError(res.status, message);
  }

  return body as T;
}

export type DeviceStatus = "trial" | "active" | "expired";

export interface DeviceRow {
  id: string;
  machineId: string;
  deviceFingerprint: string;
  appVersion: string;
  customerName: string | null;
  email: string | null;
  phoneNumber: string | null;
  osPlatform: string | null;
  invoicesCount: number;
  clientsCount: number;
  expensesCount: number;
  status: DeviceStatus;
  effectiveStatus: DeviceStatus;
  licenseType: "yearly" | "lifetime" | null;
  validUntil: string | null;
  downloadedAt: string;
  lastActiveAt: string | null;
  lastSeenAt: string;
  createdAt: string;
}

export const adminApi = {
  listDevices: (search?: string, status?: DeviceStatus) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const qs = params.toString();
    return adminFetch<{ devices: DeviceRow[] }>(`/admin/devices${qs ? `?${qs}` : ""}`);
  },

  issueLicense: (machineId: string, validDays: number, licenseType: "yearly" | "lifetime") =>
    adminFetch<{ token: string; machine_id: string; valid_until: string }>("/admin/licenses/issue", {
      method: "POST",
      body: JSON.stringify({ machineId, validDays, licenseType }),
    }),

  updateDevice: (machineId: string, data: { customerName?: string; email?: string; phoneNumber?: string }) =>
    adminFetch<{ device: DeviceRow }>(`/admin/devices/${encodeURIComponent(machineId)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listLeads: () => adminFetch<{ leads: LeadRow[] }>("/admin/leads"),
};

export interface LeadRow {
  id: string;
  name: string;
  phone: string;
  company: string | null;
  osType: "macos" | "windows";
  createdAt: string;
}
