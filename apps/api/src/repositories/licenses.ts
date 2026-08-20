import { and, count, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { licenseActivations, licenses } from "@sordi/schema";

export type NewLicenseInput = Omit<typeof licenses.$inferInsert, "id" | "createdAt" | "activatedAt">;

// Unlike clients/products (org-scoped, see clients.ts's comment), licenses
// are looked up globally by licenseKey/clientReferenceId — there is no
// tenant to scope by yet, the customer hasn't logged into anything.

export const licensesRepo = {
  findByKey: (licenseKey: string) =>
    db.select().from(licenses).where(eq(licenses.licenseKey, licenseKey)).then((rows) => rows[0] ?? null),

  findByClientReferenceId: (clientReferenceId: string) =>
    db
      .select()
      .from(licenses)
      .where(eq(licenses.clientReferenceId, clientReferenceId))
      .then((rows) => rows[0] ?? null),

  create: (data: NewLicenseInput) =>
    db
      .insert(licenses)
      .values(data)
      .returning()
      .then((rows) => rows[0]),

  // Caller checks `license.activatedAt === null` first (route already has
  // the row in hand) — only ever set once, on the very first activation.
  setActivatedAt: (licenseId: string) =>
    db.update(licenses).set({ activatedAt: new Date() }).where(eq(licenses.id, licenseId)),

  // Distinct devices already activated for this license — re-activating an
  // already-known device_fingerprint must not count against max_devices
  // twice, hence a count of activation rows (one per unique fingerprint,
  // enforced by the license_activations_license_device_idx unique index),
  // not a count of activation *events*.
  countDevices: (licenseId: string) =>
    db
      .select({ value: count() })
      .from(licenseActivations)
      .where(eq(licenseActivations.licenseId, licenseId))
      .then((rows) => rows[0]?.value ?? 0),

  findActivation: (licenseId: string, deviceFingerprint: string) =>
    db
      .select()
      .from(licenseActivations)
      .where(and(eq(licenseActivations.licenseId, licenseId), eq(licenseActivations.deviceFingerprint, deviceFingerprint)))
      .then((rows) => rows[0] ?? null),

  recordActivation: (licenseId: string, deviceFingerprint: string) =>
    db
      .insert(licenseActivations)
      .values({ licenseId, deviceFingerprint })
      .returning()
      .then((rows) => rows[0]),

  touchLastVerified: (id: string) =>
    db.update(licenseActivations).set({ lastVerifiedAt: new Date() }).where(eq(licenseActivations.id, id)),
};
