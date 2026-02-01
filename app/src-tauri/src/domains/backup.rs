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

#[tauri::command]
pub fn backup_create(state: State<AppState>) -> Result<String, String> {
    state.check_permission(permissions::BACKUP_CREATE)?;
    Ok("Backup created (placeholder)".to_string())
}

#[tauri::command]
pub fn backup_restore(state: State<AppState>, path: String) -> Result<(), String> {
    state.check_permission(permissions::BACKUP_RESTORE)?;
    let _ = path;
    Ok(())
}

#[tauri::command]
pub fn backup_list(state: State<AppState>) -> Result<Vec<BackupEntry>, String> {
    state.check_permission(permissions::BACKUP_LIST_READ)?;
    Ok(Vec::new())
}
