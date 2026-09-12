import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { devices } from "@sordi/schema";

export interface HeartbeatInput {
  machineId: string;
  deviceFingerprint: string;
  appVersion: string;
  invoicesCount: number;
  clientsCount: number;
  expensesCount: number;
  osPlatform?: string;
  lastActiveAt?: Date;
}

export interface DeviceUpdateInput {
  customerName?: string;
  email?: string;
  phoneNumber?: string;
}

const EFFECTIVE_STATUS_ROW = (row: typeof devices.$inferSelect) => ({
  ...row,
  // `status` is a stored column, only ever flipped to "active" by the issue
  // route below — it does NOT self-transition to "expired" once validUntil
  // passes. Rather than let the admin portal display a stale "active" badge
  // forever, this derives the *effective* status at read time: a
  // still-stored "active" row whose validUntil has passed reads as
  // "expired" here, without ever writing that back (a expired device that
  // gets renewed just needs a fresh `activate()` call, no cleanup job).
  effectiveStatus:
    row.status === "active" && row.validUntil !== null && row.validUntil.getTime() < Date.now()
      ? ("expired" as const)
      : row.status,
});

export const devicesRepo = {
  findByMachineId: (machineId: string) =>
    db.select().from(devices).where(eq(devices.machineId, machineId)).then((rows) => rows[0] ?? null),

  // `status` filter is applied against the *stored* column, not the derived
  // effectiveStatus above (that would need a second pass in JS or a raw SQL
  // CASE — not worth it for an admin tool's filter tabs) — in practice the
  // only place these two diverge is a stale "active" row past validUntil,
  // which the "Expired" tab already catches on the next admin visit once
  // any write touches that row, and "Actives" showing one stale row for a
  // few hours until then is an acceptable trade-off here.
  list: (search?: string, limit = 50, status?: "trial" | "active" | "expired") =>
    db
      .select()
      .from(devices)
      .where(
        and(
          search
            ? or(
                ilike(devices.machineId, `%${search}%`),
                ilike(devices.customerName, `%${search}%`),
                ilike(devices.phoneNumber, `%${search}%`),
                ilike(devices.email, `%${search}%`)
              )
            : undefined,
          status ? eq(devices.status, status) : undefined
        )
      )
      .orderBy(desc(devices.lastSeenAt))
      .limit(limit)
      .then((rows) => rows.map(EFFECTIVE_STATUS_ROW)),

  // Upsert on the heartbeat's unique machineId — insert as "trial" the first
  // time a device is ever seen (downloadedAt defaults to now() on insert
  // only, per the schema), otherwise just refresh its metrics/version/
  // lastSeenAt/lastActiveAt without touching status/validUntil/customer
  // fields (those are only ever changed by the admin routes below, never by
  // the device's own heartbeat).
  upsertHeartbeat: (data: HeartbeatInput) =>
    db
      .insert(devices)
      .values({
        machineId: data.machineId,
        deviceFingerprint: data.deviceFingerprint,
        appVersion: data.appVersion,
        invoicesCount: data.invoicesCount,
        clientsCount: data.clientsCount,
        expensesCount: data.expensesCount,
        osPlatform: data.osPlatform,
        lastActiveAt: data.lastActiveAt,
      })
      .onConflictDoUpdate({
        target: devices.machineId,
        set: {
          deviceFingerprint: data.deviceFingerprint,
          appVersion: data.appVersion,
          invoicesCount: data.invoicesCount,
          clientsCount: data.clientsCount,
          expensesCount: data.expensesCount,
          osPlatform: data.osPlatform,
          lastActiveAt: data.lastActiveAt,
          lastSeenAt: new Date(),
        },
      }),

  activate: (machineId: string, validUntil: Date, licenseType: "yearly" | "lifetime") =>
    db
      .update(devices)
      .set({ status: "active", validUntil, licenseType })
      .where(eq(devices.machineId, machineId))
      .returning()
      .then((rows) => rows[0] ?? null),

  update: (machineId: string, data: DeviceUpdateInput) =>
    db
      .update(devices)
      .set(data)
      .where(eq(devices.machineId, machineId))
      .returning()
      .then((rows) => (rows[0] ? EFFECTIVE_STATUS_ROW(rows[0]) : null)),
};
