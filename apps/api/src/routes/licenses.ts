import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { licenseActivateSchema, licenseCreateSchema, licenseVerifySchema } from "@sordi/schema";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { licensesRepo } from "../repositories/licenses.js";
import { env } from "../env.js";
import {
  generateClientReferenceId,
  generateLicenseKey,
  signLicenseToken,
  verifyLicenseToken,
} from "../services/licenseService.js";

export const licensesRouter = Router();

// Same generic message for "key doesn't exist", "expired", and "revoked" —
// on purpose (see the module's own requirement: don't give a caller
// enumerating keys any signal about which case they hit).
const GENERIC_INVALID = { error: "invalid_or_expired", message: "Invalid or expired license." };

licensesRouter.post(
  "/activate",
  asyncHandler(async (req, res) => {
    const parsed = licenseActivateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(GENERIC_INVALID);
      return;
    }
    const { licenseKey, deviceFingerprint } = parsed.data;

    const license = await licensesRepo.findByKey(licenseKey);
    const now = new Date();
    if (!license || license.status !== "active" || license.expiresAt < now) {
      res.status(400).json(GENERIC_INVALID);
      return;
    }

    const existingActivation = await licensesRepo.findActivation(license.id, deviceFingerprint);
    if (!existingActivation) {
      const deviceCount = await licensesRepo.countDevices(license.id);
      if (deviceCount >= license.maxDevices) {
        res.status(403).json({
          error: "device_limit_reached",
          message: `This license is already active on ${license.maxDevices} device(s). Deactivate one first, or contact support to increase the limit.`,
        });
        return;
      }
      await licensesRepo.recordActivation(license.id, deviceFingerprint);
    } else {
      await licensesRepo.touchLastVerified(existingActivation.id);
    }

    if (!license.activatedAt) {
      await licensesRepo.setActivatedAt(license.id);
    }

    const signedToken = signLicenseToken({ clientReferenceId: license.clientReferenceId, deviceFingerprint });
    res.json({
      signedToken,
      clientReferenceId: license.clientReferenceId,
      organizationName: license.organizationName,
    });
  })
);

licensesRouter.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const parsed = licenseVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(GENERIC_INVALID);
      return;
    }

    const payload = verifyLicenseToken(parsed.data.signedToken);
    if (!payload) {
      res.status(400).json(GENERIC_INVALID);
      return;
    }

    const license = await licensesRepo.findByClientReferenceId(payload.clientReferenceId);
    const now = new Date();
    if (!license || license.status !== "active" || license.expiresAt < now) {
      res.status(400).json(GENERIC_INVALID);
      return;
    }

    const activation = await licensesRepo.findActivation(license.id, payload.deviceFingerprint);
    if (activation) {
      await licensesRepo.touchLastVerified(activation.id);
    }

    const signedToken = signLicenseToken({
      clientReferenceId: license.clientReferenceId,
      deviceFingerprint: payload.deviceFingerprint,
    });
    res.json({ signedToken });
  })
);

// Manual admin auth — a shared secret header, not a user login. See
// LICENSING.md: there's no admin UI yet, this is called by hand per sale.
function requireAdminSecret(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["x-admin-secret"];
  if (header !== env.LICENSE_ADMIN_SECRET) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

licensesRouter.post(
  "/create",
  requireAdminSecret,
  asyncHandler(async (req, res) => {
    const parsed = licenseCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
      return;
    }
    const { organizationName, expiresAt, maxDevices } = parsed.data;

    const created = await licensesRepo.create({
      clientReferenceId: generateClientReferenceId(),
      licenseKey: generateLicenseKey(),
      organizationName,
      expiresAt: new Date(expiresAt),
      maxDevices: maxDevices ?? 2,
      status: "active",
    });

    // The only time the raw license_key is ever shown — comes straight
    // back in this response so you can hand it to the customer.
    res.status(201).json(created);
  })
);
