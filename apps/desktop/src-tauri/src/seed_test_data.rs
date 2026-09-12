//! Seeds (or removes) realistic test data for the client "Aperçu"/Statut
//! feature — through the real Tauri commands (create_client, create_invoice,
//! create_payment, ...) via a mock Tauri app, the same tauri::test approach
//! as commands.rs's ipc_arg_bridging_smoke_test — NOT raw SQL. This
//! exercises the exact same validation/calculation logic the real UI
//! triggers: timbre (droit de timbre), invoice numbering, and
//! update_invoice_payment_status.
//!
//! Unlike that smoke test (which uses an isolated `:memory:` db), this
//! writes to your REAL app database, so the data shows up in `pnpm
//! tauri:dev`. It's `#[ignore]`d so a normal `cargo test` never touches your
//! real data — you run it explicitly by name:
//!
//!   cargo test --lib seed_real_database -- --ignored --nocapture
//!   cargo test --lib cleanup_real_database -- --ignored --nocapture
//!
//! Quit the running app (pnpm tauri:dev) first — both hold the same SQLite
//! file open, and there's no need to fight a concurrent writer.
//!
//! DB path: defaults to the real app's app_data_dir (macOS:
//! ~/Library/Application Support/com.sordi.finance/database.db). Override with
//! the SORDI_DB_PATH env var if that's wrong. The seed test refuses to run
//! against a path that doesn't already exist — run the real app at least
//! once first, or point SORDI_DB_PATH at an existing db.
//!
//! Every row this creates is identifiable and reversible: client names are
//! prefixed "[TEST] ", the product code is "TEST-MAT01". cleanup_real_database
//! deletes exactly those rows (payments -> invoices -> clients/products, in
//! FK-safe order) and nothing else.
//!
//! seed_real_database is idempotent: it runs that same deletion pass on
//! itself before creating anything, so it's always safe to re-run directly
//! — no need to run cleanup_real_database first, and no UNIQUE-constraint
//! failure from a previous run's leftovers (e.g. the product code, or a
//! partial run that failed partway through).
//!
//! Only `cargo check`/`cargo test --no-run`-verified in the environment
//! that wrote this (no GUI, so no real app_data_dir to run it against).
//! Please paste back the first error verbatim if `cargo test` doesn't work
//! cleanly.

use crate::{commands, database};
use chrono::{Duration, Local};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{get_ipc_response, mock_builder, mock_context, noop_assets, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::{Manager, WebviewWindowBuilder};

const TEST_MARKER: &str = "[TEST] ";
const TEST_PRODUCT_CODE: &str = "TEST-MAT01";

fn resolve_db_path() -> std::path::PathBuf {
    if let Ok(p) = std::env::var("SORDI_DB_PATH") {
        return std::path::PathBuf::from(p);
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").expect("HOME not set");
        std::path::PathBuf::from(home).join("Library/Application Support/com.sordi.finance/database.db")
    }
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").expect("APPDATA not set");
        std::path::PathBuf::from(appdata).join("com.sordi.finance/database.db")
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").expect("HOME not set");
        std::path::PathBuf::from(home).join(".local/share/com.sordi.finance/database.db")
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        panic!("Unsupported OS for auto-detection — set SORDI_DB_PATH explicitly.");
    }
}

fn build_app(conn: Connection) -> tauri::App<tauri::test::MockRuntime> {
    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![
            commands::create_client,
            commands::create_product,
            commands::create_invoice,
            commands::create_payment,
        ])
        // mock_context, not tauri::generate_context!() — same reason as
        // ipc_arg_bridging_smoke_test: lib.rs::run() already calls the real
        // macro once; a second call in code linked into the same test
        // binary would collide at link time.
        .build(mock_context(noop_assets()))
        .expect("failed to build mock Tauri app");
    app.manage(Mutex::new(conn));
    app
}

fn invoke(webview: &tauri::WebviewWindow<tauri::test::MockRuntime>, cmd: &str, args: Value) -> Value {
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

    let value = response
        .deserialize::<Value>()
        .unwrap_or_else(|e| panic!("invoke({}) response failed to deserialize: {:?}", cmd, e));

    if let Some(msg) = value.as_str() {
        // Commands return Result<T, String> — the Err(String) case surfaces
        // here as a bare JSON string. T is never a bare string in this
        // app's command set, so this reliably distinguishes an error.
        panic!("invoke({}) returned an error: {}", cmd, msg);
    }
    value
}

fn ymd(days_ago: i64) -> String {
    (Local::now().date_naive() - Duration::days(days_ago))
        .format("%Y-%m-%d")
        .to_string()
}

struct ClientSpec {
    label: &'static str,
    code: &'static str,
    nif: &'static str,
    nis: &'static str,
    rc: &'static str,
    ai: &'static str,
    city: &'static str,
    wilaya: &'static str,
    payment_terms_days: i64,
}

fn create_client(webview: &tauri::WebviewWindow<tauri::test::MockRuntime>, spec: &ClientSpec) -> String {
    let name = format!("{}{}", TEST_MARKER, spec.label);
    let client = invoke(
        webview,
        "create_client",
        json!({
            "data": {
                "name": name,
                "code": spec.code,
                "contact_person": "Contact Test",
                "phone": "0555000000",
                "email": format!("{}@example-test.dz", spec.code.to_lowercase()),
                "address": "12 Rue de Test",
                "city": spec.city,
                "wilaya": spec.wilaya,
                "nif": spec.nif,
                "nis": spec.nis,
                "rc": spec.rc,
                "ai": spec.ai,
                "payment_terms_days": spec.payment_terms_days,
                "notes": "Client de test — généré par seed_test_data, supprimable via cleanup_real_database.",
                "initial_balance": 0.0,
            }
        }),
    );
    println!("  created client {:<45} id={}", name, client["id"].as_str().unwrap());
    client["id"].as_str().unwrap().to_string()
}

/// invoice_date is days_ago from today; payment_method controls timbre
/// (only "especes" incurs stamp duty — see recalculate_invoice_totals).
fn create_invoice(
    webview: &tauri::WebviewWindow<tauri::test::MockRuntime>,
    client_id: &str,
    product_id: &str,
    days_ago: i64,
    quantity: f64,
    payment_method: &str,
) -> (String, f64) {
    let invoice = invoke(
        webview,
        "create_invoice",
        json!({
            "data": {
                "client_id": client_id,
                "invoice_date": ymd(days_ago),
                "payment_method": payment_method,
                "items": [
                    { "product_id": product_id, "quantity": quantity, "unit_price": 4200.0, "tva_rate": 19.0 }
                ]
            }
        }),
    );
    let id = invoice["id"].as_str().unwrap().to_string();
    let total_ttc = invoice["total_ttc"].as_f64().unwrap();
    println!(
        "    invoice {} date={} qty={} total_ttc={:.2} DA (timbre={:.2})",
        invoice["invoice_number"].as_str().unwrap_or("?"),
        ymd(days_ago),
        quantity,
        total_ttc,
        invoice["timbre"].as_f64().unwrap_or(0.0)
    );
    (id, total_ttc)
}

fn create_payment(
    webview: &tauri::WebviewWindow<tauri::test::MockRuntime>,
    invoice_id: &str,
    invoice_days_ago: i64,
    delay_days: i64,
    amount: f64,
    payment_method: &str,
) {
    let payment_days_ago = invoice_days_ago - delay_days;
    invoke(
        webview,
        "create_payment",
        json!({
            "data": {
                "invoice_id": invoice_id,
                "payment_date": ymd(payment_days_ago),
                "amount": amount,
                "payment_method": payment_method,
            }
        }),
    );
    println!("      paid {:.2} DA, {} days after invoicing", amount, delay_days);
}

fn existing_db_path() -> std::path::PathBuf {
    let db_path = resolve_db_path();
    println!("Database: {}\n", db_path.display());
    if !db_path.exists() {
        panic!(
            "No database file at {} — run the real app once first (so it creates one), \
             or set SORDI_DB_PATH to the correct location.",
            db_path.display()
        );
    }
    db_path
}

#[test]
#[ignore = "writes to your real app database — run explicitly, see module docs"]
fn seed_real_database() {
    let db_path = existing_db_path();
    let conn = database::init_database(db_path.to_str().unwrap()).expect("failed to open database");

    println!("Clearing any existing test data first (makes this safe to re-run directly)...");
    delete_test_rows(&conn);
    println!();

    let app = build_app(conn);
    let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .expect("failed to build mock webview");

    println!("Creating test product...");
    let product = invoke(
        &webview,
        "create_product",
        json!({
            "data": {
                "code": TEST_PRODUCT_CODE,
                "name": "Gravillon 3/8 (test)",
                "unit": "tonne",
                "unit_price": 4200.0,
                "tva_rate": 19.0
            }
        }),
    );
    let product_id = product["id"].as_str().unwrap().to_string();
    println!("  created product {} id={}\n", TEST_PRODUCT_CODE, product_id);

    // --- Client A: Bon payeur ---------------------------------------------
    // 6 invoices, ~30 days apart (-> "Mensuelle" frequency), each paid in
    // full within ~6 days — well inside the 30-day terms and the last-3
    // 1.5x threshold (45 days). No overdue invoices. Expect "Bon payeur".
    println!("Client A — Bon payeur");
    let client_a = create_client(
        &webview,
        &ClientSpec {
            label: "Client A — Bon payeur — SARL Zeroual Matériaux",
            code: "TESTA",
            nif: "099999000000011",
            nis: "099999000000012",
            rc: "99/00-0000001B26",
            ai: "16990000011",
            city: "Alger",
            wilaya: "Alger",
            payment_terms_days: 30,
        },
    );
    for days_ago in [165, 135, 105, 75, 45, 15] {
        let (invoice_id, total_ttc) = create_invoice(&webview, &client_a, &product_id, days_ago, 10.0, "virement");
        create_payment(&webview, &invoice_id, days_ago, 6, total_ttc, "Virement");
    }
    println!();

    // --- Client B: En retard ------------------------------------------------
    // Invoice 1 (-70j) paid normally. Invoice 2 (-40j, 15-day terms -> due
    // -25j) is never paid at all, so it sits at its real-world default
    // status "issued" (create_invoice's default — never "unpaid" unless a
    // payment event fires update_invoice_payment_status). has_overdue_unpaid
    // must catch this via status, not just literal "unpaid"/"partial".
    // Expect "En retard".
    println!("Client B — En retard");
    let client_b = create_client(
        &webview,
        &ClientSpec {
            label: "Client B — En retard — EURL Boudiaf Transport",
            code: "TESTB",
            nif: "099999000000021",
            nis: "099999000000022",
            rc: "99/00-0000002B26",
            ai: "16990000021",
            city: "Oran",
            wilaya: "Oran",
            payment_terms_days: 15,
        },
    );
    let (inv_b1, total_b1) = create_invoice(&webview, &client_b, &product_id, 70, 8.0, "virement");
    create_payment(&webview, &inv_b1, 70, 10, total_b1, "Virement");
    create_invoice(&webview, &client_b, &product_id, 40, 6.0, "especes");
    println!("    (invoice above intentionally left unpaid — never paid, status stays \"issued\")");
    println!();

    // --- Client C: À surveiller ----------------------------------------------
    // 4 invoices, ~30 days apart, ALL paid — but consistently ~27 days after
    // invoicing against 15-day terms (1.8x > the 1.5x threshold). Nothing is
    // unpaid/overdue, so rule (a) doesn't fire; rule (b)'s delay check does.
    // Expect "À surveiller".
    println!("Client C — À surveiller");
    let client_c = create_client(
        &webview,
        &ClientSpec {
            label: "Client C — À surveiller — SPA Cherif Négoce",
            code: "TESTC",
            nif: "099999000000031",
            nis: "099999000000032",
            rc: "99/00-0000003B26",
            ai: "16990000031",
            city: "Sétif",
            wilaya: "Sétif",
            payment_terms_days: 15,
        },
    );
    for days_ago in [120, 90, 60, 30] {
        let (invoice_id, total_ttc) = create_invoice(&webview, &client_c, &product_id, days_ago, 9.0, "cheque");
        create_payment(&webview, &invoice_id, days_ago, 27, total_ttc, "Chèque");
    }
    println!();

    // --- Client D: Nouveau --------------------------------------------------
    // 2 invoices only (< 3 total). One paid, one recent and unpaid but not
    // yet due (30-day terms, invoiced 3 days ago). Too new to classify
    // either way. Expect "Nouveau".
    println!("Client D — Nouveau");
    let client_d = create_client(
        &webview,
        &ClientSpec {
            label: "Client D — Nouveau — Client Belkacem",
            code: "TESTD",
            nif: "099999000000041",
            nis: "099999000000042",
            rc: "99/00-0000004B26",
            ai: "16990000041",
            city: "Blida",
            wilaya: "Blida",
            payment_terms_days: 30,
        },
    );
    let (inv_d1, total_d1) = create_invoice(&webview, &client_d, &product_id, 20, 5.0, "virement");
    create_payment(&webview, &inv_d1, 20, 8, total_d1, "Virement");
    create_invoice(&webview, &client_d, &product_id, 3, 4.0, "virement");
    println!("    (second invoice intentionally left unpaid — not yet due, so still \"Nouveau\")");
    println!();

    println!("Done. Open the clients list / each client's Aperçu tab to check the Statut badges.");
}

/// Deletes every row this module can have created — payments, then
/// invoices (invoice_items cascade automatically, see the schema in
/// database.rs), then clients, then the test product — in that FK-safe
/// order. Used both by cleanup_real_database on its own, and by
/// seed_real_database up front, so re-running seed_real_database directly
/// is always safe: it doesn't matter whether a previous run partially
/// failed, or whether cleanup was ever run at all, since every seed starts
/// by clearing anything matching its own markers first.
fn delete_test_rows(conn: &Connection) {
    let mut stmt = conn.prepare("SELECT id, name FROM clients WHERE name LIKE ?1").expect("prepare failed");
    let pattern = format!("{}%", TEST_MARKER);
    let client_rows: Vec<(String, String)> = stmt
        .query_map([&pattern], |row| Ok((row.get(0)?, row.get(1)?)))
        .expect("query failed")
        .collect::<Result<_, _>>()
        .expect("row read failed");
    drop(stmt);

    if client_rows.is_empty() {
        println!("  no existing test clients found (nothing matching \"{}\")", TEST_MARKER);
    }

    for (client_id, name) in &client_rows {
        let invoice_ids: Vec<String> = conn
            .prepare("SELECT id FROM invoices WHERE client_id = ?1")
            .unwrap()
            .query_map([client_id], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        let mut payments_deleted = 0;
        for invoice_id in &invoice_ids {
            payments_deleted += conn.execute("DELETE FROM payments WHERE invoice_id = ?1", [invoice_id]).unwrap();
        }
        let invoices_deleted = conn.execute("DELETE FROM invoices WHERE client_id = ?1", [client_id]).unwrap();
        conn.execute("DELETE FROM clients WHERE id = ?1", [client_id]).unwrap();

        println!("  removed {} ({} invoices, {} payments)", name, invoices_deleted, payments_deleted);
    }

    // Unconditional, independent of whether any client matched above — a
    // prior run that failed after creating the product but before creating
    // any client would otherwise leave it stuck forever.
    let products_deleted = conn.execute("DELETE FROM products WHERE code = ?1", [TEST_PRODUCT_CODE]).unwrap();
    if products_deleted > 0 {
        println!("  removed test product {}", TEST_PRODUCT_CODE);
    }
}

#[test]
#[ignore = "writes to your real app database — run explicitly, see module docs"]
fn cleanup_real_database() {
    let db_path = existing_db_path();
    let conn = Connection::open(&db_path).expect("failed to open database");
    conn.execute("PRAGMA foreign_keys = ON", []).unwrap();

    delete_test_rows(&conn);

    println!("Cleanup done.");
}
