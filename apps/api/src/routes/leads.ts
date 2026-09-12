import { Router } from "express";
import { leadDownloadSchema } from "@sordi/schema";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { leadsRepo } from "../repositories/leads.js";
import { notifyNewLead } from "../services/notifyService.js";
import { env } from "../env.js";

export const leadsRouter = Router();

const DOWNLOAD_URL_BY_OS = {
  macos: env.DOWNLOAD_URL_MACOS,
  windows: env.DOWNLOAD_URL_WINDOWS,
};

// Public — this is the landing page's download-modal submit target, called
// by anyone before they've ever installed the app, let alone activated it.
leadsRouter.post(
  "/download",
  asyncHandler(async (req, res) => {
    const parsed = leadDownloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
      return;
    }
    const { name, phone, company, osType } = parsed.data;

    const lead = await leadsRepo.create({ name, phone, company: company || null, osType });

    // Fire-and-forget — a slow/broken email provider must never delay or
    // fail the actual download response the visitor is waiting on.
    void notifyNewLead({ name, phone, company: lead.company, osType });

    res.status(201).json({ downloadUrl: DOWNLOAD_URL_BY_OS[osType] });
  })
);
