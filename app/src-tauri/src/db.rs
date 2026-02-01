//! SQLite persistence for vehicles, transactions, and derived data.
//! Schema and migrations run on first connection.

use rusqlite::Connection;

/// Pool is stored in AppState as Arc<r2d2::Pool<...>> (see lib.rs setup).
pub type Pool = std::sync::Arc<r2d2::Pool<r2d2_sqlite::SqliteConnectionManager>>;

#[allow(dead_code)]
const SCHEMA_VERSION: i64 = 9;

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

    sync_role_permissions_from_code(conn)?;
    Ok(())
}

fn sync_role_permissions_from_code(conn: &Connection) -> Result<(), String> {
    use crate::permissions;
    let admin_role_id = "role_admin";
    for perm in permissions::all_permissions() {
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

        for perm in permissions::all_permissions() {
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
}
