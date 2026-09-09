# Sordi — Database Configuration & Performance Audit

**Scope:** read-only. No files were modified, no destructive SQL was executed — every database claim below is either `[CODE]` (static analysis of the Rust/TypeScript source) or `[LIVE-DB]` (read-only `sqlite3 -readonly` queries against the real, running database file).

**Repo root:** `/Users/omada/Desktop/SORDI/Raw project/sordi`

---

## Before anything else: the "5 GB" premise doesn't match reality

The request frames this audit around a 5 GB database file. The actual live database found on this machine is:

```
/Users/omada/Library/Application Support/com.sordi.app/database.db
942,080 bytes (≈ 0.9 MB)
```

The app's entire data directory (`~/Library/Application Support/com.sordi.app/`, including the manual backup copies described in §2) totals **28 MB**. Nothing resembling a 5 GB file exists anywhere under this app's data directory, the repo, or `apps/api`. If "5 GB" refers to something else — a different machine, a projected size at scale, or the unrelated `apps/api`/Postgres backend in this monorepo — say so and I'll re-scope. Everything below describes the real, current 942 KB database, and the architectural findings (no WAL, no pagination, base64-in-SQLite) are exactly the things that would turn a small file into a 5 GB one as data grows, so the audit is still directly relevant to that concern.

---

## 1. Database connection & environment isolation

**Path resolution — identical in dev and production.** The connection opens in `apps/desktop/src-tauri/src/database.rs:4-8`:

```rust
pub fn init_database(db_path: &str) -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open(db_path)?;
    conn.execute("PRAGMA foreign_keys = ON", [])?;
```

The path itself is built in `apps/desktop/src-tauri/src/lib.rs:46-49`, inside Tauri's `setup()`:

```rust
let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");
let db_path = app_dir.join("database.db");
let db = init_database(db_path.to_str().unwrap()).expect("failed to initialize database");
```

- It uses Tauri's real `app_data_dir()` API, not a hand-rolled or relative path — correct practice.
- **There is no dev/prod separation.** The filename is the hardcoded literal `"database.db"`, with no `cfg!(debug_assertions)` branch anywhere near it (the only debug-mode check in `lib.rs` gates the logging plugin, not the DB path). `app_data_dir()` resolves from the bundle identifier `com.sordi.app` (`tauri.conf.json:5`), and there's only one `tauri.conf.json` in the project — no dev-only override.
- **Consequence:** running `tauri dev` and the packaged `.app` both resolve to the exact same file — `~/Library/Application Support/com.sordi.app/database.db`. There is no `sordi-dev.db`. A development session and the live production app are, today, the same database.

**Pragmas — only one is set, and it's not the one that matters for a growing file.**

| Pragma | Value | Where |
|---|---|---|
| `foreign_keys` | `ON` | `database.rs:8`, set once at connection open |
| `foreign_keys` | toggled `OFF` → `ON` | `commands.rs:9415`/`9417`, around one specific bulk factory-reset operation |
| `journal_mode` | **not set** | — |
| `synchronous` | **not set** | — |
| `busy_timeout` | **not set** | — |
| `cache_size` | **not set** | — |

With nothing set, SQLite runs on its compiled-in defaults: rollback-journal mode (not WAL), `synchronous=FULL`, and a `busy_timeout` of 0ms. For a single-writer desktop app this is survivable, but it's worth being deliberate about, especially since the file has no configured concurrency safety net at all (see §4).

**No connection pool — a single `Mutex<Connection>`.** `Cargo.toml` has no r2d2 or pooling crate; `rusqlite = { version = "0.31", features = ["bundled", "chrono", "uuid"] }` is used directly. The one `Connection` is wrapped in `std::sync::Mutex` and registered as Tauri app state (`lib.rs:51`, `app.manage(Mutex::new(db))`). Every one of the ~150 list/create/update/delete commands in `commands.rs` takes `db: State<'_, Mutex<Connection>>` and calls `db.lock()` — the whole app is serialized through one connection. This is fine for correctness (no cross-thread races) but means every read blocks every write and vice versa.

---

## 2. Storage & file footprint breakdown

**`[LIVE-DB]`** `sqlite3 -readonly "$DB" ".dbinfo"`:

```
database page size:  4096
database page count: 230        (230 × 4096 = 942,080 bytes — matches the file size exactly)
freelist page count: 0          (no wasted/unreclaimed space to VACUUM away)
number of tables:    31
number of indexes:   39
number of triggers:  0
```

**Per-object size** (`SELECT name, SUM(pgsize), COUNT(*) FROM dbstat GROUP BY name ORDER BY 2 DESC`):

| Object | Bytes | % of file |
|---|---|---|
| `settings` (table) | 409,600 | 43.5% |
| `punch_records` (table) | 90,112 | 9.6% |
| `companies` (table) | 49,152 | 5.2% |
| `sqlite_autoindex_punch_records_1/2` | 61,440 | 6.5% |
| `sqlite_schema` | 28,672 | 3.0% |
| `expenses` | 20,480 | 2.2% |
| `activity_logs` | 16,384 | 1.7% |
| `invoices` | 12,288 | 1.3% |
| everything else (28 tables + remaining indexes, mostly 1 page each) | ~4,096 each | ~0.4% each |

**Row-data vs. index split:** table data = 700,416 bytes (74.3%), indexes = 212,992 bytes (22.6%), schema = 28,672 bytes (3.0%). Cleanly separable — `dbstat` gives exact per-object page counts, no estimation needed.

### Where `settings` gets its 43.5% — base64 images stored as TEXT

`[CODE]` `settings` is a plain key/value table (`database.rs:579-582`):

```sql
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
)
```

`[LIVE-DB]` `SELECT key, length(value) FROM settings ORDER BY 2 DESC`:

| `key` | bytes | % of whole file |
|---|---|---|
| `signature_data` | 238,002 | 25.3% |
| `body_pattern_data` | 77,586 | 8.2% |
| `footer_logo_data` | 39,654 | 4.2% |
| `qr_code_data` | 35,470 | 3.8% |
| `logo_data` | 9,174 | 1.0% |
| 32 other small keys (colors, sizes, SMTP config, PDF backup dir, …) | ~520 total | ~0.1% |

Plus `[LIVE-DB]` `companies.logo_base64` (declared `TEXT` at `database.rs:20`): two rows, 6,174 and 34,266 bytes (40,440 bytes, 4.3% of the file).

**Combined, base64 image/QR payloads stored directly as TEXT in `settings.value` and `companies.logo_base64` account for ≈440,453 of 942,080 bytes — roughly 47% of the entire database — despite the app having only 2 companies and modest business data.** Two of these are self-inflicted at first launch: `database.rs:621` embeds a ~9 KB base64 PNG literally in the Rust source as `logo_data`'s default, and `database.rs:628` embeds a ~76 KB base64 PNG as `body_pattern_data`'s default — both compiled into the binary and written into every fresh install.

**What's stored as a filesystem path instead (correctly, not inflating the DB):**
- `employee_documents.file_path` (`database.rs:950-957`) — relative path under `app_data_dir()`, e.g. `employee_documents/<employee_id>/<doc_id>.pdf`. `[LIVE-DB]` 0 rows today.
- `payment_attachments.file_path` (`database.rs:984-991`) — same convention. `[LIVE-DB]` 0 rows today.
- `employees.photo_path` (added via `ALTER TABLE`, `database.rs:945`) — relative path, resolved against `app_data_dir()` at read time.

**One correction to a premise in the request:** `delivery_notes.client_signature` is **not** an image/blob. It's declared `TEXT` (`database.rs:266`) and the app uses it as the receiver's *typed name* — `apps/desktop/src/lib/validations.ts:182` (`z.string().trim().max(200)`), rendered as a plain text field in `DeliveryEditableStructure.tsx:308-312`. No signature image is captured on delivery notes. (`[LIVE-DB]`: table has 0 rows today, so this is schema/code evidence, not live-data confirmation, but it's unambiguous.)

### Files sitting next to the database that no code produced

`[LIVE-DB]` `ls -la` on the app data directory also shows: `database.backup.20260902222853.db`, `.20260902225154.db`, `.20260902230531.db`, `.20260902231514.db`, `database.db.backup-before-reset-20260826005318`, `database.pre-employee-reset-20260902014815.db`, `database.pre-revenue-seed-backup-20260902171732.db`, `database.pre-seed-backup-20260902001937.db`. `grep`-ing the whole Rust backend for anything that writes filenames matching these patterns turns up nothing — **no code in this repo creates these files.** They read as manual `cp database.db database.backup.<timestamp>.db` copies made by a developer (or an agent working directly on this machine) before risky operations. They account for most of the 28 MB total in the app data directory, versus the live database's 942 KB.

---

## 3. Migration & schema initialization strategy

`[CODE]` Confirmed: **raw embedded SQL, no migration framework.** `init_database()` (`database.rs:4`) is one function containing `CREATE TABLE IF NOT EXISTS` for all 31 tables, plus ~38 `fn migrate_<name>_if_needed(conn: &Connection)` helpers (e.g. `migrate_orders_table_if_needed` at `database.rs:1375`, `migrate_clients_table_if_needed` at `database.rs:1829` — full set spans `database.rs:748-2433`). Each follows the same idiom: read `PRAGMA table_info(<table>)`, check whether a column/constraint already exists, and conditionally run `ALTER TABLE ... ADD COLUMN` (or, rarely, a copy/drop/rename rebuild — see below). There's no `sqlx::migrate!`, no `refinery`, and no `schema_migrations`-style tracking table.

`init_database()` is called from exactly two real places: `lib.rs:49` (the actual app) and `seed_test_data.rs:251` (`#[cfg(test)]`-only, never compiled into a real build). `commands.rs:8233` also calls it, but against `":memory:"` as part of a factory-reset implementation detail — never the real file.

**`DROP TABLE` — 8 occurrences, every one guarded and non-destructive by construction:**

```
database.rs:779   DROP TABLE IF EXISTS employee_scores
database.rs:799   DROP TABLE projects        (only after confirming the table is empty)
database.rs:889   DROP TABLE punch_records    (legacy-schema rebuild)
database.rs:1138  DROP TABLE contracts_old    (rebuild's own temp table)
database.rs:1434  DROP TABLE orders           (copy-then-drop-then-rename rebuild)
database.rs:1510  DROP TABLE order_items      (same pattern)
database.rs:1747  DROP TABLE invoice_items    (same pattern)
database.rs:1810  DROP TABLE delivery_note_items (same pattern)
```

Two verified in full: `migrate_legacy_projects_module` (`database.rs:778-802`) only drops `projects` after checking `SELECT COUNT(*) FROM projects` is 0. `migrate_orders_table_if_needed` (`database.rs:1375-1455`) does `INSERT INTO orders_new (...) SELECT ... FROM orders` **before** dropping the old table and renaming `orders_new` → `orders`, wrapped in one `BEGIN`/`COMMIT` — the standard SQLite constraint-change idiom, data-preserving by construction.

**`DROP COLUMN` — zero occurrences.** `DELETE FROM` has many hits, but every one is an ordinary application-level command (`delete_client`, `delete_invoice`, `clear_activity_logs`) — normal CRUD, not part of the init/migration path.

---

## 4. Backup routines & concurrency safety

**No in-app database backup or export command exists.** `[CODE]`, exhaustive:
- `VACUUM` — 0 matches anywhere in `src/*.rs`.
- `.dump` — 0 matches.
- `export_db`/`export_database` — 0 matches.
- `backup` (case-insensitive) — the only hit is `commands::save_pdf_backup` (`lib.rs:179`, implementation `commands.rs:8139-8157`), which archives **generated invoice/delivery PDFs** into a user-chosen folder — unrelated to the SQLite file itself.

This confirms the manual `database.backup.*`/`database.pre-*` files from §2 were **not** produced by this codebase — there is no code-driven way to snapshot, export, or `VACUUM INTO` the database today. That's a real gap: on a file this size (or a much larger one, per the request's framing), an in-app "Sauvegarder maintenant" (backup now) command using `VACUUM INTO` would be cheap to add and directly closes this hole.

**Transactions are used correctly where they exist.** `conn.transaction()` appears 15 times across `commands.rs`. Two representative checks:
- `create_invoice` (`commands.rs:1602-1689`): one `tx = conn.transaction()` (line 1634) wraps the header insert, every line-item insert, and `recalculate_invoice_totals`, committed once (line 1682).
- `import_punch_records` (`commands.rs:5384-5459`): one transaction wraps the entire per-row insert loop (line 5414-5443) — a bulk import is one atomic commit, not N.

**No `busy_timeout` or retry/backoff logic anywhere** (`grep` for `busy_timeout`, `busy_handler`, `SQLITE_BUSY`, `retry`, `backoff` — zero matches). Given the single `Mutex<Connection>` (§1), true lock contention *within* the app is structurally impossible — only one thread can hold the lock. But if the file were ever opened by a second process (a manual `sqlite3` session, a second app instance, a backup tool) while the app holds a write transaction, there is no configured timeout or retry: an immediate `SQLITE_BUSY` would surface to the frontend as a raw error string (the app's near-universal `.map_err(|e| e.to_string())?` pattern).

---

## 5. IPC transfer & memory performance

**Almost nothing is paginated.** `grep -n "LIMIT" commands.rs` returns 5 real hits: `LIMIT 5` ×2 inside `search_global` (the command palette), and `LIMIT ?` with a default of 50 inside `get_activity_logs` (`commands.rs:206-207`) — the **only** genuinely paginated list command in the backend. Every other `get_*` command returning a `Vec<...>` — `get_clients`, `get_products`, `get_invoices`, `get_invoices_with_clients`, `get_payments`, `get_orders`, `get_delivery_notes`, `get_expenses`, `get_employees`, `get_projects`, `get_partners`, and more (29 such signatures total) — issues an unbounded `SELECT * FROM <table> WHERE company_id = ?1 [...]` with no `LIMIT`, and the frontend's `db.<entity>.getAll(company_id)` wrappers in `apps/desktop/src/lib/database.ts` never pass a limit/offset/cursor either, despite a `paginationUtils.ts` existing in the repo (that one is client-side table/PDF pagination only, unrelated to IPC payload size).

**What fires on startup.** The default route renders `pages/Index.tsx` (the Dashboard), whose mount — gated only on the active company being resolved, not on further navigation — fires:

| Hook | Command | Notes |
|---|---|---|
| `useDashboardStats(year, months)` ×2 | `get_dashboard_stats` | current period + prior-year comparison; real SQL aggregation, not a full-table dump |
| `useInvoices()` | `get_invoices_with_clients` | full list, joined, no LIMIT |
| `useProjects()` | `get_projects` | full list |
| `useClients()` | `get_clients` | full list |
| `useProjectStatsMap()` | `get_project_stats` | full list |
| `useExpenses()` | `get_expenses` | full list |
| `useEmployees()` | `get_employees` | full list |
| `recentActivity` query | `get_activity_logs` (limit 5) | paginated |

**Additionally, and not scoped to the dashboard** — `useSidebarCounts.ts` runs from `Sidebar.tsx`, which is part of the layout wrapping **every** protected route, so it fires on every page, not just `/`:
- `db.invoices.getAll(companyId)` — full, unfiltered (shares a query key with the dashboard's own invoice fetch, so React Query typically dedupes the two within its 30s `staleTime`).
- `db.orders.getAll(companyId)` — full, unfiltered.
- `db.deliveryNotes.getAll(companyId)` — full, unfiltered.
- `db.history.getLogs(20)` — paginated.

**Net effect:** landing on the dashboard triggers roughly 8-9 separate unbounded IPC round trips. With the current, small live dataset (largest table observed was `expenses` at 5 pages / 20 KB, per §2) this isn't a practical problem yet — but the architecture has no ceiling. `get_invoices`, `get_clients`, `get_orders`, and the rest will return their *entire* table over IPC regardless of row count, and that's the mechanism that turns "the app feels slow at startup" into a real complaint as the business's real data volume grows — same underlying pattern as the base64-in-SQLite issue in §2, just on the read side instead of storage.

---

## What this audit could not verify

- Who or what created the manual `database.backup.*` files — no code in the repo produces them, so their origin is outside what static analysis or the live DB can confirm.
- Actual runtime behavior under `SQLITE_BUSY` contention was not empirically triggered — the finding is a static-code inference from the absence of `busy_timeout`/retry logic, not an observed failure.
- Everything else above is either a direct source citation (file:line) or a direct read-only query result against the real `~/Library/Application Support/com.sordi.app/database.db`.

---

## If you want to act on this

Roughly in order of impact for a database that's expected to grow:

1. **Move the four base64 image fields (`signature_data`, `body_pattern_data`, `footer_logo_data`, `qr_code_data`) and `companies.logo_base64` out of SQLite and onto the filesystem**, storing just a path — mirrors the pattern already used correctly for `employee_documents`/`payment_attachments`/`employees.photo_path`. This alone would cut the current file from 942 KB to roughly 500 KB, and matters far more at real scale.
2. **Add a code-driven backup command** (`VACUUM INTO` a timestamped file, exposed as a Tauri command with a menu/settings entry) — closes the gap that's currently being papered over by manual file copies.
3. **Set `journal_mode=WAL` and a non-zero `busy_timeout`** at connection open in `database.rs:4-8` — cheap, standard hardening for a file that will only get bigger and busier.
4. **Add a dev/prod path split** (e.g. `database-dev.db` under `cfg!(debug_assertions)`) so `tauri dev` stops sharing the live production file.
5. **Paginate the highest-traffic list commands** (`get_invoices`, `get_clients`, `get_orders` at minimum) the same way `get_activity_logs` already does, and scope the sidebar's counts to a `COUNT(*)`-style query instead of fetching full rows just to count them.
