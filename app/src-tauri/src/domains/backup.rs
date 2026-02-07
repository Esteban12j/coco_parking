use std::path::Path;
use std::time::Duration;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::permissions;
use crate::state::AppState;

const CONFIG_KEY_INTERVAL_HOURS: &str = "backup_interval_hours";
const CONFIG_KEY_OUTPUT_DIR: &str = "backup_output_directory";
const CONFIG_KEY_MAX_RETAINED: &str = "backup_max_retained";
const DEFAULT_INTERVAL_HOURS: u32 = 12;
const DEFAULT_MAX_RETAINED: u32 = 7;

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

fn get_config_value(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare("SELECT value FROM drive_config WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([key]).map_err(|e| e.to_string())?;
    let row = rows.next().map_err(|e| e.to_string())?;
    Ok(row.and_then(|r| r.get::<_, String>(0).ok()))
}

fn set_config_value(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO drive_config (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
        [key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupConfig {
    pub interval_hours: u32,
    pub output_directory: String,
    pub max_retained: u32,
}

#[tauri::command]
pub fn backup_config_get(app: AppHandle, state: State<AppState>) -> Result<BackupConfig, String> {
    state.check_permission(permissions::BACKUP_CONFIG_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let interval_hours: u32 = get_config_value(&conn, CONFIG_KEY_INTERVAL_HOURS)?
        .and_then(|v| v.parse().ok())
        .unwrap_or(DEFAULT_INTERVAL_HOURS);
    let max_retained: u32 = get_config_value(&conn, CONFIG_KEY_MAX_RETAINED)?
        .and_then(|v| v.parse().ok())
        .unwrap_or(DEFAULT_MAX_RETAINED);
    let output_directory = get_config_value(&conn, CONFIG_KEY_OUTPUT_DIR)?
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| {
            app.path()
                .app_data_dir()
                .map(|p| p.join("backups").to_string_lossy().into_owned())
                .unwrap_or_else(|_| "".to_string())
        });
    Ok(BackupConfig {
        interval_hours,
        output_directory,
        max_retained,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupConfigUpdate {
    pub interval_hours: Option<u32>,
    pub output_directory: Option<String>,
    pub max_retained: Option<u32>,
}

#[tauri::command]
pub fn backup_config_set(
    app: AppHandle,
    state: State<AppState>,
    payload: BackupConfigUpdate,
) -> Result<BackupConfig, String> {
    state.check_permission(permissions::BACKUP_CONFIG_MODIFY)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    if let Some(h) = payload.interval_hours {
        if h == 0 {
            return Err("interval_hours must be at least 1".to_string());
        }
        set_config_value(&conn, CONFIG_KEY_INTERVAL_HOURS, &h.to_string())?;
    }
    if let Some(ref dir) = payload.output_directory {
        set_config_value(&conn, CONFIG_KEY_OUTPUT_DIR, dir.trim())?;
    }
    if let Some(n) = payload.max_retained {
        if n == 0 {
            return Err("max_retained must be at least 1".to_string());
        }
        set_config_value(&conn, CONFIG_KEY_MAX_RETAINED, &n.to_string())?;
    }
    backup_config_get(app, state)
}
