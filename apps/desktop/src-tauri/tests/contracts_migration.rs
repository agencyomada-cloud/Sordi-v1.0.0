// Verifies migrate_contracts_services_if_needed correctly rebuilds a
// contracts table that still has the old `project_id TEXT NOT NULL`
// constraint from before standalone (project-less) contracts were
// supported, using a real copy of a pre-migration database file rather
// than a hand-written fixture.

#[test]
fn project_id_becomes_nullable_and_insert_without_project_succeeds() {
    let src = std::env::var("TEST_DB_PATH").expect("set TEST_DB_PATH to the copied database file");
    let conn = app_lib::database::init_database(&src).expect("init_database should run migrations cleanly");

    let not_null: bool = conn
        .query_row(
            "SELECT \"notnull\" FROM pragma_table_info('contracts') WHERE name = 'project_id'",
            [],
            |row| row.get(0),
        )
        .expect("project_id column should exist");
    assert!(!not_null, "project_id should be nullable after migration");

    let company_id: String = conn
        .query_row("SELECT id FROM companies LIMIT 1", [], |row| row.get(0))
        .expect("at least one company should exist");
    let client_id: String = conn
        .query_row("SELECT id FROM clients LIMIT 1", [], |row| row.get(0))
        .expect("at least one client should exist");

    conn.execute(
        "INSERT INTO contracts (id, company_id, project_id, client_id, contract_ref, selected_services, payment_split, total_amount_ht, tva_rate, tva_amount, total_amount_ttc, invoices_json, created_at)
         VALUES ('test-standalone-contract', ?1, NULL, ?2, 'OM-CTR-TEST-000', '[]', '50_50', 100.0, 19.0, 19.0, 119.0, '[]', datetime('now'))",
        rusqlite::params![company_id, client_id],
    ).expect("inserting a contract with NULL project_id should succeed");

    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM contracts WHERE id = 'test-standalone-contract'", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 1);

    // Clean up the row we inserted so re-running the test against the same
    // copied file stays idempotent.
    conn.execute("DELETE FROM contracts WHERE id = 'test-standalone-contract'", []).unwrap();
}
