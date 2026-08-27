use rusqlite::{Connection, Transaction, params};

// Initialize database and create all tables
pub fn init_database(db_path: &str) -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open(db_path)?;
    
    // Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON", [])?;
    
    // Create tables

    // Multi-company / multi-workspace support — one row per registered
    // company, each with its own fiscal identity and invoice numbering.
    // Business tables below (clients, invoices, ...) carry a company_id FK
    // so every workspace's data is strictly isolated from every other.
    conn.execute(
        "CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            logo_base64 TEXT,
            activity TEXT,
            rc TEXT,
            nif TEXT,
            nis TEXT,
            article_imposition TEXT,
            address TEXT,
            phone TEXT,
            phones TEXT,
            email TEXT,
            website TEXT,
            capital TEXT,
            rib TEXT,
            bank_agency TEXT,
            extra_info TEXT,
            cnas_adherent TEXT,
            currency TEXT NOT NULL DEFAULT 'DZD',
            invoice_prefix TEXT NOT NULL DEFAULT 'FAC-2026-',
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY,
            code TEXT,
            name TEXT NOT NULL,
            contact_person TEXT,
            phone TEXT,
            email TEXT,
            address TEXT,
            city TEXT,
            wilaya TEXT,
            nif TEXT,
            nis TEXT,
            rc TEXT,
            secondary_rc TEXT,
            secondary_address TEXT,
            ai TEXT,
            activite TEXT,
            credit_limit REAL,
            payment_terms_days INTEGER,
            notes TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS suppliers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT,
            phone TEXT,
            email TEXT,
            address TEXT,
            city TEXT,
            rc TEXT,
            nif TEXT,
            nis TEXT,
            solde_du REAL DEFAULT 0,
            notes TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            unit TEXT DEFAULT 'tonne',
            unit_price REAL NOT NULL DEFAULT 0,
            timbre_exempt INTEGER,
            is_active INTEGER DEFAULT 1,
            display_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            invoice_number TEXT UNIQUE NOT NULL,
            client_id TEXT NOT NULL,
            invoice_date TEXT NOT NULL,
            due_date TEXT,
            month_period TEXT,
            subtotal_ht REAL DEFAULT 0,
            tva_rate REAL DEFAULT 19.00,
            tva_amount REAL DEFAULT 0,
            timbre REAL DEFAULT 0,
            total_ttc REAL DEFAULT 0,
            amount_paid REAL DEFAULT 0,
            balance_due REAL DEFAULT 0,
            status TEXT DEFAULT 'draft',
            invoice_type TEXT DEFAULT 'invoice',
            original_invoice_id TEXT,
            notes TEXT,
            header_note TEXT,
            discount REAL DEFAULT 0,
            discount_type TEXT DEFAULT 'percent',
            discount_value REAL DEFAULT 0,
            use_secondary_register BOOLEAN DEFAULT 0,
            selected_secondary_rc TEXT,
            selected_secondary_address TEXT,
            custom_title TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (client_id) REFERENCES clients(id)
        )",
        [],
    )?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS invoice_items (
            id TEXT PRIMARY KEY,
            invoice_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            product_description TEXT,
            quantity REAL NOT NULL DEFAULT 0,
            unit_price REAL NOT NULL,
            amount REAL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )",
        [],
    )?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            invoice_id TEXT NOT NULL,
            payment_date TEXT NOT NULL,
            amount REAL NOT NULL,
            payment_method TEXT,
            cheque_number TEXT,
            bank_name TEXT,
            value_date TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS client_draft_products (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            product_description TEXT,
            quantity REAL NOT NULL DEFAULT 0,
            unit_price REAL NOT NULL,
            amount REAL NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )",
        [],
    )?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS client_advances (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            payment_mode TEXT NOT NULL,
            reference TEXT,
            bank TEXT,
            issuer_name TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
        )",
        [],
    )?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            order_number TEXT UNIQUE NOT NULL,
            client_id TEXT,
            supplier_name TEXT,
            order_date TEXT NOT NULL,
            delivery_date TEXT,
            payment_terms TEXT,
            payment_method TEXT,
            status TEXT DEFAULT 'draft',
            subtotal_ht REAL DEFAULT 0,
            tva_rate REAL DEFAULT 19.0,
            tva_amount REAL DEFAULT 0,
            total_ttc REAL DEFAULT 0,
            notes TEXT,
            month_period TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS order_items (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            product_id TEXT,
            product_name TEXT,
            product_code TEXT,
            product_description TEXT,
            quantity REAL NOT NULL DEFAULT 0,
            unit_price REAL NOT NULL,
            tva_rate REAL DEFAULT 19.0,
            amount REAL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        )",
        [],
    )?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS delivery_notes (
            id TEXT PRIMARY KEY,
            delivery_number TEXT UNIQUE NOT NULL,
            client_id TEXT NOT NULL,
            delivery_date TEXT NOT NULL,
            invoice_id TEXT,
            order_id TEXT,
            truck_plate TEXT,
            driver_name TEXT,
            deliverer_name TEXT,
            deliverer_nin TEXT,
            transporter_name TEXT,
            transporter_nin TEXT,
            delivery_location TEXT,
            client_received_date TEXT,
            client_signature TEXT,
            supplier_delivered_date TEXT,
            is_invoiced INTEGER DEFAULT 0,
            notes TEXT,
            reserves TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            signed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (client_id) REFERENCES clients(id),
            FOREIGN KEY (invoice_id) REFERENCES invoices(id),
            FOREIGN KEY (order_id) REFERENCES orders(id)
        )",
        [],
    )?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS delivery_note_items (
            id TEXT PRIMARY KEY,
            delivery_note_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            product_description TEXT,
            quantity REAL NOT NULL DEFAULT 0,
            unit_price REAL,
            tva_rate REAL DEFAULT 19.0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )",
        [],
    )?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS expenses (
            id TEXT PRIMARY KEY,
            expense_date TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            amount REAL NOT NULL,
            payment_method TEXT,
            reference TEXT,
            notes TEXT,
            month_period TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;
    
    // Create sequences table for number generation
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sequences (
            name TEXT PRIMARY KEY,
            value INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;
    
    // Initialize sequences if they don't exist
    conn.execute(
        "INSERT OR IGNORE INTO sequences (name, value) VALUES ('invoice_number', 0)",
        [],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO sequences (name, value) VALUES ('delivery_note_number', 0)",
        [],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO sequences (name, value) VALUES ('order_number', 0)",
        [],
    )?;
    
    // Sync sequences with existing data to avoid conflicts
    sync_sequences(&conn)?;
    
    // Migration: Ensure orders.client_id can be NULL and add payment fields
    // SQLite doesn't support ALTER COLUMN, so we check if migration is needed
    migrate_orders_table_if_needed(&conn)?;
    
    // Migration: Ensure order_items.product_id can be NULL
    migrate_order_items_table_if_needed(&conn)?;
    
    // Migration: Add new fields to delivery_notes table
    migrate_delivery_notes_table_if_needed(&conn)?;
    
    // Migration: Add tva_rate to invoice_items table
    migrate_invoice_items_table_if_needed(&conn)?;
    
    // Migration: Add tva_rate to products table
    migrate_products_table_if_needed(&conn)?;

    // Migration: Add tva_rate to order_items and delivery_note_items
    migrate_order_items_tva_if_needed(&conn)?;
    migrate_delivery_note_items_tva_if_needed(&conn)?;

    // Migration: Add timbre_exempt to products table
    // Ensure migrations are run
    add_timbre_exempt_to_products(&conn)?;
    add_timbre_exempt_to_invoice_items(&conn)?;

    // Migration: Ensure invoice_items.product_id can be NULL and add
    // product_name/product_code, so a line item can be a custom/one-off
    // entry that doesn't correspond to any row in the products catalog.
    // Must run after the tva_rate/timbre_exempt migrations above — it
    // recreates the table and needs those columns to already exist.
    migrate_invoice_items_nullable_product_if_needed(&conn)?;

    // Migration: Same as above for delivery_note_items — must run after
    // migrate_delivery_note_items_tva_if_needed (tva_rate/unit_price columns).
    migrate_delivery_note_items_nullable_product_if_needed(&conn)?;

    // Migration: Add initial_balance to clients table
    migrate_clients_table_if_needed(&conn)?;

    // Migration: Add advance_payment to clients table
    migrate_clients_advance_payment_if_needed(&conn)?;

    // Migration: Add header_note to invoices table
    migrate_invoices_table_if_needed(&conn)?;

    // Migration: Add discount to invoices table
    migrate_invoices_discount_if_needed(&conn)?;
    migrate_clients_secondary_rc_if_needed(&conn)?;
    migrate_clients_activite_if_needed(&conn)?;
    migrate_invoices_secondary_register_if_needed(&conn)?;
    
    // Migration: Add custom_title to invoices table
    migrate_invoices_custom_title_if_needed(&conn)?;

    // Migration: Add custom_title to orders table
    conn.execute("ALTER TABLE orders ADD COLUMN custom_title TEXT", params![]).unwrap_or_default();

    // Migration: Add custom_title to delivery_notes table
    conn.execute("ALTER TABLE delivery_notes ADD COLUMN custom_title TEXT", params![]).unwrap_or_default();

    // Migration: Add supplier fields to orders table
    migrate_orders_supplier_fields_if_needed(&conn)?;

    // Create production_logs table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS production_logs (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            extraction REAL DEFAULT 0,
            waste REAL DEFAULT 0,
            merchant_product REAL DEFAULT 0,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    // Create employees table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT,
            email TEXT,
            phone TEXT,
            address TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    // omada-agency branch only: HR/payroll module (punch import, monthly
    // payroll calculation, salary advances). Not part of the core Sordi
    // product. See PROJECT_STATE.md.
    migrate_punch_records_schema_if_needed(&conn)?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS punch_records (
            id TEXT PRIMARY KEY,
            external_code TEXT NOT NULL,
            employee_id TEXT,
            punch_time TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
            UNIQUE (external_code, punch_time)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS payroll_runs (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL,
            month TEXT NOT NULL,
            base_salary REAL NOT NULL,
            working_days_in_month REAL NOT NULL,
            absence_days REAL NOT NULL,
            daily_rate REAL NOT NULL,
            absence_deduction REAL NOT NULL,
            primes REAL DEFAULT 0,
            avance_deduction REAL DEFAULT 0,
            net_a_payer REAL NOT NULL,
            paid INTEGER DEFAULT 0,
            paid_date TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
            UNIQUE (employee_id, month)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS employee_advances (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL,
            amount REAL NOT NULL,
            date_taken TEXT NOT NULL,
            month_to_deduct TEXT NOT NULL,
            deducted INTEGER DEFAULT 0,
            deducted_in_payroll_run_id TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
            FOREIGN KEY (deducted_in_payroll_run_id) REFERENCES payroll_runs(id) ON DELETE SET NULL
        )",
        [],
    )?;

    // omada-agency branch only: retires the old loosely-typed projects/
    // employee_scores tables (confirmed empty in every database this app has
    // ever created) before creating the new client-linked, invoice-derived
    // project-management schema below. See PROJECT_STATE.md / this branch's
    // own history for why — not part of the core Sordi product.
    migrate_legacy_projects_module(&conn)?;

    // Create projects table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            name TEXT NOT NULL,
            service_categories TEXT NOT NULL,
            responsible_person TEXT,
            start_date TEXT,
            deadline TEXT,
            planned_budget REAL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (client_id) REFERENCES clients(id)
        )",
        [],
    )?;

    // Create project_tasks table. status is one of: à_faire, en_cours,
    // en_revision_interne, envoye_client, approuve — validated in Rust/TS,
    // not a DB CHECK constraint (matches invoices.status/orders.status).
    conn.execute(
        "CREATE TABLE IF NOT EXISTS project_tasks (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            title TEXT NOT NULL,
            assigned_resource_id TEXT,
            status TEXT NOT NULL DEFAULT 'à_faire',
            revision_count INTEGER NOT NULL DEFAULT 0,
            due_date TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (assigned_resource_id) REFERENCES employees(id) ON DELETE SET NULL
        )",
        [],
    )?;

    // Create project_deliverables table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS project_deliverables (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT,
            link_or_path TEXT,
            delivered_to_client INTEGER DEFAULT 0,
            approved INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Bespoke client contracts (50/50 milestone billing) — one per project,
    // built from the project's two Acompte/Solde invoices. company_id is
    // NOT NULL from day one (this table is introduced after multi-company
    // support already exists, so it never needs a backfill migration like
    // COMPANY_SCOPED_TABLES' ALTER-TABLE path does).
    conn.execute(
        "CREATE TABLE IF NOT EXISTS contracts (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL REFERENCES companies(id),
            project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
            client_id TEXT NOT NULL REFERENCES clients(id),
            contract_ref TEXT NOT NULL UNIQUE,
            selected_services TEXT NOT NULL DEFAULT '[]',
            payment_split TEXT NOT NULL DEFAULT '50_50',
            total_amount_ht REAL NOT NULL,
            tva_rate REAL NOT NULL DEFAULT 19.0,
            tva_amount REAL NOT NULL,
            total_amount_ttc REAL NOT NULL,
            invoices_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    migrate_contracts_services_if_needed(&conn)?;

    // Create settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Create activity_logs table for History feature
    conn.execute(
        "CREATE TABLE IF NOT EXISTS activity_logs (
            id TEXT PRIMARY KEY,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            description TEXT NOT NULL,
            user_id TEXT,
            created_at TEXT NOT NULL
        )",
        [],
    )?;

        // Initialize default settings if they don't exist
    let default_settings = [
        ("company_name", ""),
        ("company_address", ""),
        ("company_rc", ""),
        ("company_nif", ""),
        ("company_nis", ""),
        ("company_ai", ""),
        ("company_rib", ""),
        ("primary_color", "#FFCD00"),
        ("logo_bg_color", "#000000"),
        ("logo_text_color", "#FFFFFF"),
        ("logo_size", "67"),
        ("stamp_size", "96"),
        ("signature_size", "96"),
        ("company_info_size", "13"),
        ("company_extra_info", "[]"),
        ("stamp_data", ""),
        ("signature_data", ""),
        ("company_email", ""),
        ("company_phone", ""),
        ("logo_data", "data:image/png;base64,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"),
        ("company_phones", "[]"),
        ("company_website", ""),
        ("company_bank_agency", ""),
        ("company_capital", ""),
        ("qr_code_data", "data:image/png;base64,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2Dr94HgEIcYSlyxxlyD6e8BPakg6q/XUlepJ8bF5zqM9KXMO8JWF7ljcVQB3I9ddd9247gqCOyN3lwpfdzyKbAWuS193ip1eAwRMX+sjk2O64esJOBonljbJUNRac9cF3BjA4486zG6ng4QonTrlfve731AAowfucP2RTomEHq4gag950ZkM+GSidTNiM8OVmE5Tp4En7+4cj9l3bJ0MNyseQUiSnlj0cxqRuwceNj/mMY8ZeNDV04BHPepR83kae86jndufA91WJutYFUhzspJjrzSQJwBaO5YDKJxEM4vg2dn+S9bc1p3PbY7pBs8JoLV5tILHNv1CdzAdmkiCgFayALj05BtjsuHCsSZQeOvX6W3hwUdHFpwCOn36SSo6FAfN5QC+7HBS0QGYczpWhvF5wF4bho140I0+LRHOozuBSLBrepEYb45wDK8kCERy86u09KEHg5KVRHW2NcA56OAd0w0f9HCTm/kJePngxVkgWXUPfAmkta4FSeb77UlOH3PwF73IAcXTlocTmK54kdOWDpcGOFky6I7mcgAPOoknPZPMSzrdbg0ky2dywaa/8cYb50ZXItD9PB7/HwAAAP//KjOLhgAAAAZJREFUAwAZgg6kNvr26gAAAABJRU5ErkJggg=="),
        ("footer_logo_data", "data:image/png;base64,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"),
        ("body_pattern_data", "data:image/png;base64,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"),
    ];

    {
        let mut stmt = conn.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)")?;
        for (key, value) in default_settings.iter() {
            stmt.execute(rusqlite::params![key, value])?;
        }
    }


    // Create users table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    // Partners & equity distribution (omada-agency branch only). Brand-new
    // tables, not a migration — nothing pre-existing depends on their shape.
    conn.execute(
        "CREATE TABLE IF NOT EXISTS partners (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            role TEXT,
            equity_percentage REAL NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS partner_withdrawals (
            id TEXT PRIMARY KEY,
            partner_id TEXT NOT NULL,
            withdrawal_date TEXT NOT NULL,
            amount REAL NOT NULL,
            payment_method TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Migration: Add discount to invoices table
    migrate_invoices_discount_if_needed(&conn)?;

    // Migration: Add payment_method to invoices table
    migrate_invoices_payment_method_if_needed(&conn)?;

    // Migration: Add tax_mode to invoices table
    migrate_invoices_tax_mode_if_needed(&conn)?;

    // Migration: Add custom_title to invoices table
    migrate_invoices_custom_title_if_needed(&conn)?;

    // Migration: Add bank/reference to client_advances
    migrate_client_advances_if_needed(&conn)?;

    // Migration: Add project_id to invoices (omada-agency branch only)
    migrate_invoices_project_id_if_needed(&conn)?;

    // Migration: Add project linkage + recurring metadata to expenses (omada-agency branch only)
    migrate_expenses_project_linkage_if_needed(&conn)?;

    // Migration: Add supplier linkage to expenses (Fournisseurs module)
    migrate_expenses_supplier_linkage_if_needed(&conn)?;

    // Migration: Add payroll fields to employees (omada-agency branch only)
    migrate_employees_payroll_fields_if_needed(&conn)?;
    migrate_employee_photos_and_documents_if_needed(&conn)?;

    // Migration: Add freelancer payment fields to projects (omada-agency branch only)
    migrate_projects_freelance_fields_if_needed(&conn)?;

    // Migration: Add product_description to all items tables
    migrate_items_description_if_needed(&conn)?;

    // Migration: Add operator (Encaissé par) + attachment support to payments
    migrate_payments_attachments_and_operator_if_needed(&conn)?;

    // Fix existing NULL tva_rate values
    conn.execute("UPDATE invoice_items SET tva_rate = 19.0 WHERE tva_rate IS NULL", [])?;
    conn.execute("UPDATE products SET tva_rate = 19.0 WHERE tva_rate IS NULL", [])?;

    // Migration: adds the extended company-profile columns (phones, website,
    // capital, rib, bank_agency, extra_info, cnas_adherent) to `companies`
    // for databases created before those columns existed.
    migrate_companies_extra_fields_if_needed(&conn)?;

    // Migration: Multi-company support — seed a default company and add
    // company_id to every business table. Runs last so every table it
    // touches is guaranteed to already exist.
    migrate_multi_company_if_needed(&conn)?;

    Ok(conn)
}

fn migrate_items_description_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let tables = ["invoice_items", "order_items", "delivery_note_items", "client_draft_products"];
    
    for table in tables.iter() {
        let table_info: Result<Vec<_>, _> = conn.prepare(&format!("PRAGMA table_info({})", table))?
            .query_map([], |row| {
                Ok(row.get::<_, String>(1)?)
            })?
            .collect();
        
        if let Ok(columns) = table_info {
            if !columns.contains(&"product_description".to_string()) {
                let sql = format!("ALTER TABLE {} ADD COLUMN product_description TEXT", table);
                conn.execute(&sql, [])?;
            }
        }
    }
    
    Ok(())
}

// omada-agency branch only. Old projects/employee_scores were confirmed
// empty in every database this app has ever created (dev machine's current
// + both pre-rename app-identity databases) before being retired in favor of
// the client-linked/invoice-derived project module — see init_database's
// call site. employee_scores depended entirely on the old projects table's
// semantics (team-scoring against a loosely-typed tracker), so both go
// together; only drops the old `projects` shape if it's still empty, so a
// hypothetical install with real legacy rows is left alone rather than
// silently destroyed.
fn migrate_legacy_projects_module(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute("DROP TABLE IF EXISTS employee_scores", [])?;

    let projects_table_exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'projects'",
        [],
        |row| row.get(0),
    )?;
    if projects_table_exists == 0 {
        return Ok(());
    }

    let table_info: Result<Vec<String>, _> = conn
        .prepare("PRAGMA table_info(projects)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .collect();
    if let Ok(columns) = table_info {
        let is_old_schema = !columns.contains(&"client_id".to_string());
        if is_old_schema {
            let row_count: i64 = conn.query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))?;
            if row_count == 0 {
                conn.execute("DROP TABLE projects", [])?;
            }
        }
    }

    Ok(())
}

// omada-agency branch only. Adds payroll fields to the existing employees
// table, matching the same PRAGMA table_info idiom as every other ALTER
// migration in this file.
// omada-agency branch only. The first cut of punch_records required
// employee_id NOT NULL, which meant an import of unmapped device codes
// silently discarded every row instead of keeping them for later mapping.
// Fixed shape: external_code (the raw device number) is always stored and
// is the real dedup key (UNIQUE with punch_time); employee_id is nullable,
// resolved via employees.external_code and backfillable later. Only drops
// the old shape if it's empty — this table has no real data yet (the bug
// meant no row ever actually persisted for an unmapped code), so this is
// safe, but still guarded rather than assumed.
// omada-agency branch only. Freelancer project payments — a separate
// nullable freelancer_id (not responsible_person, which is deliberately
// plain free text) plus the agreed lump-sum amount and its paid status.
// ALTER-only (never drops projects): unlike punch_records, real project
// rows exist by the time this was added.
fn migrate_projects_freelance_fields_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(projects)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();

    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();

        if !column_names.contains(&"freelancer_id".to_string()) {
            conn.execute("ALTER TABLE projects ADD COLUMN freelancer_id TEXT REFERENCES employees(id) ON DELETE SET NULL", [])?;
        }
        if !column_names.contains(&"montant_convenu".to_string()) {
            conn.execute("ALTER TABLE projects ADD COLUMN montant_convenu REAL", [])?;
        }
        if !column_names.contains(&"statut_paiement".to_string()) {
            conn.execute("ALTER TABLE projects ADD COLUMN statut_paiement TEXT DEFAULT 'non_paye'", [])?;
        }
        if !column_names.contains(&"date_paiement".to_string()) {
            conn.execute("ALTER TABLE projects ADD COLUMN date_paiement TEXT", [])?;
        }
    }

    Ok(())
}

fn migrate_punch_records_schema_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'punch_records'",
        [],
        |row| row.get(0),
    )?;
    if table_exists == 0 {
        return Ok(());
    }

    let table_info: Result<Vec<String>, _> = conn
        .prepare("PRAGMA table_info(punch_records)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .collect();
    if let Ok(columns) = table_info {
        let is_old_shape = !columns.contains(&"external_code".to_string());
        if is_old_shape {
            let row_count: i64 = conn.query_row("SELECT COUNT(*) FROM punch_records", [], |row| row.get(0))?;
            if row_count == 0 {
                conn.execute("DROP TABLE punch_records", [])?;
            }
        }
    }

    Ok(())
}

fn migrate_employees_payroll_fields_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(employees)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();

    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();

        if !column_names.contains(&"base_salary".to_string()) {
            conn.execute("ALTER TABLE employees ADD COLUMN base_salary REAL", [])?;
        }
        if !column_names.contains(&"hire_date".to_string()) {
            conn.execute("ALTER TABLE employees ADD COLUMN hire_date TEXT", [])?;
        }
        if !column_names.contains(&"contract_type".to_string()) {
            conn.execute("ALTER TABLE employees ADD COLUMN contract_type TEXT", [])?;
        }
        if !column_names.contains(&"rib".to_string()) {
            conn.execute("ALTER TABLE employees ADD COLUMN rib TEXT", [])?;
        }
        // Maps a device's own numeric employee ID (from the attendance/punch
        // export, e.g. ZKTeco's PIN field) onto our internal employees.id —
        // the export never carries our UUID or a name, only this number.
        if !column_names.contains(&"external_code".to_string()) {
            conn.execute("ALTER TABLE employees ADD COLUMN external_code TEXT", [])?;
        }
    }

    Ok(())
}

/// photo_path/employee_documents.file_path store paths relative to
/// app_data_dir (e.g. "employee_photos/<id>.jpg"), never absolute — resolved
/// fresh against app_data_dir at read time, same convention as
/// database.db/license.token. See commands.rs's employee photo/document
/// commands for where these get written.
fn migrate_employee_photos_and_documents_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(employees)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();

    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        if !column_names.contains(&"photo_path".to_string()) {
            conn.execute("ALTER TABLE employees ADD COLUMN photo_path TEXT", [])?;
        }
    }

    conn.execute(
        "CREATE TABLE IF NOT EXISTS employee_documents (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            doc_type TEXT,
            file_path TEXT NOT NULL,
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    Ok(())
}

/// Adds "Encaissé par" (employee_id, nullable — most existing rows predate
/// this field) to payments, and a payment_attachments table for proof-of-
/// payment scans (receipt/bank slip/cheque copy). Files are copied verbatim
/// to app_data_dir/payment_attachments/<payment_id>/<file>, same convention
/// as employee_documents — see commands.rs's add_payment_attachment.
fn migrate_payments_attachments_and_operator_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(payments)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();

    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        if !column_names.contains(&"employee_id".to_string()) {
            conn.execute("ALTER TABLE payments ADD COLUMN employee_id TEXT REFERENCES employees(id)", [])?;
        }
    }

    conn.execute(
        "CREATE TABLE IF NOT EXISTS payment_attachments (
            id TEXT PRIMARY KEY,
            payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    Ok(())
}

fn migrate_invoices_project_id_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(invoices)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();

    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();

        if !column_names.contains(&"project_id".to_string()) {
            conn.execute("ALTER TABLE invoices ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL", [])?;
        }
    }

    Ok(())
}

// Migration: link expenses to a project (for direct-cost/profitability
// tracking, see get_project_profitability) and add optional recurring-charge
// metadata. Purely additive — every existing row keeps working unchanged,
// since nothing in the app filters or sums on these columns yet except the
// new project-scoped query paths that require them to exist.
fn migrate_expenses_project_linkage_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(expenses)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .collect();

    if let Ok(column_names) = table_info {
        if !column_names.contains(&"project_id".to_string()) {
            conn.execute("ALTER TABLE expenses ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL", [])?;
        }
        if !column_names.contains(&"is_recurring".to_string()) {
            conn.execute("ALTER TABLE expenses ADD COLUMN is_recurring INTEGER DEFAULT 0", [])?;
        }
        if !column_names.contains(&"recurrence_interval".to_string()) {
            conn.execute("ALTER TABLE expenses ADD COLUMN recurrence_interval TEXT", [])?;
        }
    }

    Ok(())
}

// Migration: Add supplier_id linkage to expenses (Fournisseurs module)
// Multi-company migration — runs once per startup, idempotently:
//  1. If `companies` is empty, seed one default company from whatever is
//     already in `settings` (company_name/company_rc/...), so an existing
//     single-workspace install gets a real company row instead of losing
//     its identity on upgrade.
//  2. Add company_id to every business table that needs data isolation,
//     backfilling existing rows to that default company so nothing already
//     in the database becomes orphaned/invisible after the migration.
const COMPANY_SCOPED_TABLES: &[&str] = &[
    "clients", "suppliers", "products", "invoices", "payments",
    "orders", "delivery_notes", "expenses", "projects", "employees",
    "partners",
];

fn migrate_contracts_services_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(contracts)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .collect();
    if let Ok(column_names) = table_info {
        if !column_names.contains(&"selected_services".to_string()) {
            conn.execute("ALTER TABLE contracts ADD COLUMN selected_services TEXT NOT NULL DEFAULT '[]'", [])?;
        }
        if !column_names.contains(&"tva_rate".to_string()) {
            conn.execute("ALTER TABLE contracts ADD COLUMN tva_rate REAL NOT NULL DEFAULT 19.0", [])?;
        }
        if !column_names.contains(&"payment_split".to_string()) {
            conn.execute("ALTER TABLE contracts ADD COLUMN payment_split TEXT NOT NULL DEFAULT '50_50'", [])?;
        }
    }

    // Early builds of this table declared project_id NOT NULL — contracts
    // are now allowed to stand alone with no linked project, and SQLite's
    // ALTER TABLE can't relax a NOT NULL/FK constraint in place, so any
    // database created before that change needs the table rebuilt (standard
    // SQLite "12-step" table redefinition) with project_id nullable, copying
    // every existing row across untouched.
    let project_id_not_null: bool = conn.query_row(
        "SELECT \"notnull\" FROM pragma_table_info('contracts') WHERE name = 'project_id'",
        [],
        |row| row.get(0),
    ).unwrap_or(false);
    if project_id_not_null {
        conn.execute_batch(
            "ALTER TABLE contracts RENAME TO contracts_old;
             CREATE TABLE contracts (
                 id TEXT PRIMARY KEY,
                 company_id TEXT NOT NULL REFERENCES companies(id),
                 project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
                 client_id TEXT NOT NULL REFERENCES clients(id),
                 contract_ref TEXT NOT NULL UNIQUE,
                 selected_services TEXT NOT NULL DEFAULT '[]',
                 payment_split TEXT NOT NULL DEFAULT '50_50',
                 total_amount_ht REAL NOT NULL,
                 tva_rate REAL NOT NULL DEFAULT 19.0,
                 tva_amount REAL NOT NULL,
                 total_amount_ttc REAL NOT NULL,
                 invoices_json TEXT NOT NULL,
                 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );
             INSERT INTO contracts (id, company_id, project_id, client_id, contract_ref, selected_services, payment_split, total_amount_ht, tva_rate, tva_amount, total_amount_ttc, invoices_json, created_at)
             SELECT id, company_id, project_id, client_id, contract_ref, selected_services, payment_split, total_amount_ht, tva_rate, tva_amount, total_amount_ttc, invoices_json, created_at FROM contracts_old;
             DROP TABLE contracts_old;"
        )?;
    }

    Ok(())
}

fn migrate_companies_extra_fields_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(companies)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .collect();
    if let Ok(column_names) = table_info {
        for column in ["phones", "website", "capital", "rib", "bank_agency", "extra_info", "cnas_adherent"] {
            if !column_names.contains(&column.to_string()) {
                conn.execute(&format!("ALTER TABLE companies ADD COLUMN {} TEXT", column), [])?;
            }
        }
    }
    Ok(())
}

fn migrate_multi_company_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let company_count: i64 = conn.query_row("SELECT COUNT(*) FROM companies", [], |row| row.get(0))?;

    let default_company_id: String = if company_count == 0 {
        let get_setting = |key: &str| -> Option<String> {
            conn.query_row("SELECT value FROM settings WHERE key = ?1", params![key], |row| row.get(0)).ok()
        };
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO companies (id, name, logo_base64, activity, rc, nif, nis, article_imposition, address, phone, phones, email, website, capital, rib, bank_agency, extra_info, cnas_adherent, currency, invoice_prefix, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, 'DZD', ?19, ?20)",
            params![
                id,
                get_setting("company_name").filter(|v| !v.is_empty()).unwrap_or_else(|| "Mon Entreprise".to_string()),
                get_setting("logo_data"),
                None::<String>,
                get_setting("company_rc"),
                get_setting("company_nif"),
                get_setting("company_nis"),
                get_setting("company_ai"),
                get_setting("company_address"),
                get_setting("company_phone"),
                get_setting("company_phones"),
                get_setting("company_email"),
                get_setting("company_website"),
                get_setting("company_capital"),
                get_setting("company_rib"),
                get_setting("company_bank_agency"),
                get_setting("company_extra_info"),
                get_setting("company_cnas_adherent"),
                "FAC-2026-",
                now,
            ],
        )?;
        id
    } else {
        conn.query_row("SELECT id FROM companies ORDER BY created_at LIMIT 1", [], |row| row.get(0))?
    };

    for table in COMPANY_SCOPED_TABLES {
        let table_info: Result<Vec<_>, _> = conn.prepare(&format!("PRAGMA table_info({})", table))?
            .query_map([], |row| row.get::<_, String>(1))?
            .collect();
        if let Ok(column_names) = table_info {
            if !column_names.contains(&"company_id".to_string()) {
                conn.execute(
                    &format!("ALTER TABLE {} ADD COLUMN company_id TEXT REFERENCES companies(id)", table),
                    [],
                )?;
                conn.execute(
                    &format!("UPDATE {} SET company_id = ?1 WHERE company_id IS NULL", table),
                    params![default_company_id],
                )?;
            }
        }
    }

    Ok(())
}

fn migrate_expenses_supplier_linkage_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(expenses)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .collect();

    if let Ok(column_names) = table_info {
        if !column_names.contains(&"supplier_id".to_string()) {
            conn.execute("ALTER TABLE expenses ADD COLUMN supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL", [])?;
        }
    }

    Ok(())
}

fn migrate_client_advances_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(client_advances)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();
    
    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        
        if !column_names.contains(&"reference".to_string()) {
            conn.execute("ALTER TABLE client_advances ADD COLUMN reference TEXT", [])?;
        }
        if !column_names.contains(&"bank".to_string()) {
            conn.execute("ALTER TABLE client_advances ADD COLUMN bank TEXT", [])?;
        }
        if !column_names.contains(&"issuer_name".to_string()) {
            conn.execute("ALTER TABLE client_advances ADD COLUMN issuer_name TEXT", [])?;
        }
        if !column_names.contains(&"notes".to_string()) {
            conn.execute("ALTER TABLE client_advances ADD COLUMN notes TEXT", [])?;
        }
    }
    
    Ok(())
}

fn migrate_clients_advance_payment_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(clients)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();
    
    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        
        if !column_names.contains(&"advance_payment".to_string()) {
            conn.execute("ALTER TABLE clients ADD COLUMN advance_payment REAL DEFAULT 0", [])?;
        }
    }
    
    Ok(())
}

pub fn has_password_set(conn: &Connection) -> Result<bool, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM users")?;
    let count: i64 = stmt.query_row([], |row| row.get(0))?;
    Ok(count > 0)
}

pub fn check_password(conn: &Connection, password: &str) -> Result<bool, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT password_hash FROM users LIMIT 1")?;
    let stored_obfuscated: String = match stmt.query_row([], |row| row.get(0)) {
        Ok(h) => h,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(false),
        Err(e) => return Err(e),
    };

    use base64::{Engine as _, engine::general_purpose};
    let provided_obfuscated = general_purpose::STANDARD.encode(password.as_bytes());

    Ok(provided_obfuscated == stored_obfuscated)
}

pub fn set_password(conn: &Connection, new_password: &str) -> Result<(), rusqlite::Error> {
    use base64::{Engine as _, engine::general_purpose};
    let hash = general_purpose::STANDARD.encode(new_password.as_bytes());
    let now = chrono::Local::now().to_rfc3339();
    
    // For this app, we only support one user for now
    let user_count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    
    if user_count == 0 {
        conn.execute(
            "INSERT INTO users (id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            params![uuid::Uuid::new_v4().to_string(), "admin", hash, now, now],
        )?;
    } else {
        conn.execute(
            "UPDATE users SET password_hash = ?, updated_at = ?",
            params![hash, now],
        )?;
    }
    
    Ok(())
}


fn migrate_orders_supplier_fields_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(orders)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();
    
    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        
        let fields_to_add = [
            ("supplier_address", "TEXT"),
            ("supplier_email", "TEXT"),
            ("supplier_phone", "TEXT"),
            ("supplier_rc", "TEXT"),
            ("supplier_nif", "TEXT"),
            ("supplier_nis", "TEXT"),
            ("supplier_ai", "TEXT"),
        ];
        
        for (field, field_type) in fields_to_add.iter() {
            if !column_names.contains(&field.to_string()) {
                let sql = format!("ALTER TABLE orders ADD COLUMN {} {}", field, field_type);
                conn.execute(&sql, [])?;
            }
        }
    }
    
    Ok(())
}

// Migration function to add header_note to invoices table
fn migrate_invoices_table_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(invoices)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();
    
    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        
        let has_header_note = column_names.contains(&"header_note".to_string());
        
        if !has_header_note {
            conn.execute("ALTER TABLE invoices ADD COLUMN header_note TEXT", [])?;
        }
    }
    
    Ok(())
}

// Migration function to ensure orders.client_id can be NULL and add payment fields
fn migrate_orders_table_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Check if migration is needed by trying to query the table structure
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(orders)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();
    
    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        
        // Check if client_id exists and if it has a NOT NULL constraint
        let client_id_info = columns.iter().find(|(name, _)| name == "client_id");
        let has_payment_terms = column_names.contains(&"payment_terms".to_string());
        let has_payment_method = column_names.contains(&"payment_method".to_string());
        
        // Check if we need to recreate the table (client_id NOT NULL) or just add columns
        let needs_recreation = if let Some((_, Some(1))) = client_id_info {
            true // client_id has NOT NULL constraint
        } else {
            false
        };
        
        if needs_recreation || !has_payment_terms || !has_payment_method {
            conn.execute("BEGIN TRANSACTION", [])?;
            
            if needs_recreation {
                // Recreate the table with nullable client_id and payment fields
                conn.execute(
                    "CREATE TABLE IF NOT EXISTS orders_new (
                        id TEXT PRIMARY KEY,
                        order_number TEXT UNIQUE NOT NULL,
                        client_id TEXT,
                        supplier_name TEXT,
                        order_date TEXT NOT NULL,
                        delivery_date TEXT,
                        payment_terms TEXT,
                        payment_method TEXT,
                        status TEXT DEFAULT 'draft',
                        subtotal_ht REAL DEFAULT 0,
                        tva_rate REAL DEFAULT 19.0,
                        tva_amount REAL DEFAULT 0,
                        total_ttc REAL DEFAULT 0,
                        notes TEXT,
                        month_period TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    )",
                    [],
                )?;
                
                // Copy data - need to handle all columns explicitly
                conn.execute(
                    "INSERT INTO orders_new (id, order_number, client_id, supplier_name, order_date, delivery_date, payment_terms, payment_method, status, subtotal_ht, tva_rate, tva_amount, total_ttc, notes, month_period, created_at, updated_at) 
                     SELECT id, order_number, client_id, supplier_name, order_date, delivery_date, NULL, NULL, COALESCE(status, 'draft'), COALESCE(subtotal_ht, 0), COALESCE(tva_rate, 19.0), COALESCE(tva_amount, 0), COALESCE(total_ttc, 0), notes, month_period, created_at, updated_at FROM orders",
                    [],
                )?;
                
                // Drop old table
                conn.execute("DROP TABLE orders", [])?;
                
                // Rename new table
                conn.execute("ALTER TABLE orders_new RENAME TO orders", [])?;
            } else {
                // Just add missing columns using ALTER TABLE (SQLite supports this)
                if !has_payment_terms {
                    conn.execute("ALTER TABLE orders ADD COLUMN payment_terms TEXT", [])?;
                }
                if !has_payment_method {
                    conn.execute("ALTER TABLE orders ADD COLUMN payment_method TEXT", [])?;
                }
                // Update tva_rate default if it's still 0 or NULL
                conn.execute("UPDATE orders SET tva_rate = 19.0 WHERE tva_rate IS NULL OR tva_rate = 0", [])?;
            }
            
            conn.execute("COMMIT", [])?;
        }
    }
    
    Ok(())
}

// Migration function to ensure order_items.product_id can be NULL and add product_name/product_code
fn migrate_order_items_table_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Check if migration is needed by trying to query the table structure
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(order_items)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();
    
    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        
        // Check if product_id exists and if it has a NOT NULL constraint
        let product_id_info = columns.iter().find(|(name, _)| name == "product_id");
        let has_product_name = column_names.contains(&"product_name".to_string());
        let has_product_code = column_names.contains(&"product_code".to_string());
        
        // Check if we need to recreate the table (product_id NOT NULL) or just add columns
        let needs_recreation = if let Some((_, Some(1))) = product_id_info {
            true // product_id has NOT NULL constraint
        } else {
            false
        };
        
        if needs_recreation || !has_product_name || !has_product_code {
            conn.execute("BEGIN TRANSACTION", [])?;
            
            if needs_recreation {
                // Recreate the table with nullable product_id and product_name/product_code fields
                conn.execute(
                    "CREATE TABLE IF NOT EXISTS order_items_new (
                        id TEXT PRIMARY KEY,
                        order_id TEXT NOT NULL,
                        product_id TEXT,
                        product_name TEXT,
                        product_code TEXT,
                        quantity REAL NOT NULL DEFAULT 0,
                        unit_price REAL NOT NULL,
                        amount REAL,
                        created_at TEXT NOT NULL,
                        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
                    )",
                    [],
                )?;
                
                // Copy data - need to handle all columns explicitly
                conn.execute(
                    "INSERT INTO order_items_new (id, order_id, product_id, product_name, product_code, quantity, unit_price, amount, created_at) 
                     SELECT id, order_id, product_id, NULL, NULL, quantity, unit_price, amount, created_at FROM order_items",
                    [],
                )?;
                
                // Drop old table
                conn.execute("DROP TABLE order_items", [])?;
                
                // Rename new table
                conn.execute("ALTER TABLE order_items_new RENAME TO order_items", [])?;
            } else {
                // Just add missing columns using ALTER TABLE
                if !has_product_name {
                    conn.execute("ALTER TABLE order_items ADD COLUMN product_name TEXT", [])?;
                }
                if !has_product_code {
                    conn.execute("ALTER TABLE order_items ADD COLUMN product_code TEXT", [])?;
                }
            }
            
            conn.execute("COMMIT", [])?;
        }
    }
    
    Ok(())
}

// Migration function to add new fields to delivery_notes table
fn migrate_delivery_notes_table_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(delivery_notes)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();
    
    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        
        let mut needs_migration = false;
        
        // Check which columns are missing
        let has_order_id = column_names.contains(&"order_id".to_string());
        let has_deliverer_name = column_names.contains(&"deliverer_name".to_string());
        let has_deliverer_nin = column_names.contains(&"deliverer_nin".to_string());
        let has_transporter_name = column_names.contains(&"transporter_name".to_string());
        let has_transporter_nin = column_names.contains(&"transporter_nin".to_string());
        let has_delivery_location = column_names.contains(&"delivery_location".to_string());
        let has_client_received_date = column_names.contains(&"client_received_date".to_string());
        let has_client_signature = column_names.contains(&"client_signature".to_string());
        let has_supplier_delivered_date = column_names.contains(&"supplier_delivered_date".to_string());
        let has_reserves = column_names.contains(&"reserves".to_string());
        let has_status = column_names.contains(&"status".to_string());
        let has_signed_at = column_names.contains(&"signed_at".to_string());

        if !has_order_id || !has_deliverer_name || !has_deliverer_nin ||
           !has_transporter_name || !has_transporter_nin || !has_delivery_location ||
           !has_client_received_date || !has_client_signature ||
           !has_supplier_delivered_date || !has_reserves ||
           !has_status || !has_signed_at {
            needs_migration = true;
        }
        
        if needs_migration {
            conn.execute("BEGIN TRANSACTION", [])?;
            
            // Add missing columns using ALTER TABLE
            if !has_order_id {
                conn.execute("ALTER TABLE delivery_notes ADD COLUMN order_id TEXT", [])?;
            }
            if !has_deliverer_name {
                conn.execute("ALTER TABLE delivery_notes ADD COLUMN deliverer_name TEXT", [])?;
            }
            if !has_deliverer_nin {
                conn.execute("ALTER TABLE delivery_notes ADD COLUMN deliverer_nin TEXT", [])?;
            }
            if !has_transporter_name {
                conn.execute("ALTER TABLE delivery_notes ADD COLUMN transporter_name TEXT", [])?;
            }
            if !has_transporter_nin {
                conn.execute("ALTER TABLE delivery_notes ADD COLUMN transporter_nin TEXT", [])?;
            }
            if !has_delivery_location {
                conn.execute("ALTER TABLE delivery_notes ADD COLUMN delivery_location TEXT", [])?;
            }
            if !has_client_received_date {
                conn.execute("ALTER TABLE delivery_notes ADD COLUMN client_received_date TEXT", [])?;
            }
            if !has_client_signature {
                conn.execute("ALTER TABLE delivery_notes ADD COLUMN client_signature TEXT", [])?;
            }
            if !has_supplier_delivered_date {
                conn.execute("ALTER TABLE delivery_notes ADD COLUMN supplier_delivered_date TEXT", [])?;
            }
            if !has_reserves {
                conn.execute("ALTER TABLE delivery_notes ADD COLUMN reserves TEXT", [])?;
            }
            if !has_status {
                conn.execute("ALTER TABLE delivery_notes ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'", [])?;
            }
            if !has_signed_at {
                conn.execute("ALTER TABLE delivery_notes ADD COLUMN signed_at TEXT", [])?;
            }

            conn.execute("COMMIT", [])?;
        }
    }

    Ok(())
}

// Migration function to add tva_rate column to invoice_items table
fn migrate_invoice_items_table_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(invoice_items)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();
    
    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        
        let has_tva_rate = column_names.contains(&"tva_rate".to_string());
        
        if !has_tva_rate {
            conn.execute("ALTER TABLE invoice_items ADD COLUMN tva_rate REAL DEFAULT 19.0", [])?;
            conn.execute("UPDATE invoice_items SET tva_rate = 19.0 WHERE tva_rate IS NULL", [])?;
        }
    }
    
    Ok(())
}

// Migration function to add tva_rate to products table
fn migrate_products_table_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(products)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();
    
    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        
        let has_tva_rate = column_names.contains(&"tva_rate".to_string());
        
        if !has_tva_rate {
            conn.execute("BEGIN TRANSACTION", [])?;
            conn.execute("ALTER TABLE products ADD COLUMN tva_rate REAL DEFAULT 19.0", [])?;
            conn.execute("UPDATE products SET tva_rate = 19.0 WHERE tva_rate IS NULL", [])?;
            conn.execute("COMMIT", [])?;
        }
    }
    
    Ok(())
}

// Migration function to add timbre_exempt to products table
fn add_timbre_exempt_to_products(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(products)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();
    
    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        
        // Check for timbre_exempt
        if !column_names.contains(&"timbre_exempt".to_string()) {
            conn.execute("ALTER TABLE products ADD COLUMN timbre_exempt INTEGER DEFAULT 0", [])?;
        }
    }
    
    Ok(())
}

fn add_timbre_exempt_to_invoice_items(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(invoice_items)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();

    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        
        if !column_names.contains(&"timbre_exempt".to_string()) {
            conn.execute("ALTER TABLE invoice_items ADD COLUMN timbre_exempt INTEGER DEFAULT 0", [])?;
        }
    }

    Ok(())
}

// Migration function to make invoice_items.product_id nullable and add
// product_name/product_code — mirrors migrate_order_items_table_if_needed.
// Custom/one-off line items (added via the product picker's "add as custom
// item" path) have no catalog product, so product_id can't stay NOT NULL.
fn migrate_invoice_items_nullable_product_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(invoice_items)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();

    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();

        let product_id_info = columns.iter().find(|(name, _)| name == "product_id");
        let has_product_name = column_names.contains(&"product_name".to_string());
        let has_product_code = column_names.contains(&"product_code".to_string());

        let needs_recreation = matches!(product_id_info, Some((_, Some(1))));

        if needs_recreation || !has_product_name || !has_product_code {
            conn.execute("BEGIN TRANSACTION", [])?;

            if needs_recreation {
                conn.execute(
                    "CREATE TABLE IF NOT EXISTS invoice_items_new (
                        id TEXT PRIMARY KEY,
                        invoice_id TEXT NOT NULL,
                        product_id TEXT,
                        product_name TEXT,
                        product_code TEXT,
                        product_description TEXT,
                        quantity REAL NOT NULL DEFAULT 0,
                        unit_price REAL NOT NULL,
                        amount REAL,
                        tva_rate REAL DEFAULT 19.0,
                        timbre_exempt INTEGER DEFAULT 0,
                        created_at TEXT NOT NULL,
                        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
                    )",
                    [],
                )?;

                conn.execute(
                    "INSERT INTO invoice_items_new (id, invoice_id, product_id, product_name, product_code, product_description, quantity, unit_price, amount, tva_rate, timbre_exempt, created_at)
                     SELECT id, invoice_id, product_id, NULL, NULL, product_description, quantity, unit_price, amount, COALESCE(tva_rate, 19.0), COALESCE(timbre_exempt, 0), created_at FROM invoice_items",
                    [],
                )?;

                conn.execute("DROP TABLE invoice_items", [])?;
                conn.execute("ALTER TABLE invoice_items_new RENAME TO invoice_items", [])?;
            } else {
                if !has_product_name {
                    conn.execute("ALTER TABLE invoice_items ADD COLUMN product_name TEXT", [])?;
                }
                if !has_product_code {
                    conn.execute("ALTER TABLE invoice_items ADD COLUMN product_code TEXT", [])?;
                }
            }

            conn.execute("COMMIT", [])?;
        }
    }

    Ok(())
}

// Migration function to make delivery_note_items.product_id nullable and add
// product_name/product_code — same reasoning as the invoice_items migration.
fn migrate_delivery_note_items_nullable_product_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(delivery_note_items)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();

    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();

        let product_id_info = columns.iter().find(|(name, _)| name == "product_id");
        let has_product_name = column_names.contains(&"product_name".to_string());
        let has_product_code = column_names.contains(&"product_code".to_string());

        let needs_recreation = matches!(product_id_info, Some((_, Some(1))));

        if needs_recreation || !has_product_name || !has_product_code {
            conn.execute("BEGIN TRANSACTION", [])?;

            if needs_recreation {
                conn.execute(
                    "CREATE TABLE IF NOT EXISTS delivery_note_items_new (
                        id TEXT PRIMARY KEY,
                        delivery_note_id TEXT NOT NULL,
                        product_id TEXT,
                        product_name TEXT,
                        product_code TEXT,
                        product_description TEXT,
                        quantity REAL NOT NULL DEFAULT 0,
                        unit_price REAL,
                        tva_rate REAL DEFAULT 19.0,
                        created_at TEXT NOT NULL,
                        FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(id) ON DELETE CASCADE
                    )",
                    [],
                )?;

                conn.execute(
                    "INSERT INTO delivery_note_items_new (id, delivery_note_id, product_id, product_name, product_code, product_description, quantity, unit_price, tva_rate, created_at)
                     SELECT id, delivery_note_id, product_id, NULL, NULL, product_description, quantity, unit_price, COALESCE(tva_rate, 19.0), created_at FROM delivery_note_items",
                    [],
                )?;

                conn.execute("DROP TABLE delivery_note_items", [])?;
                conn.execute("ALTER TABLE delivery_note_items_new RENAME TO delivery_note_items", [])?;
            } else {
                if !has_product_name {
                    conn.execute("ALTER TABLE delivery_note_items ADD COLUMN product_name TEXT", [])?;
                }
                if !has_product_code {
                    conn.execute("ALTER TABLE delivery_note_items ADD COLUMN product_code TEXT", [])?;
                }
            }

            conn.execute("COMMIT", [])?;
        }
    }

    Ok(())
}

// Migration function to add initial_balance column to clients table
fn migrate_clients_table_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(clients)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();
    
    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        
        let has_initial_balance = column_names.contains(&"initial_balance".to_string());
        
        if !has_initial_balance {
            conn.execute("ALTER TABLE clients ADD COLUMN initial_balance REAL DEFAULT 0", [])?;
        }
    }
    
    Ok(())
}

// Sync sequence values with existing data to prevent duplicate numbers
fn sync_sequences(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Sync invoice number sequence
    // Check for existing invoice numbers (both regular "001" and credit notes "AV-001")
    let mut stmt = conn.prepare(
        "SELECT invoice_number FROM invoices WHERE invoice_number IS NOT NULL"
    )?;
    let invoice_numbers: Vec<String> = stmt.query_map([], |row| {
        Ok(row.get::<_, String>(0)?)
    })?.collect::<Result<Vec<_>, _>>()?;
    
    let mut max_invoice_num = 0i64;
    for num_str in invoice_numbers {
        // Handle regular invoices: "001", "002", etc.
        if let Ok(num) = num_str.parse::<i64>() {
            max_invoice_num = max_invoice_num.max(num);
        }
        // Handle credit notes: "AV-001", "AV-002", etc.
        else if num_str.starts_with("AV-") {
            if let Ok(num) = num_str[3..].parse::<i64>() {
                max_invoice_num = max_invoice_num.max(num);
            }
        }
    }
    
    // Update sequence to be at least as high as the max existing number
    // This ensures the next generated number will be unique
    if max_invoice_num >= 0 {
        // Get current sequence value
        let mut stmt = conn.prepare("SELECT value FROM sequences WHERE name = 'invoice_number'")?;
        let current_value: i64 = stmt.query_row([], |row| row.get(0)).unwrap_or(0);
        
        // Update only if current value is less than max
        if current_value <= max_invoice_num {
            conn.execute(
                "UPDATE sequences SET value = ?1 WHERE name = 'invoice_number'",
                params![max_invoice_num],
            )?;
        }
    }
    
    // Sync delivery note number sequence
    let mut stmt = conn.prepare(
        "SELECT delivery_number FROM delivery_notes WHERE delivery_number IS NOT NULL"
    )?;
    let delivery_numbers: Vec<String> = stmt.query_map([], |row| {
        Ok(row.get::<_, String>(0)?)
    })?.collect::<Result<Vec<_>, _>>()?;
    
    let mut max_delivery_num = 0i64;
    for num_str in delivery_numbers {
        // Handle format "BL-0001", "BL-0002", etc.
        if num_str.starts_with("BL-") {
            if let Ok(num) = num_str[3..].parse::<i64>() {
                max_delivery_num = max_delivery_num.max(num);
            }
        }
    }
    
    if max_delivery_num >= 0 {
        let mut stmt = conn.prepare("SELECT value FROM sequences WHERE name = 'delivery_note_number'")?;
        let current_value: i64 = stmt.query_row([], |row| row.get(0)).unwrap_or(0);
        
        if current_value <= max_delivery_num {
            conn.execute(
                "UPDATE sequences SET value = ?1 WHERE name = 'delivery_note_number'",
                params![max_delivery_num],
            )?;
        }
    }
    
    // Sync order number sequence
    let mut stmt = conn.prepare(
        "SELECT order_number FROM orders WHERE order_number IS NOT NULL"
    )?;
    let order_numbers: Vec<String> = stmt.query_map([], |row| {
        Ok(row.get::<_, String>(0)?)
    })?.collect::<Result<Vec<_>, _>>()?;
    
    let mut max_order_num = 0i64;
    for num_str in order_numbers {
        // Handle format "BC-0001", "BC-0002", etc.
        if num_str.starts_with("BC-") {
            if let Ok(num) = num_str[3..].parse::<i64>() {
                max_order_num = max_order_num.max(num);
            }
        }
    }
    
    if max_order_num >= 0 {
        let mut stmt = conn.prepare("SELECT value FROM sequences WHERE name = 'order_number'")?;
        let current_value: i64 = stmt.query_row([], |row| row.get(0)).unwrap_or(0);
        
        if current_value <= max_order_num {
            conn.execute(
                "UPDATE sequences SET value = ?1 WHERE name = 'order_number'",
                params![max_order_num],
            )?;
        }
    }
    
    Ok(())
}

// Get next invoice number without incrementing (for preview)
pub fn peek_next_invoice_number(conn: &Connection) -> Result<String, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT value FROM sequences WHERE name = 'invoice_number'")?;
    let number: i64 = stmt.query_row([], |row| row.get(0))?;
    
    // Return next number (current + 1) without incrementing
    Ok(format!("{:03}", number + 1))
}

// Generate next invoice number
pub fn generate_invoice_number(conn: &Connection) -> Result<String, rusqlite::Error> {
    // Increment and get the value
    // Note: We're protected by Mutex in the calling code, so this is thread-safe
    conn.execute(
        "UPDATE sequences SET value = value + 1 WHERE name = 'invoice_number'",
        [],
    )?;
    
    let mut stmt = conn.prepare("SELECT value FROM sequences WHERE name = 'invoice_number'")?;
    let number: i64 = stmt.query_row([], |row| row.get(0))?;
    
    Ok(format!("{:03}", number))
}

pub fn sync_invoice_sequence(conn: &Connection, number_str: &str) -> Result<(), rusqlite::Error> {
    // Extract numeric part if it has a prefix like AV- or PRO-
    let numeric_part = number_str
        .chars()
        .filter(|c| c.is_digit(10))
        .collect::<String>();

    if let Ok(num) = numeric_part.parse::<i64>() {
        conn.execute(
            "UPDATE sequences SET value = MAX(value, ?1) WHERE name = 'invoice_number'",
            params![num],
        )?;
    }
    Ok(())
}

// Generate next delivery note number
pub fn generate_delivery_note_number(conn: &Connection) -> Result<String, rusqlite::Error> {
    conn.execute(
        "UPDATE sequences SET value = value + 1 WHERE name = 'delivery_note_number'",
        [],
    )?;
    
    let mut stmt = conn.prepare("SELECT value FROM sequences WHERE name = 'delivery_note_number'")?;
    let number: i64 = stmt.query_row([], |row| row.get(0))?;
    
    Ok(format!("BL-{:04}", number))
}

// Generate next order number
pub fn generate_order_number(conn: &Connection) -> Result<String, rusqlite::Error> {
    conn.execute(
        "UPDATE sequences SET value = value + 1 WHERE name = 'order_number'",
        [],
    )?;

    let mut stmt = conn.prepare("SELECT value FROM sequences WHERE name = 'order_number'")?;
    let number: i64 = stmt.query_row([], |row| row.get(0))?;

    Ok(format!("{:06}", number))
}

/// Recomputes a sequence counter from what's actually left in its table,
/// so deleting a record doesn't leave the counter permanently ahead of
/// reality (e.g. delete every invoice and the next one created still
/// starts at 025 instead of 001). Called after every delete on the
/// corresponding table.
///
/// Scans `number_column` on `table` (optionally restricted by
/// `where_clause`, e.g. to exclude proforma/credit-note rows whose number
/// format isn't part of the plain sequence), keeps only the digits of each
/// value (so a plain "024" and a prefixed "BL-0024" both contribute 24,
/// while a non-numeric manual reference contributes nothing and is
/// ignored), and sets the sequence to the max of those — 0 if nothing
/// matches, meaning the table is now empty of that number type. The next
/// `generate_*_number()` call does `value + 1`, landing exactly on the
/// next real number instead of continuing from wherever the counter
/// happened to be before the delete.
pub fn resync_sequence_from_table(
    conn: &Connection,
    sequence_name: &str,
    table: &str,
    number_column: &str,
    where_clause: Option<&str>,
) -> Result<(), rusqlite::Error> {
    let query = match where_clause {
        Some(clause) => format!("SELECT {} FROM {} WHERE {}", number_column, table, clause),
        None => format!("SELECT {} FROM {}", number_column, table),
    };
    let mut stmt = conn.prepare(&query)?;
    let numbers: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    let max_value = numbers
        .iter()
        .filter_map(|raw| {
            let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
            digits.parse::<i64>().ok()
        })
        .max()
        .unwrap_or(0);

    conn.execute(
        "UPDATE sequences SET value = ?1 WHERE name = ?2",
        params![max_value, sequence_name],
    )?;
    Ok(())
}

// Migration function to add discount column to invoices table
fn migrate_invoices_discount_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(invoices)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();
    
    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        
        let has_discount = column_names.contains(&"discount".to_string());
        let has_discount_type = column_names.contains(&"discount_type".to_string());
        let has_discount_value = column_names.contains(&"discount_value".to_string());
        
        if !has_discount {
            conn.execute("ALTER TABLE invoices ADD COLUMN discount REAL DEFAULT 0", [])?;
        }
        if !has_discount_type {
            conn.execute("ALTER TABLE invoices ADD COLUMN discount_type TEXT DEFAULT 'percent'", [])?;
        }
        if !has_discount_value {
            conn.execute("ALTER TABLE invoices ADD COLUMN discount_value REAL DEFAULT 0", [])?;
        }
    }
    
    Ok(())
}

// Migration function to add activite column to clients table
fn migrate_clients_activite_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(clients)")?
        .query_map([], |row| {
            Ok(row.get::<_, String>(1)?)
        })?
        .collect();
    
    if let Ok(column_names) = table_info {
        if !column_names.contains(&"activite".to_string()) {
            conn.execute("ALTER TABLE clients ADD COLUMN activite TEXT", [])?;
        }
    }
    Ok(())
}

// Migration function to add secondary_rc column to clients table
fn migrate_clients_secondary_rc_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(clients)")?
        .query_map([], |row| {
            Ok(row.get::<_, String>(1)?)
        })?
        .collect();
    
    if let Ok(column_names) = table_info {
        let has_secondary_rc = column_names.contains(&"secondary_rc".to_string());
        
        if !has_secondary_rc {
            conn.execute("ALTER TABLE clients ADD COLUMN secondary_rc TEXT", [])?;
        }
        
        let has_secondary_address = column_names.contains(&"secondary_address".to_string());
        if !has_secondary_address {
            conn.execute("ALTER TABLE clients ADD COLUMN secondary_address TEXT", [])?;
        }
    }
    
    Ok(())
}

// Migration function to add use_secondary_register column to invoices table
fn migrate_invoices_secondary_register_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(invoices)")?
        .query_map([], |row| {
            Ok(row.get::<_, String>(1)?)
        })?
        .collect();
    
    if let Ok(column_names) = table_info {
        let has_use_secondary_register = column_names.contains(&"use_secondary_register".to_string());
        
        if !has_use_secondary_register {
            conn.execute("ALTER TABLE invoices ADD COLUMN use_secondary_register BOOLEAN DEFAULT 0", [])?;
        }

        let has_selected_secondary_rc = column_names.contains(&"selected_secondary_rc".to_string());
        if !has_selected_secondary_rc {
            conn.execute("ALTER TABLE invoices ADD COLUMN selected_secondary_rc TEXT", [])?;
        }

        let has_selected_secondary_address = column_names.contains(&"selected_secondary_address".to_string());
        if !has_selected_secondary_address {
            conn.execute("ALTER TABLE invoices ADD COLUMN selected_secondary_address TEXT", [])?;
        }
    }
    
    Ok(())
}

// Recalculate invoice totals based on items (with TVA per item) and global discount
pub fn recalculate_invoice_totals(tx: &Transaction, invoice_id: &str) -> Result<(), rusqlite::Error> {
    // Get discount info, invoice_type and payment_method from invoice
    let mut stmt = tx.prepare("SELECT COALESCE(discount, 0), invoice_type, COALESCE(discount_type, 'percent'), COALESCE(discount_value, 0), payment_method FROM invoices WHERE id = ?1")?;
    let (legacy_discount, invoice_type, discount_type, discount_value, payment_method): (f64, String, String, f64, Option<String>) = stmt.query_row(params![invoice_id], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
    })?;
    
    let is_credit_note = invoice_type == "credit_note";
    let payment_method_clean = payment_method.as_deref().unwrap_or("").trim().to_lowercase();
    let is_cash_payment = payment_method_clean.contains("espèce") || payment_method_clean.contains("espece") || payment_method_clean == "cash";

    // Calculate subtotal from items (Raw HT)
    let mut stmt = tx.prepare(
        "SELECT COALESCE(SUM(quantity * unit_price), 0) FROM invoice_items WHERE invoice_id = ?1"
    )?;
    let raw_subtotal_ht: f64 = stmt.query_row(params![invoice_id], |row| row.get(0))?;
    
    // Calculate actual discount amount (on HT)
    let actual_discount = if discount_type == "percent" {
        raw_subtotal_ht * (discount_value / 100.0)
    } else if discount_type == "amount" {
        discount_value
    } else {
        legacy_discount // Fallback for old data
    };
    
    let mut final_total_tva = 0.0;
    let mut final_base_for_timbre = 0.0;
    
    // Re-loop to calculate final TVA and Timbre base on gross amounts
    let mut stmt = tx.prepare(
        "SELECT quantity, unit_price, tva_rate, timbre_exempt 
         FROM invoice_items 
         WHERE invoice_id = ?1"
    )?;
    let _items = stmt.query_map(params![invoice_id], |row| {
        Ok((
            row.get::<_, f64>(0)?, 
            row.get::<_, f64>(1)?, 
            row.get::<_, Option<f64>>(2)?,
            row.get::<_, Option<i64>>(3)?.map(|v| v != 0)
        ))
    })?;

    for item in _items {
        let (quantity, unit_price, tva_rate_opt, timbre_exempt_opt): (f64, f64, Option<f64>, Option<bool>) = item?;
        let item_amount_ht = quantity * unit_price;
        let is_item_timbre_exempt = timbre_exempt_opt.unwrap_or(false);

        // TVA is calculated on GROSS HT amount (before discount)
        let item_tva = match tva_rate_opt {
            Some(rate) if rate > 0.0 => item_amount_ht * (rate / 100.0),
            _ => 0.0
        };
        final_total_tva += item_tva;

        // Timbre Base = Gross HT + Gross TVA for non-exempt items
        let is_legacy_exempt = matches!(tva_rate_opt, Some(r) if r == -1.0);
        if !is_item_timbre_exempt && !is_legacy_exempt {
            final_base_for_timbre += item_amount_ht + item_tva;
        }
    }
    
    let final_subtotal_ht = raw_subtotal_ht - actual_discount;

    
    // Calculate timbre using the updated base
    // Credit notes (avoirs) are exempt from stamp duty (droit de timbre) in Algeria
    // Non-cash payments (Check, Transfer) are also exempt
    let timbre = if is_credit_note || !is_cash_payment {
        0.0
    } else {
        calculate_timbre(final_base_for_timbre.abs())
    };
    
    // Calculate total TTC
    let total_ttc = final_subtotal_ht + final_total_tva + timbre;
    
    // Get current amount_paid
    let mut stmt = tx.prepare("SELECT COALESCE(amount_paid, 0) FROM invoices WHERE id = ?1")?;
    let amount_paid: f64 = stmt.query_row(params![invoice_id], |row| row.get(0)).unwrap_or(0.0);
    
    // Calculate balance due
    let balance_due = total_ttc - amount_paid;
    
    // Update invoice: subtotal_ht is now Gross HT (before discount)
    // and we also update the legacy discount column for compatibility
    tx.execute(
        "UPDATE invoices SET subtotal_ht = ?2, tva_amount = ?3, timbre = ?4, total_ttc = ?5, balance_due = ?6, discount = ?7 WHERE id = ?1",
        params![invoice_id, raw_subtotal_ht, final_total_tva, timbre, total_ttc, balance_due, actual_discount],
    )?;
    
    Ok(())
}

// Update invoice payment status based on payments
pub fn update_invoice_payment_status(conn: &Connection, invoice_id: &str) -> Result<(), rusqlite::Error> {
    // Get total payments for invoice
    let mut stmt = conn.prepare(
        "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = ?1"
    )?;
    let total_paid: f64 = stmt.query_row(params![invoice_id], |row| row.get(0))?;
    
    // Get invoice total and current status
    let mut stmt = conn.prepare(
        "SELECT total_ttc, status FROM invoices WHERE id = ?1"
    )?;
    let (total_ttc, current_status): (f64, String) = stmt.query_row(
        params![invoice_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    )?;
    
    // Determine new status
    let new_status = if total_paid >= total_ttc {
        "paid"
    } else if total_paid > 0.0 {
        "partial"
    } else {
        "unpaid"
    };
    
    // Only update status if it's not 'draft'
    let final_status = if current_status == "draft" {
        current_status
    } else {
        new_status.to_string()
    };
    
    // Calculate balance due
    let balance_due = total_ttc - total_paid;
    
    // Update invoice
    conn.execute(
        "UPDATE invoices SET amount_paid = ?2, balance_due = ?3, status = ?4 WHERE id = ?1",
        params![invoice_id, total_paid, balance_due, final_status],
    )?;
    
    Ok(())
}

// Helper function to calculate timbre (droit de timbre) according to Algerian law
// Based on Total TTC (after TVA):
// - Up to 30,000 DA: 1%
// - Between 30,000 and 100,000 DA: 1.5%
// - Above 100,000 DA: 2%
// Minimum: 5 DA
pub fn calculate_timbre(total_ttc: f64) -> f64 {
    if total_ttc <= 0.0 {
        return 0.0;
    }
    
    let timbre = if total_ttc <= 30000.0 {
        total_ttc * 0.01  // 1%
    } else if total_ttc <= 100000.0 {
        total_ttc * 0.015  // 1.5%
    } else {
        total_ttc * 0.02  // 2%
    };
    
    // Apply minimum of 5 DA
    timbre.max(5.0)
}

// Migration function to add custom_title column to invoices table
fn migrate_invoices_custom_title_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(invoices)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();
    
    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();
        
        let has_custom_title = column_names.contains(&"custom_title".to_string());
        
        if !has_custom_title {
            conn.execute("ALTER TABLE invoices ADD COLUMN custom_title TEXT", [])?;
        }
    }
    
    Ok(())
}
fn migrate_order_items_tva_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(order_items)")?
        .query_map([], |row| {
            Ok(row.get::<_, String>(1)?)
        })?
        .collect();
    
    if let Ok(columns) = table_info {
        if !columns.contains(&"tva_rate".to_string()) {
            conn.execute("ALTER TABLE order_items ADD COLUMN tva_rate REAL DEFAULT 19.0", [])?;
        }
    }
    Ok(())
}

fn migrate_delivery_note_items_tva_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(delivery_note_items)")?
        .query_map([], |row| {
            Ok(row.get::<_, String>(1)?)
        })?
        .collect();
    
    if let Ok(columns) = table_info {
        if !columns.contains(&"tva_rate".to_string()) {
            conn.execute("ALTER TABLE delivery_note_items ADD COLUMN tva_rate REAL DEFAULT 19.0", [])?;
        }
        if !columns.contains(&"unit_price".to_string()) {
            conn.execute("ALTER TABLE delivery_note_items ADD COLUMN unit_price REAL", [])?;
        }
    }
    Ok(())
}

// Migration function to add payment_method column to invoices table
fn migrate_invoices_payment_method_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(invoices)")?
        .query_map([], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, Option<i64>>(3)?))
        })?
        .collect();

    if let Ok(columns) = table_info {
        let column_names: Vec<String> = columns.iter().map(|(name, _)| name.clone()).collect();

        let has_payment_method = column_names.contains(&"payment_method".to_string());

        if !has_payment_method {
            conn.execute("ALTER TABLE invoices ADD COLUMN payment_method TEXT", [])?;
        }
    }

    Ok(())
}

// Migration function to add tax_mode column to invoices table — records
// which of the three tax-entry modes (Standard/Exonéré/TTC Direct) the
// invoice was created under, purely for UI/PDF display purposes (which
// legend text to print, which toggle option to show as selected on
// re-open). The actual tax math is unaffected by this column: it's still
// entirely driven by each invoice_item's own tva_rate, exactly as before —
// "Exonéré" just means every item's tva_rate was set to 0 at entry time,
// and "TTC Direct" means the unit_price stored is already the back-computed
// HT value. recalculate_invoice_totals() doesn't need to know the mode.
fn migrate_invoices_tax_mode_if_needed(conn: &Connection) -> Result<(), rusqlite::Error> {
    let table_info: Result<Vec<_>, _> = conn.prepare("PRAGMA table_info(invoices)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .collect();

    if let Ok(column_names) = table_info {
        if !column_names.contains(&"tax_mode".to_string()) {
            conn.execute("ALTER TABLE invoices ADD COLUMN tax_mode TEXT NOT NULL DEFAULT 'standard'", [])?;
        }
    }

    Ok(())
}




