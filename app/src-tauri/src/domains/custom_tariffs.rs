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
    pub rate_unit: Option<String>,
    pub rate_duration_hours: Option<i64>,
    pub rate_duration_minutes: Option<i64>,
    pub tariff_kind: String,
    pub additional_hour_price: Option<f64>,
    pub additional_duration_hours: Option<i64>,
    pub additional_duration_minutes: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Clone)]
pub struct TariffForCalculation {
    pub base_price: f64,
    pub base_duration_hours: f64,
    pub additional_hour_price: Option<f64>,
    pub additional_period_hours: f64,
}

const FALLBACK_RATES: &[(&str, f64)] = &[
    ("car", 4000.0),
    ("motorcycle", 2500.0),
    ("truck", 5000.0),
    ("bicycle", 1000.0),
];

const FALLBACK_ADDITIONAL: &[(&str, f64)] = &[
    ("car", 1000.0),
    ("motorcycle", 500.0),
    ("truck", 1500.0),
    ("bicycle", 500.0),
];

#[allow(dead_code)]
pub fn get_default_rate_from_db(conn: &rusqlite::Connection, vehicle_type: &str) -> Result<f64, String> {
    let normalized = vehicle_type.trim().to_lowercase();
    let result: Option<f64> = conn
        .query_row(
            "SELECT amount FROM custom_tariffs WHERE vehicle_type = ?1 AND (plate_or_ref IS NULL OR plate_or_ref = '') AND (tariff_kind IS NULL OR tariff_kind = 'regular') LIMIT 1",
            params![normalized],
            |row| row.get(0),
        )
        .ok();
    Ok(result.unwrap_or_else(|| {
        FALLBACK_RATES
            .iter()
            .find(|(t, _)| *t == normalized)
            .map(|(_, a)| *a)
            .unwrap_or(4000.0)
    }))
}

pub fn get_tariff_for_calculation(
    conn: &rusqlite::Connection,
    vehicle_type: &str,
    tariff_kind: &str,
) -> Result<TariffForCalculation, String> {
    let normalized_type = vehicle_type.trim().to_lowercase();
    let normalized_kind = tariff_kind.trim().to_lowercase();
    let kind = if normalized_kind.is_empty() { "regular" } else { &normalized_kind };

    let result: Option<(f64, Option<i64>, Option<i64>, Option<f64>, Option<i64>, Option<i64>)> = conn
        .query_row(
            r#"SELECT amount, rate_duration_hours, rate_duration_minutes, additional_hour_price,
                      additional_duration_hours, additional_duration_minutes
               FROM custom_tariffs
               WHERE vehicle_type = ?1
                 AND (plate_or_ref IS NULL OR plate_or_ref = '')
                 AND (tariff_kind = ?2 OR (tariff_kind IS NULL AND ?2 = 'regular'))
               LIMIT 1"#,
            params![normalized_type, kind],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
        )
        .ok();

    match result {
        Some((base_price, dur_h, dur_m, add_price, add_dur_h, add_dur_m)) => {
            let hours = dur_h.unwrap_or(1).max(0) as f64;
            let minutes = dur_m.unwrap_or(0).max(0) as f64;
            let base_duration = hours + minutes / 60.0;
            let ad_h = add_dur_h.unwrap_or(1).max(0) as f64;
            let ad_m = add_dur_m.unwrap_or(0).max(0) as f64;
            let additional_period = ad_h + ad_m / 60.0;
            Ok(TariffForCalculation {
                base_price,
                base_duration_hours: if base_duration > 0.0 { base_duration } else { 1.0 },
                additional_hour_price: add_price,
                additional_period_hours: if additional_period > 0.0 { additional_period } else { 1.0 },
            })
        }
        None => {
            let base = FALLBACK_RATES
                .iter()
                .find(|(t, _)| *t == normalized_type)
                .map(|(_, a)| *a)
                .unwrap_or(4000.0);
            let add = FALLBACK_ADDITIONAL
                .iter()
                .find(|(t, _)| *t == normalized_type)
                .map(|(_, a)| *a)
                .unwrap_or(1000.0);
            Ok(TariffForCalculation {
                base_price: base,
                base_duration_hours: 1.0,
                additional_hour_price: Some(add),
                additional_period_hours: 1.0,
            })
        }
    }
}

pub fn calculate_parking_cost(tariff: &TariffForCalculation, duration_minutes: f64) -> f64 {
    let hours = (duration_minutes / 60.0).max(0.0);
    let base_price = tariff.base_price;
    if hours <= tariff.base_duration_hours {
        return base_price;
    }
    let overflow_hours = hours - tariff.base_duration_hours;
    let period_h = tariff.additional_period_hours.max(1.0 / 60.0);
    let additional_blocks = (overflow_hours / period_h).ceil().max(0.0);
    let additional_cost = match tariff.additional_hour_price {
        Some(price) => additional_blocks * price,
        None => additional_blocks * (tariff.base_price / tariff.base_duration_hours),
    };
    base_price + additional_cost
}

const VALID_RATE_UNITS: &[&str] = &["hour", "minute"];

fn row_to_tariff(row: &rusqlite::Row) -> rusqlite::Result<CustomTariff> {
    let plate: String = row.get("plate_or_ref")?;
    let name: Option<String> = row
        .get::<_, Option<String>>("name")
        .ok()
        .flatten()
        .filter(|s| !s.is_empty());
    let rate_unit: Option<String> = row
        .get::<_, Option<String>>("rate_unit")
        .ok()
        .flatten()
        .filter(|s| VALID_RATE_UNITS.contains(&s.as_str()));
    let rate_duration_hours: Option<i64> = row.get("rate_duration_hours").ok();
    let rate_duration_minutes: Option<i64> = row.get("rate_duration_minutes").ok();
    let (dur_h, dur_m) = match (rate_duration_hours, rate_duration_minutes) {
        (Some(h), Some(m)) if h >= 0 && m >= 0 && (h > 0 || m > 0) => (Some(h), Some(m)),
        _ => (Some(1), Some(0)),
    };
    let tariff_kind: String = row
        .get::<_, Option<String>>("tariff_kind")
        .ok()
        .flatten()
        .unwrap_or_else(|| "regular".to_string());
    let additional_hour_price: Option<f64> = row.get("additional_hour_price").ok().flatten();
    let additional_duration_hours: Option<i64> = row.get("additional_duration_hours").ok().flatten();
    let additional_duration_minutes: Option<i64> = row.get("additional_duration_minutes").ok().flatten();
    Ok(CustomTariff {
        id: row.get("id")?,
        vehicle_type: row.get::<_, Option<String>>("vehicle_type")?.unwrap_or_else(|| "car".to_string()),
        name,
        plate_or_ref: if plate.is_empty() { None } else { Some(plate) },
        description: row.get("description")?,
        amount: row.get("amount")?,
        rate_unit: rate_unit.or_else(|| Some("hour".to_string())),
        rate_duration_hours: dur_h,
        rate_duration_minutes: dur_m,
        tariff_kind,
        additional_hour_price,
        additional_duration_hours,
        additional_duration_minutes,
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
            "SELECT id, vehicle_type, name, plate_or_ref, description, amount, rate_unit, rate_duration_hours, rate_duration_minutes, tariff_kind, additional_hour_price, additional_duration_hours, additional_duration_minutes, created_at FROM custom_tariffs WHERE name LIKE ?1 OR plate_or_ref LIKE ?1 OR description LIKE ?1 OR vehicle_type LIKE ?1 OR tariff_kind LIKE ?1 ORDER BY tariff_kind ASC, vehicle_type ASC, COALESCE(plate_or_ref, '') ASC LIMIT 100".to_string(),
            Some(format!("%{}%", s)),
        ),
        _ => (
            "SELECT id, vehicle_type, name, plate_or_ref, description, amount, rate_unit, rate_duration_hours, rate_duration_minutes, tariff_kind, additional_hour_price, additional_duration_hours, additional_duration_minutes, created_at FROM custom_tariffs ORDER BY tariff_kind ASC, vehicle_type ASC, COALESCE(plate_or_ref, '') ASC LIMIT 100".to_string(),
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
const VALID_TARIFF_KINDS: &[&str] = &["regular", "employee", "student"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateCustomTariffArgs {
    vehicle_type: String,
    name: Option<String>,
    plate_or_ref: Option<String>,
    amount: f64,
    description: Option<String>,
    rate_unit: Option<String>,
    rate_duration_hours: Option<i64>,
    rate_duration_minutes: Option<i64>,
    tariff_kind: Option<String>,
    additional_hour_price: Option<f64>,
    additional_duration_hours: Option<i64>,
    additional_duration_minutes: Option<i64>,
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
    let rate_unit = args
        .rate_unit
        .as_deref()
        .map(str::trim)
        .map(str::to_lowercase)
        .filter(|s| VALID_RATE_UNITS.contains(&s.as_str()))
        .unwrap_or_else(|| "hour".to_string());
    let dur_h = args.rate_duration_hours.unwrap_or(1).max(0);
    let dur_m = args.rate_duration_minutes.unwrap_or(0).max(0).min(59);
    if dur_h == 0 && dur_m == 0 {
        return Err("Rate duration must be at least 1 minute (hours and/or minutes)".to_string());
    }

    let add_dur_h = args.additional_duration_hours.unwrap_or(1).max(0);
    let add_dur_m = args.additional_duration_minutes.unwrap_or(0).max(0).min(59);
    if add_dur_h == 0 && add_dur_m == 0 {
        return Err("Additional period must be at least 1 minute (hours and/or minutes)".to_string());
    }

    let tariff_kind = args
        .tariff_kind
        .as_deref()
        .map(str::trim)
        .map(str::to_lowercase)
        .filter(|s| VALID_TARIFF_KINDS.contains(&s.as_str()))
        .unwrap_or_else(|| "regular".to_string());
    let additional_hour_price = args.additional_hour_price.filter(|p| *p >= 0.0);

    let name_key = name.as_deref().map(str::trim).unwrap_or("");
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM custom_tariffs WHERE vehicle_type = ?1 AND COALESCE(plate_or_ref, '') = ?2 AND tariff_kind = ?3 AND COALESCE(TRIM(name), '') = ?4",
            params![&vehicle_type, plate_key, &tariff_kind, name_key],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists > 0 {
        return Err("A tariff already exists for this vehicle type, kind, plate, and name. Use a different name or edit the existing one.".to_string());
    }

    let id = id_gen::generate_id(id_gen::PREFIX_CUSTOM_TARIFF);
    let created_at = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO custom_tariffs (id, vehicle_type, name, plate_or_ref, description, amount, rate_unit, rate_duration_hours, rate_duration_minutes, tariff_kind, additional_hour_price, additional_duration_hours, additional_duration_minutes, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![id, vehicle_type, name, plate_key, description, amount, rate_unit, dur_h, dur_m, tariff_kind, additional_hour_price, add_dur_h, add_dur_m, created_at],
    )
    .map_err(|e| e.to_string())?;

    Ok(CustomTariff {
        id,
        vehicle_type,
        name,
        plate_or_ref,
        description,
        amount,
        rate_unit: Some(rate_unit),
        rate_duration_hours: Some(dur_h),
        rate_duration_minutes: Some(dur_m),
        tariff_kind,
        additional_hour_price,
        additional_duration_hours: Some(add_dur_h),
        additional_duration_minutes: Some(add_dur_m),
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
    rate_unit: Option<String>,
    rate_duration_hours: Option<i64>,
    rate_duration_minutes: Option<i64>,
    tariff_kind: Option<String>,
    additional_hour_price: Option<f64>,
    additional_duration_hours: Option<i64>,
    additional_duration_minutes: Option<i64>,
}

#[tauri::command]
pub fn custom_tariffs_update(
    state: State<AppState>,
    args: UpdateCustomTariffArgs,
) -> Result<CustomTariff, String> {
    state.check_permission(permissions::CAJA_TRANSACTIONS_MODIFY)?;
    let id = args.id.trim().to_string();
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let existing = conn
        .query_row(
            "SELECT id, vehicle_type, name, plate_or_ref, description, amount, rate_unit, rate_duration_hours, rate_duration_minutes, tariff_kind, additional_hour_price, additional_duration_hours, additional_duration_minutes, created_at FROM custom_tariffs WHERE id = ?1",
            params![&id],
            |row| row_to_tariff(row),
        )
        .ok();

    match existing {
        Some(existing_tariff) => {
            let new_vehicle_type = args
                .vehicle_type
                .as_deref()
                .map(str::trim)
                .map(str::to_lowercase)
                .filter(|s| !s.is_empty())
                .unwrap_or(existing_tariff.vehicle_type);
            if !VALID_VEHICLE_TYPES.contains(&new_vehicle_type.as_str()) {
                return Err(format!("Invalid vehicle_type: {}", new_vehicle_type));
            }
            let new_plate = args
                .plate_or_ref
                .as_ref()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .or(existing_tariff.plate_or_ref);
            let new_plate_key = new_plate.as_deref().unwrap_or("");
            let new_tariff_kind = args
                .tariff_kind
                .as_deref()
                .map(str::trim)
                .map(str::to_lowercase)
                .filter(|s| VALID_TARIFF_KINDS.contains(&s.as_str()))
                .unwrap_or(existing_tariff.tariff_kind);
            let new_name = args.name.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(String::from).or(existing_tariff.name.clone());
            let new_name_key = new_name.as_deref().map(str::trim).unwrap_or("");
            let other_id: Option<String> = conn
                .query_row(
                    "SELECT id FROM custom_tariffs WHERE vehicle_type = ?1 AND COALESCE(plate_or_ref, '') = ?2 AND tariff_kind = ?3 AND COALESCE(TRIM(name), '') = ?4 AND id != ?5 LIMIT 1",
                    params![&new_vehicle_type, new_plate_key, &new_tariff_kind, new_name_key, &id],
                    |r| r.get(0),
                )
                .ok();
            if other_id.is_some() {
                return Err("A tariff already exists for this vehicle type, kind, plate, and name.".to_string());
            }
            let new_amount = args.amount.unwrap_or(existing_tariff.amount);
            if new_amount < 0.0 {
                return Err("Amount must be non-negative".to_string());
            }
            let new_description = args.description.or(existing_tariff.description);
            let existing_rate_unit = existing_tariff.rate_unit;
            let new_rate_unit = args
                .rate_unit
                .as_deref()
                .map(str::trim)
                .map(str::to_lowercase)
                .filter(|s| VALID_RATE_UNITS.contains(&s.as_str()))
                .map(String::from)
                .or_else(|| existing_rate_unit.filter(|s| VALID_RATE_UNITS.contains(&s.as_str())))
                .unwrap_or_else(|| "hour".to_string());
            let new_dur_h = args.rate_duration_hours.or(existing_tariff.rate_duration_hours).unwrap_or(1).max(0);
            let new_dur_m = args.rate_duration_minutes.or(existing_tariff.rate_duration_minutes).unwrap_or(0).max(0).min(59);
            if new_dur_h == 0 && new_dur_m == 0 {
                return Err("Rate duration must be at least 1 minute (hours and/or minutes)".to_string());
            }
            let new_add_dur_h = args.additional_duration_hours.or(existing_tariff.additional_duration_hours).unwrap_or(1).max(0);
            let new_add_dur_m = args.additional_duration_minutes.or(existing_tariff.additional_duration_minutes).unwrap_or(0).max(0).min(59);
            if new_add_dur_h == 0 && new_add_dur_m == 0 {
                return Err("Additional period must be at least 1 minute (hours and/or minutes)".to_string());
            }
            let new_additional_hour_price = args.additional_hour_price.or(existing_tariff.additional_hour_price);
            conn.execute(
                "UPDATE custom_tariffs SET vehicle_type = ?1, name = ?2, plate_or_ref = ?3, description = ?4, amount = ?5, rate_unit = ?6, rate_duration_hours = ?7, rate_duration_minutes = ?8, tariff_kind = ?9, additional_hour_price = ?10, additional_duration_hours = ?11, additional_duration_minutes = ?12 WHERE id = ?13",
                params![new_vehicle_type, new_name, new_plate_key, new_description, new_amount, new_rate_unit, new_dur_h, new_dur_m, new_tariff_kind, new_additional_hour_price, new_add_dur_h, new_add_dur_m, &id],
            )
            .map_err(|e| e.to_string())?;
        }
        None => return Err("Custom tariff not found".to_string()),
    }

    conn.query_row(
        "SELECT id, vehicle_type, name, plate_or_ref, description, amount, rate_unit, rate_duration_hours, rate_duration_minutes, tariff_kind, additional_hour_price, additional_duration_hours, additional_duration_minutes, created_at FROM custom_tariffs WHERE id = ?1",
        params![&id],
        |row| row_to_tariff(row),
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
