use crate::database::{generate_invoice_number, peek_next_invoice_number, generate_delivery_note_number, generate_order_number, recalculate_invoice_totals, update_invoice_payment_status};
use std::sync::Mutex;
use rusqlite::Connection;
use tauri::State;
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
pub async fn activate_license(license_key: String) -> Result<crate::license::LicenseStatus, String> {
    crate::license::activate(license_key).await
}

#[tauri::command]
pub async fn verify_license_background() -> crate::license::LicenseStatus {
    crate::license::verify_background().await
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
pub fn search_global(db: State<'_, Mutex<Connection>>, query: String) -> Result<GlobalSearchResults, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(GlobalSearchResults { clients: Vec::new(), invoices: Vec::new() });
    }
    let conn = db.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", trimmed);

    let mut client_stmt = conn
        .prepare("SELECT id, name, code FROM clients WHERE name LIKE ?1 OR code LIKE ?1 ORDER BY name LIMIT 5")
        .map_err(|e| e.to_string())?;
    let clients = client_stmt
        .query_map(params![pattern], |row| {
            Ok(ClientSearchHit { id: row.get(0)?, name: row.get(1)?, code: row.get(2)? })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut invoice_stmt = conn
        .prepare(
            "SELECT i.id, i.invoice_number, c.name, i.total_ttc \
             FROM invoices i LEFT JOIN clients c ON c.id = i.client_id \
             WHERE i.invoice_number LIKE ?1 ORDER BY i.invoice_date DESC LIMIT 5",
        )
        .map_err(|e| e.to_string())?;
    let invoices = invoice_stmt
        .query_map(params![pattern], |row| {
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

// ============= CLIENTS =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Client {
    pub id: String,
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

#[tauri::command]
pub fn get_clients(db: State<'_, Mutex<Connection>>) -> Result<Vec<Client>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, activite FROM clients ORDER BY name"
    ).map_err(|e| e.to_string())?;
    let clients = stmt.query_map([], |row| {
        Ok(Client {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            contact_person: row.get(3)?,
            phone: row.get(4)?,
            email: row.get(5)?,
            address: row.get(6)?,
            city: row.get(7)?,
            wilaya: row.get(8)?,
            nif: row.get(9)?,
            nis: row.get(10)?,
            rc: row.get(11)?,
            secondary_rc: row.get(12).unwrap_or(None),
            secondary_address: row.get(13).unwrap_or(None),
            ai: row.get(14).unwrap_or(None),
            credit_limit: row.get(15).unwrap_or(None),
            payment_terms_days: row.get(16).unwrap_or(None),
            notes: row.get(17).unwrap_or(None),
            is_active: row.get::<_, Option<i64>>(18)?.map(|v| v != 0),
            created_at: row.get(19)?,
            updated_at: row.get(20)?,
            initial_balance: row.get(21).unwrap_or(None),
            advance_payment: row.get(22).unwrap_or(None),
            activite: row.get(23).unwrap_or(None),
        })
    }).map_err(|e| e.to_string())?;
    
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
        "SELECT id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, activite FROM clients WHERE id = ?1"
    ).map_err(|e| e.to_string())?;
    let client = stmt.query_row(params![id], |row| {
        Ok(Client {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            contact_person: row.get(3)?,
            phone: row.get(4)?,
            email: row.get(5)?,
            address: row.get(6)?,
            city: row.get(7)?,
            wilaya: row.get(8)?,
            nif: row.get(9)?,
            nis: row.get(10)?,
            rc: row.get(11)?,
            secondary_rc: row.get(12).unwrap_or(None),
            secondary_address: row.get(13).unwrap_or(None),
            ai: row.get(14).unwrap_or(None),
            credit_limit: row.get(15).unwrap_or(None),
            payment_terms_days: row.get(16).unwrap_or(None),
            notes: row.get(17).unwrap_or(None),
            is_active: row.get::<_, Option<i64>>(18)?.map(|v| v != 0),
            created_at: row.get(19)?,
            updated_at: row.get(20)?,
            initial_balance: row.get(21).unwrap_or(None),
            advance_payment: row.get(22).unwrap_or(None),
            activite: row.get(23).unwrap_or(None),
        })
    });
    
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
        "INSERT INTO clients (id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, activite) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
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
pub fn update_client(db: State<'_, Mutex<Connection>>, id: String, data: CreateClientData) -> Result<Client, String> {
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
    conn.execute("DELETE FROM clients WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "DELETE", "CLIENT", Some(&id), "Client supprimé");
    Ok(())
}

// ============= PRODUCTS =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Product {
    pub id: String,
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

#[tauri::command]
pub fn get_products(db: State<'_, Mutex<Connection>>) -> Result<Vec<Product>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, code, name, description, unit, unit_price, tva_rate, is_active, display_order, created_at, updated_at, timbre_exempt FROM products WHERE is_active = 1 ORDER BY display_order").map_err(|e| e.to_string())?;
    let products = stmt.query_map([], |row| {
        Ok(Product {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            unit: row.get(4)?,
            unit_price: row.get(5)?,
            tva_rate: row.get(6)?,
            is_active: row.get::<_, Option<i64>>(7)?.map(|v| v != 0),
            display_order: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
            timbre_exempt: row.get::<_, Option<i64>>(11).unwrap_or(Some(0)).map(|v| v != 0),
        })
    }).map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for product in products {
        result.push(product.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[derive(Deserialize)]
pub struct CreateProductData {
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
        "INSERT INTO products (id, code, name, description, unit, unit_price, tva_rate, timbre_exempt, is_active, display_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            id,
            data.code,
            data.name,
            data.description,
            data.unit.unwrap_or_else(|| "tonne".to_string()),
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
    let mut stmt = conn.prepare("SELECT id, code, name, description, unit, unit_price, tva_rate, is_active, display_order, created_at, updated_at, timbre_exempt FROM products WHERE id = ?1").map_err(|e| e.to_string())?;
    stmt.query_row(params![id], |row| {
        Ok(Product {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            unit: row.get(4)?,
            unit_price: row.get(5)?,
            tva_rate: row.get(6)?,
            is_active: row.get::<_, Option<i64>>(7)?.map(|v| v != 0),
            display_order: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
            timbre_exempt: row.get::<_, Option<i64>>(11).unwrap_or(Some(0)).map(|v| v != 0),
        })
    }).map_err(|e| e.to_string())
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
    
    let mut stmt = conn.prepare("SELECT id, code, name, description, unit, unit_price, tva_rate, is_active, display_order, created_at, updated_at, timbre_exempt FROM products WHERE id = ?1").map_err(|e| e.to_string())?;
    stmt.query_row(params![id], |row| {
        Ok(Product {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            unit: row.get(4)?,
            unit_price: row.get(5)?,
            tva_rate: row.get(6)?,
            is_active: row.get::<_, Option<i64>>(7)?.map(|v| v != 0),
            display_order: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
            timbre_exempt: row.get::<_, Option<i64>>(11).unwrap_or(Some(0)).map(|v| v != 0),
        })
    }).map_err(|e| e.to_string())
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
            data.unit.unwrap_or_else(|| "tonne".to_string()),
            data.unit_price,
            data.tva_rate,
            data.timbre_exempt.map(|b| if b { 1 } else { 0 }),
            now,
        ],
    ).map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "UPDATE", "PRODUCT", Some(&id), &format!("Produit mis à jour: {}", data.name));
    
    let mut stmt = conn.prepare("SELECT id, code, name, description, unit, unit_price, tva_rate, is_active, display_order, created_at, updated_at, timbre_exempt FROM products WHERE id = ?1").map_err(|e| e.to_string())?;
    stmt.query_row(params![id], |row| {
        Ok(Product {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            unit: row.get(4)?,
            unit_price: row.get(5)?,
            tva_rate: row.get(6)?,
            is_active: row.get::<_, Option<i64>>(7)?.map(|v| v != 0),
            display_order: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
            timbre_exempt: row.get::<_, Option<i64>>(11).unwrap_or(Some(0)).map(|v| v != 0),
        })
    }).map_err(|e| e.to_string())
}


#[tauri::command]
pub fn delete_product(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    
    // Get product name for logging
    let mut stmt = conn.prepare("SELECT name FROM products WHERE id = ?1").map_err(|e| e.to_string())?;
    let name: String = stmt.query_row(params![id], |row| row.get(0)).unwrap_or("Inconnu".to_string());

    // Check if product is used in any invoice or delivery note items
    let mut stmt = conn.prepare("SELECT count(*) FROM invoice_items WHERE product_id = ?1").map_err(|e| e.to_string())?;
    let invoice_count: i64 = stmt.query_row(params![id], |row| row.get(0)).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT count(*) FROM delivery_note_items WHERE product_id = ?1").map_err(|e| e.to_string())?;
    let delivery_count: i64 = stmt.query_row(params![id], |row| row.get(0)).map_err(|e| e.to_string())?;
    
    if invoice_count > 0 || delivery_count > 0 {
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
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InvoiceItemWithProduct {
    pub id: String,
    pub invoice_id: String,
    pub product_id: String,
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
    pub items: Vec<InvoiceItemInput>,
}

#[derive(Deserialize)]
pub struct InvoiceItemInput {
    pub product_id: String,
    pub product_description: Option<String>,
    pub quantity: f64,
    pub unit_price: f64,
    pub tva_rate: Option<f64>,
    pub timbre_exempt: Option<bool>,
}

#[tauri::command]
pub fn get_invoices(db: State<'_, Mutex<Connection>>, status: Option<String>, invoice_type: Option<String>) -> Result<Vec<Invoice>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut query = "SELECT * FROM invoices".to_string();
    let mut conditions = Vec::new();
    
    if let Some(s) = status {
        conditions.push(format!("status = '{}'", s.replace("'", "''")));
    }
    if let Some(it) = invoice_type {
        conditions.push(format!("invoice_type = '{}'", it.replace("'", "''")));
    }
    
    if !conditions.is_empty() {
        query.push_str(&format!(" WHERE {}", conditions.join(" AND ")));
    }
    query.push_str(" ORDER BY invoice_date DESC");
    
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let invoices = stmt.query_map([], |row| {
        Ok(Invoice {
            id: row.get("id")?,
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
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ClientInfo {
    pub name: String,
    pub email: Option<String>,
}

#[tauri::command]
pub fn get_invoices_with_clients(db: State<'_, Mutex<Connection>>, status: Option<String>, invoice_type: Option<String>) -> Result<Vec<InvoiceWithClient>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    // Join query to fetch invoice and client name in one go
    let mut query = "
        SELECT 
            i.id, i.invoice_number, i.client_id, i.invoice_date, i.due_date, i.month_period, 
            i.subtotal_ht, i.tva_rate, i.tva_amount, i.timbre, i.total_ttc, i.amount_paid, 
            i.balance_due, i.status, i.invoice_type, i.original_invoice_id, i.notes, 
            i.created_at, i.updated_at, i.header_note, i.discount, i.discount_type, i.discount_value, i.use_secondary_register, i.custom_title, i.payment_method, i.selected_secondary_rc, i.selected_secondary_address, i.project_id,
            c.name, c.email
        FROM invoices i
        LEFT JOIN clients c ON i.client_id = c.id
    ".to_string();
    
    let mut conditions = Vec::new();
    
    if let Some(s) = status {
        conditions.push(format!("i.status = '{}'", s.replace("'", "''")));
    }
    if let Some(it) = invoice_type {
        conditions.push(format!("i.invoice_type = '{}'", it.replace("'", "''")));
    }
    
    if !conditions.is_empty() {
        query.push_str(&format!(" WHERE {}", conditions.join(" AND ")));
    }
    query.push_str(" ORDER BY i.invoice_date DESC");
    
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    // let column_count = stmt.column_count();
    
    let invoices = stmt.query_map([], |row| {
        let invoice = Invoice {
            id: row.get(0)?,
            invoice_number: row.get(1)?,
            client_id: row.get(2)?,
            invoice_date: row.get(3)?,
            due_date: row.get(4)?,
            month_period: row.get(5)?,
            subtotal_ht: row.get(6)?,
            tva_rate: row.get(7)?,
            tva_amount: row.get(8)?,
            timbre: row.get(9)?,
            total_ttc: row.get(10)?,
            amount_paid: row.get(11)?,
            balance_due: row.get(12)?,
            status: row.get(13)?,
            invoice_type: row.get(14)?,
            original_invoice_id: row.get(15)?,
            notes: row.get(16)?,
            created_at: row.get(17)?,
            updated_at: row.get(18)?,
            header_note: row.get(19).ok(),
            discount: row.get(20).ok(),
            discount_type: row.get(21).ok(),
            discount_value: row.get(22).ok(),
            use_secondary_register: row.get::<_, Option<i64>>(23).ok().flatten().map(|v| v != 0),
            custom_title: row.get(24).ok(),
            payment_method: row.get(25).ok(),
            selected_secondary_rc: row.get(26).ok(),
            selected_secondary_address: row.get(27).ok(),
            project_id: row.get(28).ok(),
        };

        let client_name: Option<String> = row.get(29).ok();
        let client_email: Option<String> = row.get(30).ok();
        
        let client_info = if let Some(name) = client_name {
            Some(ClientInfo { name, email: client_email })
        } else {
            None
        };

        Ok(InvoiceWithClient {
            invoice,
            clients: client_info,
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
        "SELECT ii.id, ii.invoice_id, ii.product_id, ii.quantity, ii.unit_price, ii.amount, ii.tva_rate, ii.timbre_exempt, COALESCE(p.code, ''), COALESCE(p.name, ''), COALESCE(ii.product_description, p.description), p.unit 
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
    
    let invoice_num = if let Some(num) = &data.invoice_number {
        num.clone()
    } else {
        generate_invoice_number(&conn).map_err(|e| e.to_string())?
    };

    let invoice_number = if data.invoice_number.is_some() {
        // If manually provided, take it as is.
        // SYNC sequence so next automatic number doesn't collide
        crate::database::sync_invoice_sequence(&conn, &invoice_num).map_err(|e| e.to_string())?;
        invoice_num
    } else {
        // If generated
        if invoice_type == "credit_note" {
            format!("AV-{}", invoice_num)
        } else if invoice_type == "proforma" {
            // Use a specific format for proforma
            let timestamp = chrono::Utc::now().timestamp();
            format!("PRO-{}", timestamp)
        } else {
            invoice_num
        }
    };
    
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    let insert_status = data.status.clone().unwrap_or_else(|| "issued".to_string());
    let insert_amount_paid = data.amount_paid.unwrap_or(0.0);

    tx.execute(
        "INSERT INTO invoices (id, invoice_number, client_id, invoice_date, due_date, month_period, notes, status, invoice_type, original_invoice_id, created_at, updated_at, header_note, discount, discount_type, discount_value, use_secondary_register, selected_secondary_rc, selected_secondary_address, custom_title, payment_method, amount_paid) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)",
        params![
            invoice_id, 
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
            insert_amount_paid
        ],
    ).map_err(|e| e.to_string())?;
    
    for item in data.items {
        let item_id = uuid::Uuid::new_v4().to_string();
        let amount = item.quantity * item.unit_price;
        tx.execute(
            "INSERT INTO invoice_items (id, invoice_id, product_id, product_description, quantity, unit_price, amount, tva_rate, timbre_exempt, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![item_id, invoice_id, item.product_id, item.product_description, item.quantity, item.unit_price, amount, item.tva_rate, item.timbre_exempt.unwrap_or(false), now],
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
    let now = chrono::Utc::now().to_rfc3339();
    
    // Sync sequence if number is updated
    if let Some(ref num) = data.invoice_number {
        crate::database::sync_invoice_sequence(&conn, num).map_err(|e| e.to_string())?;
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    // 1. Update invoice details
    tx.execute(
        "UPDATE invoices SET client_id = ?2, invoice_date = ?3, due_date = ?4, month_period = ?5, notes = ?6, updated_at = ?7, header_note = ?8, discount = ?9, discount_type = ?10, discount_value = ?11, use_secondary_register = ?12, selected_secondary_rc = ?13, selected_secondary_address = ?14, custom_title = ?15, invoice_number = ?16, payment_method = ?17, status = COALESCE(?18, status), amount_paid = COALESCE(?19, amount_paid) WHERE id = ?1",
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
            data.amount_paid
        ],
    ).map_err(|e| e.to_string())?;

    // 2. Delete existing items
    tx.execute("DELETE FROM invoice_items WHERE invoice_id = ?1", params![id]).map_err(|e| e.to_string())?;
    
    // 3. Insert new items
    for item in data.items {
        let item_id = uuid::Uuid::new_v4().to_string();
        let amount = item.quantity * item.unit_price;
            tx.execute(
                "INSERT INTO invoice_items (id, invoice_id, product_id, product_description, quantity, unit_price, amount, tva_rate, timbre_exempt, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    item_id,
                    id,
                    item.product_id,
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
    
    tx.commit().map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "UPDATE", "INVOICE", Some(&id), "Facture mise à jour");
    
    drop(conn);
    
    get_invoice(db, id).map_err(|e| e.to_string())?.ok_or_else(|| "Failed to retrieve updated invoice".to_string())
}
#[tauri::command]
pub fn get_next_invoice_number(db: State<'_, Mutex<Connection>>) -> Result<String, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    peek_next_invoice_number(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_invoice_status(db: State<'_, Mutex<Connection>>, id: String, status: String) -> Result<Invoice, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    
    if status == "paid" {
        conn.execute(
            "UPDATE invoices SET status = ?2, amount_paid = total_ttc, balance_due = 0 WHERE id = ?1", 
            params![id, status]
        ).map_err(|e| e.to_string())?;
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

    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM invoices WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
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

// ============= PAYMENTS =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Payment {
    pub id: String,
    pub invoice_id: String,
    pub payment_date: String,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub cheque_number: Option<String>,
    pub bank_name: Option<String>,
    pub value_date: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreatePaymentData {
    pub invoice_id: String,
    pub payment_date: String,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub cheque_number: Option<String>,
    pub bank_name: Option<String>,
    pub value_date: Option<String>,
    pub notes: Option<String>,
}

fn map_payment_row(row: &rusqlite::Row) -> rusqlite::Result<Payment> {
    Ok(Payment {
        id: row.get(0)?,
        invoice_id: row.get(1)?,
        payment_date: row.get(2)?,
        amount: row.get(3)?,
        payment_method: row.get(4)?,
        cheque_number: row.get(5)?,
        bank_name: row.get(6)?,
        value_date: row.get(7)?,
        notes: row.get(8)?,
        created_at: row.get(9)?,
    })
}

#[tauri::command]
pub fn get_payments(db: State<'_, Mutex<Connection>>, invoice_id: Option<String>) -> Result<Vec<Payment>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = if invoice_id.is_some() {
        conn.prepare("SELECT * FROM payments WHERE invoice_id = ?1 ORDER BY payment_date DESC").map_err(|e| e.to_string())?
    } else {
        conn.prepare("SELECT * FROM payments ORDER BY payment_date DESC").map_err(|e| e.to_string())?
    };
    
    let payments = if let Some(ref id) = invoice_id {
        stmt.query_map(params![id], map_payment_row)
    } else {
        stmt.query_map([], map_payment_row)
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
        "INSERT INTO payments (id, invoice_id, payment_date, amount, payment_method, cheque_number, bank_name, value_date, notes, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![id, data.invoice_id, data.payment_date, data.amount, data.payment_method, data.cheque_number, data.bank_name, data.value_date, data.notes, now],
    ).map_err(|e| e.to_string())?;
    
    update_invoice_payment_status(&conn, &data.invoice_id).map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "CREATE", "PAYMENT", Some(&id), &format!("Paiement reçu: {} DA", data.amount));
    
    let mut stmt = conn.prepare("SELECT * FROM payments WHERE id = ?1").map_err(|e| e.to_string())?;
    stmt.query_row(params![id], |row| {
        Ok(Payment {
            id: row.get(0)?, invoice_id: row.get(1)?, payment_date: row.get(2)?,
            amount: row.get(3)?, payment_method: row.get(4)?, cheque_number: row.get(5)?,
            bank_name: row.get(6)?, value_date: row.get(7)?, notes: row.get(8)?,
            created_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())
}

// ============= ORDERS =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Order {
    pub id: String,
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

#[tauri::command]
pub fn get_orders(db: State<'_, Mutex<Connection>>) -> Result<Vec<Order>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    // Handle both old and new schema (with/without supplier_name, payment_terms, payment_method)
    // Handle both old and new schema
    let mut stmt = conn.prepare(
        "SELECT id, order_number, client_id, 
                COALESCE(supplier_name, '') as supplier_name,
                order_date, delivery_date, 
                payment_terms, payment_method,
                CASE WHEN status IS NOT NULL THEN status ELSE 'draft' END as status,
                subtotal_ht, tva_rate, tva_amount, total_ttc, notes, month_period, 
                created_at, updated_at, custom_title,
                supplier_address, supplier_email, supplier_phone, supplier_rc, supplier_nif, supplier_nis, supplier_ai
         FROM orders ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;
    
    let orders = stmt.query_map([], |row| {
        let supplier_name: String = row.get(3)?;
        Ok(Order {
            id: row.get(0)?, 
            order_number: row.get(1)?, 
            client_id: row.get(2)?,
            supplier_name: if supplier_name.is_empty() { None } else { Some(supplier_name) },
            order_date: row.get(4)?, 
            delivery_date: row.get(5)?,
            payment_terms: row.get(6)?,
            payment_method: row.get(7)?,
            status: row.get(8)?,
            subtotal_ht: row.get(9)?, 
            tva_rate: row.get(10)?, 
            tva_amount: row.get(11)?,
            total_ttc: row.get(12)?, 
            notes: row.get(13)?, 
            month_period: row.get(14)?,
            created_at: row.get(15)?, 
            updated_at: row.get(16)?,
            custom_title: row.get(17)?,
            supplier_address: row.get(18).unwrap_or(None),
            supplier_email: row.get(19).unwrap_or(None),
            supplier_phone: row.get(20).unwrap_or(None),
            supplier_rc: row.get(21).unwrap_or(None),
            supplier_nif: row.get(22).unwrap_or(None),
            supplier_nis: row.get(23).unwrap_or(None),
            supplier_ai: row.get(24).unwrap_or(None),
        })
    }).map_err(|e| e.to_string())?;
    
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
        "SELECT id, order_number, client_id, 
                COALESCE(supplier_name, '') as supplier_name,
                order_date, delivery_date, 
                payment_terms, payment_method,
                CASE WHEN status IS NOT NULL THEN status ELSE 'draft' END as status,
                subtotal_ht, tva_rate, tva_amount, total_ttc, notes, month_period, 
                created_at, updated_at, custom_title,
                supplier_address, supplier_email, supplier_phone, supplier_rc, supplier_nif, supplier_nis, supplier_ai
         FROM orders WHERE id = ?1"
    ).map_err(|e| e.to_string())?;
    
    let order = stmt.query_row(params![id], |row| {
        let supplier_name: String = row.get(3)?;
        Ok(Order {
            id: row.get(0)?, 
            order_number: row.get(1)?, 
            client_id: row.get(2)?,
            supplier_name: if supplier_name.is_empty() { None } else { Some(supplier_name) },
            order_date: row.get(4)?, 
            delivery_date: row.get(5)?,
            payment_terms: row.get(6)?,
            payment_method: row.get(7)?,
            status: row.get(8)?,
            subtotal_ht: row.get(9)?, 
            tva_rate: row.get(10)?, 
            tva_amount: row.get(11)?,
            total_ttc: row.get(12)?, 
            notes: row.get(13)?, 
            month_period: row.get(14)?,
            created_at: row.get(15)?, 
            updated_at: row.get(16)?,
            custom_title: row.get(17)?,
            supplier_address: row.get(18).unwrap_or(None),
            supplier_email: row.get(19).unwrap_or(None),
            supplier_phone: row.get(20).unwrap_or(None),
            supplier_rc: row.get(21).unwrap_or(None),
            supplier_nif: row.get(22).unwrap_or(None),
            supplier_nis: row.get(23).unwrap_or(None),
            supplier_ai: row.get(24).unwrap_or(None),
        })
    });
    
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
        "INSERT INTO orders (id, order_number, client_id, supplier_name, order_date, delivery_date, payment_terms, payment_method, status, subtotal_ht, tva_rate, tva_amount, total_ttc, notes, month_period, created_at, updated_at, custom_title, supplier_address, supplier_email, supplier_phone, supplier_rc, supplier_nif, supplier_nis, supplier_ai) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25)",
        params![order_id, order_number, data.client_id, data.supplier_name, data.order_date, data.delivery_date, data.payment_terms, data.payment_method, "draft", subtotal, tva_rate, tva_amount, total_ttc, data.notes, month_period, now, now, data.custom_title, data.supplier_address, data.supplier_email, data.supplier_phone, data.supplier_rc, data.supplier_nif, data.supplier_nis, data.supplier_ai],
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
        "UPDATE orders SET client_id = ?2, supplier_name = ?3, order_date = ?4, delivery_date = ?5, payment_terms = ?6, payment_method = ?7, subtotal_ht = ?8, tva_rate = ?9, tva_amount = ?10, total_ttc = ?11, notes = ?12, month_period = ?13, updated_at = ?14, custom_title = ?15, order_number = COALESCE(?16, order_number), supplier_address = ?17, supplier_email = ?18, supplier_phone = ?19, supplier_rc = ?20, supplier_nif = ?21, supplier_nis = ?22, supplier_ai = ?23 WHERE id = ?1",
        params![id, data.client_id, data.supplier_name, data.order_date, data.delivery_date, data.payment_terms, data.payment_method, subtotal, tva_rate, tva_amount, total_ttc, data.notes, month_period, now, data.custom_title, data.order_number, data.supplier_address, data.supplier_email, data.supplier_phone, data.supplier_rc, data.supplier_nif, data.supplier_nis, data.supplier_ai],
    ).map_err(|e| e.to_string())?;
    
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
    conn.execute("DELETE FROM orders WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
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
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateDeliveryNoteData {
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
    pub items: Vec<DeliveryNoteItemInput>,
}

#[derive(Deserialize)]
pub struct DeliveryNoteItemInput {
    pub product_id: String,
    pub quantity: f64,
    pub product_description: Option<String>,
}

#[tauri::command]
pub fn get_delivery_notes(db: State<'_, Mutex<Connection>>, client_id: Option<String>, is_invoiced: Option<bool>) -> Result<Vec<DeliveryNote>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut query = "SELECT id, delivery_number, client_id, delivery_date, invoice_id, order_id, truck_plate, driver_name, deliverer_name, deliverer_nin, transporter_name, transporter_nin, delivery_location, client_received_date, client_signature, supplier_delivered_date, is_invoiced, notes, reserves, created_at, updated_at FROM delivery_notes".to_string();
    let mut conditions = Vec::new();
    
    if let Some(id) = client_id {
        conditions.push(format!("client_id = '{}'", id.replace("'", "''")));
    }
    if let Some(inv) = is_invoiced {
        conditions.push(format!("is_invoiced = {}", if inv { 1 } else { 0 }));
    }
    
    if !conditions.is_empty() {
        query.push_str(&format!(" WHERE {}", conditions.join(" AND ")));
    }
    query.push_str(" ORDER BY delivery_date DESC");
    
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let notes = stmt.query_map([], |row| {
        Ok(DeliveryNote {
            id: row.get(0)?,
            delivery_number: row.get(1)?,
            client_id: row.get(2)?,
            delivery_date: row.get(3)?,
            invoice_id: row.get(4)?,
            order_id: row.get(5)?,
            truck_plate: row.get(6)?,
            driver_name: row.get(7)?,
            deliverer_name: row.get(8)?,
            deliverer_nin: row.get(9)?,
            transporter_name: row.get(10)?,
            transporter_nin: row.get(11)?,
            delivery_location: row.get(12)?,
            client_received_date: row.get(13)?,
            client_signature: row.get(14)?,
            supplier_delivered_date: row.get(15)?,
            is_invoiced: row.get::<_, Option<i64>>(16)?.map(|v| v != 0),
            notes: row.get(17)?,
            reserves: row.get(18)?,
            created_at: row.get(19)?,
            updated_at: row.get(20)?,
        })
    }).map_err(|e| e.to_string())?;
    
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
        "SELECT id, delivery_number, client_id, delivery_date, invoice_id, order_id, truck_plate, driver_name, deliverer_name, deliverer_nin, transporter_name, transporter_nin, delivery_location, client_received_date, client_signature, supplier_delivered_date, is_invoiced, notes, reserves, created_at, updated_at FROM delivery_notes WHERE id = ?1"
    ).map_err(|e| e.to_string())?;
    let note = stmt.query_row(params![id], |row| {
        Ok(DeliveryNote {
            id: row.get(0)?,
            delivery_number: row.get(1)?,
            client_id: row.get(2)?,
            delivery_date: row.get(3)?,
            invoice_id: row.get(4)?,
            order_id: row.get(5)?,
            truck_plate: row.get(6)?,
            driver_name: row.get(7)?,
            deliverer_name: row.get(8)?,
            deliverer_nin: row.get(9)?,
            transporter_name: row.get(10)?,
            transporter_nin: row.get(11)?,
            delivery_location: row.get(12)?,
            client_received_date: row.get(13)?,
            client_signature: row.get(14)?,
            supplier_delivered_date: row.get(15)?,
            is_invoiced: row.get::<_, Option<i64>>(16)?.map(|v| v != 0),
            notes: row.get(17)?,
            reserves: row.get(18)?,
            created_at: row.get(19)?,
            updated_at: row.get(20)?,
        })
    });
    
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
        "INSERT INTO delivery_notes (id, delivery_number, client_id, delivery_date, order_id, truck_plate, driver_name, deliverer_name, deliverer_nin, transporter_name, transporter_nin, delivery_location, notes, reserves, is_invoiced, created_at, updated_at, custom_title) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
        params![note_id, delivery_number, data.client_id, data.delivery_date, data.order_id, data.truck_plate, data.driver_name, data.deliverer_name, data.deliverer_nin, data.transporter_name, data.transporter_nin, data.delivery_location, data.notes, data.reserves, 0i64, now, now, data.custom_title],
    ).map_err(|e| e.to_string())?;
    
    for item in data.items {
        let item_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO delivery_note_items (id, delivery_note_id, product_id, quantity, product_description, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![item_id, note_id, item.product_id, item.quantity, item.product_description, now],
        ).map_err(|e| e.to_string())?;
    }
    
    tx.commit().map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "CREATE", "DELIVERY", Some(&note_id), &format!("Bon de livraison créé: {}", delivery_number));
    
    let mut stmt = conn.prepare(
        "SELECT id, delivery_number, client_id, delivery_date, invoice_id, order_id, truck_plate, driver_name, deliverer_name, deliverer_nin, transporter_name, transporter_nin, delivery_location, client_received_date, client_signature, supplier_delivered_date, is_invoiced, notes, reserves, created_at, updated_at FROM delivery_notes WHERE id = ?1"
    ).map_err(|e| e.to_string())?;
    stmt.query_row(params![note_id], |row| {
        Ok(DeliveryNote {
            id: row.get(0)?,
            delivery_number: row.get(1)?,
            client_id: row.get(2)?,
            delivery_date: row.get(3)?,
            invoice_id: row.get(4)?,
            order_id: row.get(5)?,
            truck_plate: row.get(6)?,
            driver_name: row.get(7)?,
            deliverer_name: row.get(8)?,
            deliverer_nin: row.get(9)?,
            transporter_name: row.get(10)?,
            transporter_nin: row.get(11)?,
            delivery_location: row.get(12)?,
            client_received_date: row.get(13)?,
            client_signature: row.get(14)?,
            supplier_delivered_date: row.get(15)?,
            is_invoiced: row.get::<_, Option<i64>>(16)?.map(|v| v != 0),
            notes: row.get(17)?,
            reserves: row.get(18)?,
            created_at: row.get(19)?,
            updated_at: row.get(20)?,
        })
    }).map_err(|e| e.to_string())
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
            delivery_number = ?16
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
            data.delivery_number
        ],
    ).map_err(|e| e.to_string())?;
    
    // Delete existing items
    tx.execute(
        "DELETE FROM delivery_note_items WHERE delivery_note_id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;
    
    // Insert new items
    for item in data.items {
        let item_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO delivery_note_items (id, delivery_note_id, product_id, quantity, product_description, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![item_id, id, item.product_id, item.quantity, item.product_description, now],
        ).map_err(|e| e.to_string())?;
    }
    
    tx.commit().map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "UPDATE", "DELIVERY", Some(&id), &format!("Bon de livraison mis à jour: {}", data.delivery_number.unwrap_or_default()));
    
    let mut stmt = conn.prepare(
        "SELECT id, delivery_number, client_id, delivery_date, invoice_id, order_id, truck_plate, driver_name, deliverer_name, deliverer_nin, transporter_name, transporter_nin, delivery_location, client_received_date, client_signature, supplier_delivered_date, is_invoiced, notes, reserves, created_at, updated_at FROM delivery_notes WHERE id = ?1"
    ).map_err(|e| e.to_string())?;
    
    stmt.query_row(params![id], |row| {
        Ok(DeliveryNote {
            id: row.get(0)?,
            delivery_number: row.get(1)?,
            client_id: row.get(2)?,
            delivery_date: row.get(3)?,
            invoice_id: row.get(4)?,
            order_id: row.get(5)?,
            truck_plate: row.get(6)?,
            driver_name: row.get(7)?,
            deliverer_name: row.get(8)?,
            deliverer_nin: row.get(9)?,
            transporter_name: row.get(10)?,
            transporter_nin: row.get(11)?,
            delivery_location: row.get(12)?,
            client_received_date: row.get(13)?,
            client_signature: row.get(14)?,
            supplier_delivered_date: row.get(15)?,
            is_invoiced: row.get::<_, Option<i64>>(16)?.map(|v| v != 0),
            notes: row.get(17)?,
            reserves: row.get(18)?,
            created_at: row.get(19)?,
            updated_at: row.get(20)?,
        })
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_delivery_note_items(
    db: State<'_, Mutex<Connection>>, 
    #[allow(non_snake_case)] deliveryNoteId: String
) -> Result<Vec<DeliveryNoteItemWithProduct>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT dni.id, dni.delivery_note_id, dni.product_id, dni.quantity,
                p.code, p.name, p.unit, p.unit_price, COALESCE(dni.product_description, p.description), dni.tva_rate, dni.unit_price
         FROM delivery_note_items dni 
         LEFT JOIN products p ON dni.product_id = p.id 
         WHERE dni.delivery_note_id = ?1 
         ORDER BY dni.created_at"
    ).map_err(|e| e.to_string())?;
    
    let items = stmt.query_map(params![deliveryNoteId], |row| {
        let tva_rate: Option<f64> = row.get(9)?;
        let dni_unit_price: Option<f64> = row.get(10)?;
        
        Ok(DeliveryNoteItemWithProduct {
            id: row.get(0)?,
            delivery_note_id: row.get(1)?,
            product_id: row.get(2)?,
            quantity: row.get(3)?,
            tva_rate: tva_rate,
            unit_price: dni_unit_price,
            product_description: row.get(8)?,
            products: {
                let code: Option<String> = row.get(4)?;
                let name: Option<String> = row.get(5)?;
                let unit: Option<String> = row.get(6)?;
                let unit_price_from_p: Option<f64> = row.get(7)?;
                let description: Option<String> = row.get(8)?;
                
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
    pub product_id: String,
    pub quantity: f64,
    pub unit_price: Option<f64>,
    pub tva_rate: Option<f64>,
    pub product_description: Option<String>,
    pub products: Option<ProductInfoWithUnit>,
}

// ============= EXPENSES =============

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Expense {
    pub id: String,
    pub expense_date: String,
    pub category: String,
    pub description: Option<String>,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
    pub month_period: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateExpenseData {
    pub expense_date: String,
    pub category: String,
    pub description: Option<String>,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
}

fn map_expense_row(row: &rusqlite::Row) -> rusqlite::Result<Expense> {
    Ok(Expense {
        id: row.get(0)?,
        expense_date: row.get(1)?,
        category: row.get(2)?,
        description: row.get(3)?,
        amount: row.get(4)?,
        payment_method: row.get(5)?,
        reference: row.get(6)?,
        notes: row.get(7)?,
        month_period: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

#[tauri::command]
pub fn get_expenses(db: State<'_, Mutex<Connection>>, month_period: Option<String>) -> Result<Vec<Expense>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = if month_period.is_some() {
        conn.prepare("SELECT * FROM expenses WHERE month_period = ?1 ORDER BY expense_date DESC").map_err(|e| e.to_string())?
    } else {
        conn.prepare("SELECT * FROM expenses ORDER BY expense_date DESC").map_err(|e| e.to_string())?
    };
    
    let expenses = if let Some(ref p) = month_period {
        stmt.query_map(params![p], map_expense_row)
    } else {
        stmt.query_map([], map_expense_row)
    }.map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for expense in expenses {
        result.push(expense.map_err(|e| e.to_string())?);
    }
    Ok(result)
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
        "INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![id, data.expense_date, data.category, data.description, data.amount, data.payment_method, data.reference, data.notes, month_period, now, now],
    ).map_err(|e| e.to_string())?;
    
    let _ = log_activity(&conn, "CREATE", "EXPENSE", Some(&id), &format!("Dépense créée: {} DA", data.amount));
    
    let mut stmt = conn.prepare("SELECT * FROM expenses WHERE id = ?1").map_err(|e| e.to_string())?;
    stmt.query_row(params![id], |row| {
        Ok(Expense {
            id: row.get(0)?, expense_date: row.get(1)?, category: row.get(2)?,
            description: row.get(3)?, amount: row.get(4)?, payment_method: row.get(5)?,
            reference: row.get(6)?, notes: row.get(7)?, month_period: row.get(8)?,
            created_at: row.get(9)?, updated_at: row.get(10)?,
        })
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_expense(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM expenses WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "DELETE", "EXPENSE", Some(&id), "Dépense supprimée");
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
        WHERE i.client_id = ?1 AND i.invoice_type NOT IN ('credit_note', 'proforma')".to_string();
    
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
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) 
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        params![key, value],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn update_settings(db: State<'_, Mutex<Connection>>, settings: std::collections::HashMap<String, String>) -> Result<(), String> {
    crate::license::require_active_license()?;

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
pub fn get_product_sales_stats(db: State<'_, Mutex<Connection>>, year: Option<i64>, months: Option<Vec<String>>) -> Result<Vec<ProductSalesStat>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    
    let mut query = String::from(
        "SELECT p.id, p.name, p.code, SUM(ii.quantity) as total_quantity, SUM(ii.amount) as total_amount
         FROM invoice_items ii
         JOIN invoices i ON ii.invoice_id = i.id
         JOIN products p ON ii.product_id = p.id
         WHERE i.invoice_type NOT IN ('credit_note', 'proforma')"
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
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TimePointStats {
    pub label: String,
    pub revenue: f64,
    pub expenses: f64,
    pub profit: f64,
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
    year: Option<i64>,
    months: Option<Vec<String>>
) -> Result<Vec<CumulativeSalesRecord>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let target_year = year.unwrap_or_else(|| chrono::Local::now().year() as i64);

    let mut date_filter = format!("strftime('%Y', i.invoice_date) = '{}'", target_year);

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
    year: Option<i64>,
    months: Option<Vec<String>>
) -> Result<Vec<ClientCumulativeRecord>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let target_year = year.unwrap_or_else(|| chrono::Local::now().year() as i64);

    let mut date_filter = format!("strftime('%Y', i.invoice_date) = '{}'", target_year);

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
        conn.prepare("SELECT id, payment_terms_days, created_at FROM clients WHERE id = ?1")
    } else {
        conn.prepare("SELECT id, payment_terms_days, created_at FROM clients")
    }.map_err(|e| e.to_string())?;
    let map_client_row = |row: &rusqlite::Row| -> rusqlite::Result<ClientRow> {
        Ok(ClientRow {
            id: row.get(0)?,
            payment_terms_days: row.get(1)?,
            created_at: row.get(2)?,
        })
    };
    let client_rows: Vec<ClientRow> = if let Some(ref id) = client_id {
        client_stmt.query_map(params![id], map_client_row)
    } else {
        client_stmt.query_map([], map_client_row)
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
        WHERE invoice_type != 'proforma' AND status != 'cancelled'{} \
        ORDER BY invoice_date DESC, created_at DESC";
    let mut invoice_stmt = if client_id.is_some() {
        conn.prepare(&invoice_sql.replace("{}", " AND client_id = ?1"))
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
        invoice_stmt.query_map(params![id], map_invoice_row)
    } else {
        invoice_stmt.query_map([], map_invoice_row)
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
    year: Option<i64>, 
    months: Option<Vec<String>>
) -> Result<DashboardStats, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let target_year = year.unwrap_or_else(|| chrono::Local::now().year() as i64);
    
    // 1. Initial Debt 
    let initial_debt: f64 = conn.query_row(
        "SELECT COALESCE(SUM(initial_balance), 0.0) FROM clients",
        [],
        |row| row.get(0)
    ).unwrap_or(0.0);

    // 2. Filter Logic
    let mut invoice_date_filter = format!("strftime('%Y', invoice_date) = '{}'", target_year);
    let mut expense_date_filter = format!("strftime('%Y', expense_date) = '{}'", target_year);
    
    let is_daily_view = months.as_ref().map(|m| m.len() == 1).unwrap_or(false);
    
    if let Some(ref m_list) = months {
        if !m_list.is_empty() {
             let padded_months: Vec<String> = m_list.iter().map(|m| {
                if m.len() == 1 { format!("0{}", m) } else { m.clone() }
            }).collect();
            let months_str = padded_months.iter().map(|m| format!("'{}'", m)).collect::<Vec<_>>().join(",");
            
            invoice_date_filter.push_str(&format!(" AND strftime('%m', invoice_date) IN ({})", months_str));
            expense_date_filter.push_str(&format!(" AND strftime('%m', expense_date) IN ({})", months_str));
        }
    }

    // 3. Global Receivables (Always Absolute Total Across All Time)
    // Use amount_paid from invoices directly - captures all payment methods (table + direct status change)
    let total_paid_all_time: f64 = conn.query_row(
        "SELECT COALESCE(SUM(COALESCE(amount_paid, 0.0)), 0.0) FROM invoices WHERE invoice_type NOT IN ('credit_note', 'proforma')",
        [], |row| row.get(0)
    ).unwrap_or(0.0);
    
    let total_invoiced: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total_ttc), 0.0) FROM invoices WHERE invoice_type NOT IN ('credit_note', 'proforma')",
        [], |row| row.get(0)
    ).unwrap_or(0.0);
    
    let total_receivables = total_invoiced - total_paid_all_time + initial_debt;

    // 4. Period Revenue: use amount_paid from invoices (captures both payment table records AND direct status changes)
    let revenue: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(COALESCE(amount_paid, 0.0)), 0.0) 
                  FROM invoices 
                  WHERE invoice_type NOT IN ('credit_note', 'proforma') AND {}", invoice_date_filter),
        [],
        |row| row.get(0)
    ).unwrap_or(0.0);

    // Period Accrual Unpaid (Invoices issued in period that are still unpaid)
    let unpaid: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(CASE WHEN (total_ttc - amount_paid) > 0 THEN (total_ttc - amount_paid) ELSE 0.0 END), 0.0)
                  FROM invoices 
                  WHERE invoice_type NOT IN ('credit_note', 'proforma') AND {}", invoice_date_filter),
        [], |row| row.get(0)
    ).unwrap_or(0.0);

    let invoice_count: i64 = conn.query_row(
        &format!("SELECT COUNT(*) FROM invoices WHERE invoice_type NOT IN ('credit_note', 'proforma') AND {}", invoice_date_filter),
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
                  WHERE invoice_type NOT IN ('credit_note', 'proforma') AND {}", invoice_date_filter),
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
             let prev_inv_filter = format!("strftime('%Y', invoice_date) = '{}' AND strftime('%m', invoice_date) = '{:02}'", prev_y, prev_m);
             conn.query_row(
                 &format!("SELECT COALESCE(SUM(COALESCE(amount_paid, 0.0)), 0.0) 
                           FROM invoices 
                           WHERE invoice_type NOT IN ('credit_note', 'proforma') AND {}", prev_inv_filter),
                [],
                |row| row.get(0)
            ).unwrap_or(0.0)
         } else { 0.0 }
    } else {
        let mut prev_inv_filter = format!("strftime('%Y', invoice_date) = '{}'", prev_year);
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
                      WHERE invoice_type NOT IN ('credit_note', 'proforma') AND {}", prev_inv_filter),
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
        // Daily view: group invoices by invoice_date day, sum amount_paid
        let mut stmt = conn.prepare(&format!(
            "SELECT strftime('%d', invoice_date) as day, SUM(COALESCE(amount_paid, 0.0)) as rev 
             FROM invoices 
             WHERE invoice_type NOT IN ('credit_note', 'proforma') AND {} 
             GROUP BY day ORDER BY day", 
             invoice_date_filter
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

            // Use amount_paid from invoices grouped by invoice_date month
            let m_inv_filter = format!("strftime('%Y', invoice_date) = '{}' AND strftime('%m', invoice_date) = '{}'", target_year, m_str);
            let m_exp_filter = format!("strftime('%Y', expense_date) = '{}' AND strftime('%m', expense_date) = '{}'", target_year, m_str);

            let m_rev: f64 = conn.query_row(
                &format!("SELECT COALESCE(SUM(COALESCE(amount_paid, 0.0)), 0.0) 
                          FROM invoices 
                          WHERE invoice_type NOT IN ('credit_note', 'proforma') AND {}", m_inv_filter),
                [], |row| row.get(0)
            ).unwrap_or(0.0);
            
            let m_exp: f64 = conn.query_row(
                &format!("SELECT COALESCE(SUM(amount), 0.0) FROM expenses WHERE {}", m_exp_filter),
                [], |row| row.get(0)
            ).unwrap_or(0.0);

            monthly_data.push(TimePointStats {
                label: format!("{}-{}", target_year, m_str),
                revenue: m_rev,
                expenses: m_exp,
                profit: m_rev - m_exp,
            });
        }
    }

    // 8. Product Stats (Keep invoice_date as this is a production/sales report)
    let mut prod_query = String::from(
        "SELECT p.id, p.name, p.code, SUM(ii.quantity), SUM(ii.amount)
         FROM invoice_items ii
         JOIN invoices i ON ii.invoice_id = i.id
         JOIN products p ON ii.product_id = p.id
         WHERE i.invoice_type NOT IN ('credit_note', 'proforma')"
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
            expenses,
            profit: revenue - expenses,
        },
        payments: PaymentStats {
            paid: revenue,
            unpaid,
            initial_debt,
            total_receivables,
        },
        sales_cumulatives,
        monthly_data,
        daily_data,
        product_stats: final_prod_stats,
        growth,
        invoice_count,
        is_month_view: is_daily_view,
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
pub fn get_employees(db: State<'_, Mutex<Connection>>) -> Result<Vec<Employee>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM employees ORDER BY name").map_err(|e| e.to_string())?;
    let employees = stmt.query_map([], row_to_employee).map_err(|e| e.to_string())?;

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
        "INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            id,
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

#[tauri::command]
pub fn update_employee(db: State<'_, Mutex<Connection>>, id: String, data: CreateEmployeeData) -> Result<Employee, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE employees SET name = ?2, role = ?3, email = ?4, phone = ?5, address = ?6, updated_at = ?7, base_salary = ?8, hire_date = ?9, contract_type = ?10, rib = ?11, external_code = ?12 WHERE id = ?1",
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
}

/// Dashboard "Charge de travail par employé" chart. LEFT JOIN (not a GROUP
/// BY on project_tasks) so an active employee with zero currently-assigned
/// tasks still appears at count 0 — that's the "underutilized" half of the
/// signal the chart exists to show, and a plain grouped count on the tasks
/// table would silently omit them.
#[tauri::command]
pub fn get_employee_task_workload(db: State<'_, Mutex<Connection>>) -> Result<Vec<EmployeeTaskWorkload>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT e.id, e.name, COUNT(pt.id)
         FROM employees e
         LEFT JOIN project_tasks pt ON pt.assigned_resource_id = e.id AND pt.status != 'approuve'
         WHERE e.is_active = 1
         GROUP BY e.id, e.name
         ORDER BY COUNT(pt.id) DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(EmployeeTaskWorkload {
            employee_id: row.get(0)?,
            employee_name: row.get(1)?,
            task_count: row.get(2)?,
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
// business fact, not a setting): Saturday-Wednesday full days, Thursday
// half-day, Friday off entirely (Algeria's legal weekly rest day). Not
// part of the core Sordi product — see PROJECT_STATE.md.

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
/// decision — not meant to be configurable): 1.0 for Sat-Wed, 0.5 for
/// Thursday (half-day), 0.0 for Friday (full day off).
fn day_weight(weekday: chrono::Weekday) -> f64 {
    match weekday {
        chrono::Weekday::Fri => 0.0,
        chrono::Weekday::Thu => 0.5,
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
    pub unmatched_employee_codes: Vec<String>,
}

/// Idempotent regardless of whether the export is month-specific or the
/// full cumulative history since company start: (employee_id, punch_time)
/// is a UNIQUE constraint at the DB level, INSERT OR IGNORE makes a repeat
/// import of the same punch a silent no-op every time.
#[tauri::command]
pub fn import_punch_records(db: State<'_, Mutex<Connection>>, rows: Vec<PunchImportRow>) -> Result<PunchImportSummary, String> {
    crate::license::require_active_license()?;

    let mut conn = db.lock().map_err(|e| e.to_string())?;

    let mut code_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    {
        let mut stmt = conn
            .prepare("SELECT id, external_code FROM employees WHERE external_code IS NOT NULL AND external_code != ''")
            .map_err(|e| e.to_string())?;
        let mapped = stmt
            .query_map([], |row| Ok((row.get::<_, String>(1)?, row.get::<_, String>(0)?)))
            .map_err(|e| e.to_string())?;
        for m in mapped {
            let (code, id) = m.map_err(|e| e.to_string())?;
            code_map.insert(code, id);
        }
    }

    let mut imported = 0i64;
    let mut skipped = 0i64;
    let mut unmatched: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Every row is kept regardless of mapping status — an unrecognized
    // device code is the expected normal case (an employee not yet
    // assigned a device ID), never a reason to drop data. employee_id is
    // NULL for those; get_unmapped_device_codes() surfaces them, and
    // mapping the code later (create/update_employee) backfills these rows
    // retroactively instead of requiring a re-import.
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for row in rows {
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
/// with a matching external_code backfills these automatically).
#[tauri::command]
pub fn get_unmapped_device_codes(db: State<'_, Mutex<Connection>>) -> Result<Vec<UnmappedDeviceCode>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT external_code, COUNT(*), MAX(punch_time) FROM punch_records
             WHERE employee_id IS NULL GROUP BY external_code ORDER BY external_code",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(UnmappedDeviceCode {
                external_code: row.get(0)?,
                punch_count: row.get(1)?,
                last_punch_time: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
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
}

const PAYROLL_RUN_COLUMNS: &str = "id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at";

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

// ---- Manager dashboard ----

#[derive(Serialize)]
pub struct PayrollDashboardStats {
    pub month: String,
    pub total_payroll_cost: f64,
    pub flagged_employee_count: i64,
    pub pending_payroll_count: i64,
}

#[tauri::command]
pub fn get_payroll_dashboard_stats(db: State<'_, Mutex<Connection>>, month: String) -> Result<PayrollDashboardStats, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let total_payroll_cost: f64 = conn
        .query_row("SELECT COALESCE(SUM(net_a_payer), 0) FROM payroll_runs WHERE month = ?1", params![month], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let pending_payroll_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM payroll_runs WHERE month = ?1 AND paid = 0", params![month], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let (year, month_num) = parse_year_month(&month)?;

    let mut stmt = conn
        .prepare("SELECT id, hire_date FROM employees WHERE is_active = 1 OR is_active IS NULL")
        .map_err(|e| e.to_string())?;
    let employees: Vec<(String, Option<String>)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
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

// ============= PROJECTS (omada-agency branch only) =============
// Agency project-management module: client-linked, invoice-derived budget
// (see get_project_stats), task/deliverable tracking. Replaces the old
// loosely-typed projects/employee_scores tables (retired in database.rs's
// migrate_legacy_projects_module — confirmed unused, zero real rows anywhere).
// Not part of the core Sordi product.

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Project {
    pub id: String,
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
}

#[derive(Deserialize)]
pub struct CreateProjectData {
    pub client_id: String,
    pub name: String,
    pub service_categories: Vec<String>,
    pub responsible_person: Option<String>,
    pub start_date: Option<String>,
    pub deadline: Option<String>,
    pub planned_budget: f64,
    pub freelancer_id: Option<String>,
    pub montant_convenu: Option<f64>,
}

fn row_to_project(row: &rusqlite::Row) -> rusqlite::Result<Project> {
    let categories_json: String = row.get("service_categories")?;
    Ok(Project {
        id: row.get("id")?,
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
    })
}

const PROJECT_COLUMNS: &str = "id, client_id, name, service_categories, responsible_person, start_date, deadline, planned_budget, created_at, updated_at, freelancer_id, montant_convenu, statut_paiement, date_paiement";

#[tauri::command]
pub fn get_projects(db: State<'_, Mutex<Connection>>) -> Result<Vec<Project>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!("SELECT {} FROM projects ORDER BY created_at DESC", PROJECT_COLUMNS))
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], row_to_project).map_err(|e| e.to_string())?;
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

    conn.execute(
        "INSERT INTO projects (id, client_id, name, service_categories, responsible_person, start_date, deadline, planned_budget, created_at, updated_at, freelancer_id, montant_convenu, statut_paiement) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'non_paye')",
        params![id, data.client_id, data.name, categories_json, data.responsible_person, data.start_date, data.deadline, data.planned_budget, now, now, data.freelancer_id, data.montant_convenu],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "CREATE", "PROJECT", Some(&id), &format!("Nouveau projet créé: {}", data.name));

    Ok(Project {
        id,
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
    })
}

/// Field edit only — statut_paiement/date_paiement go through
/// update_freelancer_payment_status below, same split as payroll_runs'
/// update_payroll_paid vs. run_payroll.
#[tauri::command]
pub fn update_project(db: State<'_, Mutex<Connection>>, id: String, data: CreateProjectData) -> Result<Project, String> {
    crate::license::require_active_license()?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let categories_json = serde_json::to_string(&data.service_categories).map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE projects SET client_id = ?2, name = ?3, service_categories = ?4, responsible_person = ?5, start_date = ?6, deadline = ?7, planned_budget = ?8, updated_at = ?9, freelancer_id = ?10, montant_convenu = ?11 WHERE id = ?1",
        params![id, data.client_id, data.name, categories_json, data.responsible_person, data.start_date, data.deadline, data.planned_budget, now, data.freelancer_id, data.montant_convenu],
    ).map_err(|e| e.to_string())?;

    let _ = log_activity(&conn, "UPDATE", "PROJECT", Some(&id), &format!("Projet mis à jour: {}", data.name));

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
pub fn get_freelance_payments(db: State<'_, Mutex<Connection>>) -> Result<Vec<FreelancePayment>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, p.freelancer_id, e.name, p.montant_convenu, p.statut_paiement, p.date_paiement
             FROM projects p
             JOIN employees e ON e.id = p.freelancer_id
             WHERE p.freelancer_id IS NOT NULL
             ORDER BY CASE WHEN p.statut_paiement = 'non_paye' THEN 0 ELSE 1 END, p.created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
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
pub fn get_project_stats(db: State<'_, Mutex<Connection>>, project_id: Option<String>) -> Result<Vec<ProjectStats>, String> {
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
        conn.prepare("SELECT id, planned_budget, start_date, deadline FROM projects WHERE id = ?1")
    } else {
        conn.prepare("SELECT id, planned_budget, start_date, deadline FROM projects")
    }.map_err(|e| e.to_string())?;
    let project_rows: Vec<ProjectRow> = if let Some(ref pid) = project_id {
        proj_stmt.query_map(params![pid], map_project_row)
    } else {
        proj_stmt.query_map([], map_project_row)
    }.map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for p in project_rows {
        let (budget_facture, budget_paye): (f64, f64) = conn.query_row(
            "SELECT COALESCE(SUM(total_ttc), 0), COALESCE(SUM(amount_paid), 0) FROM invoices WHERE project_id = ?1",
            params![p.id],
            |row| Ok((row.get(0)?, row.get(1)?)),
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
            "SELECT product_id, quantity FROM delivery_note_items WHERE delivery_note_id = ?1"
        ).map_err(|e| e.to_string())?;
        
        let items: Vec<(String, f64)> = stmt.query_map(params![note_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        }).map_err(|e| e.to_string())?
          .filter_map(Result::ok)
          .collect();
        
        for (product_id, quantity) in items {
            // Fetch product details for price
            let (unit_price, tva_rate, timbre_exempt): (f64, f64, bool) = tx.query_row(
                "SELECT unit_price, tva_rate, timbre_exempt FROM products WHERE id = ?1",
                params![product_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get::<_, Option<bool>>(2)?.unwrap_or(false)))
            ).unwrap_or((0.0, 19.0, false));

            let item_id = uuid::Uuid::new_v4().to_string();
            let amount = quantity * unit_price;

            tx.execute(
                "INSERT INTO invoice_items (id, invoice_id, product_id, quantity, unit_price, amount, tva_rate, timbre_exempt, created_at) 
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![item_id, invoice_id, product_id, quantity, unit_price, amount, tva_rate, timbre_exempt, now],
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
                crate::commands::search_global,
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
}
