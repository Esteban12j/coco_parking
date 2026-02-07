use serde::Serialize;
use tauri::State;

use crate::permissions;
use crate::state::AppState;
use rusqlite::Connection;

const CONFIG_KEY_FIRST_RUN_COMPLETED: &str = "first_run_completed";
const ADMIN_USER_ID: &str = "user_admin";

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

#[tauri::command]
pub fn first_run_change_admin_password(
    state: State<AppState>,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    if new_password.len() < 4 {
        return Err("Password must be at least 4 characters".to_string());
    }
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let password_hash: String = conn
        .query_row(
            "SELECT password_hash FROM users WHERE id = ?1",
            [ADMIN_USER_ID],
            |r| r.get(0),
        )
        .map_err(|_| "Admin user not found".to_string())?;
    use argon2::password_hash::PasswordVerifier;
    let parsed = argon2::password_hash::PasswordHash::new(&password_hash)
        .map_err(|_| "Invalid current password".to_string())?;
    if argon2::Argon2::default()
        .verify_password(current_password.as_bytes(), &parsed)
        .is_err()
    {
        return Err("Invalid current password".to_string());
    }
    use argon2::password_hash::{PasswordHasher, SaltString};
    use password_hash::Error as PasswordHashError;
    let salt = SaltString::from_b64("Y29jb19wYXJraW5nX3NhbHQ")
        .map_err(|e: PasswordHashError| e.to_string())?;
    let hash = argon2::Argon2::default()
        .hash_password(new_password.as_bytes(), &salt)
        .map_err(|e: PasswordHashError| e.to_string())?
        .to_string();
    let n = conn
        .execute(
            "UPDATE users SET password_hash = ?1 WHERE id = ?2",
            [&hash, ADMIN_USER_ID],
        )
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("Admin user not found".to_string());
    }
    Ok(())
}

fn resolve_target_user_id(conn: &rusqlite::Connection, input: &str) -> Result<String, String> {
    let input = input.trim();
    if input.is_empty() {
        return Err("Target user is required".to_string());
    }
    let lower = input.to_lowercase();
    if lower == "admin" {
        return Ok(permissions::ADMIN_USER_ID.to_string());
    }
    if lower == "developer" {
        return Ok(permissions::DEVELOPER_USER_ID.to_string());
    }
    let resolved: Option<String> = conn
        .query_row(
            "SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(?1)",
            [input],
            |r| r.get(0),
        )
        .ok();
    match resolved {
        Some(id) => Ok(id),
        None => {
            let exists: i64 = conn
                .query_row("SELECT COUNT(*) FROM users WHERE id = ?1", [input], |r| r.get(0))
                .map_err(|e| e.to_string())?;
            if exists > 0 {
                Ok(input.to_string())
            } else {
                Err("User not found".to_string())
            }
        }
    }
}

#[tauri::command]
pub fn reset_password_with_dev(
    state: State<AppState>,
    developer_password: String,
    target_user: String,
    new_password: String,
) -> Result<(), String> {
    if new_password.len() < 4 {
        return Err("Password must be at least 4 characters".to_string());
    }
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let dev_user_id = permissions::DEVELOPER_USER_ID;
    let password_hash: String = conn
        .query_row(
            "SELECT password_hash FROM users WHERE id = ?1",
            [dev_user_id],
            |r| r.get(0),
        )
        .map_err(|_| "Invalid developer password".to_string())?;
    if password_hash.is_empty() {
        return Err("Invalid developer password".to_string());
    }
    let developer_password_trimmed = developer_password.trim();
    use argon2::password_hash::PasswordVerifier;
    let parsed = argon2::password_hash::PasswordHash::new(&password_hash)
        .map_err(|_| "Invalid developer password".to_string())?;
    if argon2::Argon2::default()
        .verify_password(developer_password_trimmed.as_bytes(), &parsed)
        .is_err()
    {
        return Err("Invalid developer password".to_string());
    }
    let target_user_id = resolve_target_user_id(&*conn, &target_user)?;
    use argon2::password_hash::{PasswordHasher, SaltString};
    use password_hash::Error as PasswordHashError;
    let salt = SaltString::from_b64("Y29jb19wYXJraW5nX3NhbHQ")
        .map_err(|e: PasswordHashError| e.to_string())?;
    let hash = argon2::Argon2::default()
        .hash_password(new_password.as_bytes(), &salt)
        .map_err(|e: PasswordHashError| e.to_string())?
        .to_string();
    let n = conn
        .execute(
            "UPDATE users SET password_hash = ?1 WHERE id = ?2",
            [&hash, &target_user_id],
        )
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("User not found".to_string());
    }
    Ok(())
}
