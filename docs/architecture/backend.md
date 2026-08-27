# Backend Architecture

## The Tauri command pattern

Every operation the frontend can perform against the database or filesystem is a `#[tauri::command]`-annotated Rust function in `apps/desktop/src-tauri/src/commands.rs` (7,617 lines, ~151 commands — see the [full command reference](./command-reference.md)). Each is registered explicitly in the `tauri::generate_handler![...]` macro call inside `apps/desktop/src-tauri/src/lib.rs`'s `run()` function — there is no dynamic dispatch or reflection; the set of callable commands is a fixed, compile-time list, which is itself a security property: the JS frontend cannot invoke anything the Rust side hasn't explicitly opted into.

The overwhelmingly common shape of a command is:

```rust
#[tauri::command]
pub fn create_invoice(db: State<'_, Mutex<Connection>>, data: CreateInvoiceData) -> Result<Invoice, String> {
    crate::license::require_active_license()?;              // 1. license gate (mutating commands only)
    let mut conn = db.lock().map_err(|e| e.to_string())?;   // 2. lock the shared connection
    // ... generate id/number, open a transaction, run INSERTs ...
    tx.commit().map_err(|e| e.to_string())?;
    let _ = log_activity(&conn, "CREATE", "INVOICE", Some(&invoice_id), &format!("..."));  // 3. audit log
    get_invoice(db, invoice_id).map_err(...)                 // 4. re-fetch and return the created row
}
```

- **State access**: the single SQLite `Connection` is wrapped in a `std::sync::Mutex` and registered once via `app.manage(Mutex::new(db))` in `lib.rs`'s `setup()`. Every command takes `db: State<'_, Mutex<Connection>>` and calls `.lock()` to get exclusive access for the duration of the call — this serializes all database access, which is an acceptable tradeoff for a single-user desktop app with no concurrent writers.
- **Errors as strings**: nearly every command returns `Result<T, String>` — Rust errors are `.map_err(|e| e.to_string())`'d into plain strings, which `invoke()` on the JS side surfaces as a rejected promise carrying that string as its message. This is a simple, low-ceremony error-handling convention rather than a typed error enum shared across the IPC boundary.
- **Transactions**: multi-step writes (creating an invoice plus its items, for example) run inside a `conn.transaction()` block, so a failure partway through cannot leave a document with items that don't match its stored totals.
- **Audit logging**: most mutating commands call the shared `log_activity()` helper (`commands.rs:138`) after a successful write, inserting a row into `activity_logs` with an `action` (`CREATE`/`UPDATE`/`DELETE`), `entity_type`, `entity_id`, and a human-readable French description. This is what powers the History page and the Dashboard's "Activité Récente" widget.

## Database initialization and migrations — `src-tauri/src/database.rs`

`init_database(db_path)` (called once from `lib.rs`'s `setup()`, pointed at `<app_data_dir>/database.db`) does three things in order: opens the SQLite connection with `PRAGMA foreign_keys = ON`, runs every `CREATE TABLE IF NOT EXISTS` statement for the full current schema, then runs a sequence of `migrate_*_if_needed()` functions. Each migration function is idempotent and additive — it inspects `PRAGMA table_info(<table>)` for a column's presence before running an `ALTER TABLE ... ADD COLUMN`, so it's always safe to re-run against a database that's already been migrated. Two tables (`contracts`, and at various points `orders`/`order_items`/`invoice_items`/`delivery_note_items`) went through a heavier "create a `_new` shadow table with the corrected schema, copy data across, drop the old table, rename `_new` to the original name" migration, because SQLite's `ALTER TABLE` can't relax a `NOT NULL` constraint or drop a column in place. See the [full schema reference](./schema-reference.md) for the final shape of every table after all migrations are applied.

There is no separate migration-file system (no `migrations/0001_*.sql` directory) — the entire schema history lives as sequential Rust functions in `database.rs`, run in a fixed order every time the app starts.

## License & feature gating

Sordi ships a lightweight, offline-tolerant commercial license system (`apps/desktop/src-tauri/src/license.rs`, 430 lines):

- **Format**: signed JWT-style tokens using Ed25519/EdDSA (via the `jsonwebtoken` crate). The desktop binary embeds only the **public** key (`LICENSE_PUBLIC_KEY_PEM`) — it can verify a token's signature but never forge one; the matching private key lives only in `apps/api`'s environment configuration, where the Node-side license service signs tokens (using a different library, since it's a different language, but the exact same JWT/EdDSA format).
- **Device fingerprinting**: one stable, OS-native hardware identifier per platform (macOS: `IOPlatformUUID` via `ioreg`; documented as similarly stable-but-platform-appropriate on Windows/Linux) — deliberately a single signal rather than a combination of volatile ones (MAC address, disk serial, hostname), because combining volatile signals would false-positive on routine hardware/network changes.
- **The gate**: `require_active_license()` is the single function every mutating command calls first. It re-reads and re-verifies the on-disk license token fresh on every call (not cached in shared state) — cheap enough for occasional write operations, and it avoids needing a separate cache-invalidation path to keep in sync with activation/renewal. A lapsed or unactivated license makes this function return `Err(...)`, which surfaces to the user as: *"Your Sordi license has expired or is not activated on this device. Renew or activate your license to make changes — viewing and exporting existing data is still available."* Read-only `get_*` commands never call this gate, so browsing/exporting existing data always works regardless of license state.
- **The `omada_bypass` feature**: a Cargo feature flag declared in `apps/desktop/src-tauri/Cargo.toml`'s `[features]` section, off by default. When compiled in (`cargo build --features omada_bypass`, which is exactly what the `tauri:dev`/`tauri:build` npm scripts in `apps/desktop/package.json` already pass), `require_active_license()` short-circuits to `Ok(())` unconditionally:

  ```rust
  #[cfg_attr(any(test, feature = "omada_bypass"), allow(unreachable_code))]
  pub fn require_active_license() -> Result<(), String> {
      #[cfg(test)]
      { return Ok(()); }
      #[cfg(feature = "omada_bypass")]
      { return Ok(()); }
      match current_status().state.as_str() {
          "active" => Ok(()),
          _ => Err("...".to_string()),
      }
  }
  ```

  This is a compile-time flag, not a runtime toggle or environment variable — a normal `cargo build`/`tauri build` invocation that doesn't pass `--features omada_bypass` produces a binary byte-for-byte equivalent (for this function) to the upstream commercial product, and the flag cannot be flipped after the binary is built. Its effect is that Omada Agency's own installation of Sordi (built from this branch) never actually hits the commercial license server for its own day-to-day use — see `LICENSING.md` at the repo root for the broader licensing design rationale.
- On the frontend, `useLicense.ts` has a parallel, independent bypass: a `VITE_LICENSE_BYPASS=true` build-time env flag that makes `useLicenseStatus()` always report `state: "active"` without calling the Tauri command at all — a belt-and-suspenders UI-level mirror of the same intent, so the `LicenseBanner` component never renders a warning banner in this branch's build either.

## Sequence / counter generation for document numbering

See [`schema-reference.md`'s sequence-numbering section](./schema-reference.md#the-sequence-numbering-system) for the full mechanics. In short: a dedicated `sequences` table holds one integer counter per document type (`invoice_number`, `delivery_note_number`, `order_number`), incremented atomically inside the same operation that creates the document, with a startup resync pass that recovers the correct next value from existing rows (handling prefixed formats like `AV-001`) so numbering survives manual overrides, deletions, and database migrations without ever emitting a duplicate. Contracts use a simpler, separate per-company-per-year scheme (`OM-CTR-{year}-{seq}`, computed as `COUNT(*) + 1` inside the insert transaction) rather than extending the `sequences` table, since contract volume is low enough that a simple count is sufficient and doesn't need the same collision-hardening machinery.

## Other backend modules

- **`pdf_service.rs`**: wraps `headless_chrome` to render arbitrary HTML to PDF bytes for the `generate_pdf` command — the Rust-side half of the app's [dual PDF pipeline](./frontend.md#pdf-generation-pipeline).
- **`seed_test_data.rs`** (`#[cfg(test)]` only): populates a mock database for Rust-side integration tests; compiled out of every real build.
- **Email**: `send_email_with_pdf` (in `commands.rs`) uses the `lettre` crate (SMTP transport, rustls-tls) to send an email with a base64-decoded PDF attachment, using SMTP credentials configured in Settings' "Envoi d'Emails" tab (Gmail address + App Password).
- **File/image handling**: the `image` crate (pure-Rust JPEG/PNG codecs, no system library dependency) handles employee photo resize/re-encode on upload; `tauri-plugin-dialog` provides native "pick a file"/"save as" dialogs; `tauri-plugin-opener` opens files/paths with the OS default application.
