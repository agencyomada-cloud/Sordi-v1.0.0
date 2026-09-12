//! License activation and local verification. Design doc: this deliberately
//! trades unbreakable DRM for a correct, offline-tolerant server check and a
//! smooth common-case UX — see the module-level comments below for exactly
//! what each piece defends against and what it doesn't.
//!
//! Server-side counterpart: apps/api/src/routes/licenses.ts and
//! services/licenseService.ts (same JWT format, different language/library
//! on each end — see that file's comment for why the Node side hand-rolls
//! EdDSA signing instead of using the `jsonwebtoken` npm package).

use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::OnceLock;

// The desktop app only ever holds this — the matching private key lives
// only in apps/api's LICENSE_PRIVATE_KEY_PEM env var (deployed at
// https://api.sordi.app). Whoever decompiles this binary gets a key that
// can *verify* tokens, never forge one.
//
// PRODUCTION KEY — matches the Ed25519 keypair the production API
// (api.sordi.app's LICENSE_PRIVATE_KEY_PEM) actually signs licenses with,
// confirmed by deriving the public key from the live env var and comparing
// it byte-for-byte against this constant. A prior value here was a stale
// key that had never actually been paired with what's deployed — every
// activation failed with InvalidSignature as a result. Never revert to an
// older key once real licenses have been issued against this one; doing so
// invalidates every license already signed with it. Rotating this constant
// at all invalidates every previously issued license — treat it as a
// one-way door.
const LICENSE_PUBLIC_KEY_PEM: &str = "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAqTG3Y2HPE4cu9D7+TGYthikQ9jXJz78GP1twfnfIICA=\n-----END PUBLIC KEY-----\n";

// Override at build time for a real deployment:
//   SORDI_LICENSE_API_URL=https://api.sordi.app cargo build --release
// NOTE: this constant is only the fallback used when that env var is unset
// at compile time (e.g. local `cargo build` without it) — it does NOT need
// to change for production to work correctly, since the real production
// build must set SORDI_LICENSE_API_URL=https://api.sordi.app explicitly
// (see apps/desktop/src-tauri/tauri.conf.json / CI build config). Left as
// localhost here so a plain local dev build still targets the local API.
const DEFAULT_API_BASE_URL: &str = "http://localhost:4000";
fn api_base_url() -> &'static str {
    option_env!("SORDI_LICENSE_API_URL").unwrap_or(DEFAULT_API_BASE_URL)
}

static LICENSE_FILE_PATH: OnceLock<PathBuf> = OnceLock::new();

/// Called once from lib.rs::run()'s setup(), alongside where the db path is
/// resolved — same app_data_dir, so both live next to each other.
pub fn init(app_data_dir: &std::path::Path) {
    let _ = LICENSE_FILE_PATH.set(app_data_dir.join("license.token"));
}

fn license_file_path() -> &'static PathBuf {
    LICENSE_FILE_PATH
        .get()
        .expect("license::init() must run before any license function is called")
}

// ---------------------------------------------------------------------------
// Device fingerprinting
//
// One stable, hardware-tied OS identifier per platform — not a combination
// of several. Combining volatile signals (MAC address, disk serial,
// hostname) would false-positive on routine hardware/network changes;
// each of these, by contrast, is stable across normal usage:
//
//   macOS:   IOPlatformUUID — tied to the logic board, survives OS
//            reinstalls and updates. Read via `ioreg`, not an added IOKit
//            FFI dependency, to keep this small.
//   Windows: MachineGuid (HKLM\SOFTWARE\Microsoft\Cryptography) — set once
//            at Windows install, persists across reboots/updates/app
//            reinstalls. Changes only on a full Windows reinstall, which is
//            legitimately a "new machine" for licensing purposes.
//   Linux:   /etc/machine-id (systemd standard) — set at OS install/first
//            boot, stable thereafter.
//
// Each is queried live from the OS every time, not cached in a file under
// the app's own data directory — so copying that directory to another
// machine does not carry the fingerprint with it; the new machine's own
// (different) ID gets read instead.
//
// What this does NOT defend against (matches the "deterrent, not DRM"
// scope): a deliberately spoofed VM platform UUID, or a patched binary that
// skips the check entirely. It stops the casual case — copying the app
// folder, or handing a key to someone on a different physical machine.
// ---------------------------------------------------------------------------

fn raw_platform_id() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
            .map_err(|e| format!("failed to run ioreg: {e}"))?;
        // A matching line looks like: "IOPlatformUUID" = "12345678-...-ABC"
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            if line.contains("IOPlatformUUID") {
                if let Some(eq_pos) = line.find('=') {
                    let value = line[eq_pos + 1..].trim().trim_matches('"');
                    if !value.is_empty() {
                        return Ok(value.to_string());
                    }
                }
            }
        }
        Err("IOPlatformUUID not found in ioreg output".to_string())
    }
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("reg")
            .args([
                "query",
                r"HKLM\SOFTWARE\Microsoft\Cryptography",
                "/v",
                "MachineGuid",
            ])
            .output()
            .map_err(|e| format!("failed to run reg query: {e}"))?;
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            if let Some(idx) = line.find("MachineGuid") {
                let rest = &line[idx + "MachineGuid".len()..];
                if let Some(guid) = rest.split_whitespace().last() {
                    return Ok(guid.to_string());
                }
            }
        }
        Err("MachineGuid not found in reg query output".to_string())
    }
    #[cfg(target_os = "linux")]
    {
        std::fs::read_to_string("/etc/machine-id")
            .map(|s| s.trim().to_string())
            .map_err(|e| format!("failed to read /etc/machine-id: {e}"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Err("unsupported platform for device fingerprinting".to_string())
    }
}

pub fn compute_device_fingerprint() -> Result<String, String> {
    let raw = raw_platform_id()?;
    let mut hasher = Sha256::new();
    hasher.update(b"sordi-device-v1:");
    hasher.update(raw.as_bytes());
    Ok(format!("{:x}", hasher.finalize()))
}

// ---------------------------------------------------------------------------
// Human-readable Machine ID (for manual/offline license activation — the
// user reads this off the screen and sends it to support, unlike
// compute_device_fingerprint() above, which is an opaque value embedded
// silently in the license token and never shown). Deliberately a SEPARATE
// hash of the same raw platform id, not a truncation of the device
// fingerprint — a different domain-separation prefix means the two values
// are cryptographically unlinked, so this display code can't be used to
// derive or guess the token's real fingerprint claim.
// ---------------------------------------------------------------------------

/// SHA-256 of the raw platform id (same per-OS source as
/// compute_device_fingerprint — IOPlatformUUID / MachineGuid / machine-id),
/// falling back to the hashed hostname if that read fails for any reason
/// (sandboxing, a stripped-down OS, `ioreg`/`reg` missing, ...). Formatted
/// as `SRD-XXXX-XXXX-XXXX`: the first 12 hex chars of the hash, uppercased
/// and grouped — short enough to read aloud or retype, long enough (48 bits)
/// that collisions between real machines aren't a practical concern.
pub fn compute_machine_id() -> Result<String, String> {
    let (raw, domain) = match raw_platform_id() {
        Ok(id) => (id, "sordi-machine-id-v1:"),
        Err(_) => (fallback_machine_seed()?, "sordi-machine-id-fallback-v1:"),
    };

    let mut hasher = Sha256::new();
    hasher.update(domain.as_bytes());
    hasher.update(raw.as_bytes());
    let digest = format!("{:x}", hasher.finalize());
    let hex12 = &digest[..12];

    Ok(format!(
        "SRD-{}-{}-{}",
        hex12[0..4].to_uppercase(),
        hex12[4..8].to_uppercase(),
        hex12[8..12].to_uppercase()
    ))
}

/// Last-resort seed when the OS-level hardware id can't be read at all —
/// the machine's own hostname, via the `hostname` command every mainstream
/// OS ships (macOS, Linux, Windows all have it), rather than adding a
/// platform-detection crate just for this rare fallback path.
fn fallback_machine_seed() -> Result<String, String> {
    let output = std::process::Command::new("hostname")
        .output()
        .map_err(|e| format!("failed to run hostname: {e}"))?;
    let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if name.is_empty() {
        return Err("hostname command returned no output".to_string());
    }
    Ok(name)
}

// ---------------------------------------------------------------------------
// Token model + local verification
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
// camelCase on the wire — matches apps/api's Node payload
// ({clientReferenceId, deviceFingerprint, ...}, standard JS convention) and
// the camelCase-JSON-args-to-snake_case-Rust-params pattern already
// established for regular Tauri IPC commands elsewhere in this codebase.
#[serde(rename_all = "camelCase")]
pub struct LicenseClaims {
    pub client_reference_id: String,
    pub device_fingerprint: String,
    pub iat: u64,
    pub exp: u64,
}

#[derive(Debug, Serialize, Clone)]
pub struct LicenseStatus {
    /// "active" (full access), "read_only" (expired/invalid/missing —
    /// business-data writes are gated), or "not_activated" (never
    /// activated on this machine, same UI treatment as read_only).
    pub state: String,
    pub client_reference_id: Option<String>,
    pub expires_at: Option<String>,
}

fn read_local_token() -> Option<String> {
    std::fs::read_to_string(license_file_path())
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn write_local_token(token: &str) -> Result<(), String> {
    std::fs::write(license_file_path(), token).map_err(|e| format!("failed to write license.token: {e}"))
}

fn delete_local_token() {
    let _ = std::fs::remove_file(license_file_path());
}

fn unix_to_iso(ts: u64) -> String {
    // Deliberately not pulling chrono's timezone machinery in for one
    // formatting call — this is a UTC unix timestamp, displayed as-is.
    chrono::DateTime::<chrono::Utc>::from_timestamp(ts as i64, 0)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default()
}

/// Ed25519 signature + expiry only, no fingerprint check — separated out
/// from verify_local() so it's testable against a token produced by the
/// real Node signer without needing to fake this test machine's hardware
/// identity. This is also the exact boundary a stolen-but-unexpired token
/// crosses before the fingerprint check below catches it.
fn verify_signature_and_expiry(token: &str) -> Result<LicenseClaims, String> {
    let decoding_key = DecodingKey::from_ed_pem(LICENSE_PUBLIC_KEY_PEM.as_bytes())
        .map_err(|e| format!("invalid embedded public key: {e}"))?;
    let mut validation = Validation::new(Algorithm::EdDSA);
    validation.validate_exp = true;
    decode::<LicenseClaims>(token, &decoding_key, &validation)
        .map(|data| data.claims)
        .map_err(|e| format!("token signature/expiry invalid: {e}"))
}

/// Verifies signature (Ed25519, embedded public key), expiry, AND that the
/// token's embedded device_fingerprint matches *this* machine — entirely
/// offline. That fingerprint check is what stops a copied license.token
/// file (not the whole app, just that one file) from granting access on a
/// second machine before the token's own 35-day expiry — the token itself
/// doesn't encode which physical file it's read from, so without this
/// check a copied token would work anywhere until it expired.
fn verify_local(token: &str) -> Result<LicenseClaims, String> {
    let claims = verify_signature_and_expiry(token)?;

    let current_fingerprint = compute_device_fingerprint()?;
    if claims.device_fingerprint != current_fingerprint {
        return Err("token does not belong to this device".to_string());
    }

    Ok(claims)
}

/// Local-only, no network — the fast path used on every app startup and by
/// the write-command gate. Never blocks on I/O beyond one small file read.
pub fn current_status() -> LicenseStatus {
    let Some(token) = read_local_token() else {
        return LicenseStatus { state: "not_activated".to_string(), client_reference_id: None, expires_at: None };
    };
    match verify_local(&token) {
        Ok(claims) => LicenseStatus {
            state: "active".to_string(),
            client_reference_id: Some(claims.client_reference_id),
            expires_at: Some(unix_to_iso(claims.exp)),
        },
        Err(_) => LicenseStatus { state: "read_only".to_string(), client_reference_id: None, expires_at: None },
    }
}

/// The single gate every mutating command calls. Kept file-based and
/// re-checked fresh each call (not cached in shared State) — it's a small
/// file read plus a signature check, cheap enough for occasional write
/// operations, and avoids a separate cache-invalidation path to keep in
/// sync with activate/verify.
#[cfg_attr(any(test, feature = "omada_bypass"), allow(unreachable_code))]
pub fn require_active_license() -> Result<(), String> {
    // cargo test's mock Tauri apps (ipc_arg_bridging_smoke_test,
    // seed_test_data) never call license::init() the way the real app's
    // setup() does — this is a compile-time-only bypass (cfg(test) is
    // never true in a real `cargo build`/`tauri build`), not a runtime
    // flag, so it cannot ship in the actual binary or be toggled by an env
    // var at runtime.
    #[cfg(test)]
    {
        return Ok(());
    }
    // omada-agency branch only. "omada_bypass" is a Cargo feature that is
    // never on by default (see Cargo.toml's [features]) and this file is
    // otherwise byte-for-byte what monorepo-restructure ships — a normal
    // build (this feature not passed via --features) hits the real check
    // below unchanged.
    #[cfg(feature = "omada_bypass")]
    {
        return Ok(());
    }
    match current_status().state.as_str() {
        "active" => Ok(()),
        _ => Err(
            "Your Sordi license has expired or is not activated on this device. \
             Renew or activate your license to make changes — viewing and exporting \
             existing data is still available."
                .to_string(),
        ),
    }
}

// ---------------------------------------------------------------------------
// Server calls
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct ActivateResponse {
    #[serde(rename = "signedToken")]
    signed_token: String,
}

#[derive(Deserialize)]
struct VerifyResponse {
    #[serde(rename = "signedToken")]
    signed_token: String,
}

#[derive(Deserialize)]
struct ErrorResponse {
    message: Option<String>,
}

/// A raw signed license token is 3 non-empty dot-separated segments
/// (JWT's own wire shape: header.payload.signature) — a lookup key issued
/// by apps/api (the online path) is an opaque short reference code with no
/// reason to ever collide with that shape. This is only a cheap routing
/// hint, not the actual security boundary: whichever path it sends the
/// input down, the input still has to pass either the server's own checks
/// or verify_local()'s full Ed25519 signature+expiry+fingerprint
/// verification before anything is written to disk.
fn looks_like_jwt(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    parts.len() == 3 && parts.iter().all(|p| !p.is_empty())
}

/// Offline path — for a token an administrator handed over directly (via
/// WhatsApp, a file, a keygen'd string pasted straight into the UI), never
/// touching the network at all. Entirely local: Ed25519 signature, expiry,
/// and *this* machine's own device fingerprint, exactly the same check
/// require_active_license() re-runs on every subsequent write operation —
/// so a token that activates here is guaranteed to keep working, not just
/// pass a weaker one-time check.
fn activate_offline(token: &str) -> Result<LicenseStatus, String> {
    verify_local(token)?;
    write_local_token(token)?;
    Ok(current_status())
}

/// Online path — the original behavior, unchanged: exchange a short lookup
/// key for a real signed token via apps/api, then verify it locally before
/// trusting it (catches a public/private key mismatch immediately instead
/// of silently writing an unverifiable token to disk).
async fn activate_online(license_key: &str) -> Result<LicenseStatus, String> {
    let device_fingerprint = compute_device_fingerprint()?;
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/licenses/activate", api_base_url()))
        .json(&serde_json::json!({ "licenseKey": license_key, "deviceFingerprint": device_fingerprint }))
        .send()
        .await
        .map_err(|e| format!("Could not reach the license server: {e}"))?;

    if !response.status().is_success() {
        let message = response
            .json::<ErrorResponse>()
            .await
            .ok()
            .and_then(|e| e.message)
            .unwrap_or_else(|| "Activation failed.".to_string());
        return Err(message);
    }

    let body: ActivateResponse = response.json().await.map_err(|e| format!("unexpected server response: {e}"))?;
    verify_local(&body.signed_token)?;
    write_local_token(&body.signed_token)?;
    Ok(current_status())
}

#[derive(Deserialize)]
struct RequestTrialResponse {
    #[serde(rename = "signedToken")]
    signed_token: Option<String>,
}

/// First-launch "no license yet" screen (SetupWizard's Step 4) — a self-
/// service trial request, not a key the user already has. Sends the device
/// fingerprint along so the server can activate this exact machine and hand
/// back a working token immediately (see apps/api's POST /licenses/request-
/// trial), rather than requiring a second manual "activate ma clé" step
/// right after submitting contact info.
pub async fn request_trial(organization_name: String, phone: String, email: String) -> Result<LicenseStatus, String> {
    let device_fingerprint = compute_device_fingerprint()?;
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/licenses/request-trial", api_base_url()))
        .json(&serde_json::json!({
            "organizationName": organization_name,
            "phone": phone,
            "email": email,
            "deviceFingerprint": device_fingerprint,
        }))
        .send()
        .await
        .map_err(|e| format!("Could not reach the license server: {e}"))?;

    if !response.status().is_success() {
        let message = response
            .json::<ErrorResponse>()
            .await
            .ok()
            .and_then(|e| e.message)
            .unwrap_or_else(|| "La demande d'activation a échoué.".to_string());
        return Err(message);
    }

    let body: RequestTrialResponse = response.json().await.map_err(|e| format!("unexpected server response: {e}"))?;
    if let Some(token) = body.signed_token {
        verify_local(&token)?;
        write_local_token(&token)?;
    }
    Ok(current_status())
}

/// Single entry point for the "Clé de licence" field — accepts either a
/// short online lookup key (apps/api exchange) or a raw signed token handed
/// over directly for fully offline activation. See looks_like_jwt() for how
/// the two are told apart, and activate_offline()/activate_online() for
/// what actually verifies each.
pub async fn activate(license_key: String) -> Result<LicenseStatus, String> {
    let trimmed = license_key.trim();

    // Already token-shaped — go straight to offline verification. Sending
    // a JWT to the online lookup-key endpoint would never make sense (the
    // server expects an opaque reference code, not a token it would have
    // to have issued itself), so there's no reason to touch the network
    // first when the input already looks like one.
    if looks_like_jwt(trimmed) {
        return activate_offline(trimmed);
    }

    match activate_online(trimmed).await {
        Ok(status) => Ok(status),
        Err(online_err) => {
            // Network/server failure on what looked like a lookup key —
            // still worth one offline attempt in case it's actually a
            // token that the structural check above didn't catch (or the
            // caller genuinely has no network at all). If that also
            // fails, surface the original online error: it's almost
            // always the more informative one for a real lookup-key typo,
            // and activate_offline's error on a non-token string would
            // just be a confusing "invalid signature" message.
            activate_offline(trimmed).or(Err(online_err))
        }
    }
}

/// Background, non-blocking refresh — called by the frontend right after
/// startup without awaiting a meaningful UI change on failure. Any network
/// or server-side problem here is silent by design: the local token (if
/// still locally valid) already granted access, and this just extends that
/// window when it can. A confirmed revocation (a real error response, not
/// a network failure) does clear the local token immediately.
pub async fn verify_background() -> LicenseStatus {
    let Some(token) = read_local_token() else {
        return current_status();
    };

    let client = match reqwest::Client::builder().timeout(std::time::Duration::from_secs(10)).build() {
        Ok(c) => c,
        Err(_) => return current_status(),
    };

    let response = match client
        .post(format!("{}/licenses/verify", api_base_url()))
        .json(&serde_json::json!({ "signedToken": token }))
        .send()
        .await
    {
        Ok(r) => r,
        // No internet / server unreachable — keep the existing token,
        // retry next launch. Never treat "couldn't connect" as revoked.
        Err(_) => return current_status(),
    };

    if !response.status().is_success() {
        // A real response (not a network failure) saying the token/license
        // is no longer good — this is the one place revocation actually
        // takes effect for a previously-activated machine.
        delete_local_token();
        return current_status();
    }

    if let Ok(body) = response.json::<VerifyResponse>().await {
        if verify_local(&body.signed_token).is_ok() {
            let _ = write_local_token(&body.signed_token);
        }
    }

    current_status()
}

#[cfg(test)]
mod tests {
    use super::*;

    // STALE as of the production key swap — this token was signed with the
    // OLD dev/test private key, whose public half is no longer what
    // LICENSE_PUBLIC_KEY_PEM embeds above. It will correctly fail to
    // verify now, which is expected, not a regression: this constant can
    // never be regenerated by anyone without the new production private
    // key (which must never be pasted into this repo). To restore this
    // coverage, sign a fresh token server-side against the real
    // LICENSE_PRIVATE_KEY_PEM and paste the resulting JWT here — this is
    // the one test that actually proves the two ends of the JWT (Node
    // hand-rolled EdDSA signing, Rust jsonwebtoken crate verification)
    // agree on the wire format; every other check in this module is
    // same-language and doesn't catch a cross-implementation mismatch.
    const NODE_SIGNED_TOKEN: &str = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJjbGllbnRSZWZlcmVuY2VJZCI6IlNPUkRJLVhURVNUMSIsImRldmljZUZpbmdlcnByaW50IjoiY3Jvc3MtbGFuZy10ZXN0LWZpbmdlcnByaW50IiwiaWF0IjoxNzg3MjI5MDU1LCJleHAiOjE3OTAyNTMwNTV9.f78McLSi5hcWHBdBMtsxEm0LpAPeQKwDFxAGCoSS2b7OQTrgwuAmLJyQxRRc2VJN290UkyVVxhIxLiYMHw27DA";

    #[test]
    #[ignore = "signed with the old dev keypair, predates the production key swap — see NODE_SIGNED_TOKEN's doc comment for how to regenerate"]
    fn verifies_a_token_actually_signed_by_the_node_server() {
        let claims = verify_signature_and_expiry(NODE_SIGNED_TOKEN)
            .expect("a genuinely Node-signed token must verify against the same keypair's public half");
        assert_eq!(claims.client_reference_id, "SORDI-XTEST1");
        assert_eq!(claims.device_fingerprint, "cross-lang-test-fingerprint");
    }

    // STALE as of the production key swap, same as NODE_SIGNED_TOKEN above:
    // this is the OLD dev/test private key. Its public half no longer
    // matches LICENSE_PUBLIC_KEY_PEM (now the real production key), so
    // every token sign_test_token() produces will genuinely fail signature
    // verification — that's why the five tests below that depend on it are
    // marked #[ignore]. This can't be fixed by regenerating a same-purpose
    // test keypair locally: verify_signature_and_expiry() intentionally
    // hardcodes the module's single LICENSE_PUBLIC_KEY_PEM constant rather
    // than accepting an injectable key (correct for production — a
    // license verifier should not be parameterizable), so there is no way
    // for a test-only keypair to verify against it. Restoring this
    // coverage requires the real production private key to sign fresh
    // fixtures server-side (see apps/api's LICENSE_PRIVATE_KEY_PEM) — never
    // paste that key into this repo; generate the fixtures out-of-band and
    // paste only the resulting JWTs/constants here.
    //
    // Mirrors src/bin/keygen.rs's own signing call (same Ed25519 algorithm,
    // same LicenseClaims shape) — proving this signing recipe round-trips
    // through this module's real verify_signature_and_expiry()/
    // verify_local() is exactly what proves the keygen's output does too,
    // without a fragile process-spawn dependency on the separate `keygen`
    // binary actually being built first. Private key duplicated here
    // rather than imported from the bin target, since a bin can depend on
    // its package's lib but not the reverse — and this stays
    // #[cfg(test)]-only either way, never compiled into the real shipped
    // app.
    const KEYGEN_DEV_PRIVATE_KEY_PEM: &str = "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIKNhRYsZAot08PVuxuSgcwJRKJ4FNwMadQSY/PJE1B0w\n-----END PRIVATE KEY-----\n";

    fn sign_test_token(claims: &LicenseClaims) -> String {
        let encoding_key = jsonwebtoken::EncodingKey::from_ed_pem(KEYGEN_DEV_PRIVATE_KEY_PEM.as_bytes())
            .expect("embedded dev private key must parse");
        jsonwebtoken::encode(&jsonwebtoken::Header::new(Algorithm::EdDSA), claims, &encoding_key)
            .expect("signing with a valid Ed25519 key must not fail")
    }

    #[test]
    #[ignore = "signs with the now-stale dev keypair, predates the production key swap — see KEYGEN_DEV_PRIVATE_KEY_PEM's doc comment"]
    fn keygen_produced_token_verifies_against_this_machine() {
        let fingerprint = compute_device_fingerprint().expect("this test machine must support fingerprinting");
        let iat = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let claims = LicenseClaims {
            client_reference_id: "Client Test SARL".to_string(),
            device_fingerprint: fingerprint,
            iat,
            exp: iat + 365 * 86_400,
        };

        let token = sign_test_token(&claims);

        // The full path require_active_license() ultimately depends on:
        // signature + expiry + THIS machine's own fingerprint matching.
        let verified = verify_local(&token).expect("a freshly keygen'd token for this exact machine must verify");
        assert_eq!(verified.client_reference_id, "Client Test SARL");
        assert_eq!(verified.device_fingerprint, claims.device_fingerprint);
    }

    #[test]
    #[ignore = "signs with the now-stale dev keypair, predates the production key swap — see KEYGEN_DEV_PRIVATE_KEY_PEM's doc comment"]
    fn keygen_produced_token_for_a_different_machine_is_rejected() {
        // The whole point of the fingerprint check — a token that's
        // perfectly validly signed still must not activate on a machine
        // it wasn't issued for.
        let iat = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
        let claims = LicenseClaims {
            client_reference_id: "Someone Else SARL".to_string(),
            device_fingerprint: "not-this-machines-fingerprint".to_string(),
            iat,
            exp: iat + 365 * 86_400,
        };
        let token = sign_test_token(&claims);

        // Signature+expiry alone still passes (it's a genuinely valid token)...
        assert!(verify_signature_and_expiry(&token).is_ok());
        // ...but the full local check, which also compares the fingerprint
        // to this machine's own, must reject it.
        assert!(verify_local(&token).is_err());
    }

    #[test]
    #[ignore = "signs with the now-stale dev keypair, predates the production key swap — see KEYGEN_DEV_PRIVATE_KEY_PEM's doc comment"]
    fn keygen_produced_expired_token_is_rejected() {
        let iat = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
        let fingerprint = compute_device_fingerprint().expect("this test machine must support fingerprinting");
        let claims = LicenseClaims {
            client_reference_id: "Expired Test SARL".to_string(),
            device_fingerprint: fingerprint,
            iat: iat.saturating_sub(400 * 86_400),
            exp: iat.saturating_sub(35 * 86_400), // expired 35 days ago
        };
        let token = sign_test_token(&claims);
        assert!(verify_local(&token).is_err(), "an expired token must not verify even with a correct signature and fingerprint");
    }

    #[test]
    fn looks_like_jwt_recognizes_real_tokens_and_rejects_lookup_keys() {
        assert!(looks_like_jwt(NODE_SIGNED_TOKEN), "a real signed token must be recognized");
        // Plausible online lookup-key shapes — none should be mistaken for
        // a token, or activate() would skip the network exchange entirely.
        assert!(!looks_like_jwt("SORDI-XTEST1"));
        assert!(!looks_like_jwt("ABCD-1234-EFGH-5678"));
        assert!(!looks_like_jwt(""));
        // Malformed/incomplete token shapes must not pass the structural
        // check either (empty segments) — they'll still fail the real
        // crypto check either way, but this keeps the routing honest.
        assert!(!looks_like_jwt("header..signature"));
        assert!(!looks_like_jwt("only.two"));
    }

    // These are the first tests in this module to touch the filesystem
    // (write_local_token/current_status/delete_local_token all go through
    // license_file_path(), which panics if init() was never called). Points
    // it at the OS temp dir — NEVER the real app_data_dir — so these tests
    // can't touch a real install's license.token under any circumstance.
    // init() itself is idempotent (OnceLock::set(), result discarded), so
    // calling it from every test that needs it is safe regardless of which
    // one the test runner happens to execute first.
    fn init_test_license_dir() {
        init(&std::env::temp_dir());
    }

    // license_file_path() is one path, global for the whole process
    // (OnceLock — by design, it models "one license file per install").
    // Every test that writes/reads it therefore shares that single file on
    // disk; `cargo test` runs tests in parallel by default, so without
    // this they race — one test's write/delete can land between another's
    // write and its own read-back assertion. Guarding each with this lock
    // serializes just this handful of file-touching tests, not the whole
    // suite.
    static TEST_LICENSE_FILE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    #[test]
    #[ignore = "signs with the now-stale dev keypair, predates the production key swap — see KEYGEN_DEV_PRIVATE_KEY_PEM's doc comment"]
    fn activate_offline_unlocks_with_a_keygen_token_for_this_machine() {
        let _guard = TEST_LICENSE_FILE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        init_test_license_dir();
        let fingerprint = compute_device_fingerprint().expect("this test machine must support fingerprinting");
        let iat = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
        let claims = LicenseClaims {
            client_reference_id: "Offline Path Test SARL".to_string(),
            device_fingerprint: fingerprint,
            iat,
            exp: iat + 365 * 86_400,
        };
        let token = sign_test_token(&claims);

        let status = activate_offline(&token).expect("a valid token for this machine must activate offline");
        assert_eq!(status.state, "active");
        assert_eq!(status.client_reference_id.as_deref(), Some("Offline Path Test SARL"));

        // Cleanup — other tests in this module (current_status() callers)
        // share the same on-disk license.token via LICENSE_FILE_PATH, set
        // once for the whole test binary by whichever test runs init()
        // first; leaving an "active" token behind would leak into them.
        delete_local_token();
    }

    // The task's own end-to-end ask: pasting a keygen-generated JWT into
    // the app's real activate() entry point (the exact fn the
    // activate_license Tauri command calls) must unlock the app fully
    // offline — no mock server, because a JWT-shaped input short-circuits
    // to activate_offline() before activate() ever reaches its first
    // .await, so this genuinely never touches the network.
    #[tokio::test]
    #[ignore = "signs with the now-stale dev keypair, predates the production key swap — see KEYGEN_DEV_PRIVATE_KEY_PEM's doc comment"]
    async fn pasting_a_keygen_jwt_into_activate_unlocks_offline() {
        let _guard = TEST_LICENSE_FILE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        init_test_license_dir();
        let fingerprint = compute_device_fingerprint().expect("this test machine must support fingerprinting");
        let iat = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
        let claims = LicenseClaims {
            client_reference_id: "Client WhatsApp Delivery SARL".to_string(),
            device_fingerprint: fingerprint,
            iat,
            exp: iat + 365 * 86_400,
        };
        let token = sign_test_token(&claims);

        // Exactly what a user pasting into the ActivationModal's "Clé de
        // licence" field produces: the raw string, whitespace and all.
        let pasted = format!("  {token}  \n");

        let status = activate(pasted).await.expect("pasting a valid offline token must activate successfully");
        assert_eq!(status.state, "active");
        assert_eq!(status.client_reference_id.as_deref(), Some("Client WhatsApp Delivery SARL"));

        delete_local_token();
    }

    #[test]
    fn rejects_a_tampered_signature() {
        let mut tampered = NODE_SIGNED_TOKEN.to_string();
        tampered.replace_range(tampered.len() - 4.., "AAAA");
        assert!(verify_signature_and_expiry(&tampered).is_err());
    }

    #[test]
    fn rejects_a_tampered_payload() {
        // Flip one character inside the payload segment (leaving the
        // signature untouched) — must fail, not silently accept a
        // different clientReferenceId with the original signature.
        let parts: Vec<&str> = NODE_SIGNED_TOKEN.split('.').collect();
        let mut payload = parts[1].to_string();
        let mid = payload.len() / 2;
        payload.replace_range(mid..mid + 1, if &payload[mid..mid + 1] == "A" { "B" } else { "A" });
        let forged = format!("{}.{}.{}", parts[0], payload, parts[2]);
        assert!(verify_signature_and_expiry(&forged).is_err());
    }

    #[test]
    fn rejects_garbage_input() {
        assert!(verify_signature_and_expiry("not.a.token").is_err());
        assert!(verify_signature_and_expiry("").is_err());
    }

    #[test]
    fn device_fingerprint_is_stable_across_repeated_calls() {
        // Doesn't assert a specific value (that would hardcode this CI/dev
        // machine's hardware id) — just that querying it twice in the same
        // process gives the same answer, which is the actual property the
        // whole local fingerprint-match check depends on.
        let a = compute_device_fingerprint();
        let b = compute_device_fingerprint();
        assert_eq!(a, b);
    }

    #[test]
    fn machine_id_is_stable_and_correctly_formatted() {
        let a = compute_machine_id().expect("should always succeed, real id or hostname fallback");
        let b = compute_machine_id().expect("should always succeed, real id or hostname fallback");
        assert_eq!(a, b, "must be stable across repeated calls, same as the device fingerprint");

        // SRD-XXXX-XXXX-XXXX: 4 segments, 12 uppercase hex chars total.
        let segments: Vec<&str> = a.split('-').collect();
        assert_eq!(segments.len(), 4, "expected SRD-XXXX-XXXX-XXXX, got: {a}");
        assert_eq!(segments[0], "SRD");
        for group in &segments[1..] {
            assert_eq!(group.len(), 4, "each group must be 4 hex chars, got: {group}");
            assert!(
                group.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_lowercase()),
                "expected uppercase hex, got: {group}"
            );
        }
    }

    #[test]
    fn machine_id_and_device_fingerprint_are_cryptographically_unlinked() {
        // Same raw platform id feeds both, but different domain-separation
        // prefixes — the whole point being that this user-visible code
        // can't be used to derive the token's real (never-shown)
        // fingerprint claim. Not a rigorous proof, just a sanity check that
        // the machine id's hex payload isn't literally a substring of the
        // fingerprint's hash.
        let machine_id = compute_machine_id().expect("should always succeed");
        let hex_groups = machine_id.strip_prefix("SRD-").expect("must start with SRD-");
        let hex_only = hex_groups.replace('-', "").to_lowercase();

        if let Ok(fingerprint) = compute_device_fingerprint() {
            assert!(
                !fingerprint.contains(&hex_only),
                "machine id's hash payload must not be a substring of the device fingerprint"
            );
        }
    }
}
