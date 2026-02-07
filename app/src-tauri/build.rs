fn main() {
    tauri_build::build();
    let out_dir = std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let hash_file = out_dir.join("developer_password_hash.txt");
    // Developer account seed: hash is embedded at build time only. Set COCO_DEV_PASSWORD when building to enable the hidden developer user; never commit or log the password.
    let hash = match std::env::var("COCO_DEV_PASSWORD") {
        Ok(password) if !password.is_empty() => {
            use argon2::password_hash::{PasswordHasher, SaltString};
            use password_hash::Error as PasswordHashError;
            let salt = SaltString::from_b64("Y29jb19wYXJraW5nX3NhbHQ")
                .map_err(|e: PasswordHashError| e.to_string())
                .expect("salt");
            argon2::Argon2::default()
                .hash_password(password.as_bytes(), &salt)
                .map_err(|e: PasswordHashError| e.to_string())
                .expect("hash")
                .to_string()
        }
        _ => String::new(),
    };
    std::fs::write(&hash_file, hash).expect("write dev hash file");
}
