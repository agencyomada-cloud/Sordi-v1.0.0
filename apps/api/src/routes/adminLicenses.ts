import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { adminDeviceListQuerySchema, adminLicenseIssueSchema } from "@sordi/schema";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { devicesRepo } from "../repositories/devices.js";
import { env } from "../env.js";
import { signLicenseTokenWithTtl, generateClientReferenceId } from "../services/licenseService.js";

export const adminLicensesRouter = Router();

// Same manual-secret gate as licenses.ts's requireAdminSecret — a distinct
// header name (x-admin-key, per this endpoint's own spec) but the identical
// trust model: a shared secret you paste in by hand, not a user login.
// Exported for reuse by adminDevices.ts — every /admin/* route shares this
// one gate.
export function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["x-admin-key"];
  if (header !== env.LICENSE_ADMIN_SECRET) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

adminLicensesRouter.post(
  "/issue",
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const parsed = adminLicenseIssueSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
      return;
    }
    const { machineId, validDays, licenseType } = parsed.data;

    const device = await devicesRepo.findByMachineId(machineId);
    if (!device) {
      res.status(404).json({
        error: "device_not_found",
        message: "This machine ID has never sent a heartbeat — ask the customer to launch the app first.",
      });
      return;
    }

    const ttlSeconds = validDays * 24 * 60 * 60;
    const validUntil = new Date(Date.now() + ttlSeconds * 1000);

    // Devices never have a customer-facing client_reference_id of their own
    // (that concept belongs to `licenses`, a purchase record) — a fresh one
    // is minted here purely to fill the JWT claim license.rs expects; it has
    // no other row/meaning server-side and is never shown to the customer.
    // The token's own exp is set to the actual purchased term (validDays),
    // not signLicenseToken's fixed 35-day online-reverification window.
    const token = signLicenseTokenWithTtl(
      { clientReferenceId: generateClientReferenceId(), deviceFingerprint: device.deviceFingerprint },
      ttlSeconds
    );

    // licenseType defaults to "yearly" unless the caller explicitly asked
    // for a lifetime term (the admin portal's duration select always sends
    // one explicitly; this default only matters for a bare CLI call).
    await devicesRepo.activate(machineId, validUntil, licenseType ?? "yearly");

    res.json({ token, machine_id: machineId, valid_until: validUntil.toISOString() });
  })
);
