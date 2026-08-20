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
// only in apps/api's LICENSE_PRIVATE_KEY_PEM env var. Whoever decompiles
// this binary gets a key that can *verify* tokens, never forge one.
//
// THIS IS A DEV/TEST KEYPAIR generated during development. Generate a real
// one before selling any license — see LICENSING.md — and replace this
// constant. Never reuse this exact key in production; it has been visible
// in this session's context.
const LICENSE_PUBLIC_KEY_PEM: &str = "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAVXy7Ja0QHae/g6QpbgH+Ib4bQ+xwBdUexHPbqGzm6gM=\n-----END PUBLIC KEY-----\n";

// Override at build time for a real deployment:
//   SORDI_LICENSE_API_URL=https://license.sordi.example cargo build --release
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
#[cfg_attr(test, allow(unreachable_code))]
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

pub async fn activate(license_key: String) -> Result<LicenseStatus, String> {
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
    // Confirms the token we just received actually verifies locally before
    // trusting it — catches a public/private key mismatch immediately
    // instead of silently writing an unverifiable token to disk.
    verify_local(&body.signed_token)?;
    write_local_token(&body.signed_token)?;
    Ok(current_status())
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

    // Generated for real by apps/api/src/services/licenseService.ts's
    // signLicenseToken() using this exact module's LICENSE_PUBLIC_KEY_PEM's
    // matching private key (the dev keypair — see that file's own
    // comment), payload {clientReferenceId: "SORDI-XTEST1",
    // deviceFingerprint: "cross-lang-test-fingerprint"}, exp ~2026-10-24.
    // This is the one test in the whole feature that actually proves the
    // two ends of the JWT (Node hand-rolled EdDSA signing, Rust
    // jsonwebtoken crate verification) agree on the wire format — every
    // other check here is same-language.
    const NODE_SIGNED_TOKEN: &str = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJjbGllbnRSZWZlcmVuY2VJZCI6IlNPUkRJLVhURVNUMSIsImRldmljZUZpbmdlcnByaW50IjoiY3Jvc3MtbGFuZy10ZXN0LWZpbmdlcnByaW50IiwiaWF0IjoxNzg3MjI5MDU1LCJleHAiOjE3OTAyNTMwNTV9.f78McLSi5hcWHBdBMtsxEm0LpAPeQKwDFxAGCoSS2b7OQTrgwuAmLJyQxRRc2VJN290UkyVVxhIxLiYMHw27DA";

    #[test]
    fn verifies_a_token_actually_signed_by_the_node_server() {
        let claims = verify_signature_and_expiry(NODE_SIGNED_TOKEN)
            .expect("a genuinely Node-signed token must verify against the same keypair's public half");
        assert_eq!(claims.client_reference_id, "SORDI-XTEST1");
        assert_eq!(claims.device_fingerprint, "cross-lang-test-fingerprint");
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
}
