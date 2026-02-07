use std::path::Path;

use barcoders::generators::image::{Color, Image, Rotation};
use barcoders::sym::code128::Code128;
use base64::prelude::{Engine as _, BASE64_STANDARD};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::id_gen;
use crate::permissions;
use crate::state::AppState;

const CODE_MIN_LEN: usize = 1;
const CODE_MAX_LEN: usize = 24;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Barcode {
    pub id: String,
    pub code: String,
    pub label: Option<String>,
    pub created_at: String,
}

fn validate_code(code: &str) -> Result<String, String> {
    let trimmed = code.trim();
    if trimmed.is_empty() {
        return Err("Barcode code cannot be empty.".to_string());
    }
    if trimmed.len() < CODE_MIN_LEN || trimmed.len() > CODE_MAX_LEN {
        return Err(format!(
            "Barcode code must be between {} and {} characters (got {}).",
            CODE_MIN_LEN,
            CODE_MAX_LEN,
            trimmed.len()
        ));
    }
    if !trimmed.chars().all(|c| c.is_ascii_digit()) {
        return Err("Barcode code must contain only digits.".to_string());
    }
    Ok(trimmed.to_string())
}

fn row_to_barcode(row: &rusqlite::Row) -> rusqlite::Result<Barcode> {
    let label: Option<String> = row.get("label").ok().flatten();
    let label = label.filter(|s| !s.is_empty());
    Ok(Barcode {
        id: row.get("id")?,
        code: row.get("code")?,
        label,
        created_at: row.get("created_at")?,
    })
}

fn is_valid_barcode_format(code: &str) -> Option<String> {
    let trimmed = code.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.len() < CODE_MIN_LEN || trimmed.len() > CODE_MAX_LEN {
        return None;
    }
    if !trimmed.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    Some(trimmed.to_string())
}

pub fn ensure_barcode_exists_for_ticket(
    conn: &rusqlite::Connection,
    code: &str,
) -> Result<(), String> {
    let Some(normalized) = is_valid_barcode_format(code) else {
        return Ok(());
    };
    let exists = conn
        .query_row(
            "SELECT 1 FROM barcodes WHERE code = ?1 LIMIT 1",
            params![&normalized],
            |row| row.get::<_, i32>(0),
        )
        .is_ok();
    if exists {
        return Ok(());
    }
    let id = id_gen::generate_id(id_gen::PREFIX_BARCODE);
    let created_at = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO barcodes (id, code, label, created_at) VALUES (?1, ?2, NULL, ?3)",
        params![&id, &normalized, &created_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn barcodes_list(state: State<AppState>) -> Result<Vec<Barcode>, String> {
    state.check_permission(permissions::BARCODES_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, code, label, created_at FROM barcodes ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row_to_barcode(&row))
        .map_err(|e| e.to_string())?;
    let items: Vec<Barcode> = rows.filter_map(|r| r.ok()).collect();
    Ok(items)
}

#[tauri::command]
pub fn barcodes_get_by_id(state: State<AppState>, id: String) -> Result<Option<Barcode>, String> {
    state.check_permission(permissions::BARCODES_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT id, code, label, created_at FROM barcodes WHERE id = ?1",
        params![id.trim()],
        |row| row_to_barcode(&row),
    );
    match result {
        Ok(b) => Ok(Some(b)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn barcodes_get_by_code(
    state: State<AppState>,
    code: String,
) -> Result<Option<Barcode>, String> {
    state.check_permission(permissions::BARCODES_READ)?;
    let normalized = code.trim();
    if normalized.is_empty() {
        return Ok(None);
    }
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT id, code, label, created_at FROM barcodes WHERE code = ?1",
        params![normalized],
        |row| row_to_barcode(&row),
    );
    match result {
        Ok(b) => Ok(Some(b)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateBarcodeArgs {
    code: String,
    label: Option<String>,
}

#[tauri::command]
pub fn barcodes_create(
    state: State<AppState>,
    args: CreateBarcodeArgs,
) -> Result<Barcode, String> {
    state.check_permission(permissions::BARCODES_CREATE)?;
    let code = validate_code(&args.code)?;
    let label = args
        .label
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from);

    let conn = state.db.get().map_err(|e| e.to_string())?;
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM barcodes WHERE code = ?1",
            params![&code],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists > 0 {
        return Err("A barcode with this code already exists.".to_string());
    }

    let id = id_gen::generate_id(id_gen::PREFIX_BARCODE);
    let created_at = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO barcodes (id, code, label, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![&id, &code, &label, &created_at],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "A barcode with this code already exists.".to_string()
        } else {
            e.to_string()
        }
    })?;

    Ok(Barcode {
        id: id.clone(),
        code,
        label,
        created_at,
    })
}

#[tauri::command]
pub fn barcodes_delete(state: State<AppState>, id: String) -> Result<(), String> {
    state.check_permission(permissions::BARCODES_DELETE)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let n = conn
        .execute("DELETE FROM barcodes WHERE id = ?1", params![id.trim()])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("Barcode not found.".to_string());
    }
    Ok(())
}

const BARCODE_IMAGE_HEIGHT_PX: u32 = 60;
const BARCODE_XDIM: u32 = 3;

/// Code128 in barcoders requires a leading character-set: À (A), Ɓ (B), or Ć (C).
/// We use Ɓ (Code Set B) so digit-only codes are encoded as-is with no length constraint.
fn code128_data_from_digits(code: &str) -> String {
    let trimmed = code.trim();
    if trimmed.is_empty() {
        return "\u{0181}0".to_string();
    }
    format!("\u{0181}{}", trimmed)
}

fn generate_barcode_png_bytes(code: &str) -> Result<Vec<u8>, String> {
    let code128_data = code128_data_from_digits(code);
    let barcode = Code128::new(&code128_data).map_err(|e| e.to_string())?;
    let encoded = barcode.encode();
    let generator = Image::PNG {
        height: BARCODE_IMAGE_HEIGHT_PX,
        xdim: BARCODE_XDIM,
        rotation: Rotation::Zero,
        foreground: Color::new([0, 0, 0, 255]),
        background: Color::new([255, 255, 255, 255]),
    };
    let bytes = generator
        .generate(&encoded[..])
        .map_err(|e| e.to_string())?;
    Ok(bytes)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BarcodeImageResult {
    pub base64: String,
    pub path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GenerateBarcodeImageArgs {
    code: String,
    export_path: Option<String>,
}

#[tauri::command]
pub fn barcodes_generate_image(
    state: State<AppState>,
    args: GenerateBarcodeImageArgs,
) -> Result<BarcodeImageResult, String> {
    state.check_permission(permissions::BARCODES_READ)?;
    let code = validate_code(&args.code)?;
    let png_bytes = generate_barcode_png_bytes(&code)?;
    let base64_data = BASE64_STANDARD.encode(&png_bytes);
    let path = if let Some(ref export_path) = args.export_path {
        let trimmed = export_path.trim();
        if trimmed.is_empty() {
            None
        } else {
            let p = Path::new(trimmed);
            if let Err(e) = std::fs::write(p, &png_bytes) {
                return Err(format!("Failed to write barcode image to file: {}", e));
            }
            Some(p.to_string_lossy().into_owned())
        }
    } else {
        None
    };
    Ok(BarcodeImageResult {
        base64: base64_data,
        path,
    })
}
