use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::id_gen;
use crate::permissions;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomTariff {
    pub id: String,
    pub vehicle_type: String,
    pub name: Option<String>,
    pub plate_or_ref: Option<String>,
    pub description: Option<String>,
    pub amount: f64,
    pub created_at: String,
}

const FALLBACK_RATES: &[(&str, f64)] = &[
    ("car", 50.0),
    ("motorcycle", 30.0),
    ("truck", 80.0),
    ("bicycle", 15.0),
];

pub fn get_default_rate_from_db(conn: &rusqlite::Connection, vehicle_type: &str) -> Result<f64, String> {
    let normalized = vehicle_type.trim().to_lowercase();
    let result: Option<f64> = conn
        .query_row(
            "SELECT amount FROM custom_tariffs WHERE vehicle_type = ?1 AND (plate_or_ref IS NULL OR plate_or_ref = '') LIMIT 1",
            params![normalized],
            |row| row.get(0),
        )
        .ok();
    Ok(result.unwrap_or_else(|| {
        FALLBACK_RATES
            .iter()
            .find(|(t, _)| *t == normalized)
            .map(|(_, a)| *a)
            .unwrap_or(50.0)
    }))
}

fn row_to_tariff(row: &rusqlite::Row) -> rusqlite::Result<CustomTariff> {
    let plate: String = row.get("plate_or_ref")?;
    let name: Option<String> = row
        .get::<_, Option<String>>("name")
        .ok()
        .flatten()
        .filter(|s| !s.is_empty());
    Ok(CustomTariff {
        id: row.get("id")?,
        vehicle_type: row.get::<_, Option<String>>("vehicle_type")?.unwrap_or_else(|| "car".to_string()),
        name,
        plate_or_ref: if plate.is_empty() { None } else { Some(plate) },
        description: row.get("description")?,
        amount: row.get("amount")?,
        created_at: row.get("created_at")?,
    })
}

#[tauri::command]
pub fn custom_tariffs_list(
    state: State<AppState>,
    search: Option<String>,
) -> Result<Vec<CustomTariff>, String> {
    state.check_permission(permissions::CAJA_TRANSACTIONS_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let (sql, param): (String, Option<String>) = match search.as_deref().map(str::trim) {
        Some(s) if !s.is_empty() => (
            "SELECT id, vehicle_type, name, plate_or_ref, description, amount, created_at FROM custom_tariffs WHERE name LIKE ?1 OR plate_or_ref LIKE ?1 OR description LIKE ?1 OR vehicle_type LIKE ?1 ORDER BY vehicle_type ASC, COALESCE(plate_or_ref, '') ASC LIMIT 100".to_string(),
            Some(format!("%{}%", s)),
        ),
        _ => (
            "SELECT id, vehicle_type, name, plate_or_ref, description, amount, created_at FROM custom_tariffs ORDER BY vehicle_type ASC, COALESCE(plate_or_ref, '') ASC LIMIT 100".to_string(),
            None,
        ),
    };

    let items: Vec<CustomTariff> = match &param {
        Some(p) => {
            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![p], |row| row_to_tariff(&row))
                .map_err(|e| e.to_string())?;
            rows.filter_map(|r| r.ok()).collect()
        }
        None => {
            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| row_to_tariff(&row))
                .map_err(|e| e.to_string())?;
            rows.filter_map(|r| r.ok()).collect()
        }
    };
    Ok(items)
}

const VALID_VEHICLE_TYPES: &[&str] = &["car", "motorcycle", "truck", "bicycle"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateCustomTariffArgs {
    vehicle_type: String,
    name: Option<String>,
    plate_or_ref: Option<String>,
    amount: f64,
    description: Option<String>,
}

#[tauri::command]
pub fn custom_tariffs_create(
    state: State<AppState>,
    args: CreateCustomTariffArgs,
) -> Result<CustomTariff, String> {
    state.check_permission(permissions::CAJA_TRANSACTIONS_CREATE)?;
    let vehicle_type = args.vehicle_type.trim().to_lowercase();
    if !VALID_VEHICLE_TYPES.contains(&vehicle_type.as_str()) {
        return Err(format!("Invalid vehicle_type: {}", vehicle_type));
    }
    let plate_or_ref = args
        .plate_or_ref
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from);
    let plate_key = plate_or_ref.as_deref().unwrap_or("");
    let amount = args.amount;
    if amount < 0.0 {
        return Err("Amount must be non-negative".to_string());
    }
    let name = args.name.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(String::from);
    let description = args.description;

    let conn = state.db.get().map_err(|e| e.to_string())?;
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM custom_tariffs WHERE vehicle_type = ?1 AND COALESCE(plate_or_ref, '') = ?2",
            params![&vehicle_type, plate_key],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists > 0 {
        return Err("A tariff already exists for this vehicle type and plate (or default for type). Use a different plate or edit the existing one.".to_string());
    }

    let id = id_gen::generate_id(id_gen::PREFIX_CUSTOM_TARIFF);
    let created_at = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO custom_tariffs (id, vehicle_type, name, plate_or_ref, description, amount, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, vehicle_type, name, plate_key, description, amount, created_at],
    )
    .map_err(|e| e.to_string())?;

    Ok(CustomTariff {
        id,
        vehicle_type,
        name,
        plate_or_ref,
        description,
        amount,
        created_at,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateCustomTariffArgs {
    id: String,
    vehicle_type: Option<String>,
    name: Option<String>,
    plate_or_ref: Option<String>,
    amount: Option<f64>,
    description: Option<String>,
}

#[tauri::command]
pub fn custom_tariffs_update(
    state: State<AppState>,
    args: UpdateCustomTariffArgs,
) -> Result<CustomTariff, String> {
    state.check_permission(permissions::CAJA_TRANSACTIONS_MODIFY)?;
    let id = args.id.trim().to_string();
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let existing: Option<(String, Option<String>, String, Option<String>, f64)> = conn
        .query_row(
            "SELECT vehicle_type, name, plate_or_ref, description, amount FROM custom_tariffs WHERE id = ?1",
            params![&id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .ok();

    match existing {
        Some((vt, existing_name, p, d, a)) => {
            let new_vehicle_type = args
                .vehicle_type
                .as_deref()
                .map(str::trim)
                .map(str::to_lowercase)
                .filter(|s| !s.is_empty())
                .unwrap_or(vt);
            if !VALID_VEHICLE_TYPES.contains(&new_vehicle_type.as_str()) {
                return Err(format!("Invalid vehicle_type: {}", new_vehicle_type));
            }
            let new_plate = args
                .plate_or_ref
                .as_ref()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .or_else(|| if p.is_empty() { None } else { Some(p.clone()) });
            let new_plate_key = new_plate.as_deref().unwrap_or("");
            let other_id: Option<String> = conn
                .query_row(
                    "SELECT id FROM custom_tariffs WHERE vehicle_type = ?1 AND COALESCE(plate_or_ref, '') = ?2 AND id != ?3 LIMIT 1",
                    params![&new_vehicle_type, new_plate_key, &id],
                    |r| r.get(0),
                )
                .ok();
            if other_id.is_some() {
                return Err("A tariff already exists for this vehicle type and plate (or default for type).".to_string());
            }
            let new_amount = args.amount.unwrap_or(a);
            if new_amount < 0.0 {
                return Err("Amount must be non-negative".to_string());
            }
            let new_name = args.name.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(String::from).or(existing_name);
            let new_description = args.description.or(d);
            conn.execute(
                "UPDATE custom_tariffs SET vehicle_type = ?1, name = ?2, plate_or_ref = ?3, description = ?4, amount = ?5 WHERE id = ?6",
                params![new_vehicle_type, new_name, new_plate_key, new_description, new_amount, &id],
            )
            .map_err(|e| e.to_string())?;
        }
        None => return Err("Custom tariff not found".to_string()),
    }

    conn.query_row(
        "SELECT id, vehicle_type, name, plate_or_ref, description, amount, created_at FROM custom_tariffs WHERE id = ?1",
        params![&id],
        |row| row_to_tariff(&row),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn custom_tariffs_delete(state: State<AppState>, id: String) -> Result<(), String> {
    state.check_permission(permissions::CAJA_TRANSACTIONS_MODIFY)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let n = conn
        .execute("DELETE FROM custom_tariffs WHERE id = ?1", params![id.trim()])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("Custom tariff not found".to_string());
    }
    Ok(())
}
