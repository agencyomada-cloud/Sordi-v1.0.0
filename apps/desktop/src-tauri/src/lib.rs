pub mod database;
mod commands;
mod license;
mod pdf_service;
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
      // Payments
      commands::get_payments,
      commands::create_payment,
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
      commands::import_punch_records,
      commands::get_unmapped_device_codes,
      commands::create_employee_advance,
      commands::get_employee_advances,
      commands::get_employee_advance_totals,
      commands::set_employee_advance_deducted,
      commands::save_pdf_backup,
      commands::run_payroll,
      commands::get_payroll_runs,
      commands::update_payroll_paid,
      commands::update_payroll_run,
      commands::delete_payroll_run,
      commands::get_payroll_dashboard_stats,
      // Projects (omada-agency branch only)
      commands::get_projects,
      commands::get_project,
      commands::create_project,
      commands::update_project,
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
      // Licensing
      commands::get_license_status,
      commands::activate_license,
      commands::verify_license_background,
      // Global search
      commands::search_global,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
