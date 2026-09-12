import { Router } from "express";
import { telemetryHeartbeatSchema } from "@sordi/schema";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { devicesRepo } from "../repositories/devices.js";

export const telemetryRouter = Router();

// Public, unauthenticated by design — see telemetry.rs's own doc comment:
// this is the anonymous, disclosed heartbeat, not an authenticated device
// registration. No PII in the schema, so there's nothing sensitive to gate.
// 204 with no body and no response-shaping work keeps this fast and lets a
// client that ignores the response (telemetry.rs swallows every failure
// path anyway) move on immediately.
telemetryRouter.post(
  "/heartbeat",
  asyncHandler(async (req, res) => {
    const parsed = telemetryHeartbeatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(204).end();
      return;
    }
    const { machine_id, device_fingerprint, app_version, invoices_count, clients_count, expenses_count, os_platform, last_active_at } =
      parsed.data;

    await devicesRepo.upsertHeartbeat({
      machineId: machine_id,
      deviceFingerprint: device_fingerprint,
      appVersion: app_version,
      invoicesCount: invoices_count,
      clientsCount: clients_count,
      expensesCount: expenses_count,
      osPlatform: os_platform,
      lastActiveAt: last_active_at ? new Date(last_active_at) : undefined,
    });

    res.status(204).end();
  })
);
