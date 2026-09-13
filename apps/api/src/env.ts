import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be set to a real secret"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be set to a real secret"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  // Ed25519 private key (PKCS8 PEM), literal "\n" for line breaks — the
  // desktop app only ever holds the matching PUBLIC key (compiled in), so
  // this is the one place a license token can be forged. Never the same
  // key as JWT_ACCESS_SECRET/JWT_REFRESH_SECRET's symmetric scheme.
  LICENSE_PRIVATE_KEY_PEM: z.string().min(1, "LICENSE_PRIVATE_KEY_PEM is required"),
  // Shared secret for the one manual admin endpoint (POST /licenses/create)
  // — not a user login, just enough to keep it off the open internet until
  // there's a real admin UI/account system.
  LICENSE_ADMIN_SECRET: z.string().min(16, "LICENSE_ADMIN_SECRET must be set to a real secret"),

  // Lead-download notification email (see services/notifyService.ts) — both
  // optional, and tolerant of an empty string too, not just an absent key:
  // some hosts (Dokploy included) always set every declared env var, using
  // "" for one left blank in the UI, which is a defined-but-empty string,
  // not undefined — .optional() alone doesn't let that through .min(1)/
  // .email(), so the empty case is caught first and normalized to
  // undefined before the real check runs.
  RESEND_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  ADMIN_NOTIFICATION_EMAIL: z.preprocess((v) => (v === "" ? undefined : v), z.string().email().optional()),

  // Landing page download CTAs (apps/web) — placeholder targets until real
  // installer artifacts are hosted somewhere. Defaulted rather than
  // required so the API and web app still boot without them configured.
  DOWNLOAD_URL_MACOS: z.string().min(1).default("/downloads/sordi-invoicing-mac.dmg"),
  DOWNLOAD_URL_WINDOWS: z.string().min(1).default("/downloads/sordi-invoicing-windows.exe"),

  // GET /releases/latest (apps/desktop's in-app update check). The desktop
  // app is a Tauri webview, not a browser tab already on sordi.app like
  // apps/web is — DOWNLOAD_URL_MACOS's relative path only resolves
  // correctly there. SITE_ORIGIN prefixes it into an absolute URL for the
  // "Télécharger la mise à jour" link that opens in the user's browser.
  SITE_ORIGIN: z.string().min(1).default("https://sordi.app"),
  // Current build's version and changelog text — bumped by hand alongside
  // apps/desktop/package.json and src-tauri/tauri.conf.json on every
  // release, kept in sync manually (same pattern as this file's other
  // hand-maintained constants).
  LATEST_APP_VERSION: z.string().min(1).default("1.0.0"),
  RELEASE_NOTES: z.string().default(""),

  // POST /copilot/parse (apps/desktop's Dashboard AI input) — optional by
  // design: without it, the route falls back to a local keyword/regex
  // heuristic (see services/copilotHeuristic.ts) instead of refusing to
  // boot, the same "degrade gracefully rather than hard-require" choice
  // already made for RESEND_API_KEY above.
  GEMINI_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid server environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Fix apps/api/.env (see apps/api/.env.example) before starting the API.");
}

export const env = parsed.data;
