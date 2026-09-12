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

export const webApi = {
  submitDownloadLead: async (input: DownloadLeadInput): Promise<{ downloadUrl: string }> => {
    const res = await fetch(`${API_BASE_URL}/leads/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        (body && typeof body === "object" && "message" in body && typeof body.message === "string" && body.message) ||
        "Une erreur est survenue. Réessayez.";
      throw new WebApiError(res.status, message);
    }

    return body as { downloadUrl: string };
  },
};
