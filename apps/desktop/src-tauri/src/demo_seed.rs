//! Reversible demo data seeder for auditing the app's UI/UX density with
//! realistic Algerian B2B records — 3 clients, 3 products/services, 4
//! invoices exercising every status/payment badge, and 2 expenses. Runs
//! through the real Tauri commands (create_client, create_invoice,
//! create_payment, ...), not raw SQL, so it goes through the exact same
//! timbre/status/balance calculation logic the real UI triggers.
//!
//! Every row this creates is tagged and reversible: client names are
//! prefixed "[DÉMO] ", product codes are prefixed "DEMO-", and expenses
//! carry reference "DEMO-SEED" — nothing else in the schema (company
//! profile, settings, real records) is ever touched. clear_demo_data
//! deletes exactly those tagged rows, scoped to the given company_id, in
//! FK-safe order (payments -> invoices -> clients/products/expenses).
//!
//! seed_demo_data is idempotent: it clears any previous demo rows for the
//! same company before creating anything, so re-running it (e.g. after
//! tweaking this file) never collides with leftovers from an earlier run.

use crate::commands::{self, CreateClientData, CreateExpenseData, CreateInvoiceData, CreatePaymentData, CreateProductData, InvoiceItemInput};
use chrono::{Duration, Local};
use rusqlite::{params, Connection};
use std::sync::Mutex;
use tauri::State;

const DEMO_CLIENT_MARKER: &str = "[DÉMO] ";
const DEMO_PRODUCT_PREFIX: &str = "DEMO-";
const DEMO_EXPENSE_REFERENCE: &str = "DEMO-SEED";

fn ymd(days_ago: i64) -> String {
    (Local::now().date_naive() - Duration::days(days_ago))
        .format("%Y-%m-%d")
        .to_string()
}

/// Deletes every row seed_demo_data can have created for this company —
/// payments, then invoices, then clients/products/expenses — matched only
/// by the markers above, so it can never touch a real record that merely
/// happens to share a client. Shared by clear_demo_data and by
/// seed_demo_data's own idempotent pre-clear.
fn clear_demo_rows(conn: &Connection, company_id: &str) -> Result<String, String> {
    let client_pattern = format!("{}%", DEMO_CLIENT_MARKER);
    let product_pattern = format!("{}%", DEMO_PRODUCT_PREFIX);

    let client_ids: Vec<String> = conn
        .prepare("SELECT id FROM clients WHERE company_id = ?1 AND name LIKE ?2")
        .map_err(|e| e.to_string())?
        .query_map(params![company_id, client_pattern], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<_, _>>()
        .map_err(|e| e.to_string())?;

    let mut invoices_deleted = 0usize;
    let mut payments_deleted = 0usize;
    for client_id in &client_ids {
        let invoice_ids: Vec<String> = conn
            .prepare("SELECT id FROM invoices WHERE client_id = ?1")
            .map_err(|e| e.to_string())?
            .query_map(params![client_id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<_, _>>()
            .map_err(|e| e.to_string())?;

        for invoice_id in &invoice_ids {
            payments_deleted += conn
                .execute("DELETE FROM payments WHERE invoice_id = ?1", params![invoice_id])
                .map_err(|e| e.to_string())?;
        }
        invoices_deleted += conn
            .execute("DELETE FROM invoices WHERE client_id = ?1", params![client_id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM clients WHERE id = ?1", params![client_id]).map_err(|e| e.to_string())?;
    }

    let products_deleted = conn
        .execute(
            "DELETE FROM products WHERE company_id = ?1 AND code LIKE ?2",
            params![company_id, product_pattern],
        )
        .map_err(|e| e.to_string())?;

    let expenses_deleted = conn
        .execute(
            "DELETE FROM expenses WHERE company_id = ?1 AND reference = ?2",
            params![company_id, DEMO_EXPENSE_REFERENCE],
        )
        .map_err(|e| e.to_string())?;

    Ok(format!(
        "{} client(s), {} invoice(s), {} payment(s), {} produit(s), {} dépense(s) supprimés",
        client_ids.len(),
        invoices_deleted,
        payments_deleted,
        products_deleted,
        expenses_deleted
    ))
}

#[tauri::command]
pub fn clear_demo_data(db: State<'_, Mutex<Connection>>, company_id: String) -> Result<String, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    clear_demo_rows(&conn, &company_id)
}

#[tauri::command]
pub fn seed_demo_data(db: State<'_, Mutex<Connection>>, company_id: String) -> Result<String, String> {
    // Idempotent — clear any previous demo rows for this company first, so
    // re-running never collides on the unique product codes / client
    // names left over from an earlier run.
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        clear_demo_rows(&conn, &company_id)?;
    }

    // --- Clients -------------------------------------------------------
    let client_atlas = commands::create_client(
        db.clone(),
        CreateClientData {
            company_id: company_id.clone(),
            name: format!("{}SARL Atlas Logistique & Distribution", DEMO_CLIENT_MARKER),
            code: Some("DEMO-CLI-01".to_string()),
            contact_person: None,
            phone: None,
            email: None,
            address: None,
            city: Some("Alger".to_string()),
            wilaya: Some("Alger".to_string()),
            nif: Some("001216012345678".to_string()),
            nis: Some("001216012345678".to_string()),
            rc: Some("16/00-1234567B16".to_string()),
            secondary_rc: None,
            secondary_address: None,
            ai: Some("16123456789".to_string()),
            activite: None,
            credit_limit: None,
            payment_terms_days: Some(30),
            notes: Some("Client de démonstration — généré par seed_demo_data, supprimable via clear_demo_data.".to_string()),
            initial_balance: Some(0.0),
            advance_payment: None,
        },
    )?;

    let client_horizon = commands::create_client(
        db.clone(),
        CreateClientData {
            company_id: company_id.clone(),
            name: format!("{}EURL Horizon Digital Solutions", DEMO_CLIENT_MARKER),
            code: Some("DEMO-CLI-02".to_string()),
            contact_person: None,
            phone: Some("0550123456".to_string()),
            email: None,
            address: None,
            city: Some("Sétif".to_string()),
            wilaya: Some("Sétif".to_string()),
            nif: Some("001819098765432".to_string()),
            nis: None,
            rc: Some("19/00-9876543A18".to_string()),
            secondary_rc: None,
            secondary_address: None,
            ai: None,
            activite: None,
            credit_limit: None,
            payment_terms_days: Some(30),
            notes: Some("Client de démonstration — généré par seed_demo_data, supprimable via clear_demo_data.".to_string()),
            initial_balance: Some(0.0),
            advance_payment: None,
        },
    )?;

    let client_amine = commands::create_client(
        db.clone(),
        CreateClientData {
            company_id: company_id.clone(),
            name: format!("{}Amine Benali (Consultant Indépendant)", DEMO_CLIENT_MARKER),
            code: Some("DEMO-CLI-03".to_string()),
            contact_person: None,
            phone: None,
            email: None,
            address: None,
            city: Some("Oran".to_string()),
            wilaya: Some("Oran".to_string()),
            nif: None,
            nis: None,
            rc: None,
            secondary_rc: None,
            secondary_address: None,
            ai: None,
            activite: Some("Freelance".to_string()),
            credit_limit: None,
            payment_terms_days: Some(15),
            notes: Some("Client de démonstration — généré par seed_demo_data, supprimable via clear_demo_data.".to_string()),
            initial_balance: Some(0.0),
            advance_payment: None,
        },
    )?;

    // --- Products / Services --------------------------------------------
    let product_dev = commands::create_product(
        db.clone(),
        CreateProductData {
            company_id: company_id.clone(),
            code: format!("{}SRV-01", DEMO_PRODUCT_PREFIX),
            name: "Développement Plateforme Web & Mobile".to_string(),
            description: None,
            unit: Some("Forfait".to_string()),
            unit_price: 180_000.0,
            tva_rate: Some(19.0),
            timbre_exempt: Some(false),
            display_order: None,
        },
    )?;

    let product_maintenance = commands::create_product(
        db.clone(),
        CreateProductData {
            company_id: company_id.clone(),
            code: format!("{}SRV-02", DEMO_PRODUCT_PREFIX),
            name: "Maintenance & Infogérance Serveur Cloud".to_string(),
            description: None,
            unit: Some("Mois".to_string()),
            unit_price: 35_000.0,
            tva_rate: Some(19.0),
            timbre_exempt: Some(false),
            display_order: None,
        },
    )?;

    let product_identite = commands::create_product(
        db.clone(),
        CreateProductData {
            company_id: company_id.clone(),
            code: format!("{}SRV-03", DEMO_PRODUCT_PREFIX),
            name: "Conception Identité Visuelle & Charte Graphique".to_string(),
            description: None,
            unit: Some("Projet".to_string()),
            unit_price: 95_000.0,
            tva_rate: Some(19.0),
            timbre_exempt: Some(false),
            display_order: None,
        },
    )?;

    // --- Invoices --------------------------------------------------------
    // 1) PAYÉE — full cash payment, exercises the "PAYÉ" stamp and the
    //    cash droit-de-timbre calculation (payment_method "especes").
    let invoice_paid = commands::create_invoice(
        db.clone(),
        CreateInvoiceData {
            company_id: company_id.clone(),
            client_id: client_atlas.id.clone(),
            invoice_date: ymd(20),
            due_date: None,
            month_period: None,
            notes: None,
            header_note: None,
            invoice_type: Some("invoice".to_string()),
            original_invoice_id: None,
            discount: None,
            discount_type: None,
            discount_value: None,
            use_secondary_register: None,
            selected_secondary_rc: None,
            selected_secondary_address: None,
            custom_title: None,
            invoice_number: None,
            payment_method: Some("especes".to_string()),
            status: None,
            amount_paid: None,
            tax_mode: None,
            project_id: None,
            items: vec![InvoiceItemInput {
                product_id: Some(product_dev.id.clone()),
                product_name: None,
                product_code: None,
                product_description: None,
                quantity: 1.0,
                unit_price: product_dev.unit_price,
                tva_rate: Some(19.0),
                timbre_exempt: Some(false),
            }],
        },
    )?;
    commands::create_payment(
        db.clone(),
        CreatePaymentData {
            company_id: company_id.clone(),
            invoice_id: invoice_paid.id.clone(),
            payment_date: ymd(20),
            amount: invoice_paid.total_ttc.unwrap_or(0.0),
            payment_method: Some("Espèces".to_string()),
            cheque_number: None,
            bank_name: None,
            value_date: None,
            notes: Some("Paiement comptant intégral — démonstration".to_string()),
            employee_id: None,
        },
    )?;

    // 2) PARTIELLEMENT PAYÉE — cheque acompte, exercises the red
    //    "reste à payer" display (payment_method "cheque" -> no timbre).
    let invoice_partial = commands::create_invoice(
        db.clone(),
        CreateInvoiceData {
            company_id: company_id.clone(),
            client_id: client_horizon.id.clone(),
            invoice_date: ymd(12),
            due_date: None,
            month_period: None,
            notes: None,
            header_note: None,
            invoice_type: Some("invoice".to_string()),
            original_invoice_id: None,
            discount: None,
            discount_type: None,
            discount_value: None,
            use_secondary_register: None,
            selected_secondary_rc: None,
            selected_secondary_address: None,
            custom_title: None,
            invoice_number: None,
            payment_method: Some("cheque".to_string()),
            status: None,
            amount_paid: None,
            tax_mode: None,
            project_id: None,
            items: vec![InvoiceItemInput {
                product_id: Some(product_identite.id.clone()),
                product_name: None,
                product_code: None,
                product_description: None,
                quantity: 1.0,
                unit_price: product_identite.unit_price,
                tva_rate: Some(19.0),
                timbre_exempt: Some(false),
            }],
        },
    )?;
    commands::create_payment(
        db.clone(),
        CreatePaymentData {
            company_id: company_id.clone(),
            invoice_id: invoice_partial.id.clone(),
            payment_date: ymd(10),
            amount: 50_000.0,
            payment_method: Some("Chèque".to_string()),
            cheque_number: Some("849201".to_string()),
            bank_name: None,
            value_date: None,
            notes: Some("Acompte — démonstration".to_string()),
            employee_id: None,
        },
    )?;

    // 3) ÉMISE — issued, awaiting bank transfer, no payment recorded.
    let invoice_issued = commands::create_invoice(
        db.clone(),
        CreateInvoiceData {
            company_id: company_id.clone(),
            client_id: client_amine.id.clone(),
            invoice_date: ymd(5),
            due_date: None,
            month_period: None,
            notes: None,
            header_note: None,
            invoice_type: Some("invoice".to_string()),
            original_invoice_id: None,
            discount: None,
            discount_type: None,
            discount_value: None,
            use_secondary_register: None,
            selected_secondary_rc: None,
            selected_secondary_address: None,
            custom_title: None,
            invoice_number: None,
            payment_method: Some("virement".to_string()),
            status: None,
            amount_paid: None,
            tax_mode: None,
            project_id: None,
            items: vec![InvoiceItemInput {
                product_id: Some(product_maintenance.id.clone()),
                product_name: None,
                product_code: None,
                product_description: None,
                quantity: 1.0,
                unit_price: product_maintenance.unit_price,
                tva_rate: Some(19.0),
                timbre_exempt: Some(false),
            }],
        },
    )?;

    // 4) BROUILLON — draft, 2 custom (non-catalog) line items.
    let invoice_draft = commands::create_invoice(
        db.clone(),
        CreateInvoiceData {
            company_id: company_id.clone(),
            client_id: client_atlas.id.clone(),
            invoice_date: ymd(1),
            due_date: None,
            month_period: None,
            notes: Some("Brouillon de démonstration".to_string()),
            header_note: None,
            invoice_type: Some("invoice".to_string()),
            original_invoice_id: None,
            discount: None,
            discount_type: None,
            discount_value: None,
            use_secondary_register: None,
            selected_secondary_rc: None,
            selected_secondary_address: None,
            custom_title: None,
            invoice_number: None,
            payment_method: Some("virement".to_string()),
            status: Some("draft".to_string()),
            amount_paid: None,
            tax_mode: None,
            project_id: None,
            items: vec![
                InvoiceItemInput {
                    product_id: None,
                    product_name: Some("Hébergement mensuel supplémentaire".to_string()),
                    product_code: None,
                    product_description: None,
                    quantity: 1.0,
                    unit_price: 15_000.0,
                    tva_rate: Some(19.0),
                    timbre_exempt: Some(false),
                },
                InvoiceItemInput {
                    product_id: None,
                    product_name: Some("Formation utilisateur (2 sessions)".to_string()),
                    product_code: None,
                    product_description: None,
                    quantity: 2.0,
                    unit_price: 8_000.0,
                    tva_rate: Some(19.0),
                    timbre_exempt: Some(false),
                },
            ],
        },
    )?;

    // --- Expenses ----------------------------------------------------------
    commands::create_expense(
        db.clone(),
        CreateExpenseData {
            company_id: company_id.clone(),
            expense_date: ymd(15),
            category: "Hébergement".to_string(),
            description: Some(format!("{}Abonnement Serveur Dédié & Nom de domaine", DEMO_CLIENT_MARKER)),
            amount: 24_000.0,
            payment_method: Some("Carte bancaire".to_string()),
            reference: Some(DEMO_EXPENSE_REFERENCE.to_string()),
            notes: Some("Dépense de démonstration — générée par seed_demo_data.".to_string()),
            project_id: None,
            supplier_id: None,
            is_recurring: Some(true),
            recurrence_interval: Some("monthly".to_string()),
            is_paid: Some(true),
        },
    )?;

    commands::create_expense(
        db.clone(),
        CreateExpenseData {
            company_id: company_id.clone(),
            expense_date: ymd(8),
            category: "Équipement".to_string(),
            description: Some(format!("{}Fournitures de bureau & Matériel informatique", DEMO_CLIENT_MARKER)),
            amount: 45_000.0,
            payment_method: Some("Espèces".to_string()),
            reference: Some(DEMO_EXPENSE_REFERENCE.to_string()),
            notes: Some("Dépense de démonstration — générée par seed_demo_data.".to_string()),
            project_id: None,
            supplier_id: None,
            is_recurring: Some(false),
            recurrence_interval: None,
            is_paid: Some(true),
        },
    )?;

    Ok(format!(
        "Données de démonstration créées : 3 clients, 3 services, {} factures ({}, {}, {}, {}), 2 dépenses.",
        4,
        invoice_paid.invoice_number,
        invoice_partial.invoice_number,
        invoice_issued.invoice_number,
        invoice_draft.invoice_number
    ))
}

/// Proves seed_demo_data/clear_demo_data actually work end-to-end — against
/// a disposable temp-file SQLite database created and destroyed entirely
/// within this test, never the app's real dev or production database. A
/// normal (non-ignored) `cargo test` run exercises this every time.
#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::CreateCompanyData;
    use tauri::test::{mock_builder, mock_context, noop_assets};
    use tauri::Manager;

    fn temp_db_path() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("sordi-demo-seed-test-{}.db", uuid::Uuid::new_v4()))
    }

    fn count(conn: &Connection, table: &str, company_id: &str) -> i64 {
        conn.query_row(&format!("SELECT COUNT(*) FROM {} WHERE company_id = ?1", table), params![company_id], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn seed_and_clear_demo_data_round_trip() {
        let db_path = temp_db_path();
        let conn = crate::database::init_database(db_path.to_str().unwrap()).expect("failed to init temp database");

        let app = mock_builder().build(mock_context(noop_assets())).expect("failed to build mock app");
        app.manage(Mutex::new(conn));
        let db_state: State<Mutex<Connection>> = app.state();

        let company = commands::create_company(
            db_state.clone(),
            CreateCompanyData {
                name: "Entreprise de test".to_string(),
                logo_base64: None,
                activity: None,
                legal_form: None,
                rc: None,
                nif: None,
                nis: None,
                article_imposition: None,
                address: None,
                phone: None,
                phones: None,
                email: None,
                website: None,
                capital: None,
                rib: None,
                bank_agency: None,
                extra_info: None,
                cnas_adherent: None,
                currency: Some("DZD".to_string()),
                invoice_prefix: None,
            },
        )
        .expect("create_company failed");

        let seed_result = seed_demo_data(db_state.clone(), company.id.clone()).expect("seed_demo_data failed");
        println!("seed_demo_data: {}", seed_result);

        {
            let conn = db_state.lock().unwrap();
            assert_eq!(count(&conn, "clients", &company.id), 3);
            assert_eq!(count(&conn, "products", &company.id), 3);
            assert_eq!(count(&conn, "invoices", &company.id), 4);
            assert_eq!(count(&conn, "expenses", &company.id), 2);

            let paid_status: String = conn
                .query_row(
                    "SELECT status FROM invoices WHERE company_id = ?1 AND payment_method = 'especes'",
                    params![company.id],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(paid_status, "paid");

            let partial_status: String = conn
                .query_row(
                    "SELECT status FROM invoices WHERE company_id = ?1 AND payment_method = 'cheque'",
                    params![company.id],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(partial_status, "partial");

            let draft_status: String = conn
                .query_row("SELECT status FROM invoices WHERE company_id = ?1 AND status = 'draft'", params![company.id], |r| r.get(0))
                .unwrap();
            assert_eq!(draft_status, "draft");
        }

        // Re-running seed_demo_data must not collide on unique product
        // codes / client names left over from the first run.
        seed_demo_data(db_state.clone(), company.id.clone()).expect("second seed_demo_data run failed (idempotency broken)");
        {
            let conn = db_state.lock().unwrap();
            assert_eq!(count(&conn, "clients", &company.id), 3);
        }

        let clear_result = clear_demo_data(db_state.clone(), company.id.clone()).expect("clear_demo_data failed");
        println!("clear_demo_data: {}", clear_result);

        {
            let conn = db_state.lock().unwrap();
            assert_eq!(count(&conn, "clients", &company.id), 0);
            assert_eq!(count(&conn, "products", &company.id), 0);
            assert_eq!(count(&conn, "invoices", &company.id), 0);
            assert_eq!(count(&conn, "expenses", &company.id), 0);
        }

        drop(app);
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(format!("{}-wal", db_path.display()));
        let _ = std::fs::remove_file(format!("{}-shm", db_path.display()));
    }
}
