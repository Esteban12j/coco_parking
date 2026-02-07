use serde::Serialize;
use tauri::State;

use crate::state::AppState;
use rusqlite::Connection;

const CONFIG_KEY_FIRST_RUN_COMPLETED: &str = "first_run_completed";

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
pub struct FirstRunStatus {
    pub completed: bool,
}

#[tauri::command]
pub fn first_run_get_status(state: State<AppState>) -> Result<FirstRunStatus, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let value = get_config_value(&conn, CONFIG_KEY_FIRST_RUN_COMPLETED)?;
    let completed = value.as_deref() == Some("1");
    Ok(FirstRunStatus { completed })
}

#[tauri::command]
pub fn first_run_set_completed(state: State<AppState>) -> Result<(), String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    set_config_value(&conn, CONFIG_KEY_FIRST_RUN_COMPLETED, "1")?;
    Ok(())
}
