import { Router } from "express";
import { adminDeviceListQuerySchema, adminDeviceUpdateSchema } from "@sordi/schema";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { devicesRepo } from "../repositories/devices.js";
import { requireAdminKey } from "./adminLicenses.js";

export const adminDevicesRouter = Router();

// The admin portal's device list/search/filter — same requireAdminKey gate
// as /admin/licenses/issue. Read-only, so a plain GET with query params
// rather than a POST body: easy to hit directly from a browser address bar.
adminDevicesRouter.get(
  "/",
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const parsed = adminDeviceListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
      return;
    }
    const { search, limit, status } = parsed.data;

    const rows = await devicesRepo.list(search, limit, status);
    res.json({ devices: rows });
  })
);

// Attaches customer contact info to a device record — done by hand after a
// sale/support conversation identifies who's behind a machine_id. Never
// called by the desktop app itself (telemetry.rs's heartbeat stays
// anonymous by design); this is purely an admin/CRM action.
adminDevicesRouter.patch(
  "/:machineId",
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const parsed = adminDeviceUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
      return;
    }

    const updated = await devicesRepo.update(req.params.machineId, parsed.data);
    if (!updated) {
      res.status(404).json({ error: "device_not_found" });
      return;
    }

    res.json({ device: updated });
  })
);
