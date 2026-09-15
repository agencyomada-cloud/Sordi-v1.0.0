use crate::database::{generate_invoice_number, generate_document_number, peek_next_document_number, sync_document_number_sequence, generate_delivery_note_number, generate_order_number, recalculate_invoice_totals, update_invoice_payment_status};
use std::sync::Mutex;
use rusqlite::Connection;
use tauri::{AppHandle, State};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use chrono::Datelike;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use uuid::Uuid;

#[tauri::command]
pub fn has_password_set(db: State<'_, Mutex<Connection>>) -> Result<bool, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    crate::database::has_password_set(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_password(db: State<'_, Mutex<Connection>>, password: String) -> Result<bool, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    crate::database::check_password(&conn, &password).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_password(db: State<'_, Mutex<Connection>>, new_password: String) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    crate::database::set_password(&conn, &new_password).map_err(|e| e.to_string())
}

// ============= LICENSING =============
// See license.rs for the full design. These three commands never call
// require_active_license() themselves — that would make it impossible to
// ever activate or check status again once read-only.

#[tauri::command]
pub fn get_license_status() -> crate::license::LicenseStatus {
    crate::license::current_status()
}

#[tauri::command]
pub async fn activate_license(
    db: State<'_, Mutex<Connection>>,
    license_key: String,
) -> Result<crate::license::LicenseStatus, String> {
    let status = crate::license::activate(license_key).await?;

    // Send an immediate, un-throttled heartbeat right after a successful
    // activation so the admin dashboard reflects the new status without
    // waiting up to 24h for the next scheduled one (see telemetry.rs's
    // send_heartbeat_immediately doc comment).
    if status.state == "active" {
        if let Ok(conn) = db.lock() {
            if let Some(path) = conn.path() {
                crate::telemetry::send_heartbeat_immediately(std::path::PathBuf::from(path), env!("CARGO_PKG_VERSION"));
            }
        }
    }

    Ok(status)
}

#[tauri::command]
pub async fn verify_license_background() -> crate::license::LicenseStatus {
    crate::license::verify_background().await
}

// ============= UPDATE CHECK =============

#[tauri::command]
pub async fn check_for_updates() -> Result<crate::updates::UpdateInfo, String> {
    crate::updates::check_for_updates().await
}

/// SetupWizard's Step 4 ("no license yet" screen) — a self-service trial
/// request, not an existing key. Same immediate-heartbeat pattern as
/// activate_license above: the trial unlocks right away, so the admin
/// dashboard should reflect it without waiting for the next scheduled sync.
#[tauri::command]
pub async fn request_trial(
    db: State<'_, Mutex<Connection>>,
    organization_name: String,
    phone: String,
    email: String,
) -> Result<crate::license::LicenseStatus, String> {
    let status = crate::license::request_trial(organization_name, phone, email).await?;

    if status.state == "active" {
        if let Ok(conn) = db.lock() {
            if let Some(path) = conn.path() {
                crate::telemetry::send_heartbeat_immediately(std::path::PathBuf::from(path), env!("CARGO_PKG_VERSION"));
            }
        }
    }

    Ok(status)
}

/// Human-readable "SRD-XXXX-XXXX-XXXX" code shown to the user for manual/
/// offline license activation (e.g. reading it to support over the phone,
/// or pasting it into a purchase form) — distinct from the opaque device
/// fingerprint silently embedded in the license token itself. See
/// license.rs's compute_machine_id() for why these are two separate values.
#[tauri::command]
pub fn get_machine_id() -> Result<String, String> {
    crate::license::compute_machine_id()
}

// ============= GLOBAL SEARCH =============
// Phase 1: clients + invoices only (live, bounded queries) — Produits/
// Commandes deferred to a later phase. Read-only, never license-gated.
// One command, one IPC round trip, per the reviewed plan: LIKE '%query%'
// against a local SQLite connection already open in-process is ~1-3ms even
// at 5,000-20,000 rows (measured against a synthetic dataset at that scale
// before implementing), so this needs no caching/indexing to feel instant —
// LIMIT 5 per entity keeps results short enough for a command palette.

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ClientSearchHit {
    pub id: String,
    pub name: String,
    pub code: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InvoiceSearchHit {
    pub id: String,
    pub invoice_number: String,
    pub client_name: Option<String>,
    pub total_ttc: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GlobalSearchResults {
    pub clients: Vec<ClientSearchHit>,
    pub invoices: Vec<InvoiceSearchHit>,
}

#[tauri::command]
pub fn search_global(db: State<'_, Mutex<Connection>>, company_id: String, query: String) -> Result<GlobalSearchResults, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(GlobalSearchResults { clients: Vec::new(), invoices: Vec::new() });
    }
    let conn = db.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", trimmed);

    let mut client_stmt = conn
        .prepare("SELECT id, name, code FROM clients WHERE company_id = ?1 AND (name LIKE ?2 OR code LIKE ?2) ORDER BY name LIMIT 5")
        .map_err(|e| e.to_string())?;
    let clients = client_stmt
        .query_map(params![company_id, pattern], |row| {
            Ok(ClientSearchHit { id: row.get(0)?, name: row.get(1)?, code: row.get(2)? })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut invoice_stmt = conn
        .prepare(
            "SELECT i.id, i.invoice_number, c.name, i.total_ttc \
             FROM invoices i LEFT JOIN clients c ON c.id = i.client_id \
             WHERE i.company_id = ?1 AND i.invoice_number LIKE ?2 ORDER BY i.invoice_date DESC LIMIT 5",
        )
        .map_err(|e| e.to_string())?;
    let invoices = invoice_stmt
        .query_map(params![company_id, pattern], |row| {
            Ok(InvoiceSearchHit {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                client_name: row.get(2)?,
                total_ttc: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(GlobalSearchResults { clients, invoices })
}

// ============= HISTORY / LOGS =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ActivityLog {
    pub id: String,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<String>,
    pub description: String,
    pub user_id: Option<String>,
    pub created_at: String,
}

/// Translates a raw `UNIQUE constraint failed` SQLite error into a clear
/// French message naming the field, instead of letting the opaque SQLite
/// text reach the user. Pass the exact error a failed `INSERT`/`UPDATE`
/// returned and the human label for what's duplicated (e.g. "cette
/// référence"/"ce numéro de facture") — returns that mapped message when
/// the error really is a UNIQUE violation, or the error's own message
/// unchanged for anything else (so a genuinely different failure still
/// surfaces as-is, just without pretending to explain it).
fn friendly_unique_constraint_error(err: rusqlite::Error, duplicate_label: &str) -> String {
    if let rusqlite::Error::SqliteFailure(ref sqlite_err, Some(ref msg)) = err {
        if sqlite_err.code == rusqlite::ErrorCode::ConstraintViolation && msg.contains("UNIQUE constraint failed") {
            return format!("{} est déjà utilisé(e) par un autre enregistrement.", duplicate_label);
        }
    }
    err.to_string()
}

pub fn log_activity(conn: &Connection, action: &str, entity_type: &str, entity_id: Option<&str>, description: &str) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let created_at = chrono::Local::now().to_rfc3339();
    
    conn.execute(
        "INSERT INTO activity_logs (id, action, entity_type, entity_id, description, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, action, entity_type, entity_id, description, created_at],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn get_activity_logs(
    db: State<'_, Mutex<Connection>>, 
    limit: Option<i64>,
    entity_type: Option<String>,
    action: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>
) -> Result<Vec<ActivityLog>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    
    let mut query = String::from("SELECT * FROM activity_logs WHERE 1=1");
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    let mut param_index = 1;

    if let Some(et) = entity_type {
        query.push_str(&format!(" AND entity_type = ?{}", param_index));
        params_vec.push(Box::new(et));
        param_index += 1;
    }

    if let Some(act) = action {
        query.push_str(&format!(" AND action = ?{}", param_index));
        params_vec.push(Box::new(act));
        param_index += 1;
    }
    
    if let Some(start) = start_date {
        query.push_str(&format!(" AND created_at >= ?{}", param_index));
        params_vec.push(Box::new(start));
        param_index += 1;
    }

    if let Some(end) = end_date {
        query.push_str(&format!(" AND created_at <= ?{}", param_index));
        params_vec.push(Box::new(end));
        param_index += 1;
    }

    query.push_str(&format!(" ORDER BY created_at DESC LIMIT ?{}", param_index));
    let limit_val = limit.unwrap_or(50);
    params_vec.push(Box::new(limit_val));

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    // Create a slice of references to satisfy query_map expected signature
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    let logs = stmt.query_map(&*params_refs, |row| {
        Ok(ActivityLog {
            id: row.get(0)?,
            action: row.get(1)?,
            entity_type: row.get(2)?,
            entity_id: row.get(3)?,
            description: row.get(4)?,
            user_id: row.get(5)?,
            created_at: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for log in logs {
        result.push(log.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn clear_activity_logs(db: State<'_, Mutex<Connection>>) -> Result<(), String> {
    crate::license::require_active_license()?;
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM activity_logs", []).map_err(|e| e.to_string())?;
    Ok(())
}

/// Wipes every transactional row for one company back to a clean factory
/// state — clients, suppliers, invoices (and everything that hangs off an
/// invoice: items, payments, attachments), expenses, contracts, projects
/// (and its tasks/deliverables), delivery notes, orders, client advances
/// and draft products, and this company's activity log. Deliberately does
/// NOT touch companies, employees, partners, products, or the flat
/// `settings`/`sequences` tables — those are configuration/roster data, not
/// transaction history, and the request this implements explicitly listed
/// `companies` as protected. Scoped to one company_id (not a blanket
/// `DELETE FROM x` with no WHERE) since the schema is multi-tenant and a
/// reset must never touch another company's data sharing the same file.
///
/// Table order matters here: `invoice_items`/`payment_attachments`/
/// `project_tasks`/`project_deliverables`/`order_items`/
/// `delivery_note_items`/`client_advances`/`client_draft_products` all
/// cascade automatically (ON DELETE CASCADE) off their parent, so they're
/// never targeted directly. But several parent-level FKs have NO cascade
/// or SET NULL behavior at all (a plain FK) and must be cleared in
/// dependency order or the DELETE fails with a foreign key constraint
/// violation and the whole transaction rolls back:
///   - payments.invoice_id -> invoices
///   - delivery_notes.invoice_id -> invoices, delivery_notes.order_id -> orders,
///     delivery_notes.client_id -> clients
///   - invoices.client_id -> clients
///   - projects.client_id -> clients
///   - contracts.client_id -> clients (contracts.project_id IS
///     ON DELETE SET NULL, so its order relative to projects doesn't matter)
/// That fixes the topological order to: payments and delivery_notes first
/// (both depend on invoices/orders/clients), then contracts and invoices
/// and projects and orders (all depend only on clients, order among
/// themselves doesn't matter), then clients/suppliers last once nothing
/// references them. expenses has no blocking FK (SET NULL to both
/// projects and suppliers) so its position doesn't matter either. The
/// invoice_number/delivery_note_number/order_number counters in
/// `sequences` are reset to 0 so the next-number generators start over at
/// 001; contract numbering isn't sequence-based (it's a live COUNT() over
/// the contracts table), so it resets on its own once that table is empty.
#[tauri::command]
pub fn reset_company_to_factory_state(db: State<'_, Mutex<Connection>>, company_id: String) -> Result<(), String> {
    crate::license::require_active_license()?;
    let mut conn = db.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    for table in [
        "payments", "delivery_notes", "contracts", "invoices", "projects",
        "orders", "expenses", "clients", "suppliers",
    ] {
        tx.execute(&format!("DELETE FROM {} WHERE company_id = ?1", table), params![company_id])
            .map_err(|e| e.to_string())?;
    }
    // activity_logs has no company_id column (it predates multi-company
    // support) — clearing it here is a blanket wipe across every company
    // sharing this database file, not scoped to company_id like the tables
    // above. Confirmed acceptable for now (single-company usage); revisit
    // if per-company activity scoping is ever added to that table.
    tx.execute("DELETE FROM activity_logs", []).map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE sequences SET value = 0 WHERE name IN ('invoice_number', 'delivery_note_number', 'order_number')",
        [],
    ).map_err(|e| e.to_string())?;

    // Blank out the company's own fiscal/profile fields (name kept as a
    // neutral placeholder since the column is NOT NULL). This is the piece
    // the transactional-table wipe above never touched, which is why old
    // NIF/NIS/RC/logo kept reappearing after a "factory reset" — those live
    // directly on the companies row, not in a deletable child table.
    tx.execute(
        "UPDATE companies SET
            name = 'Ma Société', logo_base64 = '', activity = '', rc = '',
            nif = '', nis = '', article_imposition = '', address = '',
            phone = '', phones = '', email = '', website = '', capital = '',
            rib = '', bank_agency = '', extra_info = '', cnas_adherent = ''
         WHERE id = ?1",
        params![company_id],
    ).map_err(|e| e.to_string())?;

    // The `settings` table is a global key-value store (not scoped to
    // company_id) that holds every visual/branding asset — logo, stamp,
    // signature, QR code, footer logo, background pattern — plus the color
    // theme and the legacy company_* mirror fields. None of it is touched
    // by the DELETEs above, so it has to be reset explicitly here too.
    for key in [
        "logo_data", "stamp_data", "signature_data", "footer_logo_data",
        "body_pattern_data", "qr_code_data",
        "company_name", "company_address", "company_rc", "company_nif",
        "company_nis", "company_ai", "company_activity",
        "company_cnas_adherent", "company_rib", "company_phone",
        "company_phones", "company_email", "company_website",
        "company_capital", "company_bank_agency", "company_extra_info",
    ] {
        tx.execute("DELETE FROM settings WHERE key = ?1", params![key]).map_err(|e| e.to_string())?;
    }
    for (key, default_value) in [
        ("primary_color", "#FF2949"),
        ("logo_bg_color", "#000000"),
        ("logo_text_color", "#FFFFFF"),
        ("logo_size", "64"),
        ("company_info_size", "9"),
        ("stamp_size", "96"),
        ("signature_size", "96"),
    ] {
        tx.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, default_value],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "RESET", "COMPANY", Some(&company_id), "Réinitialisation aux valeurs d'usine — toutes les données transactionnelles et le profil entreprise ont été supprimés");

    Ok(())
}

// ============= CLIENTS =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Client {
    pub id: String,
    pub company_id: Option<String>,
    pub code: Option<String>,
    pub name: String,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub wilaya: Option<String>,
    pub nif: Option<String>,
    pub nis: Option<String>,
    pub rc: Option<String>,
    pub secondary_rc: Option<String>,
    pub secondary_address: Option<String>,
    pub ai: Option<String>,
    pub activite: Option<String>,
    pub credit_limit: Option<f64>,
    pub payment_terms_days: Option<i64>,
    pub notes: Option<String>,
    pub is_active: Option<bool>,
    pub initial_balance: Option<f64>,
    pub advance_payment: Option<f64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateClientData {
    pub company_id: String,
    pub name: String,
    pub code: Option<String>,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub wilaya: Option<String>,
    pub nif: Option<String>,
    pub nis: Option<String>,
    pub rc: Option<String>,
    pub secondary_rc: Option<String>,
    pub secondary_address: Option<String>,
    pub ai: Option<String>,
    pub activite: Option<String>,
    pub credit_limit: Option<f64>,
    pub payment_terms_days: Option<i64>,
    pub notes: Option<String>,
    pub initial_balance: Option<f64>,
    pub advance_payment: Option<f64>,
}

/// update_client's payload — deliberately NOT CreateClientData. company_id
/// never changes on an edit (the UPDATE statement below doesn't touch that
/// column at all), but CreateClientData requires it as a non-optional
/// field; the frontend's edit form (NewClient.tsx) never sends it, so
/// Tauri's IPC deserialization was rejecting every update with "missing
/// field `company_id`" before this command's body ever ran — surfacing to
/// the user as a generic "Erreur lors de la mise à jour du client" toast
/// with no indication it was a payload-shape mismatch rather than a real
/// constraint/SQL failure.
#[derive(Deserialize)]
pub struct UpdateClientData {
    pub name: String,
    pub code: Option<String>,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub wilaya: Option<String>,
    pub nif: Option<String>,
    pub nis: Option<String>,
    pub rc: Option<String>,
    pub secondary_rc: Option<String>,
    pub secondary_address: Option<String>,
    pub ai: Option<String>,
    pub activite: Option<String>,
    pub credit_limit: Option<f64>,
    pub payment_terms_days: Option<i64>,
    pub notes: Option<String>,
    pub initial_balance: Option<f64>,
}

const CLIENT_COLUMNS: &str = "id, company_id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, activite";

fn map_client_row(row: &rusqlite::Row) -> rusqlite::Result<Client> {
    Ok(Client {
        id: row.get(0)?,
        company_id: row.get(1)?,
        code: row.get(2)?,
        name: row.get(3)?,
        contact_person: row.get(4)?,
        phone: row.get(5)?,
        email: row.get(6)?,
        address: row.get(7)?,
        city: row.get(8)?,
        wilaya: row.get(9)?,
        nif: row.get(10)?,
        nis: row.get(11)?,
        rc: row.get(12)?,
        secondary_rc: row.get(13).unwrap_or(None),
        secondary_address: row.get(14).unwrap_or(None),
        ai: row.get(15).unwrap_or(None),
        credit_limit: row.get(16).unwrap_or(None),
        payment_terms_days: row.get(17).unwrap_or(None),
        notes: row.get(18).unwrap_or(None),
        is_active: row.get::<_, Option<i64>>(19)?.map(|v| v != 0),
        created_at: row.get(20)?,
        updated_at: row.get(21)?,
        initial_balance: row.get(22).unwrap_or(None),
        advance_payment: row.get(23).unwrap_or(None),
        activite: row.get(24).unwrap_or(None),
    })
}

#[tauri::command]
pub fn get_clients(db: State<'_, Mutex<Connection>>, company_id: String) -> Result<Vec<Client>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        &format!("SELECT {} FROM clients WHERE company_id = ?1 ORDER BY name", CLIENT_COLUMNS)
    ).map_err(|e| e.to_string())?;
    let clients = stmt.query_map(params![company_id], map_client_row).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for client in clients {
        result.push(client.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn get_client(db: State<'_, Mutex<Connection>>, id: String) -> Result<Option<Client>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        &format!("SELECT {} FROM clients WHERE id = ?1", CLIENT_COLUMNS)
    ).map_err(|e| e.to_string())?;
    let client = stmt.query_row(params![id], map_client_row);
    
    match client {
        Ok(c) => Ok(Some(c)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn create_client(db: State<'_, Mutex<Connection>>, data: CreateClientData) -> Result<Client, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    conn.execute(
        "INSERT INTO clients (id, company_id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, activite) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25)",
        params![
            id,
            data.company_id,
            data.code,
            data.name,
            data.contact_person,
            data.phone,
            data.email,
            data.address,
            data.city,
            data.wilaya,
            data.nif,
            data.nis,
            data.rc,
            data.secondary_rc,
            data.secondary_address,
            data.ai,
            data.credit_limit,
            data.payment_terms_days,
            data.notes,
            1i64, // is_active
            now,
            now,
            data.initial_balance.unwrap_or(0.0),
            data.advance_payment.unwrap_or(0.0),
            data.activite,
        ],
    ).map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "CREATE", "CLIENT", Some(&id), &format!("Nouveau client créé: {}", data.name));
    
    drop(conn);
    
    get_client(db, id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve created client".to_string())
}

#[tauri::command]
pub fn update_client(db: State<'_, Mutex<Connection>>, id: String, data: UpdateClientData) -> Result<Client, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    
    conn.execute(
        "UPDATE clients SET code = ?2, name = ?3, contact_person = ?4, phone = ?5, email = ?6, address = ?7, city = ?8, wilaya = ?9, nif = ?10, nis = ?11, rc = ?12, secondary_rc = ?13, secondary_address = ?14, ai = ?15, credit_limit = ?16, payment_terms_days = ?17, notes = ?18, updated_at = ?19, initial_balance = ?20, activite = ?21 WHERE id = ?1",
        params![
            id,
            data.code,
            data.name,
            data.contact_person,
            data.phone,
            data.email,
            data.address,
            data.city,
            data.wilaya,
            data.nif,
            data.nis,
            data.rc,
            data.secondary_rc,
            data.secondary_address,
            data.ai,
            data.credit_limit,
            data.payment_terms_days,
            data.notes,
            now,
            data.initial_balance.unwrap_or(0.0),
            data.activite,
        ],
    ).map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "UPDATE", "CLIENT", Some(&id), &format!("Client mis à jour: {}", data.name));
    
    drop(conn);
    
    get_client(db, id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve updated client".to_string())
}

#[tauri::command]
pub fn delete_client(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;

    // clients.id is referenced (with no ON DELETE cascade — these are real
    // financial/legal records, cascading them away by accident would be
    // far worse than a blocked delete) by invoices, delivery_notes,
    // projects, and contracts. Without this check, deleting a client with
    // any of those still attached hits a raw SQLite FOREIGN KEY constraint
    // error — which the frontend's safeInvoke wrapper was silently
    // swallowing into a fake "success", leaving the client stuck forever
    // with no explanation. Checking up front turns that into one clear,
    // actionable message naming exactly what's still attached.
    let mut blockers: Vec<String> = Vec::new();
    for (table, singular, plural) in [
        ("invoices", "facture liée", "factures liées"),
        ("delivery_notes", "bon de livraison lié", "bons de livraison liés"),
        ("projects", "projet lié", "projets liés"),
        ("contracts", "contrat lié", "contrats liés"),
    ] {
        let count: i64 = conn
            .query_row(
                &format!("SELECT COUNT(*) FROM {} WHERE client_id = ?1", table),
                params![id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if count > 0 {
            let label = if count == 1 { singular } else { plural };
            blockers.push(format!("{} {}", count, label));
        }
    }

    if !blockers.is_empty() {
        return Err(format!(
            "Impossible de supprimer ce client : {}. Supprimez-les d'abord.",
            blockers.join(", ")
        ));
    }

    conn.execute("DELETE FROM clients WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "DELETE", "CLIENT", Some(&id), "Client supprimé");
    Ok(())
}

// ============= COMPANIES (Multi-workspace) =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Company {
    pub id: String,
    pub name: String,
    pub logo_base64: Option<String>,
    pub activity: Option<String>,
    /// Algerian legal form — EURL, SARL, SPA, SNC, Auto-entrepreneur,
    /// Personne physique / Établissement individuel. Distinct from
    /// `activity` (business sector, e.g. "Services") — this is the legal
    /// structure printed on official documents.
    pub legal_form: Option<String>,
    pub rc: Option<String>,
    pub nif: Option<String>,
    pub nis: Option<String>,
    pub article_imposition: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    /// JSON-encoded array of additional phone numbers.
    pub phones: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    pub capital: Option<String>,
    pub rib: Option<String>,
    pub bank_agency: Option<String>,
    /// JSON-encoded array of free-form extra info lines.
    pub extra_info: Option<String>,
    pub cnas_adherent: Option<String>,
    pub currency: String,
    pub invoice_prefix: String,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateCompanyData {
    pub name: String,
    pub logo_base64: Option<String>,
    pub activity: Option<String>,
    pub legal_form: Option<String>,
    pub rc: Option<String>,
    pub nif: Option<String>,
    pub nis: Option<String>,
    pub article_imposition: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub phones: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    pub capital: Option<String>,
    pub rib: Option<String>,
    pub bank_agency: Option<String>,
    pub extra_info: Option<String>,
    pub cnas_adherent: Option<String>,
    pub currency: Option<String>,
    pub invoice_prefix: Option<String>,
}

fn map_company_row(row: &rusqlite::Row) -> rusqlite::Result<Company> {
    Ok(Company {
        id: row.get("id")?,
        name: row.get("name")?,
        logo_base64: row.get("logo_base64")?,
        activity: row.get("activity")?,
        legal_form: row.get("legal_form").unwrap_or(None),
        rc: row.get("rc")?,
        nif: row.get("nif")?,
        nis: row.get("nis")?,
        article_imposition: row.get("article_imposition")?,
        address: row.get("address")?,
        phone: row.get("phone")?,
        phones: row.get("phones")?,
        email: row.get("email")?,
        website: row.get("website")?,
        capital: row.get("capital")?,
        rib: row.get("rib")?,
        bank_agency: row.get("bank_agency")?,
        extra_info: row.get("extra_info")?,
        cnas_adherent: row.get("cnas_adherent")?,
        currency: row.get("currency")?,
        invoice_prefix: row.get("invoice_prefix")?,
        created_at: row.get("created_at")?,
    })
}

#[tauri::command]
pub fn get_companies(db: State<'_, Mutex<Connection>>) -> Result<Vec<Company>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM companies ORDER BY created_at").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], map_company_row).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>();
    rows.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_company(db: State<'_, Mutex<Connection>>, id: String) -> Result<Option<Company>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM companies WHERE id = ?1").map_err(|e| e.to_string())?;
    match stmt.query_row(params![id], map_company_row) {
        Ok(c) => Ok(Some(c)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn create_company(db: State<'_, Mutex<Connection>>, data: CreateCompanyData) -> Result<Company, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // The very first company (SetupWizard's Step 1, "Bienvenue dans Sordi")
    // must be creatable on a genuinely fresh, unactivated install — there is
    // no license to check yet at that point, and every company-scoped query
    // in the app gates on a company existing at all (useWorkspace().isReady).
    // Gating this unconditionally made onboarding itself impossible: a brand
    // new customer could never get past step 1.
    //
    // Deliberately gated on has_password_set() (SELECT COUNT(*) FROM users),
    // NOT on company count: this app is single-user, so "no password set
    // yet" is the one reliable signal that SetupWizard itself is still
    // running (see useAuth's needsSetup, which is set from this exact same
    // query and is what makes SetupWizard render at all) — a company row
    // count is not reliable here, since a database that already went
    // through onboarding once (e.g. during earlier testing, or a factory
    // reset that didn't fully clear every table) can carry stray company
    // rows without ever having had a real license, which would incorrectly
    // re-trigger the license gate on a still-unactivated install. Once a
    // password exists, onboarding is over and a real license is required
    // for any further company (protects against an unlicensed install
    // spinning up unlimited multi-company workspaces).
    let password_set = crate::database::has_password_set(&conn).map_err(|e| e.to_string())?;
    if password_set {
        crate::license::require_active_license()?;
    }

    // STRICT SINGLE-ENTERPRISE LOCK: Sordi no longer supports multi-company
    // workspaces at all — once onboarding has produced a real password (see
    // has_password_set above), this command must never create a second
    // company row, licensed or not. The former behavior (a licensed user
    // could spin up additional companies) is intentionally removed; this is
    // now a hard, unconditional block rather than a license check.
    if password_set {
        let existing_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM companies", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        if existing_count > 0 {
            return Err("Une seule entreprise est autorisée par installation de Sordi.".to_string());
        }
    }

    // Onboarding's Step 1 (still pre-password) is the one caller that can
    // land here while the migration-seeded default company row still sits
    // untouched in the database — see migrate_multi_company_if_needed's doc
    // comment. Rather than INSERTing a second row, fold the user's real
    // company info into it.
    if !password_set {
        if let Some(seed_id) = crate::database::find_updatable_seed_company(&conn).map_err(|e| e.to_string())? {
            conn.execute(
                "UPDATE companies SET name = ?1, logo_base64 = ?2, activity = ?3, legal_form = ?4, rc = ?5, nif = ?6, nis = ?7, article_imposition = ?8, address = ?9, phone = ?10, phones = ?11, email = ?12, website = ?13, capital = ?14, rib = ?15, bank_agency = ?16, extra_info = ?17, cnas_adherent = ?18, currency = ?19, invoice_prefix = ?20 WHERE id = ?21",
                params![
                    data.name,
                    data.logo_base64,
                    data.activity,
                    data.legal_form,
                    data.rc,
                    data.nif,
                    data.nis,
                    data.article_imposition,
                    data.address,
                    data.phone,
                    data.phones,
                    data.email,
                    data.website,
                    data.capital,
                    data.rib,
                    data.bank_agency,
                    data.extra_info,
                    data.cnas_adherent,
                    data.currency.unwrap_or_else(|| "DZD".to_string()),
                    data.invoice_prefix.unwrap_or_else(|| "FAC-2026-".to_string()),
                    seed_id,
                ],
            ).map_err(|e| e.to_string())?;

            let _ = log_activity(&conn, "UPDATE", "COMPANY", Some(&seed_id), &format!("Entreprise renseignée lors de l'onboarding: {}", data.name));

            drop(conn);
            return get_company(db, seed_id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve updated company".to_string());
        }
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO companies (id, name, logo_base64, activity, legal_form, rc, nif, nis, article_imposition, address, phone, phones, email, website, capital, rib, bank_agency, extra_info, cnas_adherent, currency, invoice_prefix, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)",
        params![
            id,
            data.name,
            data.logo_base64,
            data.activity,
            data.legal_form,
            data.rc,
            data.nif,
            data.nis,
            data.article_imposition,
            data.address,
            data.phone,
            data.phones,
            data.email,
            data.website,
            data.capital,
            data.rib,
            data.bank_agency,
            data.extra_info,
            data.cnas_adherent,
            data.currency.unwrap_or_else(|| "DZD".to_string()),
            data.invoice_prefix.unwrap_or_else(|| "FAC-2026-".to_string()),
            now,
        ],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "COMPANY", Some(&id), &format!("Nouvelle entreprise créée: {}", data.name));

    drop(conn);

    get_company(db, id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve created company".to_string())
}

#[tauri::command]
pub fn update_company(db: State<'_, Mutex<Connection>>, id: String, data: CreateCompanyData) -> Result<Company, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // Same reasoning and same has_password_set()-based gate as
    // create_company just above (see its comment for why company count is
    // not a reliable "onboarding still in progress" signal). Editing the
    // company profile before a password/license exists (RC/NIF/logo/
    // address right after onboarding) is still "initial profile setup,"
    // not the abuse case this gate exists for.
    if crate::database::has_password_set(&conn).map_err(|e| e.to_string())? {
        crate::license::require_active_license()?;
    }

    conn.execute(
        "UPDATE companies SET name = ?2, logo_base64 = ?3, activity = ?4, legal_form = ?5, rc = ?6, nif = ?7, nis = ?8, article_imposition = ?9, address = ?10, phone = ?11, phones = ?12, email = ?13, website = ?14, capital = ?15, rib = ?16, bank_agency = ?17, extra_info = ?18, cnas_adherent = ?19, currency = ?20, invoice_prefix = ?21 WHERE id = ?1",
        params![
            id,
            data.name,
            data.logo_base64,
            data.activity,
            data.legal_form,
            data.rc,
            data.nif,
            data.nis,
            data.article_imposition,
            data.address,
            data.phone,
            data.phones,
            data.email,
            data.website,
            data.capital,
            data.rib,
            data.bank_agency,
            data.extra_info,
            data.cnas_adherent,
            data.currency.unwrap_or_else(|| "DZD".to_string()),
            data.invoice_prefix.unwrap_or_else(|| "FAC-2026-".to_string()),
        ],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "UPDATE", "COMPANY", Some(&id), &format!("Entreprise mise à jour: {}", data.name));

    drop(conn);

    get_company(db, id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve updated company".to_string())
}

// ============= SUPPLIERS (Fournisseurs) =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Supplier {
    pub id: String,
    pub company_id: Option<String>,
    pub name: String,
    pub category: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub rc: Option<String>,
    pub nif: Option<String>,
    pub nis: Option<String>,
    /// Manually tracked unpaid balance (e.g. carried over from a previous
    /// ledger) — distinct from "Total Achats", which is always computed live
    /// from linked expenses. See get_supplier_purchase_totals.
    pub solde_du: Option<f64>,
    pub notes: Option<String>,
    pub is_active: Option<bool>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateSupplierData {
    // Shared with update_supplier, whose UPDATE statement never touches this
    // column — the frontend's update payload omits it (Omit<..., "company_id">),
    // so it must tolerate being absent from that JSON instead of failing
    // deserialization with "missing field `company_id`".
    #[serde(default)]
    pub company_id: String,
    pub name: String,
    pub category: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub rc: Option<String>,
    pub nif: Option<String>,
    pub nis: Option<String>,
    pub solde_du: Option<f64>,
    pub notes: Option<String>,
}

const SUPPLIER_SELECT: &str = "SELECT id, company_id, name, category, phone, email, address, city, rc, nif, nis, solde_du, notes, is_active, created_at, updated_at FROM suppliers";

fn map_supplier_row(row: &rusqlite::Row) -> rusqlite::Result<Supplier> {
    Ok(Supplier {
        id: row.get(0)?,
        company_id: row.get(1)?,
        name: row.get(2)?,
        category: row.get(3)?,
        phone: row.get(4)?,
        email: row.get(5)?,
        address: row.get(6)?,
        city: row.get(7)?,
        rc: row.get(8)?,
        nif: row.get(9)?,
        nis: row.get(10)?,
        solde_du: row.get(11)?,
        notes: row.get(12)?,
        is_active: row.get::<_, Option<i64>>(13)?.map(|v| v != 0),
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
    })
}

#[tauri::command]
pub fn get_suppliers(db: State<'_, Mutex<Connection>>, company_id: String) -> Result<Vec<Supplier>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(&format!("{} WHERE company_id = ?1 ORDER BY name", SUPPLIER_SELECT)).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![company_id], map_supplier_row).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>();
    rows.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_supplier(db: State<'_, Mutex<Connection>>, id: String) -> Result<Option<Supplier>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(&format!("{} WHERE id = ?1", SUPPLIER_SELECT)).map_err(|e| e.to_string())?;
    match stmt.query_row(params![id], map_supplier_row) {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn create_supplier(db: State<'_, Mutex<Connection>>, data: CreateSupplierData) -> Result<Supplier, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO suppliers (id, company_id, name, category, phone, email, address, city, rc, nif, nis, solde_du, notes, is_active, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            id,
            data.company_id,
            data.name,
            data.category,
            data.phone,
            data.email,
            data.address,
            data.city,
            data.rc,
            data.nif,
            data.nis,
            data.solde_du.unwrap_or(0.0),
            data.notes,
            1i64,
            now,
            now,
        ],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "SUPPLIER", Some(&id), &format!("Nouveau fournisseur créé: {}", data.name));

    drop(conn);

    get_supplier(db, id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve created supplier".to_string())
}

#[tauri::command]
pub fn update_supplier(db: State<'_, Mutex<Connection>>, id: String, data: CreateSupplierData) -> Result<Supplier, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE suppliers SET name = ?2, category = ?3, phone = ?4, email = ?5, address = ?6, city = ?7, rc = ?8, nif = ?9, nis = ?10, solde_du = ?11, notes = ?12, updated_at = ?13 WHERE id = ?1",
        params![
            id,
            data.name,
            data.category,
            data.phone,
            data.email,
            data.address,
            data.city,
            data.rc,
            data.nif,
            data.nis,
            data.solde_du.unwrap_or(0.0),
            data.notes,
            now,
        ],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "UPDATE", "SUPPLIER", Some(&id), &format!("Fournisseur mis à jour: {}", data.name));

    drop(conn);

    get_supplier(db, id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve updated supplier".to_string())
}

#[tauri::command]
pub fn delete_supplier(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM suppliers WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "DELETE", "SUPPLIER", Some(&id), "Fournisseur supprimé");
    Ok(())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SupplierPurchaseTotal {
    pub supplier_id: String,
    /// SUM(expenses.amount) for every expense linked to this supplier — live,
    /// never stored. "Total Réglé"/"Solde Restant Dû" are derived on the
    /// frontend from this figure and the supplier's manually-tracked solde_du.
    pub total_achats: f64,
}

/// One call for every supplier's purchase total (Suppliers list), same shape
/// as get_client_overview_stats — avoids N+1 queries per row.
#[tauri::command]
pub fn get_supplier_purchase_totals(db: State<'_, Mutex<Connection>>, company_id: String) -> Result<Vec<SupplierPurchaseTotal>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT supplier_id, SUM(amount) FROM expenses WHERE supplier_id IS NOT NULL AND company_id = ?1 GROUP BY supplier_id"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![company_id], |row| {
        Ok(SupplierPurchaseTotal {
            supplier_id: row.get(0)?,
            total_achats: row.get(1)?,
        })
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>();
    rows.map_err(|e| e.to_string())
}

// ============= PRODUCTS =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Product {
    pub id: String,
    pub company_id: Option<String>,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub unit: Option<String>,
    pub unit_price: f64,
    pub tva_rate: Option<f64>,
    pub timbre_exempt: Option<bool>,
    pub is_active: Option<bool>,
    pub display_order: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

const PRODUCT_SELECT: &str = "SELECT id, company_id, code, name, description, unit, unit_price, tva_rate, is_active, display_order, created_at, updated_at, timbre_exempt FROM products";

fn map_product_row(row: &rusqlite::Row) -> rusqlite::Result<Product> {
    Ok(Product {
        id: row.get(0)?,
        company_id: row.get(1)?,
        code: row.get(2)?,
        name: row.get(3)?,
        description: row.get(4)?,
        unit: row.get(5)?,
        unit_price: row.get(6)?,
        tva_rate: row.get(7)?,
        is_active: row.get::<_, Option<i64>>(8)?.map(|v| v != 0),
        display_order: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        timbre_exempt: row.get::<_, Option<i64>>(12).unwrap_or(Some(0)).map(|v| v != 0),
    })
}

#[tauri::command]
pub fn get_products(db: State<'_, Mutex<Connection>>, company_id: String) -> Result<Vec<Product>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(&format!("{} WHERE is_active = 1 AND company_id = ?1 ORDER BY display_order", PRODUCT_SELECT)).map_err(|e| e.to_string())?;
    let products = stmt.query_map(params![company_id], map_product_row).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for product in products {
        result.push(product.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[derive(Deserialize)]
pub struct CreateProductData {
    // Shared with update_product, whose UPDATE statement never touches this
    // column — the frontend's update payload omits it (Omit<..., "company_id">),
    // so it must tolerate being absent from that JSON instead of failing
    // deserialization with "missing field `company_id`".
    #[serde(default)]
    pub company_id: String,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub unit: Option<String>,
    pub unit_price: f64,
    pub tva_rate: Option<f64>,
    pub timbre_exempt: Option<bool>,
    pub display_order: Option<i64>,
}

#[tauri::command]
pub fn create_product(db: State<'_, Mutex<Connection>>, data: CreateProductData) -> Result<Product, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    conn.execute(
        "INSERT INTO products (id, company_id, code, name, description, unit, unit_price, tva_rate, timbre_exempt, is_active, display_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            id,
            data.company_id,
            data.code,
            data.name,
            data.description,
            data.unit.unwrap_or_else(|| "Forfait / Projet".to_string()),
            data.unit_price,
            data.tva_rate,
            data.timbre_exempt.map(|b| if b { 1 } else { 0 }),
            1i64,
            data.display_order.unwrap_or(0),
            now,
            now,
        ],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "PRODUCT", Some(&id), &format!("Nouveau produit créé: {}", data.name));

    // Retrieve the created product
    let mut stmt = conn.prepare(&format!("{} WHERE id = ?1", PRODUCT_SELECT)).map_err(|e| e.to_string())?;
    stmt.query_row(params![id], map_product_row).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_product_price(db: State<'_, Mutex<Connection>>, id: String, unit_price: f64) -> Result<Product, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE products SET unit_price = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, unit_price, now],
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(&format!("{} WHERE id = ?1", PRODUCT_SELECT)).map_err(|e| e.to_string())?;
    stmt.query_row(params![id], map_product_row).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_product(db: State<'_, Mutex<Connection>>, id: String, data: CreateProductData) -> Result<Product, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE products SET code = ?2, name = ?3, description = ?4, unit = ?5, unit_price = ?6, tva_rate = ?7, timbre_exempt = ?8, updated_at = ?9 WHERE id = ?1",
        params![
            id,
            data.code,
            data.name,
            data.description,
            data.unit.unwrap_or_else(|| "Forfait / Projet".to_string()),
            data.unit_price,
            data.tva_rate,
            data.timbre_exempt.map(|b| if b { 1 } else { 0 }),
            now,
        ],
    ).map_err(|e| friendly_unique_constraint_error(e, "Cette référence produit"))?;

    let _ = log_activity(&conn, "UPDATE", "PRODUCT", Some(&id), &format!("Produit mis à jour: {}", data.name));

    let mut stmt = conn.prepare(&format!("{} WHERE id = ?1", PRODUCT_SELECT)).map_err(|e| e.to_string())?;
    stmt.query_row(params![id], map_product_row).map_err(|e| e.to_string())
}


#[tauri::command]
pub fn delete_product(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    
    // Get product name for logging
    let mut stmt = conn.prepare("SELECT name FROM products WHERE id = ?1").map_err(|e| e.to_string())?;
    let name: String = stmt.query_row(params![id], |row| row.get(0)).unwrap_or("Inconnu".to_string());

    // Check if product is used anywhere with a non-cascading FK to
    // products(id) — invoice_items and delivery_note_items were already
    // checked here, but order_items and client_draft_products reference
    // products(id) with no cascade too, and were missed: a product only
    // ever used on an order (never invoiced/delivered) would fall through
    // to the hard-delete branch below and hit a raw SQLite FOREIGN KEY
    // failure instead of being archived like every other in-use product.
    let mut stmt = conn.prepare("SELECT count(*) FROM invoice_items WHERE product_id = ?1").map_err(|e| e.to_string())?;
    let invoice_count: i64 = stmt.query_row(params![id], |row| row.get(0)).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT count(*) FROM delivery_note_items WHERE product_id = ?1").map_err(|e| e.to_string())?;
    let delivery_count: i64 = stmt.query_row(params![id], |row| row.get(0)).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT count(*) FROM order_items WHERE product_id = ?1").map_err(|e| e.to_string())?;
    let order_count: i64 = stmt.query_row(params![id], |row| row.get(0)).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT count(*) FROM client_draft_products WHERE product_id = ?1").map_err(|e| e.to_string())?;
    let draft_count: i64 = stmt.query_row(params![id], |row| row.get(0)).map_err(|e| e.to_string())?;

    if invoice_count > 0 || delivery_count > 0 || order_count > 0 || draft_count > 0 {
        // Soft delete (archive)
        conn.execute(
            "UPDATE products SET is_active = 0 WHERE id = ?1",
            params![id],
        ).map_err(|e| e.to_string())?;
        
        let _ = log_activity(&conn, "DELETE", "PRODUCT", Some(&id), &format!("Produit archivé (utilisé dans documents): {}", name));
    } else {
        // Hard delete
        conn.execute(
            "DELETE FROM products WHERE id = ?1",
            params![id],
        ).map_err(|e| e.to_string())?;
        
        let _ = log_activity(&conn, "DELETE", "PRODUCT", Some(&id), &format!("Produit supprimé définitivement: {}", name));
    }
    
    Ok(())
}

// ============= INVOICES =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Invoice {
    pub id: String,
    pub company_id: Option<String>,
    pub invoice_number: String,
    pub client_id: String,
    pub invoice_date: String,
    pub due_date: Option<String>,
    pub month_period: Option<String>,
    pub subtotal_ht: Option<f64>,
    pub tva_rate: Option<f64>,
    pub tva_amount: Option<f64>,
    pub timbre: Option<f64>,
    pub total_ttc: Option<f64>,
    pub amount_paid: Option<f64>,
    pub balance_due: Option<f64>,
    pub status: Option<String>,
    pub invoice_type: String,
    pub original_invoice_id: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub header_note: Option<String>,
    pub discount: Option<f64>,
    pub discount_type: Option<String>,
    pub discount_value: Option<f64>,
    pub use_secondary_register: Option<bool>,
    pub selected_secondary_rc: Option<String>,
    pub selected_secondary_address: Option<String>,
    pub custom_title: Option<String>,
    pub payment_method: Option<String>,
    /// omada-agency branch only — which project (if any) this invoice's
    /// revenue counts toward. See get_project_stats.
    pub project_id: Option<String>,
    /// "standard" | "exempt" | "ttc_direct" — which tax-entry mode the
    /// invoice was created under. Display/UI-state only: the actual TVA
    /// math is entirely driven by each invoice_item's own tva_rate (see
    /// recalculate_invoice_totals), not by this field.
    pub tax_mode: String,
    /// Set once a proforma has been converted — points at the invoice it
    /// became. The forward-looking counterpart to original_invoice_id.
    pub converted_to_invoice_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InvoiceItemWithProduct {
    pub id: String,
    pub invoice_id: String,
    pub product_id: Option<String>,
    pub quantity: f64,
    pub unit_price: f64,
    pub amount: Option<f64>,
    pub tva_rate: Option<f64>,
    pub timbre_exempt: Option<bool>,
    pub products: Option<ProductInfo>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProductInfo {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub unit: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateInvoiceData {
    // Shared with update_invoice, whose UPDATE statement never touches this
    // column — the frontend's update payload omits it (Omit<..., "company_id">),
    // so it must tolerate being absent from that JSON instead of failing
    // deserialization with "missing field `company_id`".
    #[serde(default)]
    pub company_id: String,
    pub client_id: String,
    pub invoice_date: String,
    pub due_date: Option<String>,
    pub month_period: Option<String>,
    pub notes: Option<String>,
    pub header_note: Option<String>,
    pub invoice_type: Option<String>,
    pub original_invoice_id: Option<String>,
    pub discount: Option<f64>,
    pub discount_type: Option<String>,
    pub discount_value: Option<f64>,
    pub use_secondary_register: Option<bool>,
    pub selected_secondary_rc: Option<String>,
    pub selected_secondary_address: Option<String>,
    pub custom_title: Option<String>,
    pub invoice_number: Option<String>,
    pub payment_method: Option<String>,
    pub status: Option<String>,
    pub amount_paid: Option<f64>,
    /// "standard" | "exempt" | "ttc_direct" — defaults to "standard" when
    /// absent (older callers, or documents that don't expose the toggle).
    pub tax_mode: Option<String>,
    /// omada-agency branch only — set from the invoice form's own "Projet
    /// associé" dropdown at create/edit time, same column previously only
    /// reachable via the separate assign_invoice_to_project command.
    pub project_id: Option<String>,
    pub items: Vec<InvoiceItemInput>,
}

#[derive(Deserialize)]
pub struct InvoiceItemInput {
    pub product_id: Option<String>,
    /// Only used when product_id is None — a custom/one-off line item that
    /// doesn't correspond to any row in the products catalog.
    pub product_name: Option<String>,
    pub product_code: Option<String>,
    pub product_description: Option<String>,
    pub quantity: f64,
    pub unit_price: f64,
    pub tva_rate: Option<f64>,
    pub timbre_exempt: Option<bool>,
}

#[tauri::command]
pub fn get_invoices(db: State<'_, Mutex<Connection>>, company_id: String, status: Option<String>, invoice_type: Option<String>) -> Result<Vec<Invoice>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut query = "SELECT * FROM invoices".to_string();
    let mut conditions = vec![format!("company_id = '{}'", company_id.replace("'", "''"))];

    if let Some(s) = status {
        conditions.push(format!("status = '{}'", s.replace("'", "''")));
    }
    if let Some(it) = invoice_type {
        conditions.push(format!("invoice_type = '{}'", it.replace("'", "''")));
    }

    query.push_str(&format!(" WHERE {}", conditions.join(" AND ")));
    query.push_str(" ORDER BY invoice_date DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let invoices = stmt.query_map([], |row| {
        Ok(Invoice {
            id: row.get("id")?,
            company_id: row.get("company_id").ok(),
            invoice_number: row.get("invoice_number")?,
            client_id: row.get("client_id")?,
            invoice_date: row.get("invoice_date")?,
            due_date: row.get("due_date")?,
            month_period: row.get("month_period")?,
            subtotal_ht: row.get("subtotal_ht")?,
            tva_rate: row.get("tva_rate")?,
            tva_amount: row.get("tva_amount")?,
            timbre: row.get("timbre")?,
            total_ttc: row.get("total_ttc")?,
            amount_paid: row.get("amount_paid")?,
            balance_due: row.get("balance_due")?,
            status: row.get("status")?,
            invoice_type: row.get("invoice_type")?,
            original_invoice_id: row.get("original_invoice_id")?,
            notes: row.get("notes")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            header_note: row.get("header_note").ok(),
            discount: row.get("discount").ok(),
            discount_type: row.get("discount_type").ok(),
            discount_value: row.get("discount_value").ok(),
            use_secondary_register: row.get::<_, Option<i64>>("use_secondary_register").ok().flatten().map(|v| v != 0),
            selected_secondary_rc: row.get("selected_secondary_rc").ok(),
            selected_secondary_address: row.get("selected_secondary_address").ok(),
            custom_title: row.get("custom_title").ok(),
            payment_method: row.get("payment_method").ok(),
            project_id: row.get("project_id").ok(),
            tax_mode: row.get("tax_mode").unwrap_or_else(|_| "standard".to_string()),
            converted_to_invoice_id: row.get("converted_to_invoice_id").ok(),
        })
    }).map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for invoice in invoices {
        result.push(invoice.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn get_invoice(db: State<'_, Mutex<Connection>>, id: String) -> Result<Option<Invoice>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM invoices WHERE id = ?1").map_err(|e| e.to_string())?;

    let invoice = stmt.query_row(params![id], |row| {
        Ok(Invoice {
            id: row.get("id")?,
            company_id: row.get("company_id").ok(),
            invoice_number: row.get("invoice_number")?,
            client_id: row.get("client_id")?,
            invoice_date: row.get("invoice_date")?,
            due_date: row.get("due_date")?,
            month_period: row.get("month_period")?,
            subtotal_ht: row.get("subtotal_ht")?,
            tva_rate: row.get("tva_rate")?,
            tva_amount: row.get("tva_amount")?,
            timbre: row.get("timbre")?,
            total_ttc: row.get("total_ttc")?,
            amount_paid: row.get("amount_paid")?,
            balance_due: row.get("balance_due")?,
            status: row.get("status")?,
            invoice_type: row.get("invoice_type")?,
            original_invoice_id: row.get("original_invoice_id").ok(),
            notes: row.get("notes")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            header_note: row.get("header_note").ok(),
            discount: row.get("discount").ok(),
            discount_type: row.get("discount_type").ok(),
            discount_value: row.get("discount_value").ok(),
            use_secondary_register: row.get::<_, Option<i64>>("use_secondary_register").ok().flatten().map(|v| v != 0),
            selected_secondary_rc: row.get("selected_secondary_rc").ok(),
            selected_secondary_address: row.get("selected_secondary_address").ok(),
            custom_title: row.get("custom_title").ok(),
            payment_method: row.get("payment_method").ok(),
            project_id: row.get("project_id").ok(),
            tax_mode: row.get("tax_mode").unwrap_or_else(|_| "standard".to_string()),
            converted_to_invoice_id: row.get("converted_to_invoice_id").ok(),
        })
    });
    
    match invoice {
        Ok(i) => Ok(Some(i)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

// Combined struct for optimize fetching
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InvoiceWithClient {
    #[serde(flatten)]
    pub invoice: Invoice,
    pub clients: Option<ClientInfo>,
    pub projects: Option<ProjectInfo>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ClientInfo {
    pub name: String,
    pub email: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProjectInfo {
    pub name: String,
    pub service_categories: Option<String>,
}

#[tauri::command]
pub fn get_invoices_with_clients(db: State<'_, Mutex<Connection>>, company_id: String, status: Option<String>, invoice_type: Option<String>) -> Result<Vec<InvoiceWithClient>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    // Join query to fetch invoice and client name in one go
    let mut query = "
        SELECT
            i.id, i.company_id, i.invoice_number, i.client_id, i.invoice_date, i.due_date, i.month_period,
            i.subtotal_ht, i.tva_rate, i.tva_amount, i.timbre, i.total_ttc, i.amount_paid,
            i.balance_due, i.status, i.invoice_type, i.original_invoice_id, i.notes,
            i.created_at, i.updated_at, i.header_note, i.discount, i.discount_type, i.discount_value, i.use_secondary_register, i.custom_title, i.payment_method, i.selected_secondary_rc, i.selected_secondary_address, i.project_id, i.tax_mode,
            c.name, c.email, p.name, p.service_categories, i.converted_to_invoice_id
        FROM invoices i
        LEFT JOIN clients c ON i.client_id = c.id
        LEFT JOIN projects p ON i.project_id = p.id
    ".to_string();

    let mut conditions = vec![format!("i.company_id = '{}'", company_id.replace("'", "''"))];

    if let Some(s) = status {
        conditions.push(format!("i.status = '{}'", s.replace("'", "''")));
    }
    if let Some(it) = invoice_type {
        conditions.push(format!("i.invoice_type = '{}'", it.replace("'", "''")));
    }

    query.push_str(&format!(" WHERE {}", conditions.join(" AND ")));
    query.push_str(" ORDER BY i.invoice_date DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    // let column_count = stmt.column_count();

    let invoices = stmt.query_map([], |row| {
        let invoice = Invoice {
            id: row.get(0)?,
            company_id: row.get(1).ok(),
            invoice_number: row.get(2)?,
            client_id: row.get(3)?,
            invoice_date: row.get(4)?,
            due_date: row.get(5)?,
            month_period: row.get(6)?,
            subtotal_ht: row.get(7)?,
            tva_rate: row.get(8)?,
            tva_amount: row.get(9)?,
            timbre: row.get(10)?,
            total_ttc: row.get(11)?,
            amount_paid: row.get(12)?,
            balance_due: row.get(13)?,
            status: row.get(14)?,
            invoice_type: row.get(15)?,
            original_invoice_id: row.get(16)?,
            notes: row.get(17)?,
            created_at: row.get(18)?,
            updated_at: row.get(19)?,
            header_note: row.get(20).ok(),
            discount: row.get(21).ok(),
            discount_type: row.get(22).ok(),
            discount_value: row.get(23).ok(),
            use_secondary_register: row.get::<_, Option<i64>>(24).ok().flatten().map(|v| v != 0),
            custom_title: row.get(25).ok(),
            payment_method: row.get(26).ok(),
            selected_secondary_rc: row.get(27).ok(),
            selected_secondary_address: row.get(28).ok(),
            project_id: row.get(29).ok(),
            tax_mode: row.get(30).unwrap_or_else(|_| "standard".to_string()),
            converted_to_invoice_id: row.get(35).ok(),
        };

        let client_name: Option<String> = row.get(31).ok();
        let client_email: Option<String> = row.get(32).ok();

        let client_info = if let Some(name) = client_name {
            Some(ClientInfo { name, email: client_email })
        } else {
            None
        };

        let project_name: Option<String> = row.get(33).ok();
        let project_service_categories: Option<String> = row.get(34).ok();

        let project_info = project_name.map(|name| ProjectInfo {
            name,
            service_categories: project_service_categories,
        });

        Ok(InvoiceWithClient {
            invoice,
            clients: client_info,
            projects: project_info,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for invoice in invoices {
        result.push(invoice.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn get_invoice_items(
    db: State<'_, Mutex<Connection>>, 
    #[allow(non_snake_case)] invoiceId: String
) -> Result<Vec<InvoiceItemWithProduct>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    // Re-apply critical fix: LEFT JOIN + COALESCE
    let mut stmt = conn.prepare(
        "SELECT ii.id, ii.invoice_id, ii.product_id, ii.quantity, ii.unit_price, ii.amount, ii.tva_rate, ii.timbre_exempt, COALESCE(p.code, ii.product_code, ''), COALESCE(p.name, ii.product_name, ''), COALESCE(ii.product_description, p.description), p.unit
         FROM invoice_items ii
         LEFT JOIN products p ON ii.product_id = p.id
         WHERE ii.invoice_id = ?1
         ORDER BY ii.created_at"
    ).map_err(|e| e.to_string())?;

    let items = stmt.query_map(params![invoiceId], |row| {
        Ok(InvoiceItemWithProduct {
            id: row.get(0)?,
            invoice_id: row.get(1)?,
            product_id: row.get(2)?,
            quantity: row.get(3)?,
            unit_price: row.get(4)?,
            amount: row.get(5)?,
            tva_rate: row.get(6)?,
            timbre_exempt: row.get::<_, Option<i64>>(7)?.map(|v| v != 0),
            products: Some(ProductInfo {
                code: row.get(8)?,
                name: row.get(9)?,
                description: row.get(10).ok(),
                unit: row.get(11).ok(),
            }),
        })
    }).map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for item in items {
        result.push(item.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn create_invoice(db: State<'_, Mutex<Connection>>, data: CreateInvoiceData) -> Result<Invoice, String> {
    crate::license::require_active_license()?;

    let mut conn = db.lock().map_err(|e| e.to_string())?;
    let invoice_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let invoice_type = data.invoice_type.unwrap_or_else(|| "invoice".to_string());
    
    // Strict per-document-type, per-year numbering — FAC-YYYY-NNN for
    // invoices, PRO-YYYY-NNN for proformas, DEV-YYYY-NNN for quotes
    // (devis), AVO-YYYY-NNN for credit notes (avoirs). See
    // generate_document_number's own doc comment in database.rs; a
    // manually-provided number is taken as-is and just synced into that
    // type's counter so the next auto-generated one doesn't collide.
    let invoice_number = if let Some(num) = &data.invoice_number {
        sync_document_number_sequence(&conn, &invoice_type, num).map_err(|e| e.to_string())?;
        num.clone()
    } else {
        generate_document_number(&conn, &invoice_type).map_err(|e| e.to_string())?
    };

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    let insert_status = data.status.clone().unwrap_or_else(|| "issued".to_string());
    let insert_amount_paid = data.amount_paid.unwrap_or(0.0);

    let tax_mode = data.tax_mode.clone().unwrap_or_else(|| "standard".to_string());

    tx.execute(
        "INSERT INTO invoices (id, company_id, invoice_number, client_id, invoice_date, due_date, month_period, notes, status, invoice_type, original_invoice_id, created_at, updated_at, header_note, discount, discount_type, discount_value, use_secondary_register, selected_secondary_rc, selected_secondary_address, custom_title, payment_method, amount_paid, tax_mode, project_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25)",
        params![
            invoice_id,
            data.company_id,
            invoice_number,
            data.client_id,
            data.invoice_date,
            data.due_date,
            data.month_period,
            data.notes,
            insert_status,
            invoice_type,
            data.original_invoice_id,
            now,
            now,
            data.header_note,
            data.discount.unwrap_or(0.0),
            data.discount_type.unwrap_or_else(|| "percent".to_string()),
            data.discount_value.unwrap_or(0.0),
            if data.use_secondary_register.unwrap_or(false) { 1i64 } else { 0i64 },
            data.selected_secondary_rc,
            data.selected_secondary_address,
            data.custom_title,
            data.payment_method,
            insert_amount_paid,
            tax_mode,
            data.project_id,
        ],
    ).map_err(|e| e.to_string())?;
    
    for item in data.items {
        let item_id = uuid::Uuid::new_v4().to_string();
        let amount = item.quantity * item.unit_price;
        tx.execute(
            "INSERT INTO invoice_items (id, invoice_id, product_id, product_name, product_code, product_description, quantity, unit_price, amount, tva_rate, timbre_exempt, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![item_id, invoice_id, item.product_id, item.product_name, item.product_code, item.product_description, item.quantity, item.unit_price, amount, item.tva_rate, item.timbre_exempt.unwrap_or(false), now],
        ).map_err(|e| e.to_string())?;
    }

    recalculate_invoice_totals(&tx, &invoice_id).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "CREATE", "INVOICE", Some(&invoice_id), &format!("Nouvelle facture créée: {}", invoice_number));
    
    drop(conn);
    
    get_invoice(db, invoice_id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve created invoice".to_string())
}

#[tauri::command]
pub fn update_invoice(db: State<'_, Mutex<Connection>>, id: String, data: CreateInvoiceData) -> Result<Invoice, String> {
    crate::license::require_active_license()?;

    let mut conn = db.lock().map_err(|e| e.to_string())?;

    // Immutability guard — once real money has been recorded against an
    // invoice, or it has been converted from a proforma, or cancelled, its
    // header and line items can never be edited again: a financial
    // document that already had money or a real legal outcome attached to
    // it must be corrected via a credit note (avoir), never by silently
    // rewriting its own history. Deliberately scoped to "a money/legal
    // event already happened" rather than "status != draft" — every
    // invoice in this app is created with status 'issued' by default (see
    // create_invoice below), never 'draft', so a literal drafts-only rule
    // would make every invoice read-only the instant it's created and
    // break the normal "just made it, fix a typo" edit flow. 'issued' and
    // 'overdue' (created, not yet paid) stay fully editable.
    //
    // This check reads the CURRENT stored status, never the incoming
    // payload's `data.status` — the whole point is to not trust a client
    // that might be racing an out-of-date form against a since-paid
    // invoice.
    //
    // update_invoice_status and the payment-reconciliation path
    // (update_invoice_payment_status, called after create/update/delete
    // payment) are separate commands entirely and are NOT behind this
    // guard — status transitions and balance recalculation must keep
    // working on a locked invoice; only manual edits to its header/items
    // are blocked.
    let existing: Option<(String, String)> = conn
        .query_row("SELECT status, invoice_type FROM invoices WHERE id = ?1", params![id], |row| Ok((row.get(0)?, row.get(1)?)))
        .optional()
        .map_err(|e| e.to_string())?;
    let existing_invoice_type = existing.as_ref().map(|(_, t)| t.clone()).unwrap_or_else(|| "invoice".to_string());
    if let Some((status, _)) = existing.as_ref() {
        if matches!(status.as_str(), "paid" | "partial" | "converted" | "cancelled") {
            // "INVOICE_LOCKED:" prefix — a stable, machine-checkable error
            // code the frontend can match on (see InvoiceDetail.tsx's
            // isLocked guard) without parsing the localized French text,
            // which is free to be reworded later without breaking that check.
            return Err("INVOICE_LOCKED: Cette facture a déjà été payée, convertie ou annulée et ne peut plus être modifiée. Utilisez un Avoir pour corriger cette facture.".to_string());
        }
    }

    let now = chrono::Utc::now().to_rfc3339();

    // Sync this document's own type/year counter if its number was
    // manually edited — invoice_type never changes via this command, so
    // the CURRENT stored type (not anything in `data`) is always correct.
    if let Some(ref num) = data.invoice_number {
        sync_document_number_sequence(&conn, &existing_invoice_type, num).map_err(|e| e.to_string())?;
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    // 1. Update invoice details
    tx.execute(
        // invoice_number: COALESCE(NULLIF(?16, ''), invoice_number) rather
        // than a direct assignment — invoice_number is UNIQUE NOT NULL, and
        // the frontend can legitimately submit this update without a real
        // number in the payload (a race between the "load existing
        // invoice" effect populating draftInvoice.invoice_number and the
        // user submitting before it lands leaves the field empty/absent).
        // A direct assignment then writes NULL/'' and the whole update
        // fails with a raw "NOT NULL constraint failed" — keeping the
        // existing number whenever the incoming one is empty/null is both
        // safe (an invoice's own number essentially never needs to be
        // blanked out) and exactly matches how status/amount_paid/tax_mode
        // already treat "not really provided" on this same statement.
        "UPDATE invoices SET client_id = ?2, invoice_date = ?3, due_date = ?4, month_period = ?5, notes = ?6, updated_at = ?7, header_note = ?8, discount = ?9, discount_type = ?10, discount_value = ?11, use_secondary_register = ?12, selected_secondary_rc = ?13, selected_secondary_address = ?14, custom_title = ?15, invoice_number = COALESCE(NULLIF(?16, ''), invoice_number), payment_method = ?17, status = COALESCE(?18, status), amount_paid = COALESCE(?19, amount_paid), tax_mode = COALESCE(?20, tax_mode), project_id = ?21 WHERE id = ?1",
        params![
            id,
            data.client_id,
            data.invoice_date,
            data.due_date,
            data.month_period,
            data.notes,
            now,
            data.header_note,
            data.discount.unwrap_or(0.0),
            data.discount_type.unwrap_or_else(|| "percent".to_string()),
            data.discount_value.unwrap_or(0.0),
            if data.use_secondary_register.unwrap_or(false) { 1i64 } else { 0i64 },
            data.selected_secondary_rc,
            data.selected_secondary_address,
            data.custom_title,
            data.invoice_number, // Allow updating number if provided
            data.payment_method,
            data.status,
            data.amount_paid,
            data.tax_mode,
            // Direct assignment, not COALESCE — the invoice form's Projet
            // associé dropdown must be able to explicitly unlink a project
            // (send null), which COALESCE would silently ignore.
            data.project_id,
        ],
    ).map_err(|e| friendly_unique_constraint_error(e, "Ce numéro de facture"))?;

    // 2. Delete existing items
    tx.execute("DELETE FROM invoice_items WHERE invoice_id = ?1", params![id]).map_err(|e| e.to_string())?;
    
    // 3. Insert new items
    for item in data.items {
        let item_id = uuid::Uuid::new_v4().to_string();
        let amount = item.quantity * item.unit_price;
            tx.execute(
                "INSERT INTO invoice_items (id, invoice_id, product_id, product_name, product_code, product_description, quantity, unit_price, amount, tva_rate, timbre_exempt, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    item_id,
                    id,
                    item.product_id,
                    item.product_name,
                    item.product_code,
                    item.product_description,
                    item.quantity,
                    item.unit_price,
                    amount,
                    item.tva_rate,
                    item.timbre_exempt.unwrap_or(false),
                    now
                ],
            ).map_err(|e| e.to_string())?;
    }
    
    // 4. Recalculate totals
    recalculate_invoice_totals(&tx, &id).map_err(|e| e.to_string())?;

    // recalculate_invoice_totals only refreshes balance_due against the
    // invoice's existing amount_paid — it doesn't touch `status`. Editing a
    // previously "paid" invoice's items/totals (now allowed unconditionally
    // from the UI) can leave a real balance again, so status has to be
    // re-derived here too, the same way create/update/delete payment
    // already keep it in sync via this same function.
    update_invoice_payment_status(&tx, &id).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "UPDATE", "INVOICE", Some(&id), "Facture mise à jour");
    
    drop(conn);
    
    get_invoice(db, id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve updated invoice".to_string())
}
#[tauri::command]
pub fn get_next_invoice_number(db: State<'_, Mutex<Connection>>, invoice_type: Option<String>) -> Result<String, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    peek_next_document_number(&conn, &invoice_type.unwrap_or_else(|| "invoice".to_string())).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_invoice_status(db: State<'_, Mutex<Connection>>, id: String, status: String) -> Result<Invoice, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;

    // Audit-trail guard — a regular invoice or credit note is assigned its
    // official sequential number (invoice_number / "AV-xxx") the moment
    // it's created, not at some later "finalize" step, so there's no status
    // this app has that legitimately corresponds to "a numbered document
    // that hasn't really been issued yet". Reverting one back to "draft"
    // would leave a document carrying a real, gap-free legal sequence
    // number sitting in a state that implies it was never issued — exactly
    // the kind of inconsistency a paper/PDF audit trail can't tolerate.
    // Proformas ("PRO-<timestamp>") aren't part of that official sequence,
    // so they're exempt.
    if status == "draft" {
        let invoice_type: Option<String> = conn
            .query_row("SELECT invoice_type FROM invoices WHERE id = ?1", params![id], |row| row.get(0))
            .optional()
            .map_err(|e| e.to_string())?;
        if matches!(invoice_type.as_deref(), Some("invoice") | Some("credit_note")) {
            return Err("INVOICE_LOCKED: Cette facture porte un numéro séquentiel officiel et ne peut pas être remise en brouillon. Utilisez un Avoir pour corriger cette facture.".to_string());
        }
    }

    if status == "paid" {
        // Marking an invoice "paid" this way (a manual status flip, or the
        // AI Copilot's own path) only ever touched invoices.amount_paid —
        // it never wrote a payments row. The dashboard's cash-flow chart
        // (monthly_data/daily_data below) is built exclusively from
        // SUM(payments.amount), never from invoices.amount_paid directly,
        // so a status-only "paid" was invisible on the chart even though
        // the top-line KPIs (which do read amount_paid) updated fine —
        // that mismatch, not a missing cache invalidation, was the actual
        // "chart doesn't update" bug. Inserting a real payments row for
        // the remaining balance keeps both readings consistent.
        let (total_ttc, amount_paid, company_id): (f64, f64, String) = conn
            .query_row(
                "SELECT total_ttc, COALESCE(amount_paid, 0.0), company_id FROM invoices WHERE id = ?1",
                params![id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|e| e.to_string())?;
        let remaining = total_ttc - amount_paid;

        conn.execute(
            "UPDATE invoices SET status = ?2, amount_paid = total_ttc, balance_due = 0 WHERE id = ?1",
            params![id, status]
        ).map_err(|e| e.to_string())?;

        if remaining > 0.0 {
            let payment_id = uuid::Uuid::new_v4().to_string();
            let now = chrono::Utc::now();
            conn.execute(
                "INSERT INTO payments (id, company_id, invoice_id, payment_date, amount, payment_method, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![payment_id, company_id, id, now.format("%Y-%m-%d").to_string(), remaining, "cash", now.to_rfc3339()],
            ).map_err(|e| e.to_string())?;
        }
    } else {
        conn.execute(
            "UPDATE invoices SET status = ?2 WHERE id = ?1", 
            params![id, status]
        ).map_err(|e| e.to_string())?;
    }
    
    drop(conn);
    get_invoice(db, id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve updated invoice".to_string())
}

#[tauri::command]
pub fn delete_invoice(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let mut conn = db.lock().map_err(|e| e.to_string())?;

    // delivery_notes.invoice_id has no ON DELETE cascade — a delivery note
    // is a real, independent operational document (not owned by the
    // invoice the way invoice_items are), so silently deleting it alongside
    // the invoice would be its own surprising data loss. Blocked with a
    // clear message instead, same policy as delete_client.
    let delivery_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM delivery_notes WHERE invoice_id = ?1",
            params![id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if delivery_count > 0 {
        let label = if delivery_count == 1 { "bon de livraison lié" } else { "bons de livraison liés" };
        return Err(format!(
            "Impossible de supprimer cette facture : {} {}. Supprimez-le(s) d'abord.",
            delivery_count, label
        ));
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    // payments.invoice_id has no ON DELETE cascade either, but unlike a
    // delivery note a payment record only exists to track money against
    // this specific invoice — it has no meaning on its own, so deleting it
    // alongside the invoice (inside the same transaction, so a failure
    // here rolls back the whole delete) is the same "owned by" cascade
    // invoice_items already gets for free from the schema.
    tx.execute("DELETE FROM payments WHERE invoice_id = ?1", params![id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM invoices WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    // Only regular invoices ("invoice_type = 'invoice'") share the plain
    // numeric sequence — credit notes ("AV-024") and proformas
    // ("PRO-<unix timestamp>") use their own formats and would otherwise
    // poison the MAX() with a huge timestamp value.
    let _ = crate::database::resync_sequence_from_table(
        &tx, "invoice_number", "invoices", "invoice_number", Some("invoice_type = 'invoice'"),
    );
    tx.commit().map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "DELETE", "INVOICE", Some(&id), "Facture supprimée");
    Ok(())
}

#[tauri::command]
pub fn convert_to_real_invoice(db: State<'_, Mutex<Connection>>, id: String) -> Result<Invoice, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    
    // 1. Get next real invoice number
    let new_number = generate_invoice_number(&conn).map_err(|e| e.to_string())?;
    
    // 2. Update the invoice
    // We update invoice_type to 'invoice', status to 'issued' (or keep as is? usually 'issued'), and set new number
    let now = chrono::Utc::now().to_rfc3339();
    
    conn.execute(
        "UPDATE invoices 
         SET invoice_type = 'invoice', 
             invoice_number = ?2, 
             status = 'issued',
             updated_at = ?3 
         WHERE id = ?1 AND invoice_type = 'proforma'",
        params![id, new_number, now],
    ).map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "CONVERT", "INVOICE", Some(&id), &format!("Proforma converti en facture: {}", new_number));

    drop(conn);
    get_invoice(db, id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve converted invoice".to_string())
}

/// Clones a proforma into a brand-new invoice (its own id, a real sequential
/// invoice number, today's date) and marks the source proforma "converted"
/// with a link to the invoice it became — unlike convert_to_real_invoice
/// above, which mutates the proforma's own row in place, this preserves the
/// proforma as a permanent, still-visible record of what was quoted.
#[tauri::command]
pub fn convert_proforma_to_invoice(db: State<'_, Mutex<Connection>>, id: String) -> Result<Invoice, String> {
    crate::license::require_active_license()?;

    // 1. Load the source proforma + its items with their own self-contained
    //    locks, released before calling create_invoice below — that command
    //    takes its own lock on the same mutex, and holding one across the
    //    call would deadlock.
    let proforma = get_invoice(db.clone(), id.clone())?
        .ok_or_else(|| "Proforma introuvable".to_string())?;

    if proforma.invoice_type != "proforma" {
        return Err("Ce document n'est pas une facture proforma".to_string());
    }
    if proforma.status.as_deref() == Some("converted") {
        return Err("Cette proforma a déjà été convertie".to_string());
    }

    let source_items = get_invoice_items(db.clone(), id.clone())?;

    // 2. Clone into a new invoice — its own number and today's date,
    //    independent from the proforma it came from.
    let new_data = CreateInvoiceData {
        company_id: proforma.company_id.clone().unwrap_or_default(),
        client_id: proforma.client_id.clone(),
        invoice_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        due_date: proforma.due_date.clone(),
        month_period: None,
        notes: proforma.notes.clone(),
        header_note: proforma.header_note.clone(),
        invoice_type: Some("invoice".to_string()),
        original_invoice_id: None,
        discount: proforma.discount,
        discount_type: proforma.discount_type.clone(),
        discount_value: proforma.discount_value,
        use_secondary_register: proforma.use_secondary_register,
        selected_secondary_rc: proforma.selected_secondary_rc.clone(),
        selected_secondary_address: proforma.selected_secondary_address.clone(),
        custom_title: None,
        invoice_number: None,
        payment_method: proforma.payment_method.clone(),
        status: Some("issued".to_string()),
        amount_paid: None,
        tax_mode: Some(proforma.tax_mode.clone()),
        project_id: proforma.project_id.clone(),
        items: source_items.into_iter().map(|item| InvoiceItemInput {
            product_id: item.product_id,
            product_name: item.products.as_ref().map(|p| p.name.clone()),
            product_code: item.products.as_ref().map(|p| p.code.clone()),
            product_description: item.products.as_ref().and_then(|p| p.description.clone()),
            quantity: item.quantity,
            unit_price: item.unit_price,
            tva_rate: item.tva_rate,
            timbre_exempt: item.timbre_exempt,
        }).collect(),
    };

    let new_invoice = create_invoice(db.clone(), new_data)?;

    // 3. Mark the source proforma converted and link it to the new invoice.
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE invoices SET status = 'converted', converted_to_invoice_id = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, new_invoice.id, now],
        ).map_err(|e| e.to_string())?;
        let _ = log_activity(&conn, "CONVERT", "INVOICE", Some(&id), &format!("Proforma convertie en facture: {}", new_invoice.invoice_number));
    }

    Ok(new_invoice)
}

// ============= PAYMENTS =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Payment {
    pub id: String,
    pub company_id: Option<String>,
    pub invoice_id: String,
    pub payment_date: String,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub cheque_number: Option<String>,
    pub bank_name: Option<String>,
    pub value_date: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    /// "Encaissé par" — nullable, added via migration, most existing rows
    /// predate this field. References employees.id.
    pub employee_id: Option<String>,
}

#[derive(Deserialize)]
pub struct CreatePaymentData {
    pub company_id: String,
    pub invoice_id: String,
    pub payment_date: String,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub cheque_number: Option<String>,
    pub bank_name: Option<String>,
    pub value_date: Option<String>,
    pub notes: Option<String>,
    pub employee_id: Option<String>,
}

const PAYMENT_COLUMNS: &str = "id, company_id, invoice_id, payment_date, amount, payment_method, cheque_number, bank_name, value_date, notes, created_at, employee_id";

fn map_payment_row(row: &rusqlite::Row) -> rusqlite::Result<Payment> {
    Ok(Payment {
        id: row.get(0)?,
        company_id: row.get(1)?,
        invoice_id: row.get(2)?,
        payment_date: row.get(3)?,
        amount: row.get(4)?,
        payment_method: row.get(5)?,
        cheque_number: row.get(6)?,
        bank_name: row.get(7)?,
        value_date: row.get(8)?,
        notes: row.get(9)?,
        created_at: row.get(10)?,
        employee_id: row.get(11)?,
    })
}

#[tauri::command]
pub fn get_payments(db: State<'_, Mutex<Connection>>, company_id: String, invoice_id: Option<String>) -> Result<Vec<Payment>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = if invoice_id.is_some() {
        conn.prepare(&format!("SELECT {} FROM payments WHERE company_id = ?1 AND invoice_id = ?2 ORDER BY payment_date DESC", PAYMENT_COLUMNS)).map_err(|e| e.to_string())?
    } else {
        conn.prepare(&format!("SELECT {} FROM payments WHERE company_id = ?1 ORDER BY payment_date DESC", PAYMENT_COLUMNS)).map_err(|e| e.to_string())?
    };

    let payments = if let Some(ref id) = invoice_id {
        stmt.query_map(params![company_id, id], map_payment_row)
    } else {
        stmt.query_map(params![company_id], map_payment_row)
    }.map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for payment in payments {
        result.push(payment.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn create_payment(db: State<'_, Mutex<Connection>>, data: CreatePaymentData) -> Result<Payment, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    conn.execute(
        "INSERT INTO payments (id, company_id, invoice_id, payment_date, amount, payment_method, cheque_number, bank_name, value_date, notes, created_at, employee_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![id, data.company_id, data.invoice_id, data.payment_date, data.amount, data.payment_method, data.cheque_number, data.bank_name, data.value_date, data.notes, now, data.employee_id],
    ).map_err(|e| e.to_string())?;

    update_invoice_payment_status(&conn, &data.invoice_id).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "PAYMENT", Some(&id), &format!("Paiement reçu: {} DA", data.amount));

    let mut stmt = conn.prepare(&format!("SELECT {} FROM payments WHERE id = ?1", PAYMENT_COLUMNS)).map_err(|e| e.to_string())?;
    stmt.query_row(params![id], map_payment_row).map_err(|e| e.to_string())
}

/// Amount/date/method (+ the cheque-specific fields) only — invoice_id and
/// company_id are deliberately not editable here, a payment doesn't get
/// re-linked to a different invoice via an edit form.
#[derive(Deserialize)]
pub struct UpdatePaymentData {
    pub id: String,
    pub payment_date: String,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub cheque_number: Option<String>,
    pub bank_name: Option<String>,
    pub value_date: Option<String>,
    pub employee_id: Option<String>,
}

#[tauri::command]
pub fn update_payment(db: State<'_, Mutex<Connection>>, data: UpdatePaymentData) -> Result<Payment, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;

    let invoice_id: String = conn
        .query_row("SELECT invoice_id FROM payments WHERE id = ?1", params![data.id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE payments SET payment_date = ?2, amount = ?3, payment_method = ?4, cheque_number = ?5, bank_name = ?6, value_date = ?7, employee_id = ?8 WHERE id = ?1",
        params![data.id, data.payment_date, data.amount, data.payment_method, data.cheque_number, data.bank_name, data.value_date, data.employee_id],
    ).map_err(|e| e.to_string())?;

    // Same amount can move to a different invoice's balance/status here as
    // create_payment/delete_payment already do — this is what actually
    // keeps amount_paid/balance_due/status in sync after an edit.
    update_invoice_payment_status(&conn, &invoice_id).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "UPDATE", "PAYMENT", Some(&data.id), &format!("Paiement modifié: {} DA", data.amount));

    let mut stmt = conn.prepare(&format!("SELECT {} FROM payments WHERE id = ?1", PAYMENT_COLUMNS)).map_err(|e| e.to_string())?;
    stmt.query_row(params![data.id], map_payment_row).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_payment(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;

    // Fetch invoice_id before deleting so its paid/balance status can be
    // recomputed afterward — same follow-up create_payment already does.
    let invoice_id: String = conn
        .query_row("SELECT invoice_id FROM payments WHERE id = ?1", params![id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    // Attachment rows cascade-delete with the payment (FK ON DELETE CASCADE),
    // but the actual files on disk don't clean themselves up — remove those
    // first, same order as delete_employee_document.
    let mut attach_stmt = conn.prepare("SELECT file_path FROM payment_attachments WHERE payment_id = ?1").map_err(|e| e.to_string())?;
    let attachment_paths: Vec<String> = attach_stmt.query_map(params![id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    for rel in attachment_paths {
        let _ = fs::remove_file(app_data_dir().join(&rel));
    }

    conn.execute("DELETE FROM payments WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;

    // The payment's own invoice can be gone (e.g. an orphaned payment left
    // over from before delete_invoice cascaded its payments) — recomputing
    // that invoice's paid/balance status is then a no-op, not a failure:
    // update_invoice_payment_status does a query_row against `invoices`
    // that returns QueryReturnedNoRows in that case, which used to
    // propagate and fail the whole delete_payment call even though the
    // payment row itself had already been removed successfully — the UI
    // showed a permanent "Erreur lors de la suppression" for a payment
    // that also never visually disappeared, because the query invalidation
    // never ran on the reported failure.
    if let Err(err) = update_invoice_payment_status(&conn, &invoice_id) {
        if !matches!(err, rusqlite::Error::QueryReturnedNoRows) {
            return Err(err.to_string());
        }
    }

    let _ = log_activity(&conn, "DELETE", "PAYMENT", Some(&id), "Paiement supprimé");

    Ok(())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PaymentAttachment {
    pub id: String,
    pub payment_id: String,
    pub file_name: String,
    /// Relative to app_data_dir, e.g. "payment_attachments/<payment_id>/<file>".
    pub file_path: String,
    pub created_at: String,
}

fn row_to_payment_attachment(row: &rusqlite::Row) -> rusqlite::Result<PaymentAttachment> {
    Ok(PaymentAttachment {
        id: row.get("id")?,
        payment_id: row.get("payment_id")?,
        file_name: row.get("file_name")?,
        file_path: row.get("file_path")?,
        created_at: row.get("created_at")?,
    })
}

/// Proof-of-payment scans (receipt, bank slip, cheque copy) — copied
/// verbatim, same pattern as add_employee_document, not recompressed like
/// the employee photo since a PDF/scan shouldn't be re-encoded.
#[tauri::command]
pub fn add_payment_attachment(
    db: State<'_, Mutex<Connection>>,
    payment_id: String,
    source_path: String,
    file_name: String,
) -> Result<PaymentAttachment, String> {
    crate::license::require_active_license()?;

    let attachment_id = Uuid::new_v4().to_string();
    let ext = Path::new(&source_path).extension().and_then(|e| e.to_str()).unwrap_or("");
    let dest_file_name = if ext.is_empty() { attachment_id.clone() } else { format!("{}.{}", attachment_id, ext) };

    let dest_dir = app_data_dir().join("payment_attachments").join(&payment_id);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let dest = dest_dir.join(&dest_file_name);
    fs::copy(&source_path, &dest).map_err(|e| format!("Impossible de copier le fichier: {}", e))?;

    let relative_path = format!("payment_attachments/{}/{}", payment_id, dest_file_name);
    let now = chrono::Utc::now().to_rfc3339();
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO payment_attachments (id, payment_id, file_name, file_path, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![attachment_id, payment_id, file_name, relative_path, now],
    ).map_err(|e| e.to_string())?;

    conn.query_row("SELECT * FROM payment_attachments WHERE id = ?1", params![attachment_id], row_to_payment_attachment).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_payment_attachments(db: State<'_, Mutex<Connection>>, payment_id: String) -> Result<Vec<PaymentAttachment>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM payment_attachments WHERE payment_id = ?1 ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![payment_id], row_to_payment_attachment).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn delete_payment_attachment(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let file_path: Option<String> = conn
        .query_row("SELECT file_path FROM payment_attachments WHERE id = ?1", params![id], |row| row.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    if let Some(rel) = file_path {
        let _ = fs::remove_file(app_data_dir().join(&rel));
    }

    conn.execute("DELETE FROM payment_attachments WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ============= ORDERS =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Order {
    pub id: String,
    pub company_id: Option<String>,
    pub order_number: String,
    pub client_id: Option<String>,
    pub supplier_name: Option<String>,
    pub order_date: String,
    pub delivery_date: Option<String>,
    pub payment_terms: Option<String>,
    pub payment_method: Option<String>,
    pub supplier_address: Option<String>,
    pub supplier_email: Option<String>,
    pub supplier_phone: Option<String>,
    pub supplier_rc: Option<String>,
    pub supplier_nif: Option<String>,
    pub supplier_nis: Option<String>,
    pub supplier_ai: Option<String>,
    pub status: Option<String>,
    pub subtotal_ht: Option<f64>,
    pub tva_rate: Option<f64>,
    pub tva_amount: Option<f64>,
    pub total_ttc: Option<f64>,
    pub notes: Option<String>,
    pub month_period: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub custom_title: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateOrderData {
    // Shared with update_order, whose UPDATE statement never touches this
    // column — the frontend's update payload omits it (Omit<..., "company_id">),
    // so it must tolerate being absent from that JSON instead of failing
    // deserialization with "missing field `company_id`".
    #[serde(default)]
    pub company_id: String,
    pub client_id: Option<String>,
    pub supplier_name: Option<String>,
    pub order_date: String,
    pub delivery_date: Option<String>,
    pub payment_terms: Option<String>,
    pub payment_method: Option<String>,
    pub supplier_address: Option<String>,
    pub supplier_email: Option<String>,
    pub supplier_phone: Option<String>,
    pub supplier_rc: Option<String>,
    pub supplier_nif: Option<String>,
    pub supplier_nis: Option<String>,
    pub supplier_ai: Option<String>,
    pub notes: Option<String>,
    pub custom_title: Option<String>,
    pub order_number: Option<String>,
    pub items: Vec<OrderItemInput>,
}

#[derive(Deserialize)]
pub struct OrderItemInput {
    pub product_id: Option<String>,
    pub product_name: Option<String>,
    pub product_code: Option<String>,
    pub product_description: Option<String>,
    pub quantity: f64,
    pub unit_price: f64,
    pub tva_rate: Option<f64>,
}

const ORDER_SELECT_COLUMNS: &str = "id, company_id, order_number, client_id,
                COALESCE(supplier_name, '') as supplier_name,
                order_date, delivery_date,
                payment_terms, payment_method,
                CASE WHEN status IS NOT NULL THEN status ELSE 'draft' END as status,
                subtotal_ht, tva_rate, tva_amount, total_ttc, notes, month_period,
                created_at, updated_at, custom_title,
                supplier_address, supplier_email, supplier_phone, supplier_rc, supplier_nif, supplier_nis, supplier_ai";

fn map_order_row(row: &rusqlite::Row) -> rusqlite::Result<Order> {
    let supplier_name: String = row.get(4)?;
    Ok(Order {
        id: row.get(0)?,
        company_id: row.get(1)?,
        order_number: row.get(2)?,
        client_id: row.get(3)?,
        supplier_name: if supplier_name.is_empty() { None } else { Some(supplier_name) },
        order_date: row.get(5)?,
        delivery_date: row.get(6)?,
        payment_terms: row.get(7)?,
        payment_method: row.get(8)?,
        status: row.get(9)?,
        subtotal_ht: row.get(10)?,
        tva_rate: row.get(11)?,
        tva_amount: row.get(12)?,
        total_ttc: row.get(13)?,
        notes: row.get(14)?,
        month_period: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
        custom_title: row.get(18)?,
        supplier_address: row.get(19).unwrap_or(None),
        supplier_email: row.get(20).unwrap_or(None),
        supplier_phone: row.get(21).unwrap_or(None),
        supplier_rc: row.get(22).unwrap_or(None),
        supplier_nif: row.get(23).unwrap_or(None),
        supplier_nis: row.get(24).unwrap_or(None),
        supplier_ai: row.get(25).unwrap_or(None),
    })
}

#[tauri::command]
pub fn get_orders(db: State<'_, Mutex<Connection>>, company_id: String) -> Result<Vec<Order>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        &format!("SELECT {} FROM orders WHERE company_id = ?1 ORDER BY created_at DESC", ORDER_SELECT_COLUMNS)
    ).map_err(|e| e.to_string())?;

    let orders = stmt.query_map(params![company_id], map_order_row).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for order in orders {
        result.push(order.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn get_order(db: State<'_, Mutex<Connection>>, id: String) -> Result<Option<Order>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        &format!("SELECT {} FROM orders WHERE id = ?1", ORDER_SELECT_COLUMNS)
    ).map_err(|e| e.to_string())?;
    
    let order = stmt.query_row(params![id], map_order_row);

    match order {
        Ok(o) => Ok(Some(o)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_next_order_number(db: State<'_, Mutex<Connection>>) -> Result<String, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    generate_order_number(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_order(db: State<'_, Mutex<Connection>>, data: CreateOrderData) -> Result<Order, String> {
    crate::license::require_active_license()?;

    let mut conn = db.lock().map_err(|e| e.to_string())?;
    let order_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let order_num_generated = generate_order_number(&conn).map_err(|e| e.to_string())?;
    let order_number = data.order_number.unwrap_or(order_num_generated);
    
    let subtotal = data.items.iter().map(|i| i.quantity * i.unit_price).sum::<f64>();
    let tva_amount = data.items.iter().map(|i| {
        let amount = i.quantity * i.unit_price;
        let rate = i.tva_rate.unwrap_or(19.0);
        if rate > 0.0 { amount * (rate / 100.0) } else { 0.0 }
    }).sum::<f64>();
    let total_ttc = subtotal + tva_amount; // Total includes TVA
    let tva_rate = if subtotal > 0.0 { (tva_amount / subtotal) * 100.0 } else { 19.0 };
    let month_period = chrono::NaiveDate::parse_from_str(&data.order_date, "%Y-%m-%d")
        .ok()
        .and_then(|d| Some(format!("{}-{:02}", d.year(), d.month())));
    
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    tx.execute(
        "INSERT INTO orders (id, company_id, order_number, client_id, supplier_name, order_date, delivery_date, payment_terms, payment_method, status, subtotal_ht, tva_rate, tva_amount, total_ttc, notes, month_period, created_at, updated_at, custom_title, supplier_address, supplier_email, supplier_phone, supplier_rc, supplier_nif, supplier_nis, supplier_ai) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26)",
        params![order_id, data.company_id, order_number, data.client_id, data.supplier_name, data.order_date, data.delivery_date, data.payment_terms, data.payment_method, "draft", subtotal, tva_rate, tva_amount, total_ttc, data.notes, month_period, now, now, data.custom_title, data.supplier_address, data.supplier_email, data.supplier_phone, data.supplier_rc, data.supplier_nif, data.supplier_nis, data.supplier_ai],
    ).map_err(|e| e.to_string())?;
    
    for item in data.items {
        let item_id = uuid::Uuid::new_v4().to_string();
        let amount = item.quantity * item.unit_price;
        let item_tva_rate = item.tva_rate.unwrap_or(19.0);
        tx.execute(
            "INSERT INTO order_items (id, order_id, product_id, product_name, product_code, product_description, quantity, unit_price, amount, created_at, tva_rate) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![item_id, order_id, item.product_id, item.product_name, item.product_code, item.product_description, item.quantity, item.unit_price, amount, now, item_tva_rate],
        ).map_err(|e| e.to_string())?;
    }
    
    tx.commit().map_err(|e| e.to_string())?;
    drop(conn);
    get_order(db, order_id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve created order".to_string())
}

#[tauri::command]
pub fn update_order(db: State<'_, Mutex<Connection>>, id: String, data: CreateOrderData) -> Result<Order, String> {
    crate::license::require_active_license()?;

    let mut conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    
    // Calculate totals
    let subtotal = data.items.iter().map(|i| i.quantity * i.unit_price).sum::<f64>();
    let tva_amount = data.items.iter().map(|i| {
        let amount = i.quantity * i.unit_price;
        let rate = i.tva_rate.unwrap_or(19.0);
        if rate > 0.0 { amount * (rate / 100.0) } else { 0.0 }
    }).sum::<f64>();
    let total_ttc = subtotal + tva_amount;
    let tva_rate = if subtotal > 0.0 { (tva_amount / subtotal) * 100.0 } else { 19.0 };
    let month_period = chrono::NaiveDate::parse_from_str(&data.order_date, "%Y-%m-%d")
        .ok()
        .and_then(|d| Some(format!("{}-{:02}", d.year(), d.month())));
    
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    // Update Order
    tx.execute(
        "UPDATE orders SET client_id = ?2, supplier_name = ?3, order_date = ?4, delivery_date = ?5, payment_terms = ?6, payment_method = ?7, subtotal_ht = ?8, tva_rate = ?9, tva_amount = ?10, total_ttc = ?11, notes = ?12, month_period = ?13, updated_at = ?14, custom_title = ?15, order_number = COALESCE(NULLIF(?16, ''), order_number), supplier_address = ?17, supplier_email = ?18, supplier_phone = ?19, supplier_rc = ?20, supplier_nif = ?21, supplier_nis = ?22, supplier_ai = ?23 WHERE id = ?1",
        params![id, data.client_id, data.supplier_name, data.order_date, data.delivery_date, data.payment_terms, data.payment_method, subtotal, tva_rate, tva_amount, total_ttc, data.notes, month_period, now, data.custom_title, data.order_number, data.supplier_address, data.supplier_email, data.supplier_phone, data.supplier_rc, data.supplier_nif, data.supplier_nis, data.supplier_ai],
    ).map_err(|e| friendly_unique_constraint_error(e, "Ce numéro de commande"))?;

    // Overwrite Items
    tx.execute("DELETE FROM order_items WHERE order_id = ?1", params![id]).map_err(|e| e.to_string())?;
    
    for item in data.items {
        let item_id = uuid::Uuid::new_v4().to_string();
        let amount = item.quantity * item.unit_price;
        let item_tva_rate = item.tva_rate.unwrap_or(19.0);
        tx.execute(
            "INSERT INTO order_items (id, order_id, product_id, product_name, product_code, product_description, quantity, unit_price, amount, created_at, tva_rate) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![item_id, id, item.product_id, item.product_name, item.product_code, item.product_description, item.quantity, item.unit_price, amount, now, item_tva_rate],
        ).map_err(|e| e.to_string())?;
    }
    
    tx.commit().map_err(|e| e.to_string())?;
    drop(conn);
    get_order(db, id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve updated order".to_string())
}

#[tauri::command]
pub fn update_order_status(db: State<'_, Mutex<Connection>>, id: String, status: String) -> Result<Order, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE orders SET status = ?2 WHERE id = ?1", params![id, status]).map_err(|e| e.to_string())?;
    drop(conn);
    get_order(db, id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve updated order".to_string())
}

#[tauri::command]
pub fn delete_order(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;

    // delivery_notes.order_id has no ON DELETE cascade — order → delivery
    // note is a normal progression in this app, so this is a common real
    // sequence to hit, not an edge case. Same "independent document, block
    // with a clear message" policy as delete_invoice's delivery-note check.
    let delivery_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM delivery_notes WHERE order_id = ?1",
            params![id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if delivery_count > 0 {
        let label = if delivery_count == 1 { "bon de livraison lié" } else { "bons de livraison liés" };
        return Err(format!(
            "Impossible de supprimer cette commande : {} {}. Supprimez-le(s) d'abord.",
            delivery_count, label
        ));
    }

    conn.execute("DELETE FROM orders WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = crate::database::resync_sequence_from_table(&conn, "order_number", "orders", "order_number", None);
    Ok(())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OrderItemWithProduct {
    pub id: String,
    pub order_id: String,
    pub product_id: Option<String>,
    pub quantity: f64,
    pub unit_price: f64,
    pub tva_rate: Option<f64>,
    pub amount: Option<f64>,
    pub products: Option<ProductInfoWithUnit>,
    pub product_name: Option<String>,
    pub product_code: Option<String>,
    pub product_description: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProductInfoWithUnit {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub unit: Option<String>,
    pub unit_price: Option<f64>,
}

#[tauri::command]
pub fn get_order_items(
    db: State<'_, Mutex<Connection>>, 
    #[allow(non_snake_case)] orderId: String
) -> Result<Vec<OrderItemWithProduct>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    // Try to join with products, but handle cases where product_id might not exist
    // Also use product_name and product_code from order_items if product_id is NULL
    let mut stmt = conn.prepare(
        "SELECT oi.id, oi.order_id, oi.product_id, oi.product_name, oi.product_code, 
                oi.quantity, oi.unit_price, oi.amount, 
                p.code, p.name, p.unit, COALESCE(oi.product_description, p.description), oi.tva_rate
         FROM order_items oi 
         LEFT JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id = ?1 
         ORDER BY oi.created_at"
    ).map_err(|e| e.to_string())?;
    
    let items = stmt.query_map(params![orderId], |row| {
        // Column order: oi.id, oi.order_id, oi.product_id, oi.product_name, oi.product_code, 
        //              oi.quantity, oi.unit_price, oi.amount, 
        //              p.code, p.name, p.unit
        let product_id: Option<String> = row.get(2)?;
        let product_name_from_item: Option<String> = row.get(3)?;
        let product_code_from_item: Option<String> = row.get(4)?;
        let quantity: f64 = row.get(5)?;
        let unit_price: f64 = row.get(6)?;
        let amount: Option<f64> = row.get(7)?;
        let code_from_product: Option<String> = row.get(8)?;
        let name_from_product: Option<String> = row.get(9)?;
        let unit_from_product: Option<String> = row.get(10)?;
        let description_from_product: Option<String> = row.get(11)?;
        let tva_rate: Option<f64> = row.get(12)?;
        
        // Use product info from products table if available, otherwise use from order_items
        let code = code_from_product.or_else(|| product_code_from_item.clone());
        let name = name_from_product.or_else(|| product_name_from_item.clone());
        let unit = unit_from_product;
        
        Ok(OrderItemWithProduct {
            id: row.get(0)?,
            order_id: row.get(1)?,
            product_id: product_id,
            quantity: quantity,
            unit_price: unit_price,
            amount: amount,
            product_name: product_name_from_item,
            product_code: product_code_from_item,
            product_description: description_from_product.clone(),
            tva_rate: tva_rate,
            products: if code.is_some() && name.is_some() {
                Some(ProductInfoWithUnit {
                    code: code.unwrap(),
                    name: name.unwrap(),
                    unit: unit,
                    description: description_from_product,
                    unit_price: None,
                })
            } else {
                None
            },
        })
    }).map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for item in items {
        result.push(item.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

// ============= DELIVERY NOTES =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DeliveryNote {
    pub id: String,
    pub company_id: Option<String>,
    pub delivery_number: String,
    pub client_id: String,
    pub delivery_date: String,
    pub invoice_id: Option<String>,
    pub order_id: Option<String>,
    pub truck_plate: Option<String>,
    pub driver_name: Option<String>,
    pub deliverer_name: Option<String>,
    pub deliverer_nin: Option<String>,
    pub transporter_name: Option<String>,
    pub transporter_nin: Option<String>,
    pub delivery_location: Option<String>,
    pub client_received_date: Option<String>,
    pub client_signature: Option<String>,
    pub supplier_delivered_date: Option<String>,
    pub is_invoiced: Option<bool>,
    pub notes: Option<String>,
    pub reserves: Option<String>,
    /// 'draft' | 'printed' | 'signed' — see set_delivery_status.
    pub status: String,
    pub signed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateDeliveryNoteData {
    // Shared with update_delivery_note, whose UPDATE statement never touches
    // this column — the frontend's update payload omits it (Omit<...,
    // "company_id">), so it must tolerate being absent from that JSON
    // instead of failing deserialization with "missing field `company_id`".
    #[serde(default)]
    pub company_id: String,
    pub client_id: String,
    pub delivery_date: String,
    pub order_id: Option<String>,
    pub truck_plate: Option<String>,
    pub driver_name: Option<String>,
    pub deliverer_name: Option<String>,
    pub deliverer_nin: Option<String>,
    pub transporter_name: Option<String>,
    pub transporter_nin: Option<String>,
    pub delivery_location: Option<String>,
    pub notes: Option<String>,
    pub reserves: Option<String>,
    pub custom_title: Option<String>,
    pub delivery_number: Option<String>,
    pub supplier_delivered_date: Option<String>,
    pub client_received_date: Option<String>,
    /// "Nom du réceptionnaire" — a plain text field despite the column name.
    pub client_signature: Option<String>,
    pub items: Vec<DeliveryNoteItemInput>,
}

#[derive(Deserialize)]
pub struct DeliveryNoteItemInput {
    pub product_id: Option<String>,
    /// Only used when product_id is None — a custom/one-off line item that
    /// doesn't correspond to any row in the products catalog.
    pub product_name: Option<String>,
    pub product_code: Option<String>,
    pub quantity: f64,
    pub product_description: Option<String>,
    pub unit_price: Option<f64>,
    pub tva_rate: Option<f64>,
}

const DELIVERY_NOTE_COLUMNS: &str = "id, company_id, delivery_number, client_id, delivery_date, invoice_id, order_id, truck_plate, driver_name, deliverer_name, deliverer_nin, transporter_name, transporter_nin, delivery_location, client_received_date, client_signature, supplier_delivered_date, is_invoiced, notes, reserves, status, signed_at, created_at, updated_at";

fn map_delivery_note_row(row: &rusqlite::Row) -> rusqlite::Result<DeliveryNote> {
    Ok(DeliveryNote {
        id: row.get(0)?,
        company_id: row.get(1)?,
        delivery_number: row.get(2)?,
        client_id: row.get(3)?,
        delivery_date: row.get(4)?,
        invoice_id: row.get(5)?,
        order_id: row.get(6)?,
        truck_plate: row.get(7)?,
        driver_name: row.get(8)?,
        deliverer_name: row.get(9)?,
        deliverer_nin: row.get(10)?,
        transporter_name: row.get(11)?,
        transporter_nin: row.get(12)?,
        delivery_location: row.get(13)?,
        client_received_date: row.get(14)?,
        client_signature: row.get(15)?,
        supplier_delivered_date: row.get(16)?,
        is_invoiced: row.get::<_, Option<i64>>(17)?.map(|v| v != 0),
        notes: row.get(18)?,
        reserves: row.get(19)?,
        status: row.get(20)?,
        signed_at: row.get(21)?,
        created_at: row.get(22)?,
        updated_at: row.get(23)?,
    })
}

#[tauri::command]
pub fn get_delivery_notes(db: State<'_, Mutex<Connection>>, company_id: String, client_id: Option<String>, is_invoiced: Option<bool>) -> Result<Vec<DeliveryNote>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut query = format!("SELECT {} FROM delivery_notes", DELIVERY_NOTE_COLUMNS);
    let mut conditions = vec![format!("company_id = '{}'", company_id.replace("'", "''"))];

    if let Some(id) = client_id {
        conditions.push(format!("client_id = '{}'", id.replace("'", "''")));
    }
    if let Some(inv) = is_invoiced {
        conditions.push(format!("is_invoiced = {}", if inv { 1 } else { 0 }));
    }

    query.push_str(&format!(" WHERE {}", conditions.join(" AND ")));
    query.push_str(" ORDER BY delivery_date DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let notes = stmt.query_map([], map_delivery_note_row).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for note in notes {
        result.push(note.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn get_delivery_note(db: State<'_, Mutex<Connection>>, id: String) -> Result<Option<DeliveryNote>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        &format!("SELECT {} FROM delivery_notes WHERE id = ?1", DELIVERY_NOTE_COLUMNS)
    ).map_err(|e| e.to_string())?;
    let note = stmt.query_row(params![id], map_delivery_note_row);

    match note {
        Ok(n) => Ok(Some(n)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn update_invoice_header(
    db: State<'_, Mutex<Connection>>, 
    id: String, 
    invoice_number: String, 
    custom_title: Option<String>
) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE invoices SET invoice_number = ?2, custom_title = ?3 WHERE id = ?1",
        params![id, invoice_number, custom_title],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn create_delivery_note(db: State<'_, Mutex<Connection>>, data: CreateDeliveryNoteData) -> Result<DeliveryNote, String> {
    crate::license::require_active_license()?;

    let mut conn = db.lock().map_err(|e| e.to_string())?;
    let note_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let delivery_num_generated = generate_delivery_note_number(&conn).map_err(|e| e.to_string())?;
    let delivery_number = data.delivery_number.unwrap_or(delivery_num_generated);
    
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    tx.execute(
        "INSERT INTO delivery_notes (id, company_id, delivery_number, client_id, delivery_date, order_id, truck_plate, driver_name, deliverer_name, deliverer_nin, transporter_name, transporter_nin, delivery_location, notes, reserves, is_invoiced, created_at, updated_at, custom_title, supplier_delivered_date, client_received_date, client_signature) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)",
        params![note_id, data.company_id, delivery_number, data.client_id, data.delivery_date, data.order_id, data.truck_plate, data.driver_name, data.deliverer_name, data.deliverer_nin, data.transporter_name, data.transporter_nin, data.delivery_location, data.notes, data.reserves, 0i64, now, now, data.custom_title, data.supplier_delivered_date, data.client_received_date, data.client_signature],
    ).map_err(|e| e.to_string())?;
    
    for item in data.items {
        let item_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO delivery_note_items (id, delivery_note_id, product_id, product_name, product_code, quantity, product_description, unit_price, tva_rate, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![item_id, note_id, item.product_id, item.product_name, item.product_code, item.quantity, item.product_description, item.unit_price, item.tva_rate, now],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "DELIVERY", Some(&note_id), &format!("Bon de livraison créé: {}", delivery_number));
    
    let mut stmt = conn.prepare(
        &format!("SELECT {} FROM delivery_notes WHERE id = ?1", DELIVERY_NOTE_COLUMNS)
    ).map_err(|e| e.to_string())?;
    stmt.query_row(params![note_id], map_delivery_note_row).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_delivery_note(db: State<'_, Mutex<Connection>>, id: String, data: CreateDeliveryNoteData) -> Result<DeliveryNote, String> {
    crate::license::require_active_license()?;

    let mut conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    // Update main delivery note
    tx.execute(
        "UPDATE delivery_notes SET
            client_id = ?2,
            delivery_date = ?3,
            order_id = ?4,
            truck_plate = ?5,
            driver_name = ?6,
            deliverer_name = ?7,
            deliverer_nin = ?8,
            transporter_name = ?9,
            transporter_nin = ?10,
            delivery_location = ?11,
            notes = ?12,
            reserves = ?13,
            updated_at = ?14,
            custom_title = ?15,
            delivery_number = COALESCE(NULLIF(?16, ''), delivery_number),
            supplier_delivered_date = ?17,
            client_received_date = ?18,
            client_signature = ?19
         WHERE id = ?1",
        params![
            id,
            data.client_id,
            data.delivery_date,
            data.order_id,
            data.truck_plate,
            data.driver_name,
            data.deliverer_name,
            data.deliverer_nin,
            data.transporter_name,
            data.transporter_nin,
            data.delivery_location,
            data.notes,
            data.reserves,
            now,
            data.custom_title,
            data.delivery_number,
            data.supplier_delivered_date,
            data.client_received_date,
            data.client_signature
        ],
    ).map_err(|e| friendly_unique_constraint_error(e, "Ce numéro de bon de livraison"))?;

    // Delete existing items
    tx.execute(
        "DELETE FROM delivery_note_items WHERE delivery_note_id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;
    
    // Insert new items
    for item in data.items {
        let item_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO delivery_note_items (id, delivery_note_id, product_id, product_name, product_code, quantity, product_description, unit_price, tva_rate, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![item_id, id, item.product_id, item.product_name, item.product_code, item.quantity, item.product_description, item.unit_price, item.tva_rate, now],
        ).map_err(|e| e.to_string())?;
    }
    
    tx.commit().map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "UPDATE", "DELIVERY", Some(&id), &format!("Bon de livraison mis à jour: {}", data.delivery_number.unwrap_or_default()));
    
    let mut stmt = conn.prepare(
        &format!("SELECT {} FROM delivery_notes WHERE id = ?1", DELIVERY_NOTE_COLUMNS)
    ).map_err(|e| e.to_string())?;

    stmt.query_row(params![id], map_delivery_note_row).map_err(|e| e.to_string())
}

/// Digital delivery-tracking status: 'draft' (created, PDF not yet
/// generated) -> 'printed' (PDF exported/shared, awaiting the client's
/// validation) -> 'signed' (delivery confirmed by the client). `signed_at`
/// is stamped automatically the moment the status transitions to 'signed'.
#[tauri::command]
pub fn set_delivery_status(db: State<'_, Mutex<Connection>>, id: String, status: String) -> Result<DeliveryNote, String> {
    crate::license::require_active_license()?;

    if !["draft", "printed", "signed"].contains(&status.as_str()) {
        return Err(format!("Statut invalide: {}", status));
    }

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    if status == "signed" {
        conn.execute(
            "UPDATE delivery_notes SET status = ?2, signed_at = ?3, updated_at = ?3 WHERE id = ?1",
            params![id, status, now],
        ).map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE delivery_notes SET status = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, status, now],
        ).map_err(|e| e.to_string())?;
    }

    let _ = log_activity(&conn, "UPDATE", "DELIVERY", Some(&id), &format!("Statut du bon de livraison mis à jour: {}", status));

    let mut stmt = conn.prepare(
        &format!("SELECT {} FROM delivery_notes WHERE id = ?1", DELIVERY_NOTE_COLUMNS)
    ).map_err(|e| e.to_string())?;
    stmt.query_row(params![id], map_delivery_note_row).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_delivery_note(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM delivery_notes WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = crate::database::resync_sequence_from_table(&conn, "delivery_note_number", "delivery_notes", "delivery_number", None);
    let _ = log_activity(&conn, "DELETE", "DELIVERY", Some(&id), "Bon de livraison supprimé");
    Ok(())
}

#[tauri::command]
pub fn get_delivery_note_items(
    db: State<'_, Mutex<Connection>>, 
    #[allow(non_snake_case)] deliveryNoteId: String
) -> Result<Vec<DeliveryNoteItemWithProduct>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT dni.id, dni.delivery_note_id, dni.product_id, dni.quantity,
                p.code, p.name, p.unit, p.unit_price, COALESCE(dni.product_description, p.description), dni.tva_rate, dni.unit_price,
                dni.product_name, dni.product_code
         FROM delivery_note_items dni
         LEFT JOIN products p ON dni.product_id = p.id
         WHERE dni.delivery_note_id = ?1
         ORDER BY dni.created_at"
    ).map_err(|e| e.to_string())?;

    let items = stmt.query_map(params![deliveryNoteId], |row| {
        let tva_rate: Option<f64> = row.get(9)?;
        let dni_unit_price: Option<f64> = row.get(10)?;
        let code: Option<String> = row.get(4)?;
        let name: Option<String> = row.get(5)?;
        let unit: Option<String> = row.get(6)?;
        let unit_price_from_p: Option<f64> = row.get(7)?;
        let description: Option<String> = row.get(8)?;
        // Custom (non-catalog) items have no products join match — fall
        // back to the item's own stored product_name/product_code.
        let item_product_name: Option<String> = row.get(11)?;
        let item_product_code: Option<String> = row.get(12)?;

        Ok(DeliveryNoteItemWithProduct {
            id: row.get(0)?,
            delivery_note_id: row.get(1)?,
            product_id: row.get(2)?,
            quantity: row.get(3)?,
            tva_rate: tva_rate,
            unit_price: dni_unit_price,
            product_description: row.get(8)?,
            product_name: name.clone().or(item_product_name),
            product_code: code.clone().or(item_product_code),
            products: {
                if code.is_some() && name.is_some() {
                    Some(ProductInfoWithUnit {
                        code: code.unwrap(),
                        name: name.unwrap(),
                        unit: unit,
                        description: description,
                        unit_price: unit_price_from_p,
                    })
                } else {
                    None
                }
            },
        })
    }).map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for item in items {
        result.push(item.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DeliveryNoteItemWithProduct {
    pub id: String,
    pub delivery_note_id: String,
    pub product_id: Option<String>,
    pub quantity: f64,
    pub unit_price: Option<f64>,
    pub tva_rate: Option<f64>,
    pub product_description: Option<String>,
    pub product_name: Option<String>,
    pub product_code: Option<String>,
    pub products: Option<ProductInfoWithUnit>,
}

// ============= EXPENSES =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Expense {
    pub id: String,
    pub company_id: Option<String>,
    pub expense_date: String,
    pub category: String,
    pub description: Option<String>,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
    pub month_period: Option<String>,
    pub project_id: Option<String>,
    /// Denormalized via LEFT JOIN in get_expenses/create_expense — avoids the
    /// frontend having to cross-reference the projects list for every row.
    pub project_name: Option<String>,
    pub supplier_id: Option<String>,
    /// Denormalized via LEFT JOIN, same reasoning as project_name above.
    pub supplier_name: Option<String>,
    pub is_recurring: Option<bool>,
    pub recurrence_interval: Option<String>,
    /// Payment-completion flag for the Charges & Dépenses page's STATUT
    /// column — true means the cash has actually been disbursed, false
    /// means it's a recorded commitment still "à payer". Defaults to true
    /// (see migrate_expenses_payment_status_if_needed) so every
    /// pre-existing expense keeps reading as settled.
    pub is_paid: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateExpenseData {
    pub company_id: String,
    pub expense_date: String,
    pub category: String,
    pub description: Option<String>,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
    pub project_id: Option<String>,
    pub supplier_id: Option<String>,
    pub is_recurring: Option<bool>,
    pub recurrence_interval: Option<String>,
    pub is_paid: Option<bool>,
}

#[derive(Deserialize)]
pub struct UpdateExpenseData {
    pub id: String,
    pub expense_date: String,
    pub category: String,
    pub description: Option<String>,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub project_id: Option<String>,
    pub is_paid: bool,
}

const EXPENSE_SELECT: &str = "SELECT e.id, e.company_id, e.expense_date, e.category, e.description, e.amount, e.payment_method, e.reference, e.notes, e.month_period, e.project_id, p.name, e.supplier_id, s.name, e.is_recurring, e.recurrence_interval, e.is_paid, e.created_at, e.updated_at FROM expenses e LEFT JOIN projects p ON e.project_id = p.id LEFT JOIN suppliers s ON e.supplier_id = s.id";

fn map_expense_row(row: &rusqlite::Row) -> rusqlite::Result<Expense> {
    Ok(Expense {
        id: row.get(0)?,
        company_id: row.get(1)?,
        expense_date: row.get(2)?,
        category: row.get(3)?,
        description: row.get(4)?,
        amount: row.get(5)?,
        payment_method: row.get(6)?,
        reference: row.get(7)?,
        notes: row.get(8)?,
        month_period: row.get(9)?,
        project_id: row.get(10)?,
        project_name: row.get(11)?,
        supplier_id: row.get(12)?,
        supplier_name: row.get(13)?,
        is_recurring: row.get::<_, Option<i64>>(14)?.map(|v| v != 0),
        recurrence_interval: row.get(15)?,
        is_paid: row.get::<_, Option<i64>>(16)?.map(|v| v != 0).unwrap_or(true),
        created_at: row.get(17)?,
        updated_at: row.get(18)?,
    })
}

fn get_expense_by_id(conn: &Connection, id: &str) -> Result<Expense, String> {
    conn.prepare(&format!("{} WHERE e.id = ?1", EXPENSE_SELECT))
        .map_err(|e| e.to_string())?
        .query_row(params![id], |row| map_expense_row(row))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_expenses(db: State<'_, Mutex<Connection>>, company_id: String, month_period: Option<String>, project_id: Option<String>) -> Result<Vec<Expense>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let mut conditions = vec!["e.company_id = ?1".to_string()];
    let mut query_params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(company_id)];

    if let Some(m) = month_period {
        query_params.push(Box::new(m));
        conditions.push(format!("e.month_period = ?{}", query_params.len()));
    }
    if let Some(pid) = project_id {
        query_params.push(Box::new(pid));
        conditions.push(format!("e.project_id = ?{}", query_params.len()));
    }

    let query = format!("{} WHERE {} ORDER BY e.expense_date DESC", EXPENSE_SELECT, conditions.join(" AND "));
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = query_params.iter().map(|p| p.as_ref()).collect();
    let rows = stmt.query_map(param_refs.as_slice(), map_expense_row).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>();

    rows.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_expense(db: State<'_, Mutex<Connection>>, data: CreateExpenseData) -> Result<Expense, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let month_period = chrono::NaiveDate::parse_from_str(&data.expense_date, "%Y-%m-%d")
        .ok()
        .and_then(|d| Some(format!("{}-{:02}", d.year(), d.month())));

    conn.execute(
        "INSERT INTO expenses (id, company_id, expense_date, category, description, amount, payment_method, reference, notes, month_period, project_id, supplier_id, is_recurring, recurrence_interval, is_paid, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![id, data.company_id, data.expense_date, data.category, data.description, data.amount, data.payment_method, data.reference, data.notes, month_period, data.project_id, data.supplier_id, data.is_recurring.unwrap_or(false), data.recurrence_interval, data.is_paid.unwrap_or(true), now, now],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "EXPENSE", Some(&id), &format!("Dépense créée: {} DA", data.amount));

    get_expense_by_id(&conn, &id)
}

#[tauri::command]
pub fn update_expense(db: State<'_, Mutex<Connection>>, data: UpdateExpenseData) -> Result<Expense, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let month_period = chrono::NaiveDate::parse_from_str(&data.expense_date, "%Y-%m-%d")
        .ok()
        .and_then(|d| Some(format!("{}-{:02}", d.year(), d.month())));

    conn.execute(
        "UPDATE expenses SET expense_date = ?1, category = ?2, description = ?3, amount = ?4, payment_method = ?5, project_id = ?6, is_paid = ?7, month_period = ?8, updated_at = ?9 WHERE id = ?10",
        params![data.expense_date, data.category, data.description, data.amount, data.payment_method, data.project_id, data.is_paid, month_period, now, data.id],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "UPDATE", "EXPENSE", Some(&data.id), &format!("Dépense modifiée: {} DA", data.amount));

    get_expense_by_id(&conn, &data.id)
}

#[tauri::command]
pub fn delete_expense(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM expenses WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "DELETE", "EXPENSE", Some(&id), "Dépense supprimée");
    Ok(())
}

// ============= ACTIVITÉS & RAPPELS (Odoo "chatter"-style follow-ups) =============
// A lightweight task attached to any record (invoice, client, supplier,
// quote) — NOT the same table/struct as ActivityLog (activity_logs), which
// is the read-only audit trail behind History.tsx. These are open,
// actionable to-dos a user schedules for themselves.

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Activity {
    pub id: String,
    pub company_id: Option<String>,
    pub entity_type: String,
    pub entity_id: String,
    pub title: String,
    pub activity_type: String,
    pub due_date: String,
    pub done_at: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateActivityData {
    pub company_id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub title: String,
    pub activity_type: String,
    pub due_date: String,
    pub notes: Option<String>,
}

const ACTIVITY_SELECT: &str = "SELECT id, company_id, entity_type, entity_id, title, activity_type, due_date, done_at, notes, created_at FROM activities";

fn map_activity_row(row: &rusqlite::Row) -> rusqlite::Result<Activity> {
    Ok(Activity {
        id: row.get(0)?,
        company_id: row.get(1)?,
        entity_type: row.get(2)?,
        entity_id: row.get(3)?,
        title: row.get(4)?,
        activity_type: row.get(5)?,
        due_date: row.get(6)?,
        done_at: row.get(7)?,
        notes: row.get(8)?,
        created_at: row.get(9)?,
    })
}

fn get_activity_by_id(conn: &Connection, id: &str) -> Result<Activity, String> {
    conn.prepare(&format!("{} WHERE id = ?1", ACTIVITY_SELECT))
        .map_err(|e| e.to_string())?
        .query_row(params![id], |row| map_activity_row(row))
        .map_err(|e| e.to_string())
}

/// Lists activities for a company, optionally narrowed to one record
/// (entity_type + entity_id — e.g. a single client's inspector panel) or one
/// entity_type across all records (e.g. "every invoice reminder"). Open
/// tasks (done_at IS NULL) sort soonest-due-first; completed ones trail
/// behind, most-recently-done first, so a detail page's list reads as
/// "what's next" without hiding history.
#[tauri::command]
pub fn list_activities(
    db: State<'_, Mutex<Connection>>,
    company_id: String,
    entity_type: Option<String>,
    entity_id: Option<String>,
) -> Result<Vec<Activity>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let mut conditions = vec!["company_id = ?1".to_string()];
    let mut query_params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(company_id)];

    if let Some(et) = entity_type {
        query_params.push(Box::new(et));
        conditions.push(format!("entity_type = ?{}", query_params.len()));
    }
    if let Some(eid) = entity_id {
        query_params.push(Box::new(eid));
        conditions.push(format!("entity_id = ?{}", query_params.len()));
    }

    let query = format!(
        "{} WHERE {} ORDER BY (done_at IS NOT NULL), due_date ASC",
        ACTIVITY_SELECT,
        conditions.join(" AND ")
    );
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = query_params.iter().map(|p| p.as_ref()).collect();
    let rows = stmt
        .query_map(param_refs.as_slice(), map_activity_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>();

    rows.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_activity(db: State<'_, Mutex<Connection>>, data: CreateActivityData) -> Result<Activity, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO activities (id, company_id, entity_type, entity_id, title, activity_type, due_date, notes, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![id, data.company_id, data.entity_type, data.entity_id, data.title, data.activity_type, data.due_date, data.notes, now],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "ACTIVITY", Some(&id), &format!("Rappel créé: {}", data.title));

    get_activity_by_id(&conn, &id)
}

#[tauri::command]
pub fn complete_activity(db: State<'_, Mutex<Connection>>, id: String) -> Result<Activity, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute("UPDATE activities SET done_at = ?1 WHERE id = ?2", params![now, id])
        .map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "UPDATE", "ACTIVITY", Some(&id), "Rappel terminé");

    get_activity_by_id(&conn, &id)
}

#[tauri::command]
pub fn delete_activity(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM activities WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "DELETE", "ACTIVITY", Some(&id), "Rappel supprimé");
    Ok(())
}

// Command to read letterhead image
#[tauri::command]
pub fn get_letterhead_image() -> Result<Option<Vec<u8>>, String> {
    use std::fs;
    use std::path::PathBuf;
    use std::env;
    
    // Get current working directory (should be project root when running tauri dev)
    let current_dir = env::current_dir().map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    // Build the path to the letterhead image
    let letterhead_path = current_dir
        .join("Identité Visuelle")
        .join("PAPETERIE & SUPPORTS IMPRIMÉS")
        .join("PAPIER À EN-TÊTE")
        .join("PNG")
        .join("PAPIER-À-EN-TÊTE-PNG.png");
    
    // Try the exact path first
    if letterhead_path.exists() {
        match fs::read(&letterhead_path) {
            Ok(data) => return Ok(Some(data)),
            Err(e) => eprintln!("Error reading letterhead file: {}", e),
        }
    }
    
    // If exact file not found, try to find any PNG in that directory
    let png_dir = current_dir
        .join("Identité Visuelle")
        .join("PAPETERIE & SUPPORTS IMPRIMÉS")
        .join("PAPIER À EN-TÊTE")
        .join("PNG");
    
    if png_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&png_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("png") {
                    match fs::read(&path) {
                        Ok(data) => return Ok(Some(data)),
                        Err(_) => continue,
                    }
                }
            }
        }
    }
    
    // Also try relative paths in case current_dir is different
    let relative_paths = vec![
        PathBuf::from("Identité Visuelle/PAPETERIE & SUPPORTS IMPRIMÉS/PAPIER À EN-TÊTE/PNG/PAPIER-À-EN-TÊTE-PNG.png"),
        PathBuf::from("../Identité Visuelle/PAPETERIE & SUPPORTS IMPRIMÉS/PAPIER À EN-TÊTE/PNG/PAPIER-À-EN-TÊTE-PNG.png"),
    ];
    
    for path in relative_paths {
        if path.exists() {
            if let Ok(data) = fs::read(&path) {
                return Ok(Some(data));
            }
        }
    }
    
    Ok(None)
}

// Command to get products purchased by a client
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ClientProductSummary {
    pub product_id: String,
    pub product_code: String,
    pub product_name: String,
    pub unit: String,
    pub total_quantity: f64,
    pub total_amount: f64,
}

#[tauri::command]
pub fn get_client_products(
    db: State<'_, Mutex<Connection>>, 
    #[allow(non_snake_case)] clientId: String,
    #[allow(non_snake_case)] productId: Option<String>,
    month: Option<String>,
    year: Option<i32>,
) -> Result<Vec<ClientProductSummary>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    
    // Build the query with optional filters
    let mut query = "SELECT 
            p.id as product_id,
            p.code as product_code,
            p.name as product_name,
            COALESCE(p.unit, 'T') as unit,
            SUM(ii.quantity) as total_quantity,
            SUM(ii.quantity * ii.unit_price) as total_amount
        FROM invoice_items ii
        INNER JOIN invoices i ON ii.invoice_id = i.id
        INNER JOIN products p ON ii.product_id = p.id
        WHERE i.client_id = ?1 AND i.invoice_type NOT IN ('credit_note', 'proforma', 'quote')".to_string();
    
    // Add filters to query
    if productId.is_some() {
        query.push_str(" AND p.id = ?2");
    }
    if month.is_some() {
        query.push_str(" AND strftime('%Y-%m', i.invoice_date) = ?");
    }
    if year.is_some() {
        query.push_str(" AND strftime('%Y', i.invoice_date) = ?");
    }
    
    query.push_str(" GROUP BY p.id, p.code, p.name, p.unit
        HAVING SUM(ii.quantity) > 0
        ORDER BY total_quantity DESC");
    
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    // Execute with appropriate parameters and collect results
    let result = match (productId, month, year) {
        (None, None, None) => {
            let items = stmt.query_map(params![clientId], |row| {
                Ok(ClientProductSummary {
                    product_id: row.get(0)?,
                    product_code: row.get(1)?,
                    product_name: row.get(2)?,
                    unit: row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "T".to_string()),
                    total_quantity: row.get(4)?,
                    total_amount: row.get(5)?,
                })
            }).map_err(|e| e.to_string())?;
            items.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        },
        (Some(pid), None, None) => {
            let items = stmt.query_map(params![clientId, pid], |row| {
                Ok(ClientProductSummary {
                    product_id: row.get(0)?,
                    product_code: row.get(1)?,
                    product_name: row.get(2)?,
                    unit: row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "T".to_string()),
                    total_quantity: row.get(4)?,
                    total_amount: row.get(5)?,
                })
            }).map_err(|e| e.to_string())?;
            items.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        },
        (None, Some(m), None) => {
            let items = stmt.query_map(params![clientId, m], |row| {
                Ok(ClientProductSummary {
                    product_id: row.get(0)?,
                    product_code: row.get(1)?,
                    product_name: row.get(2)?,
                    unit: row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "T".to_string()),
                    total_quantity: row.get(4)?,
                    total_amount: row.get(5)?,
                })
            }).map_err(|e| e.to_string())?;
            items.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        },
        (None, None, Some(y)) => {
            let year_str = y.to_string();
            let items = stmt.query_map(params![clientId, year_str], |row| {
                Ok(ClientProductSummary {
                    product_id: row.get(0)?,
                    product_code: row.get(1)?,
                    product_name: row.get(2)?,
                    unit: row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "T".to_string()),
                    total_quantity: row.get(4)?,
                    total_amount: row.get(5)?,
                })
            }).map_err(|e| e.to_string())?;
            items.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        },
        (Some(pid), Some(m), None) => {
            let items = stmt.query_map(params![clientId, pid, m], |row| {
                Ok(ClientProductSummary {
                    product_id: row.get(0)?,
                    product_code: row.get(1)?,
                    product_name: row.get(2)?,
                    unit: row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "T".to_string()),
                    total_quantity: row.get(4)?,
                    total_amount: row.get(5)?,
                })
            }).map_err(|e| e.to_string())?;
            items.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        },
        (Some(pid), None, Some(y)) => {
            let year_str = y.to_string();
            let items = stmt.query_map(params![clientId, pid, year_str], |row| {
                Ok(ClientProductSummary {
                    product_id: row.get(0)?,
                    product_code: row.get(1)?,
                    product_name: row.get(2)?,
                    unit: row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "T".to_string()),
                    total_quantity: row.get(4)?,
                    total_amount: row.get(5)?,
                })
            }).map_err(|e| e.to_string())?;
            items.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        },
        (None, Some(m), Some(y)) => {
            let year_str = y.to_string();
            let items = stmt.query_map(params![clientId, m, year_str], |row| {
                Ok(ClientProductSummary {
                    product_id: row.get(0)?,
                    product_code: row.get(1)?,
                    product_name: row.get(2)?,
                    unit: row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "T".to_string()),
                    total_quantity: row.get(4)?,
                    total_amount: row.get(5)?,
                })
            }).map_err(|e| e.to_string())?;
            items.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        },
        (Some(pid), Some(m), Some(y)) => {
            let year_str = y.to_string();
            let items = stmt.query_map(params![clientId, pid, m, year_str], |row| {
                Ok(ClientProductSummary {
                    product_id: row.get(0)?,
                    product_code: row.get(1)?,
                    product_name: row.get(2)?,
                    unit: row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "T".to_string()),
                    total_quantity: row.get(4)?,
                    total_amount: row.get(5)?,
                })
            }).map_err(|e| e.to_string())?;
            items.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        },
    };
    
    Ok(result)
}


// ============= SETTINGS =============

#[tauri::command]
pub fn get_settings(db: State<'_, Mutex<Connection>>) -> Result<std::collections::HashMap<String, String>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT key, value FROM settings").map_err(|e| e.to_string())?;
    
    let settings_iter = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?;
    
    let mut settings = std::collections::HashMap::new();
    for setting in settings_iter {
        let (key, value) = setting.map_err(|e| e.to_string())?;
        settings.insert(key, value);
    }
    
    Ok(settings)
}

#[tauri::command]
pub fn update_setting(db: State<'_, Mutex<Connection>>, key: String, value: String) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // Deliberately NOT license-gated. This was gated during onboarding at
    // one point (see the removed has_password_set()-gated bypass, kept
    // briefly for create_company/update_company's benefit) but that
    // blocked far more than intended: this same command backs invoice
    // branding/customization (template, accent color, font, logo/stamp
    // size — see InvoiceCustomizeDrawer.tsx) alongside real app
    // configuration, none of which is "creating or editing business data"
    // in the sense read-only mode means to restrict. A trial-expired or
    // unactivated user should still be able to view their data AND
    // customize how it's presented — only actually creating/editing/
    // deleting invoices, clients, and products is gated, via each of
    // those commands' own require_active_license() call plus the
    // frontend's useLicenseGate()/LicenseBlockedModal.
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        params![key, value],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_settings(db: State<'_, Mutex<Connection>>, settings: std::collections::HashMap<String, String>) -> Result<(), String> {
    // Deliberately NOT license-gated — see update_setting's doc comment
    // above for why (branding/customization writes go through this same
    // settings table, not just onboarding).
    let mut conn = db.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    for (key, value) in settings {
        tx.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) 
             ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, value],
        ).map_err(|e| e.to_string())?;
    }
    
    tx.commit().map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "UPDATE", "SETTINGS", None, "Paramètres globaux mis à jour");

    Ok(())
}

// ============= TELEMETRY =============
// See telemetry.rs for the full design (what's sent, the 24h throttle,
// why it's fail-silent). set_telemetry_enabled deliberately does NOT call
// require_active_license() — unlike update_setting/update_settings above,
// a privacy control must stay usable regardless of license state, or a
// trial/expired user would have no way to opt out.

#[tauri::command]
pub fn get_telemetry_status(db: State<'_, Mutex<Connection>>) -> Result<crate::telemetry::TelemetryStatus, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    Ok(crate::telemetry::status(&conn))
}

#[tauri::command]
pub fn set_telemetry_enabled(db: State<'_, Mutex<Connection>>, enabled: bool) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    crate::telemetry::set_enabled(&conn, enabled)
}

// ============= EMAIL =============

/// Sends a document (invoice/BL/BC) by email with the generated PDF attached,
/// via Gmail SMTP using the sender address + App Password configured in
/// Paramètres > Envoi d'Emails. Deliberately ungated by license — same
/// reasoning as PDF export/print: an output action on an already-existing
/// document, not a new data mutation.
#[tauri::command]
pub async fn send_email_with_pdf(
    db: State<'_, Mutex<Connection>>,
    to: String,
    subject: String,
    body: String,
    pdf_base64: String,
    file_name: String,
) -> Result<(), String> {
    use base64::{engine::general_purpose, Engine as _};
    use lettre::message::{header::ContentType, Attachment, MultiPart, SinglePart};
    use lettre::transport::smtp::authentication::Credentials;
    use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

    let (smtp_email, smtp_app_password, company_name) = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let get = |key: &str| -> Option<String> {
            conn.query_row("SELECT value FROM settings WHERE key = ?1", params![key], |row| row.get(0))
                .ok()
        };
        (get("smtp_email"), get("smtp_app_password"), get("company_name"))
    };

    let smtp_email = smtp_email
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| "Aucun compte d'envoi configuré. Renseignez votre email et mot de passe d'application dans Paramètres > Envoi d'Emails.".to_string())?;
    let smtp_app_password = smtp_app_password
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| "Aucun mot de passe d'application configuré. Renseignez-le dans Paramètres > Envoi d'Emails.".to_string())?;

    let pdf_bytes = general_purpose::STANDARD
        .decode(&pdf_base64)
        .map_err(|e| format!("Échec du décodage du PDF: {}", e))?;

    let sender_name = company_name.unwrap_or_else(|| "Sordi".to_string());
    let content_type = ContentType::parse("application/pdf").map_err(|e| e.to_string())?;
    let attachment = Attachment::new(file_name).body(pdf_bytes, content_type);
    let text_part = SinglePart::builder().header(ContentType::TEXT_PLAIN).body(body);

    let email = Message::builder()
        .from(format!("{} <{}>", sender_name, smtp_email)
            .parse()
            .map_err(|e| format!("Adresse d'expéditeur invalide: {}", e))?)
        .to(to.parse().map_err(|e| format!("Adresse destinataire invalide: {}", e))?)
        .subject(subject)
        .multipart(MultiPart::mixed().singlepart(text_part).singlepart(attachment))
        .map_err(|e| format!("Échec de la construction du message: {}", e))?;

    let credentials = Credentials::new(smtp_email, smtp_app_password);

    let mailer = AsyncSmtpTransport::<Tokio1Executor>::starttls_relay("smtp.gmail.com")
        .map_err(|e| format!("Échec de connexion au serveur SMTP: {}", e))?
        .port(587)
        .credentials(credentials)
        .build();

    mailer
        .send(email)
        .await
        .map_err(|e| format!("Échec de l'envoi — vérifiez l'email et le mot de passe d'application configurés. ({})", e))?;

    Ok(())
}

// ============= STATS =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProductSalesStat {
    pub product_id: String,
    pub product_name: String,
    pub product_code: String,
    pub total_quantity: f64,
    pub total_amount: f64,
}

#[tauri::command]
pub fn get_product_sales_stats(db: State<'_, Mutex<Connection>>, company_id: String, year: Option<i64>, months: Option<Vec<String>>) -> Result<Vec<ProductSalesStat>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let mut query = format!(
        "SELECT p.id, p.name, p.code, SUM(ii.quantity) as total_quantity, SUM(ii.amount) as total_amount
         FROM invoice_items ii
         JOIN invoices i ON ii.invoice_id = i.id
         JOIN products p ON ii.product_id = p.id
         WHERE i.invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND i.company_id = '{}'", company_id.replace('\'', "''")
    );
    
    if let Some(y) = year {
        let y_str = y.to_string();
        query.push_str(&format!(" AND strftime('%Y', i.invoice_date) = '{}'", y_str));
    }

    if let Some(ref m_list) = months {
        if !m_list.is_empty() {
            // pad months to 2 digits "01", "02"
            let padded_months: Vec<String> = m_list.iter().map(|m| {
                if m.len() == 1 { format!("0{}", m) } else { m.clone() }
            }).collect();
            
            let months_str = padded_months.iter().map(|m| format!("'{}'", m)).collect::<Vec<_>>().join(",");
            query.push_str(&format!(" AND strftime('%m', i.invoice_date) IN ({})", months_str));
        }
    }
    
    query.push_str(" GROUP BY p.id ORDER BY total_amount DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let product_stats = stmt.query_map([], |row| {
         Ok(ProductSalesStat {
            product_id: row.get(0)?,
            product_name: row.get(1)?,
            product_code: row.get(2)?,
            total_quantity: row.get(3)?,
            total_amount: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for stat in product_stats {
        result.push(stat.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DashboardStats {
    pub current_month: PeriodStats,
    pub yearly: PeriodStats,
    pub payments: PaymentStats,
    pub sales_cumulatives: SalesCumulativeStats,
    pub monthly_data: Vec<TimePointStats>,
    pub daily_data: Vec<TimePointStats>,
    pub product_stats: Vec<ProductSalesStat>,
    pub growth: f64,
    pub invoice_count: i64,
    pub is_month_view: bool,
    /// True operating profitability (HT basis) — see get_dashboard_stats.
    /// Distinct from `yearly`, which stays cash-basis/TTC.
    pub revenue_ht: f64,
    pub expense_count: i64,
    pub net_profit_ht: f64,
    pub margin_percentage_ht: f64,
    /// Period-scoped unpaid balance on invoices issued in this period —
    /// same figure as the existing `unpaid` local, exposed at the top level.
    pub outstanding_receivables: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SalesCumulativeStats {
    pub total_ht: f64,
    pub total_ttc: f64,
    pub total_tva: f64,
    pub total_timbre: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PeriodStats {
    pub revenue: f64,
    pub expenses: f64,
    pub profit: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PaymentStats {
    pub paid: f64,
    pub unpaid: f64,
    pub initial_debt: f64,
    pub total_receivables: f64,
    /// Count of invoices actually carrying that outstanding balance — same
    /// all-time scope as total_receivables. Powers the Dashboard's
    /// "Reste à Recouvrer" card subtext.
    pub outstanding_invoice_count: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TimePointStats {
    pub label: String,
    pub revenue: f64,
    /// Combined total (expenses_only + payroll_amount) — kept for existing
    /// consumers of "the" per-period charges figure.
    pub expenses: f64,
    pub profit: f64,
    /// `expenses` table only, no payroll folded in — the "Dépenses
    /// opérationnelles" line in the chart tooltip breakdown.
    pub expenses_only: f64,
    /// Settled payroll for this period ("Masse salariale" in the tooltip).
    /// Always 0.0 in daily_data — payroll has no day-level granularity.
    pub payroll_amount: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CumulativeSalesRecord {
    pub client_name: String,
    pub product_name: String,
    pub total_quantity: f64,
    pub total_ht: f64,
    pub total_tva: f64,
    pub total_ttc: f64,
    pub total_timbre: f64,
}

#[tauri::command]
pub fn get_client_product_cumulatives(
    db: State<'_, Mutex<Connection>>,
    company_id: String,
    year: Option<i64>,
    months: Option<Vec<String>>
) -> Result<Vec<CumulativeSalesRecord>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let target_year = year.unwrap_or_else(|| chrono::Local::now().year() as i64);

    let mut date_filter = format!("strftime('%Y', i.invoice_date) = '{}' AND i.company_id = '{}'", target_year, company_id.replace('\'', "''"));

    if let Some(ref m_list) = months {
        if !m_list.is_empty() {
             let padded_months: Vec<String> = m_list.iter().map(|m| {
                if m.len() == 1 { format!("0{}", m) } else { m.clone() }
            }).collect();
            let months_str = padded_months.iter().map(|m| format!("'{}'", m)).collect::<Vec<_>>().join(",");
            date_filter.push_str(&format!(" AND strftime('%m', i.invoice_date) IN ({})", months_str));
        }
    }

    let mut stmt = conn.prepare(&format!("
        SELECT 
            c.name as client_name,
            p.name as product_name,
            SUM(CASE WHEN i.invoice_type = 'credit_note' THEN -ii.quantity ELSE ii.quantity END) as total_quantity,
            SUM(CASE WHEN i.invoice_type = 'credit_note' THEN -(ii.quantity * ii.unit_price) ELSE (ii.quantity * ii.unit_price) END) as total_ht,
            SUM(CASE WHEN i.invoice_type = 'credit_note' THEN -(ii.quantity * ii.unit_price * (COALESCE(ii.tva_rate, 0) / 100.0)) ELSE (ii.quantity * ii.unit_price * (COALESCE(ii.tva_rate, 0) / 100.0)) END) as total_tva,
            SUM(CASE WHEN i.invoice_type = 'credit_note' THEN -(ii.quantity * ii.unit_price * (1 + COALESCE(ii.tva_rate, 0) / 100.0)) ELSE (ii.quantity * ii.unit_price * (1 + COALESCE(ii.tva_rate, 0) / 100.0)) END) as total_ttc,
            SUM(CASE 
                WHEN i.invoice_type = 'credit_note' THEN 0.0
                WHEN (COALESCE(i.total_ttc, 0.0) - COALESCE(i.timbre, 0.0)) > 0.0 
                THEN ( (ii.quantity * ii.unit_price * (1.0 + COALESCE(ii.tva_rate, 0.0) / 100.0)) / (i.total_ttc - i.timbre) ) * i.timbre
                ELSE 0.0 
            END) as total_timbre
        FROM invoices i
        JOIN invoice_items ii ON i.id = ii.invoice_id
        JOIN clients c ON i.client_id = c.id
        JOIN products p ON ii.product_id = p.id
        WHERE i.invoice_type != 'proforma' AND {}
        GROUP BY c.id, p.id
        ORDER BY c.name, p.name
    ", date_filter)).map_err(|e| e.to_string())?;

    let records = stmt.query_map([], |row| {
        Ok(CumulativeSalesRecord {
            client_name: row.get(0)?,
            product_name: row.get(1)?,
            total_quantity: row.get(2)?,
            total_ht: row.get(3)?,
            total_tva: row.get(4)?,
            total_ttc: row.get(5)?,
            total_timbre: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for r in records {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ClientCumulativeRecord {
    pub client_name: String,
    pub total_ht: f64,
    pub total_tva: f64,
    pub total_timbre: f64,
    pub total_ttc: f64,
    pub total_quantity: f64,
    pub invoice_count: i64,
}

#[tauri::command]
pub fn get_client_cumulatives(
    db: State<'_, Mutex<Connection>>,
    company_id: String,
    year: Option<i64>,
    months: Option<Vec<String>>
) -> Result<Vec<ClientCumulativeRecord>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let target_year = year.unwrap_or_else(|| chrono::Local::now().year() as i64);

    let mut date_filter = format!("strftime('%Y', i.invoice_date) = '{}' AND i.company_id = '{}'", target_year, company_id.replace('\'', "''"));

    if let Some(ref m_list) = months {
        if !m_list.is_empty() {
             let padded_months: Vec<String> = m_list.iter().map(|m| {
                if m.len() == 1 { format!("0{}", m) } else { m.clone() }
            }).collect();
            let months_str = padded_months.iter().map(|m| format!("'{}'", m)).collect::<Vec<_>>().join(",");
            date_filter.push_str(&format!(" AND strftime('%m', i.invoice_date) IN ({})", months_str));
        }
    }

    let mut stmt = conn.prepare(&format!("
        SELECT 
            c.name as client_name,
            SUM(CASE WHEN i.invoice_type = 'credit_note' THEN -COALESCE(i.subtotal_ht, 0.0) ELSE COALESCE(i.subtotal_ht, 0.0) END) as total_ht,
            SUM(CASE WHEN i.invoice_type = 'credit_note' THEN -COALESCE(i.tva_amount, 0.0) ELSE COALESCE(i.tva_amount, 0.0) END) as total_tva,
            SUM(CASE WHEN i.invoice_type = 'credit_note' THEN -COALESCE(i.timbre, 0.0) ELSE COALESCE(i.timbre, 0.0) END) as total_timbre,
            SUM(CASE WHEN i.invoice_type = 'credit_note' THEN -COALESCE(i.total_ttc, 0.0) ELSE COALESCE(i.total_ttc, 0.0) END) as total_ttc,
            SUM(CASE WHEN i.invoice_type = 'credit_note' THEN -(SELECT SUM(quantity) FROM invoice_items WHERE invoice_id = i.id) ELSE (SELECT SUM(quantity) FROM invoice_items WHERE invoice_id = i.id) END) as total_quantity,
            SUM(CASE WHEN i.invoice_type = 'credit_note' THEN -1 ELSE 1 END) as invoice_count
        FROM invoices i
        JOIN clients c ON i.client_id = c.id
        WHERE i.invoice_type != 'proforma' AND {}
        GROUP BY c.id
        ORDER BY total_ttc DESC
    ", date_filter)).map_err(|e| e.to_string())?;

    let records = stmt.query_map([], |row| {
        Ok(ClientCumulativeRecord {
            client_name: row.get(0)?,
            total_ht: row.get(1)?,
            total_tva: row.get(2)?,
            total_timbre: row.get(3)?,
            total_ttc: row.get(4)?,
            total_quantity: row.get(5)?,
            invoice_count: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for r in records {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

// ============= CLIENT OVERVIEW (computed, read-only) =============
//
// Powers the "Aperçu" section on the client detail page and the status
// badge on the clients list. Everything here is derived at query time from
// invoices/payments/clients — nothing is stored. Grouping and the date math
// (payment-closure delay, purchase-gap) run in Rust rather than a SQL CTE:
// the crossover logic ("which payment first brought the running total to
// total_ttc") is easy to get right and step through as a loop, much less so
// as a window-function query with no way to test it against real data from
// this environment. client_id: None serves the whole clients list in one
// round trip (mirrors get_client_cumulatives above); Some(id) serves a
// single client's detail page.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ClientOverviewStats {
    pub client_id: String,
    pub total_revenue: f64,
    pub client_since: String,
    pub invoice_count: i64,
    pub last_invoice_date: Option<String>,
    /// Days between invoice_date and the date the closing payment crossed
    /// total_ttc, for this client's most recent fully-paid (status='paid')
    /// invoices, most-recent-first, capped at 10. The UI derives both the
    /// "last 10" and "last 3" averages it needs from this one list, so both
    /// stay anchored to the same recency ordering.
    pub recent_payment_delays_days: Vec<f64>,
    /// Gaps in days between consecutive invoice dates, most-recent-first,
    /// derived from up to the last 7 invoice dates (so up to 6 gaps).
    pub recent_purchase_gaps_days: Vec<f64>,
    pub payment_terms_days: Option<i64>,
    pub has_overdue_unpaid: bool,
}

fn parse_ymd(s: &str) -> Option<chrono::NaiveDate> {
    let slice = if s.len() >= 10 { &s[0..10] } else { s };
    chrono::NaiveDate::parse_from_str(slice, "%Y-%m-%d").ok()
}

#[tauri::command]
pub fn get_client_overview_stats(
    db: State<'_, Mutex<Connection>>,
    company_id: String,
    client_id: Option<String>,
) -> Result<Vec<ClientOverviewStats>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let today = chrono::Local::now().date_naive();

    struct ClientRow {
        id: String,
        payment_terms_days: Option<i64>,
        created_at: String,
    }
    let mut client_stmt = if client_id.is_some() {
        conn.prepare("SELECT id, payment_terms_days, created_at FROM clients WHERE company_id = ?1 AND id = ?2")
    } else {
        conn.prepare("SELECT id, payment_terms_days, created_at FROM clients WHERE company_id = ?1")
    }.map_err(|e| e.to_string())?;
    let map_client_row = |row: &rusqlite::Row| -> rusqlite::Result<ClientRow> {
        Ok(ClientRow {
            id: row.get(0)?,
            payment_terms_days: row.get(1)?,
            created_at: row.get(2)?,
        })
    };
    let client_rows: Vec<ClientRow> = if let Some(ref id) = client_id {
        client_stmt.query_map(params![company_id, id], map_client_row)
    } else {
        client_stmt.query_map(params![company_id], map_client_row)
    }.map_err(|e| e.to_string())?
      .collect::<Result<Vec<_>, _>>()
      .map_err(|e| e.to_string())?;

    if client_rows.is_empty() {
        return Ok(Vec::new());
    }

    struct InvoiceRow {
        id: String,
        client_id: String,
        invoice_date: String,
        total_ttc: f64,
        status: String,
    }
    let invoice_sql = "SELECT id, client_id, invoice_date, total_ttc, status FROM invoices \
        WHERE invoice_type != 'proforma' AND status != 'cancelled' AND company_id = ?1{} \
        ORDER BY invoice_date DESC, created_at DESC";
    let mut invoice_stmt = if client_id.is_some() {
        conn.prepare(&invoice_sql.replace("{}", " AND client_id = ?2"))
    } else {
        conn.prepare(&invoice_sql.replace("{}", ""))
    }.map_err(|e| e.to_string())?;
    let map_invoice_row = |row: &rusqlite::Row| -> rusqlite::Result<InvoiceRow> {
        Ok(InvoiceRow {
            id: row.get(0)?,
            client_id: row.get(1)?,
            invoice_date: row.get(2)?,
            total_ttc: row.get(3)?,
            status: row.get(4)?,
        })
    };
    let invoice_rows: Vec<InvoiceRow> = if let Some(ref id) = client_id {
        invoice_stmt.query_map(params![company_id, id], map_invoice_row)
    } else {
        invoice_stmt.query_map(params![company_id], map_invoice_row)
    }.map_err(|e| e.to_string())?
      .collect::<Result<Vec<_>, _>>()
      .map_err(|e| e.to_string())?;

    // Fetch all payments once and group in memory — same pattern get_payments(None)
    // already uses elsewhere; cheap for a local SQLite file, avoids one query per invoice.
    let mut payment_stmt = conn
        .prepare("SELECT invoice_id, payment_date, amount FROM payments ORDER BY payment_date ASC, id ASC")
        .map_err(|e| e.to_string())?;
    let payment_rows: Vec<(String, String, f64)> = payment_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut payments_by_invoice: std::collections::HashMap<String, Vec<(String, f64)>> =
        std::collections::HashMap::new();
    for (inv_id, pay_date, amount) in payment_rows {
        payments_by_invoice.entry(inv_id).or_default().push((pay_date, amount));
    }

    let mut invoices_by_client: std::collections::HashMap<String, Vec<&InvoiceRow>> =
        std::collections::HashMap::new();
    for inv in &invoice_rows {
        invoices_by_client.entry(inv.client_id.clone()).or_default().push(inv);
    }

    let empty_invoices: Vec<&InvoiceRow> = Vec::new();
    let mut result = Vec::with_capacity(client_rows.len());
    for client in &client_rows {
        // Already ordered most-recent-first via the SQL ORDER BY above.
        let client_invoices = invoices_by_client.get(&client.id).unwrap_or(&empty_invoices);

        let total_revenue: f64 = client_invoices.iter().map(|i| i.total_ttc).sum();
        let invoice_count = client_invoices.len() as i64;
        let last_invoice_date = client_invoices.first().map(|i| i.invoice_date.clone());

        let first_invoice_date = client_invoices
            .iter()
            .filter_map(|i| parse_ymd(&i.invoice_date))
            .min();
        let client_created = parse_ymd(&client.created_at);
        let client_since = match (first_invoice_date, client_created) {
            (Some(f), Some(c)) => f.min(c),
            (Some(f), None) => f,
            (None, Some(c)) => c,
            (None, None) => today,
        }
        .format("%Y-%m-%d")
        .to_string();

        // Payment-closure delay for the last 10 fully-paid invoices.
        let mut recent_payment_delays_days: Vec<f64> = Vec::new();
        for inv in client_invoices.iter() {
            if recent_payment_delays_days.len() >= 10 {
                break;
            }
            if inv.status != "paid" {
                continue;
            }
            let Some(inv_date) = parse_ymd(&inv.invoice_date) else { continue };
            let mut pays = payments_by_invoice.get(&inv.id).cloned().unwrap_or_default();
            pays.sort_by(|a, b| a.0.cmp(&b.0));
            let mut running = 0.0;
            let mut closing_date: Option<chrono::NaiveDate> = None;
            for (pay_date, amount) in &pays {
                running += amount;
                if running >= inv.total_ttc {
                    closing_date = parse_ymd(pay_date);
                    break;
                }
            }
            // No payment rows reach total_ttc (e.g. status was force-set to
            // "paid" without logging payments) — can't compute a real delay,
            // so this invoice is left out of the average rather than faked.
            if let Some(close) = closing_date {
                recent_payment_delays_days.push((close - inv_date).num_days() as f64);
            }
        }

        // Purchase-gap: up to the last 7 invoice dates -> up to 6 gaps.
        let recent_dates: Vec<chrono::NaiveDate> = client_invoices
            .iter()
            .filter_map(|i| parse_ymd(&i.invoice_date))
            .take(7)
            .collect();
        let mut recent_purchase_gaps_days: Vec<f64> = Vec::new();
        for pair in recent_dates.windows(2) {
            recent_purchase_gaps_days.push((pair[0] - pair[1]).num_days() as f64);
        }

        // "Overdue" is spec'd as invoice_date + payment_terms_days < today,
        // not the (independently editable) stored due_date column, so a
        // manual due_date edit can't silently change this computation.
        let terms = client.payment_terms_days.unwrap_or(30);
        // Anything not fully paid counts, not just literal "unpaid"/"partial":
        // create_invoice defaults new invoices to status "issued" and never
        // calls update_invoice_payment_status itself (only a payment event
        // does), so a genuinely never-paid invoice sits at "issued" forever —
        // the single most common "unpaid" case. "draft" is excluded on
        // purpose: an unsent invoice was never actually billed to the client.
        let has_overdue_unpaid = client_invoices.iter().any(|inv| {
            if inv.status == "paid" || inv.status == "draft" {
                return false;
            }
            match parse_ymd(&inv.invoice_date) {
                Some(inv_date) => inv_date + chrono::Duration::days(terms) < today,
                None => false,
            }
        });

        result.push(ClientOverviewStats {
            client_id: client.id.clone(),
            total_revenue,
            client_since,
            invoice_count,
            last_invoice_date,
            recent_payment_delays_days,
            recent_purchase_gaps_days,
            payment_terms_days: client.payment_terms_days,
            has_overdue_unpaid,
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn get_dashboard_stats(
    db: State<'_, Mutex<Connection>>,
    company_id: String,
    year: Option<i64>,
    months: Option<Vec<String>>
) -> Result<DashboardStats, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let target_year = year.unwrap_or_else(|| chrono::Local::now().year() as i64);
    // Every dynamically-built WHERE clause below appends this — company_id
    // is always a server-generated UUID (never raw user text), but the
    // single quotes are still escaped defensively since these clauses are
    // string-interpolated rather than parameterized like the rest of the file.
    let company_filter = format!("company_id = '{}'", company_id.replace('\'', "''"));

    // 1. Initial Debt
    let initial_debt: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(initial_balance), 0.0) FROM clients WHERE {}", company_filter),
        [],
        |row| row.get(0)
    ).unwrap_or(0.0);

    // 2. Filter Logic
    let mut invoice_date_filter = format!("strftime('%Y', invoice_date) = '{}' AND {}", target_year, company_filter);
    let mut expense_date_filter = format!("strftime('%Y', expense_date) = '{}' AND {}", target_year, company_filter);
    // Cash-basis filter for the Flux de Trésorerie chart — scoped through
    // the joined invoice's own company_id (payments.company_id exists too,
    // but isn't guaranteed backfilled the way invoices.company_id is).
    let mut payment_date_filter = format!(
        "strftime('%Y', p.payment_date) = '{}' AND i.company_id = '{}'",
        target_year,
        company_id.replace('\'', "''")
    );

    let is_daily_view = months.as_ref().map(|m| m.len() == 1).unwrap_or(false);

    if let Some(ref m_list) = months {
        if !m_list.is_empty() {
             let padded_months: Vec<String> = m_list.iter().map(|m| {
                if m.len() == 1 { format!("0{}", m) } else { m.clone() }
            }).collect();
            let months_str = padded_months.iter().map(|m| format!("'{}'", m)).collect::<Vec<_>>().join(",");

            invoice_date_filter.push_str(&format!(" AND strftime('%m', invoice_date) IN ({})", months_str));
            expense_date_filter.push_str(&format!(" AND strftime('%m', expense_date) IN ({})", months_str));
            payment_date_filter.push_str(&format!(" AND strftime('%m', p.payment_date) IN ({})", months_str));
        }
    }

    // 3. Global Receivables (Always Absolute Total Across All Time)
    // Use amount_paid from invoices directly - captures all payment methods (table + direct status change)
    let total_paid_all_time: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(COALESCE(amount_paid, 0.0)), 0.0) FROM invoices WHERE invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND {}", company_filter),
        [], |row| row.get(0)
    ).unwrap_or(0.0);

    let total_invoiced: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(total_ttc), 0.0) FROM invoices WHERE invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND {}", company_filter),
        [], |row| row.get(0)
    ).unwrap_or(0.0);
    
    let total_receivables = total_invoiced - total_paid_all_time + initial_debt;

    // How many distinct invoices actually carry that outstanding balance —
    // same all-time, no-date-filter scope as total_receivables above, for
    // the Dashboard's "Reste à Recouvrer" card subtext ("X factures avec
    // solde restant").
    let outstanding_invoice_count: i64 = conn.query_row(
        &format!("SELECT COUNT(*) FROM invoices WHERE invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND total_ttc > COALESCE(amount_paid, 0.0) AND {}", company_filter),
        [], |row| row.get(0)
    ).unwrap_or(0);

    // 4. Period Revenue: use amount_paid from invoices (captures both payment table records AND direct status changes)
    let revenue: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(COALESCE(amount_paid, 0.0)), 0.0) 
                  FROM invoices 
                  WHERE invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND {}", invoice_date_filter),
        [],
        |row| row.get(0)
    ).unwrap_or(0.0);

    // Period Accrual Unpaid (Invoices issued in period that are still unpaid)
    let unpaid: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(CASE WHEN (total_ttc - amount_paid) > 0 THEN (total_ttc - amount_paid) ELSE 0.0 END), 0.0)
                  FROM invoices 
                  WHERE invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND {}", invoice_date_filter),
        [], |row| row.get(0)
    ).unwrap_or(0.0);

    let invoice_count: i64 = conn.query_row(
        &format!("SELECT COUNT(*) FROM invoices WHERE invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND {}", invoice_date_filter),
        [], |row| row.get(0)
    ).unwrap_or(0);

    // 5. Cumulative Totals (HT, TTC, TVA, Timbre)
    let sales_cumulatives: SalesCumulativeStats = conn.query_row(
        &format!("SELECT 
                    COALESCE(SUM(subtotal_ht), 0.0), 
                    COALESCE(SUM(total_ttc), 0.0), 
                    COALESCE(SUM(tva_amount), 0.0), 
                    COALESCE(SUM(timbre), 0.0)
                  FROM invoices 
                  WHERE invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND {}", invoice_date_filter),
        [],
        |row| Ok(SalesCumulativeStats {
            total_ht: row.get(0)?,
            total_ttc: row.get(1)?,
            total_tva: row.get(2)?,
            total_timbre: row.get(3)?,
        })
    ).unwrap_or(SalesCumulativeStats {
        total_ht: 0.0,
        total_ttc: 0.0,
        total_tva: 0.0,
        total_timbre: 0.0,
    });

    // 6. Expenses
    let expenses: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(amount), 0.0) FROM expenses WHERE {}", expense_date_filter),
        [],
        |row| row.get(0)
    ).unwrap_or(0.0);

    let expense_count: i64 = conn.query_row(
        &format!("SELECT COUNT(*) FROM expenses WHERE {}", expense_date_filter),
        [],
        |row| row.get(0)
    ).unwrap_or(0);

    // Settled payroll for the same year/month window — Charges Réelles and
    // Trésorerie are meant to read as total real cash outflow, and salaries
    // are real spending the `expenses` table never captures (payroll lives
    // in its own table). Scoped to `paid = 1` only (a draft run isn't money
    // out the door yet); payroll_runs has no company_id of its own, so it's
    // scoped via its employee's company instead.
    let mut payroll_period_filter = format!(
        "pr.paid = 1 AND substr(pr.month, 1, 4) = '{}' AND e.company_id = '{}'",
        target_year, company_id.replace('\'', "''")
    );
    if let Some(ref m_list) = months {
        if !m_list.is_empty() {
            let padded_months: Vec<String> = m_list.iter().map(|m| {
                if m.len() == 1 { format!("0{}", m) } else { m.clone() }
            }).collect();
            let months_str = padded_months.iter().map(|m| format!("'{}'", m)).collect::<Vec<_>>().join(",");
            payroll_period_filter.push_str(&format!(" AND substr(pr.month, 6, 2) IN ({})", months_str));
        }
    }
    let paid_payroll: f64 = conn.query_row(
        &format!(
            "SELECT COALESCE(SUM(pr.net_a_payer), 0.0) FROM payroll_runs pr JOIN employees e ON e.id = pr.employee_id WHERE {}",
            payroll_period_filter
        ),
        [],
        |row| row.get(0)
    ).unwrap_or(0.0);

    // Cash-basis total charges the dashboard actually shows (Charges
    // Réelles / Trésorerie below) — logged expenses plus settled payroll.
    // Kept distinct from the bare `expenses` above, which net_profit_ht and
    // expense_count still use on purpose: those describe the `expenses`
    // table specifically (a row count, an HT operating margin against
    // manually logged charges), not "all cash out".
    let total_charges = expenses + paid_payroll;

    // Bénéfice Net — unified with Charges Réelles/Trésorerie above: same
    // `revenue - total_charges` formula, so all three cash-basis metrics on
    // the dashboard move together instead of Bénéfice Net quietly excluding
    // payroll while the other two counted it. `revenue_ht` is kept only as
    // the denominator for margin_percentage_ht below (unchanged) and for
    // the separate "Chiffre d'Affaires HT" metric cell elsewhere.
    let revenue_ht = sales_cumulatives.total_ht;
    let net_profit_ht = revenue - total_charges;
    let margin_percentage_ht = if revenue_ht > 0.0 { (net_profit_ht / revenue_ht) * 100.0 } else { 0.0 };

    // 6. Growth (using amount_paid from invoices)
    let prev_year = target_year - 1;
    let prev_revenue: f64 = if is_daily_view {
         if let Some(ref m_list) = months {
             let current_month = m_list[0].parse::<i32>().unwrap_or(1);
             let (prev_y, prev_m) = if current_month == 1 { 
                 (prev_year, 12) 
             } else { 
                 (target_year, current_month - 1) 
             };
             let prev_inv_filter = format!("strftime('%Y', invoice_date) = '{}' AND strftime('%m', invoice_date) = '{:02}' AND {}", prev_y, prev_m, company_filter);
             conn.query_row(
                 &format!("SELECT COALESCE(SUM(COALESCE(amount_paid, 0.0)), 0.0) 
                           FROM invoices 
                           WHERE invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND {}", prev_inv_filter),
                [],
                |row| row.get(0)
            ).unwrap_or(0.0)
         } else { 0.0 }
    } else {
        let mut prev_inv_filter = format!("strftime('%Y', invoice_date) = '{}' AND {}", prev_year, company_filter);
         if let Some(ref m_list) = months {
            if !m_list.is_empty() {
                 let padded_months: Vec<String> = m_list.iter().map(|m| {
                    if m.len() == 1 { format!("0{}", m) } else { m.clone() }
                }).collect();
                let months_str = padded_months.iter().map(|m| format!("'{}'", m)).collect::<Vec<_>>().join(",");
                prev_inv_filter.push_str(&format!(" AND strftime('%m', invoice_date) IN ({})", months_str));
            }
        }
        conn.query_row(
            &format!("SELECT COALESCE(SUM(COALESCE(amount_paid, 0.0)), 0.0) 
                      FROM invoices 
                      WHERE invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND {}", prev_inv_filter),
            [],
            |row| row.get(0)
        ).unwrap_or(0.0)
    };

    let growth = if prev_revenue > 0.0 {
        ((revenue - prev_revenue) / prev_revenue) * 100.0
    } else if revenue > 0.0 {
        100.0
    } else {
        0.0
    };

    // 7. Monthly/Daily Data (Cash Basis)
    let mut monthly_data = Vec::new();
    let mut daily_data = Vec::new();

    if is_daily_view {
        // Daily view: group actual cash receipts by the day they were
        // collected (payments.payment_date), not by invoice_date — a
        // payment can land in a different month than the invoice it
        // settles, and this chart is meant to show real cash flow.
        let mut stmt = conn.prepare(&format!(
            "SELECT strftime('%d', p.payment_date) as day, SUM(p.amount) as rev
             FROM payments p
             JOIN invoices i ON p.invoice_id = i.id
             WHERE i.invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND {}
             GROUP BY day ORDER BY day",
             payment_date_filter
        )).map_err(|e| e.to_string())?;
        
        let daily_revenues: std::collections::HashMap<String, f64> = stmt.query_map([], |row| {
             Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
        }).unwrap().map(|r| r.unwrap()).collect();

        let mut stmt_exp = conn.prepare(&format!(
            "SELECT strftime('%d', expense_date) as day, SUM(amount) as exp 
             FROM expenses 
             WHERE {} 
             GROUP BY day", 
             expense_date_filter
        )).map_err(|e| e.to_string())?;
        
        let daily_expenses: std::collections::HashMap<String, f64> = stmt_exp.query_map([], |row| {
             Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
        }).unwrap().map(|r| r.unwrap()).collect();
        
        for i in 1..=31 {
            let day_key = format!("{:02}", i);
            let rev = *daily_revenues.get(&day_key).unwrap_or(&0.0);
            let exp = *daily_expenses.get(&day_key).unwrap_or(&0.0);
            daily_data.push(TimePointStats {
                label: i.to_string(),
                revenue: rev,
                expenses: exp,
                profit: rev - exp,
                expenses_only: exp,
                payroll_amount: 0.0,
            });
        }
    } else {
        for i in 1..=12 {
            let m_str = format!("{:02}", i);
            
            if let Some(ref m_list) = months {
                if !m_list.is_empty() {
                     let padded_months: Vec<String> = m_list.iter().map(|m| {
                        if m.len() == 1 { format!("0{}", m) } else { m.clone() }
                    }).collect();
                    if !padded_months.contains(&m_str) {
                        continue;
                    }
                }
            }

            // Cash actually collected this month — grouped by
            // payments.payment_date, not by the invoice's own invoice_date,
            // since a payment can (and often does) land in a later month
            // than the invoice that was issued.
            let m_pay_filter = format!(
                "strftime('%Y', p.payment_date) = '{}' AND strftime('%m', p.payment_date) = '{}' AND i.company_id = '{}'",
                target_year, m_str, company_id.replace('\'', "''")
            );
            let m_exp_filter = format!("strftime('%Y', expense_date) = '{}' AND strftime('%m', expense_date) = '{}' AND {}", target_year, m_str, company_filter);

            let m_rev: f64 = conn.query_row(
                &format!(
                    "SELECT COALESCE(SUM(p.amount), 0.0)
                     FROM payments p
                     JOIN invoices i ON p.invoice_id = i.id
                     WHERE i.invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND {}",
                    m_pay_filter
                ),
                [], |row| row.get(0)
            ).unwrap_or(0.0);
            
            let m_exp_only: f64 = conn.query_row(
                &format!("SELECT COALESCE(SUM(amount), 0.0) FROM expenses WHERE {}", m_exp_filter),
                [], |row| row.get(0)
            ).unwrap_or(0.0);

            // Same reasoning as the yearly total_charges above: fold in
            // this month's settled payroll so the chart bars actually sum
            // to the headline Charges Réelles/Trésorerie figures instead
            // of quietly excluding salaries the yearly number now counts.
            let m_payroll: f64 = conn.query_row(
                &format!(
                    "SELECT COALESCE(SUM(pr.net_a_payer), 0.0) FROM payroll_runs pr JOIN employees e ON e.id = pr.employee_id WHERE pr.paid = 1 AND pr.month = '{}-{}' AND e.company_id = '{}'",
                    target_year, m_str, company_id.replace('\'', "''")
                ),
                [], |row| row.get(0)
            ).unwrap_or(0.0);
            let m_exp = m_exp_only + m_payroll;

            monthly_data.push(TimePointStats {
                label: format!("{}-{}", target_year, m_str),
                revenue: m_rev,
                expenses: m_exp,
                profit: m_rev - m_exp,
                expenses_only: m_exp_only,
                payroll_amount: m_payroll,
            });
        }

        // Manual-verification aid (per the request that asked for this) —
        // one line per month so the year's numbers can be eyeballed against
        // the DB before trusting the chart's rendering of them. Goes to the
        // `tauri dev` process's own stdout/log file, not the browser console.
        eprintln!("[dashboard] monthly breakdown for {}:", target_year);
        for m in &monthly_data {
            eprintln!(
                "  {} | revenue={:.2} expenses_only={:.2} payroll={:.2} total_charges={:.2} profit={:.2}",
                m.label, m.revenue, m.expenses_only, m.payroll_amount, m.expenses, m.profit
            );
        }
    }

    // 8. Product Stats (Keep invoice_date as this is a production/sales report)
    let mut prod_query = format!(
        "SELECT p.id, p.name, p.code, SUM(ii.quantity), SUM(ii.amount)
         FROM invoice_items ii
         JOIN invoices i ON ii.invoice_id = i.id
         JOIN products p ON ii.product_id = p.id
         WHERE i.invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND i.{}", company_filter
    );
    if let Some(ref m_list) = months {
        if !m_list.is_empty() {
             let padded_months: Vec<String> = m_list.iter().map(|m| {
                if m.len() == 1 { format!("0{}", m) } else { m.clone() }
            }).collect();
            let months_str = padded_months.iter().map(|m| format!("'{}'", m)).collect::<Vec<_>>().join(",");
            prod_query.push_str(&format!(" AND strftime('%Y', i.invoice_date) = '{}' AND strftime('%m', i.invoice_date) IN ({})", target_year, months_str));
        } else {
             prod_query.push_str(&format!(" AND strftime('%Y', i.invoice_date) = '{}'", target_year));
        }
    } else {
         prod_query.push_str(&format!(" AND strftime('%Y', i.invoice_date) = '{}'", target_year));
    }
    prod_query.push_str(" GROUP BY p.id ORDER BY SUM(ii.amount) DESC");

    let mut stmt_prod = conn.prepare(&prod_query).map_err(|e| e.to_string())?;
    let product_stats = stmt_prod.query_map([], |row| {
         Ok(ProductSalesStat {
            product_id: row.get(0)?,
            product_name: row.get(1)?,
            product_code: row.get(2)?,
            total_quantity: row.get(3)?,
            total_amount: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut final_prod_stats = Vec::new();
    for p in product_stats {
        final_prod_stats.push(p.map_err(|e| e.to_string())?);
    }

    Ok(DashboardStats {
        current_month: PeriodStats {
            revenue: 0.0,
            expenses: 0.0,
            profit: 0.0,
        },
        yearly: PeriodStats {
            revenue,
            expenses: total_charges,
            profit: revenue - total_charges,
        },
        payments: PaymentStats {
            paid: revenue,
            unpaid,
            initial_debt,
            total_receivables,
            outstanding_invoice_count,
        },
        sales_cumulatives,
        monthly_data,
        daily_data,
        product_stats: final_prod_stats,
        growth,
        invoice_count,
        is_month_view: is_daily_view,
        revenue_ht,
        expense_count,
        net_profit_ht,
        margin_percentage_ht,
        outstanding_receivables: unpaid,
    })
}

// ============= PRODUCTION LOGS =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProductionLog {
    pub id: String,
    pub date: String,
    pub extraction: f64,
    pub waste: f64,
    pub merchant_product: f64,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateProductionLogData {
    pub date: String,
    pub extraction: Option<f64>,
    pub waste: Option<f64>,
    pub merchant_product: Option<f64>,
    pub notes: Option<String>,
}

#[tauri::command]
pub fn get_production_logs(
    db: State<'_, Mutex<Connection>>, 
    month: Option<i64>, 
    year: Option<i64>
) -> Result<Vec<ProductionLog>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    
    // Construct query based on filters
    let mut query = "SELECT id, date, extraction, waste, merchant_product, notes, created_at, updated_at FROM production_logs".to_string();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    let mut conditions = Vec::new();

    // If year/month provided, filter by date string "YYYY-MM-DD"
    if let Some(y) = year {
        conditions.push("strftime('%Y', date) = ?".to_string());
        params.push(Box::new(y.to_string()));
    }
    
    if let Some(m) = month {
        conditions.push("strftime('%m', date) = ?".to_string());
        params.push(Box::new(format!("{:02}", m)));
    }
    
    if !conditions.is_empty() {
        query.push_str(" WHERE ");
        query.push_str(&conditions.join(" AND "));
    }
    
    query.push_str(" ORDER BY date DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let rows = stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
        Ok(ProductionLog {
            id: row.get(0)?,
            date: row.get(1)?,
            extraction: row.get(2)?,
            waste: row.get(3)?,
            merchant_product: row.get(4)?,
            notes: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn create_production_log(db: State<'_, Mutex<Connection>>, data: CreateProductionLogData) -> Result<ProductionLog, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    conn.execute(
        "INSERT INTO production_logs (id, date, extraction, waste, merchant_product, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            data.date,
            data.extraction.unwrap_or(0.0),
            data.waste.unwrap_or(0.0),
            data.merchant_product.unwrap_or(0.0),
            data.notes,
            now,
            now,
        ],
    ).map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "UPDATE", "PRODUCTION", Some(&id), &format!("Log de production mis à jour: {}", data.date));
    
    let mut stmt = conn.prepare("SELECT * FROM production_logs WHERE id = ?1").map_err(|e| e.to_string())?;
    stmt.query_row(params![id], |row| {
        Ok(ProductionLog {
            id: row.get(0)?, date: row.get(1)?, extraction: row.get(2)?,
            waste: row.get(3)?, merchant_product: row.get(4)?, notes: row.get(5)?,
            created_at: row.get(6)?, updated_at: row.get(7)?,
        })
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_production_log(db: State<'_, Mutex<Connection>>, id: String, data: CreateProductionLogData) -> Result<ProductionLog, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    
    conn.execute(
        "UPDATE production_logs SET date = ?2, extraction = ?3, waste = ?4, merchant_product = ?5, notes = ?6, updated_at = ?7 WHERE id = ?1",
        params![
            id,
            data.date,
            data.extraction.unwrap_or(0.0),
            data.waste.unwrap_or(0.0),
            data.merchant_product.unwrap_or(0.0),
            data.notes,
            now,
        ],
    ).map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "UPDATE", "PRODUCTION", Some(&id), &format!("Log de production mis à jour: {}", data.date));
    
    let mut stmt = conn.prepare("SELECT * FROM production_logs WHERE id = ?1").map_err(|e| e.to_string())?;
    stmt.query_row(params![id], |row| {
        Ok(ProductionLog {
            id: row.get(0)?, date: row.get(1)?, extraction: row.get(2)?,
            waste: row.get(3)?, merchant_product: row.get(4)?, notes: row.get(5)?,
            created_at: row.get(6)?, updated_at: row.get(7)?,
        })
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_production_log(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    println!("backend: deleting production log id: {:?}", id);
    let conn = db.lock().map_err(|e| e.to_string())?;
    // Trim ID to handle whitespace issues
    let trimmed_id = id.trim();
    let count = conn.execute("DELETE FROM production_logs WHERE id = ?1", params![trimmed_id]).map_err(|e| e.to_string())?;
    println!("backend: deleted {} rows for id: {}", count, id);
    if count == 0 {
        return Err("Item not found or already deleted".to_string());
    }
    Ok(())
}
// ============= EMPLOYEES =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Employee {
    pub id: String,
    pub company_id: Option<String>,
    pub name: String,
    pub role: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub is_active: Option<bool>,
    pub created_at: String,
    pub updated_at: String,
    // omada-agency branch only — HR/payroll fields.
    pub base_salary: Option<f64>,
    pub hire_date: Option<String>,
    pub contract_type: Option<String>,
    pub rib: Option<String>,
    /// The attendance device's own numeric employee ID (e.g. ZKTeco PIN) —
    /// how imported punches get matched to this employee. Not our UUID.
    pub external_code: Option<String>,
    /// Relative to app_data_dir (e.g. "employee_photos/<id>.jpg"), never
    /// absolute — see migrate_employee_photos_and_documents_if_needed.
    pub photo_path: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateEmployeeData {
    pub company_id: String,
    pub name: String,
    pub role: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub base_salary: Option<f64>,
    pub hire_date: Option<String>,
    pub contract_type: Option<String>,
    pub rib: Option<String>,
    pub external_code: Option<String>,
}

fn row_to_employee(row: &rusqlite::Row) -> rusqlite::Result<Employee> {
    Ok(Employee {
        id: row.get("id")?,
        company_id: row.get("company_id").ok(),
        name: row.get("name")?,
        role: row.get("role")?,
        email: row.get("email")?,
        phone: row.get("phone")?,
        address: row.get("address")?,
        is_active: row.get::<_, Option<i64>>("is_active")?.map(|v| v != 0),
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        base_salary: row.get("base_salary").ok(),
        hire_date: row.get("hire_date").ok(),
        contract_type: row.get("contract_type").ok(),
        rib: row.get("rib").ok(),
        external_code: row.get("external_code").ok(),
        photo_path: row.get("photo_path").ok(),
    })
}

#[tauri::command]
pub fn get_employees(db: State<'_, Mutex<Connection>>, company_id: String) -> Result<Vec<Employee>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM employees WHERE company_id = ?1 ORDER BY name").map_err(|e| e.to_string())?;
    let employees = stmt.query_map(params![company_id], row_to_employee).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for emp in employees {
        result.push(emp.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn create_employee(db: State<'_, Mutex<Connection>>, data: CreateEmployeeData) -> Result<Employee, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO employees (id, company_id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            id,
            data.company_id,
            data.name,
            data.role,
            data.email,
            data.phone,
            data.address,
            1i64, // is_active
            now,
            now,
            data.base_salary,
            data.hire_date,
            data.contract_type,
            data.rib,
            data.external_code,
        ],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "EMPLOYEE", Some(&id), &format!("Nouvel employé créé: {}", data.name));
    backfill_punch_records_for_external_code(&conn, &id, data.external_code.as_deref())?;

    Ok(Employee {
        id,
        company_id: Some(data.company_id),
        name: data.name,
        role: data.role,
        email: data.email,
        phone: data.phone,
        address: data.address,
        is_active: Some(true),
        created_at: now.clone(),
        updated_at: now,
        base_salary: data.base_salary,
        hire_date: data.hire_date,
        contract_type: data.contract_type,
        rib: data.rib,
        external_code: data.external_code,
        photo_path: None,
    })
}

/// Same shape as CreateEmployeeData minus company_id — the frontend never
/// sends it on update (an employee doesn't change company), but
/// CreateEmployeeData::company_id isn't Optional, so reusing that struct
/// here made every update request fail deserialization with "missing field
/// `company_id`" (the same bug class fixed earlier for update_client).
#[derive(Deserialize)]
pub struct UpdateEmployeeData {
    pub name: String,
    pub role: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub base_salary: Option<f64>,
    pub hire_date: Option<String>,
    pub contract_type: Option<String>,
    pub rib: Option<String>,
    pub external_code: Option<String>,
    pub is_active: Option<bool>,
}

#[tauri::command]
pub fn update_employee(db: State<'_, Mutex<Connection>>, id: String, data: UpdateEmployeeData) -> Result<Employee, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE employees SET name = ?2, role = ?3, email = ?4, phone = ?5, address = ?6, updated_at = ?7, base_salary = ?8, hire_date = ?9, contract_type = ?10, rib = ?11, external_code = ?12, is_active = ?13 WHERE id = ?1",
        params![
            id,
            data.name,
            data.role,
            data.email,
            data.phone,
            data.address,
            now,
            data.base_salary,
            data.hire_date,
            data.contract_type,
            data.rib,
            data.external_code,
            data.is_active.unwrap_or(true),
        ],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "UPDATE", "EMPLOYEE", Some(&id), &format!("Employé mis à jour: {}", data.name));
    backfill_punch_records_for_external_code(&conn, &id, data.external_code.as_deref())?;

    conn.query_row("SELECT * FROM employees WHERE id = ?1", params![id], row_to_employee).map_err(|e| e.to_string())
}

/// Assigning/changing an employee's device ID retroactively claims any
/// already-imported punches for that code that were sitting unmapped —
/// no re-upload needed. Scoped to employee_id IS NULL so it never steals
/// punches already correctly attributed to someone else.
fn backfill_punch_records_for_external_code(conn: &Connection, employee_id: &str, external_code: Option<&str>) -> Result<(), String> {
    let Some(code) = external_code else { return Ok(()) };
    if code.is_empty() {
        return Ok(());
    }
    conn.execute(
        "UPDATE punch_records SET employee_id = ?1 WHERE external_code = ?2 AND employee_id IS NULL",
        params![employee_id, code],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_employee(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;

    // payments.employee_id ("Encaissé par") has no ON DELETE cascade — an
    // employee who ever collected a payment can't be silently deleted out
    // from under that record. payroll_runs/employee_advances/
    // employee_documents all DO cascade (they're owned-by-employee rows),
    // which is why only this one check is needed here.
    let payment_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM payments WHERE employee_id = ?1",
            params![id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if payment_count > 0 {
        let label = if payment_count == 1 { "paiement encaissé par cet employé" } else { "paiements encaissés par cet employé" };
        return Err(format!(
            "Impossible de supprimer cet employé : {} {}. Réassignez-les d'abord.",
            payment_count, label
        ));
    }

    // employee_documents cascades at the DB level, but that only removes
    // the rows — the actual files on disk (copied into app_data_dir by
    // set_employee_document, same convention as photos) would silently
    // orphan otherwise. Clean those up first, same pattern as
    // delete_employee_document. Same for the employee's own photo.
    let mut stmt = conn
        .prepare("SELECT file_path FROM employee_documents WHERE employee_id = ?1")
        .map_err(|e| e.to_string())?;
    let doc_paths: Vec<String> = stmt
        .query_map(params![id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    for rel in doc_paths {
        let _ = fs::remove_file(app_data_dir().join(&rel));
    }

    let photo_path: Option<String> = conn
        .query_row("SELECT photo_path FROM employees WHERE id = ?1", params![id], |row| row.get(0))
        .optional()
        .map_err(|e| e.to_string())?
        .flatten();
    if let Some(rel) = photo_path {
        let _ = fs::remove_file(app_data_dir().join(&rel));
    }

    conn.execute("DELETE FROM employees WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "DELETE", "EMPLOYEE", Some(&id), "Employé supprimé");
    Ok(())
}

// ============= EMPLOYEE PHOTO & DOCUMENTS (omada-agency branch only) =============
// Files are copied into app_data_dir (never referenced at their original
// picked location, so the app doesn't break if that file moves/is deleted).
// DB columns store paths RELATIVE to app_data_dir, resolved fresh here at
// call time — same convention as database.db/license.token, so a future
// app_data_dir change (reinstall, OS profile move) can't leave stale
// absolute paths behind.

static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Called once from lib.rs::run()'s setup(), alongside where the db path and
/// license::init() are resolved — same app_data_dir.
pub fn init_app_data_dir(dir: &Path) {
    let _ = APP_DATA_DIR.set(dir.to_path_buf());
}

fn app_data_dir() -> &'static PathBuf {
    APP_DATA_DIR
        .get()
        .expect("commands::init_app_data_dir() must run before any photo/document command is called")
}

#[tauri::command]
pub fn set_employee_photo(db: State<'_, Mutex<Connection>>, employee_id: String, source_path: String) -> Result<Employee, String> {
    crate::license::require_active_license()?;

    let img = image::open(&source_path).map_err(|e| format!("Impossible de lire l'image: {}", e))?;
    // Downscale-only (never upscales a smaller photo), longest edge capped
    // at 512px — plenty for every avatar size used in this app.
    let resized = img.thumbnail(512, 512);

    let photos_dir = app_data_dir().join("employee_photos");
    fs::create_dir_all(&photos_dir).map_err(|e| e.to_string())?;
    let dest = photos_dir.join(format!("{}.jpg", employee_id));
    // Always re-encoded to JPEG regardless of the source format, so the
    // filename (and the stored photo_path) never has to track the original
    // extension, and a re-upload cleanly overwrites the same file.
    let mut out_file = fs::File::create(&dest).map_err(|e| e.to_string())?;
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out_file, 85);
    encoder.encode_image(&resized).map_err(|e| format!("Impossible d'enregistrer l'image: {}", e))?;

    let relative_path = format!("employee_photos/{}.jpg", employee_id);
    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE employees SET photo_path = ?2, updated_at = ?3 WHERE id = ?1",
        params![employee_id, relative_path, now],
    ).map_err(|e| e.to_string())?;

    conn.query_row("SELECT * FROM employees WHERE id = ?1", params![employee_id], row_to_employee).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_employee_photo(db: State<'_, Mutex<Connection>>, employee_id: String) -> Result<Employee, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let existing_path: Option<String> = conn
        .query_row("SELECT photo_path FROM employees WHERE id = ?1", params![employee_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    if let Some(rel) = existing_path {
        let _ = fs::remove_file(app_data_dir().join(&rel));
    }

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE employees SET photo_path = NULL, updated_at = ?2 WHERE id = ?1",
        params![employee_id, now],
    ).map_err(|e| e.to_string())?;

    conn.query_row("SELECT * FROM employees WHERE id = ?1", params![employee_id], row_to_employee).map_err(|e| e.to_string())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmployeeDocument {
    pub id: String,
    pub employee_id: String,
    pub name: String,
    pub doc_type: Option<String>,
    /// Relative to app_data_dir, e.g. "employee_documents/<employee_id>/<doc_id>.pdf".
    pub file_path: String,
    pub created_at: String,
}

fn row_to_employee_document(row: &rusqlite::Row) -> rusqlite::Result<EmployeeDocument> {
    Ok(EmployeeDocument {
        id: row.get("id")?,
        employee_id: row.get("employee_id")?,
        name: row.get("name")?,
        doc_type: row.get("doc_type")?,
        file_path: row.get("file_path")?,
        created_at: row.get("created_at")?,
    })
}

/// Archival documents (CNI, diplôme, contrat...) — copied verbatim, unlike
/// the photo, since these are meant to preserve the original file exactly
/// (a PDF/DOCX/scan), not something to recompress.
#[tauri::command]
pub fn add_employee_document(
    db: State<'_, Mutex<Connection>>,
    employee_id: String,
    source_path: String,
    name: String,
    doc_type: Option<String>,
) -> Result<EmployeeDocument, String> {
    crate::license::require_active_license()?;

    let doc_id = Uuid::new_v4().to_string();
    let ext = Path::new(&source_path).extension().and_then(|e| e.to_str()).unwrap_or("");
    let file_name = if ext.is_empty() { doc_id.clone() } else { format!("{}.{}", doc_id, ext) };

    let dest_dir = app_data_dir().join("employee_documents").join(&employee_id);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let dest = dest_dir.join(&file_name);
    fs::copy(&source_path, &dest).map_err(|e| format!("Impossible de copier le fichier: {}", e))?;

    let relative_path = format!("employee_documents/{}/{}", employee_id, file_name);
    let now = chrono::Utc::now().to_rfc3339();
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO employee_documents (id, employee_id, name, doc_type, file_path, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![doc_id, employee_id, name, doc_type, relative_path, now],
    ).map_err(|e| e.to_string())?;

    conn.query_row("SELECT * FROM employee_documents WHERE id = ?1", params![doc_id], row_to_employee_document).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_employee_documents(db: State<'_, Mutex<Connection>>, employee_id: String) -> Result<Vec<EmployeeDocument>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM employee_documents WHERE employee_id = ?1 ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![employee_id], row_to_employee_document).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn delete_employee_document(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let file_path: Option<String> = conn
        .query_row("SELECT file_path FROM employee_documents WHERE id = ?1", params![id], |row| row.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    if let Some(rel) = file_path {
        let _ = fs::remove_file(app_data_dir().join(&rel));
    }

    conn.execute("DELETE FROM employee_documents WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize)]
pub struct EmployeeTaskWorkload {
    pub employee_id: String,
    pub employee_name: String,
    pub task_count: i64,
    pub photo_path: Option<String>,
}

/// Dashboard "Charge de travail par employé" chart. LEFT JOIN (not a GROUP
/// BY on project_tasks) so an active employee with zero currently-assigned
/// tasks still appears at count 0 — that's the "underutilized" half of the
/// signal the chart exists to show, and a plain grouped count on the tasks
/// table would silently omit them.
#[tauri::command]
pub fn get_employee_task_workload(db: State<'_, Mutex<Connection>>, company_id: String) -> Result<Vec<EmployeeTaskWorkload>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT e.id, e.name, COUNT(pt.id), e.photo_path
         FROM employees e
         LEFT JOIN project_tasks pt ON pt.assigned_resource_id = e.id AND pt.status != 'approuve'
         WHERE e.is_active = 1 AND e.company_id = ?1
         GROUP BY e.id, e.name, e.photo_path
         ORDER BY COUNT(pt.id) DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![company_id], |row| {
        Ok(EmployeeTaskWorkload {
            employee_id: row.get(0)?,
            employee_name: row.get(1)?,
            task_count: row.get(2)?,
            photo_path: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

// ============= HR / PAYROLL (omada-agency branch only) =============
// Attendance-derived absence + monthly payroll calculation. This agency's
// actual work week is hardcoded here (a confirmed, non-configurable
// business fact, not a setting): Saturday-Thursday full working days,
// Friday off entirely (Algeria's legal weekly rest day). Not part of the
// core Sordi product — see PROJECT_STATE.md.

fn parse_year_month(month: &str) -> Result<(i32, u32), String> {
    let parts: Vec<&str> = month.split('-').collect();
    if parts.len() != 2 {
        return Err("Format de mois invalide, attendu YYYY-MM".to_string());
    }
    let year: i32 = parts[0].parse().map_err(|_| "Année invalide".to_string())?;
    let month_num: u32 = parts[1].parse().map_err(|_| "Mois invalide".to_string())?;
    Ok((year, month_num))
}

fn days_in_month(year: i32, month: u32) -> u32 {
    let (next_year, next_month) = if month == 12 { (year + 1, 1) } else { (year, month + 1) };
    let first_of_next = chrono::NaiveDate::from_ymd_opt(next_year, next_month, 1).unwrap();
    let first_of_this = chrono::NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    (first_of_next - first_of_this).num_days() as u32
}

/// This agency's fixed work week (hardcoded per an explicit, confirmed
/// decision — not meant to be configurable): every working day (Sat-Thu) is
/// a full 1.0 day, no half-days. Friday is 0.0 (full day off). Kept as f64
/// (not integer) only because working_days_in_month/absence_days share this
/// type end-to-end — the values themselves are always whole numbers now.
fn day_weight(weekday: chrono::Weekday) -> f64 {
    match weekday {
        chrono::Weekday::Fri => 0.0,
        _ => 1.0,
    }
}

fn weighted_days_in_range(year: i32, month: u32, from_day: u32, through_day: u32) -> f64 {
    let mut total = 0.0;
    for day in from_day..=through_day {
        if let Some(date) = chrono::NaiveDate::from_ymd_opt(year, month, day) {
            total += day_weight(date.weekday());
        }
    }
    total
}

/// (working_days_in_month, absence_days) for one employee/month, both in the
/// same weighted day-equivalent unit so daily_rate * absence_days stays
/// internally consistent. Starts from hire_date if hired mid-month; never
/// counts days beyond "today" so a live/in-progress month isn't penalized
/// for days that haven't happened yet. "Absent" = zero punches that day —
/// any single punch counts as present, no clock-in/out pairing logic.
fn compute_absence_stats(
    conn: &Connection,
    employee_id: &str,
    year: i32,
    month: u32,
    hire_date: Option<&str>,
) -> Result<(f64, f64), String> {
    let last_day = days_in_month(year, month);

    let mut from_day: u32 = 1;
    if let Some(hd) = hire_date.and_then(parse_ymd) {
        if hd.year() == year && hd.month() == month {
            from_day = hd.day();
        } else if hd.year() > year || (hd.year() == year && hd.month() > month) {
            return Ok((0.0, 0.0)); // hired after this month entirely
        }
    }

    let today = chrono::Local::now().date_naive();
    let mut through_day = last_day;
    if today.year() == year && today.month() == month {
        through_day = through_day.min(today.day());
    }
    if through_day < from_day {
        return Ok((0.0, 0.0));
    }

    let working_days_in_month = weighted_days_in_range(year, month, from_day, through_day);

    let month_prefix = format!("{:04}-{:02}", year, month);
    let mut stmt = conn
        .prepare("SELECT punch_time FROM punch_records WHERE employee_id = ?1 AND punch_time LIKE ?2")
        .map_err(|e| e.to_string())?;
    let pattern = format!("{}%", month_prefix);
    let punch_days: std::collections::HashSet<u32> = stmt
        .query_map(params![employee_id, pattern], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .filter_map(|s| parse_ymd(&s).map(|d| d.day()))
        .collect();

    let mut absence_days = 0.0;
    for day in from_day..=through_day {
        if punch_days.contains(&day) {
            continue;
        }
        if let Some(date) = chrono::NaiveDate::from_ymd_opt(year, month, day) {
            absence_days += day_weight(date.weekday());
        }
    }

    Ok((working_days_in_month, absence_days))
}

const ABSENCE_FLAG_THRESHOLD: f64 = 3.0;

#[derive(Serialize)]
pub struct EmployeeAbsenceStats {
    pub employee_id: String,
    pub month: String,
    pub working_days_in_month: f64,
    pub absence_days: f64,
    pub flagged: bool,
}

/// Live absence stats for one employee/month — usable for an in-progress
/// month (dashboard, employee profile) independent of whether payroll has
/// been run yet. run_payroll uses the same compute_absence_stats() and
/// snapshots the result instead of calling this.
#[tauri::command]
pub fn get_employee_absence_stats(db: State<'_, Mutex<Connection>>, employee_id: String, month: String) -> Result<EmployeeAbsenceStats, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let hire_date: Option<String> = conn
        .query_row("SELECT hire_date FROM employees WHERE id = ?1", params![employee_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let (year, month_num) = parse_year_month(&month)?;
    let (working_days_in_month, absence_days) = compute_absence_stats(&conn, &employee_id, year, month_num, hire_date.as_deref())?;

    Ok(EmployeeAbsenceStats {
        employee_id,
        month,
        working_days_in_month,
        absence_days,
        flagged: absence_days > ABSENCE_FLAG_THRESHOLD,
    })
}

/// Official shift start. No expected-arrival setting exists yet anywhere in
/// the app, so this is a fixed placeholder — surface it as a Réglages field
/// if the agency's actual start time differs.
const SHIFT_START_MINUTES: i64 = 8 * 60 + 30; // 08:30

/// Tolérance de retard: a first punch within this many minutes of
/// SHIFT_START_MINUTES still counts as Présent — only strictly more than
/// this many minutes late flips the day to En retard.
const LATE_GRACE_PERIOD_MINUTES: i64 = 10;

/// Parses "HH:MM:SS" (or "HH:MM") into minutes since midnight.
fn time_to_minutes(time: &str) -> Option<i64> {
    let mut parts = time.split(':');
    let hours: i64 = parts.next()?.parse().ok()?;
    let minutes: i64 = parts.next()?.parse().ok()?;
    Some(hours * 60 + minutes)
}

#[derive(Serialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DayAttendanceStatus {
    Present,
    Late,
    Absent,
    /// Also used for days with no meaningful attendance data (before hire,
    /// or not yet elapsed in an in-progress month) — visually identical to
    /// a day off, which is the right muted treatment for "nothing to show".
    Weekend,
}

#[derive(Serialize)]
pub struct DayAttendance {
    pub date: String,
    pub status: DayAttendanceStatus,
    pub arrival_time: Option<String>,
    /// Minutes past SHIFT_START_MINUTES — only set when status is Late (i.e.
    /// strictly beyond the grace period), for display like "+17 min".
    pub late_minutes: Option<i64>,
}

#[derive(Serialize)]
pub struct EmployeeDailyAttendance {
    pub employee_id: String,
    pub month: String,
    pub days: Vec<DayAttendance>,
    pub present_count: i64,
    pub late_count: i64,
    pub absent_count: i64,
}

/// Day-by-day attendance for one employee/month, for the Tracker strip.
/// Mirrors compute_absence_stats's rules (Friday off, hire-date floor,
/// never judging days beyond "today") but keeps the per-day detail instead
/// of folding it into a single absence count.
#[tauri::command]
pub fn get_employee_daily_attendance(
    db: State<'_, Mutex<Connection>>,
    employee_id: String,
    month: String,
) -> Result<EmployeeDailyAttendance, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let hire_date: Option<String> = conn
        .query_row("SELECT hire_date FROM employees WHERE id = ?1", params![employee_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let (year, month_num) = parse_year_month(&month)?;
    let last_day = days_in_month(year, month_num);

    let today = chrono::Local::now().date_naive();
    let mut through_day = last_day;
    if today.year() == year && today.month() == month_num {
        through_day = through_day.min(today.day());
    }

    let mut from_day: u32 = 1;
    if let Some(hd) = hire_date.as_deref().and_then(parse_ymd) {
        if hd.year() == year && hd.month() == month_num {
            from_day = hd.day();
        } else if hd.year() > year || (hd.year() == year && hd.month() > month_num) {
            from_day = last_day + 1; // hired after this month entirely — no days count
        }
    }

    let month_prefix = format!("{:04}-{:02}", year, month_num);
    let mut stmt = conn
        .prepare("SELECT punch_time FROM punch_records WHERE employee_id = ?1 AND punch_time LIKE ?2")
        .map_err(|e| e.to_string())?;
    let pattern = format!("{}%", month_prefix);
    let punch_times: Vec<String> = stmt
        .query_map(params![employee_id, pattern], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut first_punch_by_day: std::collections::HashMap<u32, String> = std::collections::HashMap::new();
    for pt in &punch_times {
        if let Some(date) = parse_ymd(&pt) {
            let day = date.day();
            let time_part = if pt.len() >= 19 { pt[11..19].to_string() } else { String::new() };
            first_punch_by_day
                .entry(day)
                .and_modify(|existing| {
                    if time_part < *existing {
                        *existing = time_part.clone();
                    }
                })
                .or_insert(time_part);
        }
    }

    let mut days = Vec::with_capacity(last_day as usize);
    let mut present_count = 0i64;
    let mut late_count = 0i64;
    let mut absent_count = 0i64;

    for day in 1..=last_day {
        let date = chrono::NaiveDate::from_ymd_opt(year, month_num, day).ok_or("Date invalide")?;
        let date_str = date.format("%Y-%m-%d").to_string();

        if date.weekday() == chrono::Weekday::Fri || day < from_day || day > through_day {
            days.push(DayAttendance { date: date_str, status: DayAttendanceStatus::Weekend, arrival_time: None, late_minutes: None });
            continue;
        }

        match first_punch_by_day.get(&day) {
            Some(time) => {
                let minutes_past_start = time_to_minutes(time).map(|m| m - SHIFT_START_MINUTES).unwrap_or(0);
                if minutes_past_start > LATE_GRACE_PERIOD_MINUTES {
                    late_count += 1;
                    days.push(DayAttendance {
                        date: date_str,
                        status: DayAttendanceStatus::Late,
                        arrival_time: Some(time.clone()),
                        late_minutes: Some(minutes_past_start),
                    });
                } else {
                    present_count += 1;
                    days.push(DayAttendance { date: date_str, status: DayAttendanceStatus::Present, arrival_time: Some(time.clone()), late_minutes: None });
                }
            }
            None => {
                absent_count += 1;
                days.push(DayAttendance { date: date_str, status: DayAttendanceStatus::Absent, arrival_time: None, late_minutes: None });
            }
        }
    }

    Ok(EmployeeDailyAttendance { employee_id, month, days, present_count, late_count, absent_count })
}

// ---- Attendance / punch import ----

#[derive(Deserialize)]
pub struct PunchImportRow {
    pub external_code: String,
    pub punch_time: String,
}

#[derive(Serialize)]
pub struct PunchImportSummary {
    pub imported: i64,
    pub skipped_duplicates: i64,
    pub invalid_format: i64,
    pub unmatched_employee_codes: Vec<String>,
}

/// Idempotent regardless of whether the export is month-specific or the
/// full cumulative history since company start: (employee_id, punch_time)
/// is a UNIQUE constraint at the DB level, INSERT OR IGNORE makes a repeat
/// import of the same punch a silent no-op every time.
#[tauri::command]
pub fn import_punch_records(db: State<'_, Mutex<Connection>>, company_id: String, rows: Vec<PunchImportRow>) -> Result<PunchImportSummary, String> {
    crate::license::require_active_license()?;

    let mut conn = db.lock().map_err(|e| e.to_string())?;

    let mut code_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    {
        let mut stmt = conn
            .prepare("SELECT id, external_code FROM employees WHERE external_code IS NOT NULL AND external_code != '' AND company_id = ?1")
            .map_err(|e| e.to_string())?;
        let mapped = stmt
            .query_map(params![company_id], |row| Ok((row.get::<_, String>(1)?, row.get::<_, String>(0)?)))
            .map_err(|e| e.to_string())?;
        for m in mapped {
            let (code, id) = m.map_err(|e| e.to_string())?;
            code_map.insert(code, id);
        }
    }

    let mut imported = 0i64;
    let mut skipped = 0i64;
    let mut invalid_format = 0i64;
    let mut unmatched: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Every row is kept regardless of mapping status — an unrecognized
    // device code is the expected normal case (an employee not yet
    // assigned a device ID), never a reason to drop data. employee_id is
    // NULL for those; get_unmapped_device_codes() surfaces them, and
    // mapping the code later (create/update_employee) backfills these rows
    // retroactively instead of requiring a re-import.
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for row in rows {
        // Defense in depth: the frontend parser normalizes every timestamp
        // to this exact shape before sending it, but a punch_time that
        // doesn't parse as "YYYY-MM-DD HH:MM:SS" would silently never match
        // any month's "LIKE 'YYYY-MM%'" attendance/salary query if it slipped
        // through anyway — reject it here instead of storing dead data.
        if parse_ymd(&row.punch_time).is_none() {
            invalid_format += 1;
            continue;
        }
        let employee_id = code_map.get(&row.external_code);
        if employee_id.is_none() {
            unmatched.insert(row.external_code.clone());
        }
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        let changed = tx
            .execute(
                "INSERT OR IGNORE INTO punch_records (id, external_code, employee_id, punch_time, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, row.external_code, employee_id, row.punch_time, now],
            )
            .map_err(|e| e.to_string())?;
        if changed > 0 {
            imported += 1;
        } else {
            skipped += 1;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;

    let _ = log_activity(
        &conn,
        "IMPORT",
        "PUNCH_RECORDS",
        None,
        &format!("{} pointages importés, {} doublons ignorés", imported, skipped),
    );

    Ok(PunchImportSummary {
        imported,
        skipped_duplicates: skipped,
        invalid_format,
        unmatched_employee_codes: unmatched.into_iter().collect(),
    })
}

#[derive(Serialize)]
pub struct UnmappedDeviceCode {
    pub external_code: String,
    pub punch_count: i64,
    pub last_punch_time: String,
}

/// Device codes still waiting to be assigned to an employee (create/update
/// with a matching external_code backfills these automatically). Optionally
/// scoped to one "YYYY-MM" month — the Payroll page's warning banner needs
/// this filtered to the month currently being worked on, not an all-time
/// count that never changes when the month selector does.
#[tauri::command]
pub fn get_unmapped_device_codes(db: State<'_, Mutex<Connection>>, month: Option<String>) -> Result<Vec<UnmappedDeviceCode>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let query = if month.is_some() {
        "SELECT external_code, COUNT(*), MAX(punch_time) FROM punch_records
         WHERE employee_id IS NULL AND punch_time LIKE ?1 GROUP BY external_code ORDER BY external_code"
    } else {
        "SELECT external_code, COUNT(*), MAX(punch_time) FROM punch_records
         WHERE employee_id IS NULL GROUP BY external_code ORDER BY external_code"
    };
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    let row_mapper = |row: &rusqlite::Row| {
        Ok(UnmappedDeviceCode {
            external_code: row.get(0)?,
            punch_count: row.get(1)?,
            last_punch_time: row.get(2)?,
        })
    };
    let rows = match &month {
        Some(m) => {
            let pattern = format!("{}%", m);
            stmt.query_map(params![pattern], row_mapper).map_err(|e| e.to_string())?
        }
        None => stmt.query_map([], row_mapper).map_err(|e| e.to_string())?,
    };
    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

// ---- Employee advances ----

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmployeeAdvance {
    pub id: String,
    pub employee_id: String,
    pub amount: f64,
    pub date_taken: String,
    pub month_to_deduct: String,
    pub deducted: bool,
    pub deducted_in_payroll_run_id: Option<String>,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateEmployeeAdvanceData {
    pub employee_id: String,
    pub amount: f64,
    pub date_taken: String,
}

fn row_to_employee_advance(row: &rusqlite::Row) -> rusqlite::Result<EmployeeAdvance> {
    Ok(EmployeeAdvance {
        id: row.get(0)?,
        employee_id: row.get(1)?,
        amount: row.get(2)?,
        date_taken: row.get(3)?,
        month_to_deduct: row.get(4)?,
        deducted: row.get::<_, i64>(5)? != 0,
        deducted_in_payroll_run_id: row.get(6)?,
        created_at: row.get(7)?,
    })
}

const EMPLOYEE_ADVANCE_COLUMNS: &str = "id, employee_id, amount, date_taken, month_to_deduct, deducted, deducted_in_payroll_run_id, created_at";

/// "An advance taken in August is deducted in full from September's
/// payroll" — month_to_deduct is always date_taken's month + 1.
fn next_month_str(date_taken: &str) -> Result<String, String> {
    let date = parse_ymd(date_taken).ok_or_else(|| "Date invalide".to_string())?;
    let (y, m) = if date.month() == 12 { (date.year() + 1, 1) } else { (date.year(), date.month() + 1) };
    Ok(format!("{:04}-{:02}", y, m))
}

#[tauri::command]
pub fn create_employee_advance(db: State<'_, Mutex<Connection>>, data: CreateEmployeeAdvanceData) -> Result<EmployeeAdvance, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let month_to_deduct = next_month_str(&data.date_taken)?;

    conn.execute(
        "INSERT INTO employee_advances (id, employee_id, amount, date_taken, month_to_deduct, deducted, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)",
        params![id, data.employee_id, data.amount, data.date_taken, month_to_deduct, now],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "EMPLOYEE_ADVANCE", Some(&id), &format!("Avance de {} accordée", data.amount));

    Ok(EmployeeAdvance {
        id,
        employee_id: data.employee_id,
        amount: data.amount,
        date_taken: data.date_taken,
        month_to_deduct,
        deducted: false,
        deducted_in_payroll_run_id: None,
        created_at: now,
    })
}

#[tauri::command]
pub fn get_employee_advances(db: State<'_, Mutex<Connection>>, employee_id: String) -> Result<Vec<EmployeeAdvance>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!("SELECT {} FROM employee_advances WHERE employee_id = ?1 ORDER BY date_taken DESC", EMPLOYEE_ADVANCE_COLUMNS))
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![employee_id], row_to_employee_advance).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[derive(Serialize)]
pub struct EmployeeAdvanceTotals {
    pub total_taken: f64,
    pub total_pending: f64,
}

#[tauri::command]
pub fn get_employee_advance_totals(db: State<'_, Mutex<Connection>>, employee_id: String) -> Result<EmployeeAdvanceTotals, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let total_taken: f64 = conn
        .query_row("SELECT COALESCE(SUM(amount), 0) FROM employee_advances WHERE employee_id = ?1", params![employee_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    let total_pending: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM employee_advances WHERE employee_id = ?1 AND deducted = 0",
            params![employee_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(EmployeeAdvanceTotals { total_taken, total_pending })
}

/// Manual override for an advance's status (e.g. paid back in cash outside
/// payroll, or a correction). Clearing it back to pending also clears the
/// payroll-run link, since it's no longer actually deducted by that run.
#[tauri::command]
pub fn set_employee_advance_deducted(db: State<'_, Mutex<Connection>>, id: String, deducted: bool) -> Result<EmployeeAdvance, String> {
    crate::license::require_active_license()?;
    let conn = db.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE employee_advances SET deducted = ?2, deducted_in_payroll_run_id = CASE WHEN ?2 = 0 THEN NULL ELSE deducted_in_payroll_run_id END WHERE id = ?1",
        params![id, deducted as i64],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(
        &conn, "UPDATE", "EMPLOYEE_ADVANCE", Some(&id),
        if deducted { "Avance marquée comme déduite" } else { "Avance marquée en attente" },
    );

    let mut stmt = conn
        .prepare(&format!("SELECT {} FROM employee_advances WHERE id = ?1", EMPLOYEE_ADVANCE_COLUMNS))
        .map_err(|e| e.to_string())?;
    stmt.query_row(params![id], row_to_employee_advance).map_err(|e| e.to_string())
}

// ---- Monthly payroll (bulletin de paie) ----

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PayrollRun {
    pub id: String,
    pub employee_id: String,
    pub month: String,
    pub base_salary: f64,
    pub working_days_in_month: f64,
    pub absence_days: f64,
    pub daily_rate: f64,
    pub absence_deduction: f64,
    pub primes: f64,
    pub avance_deduction: f64,
    pub net_a_payer: f64,
    pub paid: bool,
    pub paid_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub notes: Option<String>,
}

const PAYROLL_RUN_COLUMNS: &str = "id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at, notes";

fn row_to_payroll_run(row: &rusqlite::Row) -> rusqlite::Result<PayrollRun> {
    Ok(PayrollRun {
        id: row.get(0)?,
        employee_id: row.get(1)?,
        month: row.get(2)?,
        base_salary: row.get(3)?,
        working_days_in_month: row.get(4)?,
        absence_days: row.get(5)?,
        daily_rate: row.get(6)?,
        absence_deduction: row.get(7)?,
        primes: row.get(8)?,
        avance_deduction: row.get(9)?,
        net_a_payer: row.get(10)?,
        paid: row.get::<_, i64>(11)? != 0,
        paid_date: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
        notes: row.get(15)?,
    })
}

/// Computes and (re)saves one employee's bulletin de paie for one month —
/// upserts on (employee_id, month), so re-running before it's paid updates
/// the same row rather than duplicating it. Refuses to touch a run already
/// marked paid. Consumes (marks deducted) any employee_advances whose
/// month_to_deduct matches, in the same transaction — a re-run correctly
/// re-includes advances it already consumed on a prior run (matched by
/// this run's own id), so recalculating doesn't drop them.
#[tauri::command]
pub fn run_payroll(db: State<'_, Mutex<Connection>>, employee_id: String, month: String, primes: Option<f64>) -> Result<PayrollRun, String> {
    crate::license::require_active_license()?;

    let mut conn = db.lock().map_err(|e| e.to_string())?;

    let existing: Option<(String, f64, i64)> = conn
        .query_row(
            "SELECT id, primes, paid FROM payroll_runs WHERE employee_id = ?1 AND month = ?2",
            params![employee_id, month],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some((_, _, paid)) = existing {
        if paid != 0 {
            return Err("Ce bulletin de paie est déjà marqué payé — impossible de le recalculer.".to_string());
        }
    }

    let run_id = existing.as_ref().map(|(id, _, _)| id.clone()).unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let primes = primes.unwrap_or_else(|| existing.as_ref().map(|(_, p, _)| *p).unwrap_or(0.0));

    let (base_salary, hire_date): (Option<f64>, Option<String>) = conn
        .query_row(
            "SELECT base_salary, hire_date FROM employees WHERE id = ?1",
            params![employee_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    let base_salary = base_salary.ok_or_else(|| "Cet employé n'a pas de salaire de base défini.".to_string())?;

    let (year, month_num) = parse_year_month(&month)?;
    let (working_days_in_month, absence_days) = compute_absence_stats(&conn, &employee_id, year, month_num, hire_date.as_deref())?;
    if working_days_in_month <= 0.0 {
        return Err("Aucun jour de travail attendu ce mois pour cet employé (vérifiez la date d'embauche).".to_string());
    }

    let daily_rate = base_salary / working_days_in_month;
    let absence_deduction = absence_days * daily_rate;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let avance_deduction: f64 = tx
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM employee_advances WHERE employee_id = ?1 AND month_to_deduct = ?2 AND (deducted = 0 OR deducted_in_payroll_run_id = ?3)",
            params![employee_id, month, run_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let net_a_payer = base_salary + primes - absence_deduction - avance_deduction;
    let now = chrono::Utc::now().to_rfc3339();

    tx.execute(
        "INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, NULL, ?12, ?12)
         ON CONFLICT(employee_id, month) DO UPDATE SET
            base_salary = excluded.base_salary, working_days_in_month = excluded.working_days_in_month,
            absence_days = excluded.absence_days, daily_rate = excluded.daily_rate,
            absence_deduction = excluded.absence_deduction, primes = excluded.primes,
            avance_deduction = excluded.avance_deduction, net_a_payer = excluded.net_a_payer,
            updated_at = excluded.updated_at",
        params![run_id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, now],
    ).map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE employee_advances SET deducted = 1, deducted_in_payroll_run_id = ?3 WHERE employee_id = ?1 AND month_to_deduct = ?2 AND deducted = 0",
        params![employee_id, month, run_id],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "PAYROLL_RUN", Some(&run_id), &format!("Paie calculée pour {}", month));

    conn.query_row(&format!("SELECT {} FROM payroll_runs WHERE id = ?1", PAYROLL_RUN_COLUMNS), params![run_id], row_to_payroll_run)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_payroll_runs(
    db: State<'_, Mutex<Connection>>,
    employee_id: Option<String>,
    month: Option<String>,
    paid: Option<bool>,
) -> Result<Vec<PayrollRun>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut query = format!("SELECT {} FROM payroll_runs", PAYROLL_RUN_COLUMNS);
    let mut conditions: Vec<String> = Vec::new();
    let mut bind_params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(eid) = employee_id {
        conditions.push("employee_id = ?".to_string());
        bind_params.push(Box::new(eid));
    }
    if let Some(m) = month {
        conditions.push("month = ?".to_string());
        bind_params.push(Box::new(m));
    }
    if let Some(p) = paid {
        conditions.push("paid = ?".to_string());
        bind_params.push(Box::new(p as i64));
    }
    if !conditions.is_empty() {
        query.push_str(" WHERE ");
        query.push_str(&conditions.join(" AND "));
    }
    query.push_str(" ORDER BY month DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = bind_params.iter().map(|b| b.as_ref()).collect();
    let rows = stmt.query_map(param_refs.as_slice(), row_to_payroll_run).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn update_payroll_paid(db: State<'_, Mutex<Connection>>, id: String, paid: bool, paid_date: Option<String>) -> Result<PayrollRun, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE payroll_runs SET paid = ?2, paid_date = ?3, updated_at = ?4 WHERE id = ?1",
        params![id, paid as i64, paid_date, now],
    ).map_err(|e| e.to_string())?;

    conn.query_row(&format!("SELECT {} FROM payroll_runs WHERE id = ?1", PAYROLL_RUN_COLUMNS), params![id], row_to_payroll_run)
        .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct UpdatePayrollRunData {
    pub id: String,
    pub base_salary: f64,
    pub working_days_in_month: f64,
    pub absence_days: f64,
    pub daily_rate: f64,
    pub absence_deduction: f64,
    pub primes: f64,
    pub avance_deduction: f64,
    pub net_a_payer: f64,
    pub notes: Option<String>,
}

/// Manual override of a payroll run's calculated fields — for correcting a
/// bulletin without going through run_payroll's automatic recompute (e.g.
/// a one-off bonus adjustment, or fixing a punch-import gap after the fact).
/// paid/paid_date are deliberately NOT editable here — that stays exclusively
/// update_payroll_paid's job, so there's one place that toggles payment state.
#[tauri::command]
pub fn update_payroll_run(db: State<'_, Mutex<Connection>>, data: UpdatePayrollRunData) -> Result<PayrollRun, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let updated = conn.execute(
        "UPDATE payroll_runs SET base_salary = ?2, working_days_in_month = ?3, absence_days = ?4,
            daily_rate = ?5, absence_deduction = ?6, primes = ?7, avance_deduction = ?8,
            net_a_payer = ?9, notes = ?10, updated_at = ?11 WHERE id = ?1",
        params![
            data.id, data.base_salary, data.working_days_in_month, data.absence_days,
            data.daily_rate, data.absence_deduction, data.primes, data.avance_deduction,
            data.net_a_payer, data.notes, now
        ],
    ).map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Bulletin de paie introuvable.".to_string());
    }

    let _ = log_activity(&conn, "UPDATE", "PAYROLL_RUN", Some(&data.id), "Bulletin de paie modifié manuellement");

    conn.query_row(&format!("SELECT {} FROM payroll_runs WHERE id = ?1", PAYROLL_RUN_COLUMNS), params![data.id], row_to_payroll_run)
        .map_err(|e| e.to_string())
}

/// Deletes one payroll run. Any employee_advances it had consumed
/// (deducted_in_payroll_run_id = this run) are reset to undeducted so they
/// become available again for a future run instead of being stuck pointing
/// at a row that no longer exists — the FK's ON DELETE SET NULL alone would
/// clear the pointer but leave `deducted = 1`, silently hiding them forever.
#[tauri::command]
pub fn delete_payroll_run(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let mut conn = db.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE employee_advances SET deducted = 0, deducted_in_payroll_run_id = NULL WHERE deducted_in_payroll_run_id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;

    let deleted = tx.execute("DELETE FROM payroll_runs WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    if deleted == 0 {
        return Err("Bulletin de paie introuvable ou déjà supprimé.".to_string());
    }

    tx.commit().map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "DELETE", "PAYROLL_RUN", Some(&id), "Bulletin de paie supprimé");

    Ok(())
}

// ---- Manager dashboard ----

#[derive(Serialize)]
pub struct PayrollDashboardStats {
    pub month: String,
    pub total_payroll_cost: f64,
    pub flagged_employee_count: i64,
    pub pending_payroll_count: i64,
}

#[tauri::command]
pub fn get_payroll_dashboard_stats(db: State<'_, Mutex<Connection>>, company_id: String, month: String) -> Result<PayrollDashboardStats, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let total_payroll_cost: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(pr.net_a_payer), 0) FROM payroll_runs pr JOIN employees e ON e.id = pr.employee_id WHERE pr.month = ?1 AND e.company_id = ?2",
            params![month, company_id], |row| row.get(0)
        )
        .map_err(|e| e.to_string())?;

    let pending_payroll_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM payroll_runs pr JOIN employees e ON e.id = pr.employee_id WHERE pr.month = ?1 AND pr.paid = 0 AND e.company_id = ?2",
            params![month, company_id], |row| row.get(0)
        )
        .map_err(|e| e.to_string())?;

    let (year, month_num) = parse_year_month(&month)?;

    let mut stmt = conn
        .prepare("SELECT id, hire_date FROM employees WHERE (is_active = 1 OR is_active IS NULL) AND company_id = ?1")
        .map_err(|e| e.to_string())?;
    let employees: Vec<(String, Option<String>)> = stmt
        .query_map(params![company_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut flagged_employee_count = 0i64;
    for (emp_id, hire_date) in employees {
        let (_, absence_days) = compute_absence_stats(&conn, &emp_id, year, month_num, hire_date.as_deref())?;
        if absence_days > ABSENCE_FLAG_THRESHOLD {
            flagged_employee_count += 1;
        }
    }

    Ok(PayrollDashboardStats {
        month,
        total_payroll_cost,
        flagged_employee_count,
        pending_payroll_count,
    })
}

// ---- Employees HR overview (Effectif/Archivés KPIs + per-employee payroll summary) ----

#[derive(Serialize)]
pub struct EmployeeHrStats {
    pub active_count: i64,
    pub inactive_count: i64,
    pub monthly_payroll: f64,
    pub total_paid_year: f64,
}

#[tauri::command]
pub fn get_employee_hr_stats(db: State<'_, Mutex<Connection>>, company_id: String, year: String) -> Result<EmployeeHrStats, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let active_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM employees WHERE company_id = ?1 AND (is_active = 1 OR is_active IS NULL)",
            params![company_id], |row| row.get(0)
        )
        .map_err(|e| e.to_string())?;

    let inactive_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM employees WHERE company_id = ?1 AND is_active = 0",
            params![company_id], |row| row.get(0)
        )
        .map_err(|e| e.to_string())?;

    let monthly_payroll: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(base_salary), 0) FROM employees WHERE company_id = ?1 AND (is_active = 1 OR is_active IS NULL)",
            params![company_id], |row| row.get(0)
        )
        .map_err(|e| e.to_string())?;

    let total_paid_year: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(pr.net_a_payer), 0) FROM payroll_runs pr JOIN employees e ON e.id = pr.employee_id WHERE e.company_id = ?1 AND pr.paid = 1 AND substr(pr.month, 1, 4) = ?2",
            params![company_id, year], |row| row.get(0)
        )
        .map_err(|e| e.to_string())?;

    Ok(EmployeeHrStats {
        active_count,
        inactive_count,
        monthly_payroll,
        total_paid_year,
    })
}

#[derive(Serialize)]
pub struct EmployeePayrollSummary {
    pub employee_id: String,
    pub total_paid: f64,
    pub last_paid_month: Option<String>,
    pub last_paid_amount: Option<f64>,
}

#[tauri::command]
pub fn get_employee_payroll_summaries(db: State<'_, Mutex<Connection>>, company_id: String) -> Result<Vec<EmployeePayrollSummary>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT e.id,
                    COALESCE((SELECT SUM(net_a_payer) FROM payroll_runs WHERE employee_id = e.id AND paid = 1), 0),
                    (SELECT month FROM payroll_runs WHERE employee_id = e.id AND paid = 1 ORDER BY month DESC LIMIT 1),
                    (SELECT net_a_payer FROM payroll_runs WHERE employee_id = e.id AND paid = 1 ORDER BY month DESC LIMIT 1)
             FROM employees e WHERE e.company_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![company_id], |row| {
            Ok(EmployeePayrollSummary {
                employee_id: row.get(0)?,
                total_paid: row.get(1)?,
                last_paid_month: row.get(2)?,
                last_paid_amount: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

// ============= PROJECTS (omada-agency branch only) =============
// Agency project-management module: client-linked, invoice-derived budget
// (see get_project_stats), task/deliverable tracking. Replaces the old
// loosely-typed projects/employee_scores tables (retired in database.rs's
// migrate_legacy_projects_module — confirmed unused, zero real rows anywhere).
// Not part of the core Sordi product.

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Project {
    pub id: String,
    pub company_id: Option<String>,
    pub client_id: String,
    pub name: String,
    pub service_categories: Vec<String>,
    pub responsible_person: Option<String>,
    pub start_date: Option<String>,
    pub deadline: Option<String>,
    pub planned_budget: f64,
    pub created_at: String,
    pub updated_at: String,
    // omada-agency branch only — freelancer lump-sum payment tracking.
    // Separate from responsible_person (deliberately plain free text) —
    // only set when this project actually has a freelancer to pay.
    pub freelancer_id: Option<String>,
    pub montant_convenu: Option<f64>,
    pub statut_paiement: String,
    pub date_paiement: Option<String>,
    /// Explicit, manually-set operational lifecycle status
    /// (en_cours/termine/en_pause) — deliberately independent of
    /// statut_paiement (freelancer payables) and of anything derived from
    /// invoices/payments. Only ever changed by an explicit user action
    /// (update_project_status or the full edit form), never computed.
    pub status: String,
}

#[derive(Deserialize)]
pub struct CreateProjectData {
    // Shared with update_project, whose UPDATE statement never touches this
    // column — the frontend's update payload omits it (Omit<..., "company_id">),
    // so it must tolerate being absent from that JSON instead of failing
    // deserialization with "missing field `company_id`".
    #[serde(default)]
    pub company_id: String,
    pub client_id: String,
    pub name: String,
    pub service_categories: Vec<String>,
    pub responsible_person: Option<String>,
    pub start_date: Option<String>,
    pub deadline: Option<String>,
    pub planned_budget: f64,
    pub freelancer_id: Option<String>,
    pub montant_convenu: Option<f64>,
    pub status: Option<String>,
}

fn row_to_project(row: &rusqlite::Row) -> rusqlite::Result<Project> {
    let categories_json: String = row.get("service_categories")?;
    Ok(Project {
        id: row.get("id")?,
        company_id: row.get("company_id").ok(),
        client_id: row.get("client_id")?,
        name: row.get("name")?,
        service_categories: serde_json::from_str(&categories_json).unwrap_or_default(),
        responsible_person: row.get("responsible_person")?,
        start_date: row.get("start_date")?,
        deadline: row.get("deadline")?,
        planned_budget: row.get("planned_budget")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        freelancer_id: row.get("freelancer_id").ok(),
        montant_convenu: row.get("montant_convenu").ok(),
        statut_paiement: row.get::<_, Option<String>>("statut_paiement").ok().flatten().unwrap_or_else(|| "non_paye".to_string()),
        date_paiement: row.get("date_paiement").ok(),
        status: row.get::<_, Option<String>>("status").ok().flatten().unwrap_or_else(|| "en_cours".to_string()),
    })
}

const PROJECT_COLUMNS: &str = "id, company_id, client_id, name, service_categories, responsible_person, start_date, deadline, planned_budget, created_at, updated_at, freelancer_id, montant_convenu, statut_paiement, date_paiement, status";

#[tauri::command]
pub fn get_projects(db: State<'_, Mutex<Connection>>, company_id: String) -> Result<Vec<Project>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!("SELECT {} FROM projects WHERE company_id = ?1 ORDER BY created_at DESC", PROJECT_COLUMNS))
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![company_id], row_to_project).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for p in rows {
        result.push(p.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

/// Singular fetch, matching get_client/get_order/get_invoice's convention —
/// needed for the project detail page to work from a direct/refreshed
/// navigation without depending on the list query being cached first.
#[tauri::command]
pub fn get_project(db: State<'_, Mutex<Connection>>, id: String) -> Result<Option<Project>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        &format!("SELECT {} FROM projects WHERE id = ?1", PROJECT_COLUMNS),
        params![id],
        row_to_project,
    ).optional().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_project(db: State<'_, Mutex<Connection>>, data: CreateProjectData) -> Result<Project, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let categories_json = serde_json::to_string(&data.service_categories).map_err(|e| e.to_string())?;

    let status = data.status.clone().unwrap_or_else(|| "en_cours".to_string());

    conn.execute(
        "INSERT INTO projects (id, company_id, client_id, name, service_categories, responsible_person, start_date, deadline, planned_budget, created_at, updated_at, freelancer_id, montant_convenu, statut_paiement, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'non_paye', ?14)",
        params![id, data.company_id, data.client_id, data.name, categories_json, data.responsible_person, data.start_date, data.deadline, data.planned_budget, now, now, data.freelancer_id, data.montant_convenu, status],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "PROJECT", Some(&id), &format!("Nouveau projet créé: {}", data.name));

    Ok(Project {
        id,
        company_id: Some(data.company_id),
        client_id: data.client_id,
        name: data.name,
        service_categories: data.service_categories,
        responsible_person: data.responsible_person,
        start_date: data.start_date,
        deadline: data.deadline,
        planned_budget: data.planned_budget,
        created_at: now.clone(),
        updated_at: now,
        freelancer_id: data.freelancer_id,
        montant_convenu: data.montant_convenu,
        statut_paiement: "non_paye".to_string(),
        date_paiement: None,
        status,
    })
}

/// Field edit only — statut_paiement/date_paiement go through
/// update_freelancer_payment_status below, same split as payroll_runs'
/// update_payroll_paid vs. run_payroll. `status` (operational lifecycle)
/// CAN be changed here too (the full edit form sends it along with
/// everything else), but the primary path for a quick toggle is the
/// dedicated update_project_status command right below.
#[tauri::command]
pub fn update_project(db: State<'_, Mutex<Connection>>, id: String, data: CreateProjectData) -> Result<Project, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let categories_json = serde_json::to_string(&data.service_categories).map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE projects SET client_id = ?2, name = ?3, service_categories = ?4, responsible_person = ?5, start_date = ?6, deadline = ?7, planned_budget = ?8, updated_at = ?9, freelancer_id = ?10, montant_convenu = ?11, status = COALESCE(?12, status) WHERE id = ?1",
        params![id, data.client_id, data.name, categories_json, data.responsible_person, data.start_date, data.deadline, data.planned_budget, now, data.freelancer_id, data.montant_convenu, data.status],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "UPDATE", "PROJECT", Some(&id), &format!("Projet mis à jour: {}", data.name));

    conn.query_row(&format!("SELECT {} FROM projects WHERE id = ?1", PROJECT_COLUMNS), params![id], row_to_project)
        .map_err(|e| e.to_string())
}

/// Dedicated quick-toggle for the Projets table row menu / STATUT cell —
/// changes ONLY the operational lifecycle status, independent of
/// statut_paiement (freelancer payables) and of the financial collection
/// figures (budget_facture/budget_paye), which stay purely informational.
#[tauri::command]
pub fn update_project_status(db: State<'_, Mutex<Connection>>, id: String, status: String) -> Result<Project, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE projects SET status = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, status, chrono::Utc::now().to_rfc3339()],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "UPDATE", "PROJECT", Some(&id), &format!("Statut du projet changé : {}", status));

    conn.query_row(&format!("SELECT {} FROM projects WHERE id = ?1", PROJECT_COLUMNS), params![id], row_to_project)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_project(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "DELETE", "PROJECT", Some(&id), "Projet supprimé");
    Ok(())
}

// ---- Freelancer project payments ----

#[tauri::command]
pub fn update_freelancer_payment_status(db: State<'_, Mutex<Connection>>, project_id: String, statut_paiement: String, date_paiement: Option<String>) -> Result<Project, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE projects SET statut_paiement = ?2, date_paiement = ?3, updated_at = ?4 WHERE id = ?1",
        params![project_id, statut_paiement, date_paiement, chrono::Utc::now().to_rfc3339()],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "UPDATE", "PROJECT", Some(&project_id), &format!("Statut de paiement freelance : {}", statut_paiement));

    conn.query_row(&format!("SELECT {} FROM projects WHERE id = ?1", PROJECT_COLUMNS), params![project_id], row_to_project)
        .map_err(|e| e.to_string())
}

/// Attaches a freelancer + agreed amount to an EXISTING project in one call
/// (used by the Paie page's "Ajouter un paiement freelance" dialog, so
/// logging a payment doesn't require going through the full New/Edit
/// Project form). Superset of update_freelancer_payment_status, which stays
/// untouched — it's still what the plain paid/unpaid toggle buttons use.
#[tauri::command]
pub fn assign_freelance_payment(
    db: State<'_, Mutex<Connection>>,
    project_id: String,
    freelancer_id: String,
    montant_convenu: f64,
    statut_paiement: String,
    date_paiement: Option<String>,
) -> Result<Project, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE projects SET freelancer_id = ?2, montant_convenu = ?3, statut_paiement = ?4, date_paiement = ?5, updated_at = ?6 WHERE id = ?1",
        params![project_id, freelancer_id, montant_convenu, statut_paiement, date_paiement, chrono::Utc::now().to_rfc3339()],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "UPDATE", "PROJECT", Some(&project_id), "Paiement freelance assigné");

    conn.query_row(&format!("SELECT {} FROM projects WHERE id = ?1", PROJECT_COLUMNS), params![project_id], row_to_project)
        .map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct FreelancePayment {
    pub project_id: String,
    pub project_name: String,
    pub freelancer_id: String,
    pub freelancer_name: String,
    pub montant_convenu: Option<f64>,
    pub statut_paiement: String,
    pub date_paiement: Option<String>,
}

/// Every project with a freelancer assigned, unpaid first — feeds the
/// "Freelances" list on the Paie page and its running-total-owed figure
/// (frontend sums montant_convenu where statut_paiement = non_paye).
#[tauri::command]
pub fn get_freelance_payments(db: State<'_, Mutex<Connection>>, company_id: String) -> Result<Vec<FreelancePayment>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, p.freelancer_id, e.name, p.montant_convenu, p.statut_paiement, p.date_paiement
             FROM projects p
             JOIN employees e ON e.id = p.freelancer_id
             WHERE p.freelancer_id IS NOT NULL AND p.company_id = ?1
             ORDER BY CASE WHEN p.statut_paiement = 'non_paye' THEN 0 ELSE 1 END, p.created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![company_id], |row| {
            Ok(FreelancePayment {
                project_id: row.get(0)?,
                project_name: row.get(1)?,
                freelancer_id: row.get(2)?,
                freelancer_name: row.get(3)?,
                montant_convenu: row.get(4)?,
                statut_paiement: row.get::<_, Option<String>>(5)?.unwrap_or_else(|| "non_paye".to_string()),
                date_paiement: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

// ---- Project budget/progress aggregation (mirrors get_client_overview_stats:
// raw numbers only, every threshold/status rule lives in TS) ----

#[derive(Serialize, Debug, Clone)]
pub struct ProjectStats {
    pub project_id: String,
    pub planned_budget: f64,
    /// SUM(invoices.total_ttc) for every invoice linked to this project —
    /// the derived budget the spec called for, never manually entered.
    pub budget_facture: f64,
    /// SUM(invoices.amount_paid) for the same set — reuses each invoice's
    /// own tracked amount_paid rather than re-deriving from payments.
    pub budget_paye: f64,
    pub task_count: i64,
    pub tasks_approved_count: i64,
    pub start_date: Option<String>,
    pub deadline: Option<String>,
}

#[tauri::command]
pub fn get_project_stats(db: State<'_, Mutex<Connection>>, company_id: String, project_id: Option<String>) -> Result<Vec<ProjectStats>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    struct ProjectRow {
        id: String,
        planned_budget: f64,
        start_date: Option<String>,
        deadline: Option<String>,
    }
    let map_project_row = |row: &rusqlite::Row| -> rusqlite::Result<ProjectRow> {
        Ok(ProjectRow {
            id: row.get(0)?,
            planned_budget: row.get(1)?,
            start_date: row.get(2)?,
            deadline: row.get(3)?,
        })
    };
    let mut proj_stmt = if project_id.is_some() {
        conn.prepare("SELECT id, planned_budget, start_date, deadline FROM projects WHERE company_id = ?1 AND id = ?2")
    } else {
        conn.prepare("SELECT id, planned_budget, start_date, deadline FROM projects WHERE company_id = ?1")
    }.map_err(|e| e.to_string())?;
    let project_rows: Vec<ProjectRow> = if let Some(ref pid) = project_id {
        proj_stmt.query_map(params![company_id, pid], map_project_row)
    } else {
        proj_stmt.query_map(params![company_id], map_project_row)
    }.map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for p in project_rows {
        let budget_facture: f64 = conn.query_row(
            "SELECT COALESCE(SUM(total_ttc), 0) FROM invoices WHERE project_id = ?1",
            params![p.id],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;

        // Real collected cash, aggregated straight from the payments ledger
        // (joined via invoices.project_id) rather than trusting each
        // invoice's own cached amount_paid — the two should always agree in
        // practice, but this is the actual source of truth and matches
        // exactly what the Dashboard's "Santé & Rentabilité des Projets"
        // widget needs to show real per-project collection progress.
        let budget_paye: f64 = conn.query_row(
            "SELECT COALESCE(SUM(pay.amount), 0) FROM payments pay JOIN invoices inv ON inv.id = pay.invoice_id WHERE inv.project_id = ?1",
            params![p.id],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;

        let (task_count, tasks_approved_count): (i64, i64) = conn.query_row(
            "SELECT COUNT(*), COALESCE(SUM(CASE WHEN status = 'approuve' THEN 1 ELSE 0 END), 0) FROM project_tasks WHERE project_id = ?1",
            params![p.id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| e.to_string())?;

        result.push(ProjectStats {
            project_id: p.id,
            planned_budget: p.planned_budget,
            budget_facture,
            budget_paye,
            task_count,
            tasks_approved_count,
            start_date: p.start_date,
            deadline: p.deadline,
        });
    }
    Ok(result)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProjectProfitability {
    pub project_id: String,
    pub revenue_ht: f64,
    /// SUM(payments.amount) across every invoice linked to this project —
    /// actual cash collected, derived from the payments ledger itself
    /// rather than reused from invoices.amount_paid (which get_project_stats'
    /// budget_paye already does). The two should normally agree, but this
    /// is the direct, auditable source the spec asked for.
    pub total_collected: f64,
    pub direct_expenses: f64,
    pub net_margin: f64,
    pub margin_percentage: f64,
}

/// Real project profitability — separate from get_project_stats above
/// (which tracks planned-budget consumption on a TTC basis) so that
/// existing view keeps computing exactly what it always has. This one
/// answers a different question: actual net HT revenue minus direct costs
/// logged against the project (see migrate_expenses_project_linkage_if_needed).
/// Payroll/labor cost is deliberately not included — there is no per-project
/// labor allocation anywhere in the schema yet (see the profitability audit).
#[tauri::command]
pub fn get_project_profitability(db: State<'_, Mutex<Connection>>, project_id: String) -> Result<ProjectProfitability, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // Revenue HT: real invoices net of credit notes, proformas excluded
    // entirely (not committed revenue yet).
    let revenue_ht: f64 = conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN invoice_type = 'credit_note' THEN -subtotal_ht ELSE subtotal_ht END), 0.0)
         FROM invoices
         WHERE project_id = ?1 AND invoice_type IN ('invoice', 'credit_note')",
        params![project_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    // Total Encaissé: real cash collected, summed from the payments ledger
    // via every invoice linked to this project (not proformas/credit notes
    // — a payment can't exist against those in practice, but the JOIN
    // naturally excludes them anyway since it only follows project_id).
    let total_collected: f64 = conn.query_row(
        "SELECT COALESCE(SUM(p.amount), 0.0)
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
         WHERE i.project_id = ?1",
        params![project_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let direct_expenses: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0.0) FROM expenses WHERE project_id = ?1",
        params![project_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let net_margin = revenue_ht - direct_expenses;
    let margin_percentage = if revenue_ht > 0.0 { (net_margin / revenue_ht) * 100.0 } else { 0.0 };

    Ok(ProjectProfitability {
        project_id,
        revenue_ht,
        total_collected,
        direct_expenses,
        net_margin,
        margin_percentage,
    })
}

// ============= PARTNERS & EQUITY DISTRIBUTION =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Partner {
    pub id: String,
    pub company_id: Option<String>,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub role: Option<String>,
    pub equity_percentage: f64,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreatePartnerData {
    pub company_id: String,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub role: Option<String>,
    pub equity_percentage: f64,
}

#[derive(Deserialize)]
pub struct UpdatePartnerData {
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub role: Option<String>,
    pub equity_percentage: f64,
    pub is_active: bool,
}

/// A partner plus its computed distribution breakdown for a given period —
/// this is what get_partners actually returns; Partner above is the raw row.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PartnerFinancials {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub role: Option<String>,
    pub equity_percentage: f64,
    pub is_active: bool,
    pub allocated_profit: f64,
    /// All-time, not period-scoped — a partner's running balance against
    /// their allocated profit shouldn't reset every time the dashboard's
    /// year/month filter changes.
    pub total_withdrawn: f64,
    pub remaining_balance: f64,
    pub created_at: String,
    pub updated_at: String,
}

const PARTNER_SELECT: &str = "SELECT * FROM partners";

fn map_partner_row(row: &rusqlite::Row) -> rusqlite::Result<Partner> {
    Ok(Partner {
        id: row.get("id")?,
        company_id: row.get("company_id")?,
        name: row.get("name")?,
        email: row.get("email")?,
        phone: row.get("phone")?,
        role: row.get("role")?,
        equity_percentage: row.get("equity_percentage")?,
        is_active: row.get::<_, i64>("is_active")? != 0,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn get_partner_by_id(conn: &Connection, id: &str) -> Result<Partner, String> {
    conn.prepare(&format!("{} WHERE id = ?1", PARTNER_SELECT))
        .map_err(|e| e.to_string())?
        .query_row(params![id], |row| map_partner_row(row))
        .map_err(|e| e.to_string())
}

/// Same HT-revenue-minus-charges computation as get_dashboard_stats's
/// revenue_ht/net_profit_ht (kept as a small duplicate rather than a shared
/// refactor of that already-verified function) — this is the "Bénéfice Net
/// de la Période" that partner allocations are a percentage split of.
fn compute_period_net_profit_ht(conn: &Connection, company_id: &str, year: Option<i64>, months: &Option<Vec<String>>) -> Result<f64, String> {
    let target_year = year.unwrap_or_else(|| chrono::Local::now().year() as i64);
    let company_filter = format!("company_id = '{}'", company_id.replace('\'', "''"));
    let mut invoice_date_filter = format!("strftime('%Y', invoice_date) = '{}' AND {}", target_year, company_filter);
    let mut expense_date_filter = format!("strftime('%Y', expense_date) = '{}' AND {}", target_year, company_filter);

    if let Some(m_list) = months {
        if !m_list.is_empty() {
            let padded_months: Vec<String> = m_list.iter().map(|m| {
                if m.len() == 1 { format!("0{}", m) } else { m.clone() }
            }).collect();
            let months_str = padded_months.iter().map(|m| format!("'{}'", m)).collect::<Vec<_>>().join(",");
            invoice_date_filter.push_str(&format!(" AND strftime('%m', invoice_date) IN ({})", months_str));
            expense_date_filter.push_str(&format!(" AND strftime('%m', expense_date) IN ({})", months_str));
        }
    }

    let revenue_ht: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(subtotal_ht), 0.0) FROM invoices WHERE invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND {}", invoice_date_filter),
        [], |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    let expenses: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(amount), 0.0) FROM expenses WHERE {}", expense_date_filter),
        [], |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    Ok(revenue_ht - expenses)
}

#[tauri::command]
pub fn get_partners(db: State<'_, Mutex<Connection>>, company_id: String, year: Option<i64>, months: Option<Vec<String>>) -> Result<Vec<PartnerFinancials>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let net_profit_ht = compute_period_net_profit_ht(&conn, &company_id, year, &months)?;

    let mut stmt = conn.prepare(&format!("{} WHERE company_id = ?1 ORDER BY created_at ASC", PARTNER_SELECT)).map_err(|e| e.to_string())?;
    let partners: Vec<Partner> = stmt.query_map(params![company_id], map_partner_row).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for p in partners {
        let total_withdrawn: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM partner_withdrawals WHERE partner_id = ?1",
            params![p.id],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;

        let allocated_profit = net_profit_ht * (p.equity_percentage / 100.0);

        result.push(PartnerFinancials {
            id: p.id,
            name: p.name,
            email: p.email,
            phone: p.phone,
            role: p.role,
            equity_percentage: p.equity_percentage,
            is_active: p.is_active,
            allocated_profit,
            total_withdrawn,
            remaining_balance: allocated_profit - total_withdrawn,
            created_at: p.created_at,
            updated_at: p.updated_at,
        });
    }

    Ok(result)
}

// ============= MONTHLY PARTNERS & BUSINESS REPORT =============
// A single-shot aggregation for the "Rapport Mensuel d'Activité & Clôture"
// executive PDF (Associés page). Everything here is read-only and scoped to
// one calendar month, unlike get_partners (year+months list, all-time
// withdrawals) — this is the strict "what happened in exactly this month"
// view a closing report needs.

#[derive(Serialize)]
pub struct MonthlyReportPartnerRow {
    pub id: String,
    pub name: String,
    pub role: Option<String>,
    pub equity_percentage: f64,
    /// This month's share of the month's net profit — not the all-time
    /// allocated_profit that get_partners computes.
    pub quote_part_benefice: f64,
    /// Sum of partner_withdrawals in this exact month only.
    pub prelevements_du_mois: f64,
    pub solde_net_a_verser: f64,
}

#[derive(Serialize)]
pub struct MonthlyReportProjectRow {
    pub id: String,
    pub name: String,
    pub client_name: String,
    pub deadline: String,
    /// All-time project margin (see get_project_profitability) — there is no
    /// per-month profitability breakdown anywhere in the schema, so this is
    /// deliberately labeled as the project's overall margin, not a
    /// month-scoped figure, to avoid implying false precision.
    pub revenue_ht: f64,
    pub net_margin: f64,
    pub margin_percentage: f64,
}

#[derive(Serialize)]
pub struct MonthlyBusinessReport {
    pub month: String,
    pub year: i32,
    pub month_num: u32,

    // ---- Trésorerie ----
    /// Derived running total of (encaissements - décaissements) across every
    /// month strictly before the report month — not a real bank balance
    /// (Sordi has no treasury/ledger table). The PDF must label this
    /// clearly as calculated, never as an actual account balance.
    pub solde_initial: f64,
    pub recettes_ht: f64,
    pub recettes_encaissees: f64,
    pub charges_operationnelles: f64,
    pub masse_salariale: f64,
    pub solde_final: f64,

    // ---- Bénéfice & répartition ----
    pub benefice_net: f64,
    pub partners: Vec<MonthlyReportPartnerRow>,
    pub total_prelevements_mois: f64,

    // ---- RH ----
    pub employes_actifs_count: i64,
    /// Sum of working_days_in_month across every payroll_runs row for this
    /// month (snapshotted at run time, not live-recomputed — see
    /// compute_absence_stats doc comment on why historical months must read
    /// the snapshot instead of recalculating against "today").
    pub total_jours_travailles: f64,
    pub masse_salariale_payee: f64,
    pub masse_salariale_en_attente: f64,

    // ---- Projets ----
    pub projets_clotures: Vec<MonthlyReportProjectRow>,

    pub generated_at: String,
}

#[tauri::command]
pub fn get_monthly_partners_report(
    db: State<'_, Mutex<Connection>>,
    company_id: String,
    year: i32,
    month: u32,
) -> Result<MonthlyBusinessReport, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    if !(1..=12).contains(&month) {
        return Err("Mois invalide, attendu 1-12".to_string());
    }
    let month_key = format!("{:04}-{:02}", year, month); // matches payroll_runs.month
    let ym_padded = format!("{:02}", month);
    let company_filter = format!("company_id = '{}'", company_id.replace('\'', "''"));

    // ---- This month's cash-basis figures ----
    let invoice_date_filter = format!(
        "strftime('%Y', invoice_date) = '{}' AND strftime('%m', invoice_date) = '{}' AND {}",
        year, ym_padded, company_filter
    );
    let expense_date_filter = format!(
        "strftime('%Y', expense_date) = '{}' AND strftime('%m', expense_date) = '{}' AND {}",
        year, ym_padded, company_filter
    );
    let payment_date_filter = format!(
        "strftime('%Y', payment_date) = '{}' AND strftime('%m', payment_date) = '{}' AND {}",
        year, ym_padded, company_filter
    );

    // Recettes HT: invoices issued this month (accrual, tax-exclusive) —
    // same basis as compute_period_net_profit_ht/get_dashboard_stats.
    let recettes_ht: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(subtotal_ht), 0.0) FROM invoices WHERE invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND {}", invoice_date_filter),
        [], |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    // Recettes Encaissées: actual cash received this month, from the
    // dedicated payments ledger (payment_date), not amount_paid on invoices
    // issued this month — a payment can land in a different month than the
    // invoice that generated it, and a closing report cares about the
    // month cash actually moved.
    let recettes_encaissees: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(amount), 0.0) FROM payments WHERE {}", payment_date_filter),
        [], |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    let charges_operationnelles: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(amount), 0.0) FROM expenses WHERE {}", expense_date_filter),
        [], |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    // ---- Payroll for this month ----
    let masse_salariale_payee: f64 = conn.query_row(
        "SELECT COALESCE(SUM(pr.net_a_payer), 0.0) FROM payroll_runs pr
         JOIN employees e ON e.id = pr.employee_id
         WHERE pr.month = ?1 AND pr.paid = 1 AND e.company_id = ?2",
        params![month_key, company_id], |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    let masse_salariale_en_attente: f64 = conn.query_row(
        "SELECT COALESCE(SUM(pr.net_a_payer), 0.0) FROM payroll_runs pr
         JOIN employees e ON e.id = pr.employee_id
         WHERE pr.month = ?1 AND pr.paid = 0 AND e.company_id = ?2",
        params![month_key, company_id], |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    // Masse Salariale for the profit/treasury computation below counts every
    // run logged for the month regardless of paid status — a bulletin
    // already represents money owed for work done in that month, matching
    // how charges_operationnelles counts logged expenses regardless of
    // whether they've been settled.
    let masse_salariale = masse_salariale_payee + masse_salariale_en_attente;

    let total_jours_travailles: f64 = conn.query_row(
        "SELECT COALESCE(SUM(pr.working_days_in_month), 0.0) FROM payroll_runs pr
         JOIN employees e ON e.id = pr.employee_id
         WHERE pr.month = ?1 AND e.company_id = ?2",
        params![month_key, company_id], |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    let employes_actifs_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM employees WHERE (is_active = 1 OR is_active IS NULL) AND company_id = ?1",
        params![company_id], |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    // Bénéfice Net = Recettes Encaissées - (Charges + Salaires), per spec —
    // a cash-basis monthly closing figure, deliberately different from
    // compute_period_net_profit_ht's HT-accrual figure used elsewhere.
    let benefice_net = recettes_encaissees - (charges_operationnelles + masse_salariale);

    // ---- Solde de Trésorerie (dérivé) ----
    // Cumulative net cash movement (encaissements - charges - salaires)
    // across every full month strictly before this one. Intentionally not a
    // real bank balance — see MonthlyBusinessReport::solde_initial doc.
    let solde_initial: f64 = conn.query_row(
        &format!(
            "SELECT
                COALESCE((SELECT SUM(amount) FROM payments WHERE strftime('%Y-%m', payment_date) < ?1 AND {company}), 0.0)
                - COALESCE((SELECT SUM(amount) FROM expenses WHERE strftime('%Y-%m', expense_date) < ?1 AND {company}), 0.0)
                - COALESCE((SELECT SUM(pr.net_a_payer) FROM payroll_runs pr JOIN employees e ON e.id = pr.employee_id WHERE pr.month < ?1 AND e.company_id = ?2), 0.0)",
            company = company_filter
        ),
        params![month_key, company_id], |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    let solde_final = solde_initial + recettes_encaissees - charges_operationnelles - masse_salariale;

    // ---- Partner breakdown ----
    let mut stmt = conn.prepare(&format!("{} WHERE company_id = ?1 ORDER BY created_at ASC", PARTNER_SELECT)).map_err(|e| e.to_string())?;
    let partner_rows: Vec<Partner> = stmt.query_map(params![company_id], map_partner_row).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let mut partners = Vec::new();
    let mut total_prelevements_mois = 0.0;
    for p in partner_rows {
        let prelevements_du_mois: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM partner_withdrawals WHERE partner_id = ?1 AND strftime('%Y-%m', withdrawal_date) = ?2",
            params![p.id, month_key],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;
        total_prelevements_mois += prelevements_du_mois;

        let quote_part_benefice = benefice_net * (p.equity_percentage / 100.0);

        partners.push(MonthlyReportPartnerRow {
            id: p.id,
            name: p.name,
            role: p.role,
            equity_percentage: p.equity_percentage,
            quote_part_benefice,
            prelevements_du_mois,
            solde_net_a_verser: quote_part_benefice - prelevements_du_mois,
        });
    }

    // ---- Projects whose deadline falls in this month ----
    let mut proj_stmt = conn.prepare(
        "SELECT pr.id, pr.name, c.name, pr.deadline
         FROM projects pr
         LEFT JOIN clients c ON pr.client_id = c.id
         WHERE pr.deadline IS NOT NULL
           AND strftime('%Y', pr.deadline) = ?1 AND strftime('%m', pr.deadline) = ?2
           AND pr.company_id = ?3
         ORDER BY pr.deadline ASC"
    ).map_err(|e| e.to_string())?;
    let closed_ids: Vec<(String, String, String, String)> = proj_stmt
        .query_map(params![year.to_string(), ym_padded, company_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get::<_, Option<String>>(2)?.unwrap_or_else(|| "-".to_string()), row.get(3)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut projets_clotures = Vec::new();
    for (id, name, client_name, deadline) in closed_ids {
        let revenue_ht: f64 = conn.query_row(
            "SELECT COALESCE(SUM(CASE WHEN invoice_type = 'credit_note' THEN -subtotal_ht ELSE subtotal_ht END), 0.0)
             FROM invoices WHERE project_id = ?1 AND invoice_type IN ('invoice', 'credit_note')",
            params![id], |row| row.get(0),
        ).map_err(|e| e.to_string())?;
        let direct_expenses: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM expenses WHERE project_id = ?1",
            params![id], |row| row.get(0),
        ).map_err(|e| e.to_string())?;
        let net_margin = revenue_ht - direct_expenses;
        let margin_percentage = if revenue_ht > 0.0 { (net_margin / revenue_ht) * 100.0 } else { 0.0 };

        projets_clotures.push(MonthlyReportProjectRow {
            id, name, client_name, deadline, revenue_ht, net_margin, margin_percentage,
        });
    }

    Ok(MonthlyBusinessReport {
        month: month_key,
        year,
        month_num: month,
        solde_initial,
        recettes_ht,
        recettes_encaissees,
        charges_operationnelles,
        masse_salariale,
        solde_final,
        benefice_net,
        partners,
        total_prelevements_mois,
        employes_actifs_count,
        total_jours_travailles,
        masse_salariale_payee,
        masse_salariale_en_attente,
        projets_clotures,
        generated_at: chrono::Local::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn create_partner(db: State<'_, Mutex<Connection>>, data: CreatePartnerData) -> Result<Partner, String> {
    crate::license::require_active_license()?;
    let conn = db.lock().map_err(|e| e.to_string())?;

    let existing_total: f64 = conn.query_row(
        "SELECT COALESCE(SUM(equity_percentage), 0.0) FROM partners WHERE is_active = 1 AND company_id = ?1",
        params![data.company_id], |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    if existing_total + data.equity_percentage > 100.0001 {
        return Err(format!("La répartition du capital dépasserait 100% ({:.1}% déjà attribués aux associés actifs)", existing_total));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO partners (id, company_id, name, email, phone, role, equity_percentage, is_active, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?8)",
        params![id, data.company_id, data.name, data.email, data.phone, data.role, data.equity_percentage, now],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "PARTNER", Some(&id), &format!("Associé créé : {} ({}% des parts)", data.name, data.equity_percentage));

    get_partner_by_id(&conn, &id)
}

#[tauri::command]
pub fn update_partner(db: State<'_, Mutex<Connection>>, id: String, data: UpdatePartnerData) -> Result<Partner, String> {
    crate::license::require_active_license()?;
    let conn = db.lock().map_err(|e| e.to_string())?;

    if data.is_active {
        let existing_total: f64 = conn.query_row(
            "SELECT COALESCE(SUM(p2.equity_percentage), 0.0) FROM partners p2
             WHERE p2.is_active = 1 AND p2.id != ?1
             AND p2.company_id = (SELECT company_id FROM partners WHERE id = ?1)",
            params![id], |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        if existing_total + data.equity_percentage > 100.0001 {
            return Err(format!("La répartition du capital dépasserait 100% ({:.1}% déjà attribués par les autres associés actifs)", existing_total));
        }
    }

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE partners SET name = ?1, email = ?2, phone = ?3, role = ?4, equity_percentage = ?5, is_active = ?6, updated_at = ?7 WHERE id = ?8",
        params![data.name, data.email, data.phone, data.role, data.equity_percentage, data.is_active, now, id],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "UPDATE", "PARTNER", Some(&id), &format!("Associé modifié : {}", data.name));

    get_partner_by_id(&conn, &id)
}

#[tauri::command]
pub fn delete_partner(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM partners WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "DELETE", "PARTNER", Some(&id), "Associé supprimé");
    Ok(())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PartnerWithdrawal {
    pub id: String,
    pub partner_id: String,
    pub withdrawal_date: String,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateWithdrawalData {
    pub partner_id: String,
    pub withdrawal_date: String,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
}

const WITHDRAWAL_SELECT: &str = "SELECT id, partner_id, withdrawal_date, amount, payment_method, notes, created_at FROM partner_withdrawals";

fn map_withdrawal_row(row: &rusqlite::Row) -> rusqlite::Result<PartnerWithdrawal> {
    Ok(PartnerWithdrawal {
        id: row.get(0)?,
        partner_id: row.get(1)?,
        withdrawal_date: row.get(2)?,
        amount: row.get(3)?,
        payment_method: row.get(4)?,
        notes: row.get(5)?,
        created_at: row.get(6)?,
    })
}

fn get_withdrawal_by_id(conn: &Connection, id: &str) -> Result<PartnerWithdrawal, String> {
    conn.prepare(&format!("{} WHERE id = ?1", WITHDRAWAL_SELECT))
        .map_err(|e| e.to_string())?
        .query_row(params![id], |row| map_withdrawal_row(row))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_partner_withdrawals(db: State<'_, Mutex<Connection>>, partner_id: String) -> Result<Vec<PartnerWithdrawal>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(&format!("{} WHERE partner_id = ?1 ORDER BY withdrawal_date DESC, created_at DESC", WITHDRAWAL_SELECT)).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![partner_id], map_withdrawal_row).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn record_partner_withdrawal(db: State<'_, Mutex<Connection>>, data: CreateWithdrawalData) -> Result<PartnerWithdrawal, String> {
    crate::license::require_active_license()?;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO partner_withdrawals (id, partner_id, withdrawal_date, amount, payment_method, notes, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, data.partner_id, data.withdrawal_date, data.amount, data.payment_method, data.notes, now],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "PARTNER_WITHDRAWAL", Some(&id), &format!("Prélèvement enregistré : {} DA", data.amount));

    get_withdrawal_by_id(&conn, &id)
}

#[tauri::command]
pub fn delete_partner_withdrawal(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM partner_withdrawals WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "DELETE", "PARTNER_WITHDRAWAL", Some(&id), "Prélèvement supprimé");
    Ok(())
}

/// Sets or clears (project_id: None) which project an invoice belongs to.
/// One invoice -> at most one project, enforced by this being a single
/// column assignment rather than a join table.
#[tauri::command]
pub fn assign_invoice_to_project(db: State<'_, Mutex<Connection>>, invoice_id: String, project_id: Option<String>) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE invoices SET project_id = ?2, updated_at = ?3 WHERE id = ?1",
        params![invoice_id, project_id, now],
    ).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "UPDATE", "INVOICE", Some(&invoice_id), "Facture liée à un projet");
    Ok(())
}

// ---- Contracts (bespoke 50/50-milestone client contracts) ----

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ContractInvoiceRef {
    pub id: String,
    pub invoice_number: String,
    pub amount_ttc: f64,
    /// "acompte", "tranche_2", or "solde" — the milestone this line covers,
    /// count and meaning depend on the contract's payment_split (2 tranches
    /// for "50_50"/"100", 3 for "30_40_30"). May be a placeholder reference
    /// (e.g. "FAC-ACOMPTE") when no real invoice exists yet for this milestone.
    pub role: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Contract {
    pub id: String,
    pub company_id: String,
    pub project_id: Option<String>,
    pub client_id: String,
    pub contract_ref: String,
    pub selected_services: Vec<String>,
    /// "50_50", "100" (paiement unique/comptant), or "30_40_30".
    pub payment_split: String,
    pub total_amount_ht: f64,
    pub tva_rate: f64,
    pub tva_amount: f64,
    pub total_amount_ttc: f64,
    pub invoices: Vec<ContractInvoiceRef>,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateContractData {
    pub company_id: String,
    pub project_id: Option<String>,
    pub client_id: String,
    pub selected_services: Vec<String>,
    pub payment_split: String,
    pub total_amount_ht: f64,
    pub tva_rate: f64,
    pub tva_amount: f64,
    pub total_amount_ttc: f64,
    pub invoices: Vec<ContractInvoiceRef>,
}

fn map_contract_row(row: &rusqlite::Row) -> rusqlite::Result<Contract> {
    let invoices_json: String = row.get("invoices_json")?;
    let services_json: String = row.get("selected_services")?;
    Ok(Contract {
        id: row.get("id")?,
        company_id: row.get("company_id")?,
        project_id: row.get("project_id")?,
        client_id: row.get("client_id")?,
        contract_ref: row.get("contract_ref")?,
        selected_services: serde_json::from_str(&services_json).unwrap_or_default(),
        payment_split: row.get("payment_split")?,
        total_amount_ht: row.get("total_amount_ht")?,
        tva_rate: row.get("tva_rate")?,
        tva_amount: row.get("tva_amount")?,
        total_amount_ttc: row.get("total_amount_ttc")?,
        invoices: serde_json::from_str(&invoices_json).unwrap_or_default(),
        created_at: row.get("created_at")?,
    })
}

/// OM-CTR-{year}-{seq}, sequential per company per year — counts this
/// company's existing contracts issued in the target year rather than a
/// shared global sequence, since contracts are low-volume enough that a
/// simple COUNT+1 (inside the same transaction as the INSERT, so no two
/// concurrent creates can collide) is simpler than extending the
/// sequences table for a 12th number type.
fn next_contract_ref(conn: &Connection, company_id: &str, year: i32) -> Result<String, String> {
    let prefix = format!("OM-CTR-{}-", year);
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM contracts WHERE company_id = ?1 AND contract_ref LIKE ?2",
        params![company_id, format!("{}%", prefix)],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    Ok(format!("{}{:03}", prefix, count + 1))
}

#[tauri::command]
pub fn create_contract(db: State<'_, Mutex<Connection>>, data: CreateContractData) -> Result<Contract, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now();
    let contract_ref = next_contract_ref(&conn, &data.company_id, now.year())?;
    let invoices_json = serde_json::to_string(&data.invoices).map_err(|e| e.to_string())?;
    let services_json = serde_json::to_string(&data.selected_services).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO contracts (id, company_id, project_id, client_id, contract_ref, selected_services, payment_split, total_amount_ht, tva_rate, tva_amount, total_amount_ttc, invoices_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            id,
            data.company_id,
            data.project_id,
            data.client_id,
            contract_ref,
            services_json,
            data.payment_split,
            data.total_amount_ht,
            data.tva_rate,
            data.tva_amount,
            data.total_amount_ttc,
            invoices_json,
            now.to_rfc3339(),
        ],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "CONTRACT", Some(&id), &format!("Contrat {} généré", contract_ref));

    let mut stmt = conn.prepare("SELECT * FROM contracts WHERE id = ?1").map_err(|e| e.to_string())?;
    stmt.query_row(params![id], map_contract_row).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_contracts(db: State<'_, Mutex<Connection>>, company_id: String) -> Result<Vec<Contract>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM contracts WHERE company_id = ?1 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![company_id], map_contract_row).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>();
    rows.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_project_contracts(db: State<'_, Mutex<Connection>>, project_id: String) -> Result<Vec<Contract>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM contracts WHERE project_id = ?1 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![project_id], map_contract_row).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>();
    rows.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_contract(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM contracts WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "DELETE", "CONTRACT", Some(&id), "Contrat supprimé");
    Ok(())
}

// ---- Project tasks ----

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProjectTask {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub assigned_resource_id: Option<String>,
    pub status: String,
    pub revision_count: i64,
    pub due_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

fn row_to_project_task(row: &rusqlite::Row) -> rusqlite::Result<ProjectTask> {
    Ok(ProjectTask {
        id: row.get(0)?,
        project_id: row.get(1)?,
        title: row.get(2)?,
        assigned_resource_id: row.get(3)?,
        status: row.get(4)?,
        revision_count: row.get(5)?,
        due_date: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

const PROJECT_TASK_COLUMNS: &str = "id, project_id, title, assigned_resource_id, status, revision_count, due_date, created_at, updated_at";

#[derive(Deserialize)]
pub struct CreateProjectTaskData {
    pub project_id: String,
    pub title: String,
    pub assigned_resource_id: Option<String>,
    pub due_date: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateProjectTaskData {
    pub title: String,
    pub assigned_resource_id: Option<String>,
    pub due_date: Option<String>,
}

#[tauri::command]
pub fn get_project_tasks(db: State<'_, Mutex<Connection>>, project_id: String) -> Result<Vec<ProjectTask>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!("SELECT {} FROM project_tasks WHERE project_id = ?1 ORDER BY created_at ASC", PROJECT_TASK_COLUMNS))
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![project_id], row_to_project_task).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for t in rows {
        result.push(t.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn create_project_task(db: State<'_, Mutex<Connection>>, data: CreateProjectTaskData) -> Result<ProjectTask, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO project_tasks (id, project_id, title, assigned_resource_id, status, revision_count, due_date, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'à_faire', 0, ?5, ?6, ?7)",
        params![id, data.project_id, data.title, data.assigned_resource_id, data.due_date, now, now],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "PROJECT_TASK", Some(&id), &format!("Nouvelle tâche créée: {}", data.title));

    Ok(ProjectTask {
        id,
        project_id: data.project_id,
        title: data.title,
        assigned_resource_id: data.assigned_resource_id,
        status: "à_faire".to_string(),
        revision_count: 0,
        due_date: data.due_date,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Field edit only (title/assignee/due date) — status transitions go through
/// update_project_task_status below, same split as update_invoice vs
/// update_invoice_status elsewhere in this file.
#[tauri::command]
pub fn update_project_task(db: State<'_, Mutex<Connection>>, id: String, data: UpdateProjectTaskData) -> Result<ProjectTask, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE project_tasks SET title = ?2, assigned_resource_id = ?3, due_date = ?4, updated_at = ?5 WHERE id = ?1",
        params![id, data.title, data.assigned_resource_id, data.due_date, now],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "UPDATE", "PROJECT_TASK", Some(&id), &format!("Tâche mise à jour: {}", data.title));

    conn.query_row(
        &format!("SELECT {} FROM project_tasks WHERE id = ?1", PROJECT_TASK_COLUMNS),
        params![id],
        row_to_project_task,
    ).map_err(|e| e.to_string())
}

/// The 5-stage status transition. revision_count only increments on the one
/// transition that actually represents a real revision cycle — bounced back
/// from the client (envoye_client) into rework (en_cours) — not every status
/// change (e.g. à_faire -> en_cours doesn't count).
#[tauri::command]
pub fn update_project_task_status(db: State<'_, Mutex<Connection>>, id: String, status: String) -> Result<ProjectTask, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    let current_status: String = conn
        .query_row("SELECT status FROM project_tasks WHERE id = ?1", params![id], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    let bump_revision = current_status == "envoye_client" && status == "en_cours";

    if bump_revision {
        conn.execute(
            "UPDATE project_tasks SET status = ?2, revision_count = revision_count + 1, updated_at = ?3 WHERE id = ?1",
            params![id, status, now],
        ).map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE project_tasks SET status = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, status, now],
        ).map_err(|e| e.to_string())?;
    }

    let _ = log_activity(&conn, "UPDATE", "PROJECT_TASK", Some(&id), &format!("Statut de tâche changé: {}", status));

    conn.query_row(
        &format!("SELECT {} FROM project_tasks WHERE id = ?1", PROJECT_TASK_COLUMNS),
        params![id],
        row_to_project_task,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_project_task(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM project_tasks WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "DELETE", "PROJECT_TASK", Some(&id), "Tâche supprimée");
    Ok(())
}

// ---- Project deliverables ----

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProjectDeliverable {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub r#type: Option<String>,
    pub link_or_path: Option<String>,
    pub delivered_to_client: bool,
    pub approved: bool,
    pub created_at: String,
}

fn row_to_project_deliverable(row: &rusqlite::Row) -> rusqlite::Result<ProjectDeliverable> {
    Ok(ProjectDeliverable {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        r#type: row.get(3)?,
        link_or_path: row.get(4)?,
        delivered_to_client: row.get::<_, i64>(5)? != 0,
        approved: row.get::<_, i64>(6)? != 0,
        created_at: row.get(7)?,
    })
}

const PROJECT_DELIVERABLE_COLUMNS: &str = "id, project_id, name, type, link_or_path, delivered_to_client, approved, created_at";

#[derive(Deserialize)]
pub struct CreateProjectDeliverableData {
    pub project_id: String,
    pub name: String,
    pub r#type: Option<String>,
    pub link_or_path: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateProjectDeliverableData {
    pub name: String,
    pub r#type: Option<String>,
    pub link_or_path: Option<String>,
    pub delivered_to_client: bool,
    pub approved: bool,
}

#[tauri::command]
pub fn get_project_deliverables(db: State<'_, Mutex<Connection>>, project_id: String) -> Result<Vec<ProjectDeliverable>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!("SELECT {} FROM project_deliverables WHERE project_id = ?1 ORDER BY created_at ASC", PROJECT_DELIVERABLE_COLUMNS))
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![project_id], row_to_project_deliverable).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for d in rows {
        result.push(d.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn create_project_deliverable(db: State<'_, Mutex<Connection>>, data: CreateProjectDeliverableData) -> Result<ProjectDeliverable, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO project_deliverables (id, project_id, name, type, link_or_path, delivered_to_client, approved, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, ?6)",
        params![id, data.project_id, data.name, data.r#type, data.link_or_path, now],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "PROJECT_DELIVERABLE", Some(&id), &format!("Nouveau livrable: {}", data.name));

    Ok(ProjectDeliverable {
        id,
        project_id: data.project_id,
        name: data.name,
        r#type: data.r#type,
        link_or_path: data.link_or_path,
        delivered_to_client: false,
        approved: false,
        created_at: now,
    })
}

#[tauri::command]
pub fn update_project_deliverable(db: State<'_, Mutex<Connection>>, id: String, data: UpdateProjectDeliverableData) -> Result<ProjectDeliverable, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE project_deliverables SET name = ?2, type = ?3, link_or_path = ?4, delivered_to_client = ?5, approved = ?6 WHERE id = ?1",
        params![id, data.name, data.r#type, data.link_or_path, data.delivered_to_client as i64, data.approved as i64],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "UPDATE", "PROJECT_DELIVERABLE", Some(&id), &format!("Livrable mis à jour: {}", data.name));

    conn.query_row(
        &format!("SELECT {} FROM project_deliverables WHERE id = ?1", PROJECT_DELIVERABLE_COLUMNS),
        params![id],
        row_to_project_deliverable,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_project_deliverable(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM project_deliverables WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "DELETE", "PROJECT_DELIVERABLE", Some(&id), "Livrable supprimé");
    Ok(())
}

// ============= PDF GENERATION =============

#[tauri::command]
pub async fn generate_pdf(
    html_content: String, 
    paper_size: Option<String>, 
    landscape: Option<bool>
) -> Result<String, String> {
    crate::pdf_service::generate_pdf_from_html(&html_content, paper_size, landscape)
}

#[tauri::command]
pub async fn open_pdf(pdf_base64: String, file_name: String) -> Result<(), String> {
    use base64::{Engine as _, engine::general_purpose};
    use std::fs;
    use std::process::Command;

    // Decode base64 PDF
    let pdf_bytes = general_purpose::STANDARD
        .decode(&pdf_base64)
        .map_err(|e| format!("Failed to decode PDF: {}", e))?;

    // Write to temp file
    let temp_path = std::env::temp_dir().join(&file_name);
    fs::write(&temp_path, &pdf_bytes)
        .map_err(|e| format!("Failed to write temp PDF: {}", e))?;

    // Open with default OS application (Preview on macOS supports printing)
    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(temp_path.to_str().unwrap())
        .spawn()
        .map_err(|e| format!("Failed to open PDF: {}", e))?;

    #[cfg(target_os = "windows")]
    {
        // Use explorer.exe to correctly handle paths with spaces
        Command::new("explorer")
            .arg(temp_path.to_str().unwrap())
            .spawn()
            .map_err(|e| format!("Failed to open PDF: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(temp_path.to_str().unwrap())
        .spawn()
        .map_err(|e| format!("Failed to open PDF: {}", e))?;

    Ok(())
}

/// Opens an already-saved file (e.g. the path save_pdf/save_pdf_to_path just
/// wrote to) in the OS's default viewer for that file type — unlike
/// open_pdf above, which writes its own temp copy first, this opens the
/// real saved file directly. Used by the "Ouvrir" action on the
/// post-save toast across the document export flows.
#[tauri::command]
pub async fn open_file_path(path: String) -> Result<(), String> {
    use std::path::Path;
    use std::process::Command;

    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(format!("Le fichier n'existe pas ou n'est plus accessible : {}", path));
    }

    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Impossible d'ouvrir le fichier : {}", e))?;

    #[cfg(target_os = "windows")]
    Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Impossible d'ouvrir le fichier : {}", e))?;

    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Impossible d'ouvrir le fichier : {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn save_pdf(pdf_base64: String, file_name: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose};
    use std::fs;

    let pdf_bytes = general_purpose::STANDARD
        .decode(&pdf_base64)
        .map_err(|e| format!("Failed to decode PDF: {}", e))?;

    // Get the user's home directory from environment variables (cross-platform)
    let home_dir = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Could not find user home directory".to_string())?;

    let download_dir = std::path::PathBuf::from(home_dir).join("Downloads");

    // Create Downloads folder if it doesn't exist
    if !download_dir.exists() {
        fs::create_dir_all(&download_dir)
            .map_err(|e| format!("Failed to create Downloads directory: {}", e))?;
    }

    let file_path = download_dir.join(&file_name);

    fs::write(&file_path, &pdf_bytes)
        .map_err(|e| format!("Failed to write PDF to downloads: {}", e))?;

    let path_str = file_path.to_str()
        .ok_or_else(|| "Invalid file path".to_string())?;

    log::info!("PDF saved to: {}", path_str);
    Ok(path_str.to_string())
}

/// Writes PDF bytes to an exact, caller-chosen path — used when the user
/// picked the destination themselves via the native save dialog, as opposed
/// to save_pdf's fixed "always write to Downloads" behavior.
#[tauri::command]
pub async fn save_pdf_to_path(path: String, pdf_base64: String) -> Result<(), String> {
    use base64::{Engine as _, engine::general_purpose};
    use std::fs;

    let pdf_bytes = general_purpose::STANDARD
        .decode(&pdf_base64)
        .map_err(|e| format!("Failed to decode PDF: {}", e))?;

    fs::write(&path, &pdf_bytes)
        .map_err(|e| format!("Failed to write PDF to {}: {}", path, e))?;

    log::info!("PDF saved to: {}", path);
    Ok(())
}

#[tauri::command]
pub fn generate_invoice_from_delivery_notes(
    db: State<'_, Mutex<Connection>>,
    delivery_note_ids: Vec<String>,
    invoice_date: String,
    due_date: String,
) -> Result<Invoice, String> {
    crate::license::require_active_license()?;

    let mut conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let invoice_id = uuid::Uuid::new_v4().to_string();

    // Generate Invoice Number
    let invoice_number = generate_invoice_number(&conn).map_err(|e| e.to_string())?;
    crate::database::sync_invoice_sequence(&conn, &invoice_number).map_err(|e| e.to_string())?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 1. Get Client from first delivery note
    if delivery_note_ids.is_empty() {
        return Err("No delivery notes selected".to_string());
    }

    let first_id = &delivery_note_ids[0];
    let client_id: String = tx.query_row(
        "SELECT client_id FROM delivery_notes WHERE id = ?1",
        params![first_id],
        |row| row.get(0),
    ).map_err(|_| "Could not find delivery note or client".to_string())?;

    // 2. Create Invoice
    tx.execute(
        "INSERT INTO invoices (id, invoice_number, client_id, invoice_date, due_date, month_period, status, invoice_type, created_at, updated_at, discount, discount_type, discount_value, notes, header_note, custom_title) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, 'percent', 0, '', '', '')",
        params![
            invoice_id,
            invoice_number,
            client_id,
            invoice_date,
            due_date,
            chrono::NaiveDate::parse_from_str(&invoice_date, "%Y-%m-%d").unwrap_or_default().format("%Y-%m").to_string(),
            "draft",
            "invoice",
            now,
            now
        ],
    ).map_err(|e| e.to_string())?;

    // 3. Copy Items
    for note_id in &delivery_note_ids {
        let mut stmt = tx.prepare(
            "SELECT product_id, product_name, product_code, quantity, unit_price, tva_rate FROM delivery_note_items WHERE delivery_note_id = ?1"
        ).map_err(|e| e.to_string())?;

        let items: Vec<(Option<String>, Option<String>, Option<String>, f64, Option<f64>, Option<f64>)> = stmt.query_map(params![note_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?))
        }).map_err(|e| e.to_string())?
          .filter_map(Result::ok)
          .collect();

        for (product_id, product_name, product_code, quantity, delivery_unit_price, delivery_tva_rate) in items {
            // Catalog-bound items re-fetch the live price/TVA/timbre from the
            // products table (unchanged behavior); custom items (no
            // product_id) have no catalog row to look up, so their own
            // stored unit_price/tva_rate carry over instead.
            let (unit_price, tva_rate, timbre_exempt): (f64, f64, bool) = match &product_id {
                Some(pid) => tx.query_row(
                    "SELECT unit_price, tva_rate, timbre_exempt FROM products WHERE id = ?1",
                    params![pid],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get::<_, Option<bool>>(2)?.unwrap_or(false)))
                ).unwrap_or((delivery_unit_price.unwrap_or(0.0), delivery_tva_rate.unwrap_or(19.0), false)),
                None => (delivery_unit_price.unwrap_or(0.0), delivery_tva_rate.unwrap_or(19.0), false),
            };

            let item_id = uuid::Uuid::new_v4().to_string();
            let amount = quantity * unit_price;

            tx.execute(
                "INSERT INTO invoice_items (id, invoice_id, product_id, product_name, product_code, quantity, unit_price, amount, tva_rate, timbre_exempt, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![item_id, invoice_id, product_id, product_name, product_code, quantity, unit_price, amount, tva_rate, timbre_exempt, now],
            ).map_err(|e| e.to_string())?;
        }

        // 4. Mark Delivery Note as Invoiced
        tx.execute(
            "UPDATE delivery_notes SET is_invoiced = 1, invoice_id = ?2 WHERE id = ?1",
            params![note_id, invoice_id],
        ).map_err(|e| e.to_string())?;
    }

    // 5. Recalculate Totals
    recalculate_invoice_totals(&tx, &invoice_id).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "INVOICE", Some(&invoice_id), &format!("Facture générée depuis BL: {}", invoice_number));
    
    drop(conn);

    get_invoice(db, invoice_id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve new invoice".to_string())
}

// ============= CLIENT DRAFT PRODUCTS =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ClientDraftProduct {
    pub id: String,
    pub client_id: String,
    pub product_id: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub amount: f64,
    pub created_at: String,
    // Joined product fields for convenience
    pub product_code: Option<String>,
    pub product_name: Option<String>,
    pub tva_rate: Option<f64>,
    pub timbre_exempt: Option<bool>,
}

#[derive(Deserialize)]
pub struct CreateClientDraftProductData {
    pub client_id: String,
    pub product_id: String,
    pub quantity: f64,
    pub unit_price: f64,
}

#[tauri::command]
pub fn get_client_draft_products(db: State<'_, Mutex<Connection>>, client_id: String) -> Result<Vec<ClientDraftProduct>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT 
            c.id, c.client_id, c.product_id, c.quantity, c.unit_price, c.amount, c.created_at,
            p.code, p.name, p.tva_rate, p.timbre_exempt
         FROM client_draft_products c
         JOIN products p ON c.product_id = p.id
         WHERE c.client_id = ?1
         ORDER BY c.created_at ASC"
    ).map_err(|e| e.to_string())?;
    
    let drafts = stmt.query_map(params![client_id], |row| {
        Ok(ClientDraftProduct {
            id: row.get(0)?,
            client_id: row.get(1)?,
            product_id: row.get(2)?,
            quantity: row.get(3)?,
            unit_price: row.get(4)?,
            amount: row.get(5)?,
            created_at: row.get(6)?,
            product_code: row.get(7)?,
            product_name: row.get(8)?,
            tva_rate: row.get(9).ok(),
            timbre_exempt: row.get::<_, Option<i64>>(10).unwrap_or(Some(0)).map(|v| v != 0),
        })
    }).map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for draft in drafts {
        result.push(draft.map_err(|e| e.to_string())?);
    }
    
    Ok(result)
}

#[tauri::command]
pub fn add_client_draft_product(db: State<'_, Mutex<Connection>>, data: CreateClientDraftProductData) -> Result<ClientDraftProduct, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    
    // Check if product already exists for this client
    let mut check_stmt = conn.prepare(
        "SELECT id, quantity FROM client_draft_products WHERE client_id = ?1 AND product_id = ?2"
    ).map_err(|e| e.to_string())?;
    
    let existing_draft: Option<(String, f64)> = check_stmt.query_row(
        params![data.client_id, data.product_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).optional().map_err(|e| e.to_string())?;

    let final_id;

    if let Some((existing_id, existing_qty)) = existing_draft {
        // Update existing record
        final_id = existing_id;
        let new_qty = existing_qty + data.quantity;
        let new_amount = new_qty * data.unit_price;
        
        conn.execute(
            "UPDATE client_draft_products SET quantity = ?1, amount = ?2, unit_price = ?3 WHERE id = ?4",
            params![new_qty, new_amount, data.unit_price, final_id],
        ).map_err(|e| e.to_string())?;
        
        let _ = log_activity(&conn, "UPDATE", "CLIENT_DRAFT_PRODUCT", Some(&final_id), "Quantité mise à jour pour le produit en attente");

    } else {
        // Insert new record
        final_id = uuid::Uuid::new_v4().to_string();
        let amount = data.quantity * data.unit_price;
        
        conn.execute(
            "INSERT INTO client_draft_products (id, client_id, product_id, quantity, unit_price, amount, created_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![final_id, data.client_id, data.product_id, data.quantity, data.unit_price, amount, now],
        ).map_err(|e| e.to_string())?;
        
        let _ = log_activity(&conn, "CREATE", "CLIENT_DRAFT_PRODUCT", Some(&final_id), "Produit ajouté comme achat non facturé");
    }
    
    // Fetch newly created draft item with joined product details to return
    let mut stmt = conn.prepare(
        "SELECT 
            c.id, c.client_id, c.product_id, c.quantity, c.unit_price, c.amount, c.created_at,
            p.code, p.name, p.tva_rate, p.timbre_exempt
         FROM client_draft_products c
         JOIN products p ON c.product_id = p.id
         WHERE c.id = ?1"
    ).map_err(|e| e.to_string())?;
    
    let created = stmt.query_row(params![final_id], |row| {
        Ok(ClientDraftProduct {
            id: row.get(0)?,
            client_id: row.get(1)?,
            product_id: row.get(2)?,
            quantity: row.get(3)?,
            unit_price: row.get(4)?,
            amount: row.get(5)?,
            created_at: row.get(6)?,
            product_code: row.get(7)?,
            product_name: row.get(8)?,
            tva_rate: row.get(9).ok(),
            timbre_exempt: row.get::<_, Option<i64>>(10).unwrap_or(Some(0)).map(|v| v != 0),
        })
    }).map_err(|e| e.to_string())?;
    
    Ok(created)
}

#[tauri::command]
pub fn delete_client_draft_product(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM client_draft_products WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "DELETE", "CLIENT_DRAFT_PRODUCT", Some(&id), "Achat non facturé supprimé");
    Ok(())
}

#[derive(Deserialize)]
pub struct UpdateClientDraftProductQuantityData {
    pub id: String,
    pub quantity: f64,
}

#[tauri::command]
pub fn update_client_draft_product_quantity(db: State<'_, Mutex<Connection>>, data: UpdateClientDraftProductQuantityData) -> Result<ClientDraftProduct, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    
    // Get current unit price to recalculate amount
    let unit_price: f64 = conn.query_row(
        "SELECT unit_price FROM client_draft_products WHERE id = ?1",
        params![data.id],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    let new_amount = data.quantity * unit_price;
    
    conn.execute(
        "UPDATE client_draft_products SET quantity = ?1, amount = ?2 WHERE id = ?3",
        params![data.quantity, new_amount, data.id],
    ).map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "UPDATE", "CLIENT_DRAFT_PRODUCT", Some(&data.id), "Quantité mise à jour pour le produit en attente");

    // Fetch updated record to return
    let mut stmt = conn.prepare(
        "SELECT 
            c.id, c.client_id, c.product_id, c.quantity, c.unit_price, c.amount, c.created_at,
            p.code, p.name, p.tva_rate, p.timbre_exempt
         FROM client_draft_products c
         JOIN products p ON c.product_id = p.id
         WHERE c.id = ?1"
    ).map_err(|e| e.to_string())?;
    
    let updated = stmt.query_row(params![data.id], |row| {
        Ok(ClientDraftProduct {
            id: row.get(0)?,
            client_id: row.get(1)?,
            product_id: row.get(2)?,
            quantity: row.get(3)?,
            unit_price: row.get(4)?,
            amount: row.get(5)?,
            created_at: row.get(6)?,
            product_code: row.get(7)?,
            product_name: row.get(8)?,
            tva_rate: row.get(9).ok(),
            timbre_exempt: row.get::<_, Option<i64>>(10).unwrap_or(Some(0)).map(|v| v != 0),
        })
    }).map_err(|e| e.to_string())?;
    
    Ok(updated)
}

#[tauri::command]
pub fn clear_client_draft_products(db: State<'_, Mutex<Connection>>, client_id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM client_draft_products WHERE client_id = ?1", params![client_id]).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "DELETE", "CLIENT_DRAFT_PRODUCTS_CLEAR", Some(&client_id), "Achats non facturés convertis en facture");
    Ok(())
}

// ============= CLIENT ADVANCES =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ClientAdvance {
    pub id: String,
    pub client_id: String,
    pub amount: f64,
    pub date: String,
    pub payment_mode: String,
    pub reference: Option<String>,
    pub bank: Option<String>,
    pub issuer_name: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateClientAdvanceData {
    pub client_id: String,
    pub amount: f64,
    pub date: String,
    pub payment_mode: String,
    pub reference: Option<String>,
    pub bank: Option<String>,
    pub issuer_name: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub fn get_client_advances(db: State<'_, Mutex<Connection>>, client_id: String) -> Result<Vec<ClientAdvance>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM client_advances WHERE client_id = ?1 ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    
    let advances = stmt.query_map(params![client_id], |row| {
        Ok(ClientAdvance {
            id: row.get(0)?,
            client_id: row.get(1)?,
            amount: row.get(2)?,
            date: row.get(3)?,
            payment_mode: row.get(4)?,
            reference: row.get(5)?,
            bank: row.get(6)?,
            issuer_name: row.get(7)?,
            notes: row.get(8)?,
            created_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for advance in advances {
        result.push(advance.map_err(|e| e.to_string())?);
    }
    
    Ok(result)
}

#[tauri::command]
pub fn add_client_advance(db: State<'_, Mutex<Connection>>, data: CreateClientAdvanceData) -> Result<ClientAdvance, String> {
    crate::license::require_active_license()?;

    let mut conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    // Insert into client_advances
    tx.execute(
        "INSERT INTO client_advances (id, client_id, amount, date, payment_mode, reference, bank, issuer_name, notes, created_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![id, data.client_id, data.amount, data.date, data.payment_mode, data.reference, data.bank, data.issuer_name, data.notes, now],
    ).map_err(|e| e.to_string())?;
    
    // Update client total advance_payment
    tx.execute(
        "UPDATE clients SET advance_payment = COALESCE(advance_payment, 0) + ?1 WHERE id = ?2",
        params![data.amount, data.client_id],
    ).map_err(|e| e.to_string())?;
    
    tx.commit().map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "CREATE", "CLIENT_ADVANCE", Some(&id), "Nouvelle avance ajoutée");
    
    Ok(ClientAdvance {
        id,
        client_id: data.client_id,
        amount: data.amount,
        date: data.date,
        payment_mode: data.payment_mode,
        reference: data.reference,
        bank: data.bank,
        issuer_name: data.issuer_name,
        notes: data.notes,
        created_at: now,
    })
}

#[derive(Deserialize)]
pub struct UpdateClientAdvanceData {
    pub id: String,
    pub amount: f64,
    pub date: String,
    pub payment_mode: String,
    pub reference: Option<String>,
    pub bank: Option<String>,
    pub issuer_name: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub fn update_client_advance(db: State<'_, Mutex<Connection>>, data: UpdateClientAdvanceData) -> Result<ClientAdvance, String> {
    crate::license::require_active_license()?;

    let mut conn = db.lock().map_err(|e| e.to_string())?;
    
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    // Get old amount and client_id
    let (old_amount, client_id): (f64, String) = tx.query_row(
        "SELECT amount, client_id FROM client_advances WHERE id = ?1",
        params![data.id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).map_err(|e| e.to_string())?;
    
    // Update client_advances table
    tx.execute(
        "UPDATE client_advances SET amount = ?1, date = ?2, payment_mode = ?3, reference = ?4, bank = ?5, issuer_name = ?6, notes = ?7 WHERE id = ?8",
        params![data.amount, data.date, data.payment_mode, data.reference, data.bank, data.issuer_name, data.notes, data.id],
    ).map_err(|e| e.to_string())?;
    
    // Update client total advance_payment (subtract old, add new)
    let difference = data.amount - old_amount;
    tx.execute(
        "UPDATE clients SET advance_payment = COALESCE(advance_payment, 0) + ?1 WHERE id = ?2",
        params![difference, client_id],
    ).map_err(|e| e.to_string())?;
    
    tx.commit().map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "UPDATE", "CLIENT_ADVANCE", Some(&data.id), "Avance mise à jour");
    
    // Fetch and return the updated row
    let mut stmt = conn.prepare("SELECT * FROM client_advances WHERE id = ?1").map_err(|e| e.to_string())?;
    let created_at: String = stmt.query_row(params![data.id], |row| row.get(9)).map_err(|e| e.to_string())?;
    
    Ok(ClientAdvance {
        id: data.id,
        client_id,
        amount: data.amount,
        date: data.date,
        payment_mode: data.payment_mode,
        reference: data.reference,
        bank: data.bank,
        issuer_name: data.issuer_name,
        notes: data.notes,
        created_at,
    })
}

#[tauri::command]
pub fn delete_client_advance(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let mut conn = db.lock().map_err(|e| e.to_string())?;
    
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    // Get old amount and client_id before deleting
    let (old_amount, client_id): (f64, String) = tx.query_row(
        "SELECT amount, client_id FROM client_advances WHERE id = ?1",
        params![id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).map_err(|e| format!("Failed to find advance for delete via id {}: {}", id, e))?;
    
    // Decrease client total advance_payment
    tx.execute(
        "UPDATE clients SET advance_payment = COALESCE(advance_payment, 0) - ?1 WHERE id = ?2",
        params![old_amount, client_id],
    ).map_err(|e| e.to_string())?;
    
    // Delete advance record
    tx.execute("DELETE FROM client_advances WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    
    tx.commit().map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "DELETE", "CLIENT_ADVANCE", Some(&id), "Avance supprimée");
    Ok(())
}

// ============= PDF BACKUP (omada-agency branch only) =============

fn sanitize_backup_path_component(raw: &str) -> String {
    raw.chars()
        .filter(|c| !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
        .collect::<String>()
        .trim()
        .to_string()
}

#[tauri::command]
pub fn save_pdf_backup(
    root_dir: String,
    client_name: String,
    doc_number: String,
    pdf_bytes: Vec<u8>,
) -> Result<(), String> {
    let client_name = sanitize_backup_path_component(&client_name);
    let doc_number = sanitize_backup_path_component(&doc_number);

    let client_dir = Path::new(&root_dir).join(&client_name);
    fs::create_dir_all(&client_dir).map_err(|e| e.to_string())?;

    let file_path = client_dir.join(format!("{} - {}.pdf", client_name, doc_number));
    fs::write(&file_path, &pdf_bytes).map_err(|e| e.to_string())?;

    Ok(())
}

/// Automatic rolling backup, run on a background thread once at app launch
/// and once on clean shutdown (see lib.rs::run()'s setup()) — independent of
/// the user-triggered `backup_database` command below. Uses its own
/// filename prefix (`sordi_backup_*`) so its 7-snapshot retention policy
/// never prunes a manual backup, and takes its own fresh `Connection` to the
/// db file rather than the app's shared `Mutex<Connection>`, so it can never
/// contend with (or block behind) normal app usage — WAL mode allows a
/// second reader connection to run concurrently with the app's writer.
pub fn create_rolling_backup(conn: &Connection, app_dir: &Path) -> Result<PathBuf, String> {
    let backups_dir = app_dir.join("backups");
    fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;

    // Seconds granularity: `VACUUM INTO` errors ("output file already
    // exists") rather than overwriting, and a minute-only timestamp collides
    // whenever the app launches twice within the same minute (observed in
    // practice during dev — restart, or a launch right after a shutdown
    // backup from the previous run).
    let timestamp = chrono::Local::now().format("%Y-%m-%d_%H%M%S");
    let dest = backups_dir.join(format!("sordi_backup_{}.db", timestamp));
    let dest_str = dest
        .to_str()
        .ok_or_else(|| "Chemin de destination invalide".to_string())?
        .to_string();

    conn.execute("VACUUM INTO ?1", params![dest_str]).map_err(|e| e.to_string())?;

    // Retention: keep only the 7 most recent rolling snapshots. The
    // "YYYY-MM-DD_HHmm" filename suffix sorts chronologically as plain text,
    // so a lexicographic sort is enough — no need to parse timestamps.
    let mut snapshots: Vec<PathBuf> = fs::read_dir(&backups_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("sordi_backup_") && n.ends_with(".db"))
                .unwrap_or(false)
        })
        .collect();
    snapshots.sort();
    if snapshots.len() > 7 {
        for old in &snapshots[..snapshots.len() - 7] {
            let _ = fs::remove_file(old);
        }
    }

    Ok(dest)
}

/// Snapshots the live database to a separate file using SQLite's native
/// `VACUUM INTO`. Unlike a plain file copy, this is atomic and safe to run
/// against a database the app is actively using — it reads through a
/// consistent snapshot without taking a long-lived lock, and it never
/// writes to (or even opens for writing) the source database file, so the
/// live `database.db`/`database-dev.db` this connection points at is
/// untouched either way.
///
/// `dest_path` lets the caller target a user-chosen location (e.g. from a
/// native save dialog); when omitted, a timestamped snapshot is written to
/// `<app_data_dir>/backups/`.
#[tauri::command]
pub fn backup_database(dest_path: Option<String>, db: State<'_, Mutex<Connection>>) -> Result<String, String> {
    let dest = match dest_path {
        Some(p) => PathBuf::from(p),
        None => {
            let backups_dir = app_data_dir().join("backups");
            fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;
            let timestamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
            backups_dir.join(format!("database-backup-{}.db", timestamp))
        }
    };

    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let dest_str = dest
        .to_str()
        .ok_or_else(|| "Chemin de destination invalide".to_string())?
        .to_string();

    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("VACUUM INTO ?1", params![dest_str])
        .map_err(|e| e.to_string())?;

    Ok(dest_str)
}

/// The newest backup's timestamp (RFC 3339, from the file's mtime) and size
/// in bytes, for the "last backup" readout in Paramètres > Sauvegarde.
/// Considers both the rolling snapshots (`sordi_backup_*.db`) and manual
/// ones (`database-backup-*.db`) — whichever is newest wins. `None` means no
/// backup exists yet (e.g. right after a fresh install, before the
/// launch-time rolling backup's background thread has finished).
#[tauri::command]
pub fn get_last_backup_info() -> Result<Option<(String, u64)>, String> {
    let backups_dir = app_data_dir().join("backups");
    if !backups_dir.exists() {
        return Ok(None);
    }

    let mut newest: Option<(std::time::SystemTime, PathBuf)> = None;
    for entry in fs::read_dir(&backups_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let is_backup = path
            .file_name()
            .and_then(|n| n.to_str())
            .map(|n| (n.starts_with("sordi_backup_") || n.starts_with("database-backup-")) && n.ends_with(".db"))
            .unwrap_or(false);
        if !is_backup {
            continue;
        }
        let modified = entry.metadata().map_err(|e| e.to_string())?.modified().map_err(|e| e.to_string())?;
        if newest.as_ref().map(|(t, _)| modified > *t).unwrap_or(true) {
            newest = Some((modified, path));
        }
    }

    let Some((modified, path)) = newest else { return Ok(None) };
    let size = fs::metadata(&path).map_err(|e| e.to_string())?.len();
    let datetime: chrono::DateTime<chrono::Local> = modified.into();
    Ok(Some((datetime.to_rfc3339(), size)))
}

/// Stages a chosen backup file to be restored on the next launch, then
/// restarts the app. A restore can't safely overwrite the live database
/// file while this process still holds it open through the shared
/// `Mutex<Connection>` — instead this copies the chosen file to
/// `<app_data_dir>/pending_restore.db` and calls `AppHandle::restart()`;
/// `lib.rs::run()`'s `setup()` checks for that marker before opening the
/// database on the next launch, takes a pre-restore safety snapshot of
/// whatever is still live, then swaps the restored file into place.
#[tauri::command]
pub fn restore_database(source_path: String, app: AppHandle) -> Result<(), String> {
    let source = PathBuf::from(&source_path);
    if !source.is_file() {
        return Err("Fichier de sauvegarde introuvable".to_string());
    }

    let pending = app_data_dir().join("pending_restore.db");
    fs::copy(&source, &pending).map_err(|e| e.to_string())?;

    app.restart();
}

// ============================================================================
// IPC ARG-BRIDGING SMOKE TEST
//
// Verifies, via a real Tauri mock app (tauri::test::mock_builder) rather
// than a running desktop window, the one thing that couldn't be confirmed by
// reading source alone: whether camelCase JSON arg names sent by the
// frontend (e.g. `invoiceType`) actually bind to snake_case Rust command
// parameters (e.g. `invoice_type`). Everything else this test touches
// (struct field names, which commands exist, that totals are server-
// computed) was already confirmed by direct source reading — this test's
// job is narrowly the IPC arg-name boundary.
//
// NOT YET COMPILED OR RUN — written against the API documented at
// docs.rs/tauri/2.9.5/tauri/test, not executed, since this environment has
// no Rust toolchain. Expect to need at least a small fix on first
// `cargo test` run; please paste back the first compiler error verbatim
// if it doesn't build clean.
// ============================================================================
#[cfg(test)]
mod ipc_arg_bridging_smoke_test {
    use super::*;
    use tauri::ipc::{CallbackFn, InvokeBody};
    use tauri::test::{get_ipc_response, mock_builder, mock_context, noop_assets, INVOKE_KEY};
    use tauri::webview::InvokeRequest;
    use tauri::{Manager, WebviewWindowBuilder};

    fn build_test_app() -> tauri::App<tauri::test::MockRuntime> {
        let app = mock_builder()
            .invoke_handler(tauri::generate_handler![
                crate::commands::get_clients,
                crate::commands::create_client,
                crate::commands::get_products,
                crate::commands::create_product,
                crate::commands::get_invoices,
                crate::commands::create_invoice,
                crate::commands::delete_invoice,
                crate::commands::delete_client,
                crate::commands::search_global,
                crate::commands::get_settings,
                crate::commands::update_settings,
                crate::commands::create_payment,
                crate::commands::delete_payment,
                crate::commands::delete_product,
                crate::commands::create_order,
                crate::commands::delete_order,
                crate::commands::update_product,
                crate::commands::create_project,
                crate::commands::create_expense,
                crate::commands::get_project_profitability,
                crate::commands::update_invoice,
                crate::commands::update_invoice_status,
            ])
            // NOT tauri::generate_context!() — that macro embeds macOS
            // bundle metadata (Info.plist) via a symbol meant to exist once
            // per binary. lib.rs::run() already calls it for the real app;
            // since `cargo test` links that same non-test code into the test
            // binary alongside this module, a second real generate_context!()
            // call here would redefine that symbol and fail to link. This is
            // the test-only equivalent Tauri ships specifically to avoid that.
            .build(mock_context(noop_assets()))
            .expect("failed to build mock Tauri app");

        // In-memory SQLite, isolated per test — never touches the real
        // user database (app_data_dir()/database.db). init_database() also runs
        // `PRAGMA foreign_keys = ON`, confirmed from database.rs — so client
        // and product rows must exist before an invoice can reference them.
        let conn = crate::database::init_database(":memory:")
            .expect("failed to init in-memory test database");
        app.manage(std::sync::Mutex::new(conn));

        app
    }

    fn invoke_json(
        webview: &tauri::WebviewWindow<tauri::test::MockRuntime>,
        cmd: &str,
        args: serde_json::Value,
    ) -> serde_json::Value {
        let response = get_ipc_response(
            webview,
            InvokeRequest {
                cmd: cmd.into(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: "http://tauri.localhost".parse().unwrap(),
                body: InvokeBody::Json(args),
                headers: Default::default(),
                invoke_key: INVOKE_KEY.to_string(),
            },
        )
        .unwrap_or_else(|e| panic!("invoke({}) failed at the IPC layer: {:?}", cmd, e));

        response
            .deserialize::<serde_json::Value>()
            .unwrap_or_else(|e| panic!("invoke({}) response failed to deserialize: {:?}", cmd, e))
    }

    #[test]
    fn get_invoices_accepts_camelcase_arg_names() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        // THE key assertion: Rust's get_invoices(status, invoice_type) takes
        // a snake_case parameter, but we send camelCase — exactly what
        // LocalAdapter.ts sends today (and what database.ts already sends in
        // production). If this doesn't error, the bridging is confirmed.
        let result = invoke_json(
            &webview,
            "get_invoices",
            serde_json::json!({ "status": "all", "invoiceType": "invoice" }),
        );

        println!("SMOKE_TEST get_invoices(camelCase args) response: {}", result);

        assert!(
            result.is_array(),
            "expected get_invoices to return a JSON array (even if empty) proving \
             {{status, invoiceType}} bound correctly to (status, invoice_type); got: {}",
            result
        );
    }

    #[test]
    fn create_invoice_full_roundtrip_computes_totals_server_side() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        // Prerequisite client (FK-enforced) — snake_case payload, matching
        // what LocalAdapter.ts's toSnakeCase() would send.
        let client = invoke_json(
            &webview,
            "create_client",
            serde_json::json!({ "data": { "name": "Client Smoke Test SARL" } }),
        );
        println!("SMOKE_TEST create_client response: {}", client);
        let client_id = client["id"].as_str().expect("client response missing id").to_string();

        // Prerequisite product.
        let product = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({
                "data": { "code": "GRAV-001", "name": "Gravier 0/31.5", "unit_price": 5000.0 }
            }),
        );
        println!("SMOKE_TEST create_product response: {}", product);
        let product_id = product["id"].as_str().expect("product response missing id").to_string();

        // The actual test: snake_case nested `data` payload for create_invoice,
        // paying in cash ("especes") to force a non-zero stamp duty, exactly
        // as LocalAdapter.ts's toSnakeCase(stripWriteMeta(input)) would build it.
        let invoice = invoke_json(
            &webview,
            "create_invoice",
            serde_json::json!({
                "data": {
                    "client_id": client_id,
                    "invoice_date": "2026-08-19",
                    "payment_method": "especes",
                    "items": [
                        {
                            "product_id": product_id,
                            "quantity": 12.0,
                            "unit_price": 5000.0,
                            "tva_rate": 19.0
                        }
                    ]
                }
            }),
        );
        println!("SMOKE_TEST create_invoice response:\n{}", serde_json::to_string_pretty(&invoice).unwrap());

        // Corrected against the real recalculate_invoice_totals/calculate_timbre
        // (database.rs) after the first run caught this test's own wrong
        // assumptions: the timbre base is per-item (HT + TVA) summed for
        // non-exempt items — NOT subtotal_ht alone — and calculate_timbre has
        // no upper cap at all (only a 5 DA floor). Matches
        // CONFORMITE_FACTURATION_ALGERIE.md's documented brackets/minimum too.
        //
        // subtotal_ht = 12 * 5000 = 60000
        // tva_amount = 60000 * 0.19 = 11400
        // timbre base = subtotal_ht + tva_amount = 71400 (30k < base <= 100k -> 1.5%)
        // timbre = 71400 * 0.015 = 1071.0 (no cap)
        // total_ttc = 60000 + 11400 + 1071 = 72471
        assert_eq!(invoice["subtotal_ht"].as_f64(), Some(60000.0), "subtotal_ht mismatch — items not summed as expected");
        assert_eq!(invoice["tva_amount"].as_f64(), Some(11400.0), "tva_amount mismatch — 19% TVA not applied as expected");
        assert_eq!(invoice["timbre"].as_f64(), Some(1071.0), "timbre mismatch — base should be (subtotal_ht + tva_amount), 1.5% bracket, no cap");
        assert_eq!(invoice["total_ttc"].as_f64(), Some(72471.0), "total_ttc mismatch — confirms Rust recalculates totals server-side, matching database.rs::recalculate_invoice_totals / calculate_timbre");
        // Confirms the earlier static-read finding: no `items` key on the
        // returned Invoice — it truly lives elsewhere (get_invoice_items).
        assert!(invoice.get("items").is_none(), "Invoice response unexpectedly includes an `items` field — contradicts the struct definition read earlier");
    }

    #[test]
    fn search_global_finds_matching_clients_and_invoices_via_real_ipc() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        let client = invoke_json(
            &webview,
            "create_client",
            serde_json::json!({ "data": { "name": "Zeroual Matériaux SARL", "code": "ZRL-01" } }),
        );
        let client_id = client["id"].as_str().unwrap().to_string();

        let product = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "code": "GRAV-001", "name": "Gravier", "unit_price": 1000.0 } }),
        );
        let product_id = product["id"].as_str().unwrap().to_string();

        invoke_json(
            &webview,
            "create_invoice",
            serde_json::json!({
                "data": {
                    "client_id": client_id,
                    "invoice_date": "2026-08-19",
                    "invoice_number": "ZR-9001",
                    "items": [{ "product_id": product_id, "quantity": 1.0, "unit_price": 1000.0 }]
                }
            }),
        );

        // Matches the client by a code substring, and the invoice by a
        // number substring, in one call — the actual IPC arg name is
        // "query" (no camelCase/snake_case ambiguity to bridge, unlike
        // status/invoiceType elsewhere), so this is mainly confirming the
        // response shape (nested clients[]/invoices[] arrays) round-trips
        // correctly through real (de)serialization.
        let result = invoke_json(&webview, "search_global", serde_json::json!({ "query": "ZR" }));
        println!("SMOKE_TEST search_global response:\n{}", serde_json::to_string_pretty(&result).unwrap());

        let clients = result["clients"].as_array().expect("clients should be an array");
        assert_eq!(clients.len(), 1, "expected exactly the one client whose code contains 'ZR'");
        assert_eq!(clients[0]["code"].as_str(), Some("ZRL-01"));

        let invoices = result["invoices"].as_array().expect("invoices should be an array");
        assert_eq!(invoices.len(), 1, "expected exactly the one invoice whose number contains 'ZR'");
        assert_eq!(invoices[0]["invoice_number"].as_str(), Some("ZR-9001"));
        assert_eq!(
            invoices[0]["client_name"].as_str(),
            Some("Zeroual Matériaux SARL"),
            "invoice hit should carry the joined client name for display"
        );

        // A term matching nothing must return empty arrays, not an error.
        let empty_result = invoke_json(&webview, "search_global", serde_json::json!({ "query": "nonexistent-xyz" }));
        assert_eq!(empty_result["clients"].as_array().unwrap().len(), 0);
        assert_eq!(empty_result["invoices"].as_array().unwrap().len(), 0);
    }

    // Reproduces the Settings.tsx save flow exactly: a HashMap<String,String>
    // covering every formData key (including a realistically-sized base64
    // PNG for stamp_data, matching what compressImage(dataUrl, 300) would
    // actually produce) sent in one update_settings call, then read back via
    // get_settings — checking whether a large image string survives the
    // real IPC round-trip, since the report was "preview shows it, but it's
    // gone after save."
    #[test]
    fn update_settings_roundtrips_a_realistic_stamp_image_payload() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        // ~300x120px worth of base64 noise, similar order of magnitude to a
        // real compressed stamp PNG (tens of KB as a data URL string).
        let fake_png_bytes = "A".repeat(60_000);
        let stamp_data_url = format!("data:image/png;base64,{}", fake_png_bytes);

        let mut settings_payload = serde_json::Map::new();
        settings_payload.insert("stamp_data".to_string(), serde_json::Value::String(stamp_data_url.clone()));
        settings_payload.insert("stamp_size".to_string(), serde_json::Value::String("96".to_string()));
        settings_payload.insert("signature_data".to_string(), serde_json::Value::String("".to_string()));
        settings_payload.insert("primary_color".to_string(), serde_json::Value::String("#0067F2".to_string()));

        let update_result = invoke_json(
            &webview,
            "update_settings",
            serde_json::json!({ "settings": settings_payload }),
        );
        println!("SMOKE_TEST update_settings response: {}", update_result);

        let fetched = invoke_json(&webview, "get_settings", serde_json::json!({}));
        let fetched_stamp = fetched["stamp_data"].as_str().unwrap_or("");
        assert_eq!(
            fetched_stamp.len(),
            stamp_data_url.len(),
            "stamp_data should round-trip at full length through update_settings -> get_settings"
        );
        assert_eq!(fetched_stamp, stamp_data_url);
    }

    // Reproduces the reported bug: create an auto-numbered invoice, delete
    // it, then create another — the second one used to keep climbing from
    // wherever the sequence counter was left (e.g. 006 after deleting an
    // invoice that had reached 005), instead of restarting from what's
    // actually in the table. After delete_invoice resyncs the sequence to
    // MAX(remaining invoice_number), an empty table means the next
    // generated number goes back to 001.
    #[test]
    fn deleting_all_invoices_resets_the_next_generated_number() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        let company_id = uuid::Uuid::new_v4().to_string();
        {
            // clients.company_id is FK-enforced — insert a minimal company
            // row directly rather than registering create_company in the
            // test harness just for this.
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO companies (id, name, created_at) VALUES (?1, 'Resync Test Co', ?2)",
                params![company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
        }

        let client = invoke_json(
            &webview,
            "create_client",
            serde_json::json!({ "data": { "company_id": company_id, "name": "Resync Test SARL" } }),
        );
        let client_id = client["id"].as_str().unwrap().to_string();

        let product = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "company_id": company_id, "code": "SVC-01", "name": "Service", "unit_price": 500.0 } }),
        );
        let product_id = product["id"].as_str().unwrap().to_string();

        let make_invoice = |webview: &tauri::WebviewWindow<tauri::test::MockRuntime>| -> serde_json::Value {
            invoke_json(
                webview,
                "create_invoice",
                serde_json::json!({
                    "data": {
                        "company_id": company_id,
                        "client_id": client_id,
                        "invoice_date": "2026-08-26",
                        "items": [{ "product_id": product_id, "quantity": 1.0, "unit_price": 500.0 }]
                    }
                }),
            )
        };

        let first = make_invoice(&webview);
        let first_number = first["invoice_number"].as_str().unwrap().to_string();
        let first_id = first["id"].as_str().unwrap().to_string();
        println!("SMOKE_TEST first invoice_number: {}", first_number);

        let second = make_invoice(&webview);
        let second_id = second["id"].as_str().unwrap().to_string();
        println!("SMOKE_TEST second invoice_number: {}", second["invoice_number"]);

        // Delete both — table is now empty of invoices.
        invoke_json(&webview, "delete_invoice", serde_json::json!({ "id": second_id }));
        invoke_json(&webview, "delete_invoice", serde_json::json!({ "id": first_id }));

        let third = make_invoice(&webview);
        let third_number = third["invoice_number"].as_str().unwrap().to_string();
        println!("SMOKE_TEST third invoice_number (after deleting all): {}", third_number);

        assert_eq!(
            third_number, first_number,
            "after deleting every invoice, the next created one should reuse the first number again, not keep climbing"
        );
    }

    // Verifies the "Hors Taxe / Sans TVA" tax mode end-to-end: a backdated
    // legacy invoice created with tax_mode "exempt" and every line's
    // tva_rate forced to 0 (as the frontend does before submit) should come
    // back with total_ttc exactly equal to subtotal_ht and tva_amount at
    // exactly 0 — the real recalculate_invoice_totals() computation, not a
    // client-side estimate.
    #[test]
    fn exempt_tax_mode_invoice_has_zero_tva_and_ttc_equals_ht() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        let company_id = uuid::Uuid::new_v4().to_string();
        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO companies (id, name, created_at) VALUES (?1, 'Exempt Test Co', ?2)",
                params![company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
        }

        let client = invoke_json(
            &webview,
            "create_client",
            serde_json::json!({ "data": { "company_id": company_id, "name": "Exempt Test Client" } }),
        );
        let client_id = client["id"].as_str().unwrap().to_string();

        let product = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "company_id": company_id, "code": "EXM-01", "name": "Prestation exonérée", "unit_price": 250000.0 } }),
        );
        let product_id = product["id"].as_str().unwrap().to_string();

        // Backdated invoice, explicitly under the "exempt" tax mode, with
        // the line's tva_rate already zeroed — exactly what NewInvoice.tsx
        // sends when the "Hors Taxe / Sans TVA" toggle is active.
        let invoice = invoke_json(
            &webview,
            "create_invoice",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "client_id": client_id,
                    "invoice_date": "2024-01-15",
                    "tax_mode": "exempt",
                    "items": [{ "product_id": product_id, "quantity": 2.0, "unit_price": 250000.0, "tva_rate": 0.0 }]
                }
            }),
        );
        println!("SMOKE_TEST exempt invoice response: {}", invoice);

        assert_eq!(invoice["tax_mode"].as_str(), Some("exempt"));
        let subtotal_ht = invoice["subtotal_ht"].as_f64().unwrap();
        let tva_amount = invoice["tva_amount"].as_f64().unwrap();
        let total_ttc = invoice["total_ttc"].as_f64().unwrap();

        assert_eq!(subtotal_ht, 500000.0, "2 x 250000 HT");
        assert_eq!(tva_amount, 0.0, "exempt mode must produce zero TVA");
        assert_eq!(total_ttc, subtotal_ht, "with zero TVA and no timbre (non-cash default), Total TTC must equal Total HT exactly");
    }

    // Reproduces the reported bug: deleting a client that still has an
    // invoice attached used to hit a raw SQLite FOREIGN KEY constraint
    // error, which the frontend's safeInvoke wrapper silently swallowed
    // into a fake success — the client just stayed forever with no
    // explanation. delete_client now checks for dependents up front and
    // returns one clear, actionable error instead of a raw SQL failure.
    #[test]
    fn delete_client_with_dependent_invoice_returns_clear_error_not_raw_sql_failure() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        let company_id = uuid::Uuid::new_v4().to_string();
        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO companies (id, name, created_at) VALUES (?1, 'Delete Guard Test Co', ?2)",
                params![company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
        }

        let client = invoke_json(
            &webview,
            "create_client",
            serde_json::json!({ "data": { "company_id": company_id, "name": "Blocked Delete Client" } }),
        );
        let client_id = client["id"].as_str().unwrap().to_string();

        let product = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "company_id": company_id, "code": "DEL-01", "name": "Service", "unit_price": 1000.0 } }),
        );
        let product_id = product["id"].as_str().unwrap().to_string();

        invoke_json(
            &webview,
            "create_invoice",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "client_id": client_id,
                    "invoice_date": "2026-08-26",
                    "items": [{ "product_id": product_id, "quantity": 1.0, "unit_price": 1000.0 }]
                }
            }),
        );

        // A command returning Result::Err(String) surfaces through
        // invoke_json's own panic path (it treats any IPC-layer failure —
        // including a command's own Err — as fatal via unwrap_or_else), so
        // this is checked with catch_unwind and the panic message inspected
        // directly, rather than expecting a JSON {"error": ...} payload.
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            invoke_json(&webview, "delete_client", serde_json::json!({ "id": client_id }))
        }));
        assert!(result.is_err(), "delete_client should reject while a dependent invoice exists");
        let panic_payload = result.unwrap_err();
        let error_message = panic_payload
            .downcast_ref::<String>()
            .cloned()
            .or_else(|| panic_payload.downcast_ref::<&str>().map(|s| s.to_string()))
            .unwrap_or_default();
        println!("SMOKE_TEST delete_client (blocked) panic message: {}", error_message);
        assert!(
            error_message.contains("facture liée") || error_message.contains("1 facture"),
            "expected a clear French message naming the blocking invoice, got: {}",
            error_message
        );

        // The client must still exist — the delete must not have partially
        // applied.
        let clients = invoke_json(&webview, "get_clients", serde_json::json!({ "companyId": company_id }));
        let still_exists = clients.as_array().unwrap().iter().any(|c| c["id"] == client_id);
        assert!(still_exists, "client must not be deleted while a dependent invoice still exists");
    }

    // Reproduces the second reported bug: an invoice with a real payment
    // recorded against it (e.g. a partial payment) used to hit the same
    // raw FOREIGN KEY constraint failure as the client-delete case,
    // because payments.invoice_id has no ON DELETE cascade. Unlike the
    // client/invoice relationship, a payment only exists to track money
    // against its one invoice, so it's safe (and correct) to delete it
    // alongside the invoice rather than blocking — this confirms that
    // now actually happens instead of the delete silently failing.
    #[test]
    fn delete_invoice_with_payment_cascades_the_payment_and_succeeds() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        let company_id = uuid::Uuid::new_v4().to_string();
        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO companies (id, name, created_at) VALUES (?1, 'Payment Cascade Test Co', ?2)",
                params![company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
        }

        let client = invoke_json(
            &webview,
            "create_client",
            serde_json::json!({ "data": { "company_id": company_id, "name": "Partial Payment Client" } }),
        );
        let client_id = client["id"].as_str().unwrap().to_string();

        let product = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "company_id": company_id, "code": "PAY-01", "name": "Service", "unit_price": 220000.0 } }),
        );
        let product_id = product["id"].as_str().unwrap().to_string();

        let invoice = invoke_json(
            &webview,
            "create_invoice",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "client_id": client_id,
                    "invoice_date": "2026-08-26",
                    "items": [{ "product_id": product_id, "quantity": 1.0, "unit_price": 220000.0 }]
                }
            }),
        );
        let invoice_id = invoice["id"].as_str().unwrap().to_string();

        invoke_json(
            &webview,
            "create_payment",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "invoice_id": invoice_id,
                    "payment_date": "2026-08-26",
                    "amount": 120000.0,
                    "payment_method": "transfer"
                }
            }),
        );

        // Must not panic — the old behavior was a raw SQLite FK error here.
        invoke_json(&webview, "delete_invoice", serde_json::json!({ "id": invoice_id }));

        let conn = app.state::<std::sync::Mutex<Connection>>();
        let conn = conn.lock().unwrap();
        let remaining_invoices: i64 = conn.query_row("SELECT COUNT(*) FROM invoices WHERE id = ?1", params![invoice_id], |r| r.get(0)).unwrap();
        let remaining_payments: i64 = conn.query_row("SELECT COUNT(*) FROM payments WHERE invoice_id = ?1", params![invoice_id], |r| r.get(0)).unwrap();
        assert_eq!(remaining_invoices, 0, "invoice should be deleted");
        assert_eq!(remaining_payments, 0, "payment should be cascade-deleted along with its invoice");
    }

    // The other side of the same fix: an invoice with a delivery note
    // attached should be blocked with a clear message (a delivery note is
    // an independent operational document, not something safe to
    // auto-delete), not hit a raw SQL failure either.
    #[test]
    fn delete_invoice_with_delivery_note_returns_clear_error() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        let company_id = uuid::Uuid::new_v4().to_string();
        let client_id;
        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO companies (id, name, created_at) VALUES (?1, 'Delivery Block Test Co', ?2)",
                params![company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
            client_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO clients (id, company_id, name, created_at, updated_at) VALUES (?1, ?2, 'DN Client', ?3, ?3)",
                params![client_id, company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
        }

        let product = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "company_id": company_id, "code": "DN-01", "name": "Service", "unit_price": 5000.0 } }),
        );
        let product_id = product["id"].as_str().unwrap().to_string();

        let invoice = invoke_json(
            &webview,
            "create_invoice",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "client_id": client_id,
                    "invoice_date": "2026-08-26",
                    "items": [{ "product_id": product_id, "quantity": 1.0, "unit_price": 5000.0 }]
                }
            }),
        );
        let invoice_id = invoice["id"].as_str().unwrap().to_string();

        // create_delivery_note's own payload has no invoice_id field (that
        // link is set by a separate command elsewhere in the real app, not
        // at creation) — inserted directly here since only the resulting
        // delivery_notes row with invoice_id set is what this test needs.
        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO delivery_notes (id, company_id, delivery_number, client_id, invoice_id, delivery_date, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
                params![
                    uuid::Uuid::new_v4().to_string(),
                    company_id,
                    "BL-TEST-01",
                    client_id,
                    invoice_id,
                    "2026-08-26",
                    chrono::Utc::now().to_rfc3339()
                ],
            )
            .unwrap();
        }

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            invoke_json(&webview, "delete_invoice", serde_json::json!({ "id": invoice_id }))
        }));
        assert!(result.is_err(), "delete_invoice should reject while a linked delivery note exists");
        let panic_payload = result.unwrap_err();
        let error_message = panic_payload
            .downcast_ref::<String>()
            .cloned()
            .or_else(|| panic_payload.downcast_ref::<&str>().map(|s| s.to_string()))
            .unwrap_or_default();
        assert!(
            error_message.contains("bon de livraison"),
            "expected a clear French message naming the blocking delivery note, got: {}",
            error_message
        );
    }

    // Part of the full delete-command audit: a product that's only ever
    // been used on an order (never invoiced or delivered) used to hit a
    // raw FOREIGN KEY failure — delete_product's "is this in use" check
    // only looked at invoice_items and delivery_note_items, missing
    // order_items entirely. It should now archive (is_active = 0) instead
    // of hard-deleting, exactly like the invoice/delivery-note cases
    // already handled.
    #[test]
    fn delete_product_used_only_on_an_order_archives_instead_of_hard_deleting() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        let company_id = uuid::Uuid::new_v4().to_string();
        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO companies (id, name, created_at) VALUES (?1, 'Product Archive Test Co', ?2)",
                params![company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
        }

        let product = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "company_id": company_id, "code": "ORD-ONLY-01", "name": "Order-only Service", "unit_price": 3000.0 } }),
        );
        let product_id = product["id"].as_str().unwrap().to_string();

        invoke_json(
            &webview,
            "create_order",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "order_date": "2026-08-26",
                    "items": [{ "product_id": product_id, "quantity": 1.0, "unit_price": 3000.0 }]
                }
            }),
        );

        // Must not panic — the old behavior was a raw SQLite FK error here
        // since order_items wasn't checked before the hard-delete branch.
        invoke_json(&webview, "delete_product", serde_json::json!({ "id": product_id }));

        let conn = app.state::<std::sync::Mutex<Connection>>();
        let conn = conn.lock().unwrap();
        let (still_exists, is_active): (i64, i64) = conn
            .query_row(
                "SELECT COUNT(*), COALESCE(MAX(is_active), -1) FROM products WHERE id = ?1",
                params![product_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(still_exists, 1, "product referenced by an order must be archived, not hard-deleted");
        assert_eq!(is_active, 0, "archived product should have is_active = 0");
    }

    // The order-side equivalent of the invoice/delivery-note check: an
    // order that already has a delivery note attached (a normal
    // order-to-delivery progression in this app) used to hit the same raw
    // FK failure on delete. Now blocked with a clear message instead.
    #[test]
    fn delete_order_with_delivery_note_returns_clear_error() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        let company_id = uuid::Uuid::new_v4().to_string();
        let client_id = uuid::Uuid::new_v4().to_string();
        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO companies (id, name, created_at) VALUES (?1, 'Order Delivery Block Test Co', ?2)",
                params![company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO clients (id, company_id, name, created_at, updated_at) VALUES (?1, ?2, 'Order DN Client', ?3, ?3)",
                params![client_id, company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
        }

        let order = invoke_json(
            &webview,
            "create_order",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "client_id": client_id,
                    "order_date": "2026-08-26",
                    "items": []
                }
            }),
        );
        let order_id = order["id"].as_str().unwrap().to_string();

        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO delivery_notes (id, company_id, delivery_number, client_id, order_id, delivery_date, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
                params![
                    uuid::Uuid::new_v4().to_string(),
                    company_id,
                    "BL-ORD-TEST-01",
                    client_id,
                    order_id,
                    "2026-08-26",
                    chrono::Utc::now().to_rfc3339()
                ],
            )
            .unwrap();
        }

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            invoke_json(&webview, "delete_order", serde_json::json!({ "id": order_id }))
        }));
        assert!(result.is_err(), "delete_order should reject while a linked delivery note exists");
        let panic_payload = result.unwrap_err();
        let error_message = panic_payload
            .downcast_ref::<String>()
            .cloned()
            .or_else(|| panic_payload.downcast_ref::<&str>().map(|s| s.to_string()))
            .unwrap_or_default();
        assert!(
            error_message.contains("bon de livraison"),
            "expected a clear French message naming the blocking delivery note, got: {}",
            error_message
        );
    }

    // Verifies the UNIQUE-constraint mapping added to update_product: two
    // products, then attempting to rename the second one's code to collide
    // with the first should return a clear French message instead of a
    // raw "UNIQUE constraint failed: products.code" SQLite error.
    #[test]
    fn update_product_with_duplicate_code_returns_friendly_error_not_raw_sql() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        let company_id = uuid::Uuid::new_v4().to_string();
        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO companies (id, name, created_at) VALUES (?1, 'Unique Code Test Co', ?2)",
                params![company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
        }

        invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "company_id": company_id, "code": "DUP-01", "name": "First Product", "unit_price": 100.0 } }),
        );
        let second = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "company_id": company_id, "code": "DUP-02", "name": "Second Product", "unit_price": 200.0 } }),
        );
        let second_id = second["id"].as_str().unwrap().to_string();

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            invoke_json(
                &webview,
                "update_product",
                serde_json::json!({ "id": second_id, "data": { "company_id": company_id, "code": "DUP-01", "name": "Second Product", "unit_price": 200.0 } }),
            )
        }));
        assert!(result.is_err(), "update_product should reject a duplicate code");
        let panic_payload = result.unwrap_err();
        let error_message = panic_payload
            .downcast_ref::<String>()
            .cloned()
            .or_else(|| panic_payload.downcast_ref::<&str>().map(|s| s.to_string()))
            .unwrap_or_default();
        assert!(
            !error_message.to_lowercase().contains("sqlite") && !error_message.to_lowercase().contains("constraint failed"),
            "error message must be the friendly mapped text, not raw SQLite wording: {}",
            error_message
        );
        assert!(
            error_message.contains("référence produit"),
            "expected the friendly duplicate-code message, got: {}",
            error_message
        );
    }

    // The spec's own verification scenario: create an invoice linked to a
    // project (via create_invoice's own project_id field, not the separate
    // assign_invoice_to_project command — this is the new "Projet associé"
    // dropdown path), add an expense to the same project, and confirm the
    // real-time financial summary (get_project_profitability) reflects the
    // exact arithmetic: revenue_ht = invoice's HT, direct_expenses = the
    // expense amount, net_margin = revenue_ht - direct_expenses.
    #[test]
    fn invoice_linked_at_creation_and_project_expense_produce_correct_profitability() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        let company_id = uuid::Uuid::new_v4().to_string();
        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO companies (id, name, created_at) VALUES (?1, 'Project Financials Test Co', ?2)",
                params![company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
        }

        let client = invoke_json(
            &webview,
            "create_client",
            serde_json::json!({ "data": { "company_id": company_id, "name": "Project Financials Client" } }),
        );
        let client_id = client["id"].as_str().unwrap().to_string();

        let project = invoke_json(
            &webview,
            "create_project",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "client_id": client_id,
                    "name": "Site Vitrine",
                    "service_categories": ["web_vitrine"],
                    "planned_budget": 200000.0
                }
            }),
        );
        let project_id = project["id"].as_str().unwrap().to_string();

        let product = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "company_id": company_id, "code": "PROJ-01", "name": "Développement", "unit_price": 300000.0 } }),
        );
        let product_id = product["id"].as_str().unwrap().to_string();

        // Invoice linked to the project at creation time via the new
        // project_id field on CreateInvoiceData — exactly what the
        // "Projet associé" dropdown sends.
        invoke_json(
            &webview,
            "create_invoice",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "client_id": client_id,
                    "invoice_date": "2026-08-26",
                    "project_id": project_id,
                    "items": [{ "product_id": product_id, "quantity": 1.0, "unit_price": 300000.0, "tva_rate": 19.0 }]
                }
            }),
        );

        invoke_json(
            &webview,
            "create_expense",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "expense_date": "2026-08-26",
                    "category": "Sous-traitance",
                    "amount": 80000.0,
                    "project_id": project_id
                }
            }),
        );

        let profitability = invoke_json(
            &webview,
            "get_project_profitability",
            serde_json::json!({ "projectId": project_id }),
        );
        println!("SMOKE_TEST project profitability: {}", profitability);

        let revenue_ht = profitability["revenue_ht"].as_f64().unwrap();
        let direct_expenses = profitability["direct_expenses"].as_f64().unwrap();
        let net_margin = profitability["net_margin"].as_f64().unwrap();
        let margin_percentage = profitability["margin_percentage"].as_f64().unwrap();

        assert_eq!(revenue_ht, 300000.0, "revenue_ht must be the invoice's subtotal_ht, not TTC");
        assert_eq!(direct_expenses, 80000.0);
        assert_eq!(net_margin, 220000.0, "300000 HT - 80000 expenses");
        assert!((margin_percentage - (220000.0 / 300000.0 * 100.0)).abs() < 0.001);
    }

    // Reproduces the user's exact report: editing an "exempt" tax-mode
    // invoice with 2 items, no project linked, fails with a generic
    // "Erreur lors de la mise à jour de la facture" in the UI. This
    // recreates the same invoice shape (exempt mode, 2 zero-TVA items, no
    // project_id key in the update payload — matching what the frontend
    // sends once createInvoiceSchema strips an absent/undefined
    // project_id) and calls update_invoice directly to see whether the
    // backend itself rejects it or whether the failure is purely
    // frontend-side.
    #[test]
    fn update_invoice_exempt_mode_two_items_no_project_succeeds() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        let company_id = uuid::Uuid::new_v4().to_string();
        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO companies (id, name, created_at) VALUES (?1, 'Update Repro Test Co', ?2)",
                params![company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
        }

        let client = invoke_json(
            &webview,
            "create_client",
            serde_json::json!({ "data": { "company_id": company_id, "name": "ETB" } }),
        );
        let client_id = client["id"].as_str().unwrap().to_string();

        let product1 = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "company_id": company_id, "code": "SITE-01", "name": "Site web + dashboard", "unit_price": 110000.0 } }),
        );
        let product1_id = product1["id"].as_str().unwrap().to_string();
        let product2 = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "company_id": company_id, "code": "BRAND-01", "name": "Branding", "unit_price": 100000.0 } }),
        );
        let product2_id = product2["id"].as_str().unwrap().to_string();

        let invoice = invoke_json(
            &webview,
            "create_invoice",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "client_id": client_id,
                    "invoice_date": "2026-01-12",
                    "tax_mode": "exempt",
                    "items": [
                        { "product_id": product1_id, "quantity": 1.0, "unit_price": 110000.0, "tva_rate": 0.0 },
                        { "product_id": product2_id, "quantity": 1.0, "unit_price": 100000.0, "tva_rate": 0.0 }
                    ]
                }
            }),
        );
        let invoice_id = invoice["id"].as_str().unwrap().to_string();

        // Update payload matching exactly what NewInvoice.tsx submits when
        // no project is selected (project_id omitted/undefined) — must not
        // panic. If this passes, the reported failure is frontend-side
        // (the Zod schema stripping project_id, or something else in the
        // browser), not a backend rejection.
        let original_number = invoice["invoice_number"].as_str().unwrap().to_string();
        let updated = invoke_json(
            &webview,
            "update_invoice",
            serde_json::json!({
                "id": invoice_id,
                "data": {
                    "company_id": company_id,
                    "client_id": client_id,
                    "invoice_date": "2026-01-12",
                    "tax_mode": "exempt",
                    "invoice_number": original_number,
                    "items": [
                        { "product_id": product1_id, "quantity": 1.0, "unit_price": 110000.0, "tva_rate": 0.0 },
                        { "product_id": product2_id, "quantity": 1.0, "unit_price": 100000.0, "tva_rate": 0.0 }
                    ]
                }
            }),
        );
        println!("SMOKE_TEST updated invoice: {}", updated);
        assert_eq!(updated["tax_mode"].as_str(), Some("exempt"));
        assert_eq!(updated["total_ttc"].as_f64(), Some(210000.0));
    }

    // Direct test of the SQL-level safety net: if invoice_number ever
    // arrives empty/absent on an update (the exact frontend race this was
    // reported against — a stale closure in the editable preview
    // resolving invoice_number to "" before existingInvoice loaded), the
    // update must keep the invoice's real number rather than writing NULL
    // and failing the whole save with a raw constraint error.
    #[test]
    fn update_invoice_with_empty_invoice_number_keeps_existing_number() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        let company_id = uuid::Uuid::new_v4().to_string();
        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO companies (id, name, created_at) VALUES (?1, 'Empty Number Test Co', ?2)",
                params![company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
        }

        let client = invoke_json(
            &webview,
            "create_client",
            serde_json::json!({ "data": { "company_id": company_id, "name": "Empty Number Client" } }),
        );
        let client_id = client["id"].as_str().unwrap().to_string();

        let product = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "company_id": company_id, "code": "EMPTY-01", "name": "Service", "unit_price": 50000.0 } }),
        );
        let product_id = product["id"].as_str().unwrap().to_string();

        let invoice = invoke_json(
            &webview,
            "create_invoice",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "client_id": client_id,
                    "invoice_date": "2026-08-26",
                    "items": [{ "product_id": product_id, "quantity": 1.0, "unit_price": 50000.0 }]
                }
            }),
        );
        let invoice_id = invoice["id"].as_str().unwrap().to_string();
        let original_number = invoice["invoice_number"].as_str().unwrap().to_string();

        // Explicit empty string, matching what a stale-closure spread
        // would produce (not an omitted key, which Option<String> would
        // treat identically at the SQL layer via NULLIF anyway).
        let updated = invoke_json(
            &webview,
            "update_invoice",
            serde_json::json!({
                "id": invoice_id,
                "data": {
                    "company_id": company_id,
                    "client_id": client_id,
                    "invoice_date": "2026-08-26",
                    "invoice_number": "",
                    "items": [{ "product_id": product_id, "quantity": 1.0, "unit_price": 50000.0 }]
                }
            }),
        );

        assert_eq!(
            updated["invoice_number"].as_str(),
            Some(original_number.as_str()),
            "an empty invoice_number in the update payload must not blank out the real one"
        );
    }

    // Accounting immutability: once an invoice has a real money/legal event
    // recorded against it (paid here), update_invoice must reject any
    // attempt to touch its header or line items — verified at the
    // transaction layer, i.e. the UPDATE never runs at all, not just that
    // the final row happens to look unchanged.
    #[test]
    fn update_invoice_blocks_when_paid() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        let company_id = uuid::Uuid::new_v4().to_string();
        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO companies (id, name, created_at) VALUES (?1, 'Locked Invoice Test Co', ?2)",
                params![company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
        }

        let client = invoke_json(
            &webview,
            "create_client",
            serde_json::json!({ "data": { "company_id": company_id, "name": "Locked Invoice Client" } }),
        );
        let client_id = client["id"].as_str().unwrap().to_string();

        let product = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "company_id": company_id, "code": "LOCK-01", "name": "Service", "unit_price": 50000.0 } }),
        );
        let product_id = product["id"].as_str().unwrap().to_string();

        let invoice = invoke_json(
            &webview,
            "create_invoice",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "client_id": client_id,
                    "invoice_date": "2026-08-26",
                    "items": [{ "product_id": product_id, "quantity": 1.0, "unit_price": 50000.0 }]
                }
            }),
        );
        let invoice_id = invoice["id"].as_str().unwrap().to_string();
        let original_notes = invoice["notes"].clone();

        // Mark it paid, exactly as the "Payée" status dropdown does.
        invoke_json(
            &webview,
            "update_invoice_status",
            serde_json::json!({ "id": invoice_id, "status": "paid" }),
        );

        // Now attempt a header edit — must be rejected before any UPDATE
        // runs, with the machine-checkable INVOICE_LOCKED prefix the
        // frontend matches on.
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            invoke_json(
                &webview,
                "update_invoice",
                serde_json::json!({
                    "id": invoice_id,
                    "data": {
                        "company_id": company_id,
                        "client_id": client_id,
                        "invoice_date": "2026-08-26",
                        "notes": "Tampered after payment",
                        "items": [{ "product_id": product_id, "quantity": 1.0, "unit_price": 50000.0 }]
                    }
                }),
            )
        }));
        assert!(result.is_err(), "update_invoice should reject editing a paid invoice");
        let panic_payload = result.unwrap_err();
        let error_message = panic_payload
            .downcast_ref::<String>()
            .cloned()
            .or_else(|| panic_payload.downcast_ref::<&str>().map(|s| s.to_string()))
            .unwrap_or_default();
        assert!(
            error_message.contains("INVOICE_LOCKED"),
            "expected the machine-checkable INVOICE_LOCKED error code, got: {}",
            error_message
        );

        // Prove the transaction layer, not just the API response: the
        // stored row must be byte-for-byte unchanged from before the
        // rejected update attempt.
        let conn = app.state::<std::sync::Mutex<Connection>>();
        let conn = conn.lock().unwrap();
        let stored_notes: Option<String> = conn
            .query_row("SELECT notes FROM invoices WHERE id = ?1", params![invoice_id], |row| row.get(0))
            .unwrap();
        assert_eq!(
            stored_notes.as_deref().unwrap_or(""),
            original_notes.as_str().unwrap_or(""),
            "a rejected update_invoice call must leave the stored row completely untouched"
        );
    }

    // Audit-trail integrity: a real invoice always carries its official
    // sequential number from the moment it's created (never a placeholder
    // that only becomes "real" later), so reverting one back to "draft"
    // must be rejected regardless of its current payment status.
    #[test]
    fn update_invoice_status_blocks_reverting_numbered_invoice_to_draft() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        let company_id = uuid::Uuid::new_v4().to_string();
        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO companies (id, name, created_at) VALUES (?1, 'Draft Revert Test Co', ?2)",
                params![company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
        }

        let client = invoke_json(
            &webview,
            "create_client",
            serde_json::json!({ "data": { "company_id": company_id, "name": "Draft Revert Client" } }),
        );
        let client_id = client["id"].as_str().unwrap().to_string();

        let product = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "company_id": company_id, "code": "DRAFT-01", "name": "Service", "unit_price": 20000.0 } }),
        );
        let product_id = product["id"].as_str().unwrap().to_string();

        // Freshly created, still just "issued" (never paid) — the guard
        // must fire purely off the invoice carrying a real number, not off
        // any payment/lock status.
        let invoice = invoke_json(
            &webview,
            "create_invoice",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "client_id": client_id,
                    "invoice_date": "2026-08-26",
                    "items": [{ "product_id": product_id, "quantity": 1.0, "unit_price": 20000.0 }]
                }
            }),
        );
        let invoice_id = invoice["id"].as_str().unwrap().to_string();
        assert_eq!(invoice["status"].as_str(), Some("issued"));

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            invoke_json(
                &webview,
                "update_invoice_status",
                serde_json::json!({ "id": invoice_id, "status": "draft" }),
            )
        }));
        assert!(result.is_err(), "update_invoice_status should reject reverting a numbered invoice to draft");
        let panic_payload = result.unwrap_err();
        let error_message = panic_payload
            .downcast_ref::<String>()
            .cloned()
            .or_else(|| panic_payload.downcast_ref::<&str>().map(|s| s.to_string()))
            .unwrap_or_default();
        assert!(
            error_message.contains("INVOICE_LOCKED"),
            "expected the machine-checkable INVOICE_LOCKED error code, got: {}",
            error_message
        );

        let conn = app.state::<std::sync::Mutex<Connection>>();
        let conn = conn.lock().unwrap();
        let stored_status: String = conn
            .query_row("SELECT status FROM invoices WHERE id = ?1", params![invoice_id], |row| row.get(0))
            .unwrap();
        assert_eq!(stored_status, "issued", "the stored status must remain unchanged after a rejected transition");
    }

    // Reproduces the reported bug: a payment whose invoice no longer
    // exists (an orphan left over from before delete_invoice cascaded
    // payments, or any similarly-inconsistent state) couldn't be deleted —
    // update_invoice_payment_status's query against the missing invoice
    // returned QueryReturnedNoRows, which propagated and failed the whole
    // delete_payment call even though the payment row itself had already
    // been removed. The payment stayed in the database forever with no
    // clear way to remove it, and the "Total Encaissé" summary kept
    // counting it. Deleting an orphaned payment must now succeed.
    #[test]
    fn delete_payment_with_missing_invoice_succeeds() {
        let app = build_test_app();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("failed to build mock webview");

        let company_id = uuid::Uuid::new_v4().to_string();
        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute(
                "INSERT INTO companies (id, name, created_at) VALUES (?1, 'Orphan Payment Test Co', ?2)",
                params![company_id, chrono::Utc::now().to_rfc3339()],
            )
            .unwrap();
        }

        let client = invoke_json(
            &webview,
            "create_client",
            serde_json::json!({ "data": { "company_id": company_id, "name": "Orphan Payment Client" } }),
        );
        let client_id = client["id"].as_str().unwrap().to_string();

        let product = invoke_json(
            &webview,
            "create_product",
            serde_json::json!({ "data": { "company_id": company_id, "code": "ORPHAN-01", "name": "Service", "unit_price": 65000.0 } }),
        );
        let product_id = product["id"].as_str().unwrap().to_string();

        let invoice = invoke_json(
            &webview,
            "create_invoice",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "client_id": client_id,
                    "invoice_date": "2026-08-26",
                    "items": [{ "product_id": product_id, "quantity": 1.0, "unit_price": 65000.0 }]
                }
            }),
        );
        let invoice_id = invoice["id"].as_str().unwrap().to_string();

        let payment = invoke_json(
            &webview,
            "create_payment",
            serde_json::json!({
                "data": {
                    "company_id": company_id,
                    "invoice_id": invoice_id,
                    "payment_date": "2026-08-26",
                    "amount": 65000.0,
                    "payment_method": "cash"
                }
            }),
        );
        let payment_id = payment["id"].as_str().unwrap().to_string();

        // Delete the invoice directly at the SQL level (bypassing
        // delete_invoice's own payments cascade), with FK enforcement
        // temporarily off for this one setup step, to reproduce the
        // orphaned state found in the field — an invoice removed before
        // that cascade fix existed (or via any other historical path) can
        // leave a payment pointing at a since-deleted invoice even though
        // FK enforcement is on in normal operation.
        {
            let conn = app.state::<std::sync::Mutex<Connection>>();
            let conn = conn.lock().unwrap();
            conn.execute_batch("PRAGMA foreign_keys = OFF;").unwrap();
            conn.execute("DELETE FROM invoices WHERE id = ?1", params![invoice_id]).unwrap();
            conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        }

        // Must not panic — the old behavior was propagating
        // QueryReturnedNoRows and failing the entire delete.
        invoke_json(&webview, "delete_payment", serde_json::json!({ "id": payment_id }));

        let conn = app.state::<std::sync::Mutex<Connection>>();
        let conn = conn.lock().unwrap();
        let remaining: i64 = conn.query_row("SELECT COUNT(*) FROM payments WHERE id = ?1", params![payment_id], |r| r.get(0)).unwrap();
        assert_eq!(remaining, 0, "orphaned payment must actually be deleted");
    }
}
