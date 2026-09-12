import "dotenv/config";
import { env } from "../env.js";

// Thin CLI wrapper around the real POST /admin/licenses/issue route — calls
// the running dev API over HTTP rather than re-implementing the signing/
// device-lookup logic here, so this always exercises the exact same code
// path a real admin request would (device lookup, 404-if-unseen, JWT
// signing, status flip to "active"). Requires the dev API to already be
// running (`pnpm dev` in this package) — this is an operator convenience
// script, not a server-embedded command.

const API_BASE_URL = process.env.SORDI_API_BASE_URL ?? `http://localhost:${env.PORT}`;

function printUsage(): void {
  console.error("Usage: pnpm issue-license <machine_id> [valid_days=365]");
  console.error("Example: pnpm issue-license SRD-BCBC-4BAC-0FC9 365");
}

async function main(): Promise<void> {
  const [machineId, validDaysArg] = process.argv.slice(2);

  if (!machineId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const validDays = validDaysArg ? Number.parseInt(validDaysArg, 10) : 365;
  if (!Number.isInteger(validDays) || validDays <= 0) {
    console.error(`Invalid valid_days: "${validDaysArg}" — must be a positive integer.`);
    process.exitCode = 1;
    return;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/admin/licenses/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": env.LICENSE_ADMIN_SECRET },
      body: JSON.stringify({ machineId, validDays }),
    });
  } catch (error) {
    console.error(`Could not reach the API at ${API_BASE_URL} — is "pnpm dev" running in apps/api?`);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  if (res.status === 404) {
    console.error(`No device found for machine_id "${machineId}".`);
    console.error("The desktop app must send at least one telemetry heartbeat before a license can be issued.");
    process.exitCode = 1;
    return;
  }

  if (res.status === 401) {
    console.error("Unauthorized — LICENSE_ADMIN_SECRET in this process's .env doesn't match the running API's.");
    process.exitCode = 1;
    return;
  }

  if (!res.ok) {
    console.error(`Unexpected response: ${res.status} ${res.statusText}`);
    console.error(await res.text());
    process.exitCode = 1;
    return;
  }

  const body = (await res.json()) as { token: string; machine_id: string; valid_until: string };

  console.log(`License issued for ${body.machine_id}, valid until ${body.valid_until}\n`);
  console.log("Paste this into the desktop app's \"Activer ma clé\" field:\n");
  console.log(body.token);
}

main();
