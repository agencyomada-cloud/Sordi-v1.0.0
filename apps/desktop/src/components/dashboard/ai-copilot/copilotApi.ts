import type { CopilotContext, CopilotFewShotExample, CopilotResult } from "./types";

// Dev-only hardcoded default — mirrors license.rs's own
// DEFAULT_API_BASE_URL fallback exactly (this app's Rust side already
// defaults to http://localhost:4000 when SORDI_LICENSE_API_URL isn't set
// at build time). Before this feature ships in a real release build, this
// needs the same build-time override treatment licensing already has
// (compiled-in via an env var, not read at runtime) — tracked here rather
// than silently shipping a hardcoded localhost URL.
const COPILOT_API_BASE_URL = "http://localhost:4000";

export class CopilotApiError extends Error {}

/** POST /copilot/parse — see apps/api/src/routes/copilot.ts. Throws
 *  CopilotApiError with a user-facing French message on any failure
 *  (network down, invalid_request, or the server's own upstream/shape
 *  errors), so the caller can show it directly in the review drawer.
 *  `fewShotExamples` — this user's own recent corrections (see
 *  copilotMemory.ts) — is optional and only ever sent, never required.
 *
 *  Every failure path logs the real underlying detail to the console
 *  before throwing the user-facing message — the generic French text
 *  alone previously made "did the fetch itself fail, or did the server
 *  respond with an error?" impossible to tell from the UI, which masked
 *  a real bug during multi-tenant testing (see the commit that added
 *  this comment). */
export async function analyzeCopilotText(
  text: string,
  context: CopilotContext,
  fewShotExamples?: CopilotFewShotExample[]
): Promise<CopilotResult> {
  let response: Response;
  try {
    response = await fetch(`${COPILOT_API_BASE_URL}/copilot/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, context, fewShotExamples }),
    });
  } catch (err) {
    // This is a TRUE network-level failure — the request never got a
    // response at all (connection refused, DNS failure, or a CORS
    // preflight rejection, which browsers/webviews also surface as a
    // plain "failed to fetch" with no further detail of their own).
    console.error("[Copilot] fetch to /copilot/parse failed before any response was received:", err);
    throw new CopilotApiError("Impossible de contacter le service d'analyse. Vérifiez votre connexion.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    console.error(`[Copilot] /copilot/parse responded with HTTP ${response.status}:`, body);
    throw new CopilotApiError(body?.message || `L'analyse a échoué (HTTP ${response.status}). Réessayez.`);
  }

  const body = (await response.json()) as { result: CopilotResult };
  return body.result;
}
