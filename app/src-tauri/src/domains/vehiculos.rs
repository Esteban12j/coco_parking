use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::id_gen;
use crate::permissions;
use crate::state::AppState;

/// Hourly rates by vehicle type (same as frontend).
fn rate_for_type(vehicle_type: &VehicleType) -> f64 {
    match vehicle_type {
        VehicleType::Car => 50.0,
        VehicleType::Motorcycle => 30.0,
        VehicleType::Truck => 80.0,
        VehicleType::Bicycle => 15.0,
    }
}

fn vehicle_type_to_str(v: &VehicleType) -> &'static str {
    match v {
        VehicleType::Car => "car",
        VehicleType::Motorcycle => "motorcycle",
        VehicleType::Truck => "truck",
        VehicleType::Bicycle => "bicycle",
    }
}

fn vehicle_type_from_str(s: &str) -> VehicleType {
    match s {
        "motorcycle" => VehicleType::Motorcycle,
        "truck" => VehicleType::Truck,
        "bicycle" => VehicleType::Bicycle,
        _ => VehicleType::Car,
    }
}

#[allow(dead_code)]
fn status_to_str(s: &VehicleStatus) -> &'static str {
    match s {
        VehicleStatus::Active => "active",
        VehicleStatus::Completed => "completed",
    }
}

fn status_from_str(s: &str) -> VehicleStatus {
    match s {
        "completed" => VehicleStatus::Completed,
        _ => VehicleStatus::Active,
    }
}

fn row_to_vehicle(row: &rusqlite::Row) -> Result<Vehicle, rusqlite::Error> {
    Ok(Vehicle {
        id: row.get("id")?,
        ticket_code: row.get("ticket_code")?,
        plate: row.get("plate")?,
        vehicle_type: vehicle_type_from_str(&row.get::<_, String>("vehicle_type")?),
        observations: row.get("observations")?,
        entry_time: row.get("entry_time")?,
        exit_time: row.get("exit_time")?,
        status: status_from_str(&row.get::<_, String>("status")?),
        total_amount: row.get("total_amount")?,
        debt: row.get("debt")?,
        special_rate: row.get("special_rate")?,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vehicle {
    pub id: String,
    pub ticket_code: String,
    pub plate: String,
    pub vehicle_type: VehicleType,
    pub observations: Option<String>,
    pub entry_time: String,
    pub exit_time: Option<String>,
    pub status: VehicleStatus,
    pub total_amount: Option<f64>,
    pub debt: Option<f64>,
    pub special_rate: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VehicleType {
    Car,
    Motorcycle,
    Truck,
    Bicycle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VehicleStatus {
    Active,
    Completed,
}

const DEFAULT_LIST_LIMIT: u32 = 50;
const MAX_LIST_LIMIT: u32 = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListVehiclesResult {
    pub items: Vec<Vehicle>,
    pub total: u32,
}

#[tauri::command]
pub fn vehiculos_list_vehicles(
    state: State<AppState>,
    limit: Option<u32>,
    offset: Option<u32>,
    status: Option<String>,
) -> Result<ListVehiclesResult, String> {
    state.check_permission(permissions::VEHICULOS_ENTRIES_READ)?;
    let limit = limit.unwrap_or(DEFAULT_LIST_LIMIT).min(MAX_LIST_LIMIT);
    let offset = offset.unwrap_or(0);
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let (count_sql, list_sql) = match status.as_deref() {
        Some("active") | Some("completed") => (
            format!(
                "SELECT COUNT(*) FROM vehicles WHERE status = '{}'",
                status.as_deref().unwrap_or("active")
            ),
            format!(
                "SELECT id, ticket_code, plate, vehicle_type, observations, entry_time, exit_time, status, total_amount, debt, special_rate FROM vehicles WHERE status = '{}' ORDER BY entry_time DESC LIMIT ?1 OFFSET ?2",
                status.as_deref().unwrap_or("active")
            ),
        ),
        _ => (
            "SELECT COUNT(*) FROM vehicles".to_string(),
            "SELECT id, ticket_code, plate, vehicle_type, observations, entry_time, exit_time, status, total_amount, debt, special_rate FROM vehicles ORDER BY entry_time DESC LIMIT ?1 OFFSET ?2".to_string(),
        ),
    };

    let total: u32 = conn
        .query_row(&count_sql, [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(&list_sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![limit, offset], |row| row_to_vehicle(row))
        .map_err(|e| e.to_string())?;
    let items: Vec<Vehicle> = rows.filter_map(|r| r.ok()).collect();

    Ok(ListVehiclesResult { items, total })
}

#[tauri::command]
pub fn vehiculos_get_plate_debt(state: State<AppState>, plate: String) -> Result<f64, String> {
    state.check_permission(permissions::VEHICULOS_ENTRIES_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let debt: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(COALESCE(debt, 0)), 0) FROM vehicles WHERE UPPER(plate) = UPPER(?1) AND COALESCE(debt, 0) > 0",
            params![plate],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(debt)
}

/// Tipos que llevan placa (única por vehículo). Bicicletas/monopatines no tienen placa.
fn vehicle_type_has_plate(v: &VehicleType) -> bool {
    matches!(v, VehicleType::Car | VehicleType::Motorcycle | VehicleType::Truck)
}

#[tauri::command]
pub fn vehiculos_register_entry(
    state: State<AppState>,
    plate: String,
    vehicle_type: VehicleType,
    observations: Option<String>,
    ticket_code: Option<String>,
) -> Result<Vehicle, String> {
    state.check_permission(permissions::VEHICULOS_ENTRIES_CREATE)?;
    let code = ticket_code.unwrap_or_else(|| {
        format!(
            "TK{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
        )
    });
    let code = code.trim().to_string();
    if code.is_empty() {
        return Err("Código de ticket vacío".to_string());
    }

    let plate_trimmed = plate.trim();
    if vehicle_type_has_plate(&vehicle_type) && plate_trimmed.is_empty() {
        return Err("Placa requerida para auto, moto o camión".to_string());
    }
    let plate_upper = if plate_trimmed.is_empty() {
        String::new()
    } else {
        plate_trimmed.to_uppercase()
    };

    let id = id_gen::generate_id(id_gen::PREFIX_VEHICLE);
    let entry_time = chrono::Utc::now().to_rfc3339();

    let conn = state.db.get().map_err(|e| e.to_string())?;

    // No puede haber otro registro activo con el mismo código de barras (tarjeta en uso).
    let ticket_in_use: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM vehicles WHERE ticket_code = ?1 AND status = 'active' LIMIT 1",
            params![&code],
            |row| row.get(0),
        )
        .ok();
    if ticket_in_use.is_some() {
        return Err("Ese ticket o código de barras ya está en uso. Debe cerrar el turno anterior antes de reutilizar la tarjeta.".to_string());
    }

    // Para tipos con placa: una placa = un solo tipo de vehículo (no puede ser moto y auto a la vez).
    if vehicle_type_has_plate(&vehicle_type) && !plate_upper.is_empty() {
        // No puede haber otro activo con la misma placa.
        let plate_in_use: Option<i64> = conn
            .query_row(
                "SELECT 1 FROM vehicles WHERE UPPER(plate) = ?1 AND status = 'active' LIMIT 1",
                params![&plate_upper],
                |row| row.get(0),
            )
            .ok();
        if plate_in_use.is_some() {
            return Err("Esa placa ya tiene un vehículo activo en el estacionamiento. Una placa solo puede estar asociada a un vehículo a la vez.".to_string());
        }
        // Si la placa ya existe (activa o completada), debe ser del mismo tipo: no permitir auto con placa de moto ni viceversa.
        let existing_type: Option<String> = conn
            .query_row(
                "SELECT vehicle_type FROM vehicles WHERE UPPER(plate) = ?1 ORDER BY entry_time DESC LIMIT 1",
                params![&plate_upper],
                |row| row.get(0),
            )
            .ok();
        if let Some(ref existing) = existing_type {
            let existing_enum = vehicle_type_from_str(existing);
            if existing_enum != vehicle_type {
                let tipo_str = match &vehicle_type {
                    VehicleType::Car => "auto",
                    VehicleType::Motorcycle => "moto",
                    VehicleType::Truck => "camión",
                    VehicleType::Bicycle => "bicicleta",
                };
                let existing_str = match existing_enum {
                    VehicleType::Car => "auto",
                    VehicleType::Motorcycle => "moto",
                    VehicleType::Truck => "camión",
                    VehicleType::Bicycle => "bicicleta",
                };
                return Err(format!(
                    "Esa placa ya fue registrada como {}. Una placa corresponde a un solo tipo de vehículo; no se puede registrar un {} con la misma placa.",
                    existing_str, tipo_str
                ));
            }
        }
    }

    let debt: f64 = if !plate_upper.is_empty() {
        conn.query_row(
            "SELECT COALESCE(SUM(COALESCE(debt, 0)), 0) FROM vehicles WHERE UPPER(plate) = ?1 AND COALESCE(debt, 0) > 0",
            params![&plate_upper],
            |row| row.get(0),
        )
        .unwrap_or(0.0)
    } else {
        0.0
    };

    conn.execute(
        "INSERT INTO vehicles (id, ticket_code, plate, vehicle_type, observations, entry_time, exit_time, status, total_amount, debt, special_rate) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, 'active', NULL, ?7, NULL)",
        params![
            id,
            code,
            plate_upper,
            vehicle_type_to_str(&vehicle_type),
            observations,
            entry_time,
            if debt > 0.0 { debt } else { 0.0_f64 },
        ],
    )
    .map_err(|e| e.to_string())?;

    let vehicle = Vehicle {
        id: id.clone(),
        ticket_code: code,
        plate: plate_upper,
        vehicle_type,
        observations,
        entry_time: entry_time.clone(),
        exit_time: None,
        status: VehicleStatus::Active,
        total_amount: None,
        debt: if debt > 0.0 { Some(debt) } else { None },
        special_rate: None,
    };
    Ok(vehicle)
}

#[tauri::command]
pub fn vehiculos_process_exit(
    state: State<AppState>,
    ticket_code: String,
    partial_payment: Option<f64>,
    payment_method: Option<String>,
) -> Result<Vehicle, String> {
    state.check_permission(permissions::CAJA_TRANSACTIONS_CREATE)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let vehicle: Vehicle = conn
        .query_row(
            "SELECT id, ticket_code, plate, vehicle_type, observations, entry_time, exit_time, status, total_amount, debt, special_rate FROM vehicles WHERE ticket_code = ?1 AND status = 'active'",
            params![ticket_code.trim()],
            |row| row_to_vehicle(row),
        )
        .map_err(|_| "Vehicle not found or already completed".to_string())?;

    let exit_time = chrono::Utc::now().to_rfc3339();
    let entry_ts = chrono::DateTime::parse_from_rfc3339(&vehicle.entry_time)
        .map_err(|e| e.to_string())?
        .with_timezone(&chrono::Utc);
    let exit_ts = chrono::DateTime::parse_from_rfc3339(&exit_time)
        .map_err(|e| e.to_string())?
        .with_timezone(&chrono::Utc);
    let duration_minutes = (exit_ts - entry_ts).num_minutes().max(0) as f64;
    let hours = (duration_minutes / 60.0).ceil().max(1.0);
    let rate = vehicle.special_rate.unwrap_or_else(|| rate_for_type(&vehicle.vehicle_type));
    let parking_cost = hours * rate;
    let debt = vehicle.debt.unwrap_or(0.0);
    let total_with_debt = parking_cost + debt;

    let (final_amount, new_debt) = match partial_payment {
        Some(p) if p < total_with_debt => (p, total_with_debt - p),
        _ => (total_with_debt, 0.0),
    };

    let method = payment_method.as_deref().unwrap_or("cash").to_lowercase();
    let method = if ["cash", "card", "transfer"].contains(&method.as_str()) {
        method
    } else {
        "cash".to_string()
    };

    conn.execute(
        "UPDATE vehicles SET exit_time = ?1, status = 'completed', total_amount = ?2, debt = ?3 WHERE id = ?4",
        params![exit_time, final_amount, new_debt, vehicle.id],
    )
    .map_err(|e| e.to_string())?;

    let tx_id = id_gen::generate_id(id_gen::PREFIX_TRANSACTION);
    conn.execute(
        "INSERT INTO transactions (id, vehicle_id, amount, method, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![tx_id, vehicle.id, final_amount, method, exit_time],
    )
    .map_err(|e| e.to_string())?;

    let updated = Vehicle {
        exit_time: Some(exit_time),
        status: VehicleStatus::Completed,
        total_amount: Some(final_amount),
        debt: if new_debt > 0.0 { Some(new_debt) } else { None },
        ..vehicle
    };
    Ok(updated)
}

#[tauri::command]
pub fn vehiculos_find_by_ticket(
    state: State<AppState>,
    ticket_code: String,
) -> Result<Option<Vehicle>, String> {
    state.check_permission(permissions::VEHICULOS_ENTRIES_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT id, ticket_code, plate, vehicle_type, observations, entry_time, exit_time, status, total_amount, debt, special_rate FROM vehicles WHERE ticket_code = ?1 AND status = 'active' LIMIT 1",
        params![ticket_code.trim()],
        |row| row_to_vehicle(row),
    );
    match result {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn vehiculos_find_by_plate(
    state: State<AppState>,
    plate: String,
) -> Result<Option<Vehicle>, String> {
    state.check_permission(permissions::VEHICULOS_ENTRIES_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT id, ticket_code, plate, vehicle_type, observations, entry_time, exit_time, status, total_amount, debt, special_rate FROM vehicles WHERE UPPER(plate) = UPPER(?1) AND status = 'active' LIMIT 1",
        params![plate],
        |row| row_to_vehicle(row),
    );
    match result {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Todos los vehículos con esa placa (activos y completados), para que el cliente elija cuál eliminar en conflictos.
#[tauri::command]
pub fn vehiculos_get_vehicles_by_plate(
    state: State<AppState>,
    plate: String,
) -> Result<Vec<Vehicle>, String> {
    state.check_permission(permissions::VEHICULOS_ENTRIES_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, ticket_code, plate, vehicle_type, observations, entry_time, exit_time, status, total_amount, debt, special_rate FROM vehicles WHERE UPPER(plate) = UPPER(?1) ORDER BY entry_time DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![plate.trim()], |row| row_to_vehicle(row))
        .map_err(|e| e.to_string())?;
    let list: Vec<Vehicle> = rows.filter_map(|r| r.ok()).collect();
    Ok(list)
}

/// Elimina un vehículo y sus transacciones. El cliente usa esto para quitar el dato que considera erróneo.
#[tauri::command]
pub fn vehiculos_delete_vehicle(state: State<AppState>, vehicle_id: String) -> Result<(), String> {
    state.check_permission(permissions::VEHICULOS_ENTRIES_DELETE)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM transactions WHERE vehicle_id = ?1", params![&vehicle_id])
        .map_err(|e| e.to_string())?;
    let n = conn
        .execute("DELETE FROM vehicles WHERE id = ?1", params![&vehicle_id])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("Vehículo no encontrado".to_string());
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlateConflict {
    pub plate: String,
    pub vehicles: Vec<Vehicle>,
}

/// Detecta placas con más de un tipo de vehículo (datos incongruentes). Para mostrarlos al cliente y que elija cuál mantener.
#[tauri::command]
pub fn vehiculos_get_plate_conflicts(state: State<AppState>) -> Result<Vec<PlateConflict>, String> {
    state.check_permission(permissions::VEHICULOS_ENTRIES_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    // Placas (no vacías) que tienen más de un vehicle_type distinto
    let mut plates: Vec<String> = Vec::new();
    let mut stmt = conn
        .prepare(
            r#"
            SELECT UPPER(plate) AS p FROM vehicles
            WHERE TRIM(plate) != ''
            GROUP BY UPPER(plate)
            HAVING COUNT(DISTINCT vehicle_type) > 1
            "#,
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    for row in rows {
        plates.push(row.map_err(|e| e.to_string())?);
    }
    let mut conflicts = Vec::with_capacity(plates.len());
    for plate in plates {
        let mut stmt = conn
            .prepare(
                "SELECT id, ticket_code, plate, vehicle_type, observations, entry_time, exit_time, status, total_amount, debt, special_rate FROM vehicles WHERE UPPER(plate) = ?1 ORDER BY entry_time DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![&plate], |row| row_to_vehicle(row))
            .map_err(|e| e.to_string())?;
        let vehicles: Vec<Vehicle> = rows.filter_map(|r| r.ok()).collect();
        if !vehicles.is_empty() {
            conflicts.push(PlateConflict {
                plate: vehicles[0].plate.clone(),
                vehicles,
            });
        }
    }
    Ok(conflicts)
}

/// Resuelve un conflicto de placa: se queda solo el vehículo con keep_vehicle_id; el resto se elimina (y sus transacciones).
#[tauri::command]
pub fn vehiculos_resolve_plate_conflict(
    state: State<AppState>,
    plate: String,
    keep_vehicle_id: String,
) -> Result<(), String> {
    state.check_permission(permissions::VEHICULOS_ENTRIES_DELETE)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let plate_upper = plate.trim().to_uppercase();
    let mut stmt = conn
        .prepare("SELECT id FROM vehicles WHERE UPPER(plate) = ?1")
        .map_err(|e| e.to_string())?;
    let ids: Vec<String> = stmt
        .query_map(params![&plate_upper], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    if !ids.contains(&keep_vehicle_id) {
        return Err("El id a mantener no corresponde a esa placa".to_string());
    }
    for id in ids {
        if id == keep_vehicle_id {
            continue;
        }
        conn.execute("DELETE FROM transactions WHERE vehicle_id = ?1", params![&id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM vehicles WHERE id = ?1", params![&id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
