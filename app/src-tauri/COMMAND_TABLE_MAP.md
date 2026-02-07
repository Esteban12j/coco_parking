# Tauri Command → SQL Table Map (DBA / Auditing)

Simple map of **which Tauri command reads or writes which SQL table**. Use it to audit performance and consistency without opening every domain. When you add a command or a table, update this document and the table index below.

**Related docs:** `QUERIES_BY_DOMAIN.md` (queries by domain); `DATABASE_SCHEMA.md` (schema and migrations).

---

## Table index (reference)

| Table             | Purpose |
|-------------------|--------|
| `vehicles`        | Parking sessions: entry/exit, plate, type, debt, total_amount |
| `transactions`    | Payments per vehicle (amount, method, created_at) |
| `shift_closures`  | Caja shift closures (totals, arqueo, discrepancy) |
| `roles`           | Role id and name |
| `role_permissions`| Permission strings per role |
| `users`           | Username, password_hash, display_name, role_id |
| `custom_tariffs`  | Rates by vehicle_type and optional plate_or_ref |
| `barcodes`        | Barcode codes (8-digit, unique), optional label, created_at |
| `schema_version`  | Migration version (db.rs only) |
| `drive_config`    | Key-value app config (e.g. backup_interval_hours, backup_output_directory, backup_max_retained) |

---

## Command → Table (Read / Write)

| Command | Read | Write | Note |
|---------|------|-------|------|
| `auth_get_session` | users, roles | — | Session by user id |
| `auth_login` | users, roles | — | Verify password, load role |
| `auth_logout` | — | — | In-memory only |
| `backup_config_get` | drive_config | R | Read backup_interval_hours, backup_output_directory, backup_max_retained; defaults when missing |
| `backup_config_set` | drive_config | W | INSERT/UPDATE drive_config for backup keys; validates interval and max_retained ≥ 1 |
| `backup_create` | (full DB) | — | SQLite backup API, no SQL |
| `backup_run_full` | (full DB), drive_config | — | Copy DB to temp, gzip to configured path; naming `backup_YYYY-MM-DD_HH-mm.sqlite.gz` |
| `backup_list` | — | — | No DB access |
| `backup_restore` | — | schema_version, roles, role_permissions, users, vehicles, transactions, shift_closures, barcodes | Overwrites listed tables from backup file |
| `caja_close_shift` | transactions | shift_closures | Reads since last closure; INSERT shift_closures |
| `caja_get_debug` | transactions | — | Counts and last 5 rows |
| `caja_get_treasury` | transactions | — | COUNT + SUM by method for date |
| `caja_list_shift_closures` | shift_closures | — | ORDER BY closed_at DESC |
| `custom_tariffs_create` | custom_tariffs | custom_tariffs | Uniqueness check; INSERT |
| `custom_tariffs_delete` | — | custom_tariffs | DELETE WHERE id |
| `custom_tariffs_list` | custom_tariffs | — | Optional search filter |
| `custom_tariffs_update` | custom_tariffs | custom_tariffs | SELECT then UPDATE |
| `barcodes_list` | barcodes | — | ORDER BY created_at DESC |
| `barcodes_get_by_id` | barcodes | — | SELECT by id |
| `barcodes_get_by_code` | barcodes | — | SELECT by code |
| `barcodes_create` | barcodes | barcodes | Validate 8-digit range; uniqueness check; INSERT |
| `barcodes_delete` | — | barcodes | DELETE WHERE id |
| `dev_clear_database` | — | transactions, vehicles, shift_closures, role_permissions, users, roles | Dev only; TRUNCATE-like |
| `dev_get_current_user_id` | — | — | In-memory state |
| `dev_get_db_path` | — | — | App state path |
| `dev_get_db_snapshot` | vehicles, transactions | — | Dev only; last 20 rows each |
| `dev_list_commands` | — | — | From code |
| `dev_login_as_developer` | — | — | In-memory session |
| `dev_set_current_user` | — | — | In-memory state |
| `metricas_get_arrivals_by_hour` | vehicles | — | Hour(entry_time), COUNT, date range |
| `metricas_get_daily` | vehicles, transactions | — | Today: active count, revenue, stay minutes |
| `metricas_get_heatmap_day_vehicle` | vehicles | — | Day of week, hour, vehicle_type, COUNT |
| `metricas_get_occupancy_by_hour` | vehicles | — | Entry/exit in range; occupancy in Rust |
| `metricas_get_peak_hours` | transactions | — | Hour(created_at), COUNT, date range |
| `reportes_fetch` | (see report runners) | — | Dispatches to run_* by report type |
| `reportes_get_column_definitions` | — | — | From code |
| `reportes_write_csv` | (same as reportes_fetch) | — | Same queries, writes CSV |
| `roles_create_user` | users, roles | users | Check role; INSERT users |
| `roles_delete_user` | — | users | DELETE WHERE id |
| `roles_get_current_user` | users, roles | — | Same as auth_get_session |
| `roles_get_my_permissions` | — | — | In-memory state |
| `roles_get_permissions_for_user` | users, role_permissions | — | By user id |
| `roles_get_role_permissions` | role_permissions | — | By role_id |
| `roles_list_all_permissions` | — | — | From permissions module |
| `roles_list_roles` | roles | — | id, name ORDER BY name |
| `roles_list_users` | users, roles | — | JOIN, ORDER BY username |
| `roles_set_password` | — | users | UPDATE password_hash |
| `roles_update_role_permissions` | roles, role_permissions | role_permissions | DELETE then INSERT per role |
| `roles_update_user` | users, roles | users | UPDATE display_name, role_id |
| `vehiculos_delete_vehicle` | — | transactions, vehicles | DELETE transactions then vehicle |
| `vehiculos_find_by_plate` | vehicles | — | status = active |
| `vehiculos_find_by_ticket` | vehicles | — | By ticket_code, active |
| `vehiculos_get_debt_detail_by_plate` | vehicles, transactions | — | Sessions + transactions for plate |
| `vehiculos_get_plate_conflicts` | vehicles | — | Plates with >1 vehicle_type |
| `vehiculos_get_plate_debt` | vehicles | — | SUM(debt) for plate |
| `vehiculos_get_total_debt` | vehicles | — | SUM(debt) where debt > 0 |
| `vehiculos_get_vehicles_by_plate` | vehicles | — | All by plate_upper |
| `vehiculos_list_debtors` | vehicles | — | GROUP BY plate_upper, paginated |
| `vehiculos_list_vehicles` | vehicles | — | Paginated, optional status |
| `vehiculos_list_vehicles_by_date` | vehicles | — | Entry/exit on date |
| `vehiculos_process_exit` | vehicles, custom_tariffs | vehicles, transactions | SELECT vehicle/tariff; UPDATE vehicle; INSERT transaction |
| `vehiculos_register_entry` | vehicles | vehicles | Check ticket/plate; INSERT vehicle |
| `vehiculos_resolve_plate_conflict` | vehicles | transactions, vehicles | Delete all but one vehicle (+ transactions) for plate |
| `vehiculos_search_vehicles_by_plate_prefix` | vehicles | — | LIKE prefix (ESCAPE) |

---

## Report runners (used by `reportes_fetch` / `reportes_write_csv`)

| Runner | Read | Write |
|--------|------|-------|
| run_transactions | transactions | — |
| run_completed_vehicles | vehicles | — |
| run_shift_closures | shift_closures | — |
| run_transactions_with_vehicle | transactions, vehicles | — |
| run_debtors | vehicles | — |

---

## How to keep this document up to date

1. **New Tauri command:** Add a row: command name, tables read, tables write, short note.
2. **New SQL table:** Add it to the table index; add it to the Read/Write column of every command that uses it.
3. **Command removed:** Delete its row.
4. **Table removed:** Remove from index and from all command rows.

The canonical list of registered commands is `src/lib.rs` (`invoke_handler`). Table usage is implemented in `src/domains/*.rs` and `src/dev.rs`.
