import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { leadsRepo } from "../repositories/leads.js";
import { requireAdminKey } from "./adminLicenses.js";

export const adminLeadsRouter = Router();

// Backs both the admin portal's "Prospects / Leads" tab and its
// notification-bell polling (which just diffs this list's newest id/count
// against what it last saw — see apps/admin's useLeadNotifications).
adminLeadsRouter.get(
  "/",
  requireAdminKey,
  asyncHandler(async (_req, res) => {
    const rows = await leadsRepo.listRecent();
    res.json({ leads: rows });
  })
);
