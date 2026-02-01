//! Prefixed IDs: 25 chars total = 2-char prefix + 23 alphanumeric.

use rand::Rng;

pub const ID_LENGTH: usize = 25;

pub const PREFIX_VEHICLE: &str = "VH";
pub const PREFIX_TRANSACTION: &str = "TX";
pub const PREFIX_SHIFT_CLOSURE: &str = "SC";

const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

pub fn generate_id(prefix: &str) -> String {
    let suffix_len = ID_LENGTH.saturating_sub(prefix.len());
    let mut rng = rand::thread_rng();
    let suffix: String = (0..suffix_len)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect();
    format!("{}{}", prefix, suffix)
}
