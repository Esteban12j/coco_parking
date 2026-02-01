use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::id_gen::{generate_id, PREFIX_USER};
use crate::permissions;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub role_id: String,
    pub role_name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Role {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Permission {
    pub domain: String,
    pub actions: Vec<String>,
}

pub fn load_permissions_for_user(conn: &Connection, user_id: &str) -> Result<Vec<String>, String> {
    let role_id: String = conn
        .query_row(
            "SELECT role_id FROM users WHERE id = ?1",
            [user_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT permission FROM role_permissions WHERE role_id = ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&role_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    let mut perms = Vec::new();
    for row in rows {
        perms.push(row.map_err(|e| e.to_string())?);
    }
    Ok(perms)
}

pub(crate) fn load_user_into_state(state: &AppState, user_id: &str) -> Result<(), String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let perms = load_permissions_for_user(&conn, user_id)?;
    state.set_current_user(Some(user_id.to_string()));
    state.set_current_user_permissions(perms);
    Ok(())
}

#[tauri::command]
pub fn auth_login(
    state: State<AppState>,
    username: String,
    password: String,
) -> Result<User, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let username = username.trim();
    if username.is_empty() {
        return Err("Username is required".to_string());
    }
    let row: (String, String, String, String, String) = conn
        .query_row(
            "SELECT u.id, u.username, u.display_name, u.role_id, u.password_hash FROM users u WHERE LOWER(TRIM(u.username)) = LOWER(?1)",
            [username],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .map_err(|_| "Invalid username or password".to_string())?;
    let (user_id, uname, display_name_val, role_id, password_hash) = row;
    use argon2::password_hash::PasswordVerifier;
    let parsed = argon2::password_hash::PasswordHash::new(&password_hash)
        .map_err(|_| "Invalid username or password".to_string())?;
    if argon2::Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_err()
    {
        return Err("Invalid username or password".to_string());
    }
    load_user_into_state(&*state, &user_id)?;
    let role_name: String = conn
        .query_row("SELECT name FROM roles WHERE id = ?1", [&role_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let created_at: String = conn
        .query_row("SELECT created_at FROM users WHERE id = ?1", [&user_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(User {
        id: user_id,
        username: uname,
        display_name: display_name_val,
        role_id,
        role_name,
        created_at,
    })
}

#[tauri::command]
pub fn auth_logout(state: State<AppState>) -> Result<(), String> {
    state.set_current_user(None);
    state.set_current_user_permissions(Vec::new());
    Ok(())
}

#[tauri::command]
pub fn auth_get_session(state: State<AppState>) -> Result<Option<User>, String> {
    let user_id = match state.get_current_user_id() {
        Some(id) => id,
        None => return Ok(None),
    };
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let row: (String, String, String, String, String) = conn
        .query_row(
            "SELECT u.id, u.username, u.display_name, u.role_id, u.created_at FROM users u WHERE u.id = ?1",
            [&user_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .map_err(|e| e.to_string())?;
    let role_name: String = conn
        .query_row("SELECT name FROM roles WHERE id = ?1", [&row.3], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(Some(User {
        id: row.0.clone(),
        username: row.1,
        display_name: row.2,
        role_id: row.3,
        role_name,
        created_at: row.4,
    }))
}

#[tauri::command]
pub fn roles_list_roles(state: State<AppState>) -> Result<Vec<Role>, String> {
    state.check_permission(permissions::ROLES_USERS_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name FROM roles ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok(Role { id: r.get(0)?, name: r.get(1)? }))
        .map_err(|e| e.to_string())?;
    let mut roles = Vec::new();
    for row in rows {
        roles.push(row.map_err(|e| e.to_string())?);
    }
    Ok(roles)
}

#[tauri::command]
pub fn roles_list_users(state: State<AppState>) -> Result<Vec<User>, String> {
    state.check_permission(permissions::ROLES_USERS_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT u.id, u.username, u.display_name, u.role_id, u.created_at, r.name FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.username",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(User {
                id: r.get(0)?,
                username: r.get(1)?,
                display_name: r.get(2)?,
                role_id: r.get(3)?,
                role_name: r.get(5)?,
                created_at: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut users = Vec::new();
    for row in rows {
        users.push(row.map_err(|e| e.to_string())?);
    }
    Ok(users)
}

#[tauri::command]
pub fn roles_create_user(
    state: State<AppState>,
    username: String,
    password: String,
    display_name: String,
    role_id: String,
) -> Result<User, String> {
    state.check_permission(permissions::ROLES_USERS_CREATE)?;
    let username = username.trim().to_string();
    let display_name_trimmed = display_name.trim();
    let display_name_owned = if display_name_trimmed.is_empty() {
        username.clone()
    } else {
        display_name_trimmed.to_string()
    };
    if username.is_empty() {
        return Err("Username is required".to_string());
    }
    if password.len() < 4 {
        return Err("Password must be at least 4 characters".to_string());
    }
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM users WHERE LOWER(username) = LOWER(?1)",
            [&username],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists > 0 {
        return Err("Username already exists".to_string());
    }
    let role_exists: i64 = conn
        .query_row("SELECT COUNT(*) FROM roles WHERE id = ?1", [&role_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if role_exists == 0 {
        return Err("Role not found".to_string());
    }
    let id = generate_id(PREFIX_USER);
    use argon2::password_hash::{PasswordHasher, SaltString};
    use password_hash::Error as PasswordHashError;
    let salt = SaltString::from_b64("Y29jb19wYXJraW5nX3NhbHQ")
        .map_err(|e: PasswordHashError| e.to_string())?;
    let hash = argon2::Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e: PasswordHashError| e.to_string())?
        .to_string();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO users (id, username, password_hash, display_name, role_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![id, username, hash, display_name_owned, role_id, now],
    )
    .map_err(|e| e.to_string())?;
    let role_name: String = conn
        .query_row("SELECT name FROM roles WHERE id = ?1", [&role_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(User {
        id: id.clone(),
        username,
        display_name: display_name_owned,
        role_id,
        role_name,
        created_at: now,
    })
}

#[tauri::command]
pub fn roles_update_user(
    state: State<AppState>,
    user_id: String,
    display_name: Option<String>,
    role_id: Option<String>,
) -> Result<User, String> {
    state.check_permission(permissions::ROLES_USERS_MODIFY)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    if role_id.as_ref().is_some() {
        let rid = role_id.as_deref().unwrap();
        let role_exists: i64 = conn
            .query_row("SELECT COUNT(*) FROM roles WHERE id = ?1", [rid], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if role_exists == 0 {
            return Err("Role not found".to_string());
        }
    }
    if let Some(ref name) = display_name {
        let name = name.trim();
        if !name.is_empty() {
            conn.execute("UPDATE users SET display_name = ?1 WHERE id = ?2", [name, &user_id])
                .map_err(|e| e.to_string())?;
        }
    }
    if let Some(ref rid) = role_id {
        conn.execute("UPDATE users SET role_id = ?1 WHERE id = ?2", [rid, &user_id])
            .map_err(|e| e.to_string())?;
    }
    let row: (String, String, String, String, String) = conn
        .query_row(
            "SELECT u.id, u.username, u.display_name, u.role_id, u.created_at FROM users u WHERE u.id = ?1",
            [&user_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .map_err(|_| "User not found".to_string())?;
    let role_name: String = conn
        .query_row("SELECT name FROM roles WHERE id = ?1", [&row.3], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(User {
        id: row.0,
        username: row.1,
        display_name: row.2,
        role_id: row.3,
        role_name,
        created_at: row.4,
    })
}

#[tauri::command]
pub fn roles_set_password(
    state: State<AppState>,
    user_id: String,
    new_password: String,
) -> Result<(), String> {
    state.check_permission(permissions::ROLES_USERS_MODIFY)?;
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
        .execute("UPDATE users SET password_hash = ?1 WHERE id = ?2", [&hash, &user_id])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("User not found".to_string());
    }
    Ok(())
}
#[tauri::command]
pub fn roles_delete_user(state: State<AppState>, user_id: String) -> Result<(), String> {
    state.check_permission(permissions::ROLES_USERS_DELETE)?;
    let current = state.get_current_user_id();
    if current.as_deref() == Some(user_id.as_str()) {
        return Err("Cannot delete the current user".to_string());
    }
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let n = conn.execute("DELETE FROM users WHERE id = ?1", [&user_id]).map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("User not found".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn roles_get_current_user(state: State<AppState>) -> Result<Option<User>, String> {
    state.check_permission(permissions::ROLES_USERS_READ)?;
    auth_get_session(state)
}

#[tauri::command]
pub fn roles_get_permissions_for_user(
    state: State<AppState>,
    user_id: String,
) -> Result<Vec<Permission>, String> {
    state.check_permission(permissions::ROLES_PERMISSIONS_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let perms = load_permissions_for_user(&conn, &user_id)?;
    let mut by_domain: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    for p in perms {
        if let Some((domain, action)) = p.split_once(':') {
            let action_key = if let Some((_, action_name)) = action.split_once(':') {
                action_name.to_string()
            } else {
                action.to_string()
            };
            by_domain
                .entry(domain.to_string())
                .or_default()
                .push(action_key);
        }
    }
    let out: Vec<Permission> = by_domain
        .into_iter()
        .map(|(domain, actions)| Permission { domain, actions })
        .collect();
    Ok(out)
}

#[tauri::command]
pub fn roles_get_role_permissions(
    state: State<AppState>,
    role_id: String,
) -> Result<Vec<String>, String> {
    state.check_permission(permissions::ROLES_PERMISSIONS_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT permission FROM role_permissions WHERE role_id = ?1 ORDER BY permission")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&role_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    let mut perms = Vec::new();
    for row in rows {
        perms.push(row.map_err(|e| e.to_string())?);
    }
    Ok(perms)
}

#[tauri::command]
pub fn roles_update_role_permissions(
    state: State<AppState>,
    role_id: String,
    permissions: Vec<String>,
) -> Result<(), String> {
    state.check_permission(permissions::ROLES_PERMISSIONS_MODIFY)?;
    let all: Vec<&str> = permissions::all_permissions();
    for p in &permissions {
        if !all.contains(&p.as_str()) {
            return Err(format!("Unknown permission: {}", p));
        }
    }
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let role_exists: i64 = conn
        .query_row("SELECT COUNT(*) FROM roles WHERE id = ?1", [&role_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if role_exists == 0 {
        return Err("Role not found".to_string());
    }
    conn.execute("DELETE FROM role_permissions WHERE role_id = ?1", [&role_id])
        .map_err(|e| e.to_string())?;
    for p in permissions {
        conn.execute("INSERT INTO role_permissions (role_id, permission) VALUES (?1, ?2)", [&role_id, &p])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn roles_get_my_permissions(state: State<AppState>) -> Result<Vec<String>, String> {
    Ok(state.current_user_permissions())
}
