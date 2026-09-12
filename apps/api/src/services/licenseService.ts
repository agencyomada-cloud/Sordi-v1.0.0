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
  // The license's REAL subscription boundary (unix seconds) — distinct from
  // the token's own cryptographic `exp` below. For a paid/activated license,
  // `exp` is deliberately a short, fixed 35-day rolling reverification
  // window (see TOKEN_TTL_SECONDS) so a revoked license can't stay valid
  // offline indefinitely; it has NO relation to how much term the customer
  // actually purchased. Before this field existed, the desktop app's "jours
  // restants" countdown read `exp` directly, so every paid activation
  // displayed "35 jours restants" forever, regardless of a real multi-year
  // term (a customer with a license valid until 2028 saw the banner as if
  // they were about to expire in 5 weeks). realExpiresAt carries the actual
  // value from `licenses.expiresAt` for display purposes; `exp` keeps doing
  // its security job untouched. For a self-service trial, the two happen to
  // be equal (signLicenseTokenWithTtl is called with the trial's own real
  // term as both), so no special-casing is needed there.
  realExpiresAt: number;
  // Explicit plan identity ("trial" | "annual" | "lifetime") — the
  // authoritative signal for whether the desktop app's TrialBanner should
  // show. Both trial and paid licenses look identical at the token-expiry
  // level (an active, unexpired token with a real, possibly-far-future
  // expiry either way), so guessing from days-remaining alone is
  // unreliable; this is the actual `licenses.plan_type` column value,
  // carried through so the desktop app never has to guess.
  planType: "trial" | "annual" | "lifetime";
}

interface LicenseTokenClaims extends LicenseTokenPayload {
  iat: number;
  exp: number;
}

/** Signs a license token with the Ed25519 private key. The desktop app only
 *  ever has the matching public key, so it can verify but never forge one. */
export function signLicenseToken(payload: LicenseTokenPayload): string {
  return signLicenseTokenWithTtl(payload, TOKEN_TTL_SECONDS);
}

/** Same signing as signLicenseToken, but with an explicit expiry instead of
 *  the fixed 35-day online-reverification window — used by the admin
 *  license-issuing endpoint, where `exp` must reflect the actual purchased
 *  term (e.g. a 1-year or lifetime license), not a re-check interval. */
export function signLicenseTokenWithTtl(payload: LicenseTokenPayload, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: LicenseTokenClaims = { ...payload, iat: now, exp: now + ttlSeconds };
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

    // Tolerate a token signed before realExpiresAt/planType existed
    // (already in the wild) — falls back to the reverification exp / a
    // conservative "trial" guess, same as the old behavior, rather than
    // rejecting it. Not load-bearing here either way: /verify re-signs
    // using the license row's own current planType/expiresAt, not these
    // decoded claims — this is only for type-safety and any future caller.
    if (typeof claims.realExpiresAt !== "number") claims.realExpiresAt = claims.exp;
    if (claims.planType !== "trial" && claims.planType !== "annual" && claims.planType !== "lifetime") {
      claims.planType = "trial";
    }

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
