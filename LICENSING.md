# Desktop license activation

A deterrent against casual reuse (someone copying the app folder or sharing
a key), not DRM — see `apps/desktop/src-tauri/src/license.rs` for exactly
what the device fingerprint does and doesn't defend against.

## Before selling any real license

The keypair currently in this repo (`apps/api/.env`'s `LICENSE_PRIVATE_KEY_PEM`
and `apps/desktop/src-tauri/src/license.rs`'s `LICENSE_PUBLIC_KEY_PEM`) is a
**development keypair** generated while building this feature. It has been
visible in an AI session's context and must never be used in production.

Generate a real one:

```bash
node -e "
const crypto = require('crypto');
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
console.log('--- PRIVATE (apps/api .env, LICENSE_PRIVATE_KEY_PEM, keep secret) ---');
console.log(JSON.stringify(privateKey.export({ type: 'pkcs8', format: 'pem' })));
console.log('--- PUBLIC (embed in apps/desktop/src-tauri/src/license.rs) ---');
console.log(publicKey.export({ type: 'spki', format: 'pem' }));
"
```

1. Put the private key PEM (as the printed single-line `\n`-escaped string)
   in your production `apps/api/.env` as `LICENSE_PRIVATE_KEY_PEM`. Never
   commit it.
2. Replace `LICENSE_PUBLIC_KEY_PEM` in `apps/desktop/src-tauri/src/license.rs`
   with the new public key, and update the two tests in that file's
   `#[cfg(test)] mod tests` that embed a token signed by the *old* dev key
   (`NODE_SIGNED_TOKEN`) — generate a fresh one the same way described in
   that test's own comment.
3. Rebuild and ship the desktop app with the new public key baked in
   *before* activating any real license against the new private key — an
   old build with the old public key cannot verify tokens signed by a new
   private key.

## Creating a license (no admin UI yet)

```bash
curl -X POST https://your-api-host/licenses/create \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $LICENSE_ADMIN_SECRET" \
  -d '{"organizationName": "Client SARL", "expiresAt": "2027-08-20T00:00:00Z", "maxDevices": 2}'
```

Returns the license row, including the one-time-visible `licenseKey` — copy
it to the customer. `clientReferenceId` (e.g. `SORDI-A1B2C3`) is a
human-readable label, not secret, safe to show/reference in support
conversations.

## Revoking a license

No endpoint yet (not asked for) — update the row directly:

```sql
UPDATE licenses SET status = 'revoked' WHERE client_reference_id = 'SORDI-A1B2C3';
```

Takes effect at that device's next successful background `/licenses/verify`
call (up to ~35 days later if it's offline the whole time — see the flow
diagram in the conversation this was designed in, or `license.rs`'s module
doc, for why that's an inherent tradeoff of staying offline-tolerant).

## Local files on the desktop app

`license.token` sits next to `database.db` in the OS app-data directory
(same `app_data_dir` Tauri already resolves for the SQLite file) — deleting
it resets the app to "not activated" without touching any business data.
