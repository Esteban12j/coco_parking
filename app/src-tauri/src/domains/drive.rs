use serde::Serialize;
use tauri::State;

use crate::permissions;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveStatus {
    pub connected: bool,
    pub last_sync: Option<String>,
    pub pending_upload: bool,
}

#[tauri::command]
pub fn drive_get_status(state: State<AppState>) -> Result<DriveStatus, String> {
    state.check_permission(permissions::DRIVE_STATUS_READ)?;
    Ok(DriveStatus {
        connected: false,
        last_sync: None,
        pending_upload: false,
    })
}

#[tauri::command]
pub fn drive_sync_now(state: State<AppState>) -> Result<(), String> {
    state.check_permission(permissions::DRIVE_SYNC)?;
    Ok(())
}

#[tauri::command]
pub fn drive_set_folder_id(state: State<AppState>, folder_id: String) -> Result<(), String> {
    state.check_permission(permissions::DRIVE_CONFIG_MODIFY)?;
    let _ = folder_id;
    Ok(())
}
