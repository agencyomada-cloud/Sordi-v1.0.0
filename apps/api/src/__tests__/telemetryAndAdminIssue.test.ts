import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { env } from "../env.js";
import { pool } from "../db/client.js";
import { devices } from "@sordi/schema";

// End-to-end integration test against a real local Postgres (see
// apps/api/docker-compose.yml — port 5434, started separately) with
// migrations already applied. Exercises the full cycle the task asked for:
// a device's first heartbeat, an admin issuing it a license from nothing but
// its machine_id, and independently verifying the returned JWT the exact
// same way src-tauri/src/license.rs's verify_local() does — Ed25519/EdDSA
// signature + claim shape — using node:crypto directly rather than trusting
// this server's own verifyLicenseToken() to catch its own bugs.

function base64urlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

test("telemetry heartbeat -> admin license issue -> JWT verifies against license.rs's public key", async (t) => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  const machineId = `SRD-TEST-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const deviceFingerprint = crypto.createHash("sha256").update(`fixture-${machineId}`).digest("hex");

  t.after(async () => {
    server.close();
    await pool.query("DELETE FROM devices WHERE machine_id = $1", [machineId]);
    await pool.end();
  });

  await t.test("1. fresh device sends a heartbeat", async () => {
    const res = await fetch(`${base}/telemetry/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        machine_id: machineId,
        device_fingerprint: deviceFingerprint,
        app_version: "1.0.0",
        invoices_count: 12,
        clients_count: 3,
        expenses_count: 5,
        last_active_at: new Date().toISOString(),
      }),
    });
    assert.equal(res.status, 204);

    const rows = await pool.query("SELECT * FROM devices WHERE machine_id = $1", [machineId]);
    assert.equal(rows.rowCount, 1);
    assert.equal(rows.rows[0].device_fingerprint, deviceFingerprint);
    assert.equal(rows.rows[0].status, "trial");
    assert.equal(rows.rows[0].invoices_count, 12);
  });

  await t.test("2. admin issues a license for that machine_id", async () => {
    const res = await fetch(`${base}/admin/licenses/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": env.LICENSE_ADMIN_SECRET },
      body: JSON.stringify({ machineId, validDays: 365 }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { token: string; machine_id: string; valid_until: string };
    assert.equal(body.machine_id, machineId);
    assert.ok(body.token.split(".").length === 3, "token must be a 3-segment JWT");

    const rows = await pool.query("SELECT status, valid_until FROM devices WHERE machine_id = $1", [machineId]);
    assert.equal(rows.rows[0].status, "active");
    assert.ok(rows.rows[0].valid_until !== null);

    // 3. Independently verify the JWT exactly as license.rs's verify_local()
    // does: Ed25519/EdDSA signature check against the SAME public key
    // embedded in license.rs, plus the expected claim shape.
    const publicKeyPem =
      "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAVXy7Ja0QHae/g6QpbgH+Ib4bQ+xwBdUexHPbqGzm6gM=\n-----END PUBLIC KEY-----\n";
    const publicKey = crypto.createPublicKey(publicKeyPem);

    const [headerB64, payloadB64, signatureB64] = body.token.split(".");
    const header = JSON.parse(base64urlDecode(headerB64).toString("utf8"));
    assert.equal(header.alg, "EdDSA");

    const signingInput = `${headerB64}.${payloadB64}`;
    const verified = crypto.verify(null, Buffer.from(signingInput), publicKey, base64urlDecode(signatureB64));
    assert.equal(verified, true, "signature must verify against license.rs's embedded public key");

    const claims = JSON.parse(base64urlDecode(payloadB64).toString("utf8"));
    assert.equal(claims.deviceFingerprint, deviceFingerprint);
    assert.equal(typeof claims.clientReferenceId, "string");
    assert.ok(claims.exp > claims.iat);
    // ~365 days, allowing a few seconds of test-execution drift.
    assert.ok(Math.abs(claims.exp - claims.iat - 365 * 24 * 60 * 60) < 5);
  });

  await t.test("admin issue for an unknown machine_id returns 404", async () => {
    const res = await fetch(`${base}/admin/licenses/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": env.LICENSE_ADMIN_SECRET },
      body: JSON.stringify({ machineId: "SRD-NEVER-SEEN-0000", validDays: 30 }),
    });
    assert.equal(res.status, 404);
  });

  await t.test("admin issue without the admin key is rejected", async () => {
    const res = await fetch(`${base}/admin/licenses/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ machineId, validDays: 30 }),
    });
    assert.equal(res.status, 401);
  });
});
