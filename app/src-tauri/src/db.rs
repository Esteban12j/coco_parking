//! SQLite persistence for vehicles, transactions, and derived data.
//! Schema and migrations run on first connection.

use rusqlite::Connection;

/// Pool is stored in AppState as Arc<r2d2::Pool<...>> (see lib.rs setup).
pub type Pool = std::sync::Arc<r2d2::Pool<r2d2_sqlite::SqliteConnectionManager>>;

#[allow(dead_code)]
const SCHEMA_VERSION: i64 = 4;

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
            "INSERT INTO vehicles (id, ticket_code, plate, vehicle_type, observations, entry_time, exit_time, status, total_amount, debt, special_rate) VALUES (?1, ?2, ?3, ?4, NULL, ?5, NULL, 'active', NULL, NULL, NULL)",
            rusqlite::params![
                "test-id-1",
                "TK001",
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
