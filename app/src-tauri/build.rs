fn main() {
    tauri_build::build();
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let manifest_path = std::path::Path::new(&manifest_dir);
        let env_path = manifest_path.join(".env");
        if env_path.exists() {
            let _ = dotenvy::from_path(&env_path);
        }
        if let Some(parent) = manifest_path.parent() {
            let parent_env = parent.join(".env");
            if parent_env.exists() {
                let _ = dotenvy::from_path(&parent_env);
            }
            if let Some(grandparent) = parent.parent() {
                let root_env = grandparent.join(".env");
                if root_env.exists() {
                    let _ = dotenvy::from_path(&root_env);
                }
            }
        }
    }
    let out_dir = std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let hash_file = out_dir.join("developer_password_hash.txt");
    let env_password = std::env::var("COCO_DEV_PASSWORD").unwrap_or_default();
    let env_password = env_password.trim();
    const DEFAULT_DEV_PASSWORD: &str = "coco.dev.reset";
    let password = if env_password.is_empty() {
        println!("cargo:warning=COCO_DEV_PASSWORD not set; using default developer password.");
        DEFAULT_DEV_PASSWORD
    } else {
        println!("cargo:warning=COCO_DEV_PASSWORD set; embedding custom developer password hash.");
        env_password
    };
    use argon2::password_hash::{PasswordHasher, SaltString};
    use password_hash::Error as PasswordHashError;
    let salt = SaltString::from_b64("Y29jb19wYXJraW5nX3NhbHQ")
        .map_err(|e: PasswordHashError| e.to_string())
        .expect("salt");
    let hash = argon2::Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e: PasswordHashError| e.to_string())
        .expect("hash")
        .to_string();
    std::fs::write(&hash_file, hash).expect("write dev hash file");
}
