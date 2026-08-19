mod database;
mod commands;
mod pdf_service;

use database::init_database;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      
      // Initialize database
      let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
      std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");
      let db_path = app_dir.join("database.db");
      let db = init_database(db_path.to_str().unwrap()).expect("failed to initialize database");
      
      app.manage(Mutex::new(db));
      
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      // Clients
      commands::get_clients,
      commands::get_client,
      commands::create_client,
      commands::update_client,
      commands::delete_client,
      // Products
      commands::get_products,
      commands::create_product,
      commands::update_product_price,
      commands::update_product,
      commands::delete_product,
      commands::get_product_sales_stats,
      commands::get_client_product_cumulatives,
      commands::get_client_cumulatives,
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
      // Payments
      commands::get_payments,
      commands::create_payment,
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
      commands::generate_invoice_from_delivery_notes,
      // Expenses
      commands::get_expenses,
      commands::create_expense,
      commands::delete_expense,
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
      // Production Logs
      commands::get_production_logs,
      commands::create_production_log,
      commands::update_production_log,
      commands::delete_production_log,
      // History
      commands::get_activity_logs,
      // Employees
      commands::get_employees,
      commands::create_employee,
      commands::update_employee,
      commands::delete_employee,
      // Projects
      commands::get_projects,
      commands::create_project,
      commands::update_project,
      commands::delete_project,
      // Scores
      commands::get_employee_scores,
      commands::upsert_employee_score,
      commands::delete_employee_score,
      // PDF
      commands::generate_pdf,
      commands::open_pdf,
      commands::save_pdf,
      // Auth
      commands::has_password_set,
      commands::check_password,
      commands::set_password,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
