import { Router } from "express";
import { copilotParseRequestSchema, copilotResultSchema } from "@sordi/schema";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { env } from "../env.js";
import { parseHeuristically } from "../services/copilotHeuristic.js";
import { parseWithGemini } from "../services/copilotService.js";

export const copilotRouter = Router();

// Public — same trust model as GET /health and POST /licenses/request-trial:
// no admin secret, called directly by the desktop app's Dashboard input.
// Never persists anything itself; it only returns a structured suggestion
// the desktop app's own confirm step decides whether to act on.
copilotRouter.post(
  "/parse",
  asyncHandler(async (req, res) => {
    const parsed = copilotParseRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
      return;
    }
    const { text, context, fewShotExamples } = parsed.data;

    // Logged on every call (not just failures) — cheap, and multi-tenant
    // bugs (a fresh company with empty clients/suppliers/catalog arrays)
    // are otherwise invisible until something downstream breaks.
    console.log(
      `[Copilot] parse request — text="${text}" clients=${context.clients.length} suppliers=${context.suppliers.length} catalogItems=${context.catalogItems.length} categories=${context.categories.length}`
    );

    // Gemini failing (quota, rate limit, transient network) degrades to
    // the local heuristic rather than hard-failing the request — a worse
    // answer is still more useful than none, and this is exactly the kind
    // of failure a free-tier API key hits often. `usedAi` in the response
    // reflects what ACTUALLY answered this call, not just whether a key is
    // configured, so the desktop app could (if it wanted to) tell the user
    // which path served them.
    let raw: unknown;
    let usedAi = false;
    try {
      if (env.GEMINI_API_KEY) {
        try {
          raw = await parseWithGemini(text, context, fewShotExamples);
          usedAi = true;
        } catch (err) {
          console.error("[Copilot] Gemini call failed, falling back to heuristic:", err);
          raw = parseHeuristically(text, context);
        }
      } else {
        raw = parseHeuristically(text, context);
      }
    } catch (err) {
      // The heuristic path itself throwing (a regex/array edge case on a
      // genuinely unusual input) previously had no dedicated log line of
      // its own — it still reached the generic error middleware, but
      // without this route's own request context (text/company shape)
      // attached, which is exactly what's needed to diagnose a
      // multi-tenant-specific failure.
      console.error(`[Copilot] Both AI and heuristic parsing failed for text="${text}":`, err);
      res.status(500).json({
        error: "copilot_parse_crashed",
        message: "Une erreur inattendue est survenue lors de l'analyse. Réessayez.",
      });
      return;
    }

    // Authoritative normalization of CREATE_INVOICE's newClient — never
    // trusted from Gemini's own raw JSON (the heuristic path already sets
    // it correctly itself, but this runs unconditionally so both paths
    // are guaranteed consistent even if that ever changes). Computed here
    // rather than asking the model to keep two representations in sync.
    if (raw && typeof raw === "object" && "action" in raw && raw.action === "CREATE_INVOICE") {
      const invoice = raw as { isNewClient?: boolean; clientName?: string; newClient?: unknown };
      invoice.newClient = invoice.isNewClient ? { name: invoice.clientName } : null;
    }

    const result = copilotResultSchema.safeParse(raw);
    if (!result.success) {
      console.error("Copilot parse produced an invalid shape:", result.error.flatten(), raw);
      res.status(502).json({
        error: "copilot_invalid_result",
        message: "Impossible d'interpréter cette phrase. Essayez d'être plus précis (montant, client/fournisseur).",
      });
      return;
    }

    res.json({ result: result.data, usedAi });
  })
);
