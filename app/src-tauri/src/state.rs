use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::RwLock;

use crate::db::Pool;
use crate::permissions;

pub struct AppState {
    current_user_id: RwLock<Option<String>>,
    user_permissions: RwLock<HashMap<String, Vec<String>>>,
    pub db: Pool,
    /// Ruta absoluta del archivo SQLite (una sola fuente de datos para toda la app).
    pub db_path: PathBuf,
}

impl AppState {
    pub fn new(db: Pool, db_path: PathBuf) -> Self {
        let user_permissions = RwLock::new(HashMap::new());
        {
            let mut map = user_permissions.write().unwrap();
            let all = permissions::all_permissions()
                .into_iter()
                .map(String::from)
                .collect::<Vec<_>>();
            map.insert("admin".to_string(), all.clone());
            map.insert("developer".to_string(), all);
        }
        Self {
            current_user_id: RwLock::new(Some("admin".to_string())),
            user_permissions,
            db,
            db_path,
        }
    }

    /// Checks if current user has the permission. Denies if no user.
    pub fn check_permission(&self, permission: &str) -> Result<(), String> {
        let user_id = self
            .current_user_id
            .read()
            .unwrap()
            .clone()
            .unwrap_or_else(|| "admin".to_string());
        let map = self.user_permissions.read().unwrap();
        let perms = map.get(&user_id).ok_or_else(|| {
            format!("User has no permissions assigned: {}", user_id)
        })?;
        if perms.iter().any(|p| p == permission) {
            Ok(())
        } else {
            Err(format!(
                "Permission denied: '{}' required",
                permission
            ))
        }
    }

    pub fn current_user_permissions(&self) -> Vec<String> {
        let user_id = self
            .current_user_id
            .read()
            .unwrap()
            .clone()
            .unwrap_or_else(|| "admin".to_string());
        let map = self.user_permissions.read().unwrap();
        map.get(&user_id)
            .cloned()
            .unwrap_or_default()
    }

    pub fn set_current_user(&self, user_id: Option<String>) {
        *self.current_user_id.write().unwrap() = user_id;
    }

    pub fn get_current_user_id(&self) -> Option<String> {
        self.current_user_id.read().unwrap().clone()
    }
}

// Default not implemented: AppState requires a DB pool (created in setup).
