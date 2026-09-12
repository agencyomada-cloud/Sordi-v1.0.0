// In-app update notification — checks apps/api's GET /releases/latest
// against this binary's own compiled-in version (CARGO_PKG_VERSION, the
// same source tauri.conf.json's "version" and package.json's "version"
// are kept in sync with by hand) and reports whether a newer build exists.
// Deliberately informational only: unlike Tauri's own updater plugin, this
// never downloads or installs anything itself — it points the user at the
// existing macOS download link (the same DMG the landing page serves),
// since Sordi ships outside any auto-update-capable channel (no code
// signing/notarization pipeline wired up yet for silent in-place updates).

use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct LatestReleaseResponse {
    #[serde(rename = "latestVersion")]
    latest_version: String,
    #[serde(rename = "releaseNotes")]
    release_notes: String,
    #[serde(rename = "downloadUrl")]
    download_url: String,
}

#[derive(Serialize, Clone)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub release_notes: String,
    pub download_url: String,
}

/// Numeric "major.minor.patch"-shaped comparison — NOT lexicographic, so
/// "1.9.0" correctly sorts before "1.10.0" (a plain string `>` would get
/// this backwards). Any version string that doesn't parse cleanly as
/// dot-separated integers is treated as "no update" rather than risking a
/// false positive from a misconfigured server value.
fn is_newer(latest: &str, current: &str) -> bool {
    fn parts(v: &str) -> Option<Vec<u64>> {
        v.trim().split('.').map(|p| p.trim().parse::<u64>().ok()).collect()
    }
    match (parts(latest), parts(current)) {
        (Some(l), Some(c)) => {
            for i in 0..l.len().max(c.len()) {
                let lp = l.get(i).copied().unwrap_or(0);
                let cp = c.get(i).copied().unwrap_or(0);
                if lp != cp {
                    return lp > cp;
                }
            }
            false
        }
        _ => false,
    }
}

pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/releases/latest", crate::license::api_base_url()))
        .send()
        .await
        .map_err(|e| format!("Could not reach the update server: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Update check failed: HTTP {}", response.status()));
    }

    let body: LatestReleaseResponse = response
        .json()
        .await
        .map_err(|e| format!("Unexpected server response: {e}"))?;
    let update_available = is_newer(&body.latest_version, &current_version);

    Ok(UpdateInfo {
        current_version,
        latest_version: body.latest_version,
        update_available,
        release_notes: body.release_notes,
        download_url: body.download_url,
    })
}

#[cfg(test)]
mod tests {
    use super::is_newer;

    #[test]
    fn detects_patch_and_minor_bumps() {
        assert!(is_newer("1.0.1", "1.0.0"));
        assert!(is_newer("1.1.0", "1.0.9"));
        assert!(!is_newer("1.0.0", "1.0.0"));
        assert!(!is_newer("1.0.0", "1.0.1"));
    }

    #[test]
    fn compares_numerically_not_lexicographically() {
        assert!(is_newer("1.10.0", "1.9.0"));
        assert!(!is_newer("1.9.0", "1.10.0"));
    }

    #[test]
    fn malformed_version_never_reports_an_update() {
        assert!(!is_newer("not-a-version", "1.0.0"));
        assert!(!is_newer("1.0.0", "not-a-version"));
    }
}
