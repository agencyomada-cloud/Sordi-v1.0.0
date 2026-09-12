pub mod database;
mod biometric;
mod commands;
mod demo_seed;
// pub, not mod: src/bin/keygen.rs (a separate dev-only binary, never bundled
// into the shipped app — see its own module doc) links against this crate's
// lib target to reuse LicenseClaims/compute_device_fingerprint directly,
// rather than duplicating that schema and risking drift.
pub mod license;
mod pdf_service;
mod splashscreen;
mod telemetry;
mod updates;
mod widget;
#[cfg(test)]
mod seed_test_data;

use database::init_database;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(
      tauri_plugin_window_state::Builder::default()
        // Only the widget's position/size is meant to persist across
        // restarts — the main window's sizing stays exactly what
        // tauri.conf.json declares, and the splashscreen is always
        // fixed-size + centered, never worth remembering a position for
        // (it's also short-lived — created and closed every single launch).
        .with_denylist(&["main", "splashscreen"])
        // Exclude VISIBLE: the plugin's default flags restore/re-show a
        // window based on whether it was visible when the app last closed,
        // which made the widget pop open on every launch after it had been
        // toggled on once. The widget should only ever open via its own
        // header icon toggle — position/size still persist, visibility
        // never does.
        .with_state_flags(
          tauri_plugin_window_state::StateFlags::all() & !tauri_plugin_window_state::StateFlags::VISIBLE,
        )
        .build(),
    )
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      
      // Initialize database — a debug build (`tauri dev`) always uses its
      // own database-dev.db and NEVER reads or copies the real
      // database.db, so a dev session can never see (or risk writing) real
      // agency data. A release build always uses database.db. When
      // database-dev.db doesn't exist yet, init_database() below creates it
      // from scratch (structural migrations only, no data), and a minimal,
      // clearly-fake dataset is seeded once right after so the UI has
      // something to render instead of every screen showing an empty state.
      //
      // app_data_dir() is resolved entirely from tauri.conf.json's
      // "identifier" (com.sordi.invoicing, renamed from com.sordi.finance
      // — the identifier change is deliberate and one-way: it also resets
      // every machine's local database/license storage to a clean slate,
      // since macOS scopes app data by bundle identifier) — a second,
      // independent bundle identity from any real production Sordi install
      // (com.sordi.app), so this workspace's own dev AND release databases
      // live under ~/Library/Application Support/com.sordi.invoicing/,
      // structurally incapable of colliding with a separately-installed
      // production app's ~/Library/Application Support/com.sordi.app/
      // directory — not just a debug/release filename split within a
      // shared folder, but a wholly separate folder for this app identity.
      let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
      std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");
      let db_path = if cfg!(debug_assertions) {
        app_dir.join("database-dev.db")
      } else {
        app_dir.join("database.db")
      };

      // A restore staged by commands::restore_database() lands here, before
      // the live database is opened — swapping the file out from under an
      // already-open Connection isn't safe, so that command instead stages
      // the chosen file and restarts the app to reach this point cleanly.
      let pending_restore = app_dir.join("pending_restore.db");
      if pending_restore.exists() {
        let backups_dir = app_dir.join("backups");
        let _ = std::fs::create_dir_all(&backups_dir);
        if db_path.exists() {
          // Pre-restore safety copy — so restoring the wrong backup, or
          // restoring by mistake, is itself always recoverable.
          let safety_copy = backups_dir.join(format!(
            "pre_restore_backup_{}.db",
            chrono::Local::now().format("%Y-%m-%d_%H%M%S")
          ));
          let _ = std::fs::copy(&db_path, &safety_copy);
        }
        match std::fs::copy(&pending_restore, &db_path) {
          Ok(_) => {
            let _ = std::fs::remove_file(&pending_restore);
            // Drop the OLD database's WAL/SHM sidecar files — leaving them
            // would replay stale frames on top of the just-restored file
            // instead of reading it as-is.
            let wal_path = std::path::PathBuf::from(format!("{}-wal", db_path.to_string_lossy()));
            let shm_path = std::path::PathBuf::from(format!("{}-shm", db_path.to_string_lossy()));
            let _ = std::fs::remove_file(&wal_path);
            let _ = std::fs::remove_file(&shm_path);
          }
          Err(e) => log::error!("Failed to apply staged restore: {}", e),
        }
      }

      let is_fresh_dev_db = cfg!(debug_assertions) && !db_path.exists();
      let db = init_database(db_path.to_str().unwrap()).expect("failed to initialize database");
      if is_fresh_dev_db {
        database::seed_minimal_dev_mock_data(&db).expect("failed to seed minimal dev mock data");
      }

      // Rolling automatic backup — one snapshot on launch, one more on clean
      // shutdown (see the CloseRequested handler below). Independent of the
      // user-triggered manual backup/restore commands. Runs on its own
      // background thread against a fresh, separate connection to the same
      // file (WAL mode allows a second reader alongside the app's writer),
      // so it can never contend with the app's own Mutex<Connection> or
      // delay window startup.
      {
        let backup_db_path = db_path.clone();
        let backup_app_dir = app_dir.clone();
        std::thread::spawn(move || {
          if let Ok(conn) = rusqlite::Connection::open(&backup_db_path) {
            if let Err(e) = commands::create_rolling_backup(&conn, &backup_app_dir) {
              log::warn!("Startup rolling backup failed: {}", e);
            }
          }
        });
      }

      // Anonymous diagnostic heartbeat — see telemetry.rs's module doc for
      // exactly what it sends (no PII), the once-per-24h throttle, and why
      // every failure path in it is silent by design. Disclosed and
      // toggleable in Settings > "Télémétrie & Diagnostics".
      telemetry::maybe_send_heartbeat_in_background(db_path.clone(), env!("CARGO_PKG_VERSION"));

      if let Some(window) = app.get_webview_window("main") {
        let backup_db_path = db_path.clone();
        let backup_app_dir = app_dir.clone();
        window.on_window_event(move |event| {
          if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
            let backup_db_path = backup_db_path.clone();
            let backup_app_dir = backup_app_dir.clone();
            std::thread::spawn(move || {
              if let Ok(conn) = rusqlite::Connection::open(&backup_db_path) {
                if let Err(e) = commands::create_rolling_backup(&conn, &backup_app_dir) {
                  log::warn!("Shutdown rolling backup failed: {}", e);
                }
              }
            });
          }
        });
      }

      app.manage(Mutex::new(db));
      license::init(&app_dir);
      commands::init_app_data_dir(&app_dir);

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      // Companies (multi-workspace)
      commands::get_companies,
      commands::get_company,
      commands::create_company,
      commands::update_company,
      // Clients
      commands::get_clients,
      commands::get_client,
      commands::create_client,
      commands::update_client,
      commands::delete_client,
      // Suppliers (Fournisseurs)
      commands::get_suppliers,
      commands::get_supplier,
      commands::create_supplier,
      commands::update_supplier,
      commands::delete_supplier,
      commands::get_supplier_purchase_totals,
      // Products
      commands::get_products,
      commands::create_product,
      commands::update_product_price,
      commands::update_product,
      commands::delete_product,
      commands::get_product_sales_stats,
      commands::get_client_product_cumulatives,
      commands::get_client_cumulatives,
      commands::get_client_overview_stats,
      commands::get_dashboard_stats,
      // Invoices
      commands::get_invoices,
      commands::get_invoices_with_clients,
      commands::get_invoice,
      commands::get_invoice_items,
      commands::get_next_invoice_number,
      commands::create_invoice,
      commands::update_invoice,
      commands::update_invoice_status,
      commands::update_invoice_header,
      commands::delete_invoice,
      commands::convert_to_real_invoice,
      commands::convert_proforma_to_invoice,
      // Payments
      commands::get_payments,
      commands::create_payment,
      commands::update_payment,
      commands::delete_payment,
      commands::add_payment_attachment,
      commands::get_payment_attachments,
      commands::delete_payment_attachment,
      // Orders
      commands::get_orders,
      commands::get_order,
      commands::get_next_order_number,
      commands::get_order_items,
      commands::create_order,
      commands::update_order,
      commands::update_order_status,
      commands::delete_order,
      // Delivery Notes
      commands::get_delivery_notes,
      commands::get_delivery_note,
      commands::get_delivery_note_items,
      commands::create_delivery_note,
      commands::update_delivery_note,
      commands::set_delivery_status,
      commands::delete_delivery_note,
      commands::generate_invoice_from_delivery_notes,
      // Expenses
      commands::get_expenses,
      commands::create_expense,
      commands::update_expense,
      commands::delete_expense,
      // Activités & Rappels
      commands::list_activities,
      commands::create_activity,
      commands::complete_activity,
      commands::delete_activity,
      // Letterhead
      commands::get_letterhead_image,
      // Client Products
      commands::get_client_products,
      // Client Draft Products
      commands::get_client_draft_products,
      commands::add_client_draft_product,
      commands::update_client_draft_product_quantity,
      commands::delete_client_draft_product,
      commands::clear_client_draft_products,
      // Client Advances
      commands::get_client_advances,
      commands::add_client_advance,
      commands::update_client_advance,
      commands::delete_client_advance,
      // Settings
      commands::get_settings,
      commands::update_setting,
      commands::update_settings,
      commands::get_telemetry_status,
      commands::set_telemetry_enabled,
      // Production Logs
      commands::get_production_logs,
      commands::create_production_log,
      commands::update_production_log,
      commands::delete_production_log,
      // History
      commands::get_activity_logs,
      commands::clear_activity_logs,
      commands::reset_company_to_factory_state,
      // Employees
      commands::get_employees,
      commands::create_employee,
      commands::update_employee,
      commands::delete_employee,
      commands::set_employee_photo,
      commands::remove_employee_photo,
      commands::add_employee_document,
      commands::get_employee_documents,
      commands::delete_employee_document,
      commands::get_employee_task_workload,
      // HR / Payroll (omada-agency branch only)
      commands::get_employee_absence_stats,
      commands::get_employee_daily_attendance,
      commands::import_punch_records,
      commands::get_unmapped_device_codes,
      commands::create_employee_advance,
      commands::get_employee_advances,
      commands::get_employee_advance_totals,
      commands::set_employee_advance_deducted,
      commands::save_pdf_backup,
      commands::backup_database,
      commands::get_last_backup_info,
      commands::restore_database,
      commands::run_payroll,
      commands::get_payroll_runs,
      commands::update_payroll_paid,
      commands::update_payroll_run,
      commands::delete_payroll_run,
      commands::get_payroll_dashboard_stats,
      commands::get_employee_hr_stats,
      commands::get_employee_payroll_summaries,
      // Projects (omada-agency branch only)
      commands::get_projects,
      commands::get_project,
      commands::create_project,
      commands::update_project,
      commands::update_project_status,
      commands::delete_project,
      commands::update_freelancer_payment_status,
      commands::assign_freelance_payment,
      commands::get_freelance_payments,
      commands::get_project_stats,
      commands::get_project_profitability,
      commands::assign_invoice_to_project,
      commands::create_contract,
      commands::get_all_contracts,
      commands::get_project_contracts,
      commands::delete_contract,
      commands::get_partners,
      commands::get_monthly_partners_report,
      commands::create_partner,
      commands::update_partner,
      commands::delete_partner,
      commands::get_partner_withdrawals,
      commands::record_partner_withdrawal,
      commands::delete_partner_withdrawal,
      commands::get_project_tasks,
      commands::create_project_task,
      commands::update_project_task,
      commands::update_project_task_status,
      commands::delete_project_task,
      commands::get_project_deliverables,
      commands::create_project_deliverable,
      commands::update_project_deliverable,
      commands::delete_project_deliverable,
      // PDF
      commands::generate_pdf,
      commands::open_pdf,
      commands::open_file_path,
      commands::save_pdf,
      commands::save_pdf_to_path,
      // Email
      commands::send_email_with_pdf,
      // Auth
      commands::has_password_set,
      commands::check_password,
      commands::set_password,
      biometric::authenticate_biometric,
      widget::toggle_widget_window,
      splashscreen::close_splashscreen,
      // Licensing
      commands::get_license_status,
      commands::activate_license,
      commands::verify_license_background,
      commands::request_trial,
      commands::check_for_updates,
      commands::get_machine_id,
      // Global search
      commands::search_global,
      // Demo data (safe, reversible — see demo_seed.rs)
      demo_seed::seed_demo_data,
      demo_seed::clear_demo_data,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
