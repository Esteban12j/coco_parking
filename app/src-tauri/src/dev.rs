use serde::Serialize;
use tauri::State;

use crate::permissions;
use crate::state::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbSnapshot {
    pub vehicles_count: u32,
    pub transactions_count: u32,
    pub last_vehicles: Vec<VehicleRow>,
    pub last_transactions: Vec<TransactionRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VehicleRow {
    pub id: String,
    pub ticket_code: String,
    pub plate: String,
    pub status: String,
    pub total_amount: Option<f64>,
    pub entry_time: String,
    pub exit_time: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionRow {
    pub id: String,
    pub vehicle_id: String,
    pub amount: f64,
    pub method: String,
    pub created_at: String,
}

fn dev_mode_allowed() -> bool {
    cfg!(debug_assertions) || std::env::var("COCO_DEV").is_ok()
}

fn require_dev_mode() -> Result<(), String> {
    if dev_mode_allowed() {
        Ok(())
    } else {
        Err("Only available in development mode (debug build or COCO_DEV=1)".to_string())
    }
}

fn require_dev_console(state: &AppState) -> Result<(), String> {
    require_dev_mode()?;
    state.check_permission(permissions::DEV_CONSOLE_ACCESS)?;
    Ok(())
}

/// Login as "developer" (tries DB user "admin" first, then sets dev full access). Dev mode + dev:console:access only.
#[tauri::command]
pub fn dev_login_as_developer(state: State<AppState>) -> Result<String, String> {
    require_dev_console(&state)?;
    if crate::domains::roles::load_permissions_for_user(
        &*state.db.get().map_err(|e| e.to_string())?,
        "user_admin",
    )
    .is_ok()
    {
        let _ = crate::domains::roles::load_user_into_state(&*state, "user_admin");
        return Ok("Logged in as admin (from DB)".to_string());
    }
    state.set_current_user(Some("developer".to_string()));
    let all = crate::permissions::all_permissions()
        .into_iter()
        .map(String::from)
        .collect::<Vec<_>>();
    state.set_current_user_permissions(all);
    Ok("Logged in as developer (in-memory)".to_string())
}

/// Returns current user id (for dev console).
#[tauri::command]
pub fn dev_get_current_user_id(state: State<AppState>) -> Result<String, String> {
    require_dev_console(&state)?;
    Ok(state
        .get_current_user_id()
        .unwrap_or_else(|| "admin".to_string()))
}

/// Sets current user (for testing). Loads from DB if user exists. Dev mode + dev:console:access only.
#[tauri::command]
pub fn dev_set_current_user(state: State<AppState>, user_id: String) -> Result<String, String> {
    require_dev_console(&state)?;
    if crate::domains::roles::load_user_into_state(&*state, &user_id).is_ok() {
        return Ok(format!("Current user: {} (from DB)", user_id));
    }
    state.set_current_user(Some(user_id.clone()));
    state.set_current_user_permissions(Vec::new());
    Ok(format!("Current user: {} (no DB permissions)", user_id))
}

/// Dev-only: return snapshot of DB (vehicles + transactions). Requires dev:console:access.
#[tauri::command]
pub fn dev_get_db_snapshot(state: State<AppState>) -> Result<DbSnapshot, String> {
    require_dev_console(&state)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let vehicles_count: u32 = conn
        .query_row("SELECT COUNT(*) FROM vehicles", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let transactions_count: u32 = conn
        .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let mut last_vehicles = Vec::new();
    let mut stmt = conn
        .prepare(
            "SELECT id, ticket_code, plate, status, total_amount, entry_time, exit_time FROM vehicles ORDER BY entry_time DESC LIMIT 20",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(VehicleRow {
                id: r.get(0)?,
                ticket_code: r.get(1)?,
                plate: r.get(2)?,
                status: r.get(3)?,
                total_amount: r.get(4)?,
                entry_time: r.get(5)?,
                exit_time: r.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    for row in rows {
        last_vehicles.push(row.map_err(|e| e.to_string())?);
    }

    let mut last_transactions = Vec::new();
    let mut stmt = conn
        .prepare(
            "SELECT id, vehicle_id, amount, method, created_at FROM transactions ORDER BY created_at DESC LIMIT 20",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(TransactionRow {
                id: r.get(0)?,
                vehicle_id: r.get(1)?,
                amount: r.get(2)?,
                method: r.get(3)?,
                created_at: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    for row in rows {
        last_transactions.push(row.map_err(|e| e.to_string())?);
    }

    Ok(DbSnapshot {
        vehicles_count,
        transactions_count,
        last_vehicles,
        last_transactions,
    })
}

/// Dev-only: ruta del archivo SQLite. Requires dev:console:access.
#[tauri::command]
pub fn dev_get_db_path(state: State<AppState>) -> Result<String, String> {
    require_dev_console(&state)?;
    Ok(state.db_path.to_string_lossy().into_owned())
}

/// Dev-only: clears all data tables and re-seeds admin/roles so you can test restore. Requires dev:console:access.
#[tauri::command]
pub fn dev_clear_database(state: State<AppState>) -> Result<String, String> {
    require_dev_console(&state)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    conn.execute("PRAGMA foreign_keys = OFF", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM transactions", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM vehicles", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM shift_closures", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM role_permissions", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM users", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM roles", []).map_err(|e| e.to_string())?;
    conn.execute("PRAGMA foreign_keys = ON", [])
        .map_err(|e| e.to_string())?;
    crate::db::seed_users_roles(&conn).map_err(|e| e.to_string())?;
    crate::db::seed_developer_role_and_user_public(&conn).map_err(|e| e.to_string())?;
    Ok("Database cleared. Admin user (admin/admin) re-seeded. Use Backup > Restore to load a backup.".to_string())
}

/// Developer-only: reset another user's password. Requires dev mode + dev:console:access (developer login).
#[tauri::command]
pub fn dev_reset_user_password(
    state: State<AppState>,
    user_id: String,
    new_password: String,
) -> Result<(), String> {
    require_dev_console(&state)?;
    let user_id = user_id.trim();
    if user_id.is_empty() {
        return Err("User ID is required".to_string());
    }
    if new_password.len() < 4 {
        return Err("Password must be at least 4 characters".to_string());
    }
    use argon2::password_hash::{PasswordHasher, SaltString};
    use password_hash::Error as PasswordHashError;
    let salt = SaltString::from_b64("Y29jb19wYXJraW5nX3NhbHQ")
        .map_err(|e: PasswordHashError| e.to_string())?;
    let hash = argon2::Argon2::default()
        .hash_password(new_password.as_bytes(), &salt)
        .map_err(|e: PasswordHashError| e.to_string())?
        .to_string();
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let n = conn
        .execute("UPDATE users SET password_hash = ?1 WHERE id = ?2", [&hash, user_id])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("User not found".to_string());
    }
    Ok(())
}

/// List of invokable command names (for dev console). Requires dev:console:access.
#[tauri::command]
pub fn dev_list_commands(state: State<AppState>) -> Result<Vec<String>, String> {
    require_dev_console(&*state)?;
    Ok(vec![
        "auth_login".to_string(),
        "auth_logout".to_string(),
        "auth_get_session".to_string(),
        "dev_get_db_path".to_string(),
        "dev_get_db_snapshot".to_string(),
        "dev_clear_database".to_string(),
        "caja_get_debug".to_string(),
        "vehiculos_list_vehicles".to_string(),
        "vehiculos_list_vehicles_by_date".to_string(),
        "vehiculos_register_entry".to_string(),
        "vehiculos_process_exit".to_string(),
        "vehiculos_find_by_plate".to_string(),
        "vehiculos_find_by_ticket".to_string(),
        "caja_get_treasury".to_string(),
        "caja_close_shift".to_string(),
        "metricas_get_daily".to_string(),
        "roles_list_roles".to_string(),
        "roles_list_users".to_string(),
        "roles_create_user".to_string(),
        "roles_update_user".to_string(),
        "roles_set_password".to_string(),
        "dev_reset_user_password".to_string(),
        "roles_delete_user".to_string(),
        "roles_get_current_user".to_string(),
        "roles_get_my_permissions".to_string(),
        "roles_get_permissions_for_user".to_string(),
        "roles_get_role_permissions".to_string(),
        "roles_update_role_permissions".to_string(),
        "backup_create".to_string(),
        "backup_restore".to_string(),
        "backup_list".to_string(),
    ])
}
