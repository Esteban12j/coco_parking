use std::path::Path;
use std::time::Duration;
use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::permissions;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub path: String,
    pub created_at: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupResult {
    pub path: String,
    pub size_bytes: u64,
}

pub(crate) fn run_backup_to_path(source_conn: &Connection, dest_path: &Path) -> Result<u64, String> {
    let mut dest = Connection::open(dest_path).map_err(|e| e.to_string())?;
    let backup =
        rusqlite::backup::Backup::new(source_conn, &mut dest).map_err(|e| e.to_string())?;
    backup
        .run_to_completion(100, Duration::ZERO, None)
        .map_err(|e| e.to_string())?;
    drop(backup);
    drop(dest);
    let meta = std::fs::metadata(dest_path).map_err(|e| e.to_string())?;
    Ok(meta.len())
}

const DATA_TABLES: &[&str] = &[
    "schema_version",
    "roles",
    "role_permissions",
    "users",
    "vehicles",
    "transactions",
    "shift_closures",
    "barcodes",
];

fn run_restore_from_path(main_conn: &Connection, backup_path: &Path) -> Result<(), String> {
    main_conn
        .execute("PRAGMA foreign_keys = OFF", [])
        .map_err(|e| e.to_string())?;
    let path_str = backup_path.to_string_lossy().to_string();
    main_conn
        .execute("ATTACH DATABASE ?1 AS backup_db", rusqlite::params![path_str])
        .map_err(|e| e.to_string())?;
    for table in DATA_TABLES {
        let exists: Option<i64> = main_conn
            .query_row(
                "SELECT 1 FROM backup_db.sqlite_master WHERE type='table' AND name=?1",
                [table],
                |r| r.get(0),
            )
            .ok();
        if exists.is_none() {
            continue;
        }
        main_conn
            .execute(&format!("DELETE FROM main.{}", table), [])
            .map_err(|e| e.to_string())?;
        main_conn
            .execute(
                &format!("INSERT INTO main.{} SELECT * FROM backup_db.{}", table, table),
                [],
            )
            .map_err(|e| e.to_string())?;
    }
    main_conn
        .execute("DETACH DATABASE backup_db", [])
        .map_err(|e| e.to_string())?;
    main_conn
        .execute("PRAGMA foreign_keys = ON", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn backup_create(state: State<AppState>, path: String) -> Result<BackupResult, String> {
    state.check_permission(permissions::BACKUP_CREATE)?;
    let path_buf = Path::new(&path);
    if path_buf.parent().map_or(true, |p| !p.exists()) {
        return Err("Parent directory does not exist".to_string());
    }
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let size = run_backup_to_path(&conn, path_buf)?;
    Ok(BackupResult {
        path: path.to_string(),
        size_bytes: size,
    })
}

#[tauri::command]
pub fn backup_restore(state: State<AppState>, path: String) -> Result<(), String> {
    state.check_permission(permissions::BACKUP_RESTORE)?;
    let path_buf = Path::new(&path);
    if !path_buf.exists() {
        return Err("Backup file does not exist".to_string());
    }
    let conn = state.db.get().map_err(|e| e.to_string())?;
    run_restore_from_path(&conn, path_buf)
}

#[tauri::command]
pub fn backup_list(state: State<AppState>) -> Result<Vec<BackupEntry>, String> {
    state.check_permission(permissions::BACKUP_LIST_READ)?;
    Ok(Vec::new())
}
