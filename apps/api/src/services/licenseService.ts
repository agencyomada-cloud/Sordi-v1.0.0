import crypto from "node:crypto";
import { env } from "../env.js";

// The desktop app is offline-tolerant by design (see LICENSING.md), so a
// license token has to keep working without network for a while — but not
// forever, or revocation would never take effect for an offline machine.
// 35 days forces at least monthly contact with the server even for a
// year-long license, while still surviving a normal offline trip.
const TOKEN_TTL_SECONDS = 35 * 24 * 60 * 60;

// The `jsonwebtoken` npm package (used elsewhere in this file's neighbor,
// authService.ts, for the symmetric HS256 session tokens) does NOT support
// EdDSA/Ed25519 at all — neither its types nor its runtime recognize the
// algorithm, confirmed by reading the installed package directly rather
// than assuming. Asymmetric signing is a hard requirement here (the
// desktop app only ever ships the public key), so this hand-rolls the
// standard three-segment JWT format (base64url(header).base64url(payload).
// base64url(signature)) using node:crypto's native Ed25519 support
// directly. It's a small, auditable amount of code for exactly one
// algorithm, rather than pulling in another JWT library for one feature.
// The output is still a spec-standard JWT — Rust's `jsonwebtoken` crate
// (a different, unrelated package that *does* support EdDSA) verifies it
// with zero special-casing on the desktop side.

const privateKey = crypto.createPrivateKey(env.LICENSE_PRIVATE_KEY_PEM.replace(/\\n/g, "\n"));
const publicKey = crypto.createPublicKey(privateKey);

function base64url(input: Buffer | string): string {
  return (typeof input === "string" ? Buffer.from(input) : input).toString("base64url");
}

export interface LicenseTokenPayload {
  clientReferenceId: string;
  deviceFingerprint: string;
}

interface LicenseTokenClaims extends LicenseTokenPayload {
  iat: number;
  exp: number;
}

/** Signs a license token with the Ed25519 private key. The desktop app only
 *  ever has the matching public key, so it can verify but never forge one. */
export function signLicenseToken(payload: LicenseTokenPayload): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: LicenseTokenClaims = { ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS };
  const headerB64 = base64url(JSON.stringify({ alg: "EdDSA", typ: "JWT" }));
  const payloadB64 = base64url(JSON.stringify(claims));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = crypto.sign(null, Buffer.from(signingInput), privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

/** Verifies signature + expiry only — callers still need to re-check the
 *  license's current `status` in the database, since a token can be valid
 *  and unexpired while its license was revoked after issuance. */
export function verifyLicenseToken(token: string): LicenseTokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    if (header.alg !== "EdDSA") return null;

    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64, "base64url");
    if (!crypto.verify(null, Buffer.from(signingInput), publicKey, signature)) return null;

    const claims = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as LicenseTokenClaims;
    if (typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof claims.clientReferenceId !== "string" || typeof claims.deviceFingerprint !== "string") return null;

    return claims;
  } catch {
    return null;
  }
}

const REFERENCE_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids read-aloud/typo ambiguity

/** e.g. "SORDI-A1B2C3" — shown to the customer, not secret. */
export function generateClientReferenceId(): string {
  const bytes = crypto.randomBytes(6);
  let suffix = "";
  for (const b of bytes) {
    suffix += REFERENCE_ID_ALPHABET[b % REFERENCE_ID_ALPHABET.length];
  }
  return `SORDI-${suffix}`;
}

/** The actual secret the customer types in. High entropy, dash-grouped for
 *  readability — 20 bytes -> 32 base32-ish chars -> "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-X". */
export function generateLicenseKey(): string {
  const bytes = crypto.randomBytes(20);
  let raw = "";
  for (const b of bytes) {
    raw += REFERENCE_ID_ALPHABET[b % REFERENCE_ID_ALPHABET.length];
  }
  return raw.match(/.{1,4}/g)!.join("-");
}
