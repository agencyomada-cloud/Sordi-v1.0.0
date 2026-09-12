import { and, count, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { licenseActivations, licenses } from "@sordi/schema";

export type NewLicenseInput = Omit<typeof licenses.$inferInsert, "id" | "createdAt" | "activatedAt" | "updatedAt">;

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

  // Every device fingerprint activated against a license, for the admin
  // dashboard's "Voir détails" panel (support needs the raw fingerprint to
  // help a customer who's hit their device quota figure out which machine
  // to unlink).
  listActivations: (licenseId: string) =>
    db
      .select()
      .from(licenseActivations)
      .where(eq(licenseActivations.licenseId, licenseId))
      .orderBy(desc(licenseActivations.activatedAt)),

  // "Délier l'appareil" — frees one device slot without touching the
  // license itself (distinct from remove() below, which deletes the whole
  // license and cascades every activation). Scoped by licenseId too, not
  // just the activation's own id, so a caller can't accidentally unlink a
  // device belonging to a DIFFERENT license by guessing/reusing an id.
  removeActivation: (licenseId: string, deviceFingerprint: string) =>
    db
      .delete(licenseActivations)
      .where(and(eq(licenseActivations.licenseId, licenseId), eq(licenseActivations.deviceFingerprint, deviceFingerprint)))
      .returning()
      .then((rows) => rows[0] ?? null),

  // Admin dashboard's license table. Joins in the live activation count AND
  // the actual fingerprints per license (not stored columns — recomputed
  // from license_activations each time) so both "2 / 2 appareils" and the
  // dashboard's device-fingerprint search stay accurate without a
  // separate round trip per license. Newest first, since that's the order
  // a salesperson wants to find "the license I just created."
  list: (opts: { search?: string; limit?: number } = {}) => {
    const conditions = opts.search ? [ilike(licenses.organizationName, `%${opts.search}%`)] : [];
    return db
      .select({
        id: licenses.id,
        clientReferenceId: licenses.clientReferenceId,
        licenseKey: licenses.licenseKey,
        organizationName: licenses.organizationName,
        phone: licenses.phone,
        email: licenses.email,
        activatedAt: licenses.activatedAt,
        expiresAt: licenses.expiresAt,
        maxDevices: licenses.maxDevices,
        status: licenses.status,
        contactStatus: licenses.contactStatus,
        planType: licenses.planType,
        createdAt: licenses.createdAt,
        updatedAt: licenses.updatedAt,
        deviceCount: sql<number>`coalesce(${db
          .select({ value: count() })
          .from(licenseActivations)
          .where(eq(licenseActivations.licenseId, licenses.id))}, 0)`,
        deviceFingerprints: sql<string[]>`coalesce(${db
          .select({ value: sql`array_agg(${licenseActivations.deviceFingerprint})` })
          .from(licenseActivations)
          .where(eq(licenseActivations.licenseId, licenses.id))}, array[]::text[])`,
      })
      .from(licenses)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(licenses.createdAt))
      .limit(opts.limit ?? 100);
  },

  findById: (id: string) =>
    db.select().from(licenses).where(eq(licenses.id, id)).then((rows) => rows[0] ?? null),

  // Manual, admin-triggered — the `revoked` enum value has existed in the
  // schema since the first migration but nothing wrote it until now (see
  // licenses.ts route comment history). Once revoked, /licenses/activate
  // and /verify's `status !== "active"` check already rejects it — no
  // change needed on that side.
  revoke: (id: string) =>
    db.update(licenses).set({ status: "revoked", updatedAt: new Date() }).where(eq(licenses.id, id)).returning().then((rows) => rows[0] ?? null),

  // Adds `days` on top of the CURRENT expiresAt (read-modify-write in one
  // round trip via SQL interval arithmetic), not "now + days" — a license
  // extended before it expires should keep its remaining time, and one
  // extended after expiring should extend from its original expiry, not
  // from the moment of the call.
  extend: (id: string, days: number) =>
    db
      .update(licenses)
      .set({ expiresAt: sql`${licenses.expiresAt} + (${days} * interval '1 day')`, updatedAt: new Date() })
      .where(eq(licenses.id, id))
      .returning()
      .then((rows) => rows[0] ?? null),

  updateContactStatus: (id: string, contactStatus: (typeof licenses.$inferSelect)["contactStatus"]) =>
    db.update(licenses).set({ contactStatus, updatedAt: new Date() }).where(eq(licenses.id, id)).returning().then((rows) => rows[0] ?? null),

  // Manual override — see licensePlanTypeSchema's doc comment for when
  // this is used on its own vs. convertToPaid below for the common case.
  updatePlanType: (id: string, planType: (typeof licenses.$inferSelect)["planType"]) =>
    db.update(licenses).set({ planType, updatedAt: new Date() }).where(eq(licenses.id, id)).returning().then((rows) => rows[0] ?? null),

  // The admin dashboard's device-quota stepper — raises or lowers how many
  // machines this license may activate. The route checks the new value
  // against the live activation count before calling this; this method
  // itself does no such validation, it's a plain field write.
  updateMaxDevices: (id: string, maxDevices: number) =>
    db.update(licenses).set({ maxDevices, updatedAt: new Date() }).where(eq(licenses.id, id)).returning().then((rows) => rows[0] ?? null),

  // Atomic version of "extend + mark converted" — the admin dashboard's
  // "Convertir en Annuel" action used to compose extend() and
  // updateContactStatus() as two separate round trips, which never touched
  // planType at all (the actual bug this method exists to fix: a converted
  // license kept planType: "trial" forever, so the desktop app's
  // TrialBanner had no reliable way to know it was no longer a trial).
  convertToPaid: (id: string, days: number, planType: "annual" | "lifetime") =>
    db
      .update(licenses)
      .set({
        expiresAt: sql`${licenses.expiresAt} + (${days} * interval '1 day')`,
        contactStatus: "converti",
        planType,
        updatedAt: new Date(),
      })
      .where(eq(licenses.id, id))
      .returning()
      .then((rows) => rows[0] ?? null),

  // Hard delete, not a status change — lets the same machine (device
  // fingerprint) start onboarding over from zero, e.g. after a test run.
  // license_activations.license_id has ON DELETE CASCADE (see schema.ts),
  // so this also clears every device fingerprint recorded against the
  // license in one statement — no separate cleanup step needed.
  remove: (id: string) => db.delete(licenses).where(eq(licenses.id, id)).returning().then((rows) => rows[0] ?? null),
};
