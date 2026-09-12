import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import {
  licenseActivateSchema,
  licenseContactStatusSchema,
  licenseConvertToPaidSchema,
  licenseCreateSchema,
  licenseExtendSchema,
  licenseListQuerySchema,
  licensePlanTypeSchema,
  licenseRequestTrialSchema,
  licenseVerifySchema,
} from "@sordi/schema";
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

    const signedToken = signLicenseToken({
      clientReferenceId: license.clientReferenceId,
      deviceFingerprint,
      realExpiresAt: Math.floor(license.expiresAt.getTime() / 1000),
      planType: license.planType,
    });
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
      realExpiresAt: Math.floor(license.expiresAt.getTime() / 1000),
      planType: license.planType,
    });
    res.json({ signedToken });
  })
);

const TRIAL_DAYS = 14;

// Public — the desktop app's first-launch "no license yet" screen posts
// here directly, no admin secret involved (mirrors /leads/download's trust
// model: anyone can call this, it just creates a row). Unlike /create, this
// immediately unlocks a working trial (a signed token comes back in the
// response) rather than only registering interest — contactStatus stays
// "a_contacter" purely for the sales team's own follow-up/conversion
// pipeline, not as a gate on using the trial itself.
licensesRouter.post(
  "/request-trial",
  asyncHandler(async (req, res) => {
    const parsed = licenseRequestTrialSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
      return;
    }
    const { organizationName, phone, email, deviceFingerprint } = parsed.data;

    const expiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const created = await licensesRepo.create({
      clientReferenceId: generateClientReferenceId(),
      licenseKey: generateLicenseKey(),
      organizationName,
      phone,
      email,
      expiresAt,
      maxDevices: 2,
      status: "active",
      contactStatus: "a_contacter",
      planType: "trial",
    });

    if (deviceFingerprint) {
      await licensesRepo.recordActivation(created.id, deviceFingerprint);
      await licensesRepo.setActivatedAt(created.id);
    }

    const signedToken = deviceFingerprint
      ? signLicenseToken({
          clientReferenceId: created.clientReferenceId,
          deviceFingerprint,
          realExpiresAt: Math.floor(created.expiresAt.getTime() / 1000),
          planType: "trial",
        })
      : null;

    res.status(201).json({
      signedToken,
      clientReferenceId: created.clientReferenceId,
      organizationName: created.organizationName,
      expiresAt: created.expiresAt,
    });
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
    const { organizationName, phone, email, expiresAt, maxDevices, planType } = parsed.data;

    const created = await licensesRepo.create({
      clientReferenceId: generateClientReferenceId(),
      licenseKey: generateLicenseKey(),
      organizationName,
      phone: phone ?? null,
      email: email ?? null,
      expiresAt: new Date(expiresAt),
      maxDevices: maxDevices ?? 2,
      status: "active",
      contactStatus: "a_contacter",
      planType: planType ?? "trial",
    });

    // The only time the raw license_key is ever shown — comes straight
    // back in this response so you can hand it to the customer.
    res.status(201).json(created);
  })
);

// Admin dashboard's license table. Same requireAdminSecret gate as /create —
// this whole router shares one trust model (a shared secret pasted in by
// hand), unlike adminLicenses.ts's separate x-admin-key header for the
// unrelated devices/issue flow.
licensesRouter.get(
  "/",
  requireAdminSecret,
  asyncHandler(async (req, res) => {
    const parsed = licenseListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
      return;
    }
    const rows = await licensesRepo.list(parsed.data);
    res.json({ licenses: rows });
  })
);

licensesRouter.patch(
  "/:id/revoke",
  requireAdminSecret,
  asyncHandler(async (req, res) => {
    const existing = await licensesRepo.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "license_not_found" });
      return;
    }
    const updated = await licensesRepo.revoke(req.params.id);
    res.json({ license: updated });
  })
);

licensesRouter.patch(
  "/:id/extend",
  requireAdminSecret,
  asyncHandler(async (req, res) => {
    const parsed = licenseExtendSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
      return;
    }
    const existing = await licensesRepo.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "license_not_found" });
      return;
    }
    const updated = await licensesRepo.extend(req.params.id, parsed.data.days);
    res.json({ license: updated });
  })
);

licensesRouter.patch(
  "/:id/contact-status",
  requireAdminSecret,
  asyncHandler(async (req, res) => {
    const parsed = licenseContactStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
      return;
    }
    const existing = await licensesRepo.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "license_not_found" });
      return;
    }
    const updated = await licensesRepo.updateContactStatus(req.params.id, parsed.data.contactStatus);
    res.json({ license: updated });
  })
);

licensesRouter.patch(
  "/:id/plan-type",
  requireAdminSecret,
  asyncHandler(async (req, res) => {
    const parsed = licensePlanTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
      return;
    }
    const existing = await licensesRepo.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "license_not_found" });
      return;
    }
    const updated = await licensesRepo.updatePlanType(req.params.id, parsed.data.planType);
    res.json({ license: updated });
  })
);

// Atomic "extend + mark paid" — see licensesRepo.convertToPaid's doc
// comment for why this replaced composing /extend and /contact-status as
// two separate admin-dashboard calls (it never touched planType, so a
// converted license stayed "trial" forever from the desktop app's
// perspective).
licensesRouter.patch(
  "/:id/convert-to-paid",
  requireAdminSecret,
  asyncHandler(async (req, res) => {
    const parsed = licenseConvertToPaidSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
      return;
    }
    const existing = await licensesRepo.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "license_not_found" });
      return;
    }
    const updated = await licensesRepo.convertToPaid(req.params.id, parsed.data.days, parsed.data.planType);
    res.json({ license: updated });
  })
);

// Hard delete — lets the same test machine restart onboarding from zero
// (a fresh POST /licenses/request-trial), unlike /revoke which only marks
// the row inactive but leaves it (and its device activation) on record.
licensesRouter.delete(
  "/:id",
  requireAdminSecret,
  asyncHandler(async (req, res) => {
    const existing = await licensesRepo.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "license_not_found" });
      return;
    }
    await licensesRepo.remove(req.params.id);
    res.status(204).send();
  })
);
