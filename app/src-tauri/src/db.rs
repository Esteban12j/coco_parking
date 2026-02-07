//! SQLite persistence for vehicles, transactions, and derived data.
//! Schema and migrations run on first connection.

use rusqlite::Connection;

/// Pool is stored in AppState as Arc<r2d2::Pool<...>> (see lib.rs setup).
pub type Pool = std::sync::Arc<r2d2::Pool<r2d2_sqlite::SqliteConnectionManager>>;

#[allow(dead_code)]
const SCHEMA_VERSION: i64 = 18;

pub fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
        INSERT OR IGNORE INTO schema_version (version) VALUES (0);
        "#,
    )
    .map_err(|e| e.to_string())?;

    let current: i64 = conn
        .query_row("SELECT MAX(version) FROM schema_version", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if current < 1 {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS vehicles (
                id TEXT PRIMARY KEY,
                ticket_code TEXT NOT NULL,
                plate TEXT NOT NULL,
                vehicle_type TEXT NOT NULL,
                observations TEXT,
                entry_time TEXT NOT NULL,
                exit_time TEXT,
                status TEXT NOT NULL,
                total_amount REAL,
                debt REAL,
                special_rate REAL
            );
            CREATE INDEX IF NOT EXISTS idx_vehicles_ticket ON vehicles(ticket_code);
            CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate);
            CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
            CREATE INDEX IF NOT EXISTS idx_vehicles_entry_time ON vehicles(entry_time);

            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                vehicle_id TEXT NOT NULL,
                amount REAL NOT NULL,
                method TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
            );
            CREATE INDEX IF NOT EXISTS idx_transactions_vehicle ON transactions(vehicle_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
            "#,
        )
        .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (1)", [])
            .map_err(|e| e.to_string())?;
    }

    // Migration 2: ticket_code sin UNIQUE para permitir reutilizar la misma tarjeta tras cerrar turno.
    // transactions tiene FK a vehicles(id). Para DROP vehicles sin perder datos: desactivar FK solo
    // durante esta migración (estándar SQLite); no se borra ningún dato del cliente.
    if current < 2 {
        conn.execute("PRAGMA foreign_keys = OFF", [])
            .map_err(|e| e.to_string())?;
        conn.execute("DROP TABLE IF EXISTS vehicles_new", [])
            .map_err(|e| e.to_string())?;
        conn.execute_batch(
            r#"
            CREATE TABLE vehicles_new (
                id TEXT PRIMARY KEY,
                ticket_code TEXT NOT NULL,
                plate TEXT NOT NULL,
                vehicle_type TEXT NOT NULL,
                observations TEXT,
                entry_time TEXT NOT NULL,
                exit_time TEXT,
                status TEXT NOT NULL,
                total_amount REAL,
                debt REAL,
                special_rate REAL
            );
            INSERT INTO vehicles_new SELECT id, ticket_code, plate, vehicle_type, observations, entry_time, exit_time, status, total_amount, debt, special_rate FROM vehicles;
            DROP TABLE vehicles;
            ALTER TABLE vehicles_new RENAME TO vehicles;
            CREATE INDEX IF NOT EXISTS idx_vehicles_ticket ON vehicles(ticket_code);
            CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate);
            CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
            CREATE INDEX IF NOT EXISTS idx_vehicles_entry_time ON vehicles(entry_time);
            "#,
        )
        .map_err(|e| e.to_string())?;
        conn.execute("PRAGMA foreign_keys = ON", [])
            .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (2)", [])
            .map_err(|e| e.to_string())?;
    }

    // Migration 3: índice compuesto para cargar más rápido consultas por placa y tipo (conflictos, listado por placa).
    if current < 3 {
        conn.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_vehicles_plate_type ON vehicles(plate, vehicle_type);",
        )
        .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (3)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 4 {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS shift_closures (
                id TEXT PRIMARY KEY,
                closed_at TEXT NOT NULL,
                expected_total REAL NOT NULL,
                cash_total REAL NOT NULL,
                card_total REAL NOT NULL,
                transfer_total REAL NOT NULL,
                arqueo_cash REAL,
                discrepancy REAL NOT NULL,
                total_transactions INTEGER NOT NULL,
                notes TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_shift_closures_closed_at ON shift_closures(closed_at);
            "#,
        )
        .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (4)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 5 {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS roles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id TEXT NOT NULL,
                permission TEXT NOT NULL,
                PRIMARY KEY (role_id, permission),
                FOREIGN KEY (role_id) REFERENCES roles(id)
            );
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                role_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (role_id) REFERENCES roles(id)
            );
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
            CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
            "#,
        )
        .map_err(|e| e.to_string())?;
        seed_users_roles(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (5)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 6 {
        use crate::permissions;
        let admin_role_id = "role_admin";
        let perm: &str = permissions::DEV_CONSOLE_ACCESS;
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM role_permissions WHERE role_id = ?1 AND permission = ?2",
                [admin_role_id, perm],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists == 0 {
            conn.execute(
                "INSERT INTO role_permissions (role_id, permission) VALUES (?1, ?2)",
                [admin_role_id, perm],
            )
            .map_err(|e| e.to_string())?;
        }
        conn.execute("INSERT INTO schema_version (version) VALUES (6)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 7 {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS drive_config (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            "#,
        )
        .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (7)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 8 {
        conn.execute_batch(
            r#"
            ALTER TABLE vehicles ADD COLUMN plate_upper TEXT;
            UPDATE vehicles SET plate_upper = UPPER(TRIM(COALESCE(plate, ''))) WHERE plate_upper IS NULL;
            CREATE INDEX IF NOT EXISTS idx_vehicles_plate_upper ON vehicles(plate_upper);
            CREATE INDEX IF NOT EXISTS idx_vehicles_status_exit_time ON vehicles(status, exit_time);
            "#,
        )
        .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (8)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 9 {
        conn.execute("INSERT INTO schema_version (version) VALUES (9)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 10 {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS custom_tariffs (
                id TEXT PRIMARY KEY,
                plate_or_ref TEXT NOT NULL,
                description TEXT,
                amount REAL NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_custom_tariffs_plate_or_ref ON custom_tariffs(plate_or_ref);
            "#,
        )
        .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (10)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 11 {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS default_rates (
                vehicle_type TEXT PRIMARY KEY,
                amount REAL NOT NULL
            );
            INSERT OR IGNORE INTO default_rates (vehicle_type, amount) VALUES ('car', 50), ('motorcycle', 30), ('truck', 80), ('bicycle', 15);
            "#,
        )
        .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (11)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 12 {
        conn.execute_batch(
            r#"
            ALTER TABLE custom_tariffs ADD COLUMN vehicle_type TEXT;
            UPDATE custom_tariffs SET vehicle_type = 'car' WHERE vehicle_type IS NULL;
            "#,
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            r#"
            INSERT INTO custom_tariffs (id, vehicle_type, plate_or_ref, description, amount, created_at)
            SELECT 'default_car', vehicle_type, '', NULL, amount, datetime('now') FROM default_rates WHERE vehicle_type = 'car'
            "#,
            [],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            r#"
            INSERT INTO custom_tariffs (id, vehicle_type, plate_or_ref, description, amount, created_at)
            SELECT 'default_motorcycle', vehicle_type, '', NULL, amount, datetime('now') FROM default_rates WHERE vehicle_type = 'motorcycle'
            "#,
            [],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            r#"
            INSERT INTO custom_tariffs (id, vehicle_type, plate_or_ref, description, amount, created_at)
            SELECT 'default_truck', vehicle_type, '', NULL, amount, datetime('now') FROM default_rates WHERE vehicle_type = 'truck'
            "#,
            [],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            r#"
            INSERT INTO custom_tariffs (id, vehicle_type, plate_or_ref, description, amount, created_at)
            SELECT 'default_bicycle', vehicle_type, '', NULL, amount, datetime('now') FROM default_rates WHERE vehicle_type = 'bicycle'
            "#,
            [],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM custom_tariffs WHERE (plate_or_ref IS NULL OR plate_or_ref = '') AND vehicle_type IN ('car','motorcycle','truck','bicycle') AND id NOT LIKE 'default_%'",
            [],
        )
        .map_err(|e| e.to_string())?;
        conn.execute("DROP TABLE IF EXISTS default_rates", [])
            .map_err(|e| e.to_string())?;
        conn.execute_batch(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_tariffs_vehicle_plate ON custom_tariffs(vehicle_type, COALESCE(plate_or_ref, ''));",
        )
        .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (12)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 13 {
        conn.execute_batch(
            "ALTER TABLE custom_tariffs ADD COLUMN name TEXT;",
        )
        .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (13)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 14 {
        conn.execute_batch(
            r#"
            ALTER TABLE custom_tariffs ADD COLUMN rate_unit TEXT;
            UPDATE custom_tariffs SET rate_unit = 'hour' WHERE rate_unit IS NULL;
            "#,
        )
        .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (14)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 15 {
        conn.execute_batch(
            r#"
            ALTER TABLE custom_tariffs ADD COLUMN rate_duration_hours INTEGER;
            ALTER TABLE custom_tariffs ADD COLUMN rate_duration_minutes INTEGER;
            UPDATE custom_tariffs SET rate_duration_hours = 1, rate_duration_minutes = 0 WHERE rate_unit IS NULL OR rate_unit = 'hour';
            UPDATE custom_tariffs SET rate_duration_hours = 0, rate_duration_minutes = 1 WHERE rate_unit = 'minute';
            UPDATE custom_tariffs SET rate_duration_hours = 1, rate_duration_minutes = 0 WHERE rate_duration_hours IS NULL;
            UPDATE custom_tariffs SET rate_duration_minutes = 0 WHERE rate_duration_minutes IS NULL;
            "#,
        )
        .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (15)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 16 {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS barcodes (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL UNIQUE,
                label TEXT,
                created_at TEXT NOT NULL,
                CHECK(LENGTH(code) = 8 AND CAST(code AS INTEGER) BETWEEN 10000000 AND 99999999)
            );
            "#,
        )
        .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (16)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 17 {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS barcodes_new (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL UNIQUE,
                label TEXT,
                created_at TEXT NOT NULL,
                CHECK(LENGTH(code) >= 1 AND LENGTH(code) <= 24)
            );
            INSERT INTO barcodes_new (id, code, label, created_at) SELECT id, code, label, created_at FROM barcodes;
            DROP TABLE barcodes;
            ALTER TABLE barcodes_new RENAME TO barcodes;
            "#,
        )
        .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (17)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 18 {
        conn.execute_batch(
            r#"
            ALTER TABLE users ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
            "#,
        )
        .map_err(|e| e.to_string())?;
        seed_developer_role_and_user(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (18)", [])
            .map_err(|e| e.to_string())?;
    }

    sync_role_permissions_from_code(conn)?;
    seed_developer_role_and_user(conn)?;
    Ok(())
}

fn sync_role_permissions_from_code(conn: &Connection) -> Result<(), String> {
    use crate::permissions;
    let admin_role_id = "role_admin";
    conn.execute(
        "DELETE FROM role_permissions WHERE role_id = ?1 AND permission = ?2",
        [admin_role_id, permissions::DEV_CONSOLE_ACCESS],
    )
    .map_err(|e| e.to_string())?;
    for perm in permissions::admin_permissions() {
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM role_permissions WHERE role_id = ?1 AND permission = ?2",
                [admin_role_id, perm],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists == 0 {
            conn.execute(
                "INSERT INTO role_permissions (role_id, permission) VALUES (?1, ?2)",
                [admin_role_id, perm],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    let developer_role_id = permissions::ROLE_DEVELOPER_ID;
    for perm in permissions::developer_permissions() {
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM role_permissions WHERE role_id = ?1 AND permission = ?2",
                [developer_role_id, perm],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists == 0 {
            conn.execute(
                "INSERT INTO role_permissions (role_id, permission) VALUES (?1, ?2)",
                [developer_role_id, perm],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

pub fn seed_developer_role_and_user_public(conn: &Connection) -> Result<(), String> {
    seed_developer_role_and_user(conn)
}

fn seed_developer_role_and_user(conn: &Connection) -> Result<(), String> {
    use crate::permissions;
    let developer_role_id = permissions::ROLE_DEVELOPER_ID;
    let developer_user_id = permissions::DEVELOPER_USER_ID;
    let developer_username = permissions::DEVELOPER_USERNAME;
    let role_exists: i64 = conn
        .query_row("SELECT COUNT(*) FROM roles WHERE id = ?1", [developer_role_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if role_exists == 0 {
        conn.execute(
            "INSERT INTO roles (id, name) VALUES (?1, ?2)",
            [developer_role_id, "developer"],
        )
        .map_err(|e| e.to_string())?;
        for perm in permissions::developer_permissions() {
            conn.execute(
                "INSERT INTO role_permissions (role_id, permission) VALUES (?1, ?2)",
                [developer_role_id, perm],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    const DEVELOPER_PASSWORD_HASH: &str =
        include_str!(concat!(env!("OUT_DIR"), "/developer_password_hash.txt"));
    let hash = DEVELOPER_PASSWORD_HASH.trim();
    if hash.is_empty() {
        return Ok(());
    }
    let user_exists: i64 = conn
        .query_row("SELECT COUNT(*) FROM users WHERE id = ?1", [developer_user_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if user_exists == 0 {
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            r#"INSERT INTO users (id, username, password_hash, display_name, role_id, created_at, hidden) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)"#,
            rusqlite::params![
                developer_user_id,
                developer_username,
                hash,
                "Developer",
                developer_role_id,
                now,
            ],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE users SET password_hash = ?1 WHERE id = ?2",
            [hash, developer_user_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Seeds default roles, their permissions, and one admin user. Idempotent (checks before insert).
pub fn seed_users_roles(conn: &Connection) -> Result<(), String> {
    use crate::permissions;
    let admin_role_id = "role_admin";
    let operator_role_id = "role_operator";
    let now = chrono::Utc::now().to_rfc3339();

    let role_exists: i64 = conn
        .query_row("SELECT COUNT(*) FROM roles WHERE id = ?1", [admin_role_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if role_exists == 0 {
        conn.execute("INSERT INTO roles (id, name) VALUES (?1, ?2)", [admin_role_id, "admin"])
            .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO roles (id, name) VALUES (?1, ?2)", [operator_role_id, "operator"])
            .map_err(|e| e.to_string())?;

        for perm in permissions::admin_permissions() {
            conn.execute(
                "INSERT INTO role_permissions (role_id, permission) VALUES (?1, ?2)",
                [admin_role_id, perm],
            )
            .map_err(|e| e.to_string())?;
        }
        for perm in permissions::operator_permissions() {
            conn.execute(
                "INSERT INTO role_permissions (role_id, permission) VALUES (?1, ?2)",
                [operator_role_id, perm],
            )
            .map_err(|e| e.to_string())?;
        }

        let admin_user_id = "user_admin";
        use argon2::password_hash::{PasswordHasher, SaltString};
        use password_hash::Error as PasswordHashError;
        let salt = SaltString::from_b64("Y29jb19wYXJraW5nX3NhbHQ")
            .map_err(|e: PasswordHashError| e.to_string())?;
        let hash = argon2::Argon2::default()
            .hash_password(b"admin", &salt)
            .map_err(|e: PasswordHashError| e.to_string())?
            .to_string();
        conn.execute(
            "INSERT INTO users (id, username, password_hash, display_name, role_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![admin_user_id, "admin", hash, "Administrator", admin_role_id, now],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Open DB at path and return a connection pool. Caller must run_migrations on a connection.
pub fn open_pool(db_path: &std::path::Path) -> Result<r2d2::Pool<r2d2_sqlite::SqliteConnectionManager>, String> {
    let manager = r2d2_sqlite::SqliteConnectionManager::file(db_path);
    let pool = r2d2::Pool::new(manager).map_err(|e| e.to_string())?;
    let conn = pool.get().map_err(|e| e.to_string())?;
    run_migrations(&conn).map_err(|e| e.to_string())?;
    drop(conn);
    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_create_tables_and_persist_vehicle() {
        let dir = std::env::temp_dir().join("coco_parking_db_test");
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("test.db");
        let _ = std::fs::remove_file(&db_path);

        let pool = open_pool(&db_path).expect("open_pool");
        let conn = pool.get().expect("get conn");

        conn.execute(
            "INSERT INTO vehicles (id, ticket_code, plate, plate_upper, vehicle_type, observations, entry_time, exit_time, status, total_amount, debt, special_rate) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, NULL, 'active', NULL, NULL, NULL)",
            rusqlite::params![
                "test-id-1",
                "TK001",
                "ABC123",
                "ABC123",
                "car",
                chrono::Utc::now().to_rfc3339(),
            ],
        )
        .expect("insert");

        drop(conn);
        drop(pool);

        let pool2 = open_pool(&db_path).expect("open_pool again");
        let conn2 = pool2.get().expect("get conn");
        let count: i64 = conn2
            .query_row("SELECT COUNT(*) FROM vehicles WHERE id = 'test-id-1'", [], |row| row.get(0))
            .expect("count");
        assert_eq!(count, 1, "persisted vehicle survives reopen");
        let plate: String = conn2
            .query_row("SELECT plate FROM vehicles WHERE id = 'test-id-1'", [], |row| row.get(0))
            .expect("plate");
        assert_eq!(plate, "ABC123");

        std::fs::remove_file(&db_path).ok();
    }

    /// Integration test: full core flow entry → exit → caja at DB level.
    /// Ensures a registered vehicle, when processed as exit with payment, appears in treasury.
    #[test]
    fn integration_entry_exit_caja_flow() {
        let dir = std::env::temp_dir().join("coco_parking_e2e");
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("e2e.db");
        let _ = std::fs::remove_file(&db_path);

        let pool = open_pool(&db_path).expect("open_pool");
        let conn = pool.get().expect("get conn");

        let vehicle_id = crate::id_gen::generate_id(crate::id_gen::PREFIX_VEHICLE);
        let ticket_code = "TK-E2E-001";
        let plate = "E2EPLATE";
        let entry_time = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO vehicles (id, ticket_code, plate, plate_upper, vehicle_type, observations, entry_time, exit_time, status, total_amount, debt, special_rate) VALUES (?1, ?2, ?3, ?4, 'car', NULL, ?5, NULL, 'active', NULL, 0, NULL)",
            rusqlite::params![vehicle_id, ticket_code, plate, plate, entry_time],
        )
        .expect("insert vehicle");

        let exit_time = chrono::Utc::now().to_rfc3339();
        let total_amount = 50.0;
        let method = "cash";
        conn.execute(
            "UPDATE vehicles SET exit_time = ?1, status = 'completed', total_amount = ?2, debt = 0 WHERE id = ?3",
            rusqlite::params![exit_time, total_amount, vehicle_id],
        )
        .expect("update vehicle on exit");

        let tx_id = crate::id_gen::generate_id(crate::id_gen::PREFIX_TRANSACTION);
        conn.execute(
            "INSERT INTO transactions (id, vehicle_id, amount, method, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![tx_id, vehicle_id, total_amount, method, exit_time],
        )
        .expect("insert transaction");

        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let today_prefix = format!("{}%", today);
        let (total_transactions, cash, card, transfer): (i64, f64, f64, f64) = conn
            .query_row(
                r#"
                SELECT
                    COUNT(*) AS cnt,
                    COALESCE(SUM(CASE WHEN LOWER(method) = 'cash' THEN amount ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN LOWER(method) = 'card' THEN amount ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN LOWER(method) = 'transfer' THEN amount ELSE 0 END), 0)
                FROM transactions
                WHERE created_at LIKE ?1
                "#,
                rusqlite::params![&today_prefix],
                |row| Ok((row.get::<_, i64>(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .expect("treasury query");

        assert_eq!(total_transactions, 1, "one transaction today");
        assert_eq!(cash, 50.0, "cash amount matches payment");
        assert_eq!(card + transfer, 0.0, "no card/transfer");
        assert!((cash + card + transfer - total_amount).abs() < 0.01, "expected_cash matches");

        std::fs::remove_file(&db_path).ok();
    }
}
