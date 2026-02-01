use std::path::PathBuf;
use std::sync::RwLock;

use crate::db::Pool;

pub struct AppState {
    current_user_id: RwLock<Option<String>>,
    current_user_permissions: RwLock<Vec<String>>,
    pub db: Pool,
    pub db_path: PathBuf,
}

impl AppState {
    pub fn new(db: Pool, db_path: PathBuf) -> Self {
        Self {
            current_user_id: RwLock::new(None),
            current_user_permissions: RwLock::new(Vec::new()),
            db,
            db_path,
        }
    }

    pub fn check_permission(&self, permission: &str) -> Result<(), String> {
        let perms = self.current_user_permissions.read().unwrap();
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
        self.current_user_permissions.read().unwrap().clone()
    }

    pub fn set_current_user(&self, user_id: Option<String>) {
        *self.current_user_id.write().unwrap() = user_id;
    }

    pub fn set_current_user_permissions(&self, permissions: Vec<String>) {
        *self.current_user_permissions.write().unwrap() = permissions;
    }

    pub fn get_current_user_id(&self) -> Option<String> {
        self.current_user_id.read().unwrap().clone()
    }
}

// Default not implemented: AppState requires a DB pool (created in setup).
