use serde::Serialize;
use tauri::State;

use crate::permissions;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub name: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Permission {
    pub domain: String,
    pub actions: Vec<String>,
}

#[tauri::command]
pub fn roles_list_roles(state: State<AppState>) -> Result<Vec<String>, String> {
    state.check_permission(permissions::ROLES_USERS_READ)?;
    Ok(vec!["operator".to_string(), "admin".to_string()])
}

#[tauri::command]
pub fn roles_get_current_user(state: State<AppState>) -> Result<Option<User>, String> {
    state.check_permission(permissions::ROLES_USERS_READ)?;
    Ok(Some(User {
        id: "admin".to_string(),
        name: "Administrator".to_string(),
        role: "admin".to_string(),
    }))
}

#[tauri::command]
pub fn roles_get_permissions_for_user(
    state: State<AppState>,
    user_id: String,
) -> Result<Vec<Permission>, String> {
    state.check_permission(permissions::ROLES_PERMISSIONS_READ)?;
    let _ = user_id;
    Ok(Vec::new())
}

/// Returns current user permissions (for frontend UI visibility). No permission check.
#[tauri::command]
pub fn roles_get_my_permissions(state: State<AppState>) -> Result<Vec<String>, String> {
    Ok(state.current_user_permissions())
}
