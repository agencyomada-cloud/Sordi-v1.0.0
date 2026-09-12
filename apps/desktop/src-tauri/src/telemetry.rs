//! Anonymous, disclosed diagnostic heartbeat — sends the machine's
//! identifiers and a handful of aggregate record counts once per day, so
//! we can tell how many installs are actually active. Deliberately
//! carries no PII: no company name, no phone, no client/invoice records,
//! just counts. Disclosed in Settings > "Télémétrie & Diagnostics" (see
//! commands.rs's get_telemetry_status/set_telemetry_enabled), on by
//! default but a single toggle away from off — never gated behind
//! require_active_license(), since a privacy control must work
//! regardless of license state.
//!
//! Fail-silent by design, the same way license.rs's verify_background()
//! already is: any network/server failure here is swallowed, never
//! surfaced as a toast/error, and never blocks anything — this only ever
//! runs on its own background task, never on the request path of any
//! command a user is waiting on.
//!
//! The server side (a `/telemetry/heartbeat` route on the same apps/api
//! service license.rs already talks to) is NOT part of this change — this
//! is the client half only. Until that route exists, this silently no-ops
//! against a 404, which is exactly the fail-silent behavior it's built
//! for anyway.

use rusqlite::Connection;
use serde::Serialize;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

const HEARTBEAT_INTERVAL_SECS: i64 = 24 * 60 * 60;
const ENABLED_SETTING_KEY: &str = "telemetry_enabled";
const LAST_SENT_SETTING_KEY: &str = "telemetry_last_sent_at";

// Independent from license.rs's own SORDI_LICENSE_API_URL — telemetry and
// licensing are conceptually separate endpoints, even though they default
// to the same local apps/api instance today.
const DEFAULT_API_BASE_URL: &str = "http://localhost:4000";
fn api_base_url() -> &'static str {
    option_env!("SORDI_TELEMETRY_API_URL").unwrap_or(DEFAULT_API_BASE_URL)
}

#[derive(Serialize)]
struct HeartbeatPayload {
    machine_id: String,
    device_fingerprint: String,
    app_version: String,
    invoices_count: i64,
    clients_count: i64,
    expenses_count: i64,
    last_active_at: String,
    // std::env::consts::OS: "macos" | "windows" | "linux" — a plain literal,
    // no PII, same spirit as app_version.
    os_platform: String,
}

fn now_unix() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn read_setting(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| row.get::<_, String>(0)).ok()
}

fn write_setting(conn: &Connection, key: &str, value: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
        rusqlite::params![key, value],
    )?;
    Ok(())
}

/// Defaults to enabled — this is the disclosed, anonymous, opt-out kind of
/// telemetry (no PII, documented in Settings), not an opt-in-required
/// consent flow. Missing key (never toggled) reads as enabled; an explicit
/// "false" is the only way it reads as disabled.
fn is_enabled(conn: &Connection) -> bool {
    read_setting(conn, ENABLED_SETTING_KEY).map(|v| v != "false").unwrap_or(true)
}

fn is_due(conn: &Connection) -> bool {
    match read_setting(conn, LAST_SENT_SETTING_KEY).and_then(|v| v.parse::<i64>().ok()) {
        Some(last_sent) => now_unix() - last_sent >= HEARTBEAT_INTERVAL_SECS,
        None => true,
    }
}

fn count_rows(conn: &Connection, table: &str) -> i64 {
    // `table` is always one of the 3 hardcoded literals below, never
    // user input — safe to interpolate directly, rusqlite has no
    // parameter binding for identifiers anyway.
    conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| row.get(0)).unwrap_or(0)
}

/// Read-only status for the Settings UI — never triggers a send itself,
/// just reports what would happen and what already has.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryStatus {
    pub enabled: bool,
    pub last_sent_at: Option<String>,
}

pub fn status(conn: &Connection) -> TelemetryStatus {
    TelemetryStatus {
        enabled: is_enabled(conn),
        last_sent_at: read_setting(conn, LAST_SENT_SETTING_KEY)
            .and_then(|v| v.parse::<i64>().ok())
            .and_then(|ts| chrono::DateTime::<chrono::Utc>::from_timestamp(ts, 0))
            .map(|dt| dt.to_rfc3339()),
    }
}

pub fn set_enabled(conn: &Connection, enabled: bool) -> Result<(), String> {
    write_setting(conn, ENABLED_SETTING_KEY, if enabled { "true" } else { "false" }).map_err(|e| e.to_string())
}

/// Shared by both call sites below. Takes a path rather than a live
/// Connection deliberately: rusqlite::Connection isn't Send, so holding one
/// across the `.await` on the HTTP call below would make the enclosing
/// future !Send, which tauri::async_runtime::spawn requires. Instead this
/// opens two short-lived connections — one to read the counts before the
/// network call, one to write the throttle timestamp after — neither ever
/// alive across an await point. Every failure path is a silent early return
/// by design (see the module doc): this has no error to report to anything,
/// ever. Only marks LAST_SENT_SETTING_KEY on a genuine 2xx, so a network
/// failure retries on the next opportunity rather than waiting out the full
/// throttle window for nothing.
async fn build_and_send_heartbeat(db_path: &PathBuf, app_version: &str) {
    let Ok(machine_id) = crate::license::compute_machine_id() else { return };
    let Ok(device_fingerprint) = crate::license::compute_device_fingerprint() else { return };

    let payload = {
        let Ok(conn) = Connection::open(db_path) else { return };
        HeartbeatPayload {
            machine_id,
            device_fingerprint,
            app_version: app_version.to_string(),
            invoices_count: count_rows(&conn, "invoices"),
            clients_count: count_rows(&conn, "clients"),
            expenses_count: count_rows(&conn, "expenses"),
            last_active_at: now_iso(),
            os_platform: std::env::consts::OS.to_string(),
        }
    };

    let Ok(client) = reqwest::Client::builder().timeout(std::time::Duration::from_secs(10)).build() else { return };
    let result = client.post(format!("{}/telemetry/heartbeat", api_base_url())).json(&payload).send().await;

    if matches!(result, Ok(resp) if resp.status().is_success()) {
        if let Ok(conn) = Connection::open(db_path) {
            let _ = write_setting(&conn, LAST_SENT_SETTING_KEY, &now_unix().to_string());
        }
    }
}

/// Fire-and-forget from lib.rs's setup(), same shape as the existing
/// rolling-backup background thread right next to it — its own Tauri-
/// managed async task, not the caller's own thread/runtime. Throttled to
/// once per HEARTBEAT_INTERVAL_SECS via is_due() — see
/// send_heartbeat_immediately() below for the one path that bypasses that.
pub fn maybe_send_heartbeat_in_background(db_path: PathBuf, app_version: &'static str) {
    tauri::async_runtime::spawn(async move {
        let due = {
            let Ok(conn) = Connection::open(&db_path) else { return };
            is_enabled(&conn) && is_due(&conn)
        };
        if !due {
            return;
        }
        build_and_send_heartbeat(&db_path, app_version).await;
    });
}

/// Bypasses is_due()'s 24h throttle — called right after a successful
/// license activation (see license.rs's activate()) so the admin dashboard
/// reflects the new "active" status and real device_fingerprint immediately,
/// instead of waiting up to a day for the next scheduled heartbeat. Still
/// respects is_enabled(): the anonymous-telemetry opt-out in Settings is a
/// privacy control and must never be bypassed by an internal caller, even
/// this one.
pub fn send_heartbeat_immediately(db_path: PathBuf, app_version: &'static str) {
    tauri::async_runtime::spawn(async move {
        let enabled = {
            let Ok(conn) = Connection::open(&db_path) else { return };
            is_enabled(&conn)
        };
        if !enabled {
            return;
        }
        build_and_send_heartbeat(&db_path, app_version).await;
    });
}
