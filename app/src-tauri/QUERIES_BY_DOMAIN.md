# Backend Queries by Domain (Rust / SQLite)

This document maps each Tauri command to its domain module, SQL tables used (read/write), and a short description. Use it to locate queries and change them without breaking other commands.

**Convention:** All SQL lives in `src/domains/<domain>.rs`. Queries use parameterized statements only (no string interpolation of user input). Schema and migrations are in `src/db.rs`.

---

## Table index (schema)

| Table | Purpose |
|------|--------|
| `vehicles` | Parking sessions: entry/exit, plate, type, debt, total_amount |
| `transactions` | Payments per vehicle (amount, method, created_at) |
| `shift_closures` | Caja shift closures (totals, arqueo, discrepancy) |
| `roles` | Role id and name |
| `role_permissions` | Permission strings per role |
| `users` | Username, password_hash, display_name, role_id |
| `custom_tariffs` | Rates by vehicle_type and optional plate_or_ref |
| `barcodes` | Barcode codes (8-digit, unique), optional label, created_at |
| `schema_version` | Migration version (db.rs only) |
| `drive_config` | Key-value config (db.rs migrations) |

---

## Domain: vehiculos

**File:** `src/domains/vehiculos.rs`

| Tauri command | Tables | R/W | Description |
|---------------|--------|-----|-------------|
| `vehiculos_list_vehicles` | vehicles | R | List vehicles with optional status filter; COUNT + SELECT with LIMIT/OFFSET |
| `vehiculos_list_vehicles_by_date` | vehicles | R | Vehicles with entry or exit on given date (YYYY-MM-DD); COUNT + SELECT |
| `vehiculos_get_total_debt` | vehicles | R | SUM(debt) where debt > 0 |
| `vehiculos_list_debtors` | vehicles | R | GROUP BY plate_upper, SUM(debt), COUNT, MIN(exit_time); paginated |
| `vehiculos_get_plate_debt` | vehicles | R | SUM(debt) for plate_upper = ? |
| `vehiculos_get_debt_detail_by_plate` | vehicles, transactions | R | Sessions with debt + transactions for vehicle_ids |
| `vehiculos_register_entry` | vehicles | R,W | Check ticket_code/plate_upper in use; SELECT debt for plate; INSERT vehicle |
| `vehiculos_process_exit` | vehicles, transactions | R,W | SELECT vehicle by ticket; UPDATE vehicle (exit_time, status, total_amount, debt); optional UPDATE other vehicles (debt=0); INSERT transaction |
| `vehiculos_remove_from_parking` | vehicles | R,W | SELECT by vehicle_id or ticket_code (active); UPDATE exit_time, status='removed', total_amount=NULL, debt=0; no transaction row |
| `vehiculos_find_by_ticket` | vehicles | R | SELECT by ticket_code and status='active' |
| `vehiculos_find_by_plate` | vehicles | R | SELECT by plate_upper and status='active' |
| `vehiculos_get_vehicles_by_plate` | vehicles | R | SELECT all by plate_upper, ORDER BY entry_time DESC |
| `vehiculos_search_vehicles_by_plate_prefix` | vehicles | R | SELECT where plate_upper LIKE prefix (ESCAPE) |
| `vehiculos_delete_vehicle` | transactions, vehicles | W | DELETE transactions by vehicle_id; DELETE vehicle |
| `vehiculos_get_plate_conflicts` | vehicles | R | Plates with COUNT(DISTINCT vehicle_type) > 1; then SELECT vehicles by plate |
| `vehiculos_resolve_plate_conflict` | vehicles | R,W | SELECT ids by plate_upper; DELETE transactions and vehicles for ids not kept |

**Note:** Exit flow uses `custom_tariffs` via `custom_tariffs::get_default_rate_from_db` (read-only).

---

## Domain: metricas

**File:** `src/domains/metricas.rs`

| Tauri command | Tables | R/W | Description |
|---------------|--------|-----|-------------|
| `metricas_get_daily` | vehicles, transactions | R | COUNT(active); JOIN vehicles+transactions for today (revenue, stay minutes) |
| `metricas_get_peak_hours` | transactions | R | Hour of created_at, COUNT per hour in date range |
| `metricas_get_arrivals_by_hour` | vehicles | R | Hour of entry_time, COUNT where exit_time IS NOT NULL, in date range |
| `metricas_get_occupancy_by_hour` | vehicles | R | SELECT entry_time, exit_time in range; occupancy per hour computed in Rust |
| `metricas_get_heatmap_day_vehicle` | vehicles | R | strftime(%w), hour, vehicle_type, COUNT; status='completed', exit_time in range |

---

## Domain: caja

**File:** `src/domains/caja.rs`

| Tauri command | Tables | R/W | Description |
|---------------|--------|-----|-------------|
| `caja_get_debug` | transactions | R | COUNT(*); COUNT and SUM for today prefix; last 5 transactions |
| `caja_get_treasury` | transactions | R | COUNT + SUM by method (cash/card/transfer) for date prefix |
| `caja_close_shift` | shift_closures, transactions | R,W | SELECT last shift closed_at for today; COUNT and SUM by method since then; INSERT shift_closures |
| `caja_list_shift_closures` | shift_closures | R | SELECT all columns ORDER BY closed_at DESC LIMIT |

---

## Domain: barcodes

**File:** `src/domains/barcodes.rs`

| Tauri command | Tables | R/W | Description |
|---------------|--------|-----|-------------|
| `barcodes_list` | barcodes | R | SELECT id, code, label, created_at ORDER BY created_at DESC |
| `barcodes_get_by_id` | barcodes | R | SELECT by id; returns Option |
| `barcodes_get_by_code` | barcodes | R | SELECT by code; returns Option |
| `barcodes_create` | barcodes | R,W | Validate 8-digit, range 10000000–99999999, uniqueness; INSERT |
| `barcodes_delete` | barcodes | W | DELETE WHERE id |

---

## Domain: reportes

**File:** `src/domains/reportes.rs`

| Tauri command | Tables | R/W | Description |
|---------------|--------|-----|-------------|
| `reportes_get_column_definitions` | (none) | - | Returns column metadata for report type |
| `reportes_fetch` | See run_* below | R | Dispatches to run_transactions, run_completed_vehicles, run_shift_closures, run_transactions_with_vehicle, run_debtors |
| `reportes_write_csv` | Same as reportes_fetch | R | Same queries, writes rows to file |

**Report runners (internal):**

| Runner | Tables | Description |
|--------|--------|-------------|
| `run_transactions` | transactions | SELECT by created_at range, optional LOWER(method)=? |
| `run_completed_vehicles` | vehicles | status='completed', exit_time in range, optional vehicle_type |
| `run_shift_closures` | shift_closures | closed_at in range |
| `run_transactions_with_vehicle` | transactions, vehicles | JOIN t+v, created_at range, optional method/vehicle_type |
| `run_debtors` | vehicles | GROUP BY plate_upper, SUM(debt), MIN(exit_time), COUNT (same logic as vehiculos_list_debtors) |

---

## Domain: roles (auth + users + permissions)

**File:** `src/domains/roles.rs`

| Tauri command | Tables | R/W | Description |
|---------------|--------|-----|-------------|
| `auth_login` | users, roles | R | SELECT user by username; verify password; SELECT role name, user created_at |
| `auth_logout` | (none) | - | In-memory session clear |
| `auth_get_session` | users, roles | R | SELECT user by id; SELECT role name |
| `roles_list_roles` | roles | R | SELECT id, name ORDER BY name |
| `roles_list_users` | users, roles | R | JOIN users + roles, ORDER BY username |
| `roles_create_user` | users, roles | R,W | Check username/role exists; INSERT users |
| `roles_update_user` | users, roles | R,W | Check role exists; UPDATE users (display_name, role_id); SELECT user |
| `roles_set_password` | users | W | UPDATE users SET password_hash |
| `roles_delete_user` | users | W | DELETE FROM users WHERE id |
| `roles_get_current_user` | (delegates to auth_get_session) | R | Same as auth_get_session |
| `roles_get_permissions_for_user` | users, role_permissions | R | load_permissions_for_user (role_id from users, then permissions from role_permissions) |
| `roles_list_all_permissions` | (none) | - | From code (permissions module) |
| `roles_get_role_permissions` | role_permissions | R | SELECT permission WHERE role_id |
| `roles_update_role_permissions` | roles, role_permissions | R,W | Check role exists; DELETE role_permissions for role; INSERT each permission |
| `roles_get_my_permissions` | (none) | - | From in-memory state |

**Shared (used by state):** `load_permissions_for_user` — users (R), role_permissions (R).

---

## Domain: custom_tariffs

**File:** `src/domains/custom_tariffs.rs`

| Tauri command | Tables | R/W | Description |
|---------------|--------|-----|-------------|
| `custom_tariffs_list` | custom_tariffs | R | SELECT with optional search (name/plate_or_ref/description/vehicle_type LIKE) |
| `custom_tariffs_create` | custom_tariffs | R,W | Check (vehicle_type, plate_or_ref) uniqueness; INSERT |
| `custom_tariffs_update` | custom_tariffs | R,W | SELECT existing; check other id for (vehicle_type, plate); UPDATE |
| `custom_tariffs_delete` | custom_tariffs | W | DELETE WHERE id |

**Shared (used by vehiculos):** `get_default_rate_from_db(conn, vehicle_type)` — custom_tariffs (R): default rate for vehicle type (plate_or_ref empty).

---

## Domain: backup

**File:** `src/domains/backup.rs`

| Tauri command | Tables | R/W | Description |
|---------------|--------|-----|-------------|
| `backup_config_get` | drive_config | R | Read backup_interval_hours, backup_output_directory, backup_max_retained; defaults: 12 h, app_data_dir/backups, 7 |
| `backup_config_set` | drive_config | W | INSERT/UPDATE drive_config for backup keys (partial update); validates interval_hours and max_retained ≥ 1 |
| `backup_create` | (full DB) | R | SQLite backup API (no SQL; copies entire DB) |
| `backup_restore` | schema_version, roles, role_permissions, users, vehicles, transactions, shift_closures, barcodes | W | ATTACH backup; DELETE main.*; INSERT main.* SELECT * FROM backup_db.*; DETACH. Note: custom_tariffs, drive_config not in DATA_TABLES (restore overwrites only listed tables). |
| `backup_list` | (none) | - | Returns empty list (no DB read) |

---

## Dev (not part of production contract)

**File:** `src/dev.rs`

| Handler | Tables | R/W | Description |
|---------|--------|-----|-------------|
| `dev_get_db_snapshot` | vehicles, transactions | R | COUNT vehicles/transactions; last 20 vehicles; last 20 transactions |
| `dev_clear_database` | transactions, vehicles, shift_closures, role_permissions, users, roles | W | PRAGMA foreign_keys OFF; DELETE from tables; ON |

---

## db.rs (migrations and seed)

**File:** `src/db.rs`

- **run_migrations:** schema_version (R,W), creates/alters all tables and indexes.
- **sync_role_permissions_from_code:** role_permissions (R,W).
- **seed_users_roles:** roles, role_permissions, users (W).

Tests in `db.rs` use vehicles and transactions (INSERT/SELECT) for migration and integration tests.

---

## Cross-domain / shared query patterns

- **Debtors aggregation (GROUP BY plate_upper, SUM(debt), etc.):** Implemented in `vehiculos_list_debtors` and `reportes::run_debtors`. Same logic; different use (UI list vs report export). If you change the definition of “debtor” or columns, update both.
- **Treasury by date (COUNT + SUM by payment method):** In `caja_get_treasury` and `caja_close_shift` (and db test). Same table `transactions` and date filter pattern.
- **Default rate by vehicle type:** `custom_tariffs::get_default_rate_from_db` is used by `vehiculos_process_exit`; single place for default rate read.

When adding or changing a command, update this document and the table index if new tables are used.
