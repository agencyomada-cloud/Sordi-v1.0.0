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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid server environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Fix apps/api/.env (see apps/api/.env.example) before starting the API.");
}

export const env = parsed.data;
