use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::id_gen;
use crate::permissions;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Contract {
    pub id: String,
    pub client_name: String,
    pub client_phone: Option<String>,
    pub plate: String,
    pub plate_upper: String,
    pub vehicle_type: String,
    pub tariff_kind: String,
    pub monthly_amount: f64,
    pub included_hours_per_day: f64,
    pub date_from: String,
    pub date_to: String,
    pub status: String,
    pub created_at: String,
    pub notes: Option<String>,
    pub extra_charge_first: Option<f64>,
    pub extra_charge_repeat: Option<f64>,
    pub extra_interval: Option<i64>,
    pub is_in_arrears: bool,
    pub billing_period_days: i64,
}

fn is_in_arrears(status: &str, date_to: &str) -> bool {
    if status == "cancelled" {
        return false;
    }
    if status == "arrears" {
        return true;
    }
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    date_to < today.as_str()
}

fn row_to_contract(row: &rusqlite::Row) -> rusqlite::Result<Contract> {
    let status: String = row.get("status")?;
    let date_to: String = row.get("date_to")?;
    let arrears = is_in_arrears(&status, &date_to);
    Ok(Contract {
        id: row.get("id")?,
        client_name: row.get("client_name")?,
        client_phone: row.get("client_phone")?,
        plate: row.get("plate")?,
        plate_upper: row.get("plate_upper")?,
        vehicle_type: row.get("vehicle_type")?,
        tariff_kind: row.get("tariff_kind")?,
        monthly_amount: row.get("monthly_amount")?,
        included_hours_per_day: row.get("included_hours_per_day")?,
        date_from: row.get("date_from")?,
        date_to,
        status,
        created_at: row.get("created_at")?,
        notes: row.get("notes")?,
        extra_charge_first: row.get("extra_charge_first")?,
        extra_charge_repeat: row.get("extra_charge_repeat")?,
        extra_interval: row.get("extra_interval")?,
        is_in_arrears: arrears,
        billing_period_days: row.get("billing_period_days").unwrap_or(30),
    })
}

const CONTRACT_COLS: &str = r#"
    id, client_name, client_phone, plate, plate_upper, vehicle_type,
    tariff_kind, monthly_amount, included_hours_per_day,
    date_from, date_to, status, created_at, notes,
    extra_charge_first, extra_charge_repeat, extra_interval,
    billing_period_days
"#;

pub fn find_active_contract_for_plate(
    conn: &rusqlite::Connection,
    plate_upper: &str,
) -> Option<Contract> {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    conn.query_row(
        &format!(
            r#"SELECT {CONTRACT_COLS}
               FROM contracts
               WHERE plate_upper = ?1
                 AND status = 'active'
                 AND date_from <= ?2
                 AND date_to >= ?2
               LIMIT 1"#
        ),
        params![plate_upper, today],
        |row| row_to_contract(row),
    )
    .ok()
}

pub fn find_any_contract_for_plate(
    conn: &rusqlite::Connection,
    plate_upper: &str,
) -> Option<Contract> {
    conn.query_row(
        &format!(
            r#"SELECT {CONTRACT_COLS}
               FROM contracts
               WHERE plate_upper = ?1
                 AND status IN ('active', 'arrears')
               ORDER BY date_to DESC
               LIMIT 1"#
        ),
        params![plate_upper],
        |row| row_to_contract(row),
    )
    .ok()
}

const VALID_VEHICLE_TYPES: &[&str] = &["car", "motorcycle", "truck", "bicycle"];
const VALID_TARIFF_KINDS: &[&str] = &["employee", "student"];
const VALID_STATUSES: &[&str] = &["active", "expired", "cancelled", "arrears"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateContractArgs {
    client_name: String,
    client_phone: Option<String>,
    plate: String,
    vehicle_type: String,
    tariff_kind: Option<String>,
    monthly_amount: Option<f64>,
    included_hours_per_day: Option<f64>,
    date_from: String,
    date_to: String,
    notes: Option<String>,
    extra_charge_first: Option<f64>,
    extra_charge_repeat: Option<f64>,
    extra_interval: Option<i64>,
    billing_period_days: Option<i64>,
}

fn suggest_monthly_amount(
    conn: &rusqlite::Connection,
    vehicle_type: &str,
    tariff_kind: &str,
    days: i64,
) -> f64 {
    let tariff = crate::domains::custom_tariffs::get_tariff_for_calculation(
        conn, vehicle_type, tariff_kind,
    );
    match tariff {
        Ok(t) => t.base_price * days as f64,
        Err(_) => 0.0,
    }
}

#[tauri::command]
pub fn contracts_suggest_monthly(
    state: State<AppState>,
    vehicle_type: String,
    tariff_kind: Option<String>,
    days: Option<i64>,
) -> Result<f64, String> {
    state.check_permission(permissions::CONTRACTS_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let vt = vehicle_type.trim().to_lowercase();
    let kind = tariff_kind
        .as_deref()
        .map(str::trim)
        .map(str::to_lowercase)
        .unwrap_or_else(|| "employee".to_string());
    let days = days.unwrap_or(31);
    Ok(suggest_monthly_amount(&conn, &vt, &kind, days))
}

#[tauri::command]
pub fn contracts_create(
    state: State<AppState>,
    args: CreateContractArgs,
) -> Result<Contract, String> {
    state.check_permission(permissions::CONTRACTS_CREATE)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let plate = args.plate.trim().to_uppercase();
    if plate.is_empty() {
        return Err("Plate is required".to_string());
    }
    let plate_upper = plate.clone();
    let client_name = args.client_name.trim().to_string();
    if client_name.is_empty() {
        return Err("Client name is required".to_string());
    }
    let vehicle_type = args.vehicle_type.trim().to_lowercase();
    if !VALID_VEHICLE_TYPES.contains(&vehicle_type.as_str()) {
        return Err(format!("Invalid vehicle type: {}", vehicle_type));
    }
    let tariff_kind = args
        .tariff_kind
        .as_deref()
        .map(str::trim)
        .map(str::to_lowercase)
        .filter(|s| VALID_TARIFF_KINDS.contains(&s.as_str()))
        .unwrap_or_else(|| "employee".to_string());

    if let Some(v) = args.extra_charge_first {
        if v < 0.0 {
            return Err("extra_charge_first must be >= 0".to_string());
        }
    }
    if let Some(v) = args.extra_charge_repeat {
        if v < 0.0 {
            return Err("extra_charge_repeat must be >= 0".to_string());
        }
    }
    if let Some(v) = args.extra_interval {
        if v <= 0 {
            return Err("extra_interval must be > 0".to_string());
        }
    }

    let existing: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM contracts WHERE plate_upper = ?1 AND status = 'active'",
            params![&plate_upper],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if existing > 0 {
        return Err("An active contract already exists for this plate".to_string());
    }

    let included_hours = args.included_hours_per_day.unwrap_or(6.0);
    let billing_period_days = args.billing_period_days.unwrap_or(30).max(1);
    let date_from = args.date_from.trim().to_string();
    let date_to = args.date_to.trim().to_string();

    let monthly_amount = args.monthly_amount.unwrap_or_else(|| {
        suggest_monthly_amount(&conn, &vehicle_type, &tariff_kind, 31)
    });

    let id = id_gen::generate_id(id_gen::PREFIX_CONTRACT);
    let created_at = chrono::Utc::now().to_rfc3339();

    conn.execute(
        r#"INSERT INTO contracts
            (id, client_name, client_phone, plate, plate_upper, vehicle_type,
             tariff_kind, monthly_amount, included_hours_per_day,
             date_from, date_to, status, created_at, notes,
             extra_charge_first, extra_charge_repeat, extra_interval, billing_period_days)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'active', ?12, ?13, ?14, ?15, ?16, ?17)"#,
        params![
            id, client_name, args.client_phone, plate, plate_upper,
            vehicle_type, tariff_kind, monthly_amount, included_hours,
            date_from, date_to, created_at, args.notes,
            args.extra_charge_first, args.extra_charge_repeat, args.extra_interval,
            billing_period_days,
        ],
    )
    .map_err(|e| e.to_string())?;

    let arrears = is_in_arrears("active", &date_to);
    Ok(Contract {
        id,
        client_name,
        client_phone: args.client_phone,
        plate,
        plate_upper,
        vehicle_type,
        tariff_kind,
        monthly_amount,
        included_hours_per_day: included_hours,
        date_from,
        date_to,
        status: "active".to_string(),
        created_at,
        notes: args.notes,
        extra_charge_first: args.extra_charge_first,
        extra_charge_repeat: args.extra_charge_repeat,
        extra_interval: args.extra_interval,
        is_in_arrears: arrears,
        billing_period_days,
    })
}

#[tauri::command]
pub fn contracts_list(
    state: State<AppState>,
    status: Option<String>,
    search: Option<String>,
) -> Result<Vec<Contract>, String> {
    state.check_permission(permissions::CONTRACTS_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let status_filter = status
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .filter(|s| VALID_STATUSES.contains(s));

    let search_filter = search
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());

    let base_select = format!(
        "SELECT {CONTRACT_COLS} FROM contracts"
    );

    let (sql, search_param) = match (status_filter, search_filter) {
        (Some(st), Some(s)) => (
            format!(
                "{base_select} WHERE status = '{st}' AND (client_name LIKE ?1 OR plate_upper LIKE ?1 OR client_phone LIKE ?1) ORDER BY created_at DESC LIMIT 100"
            ),
            Some(format!("%{}%", s.to_uppercase())),
        ),
        (Some(st), None) => (
            format!("{base_select} WHERE status = '{st}' ORDER BY created_at DESC LIMIT 100"),
            None,
        ),
        (None, Some(s)) => (
            format!("{base_select} WHERE client_name LIKE ?1 OR plate_upper LIKE ?1 OR client_phone LIKE ?1 ORDER BY created_at DESC LIMIT 100"),
            Some(format!("%{}%", s.to_uppercase())),
        ),
        (None, None) => (
            format!("{base_select} ORDER BY created_at DESC LIMIT 100"),
            None,
        ),
    };

    let items: Vec<Contract> = match &search_param {
        Some(p) => {
            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![p], |row| row_to_contract(row))
                .map_err(|e| e.to_string())?;
            rows.filter_map(|r| r.ok()).collect()
        }
        None => {
            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let rows = stmt.query_map([], |row| row_to_contract(row))
                .map_err(|e| e.to_string())?;
            rows.filter_map(|r| r.ok()).collect()
        }
    };
    Ok(items)
}

#[tauri::command]
pub fn contracts_get_by_plate(
    state: State<AppState>,
    plate: String,
) -> Result<Option<Contract>, String> {
    state.check_permission(permissions::CONTRACTS_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let plate_upper = plate.trim().to_uppercase();
    Ok(find_active_contract_for_plate(&conn, &plate_upper))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateContractArgs {
    id: String,
    client_name: Option<String>,
    client_phone: Option<String>,
    monthly_amount: Option<f64>,
    included_hours_per_day: Option<f64>,
    date_from: Option<String>,
    date_to: Option<String>,
    notes: Option<String>,
    extra_charge_first: Option<f64>,
    extra_charge_repeat: Option<f64>,
    extra_interval: Option<i64>,
    billing_period_days: Option<i64>,
}

#[tauri::command]
pub fn contracts_update(
    state: State<AppState>,
    args: UpdateContractArgs,
) -> Result<Contract, String> {
    state.check_permission(permissions::CONTRACTS_MODIFY)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let id = args.id.trim().to_string();

    let existing = conn
        .query_row(
            &format!("SELECT {CONTRACT_COLS} FROM contracts WHERE id = ?1"),
            params![&id],
            |row| row_to_contract(row),
        )
        .map_err(|_| "Contract not found".to_string())?;

    let new_name = args.client_name
        .as_deref().map(str::trim).filter(|s| !s.is_empty()).map(String::from)
        .unwrap_or(existing.client_name);
    let new_phone = args.client_phone.or(existing.client_phone);
    let new_amount = args.monthly_amount.unwrap_or(existing.monthly_amount);
    let new_hours = args.included_hours_per_day.unwrap_or(existing.included_hours_per_day);
    let new_from = args.date_from.unwrap_or(existing.date_from);
    let new_to = args.date_to.unwrap_or(existing.date_to);
    let new_notes = args.notes.or(existing.notes);
    let new_extra_first = if args.extra_charge_first.is_some() { args.extra_charge_first } else { existing.extra_charge_first };
    let new_extra_repeat = if args.extra_charge_repeat.is_some() { args.extra_charge_repeat } else { existing.extra_charge_repeat };
    let new_extra_interval = if args.extra_interval.is_some() { args.extra_interval } else { existing.extra_interval };
    let new_billing = if args.billing_period_days.is_some() { args.billing_period_days.unwrap_or(30) } else { existing.billing_period_days };

    conn.execute(
        r#"UPDATE contracts SET client_name = ?1, client_phone = ?2, monthly_amount = ?3,
           included_hours_per_day = ?4, date_from = ?5, date_to = ?6, notes = ?7,
           extra_charge_first = ?8, extra_charge_repeat = ?9, extra_interval = ?10,
           billing_period_days = ?11
           WHERE id = ?12"#,
        params![
            new_name, new_phone, new_amount, new_hours, new_from, new_to, new_notes,
            new_extra_first, new_extra_repeat, new_extra_interval, new_billing, &id
        ],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        &format!("SELECT {CONTRACT_COLS} FROM contracts WHERE id = ?1"),
        params![&id],
        |row| row_to_contract(row),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn contracts_delete(state: State<AppState>, id: String) -> Result<(), String> {
    state.check_permission(permissions::CONTRACTS_DELETE)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let n = conn
        .execute("DELETE FROM contracts WHERE id = ?1", params![id.trim()])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("Contract not found".to_string());
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordPaymentArgs {
    contract_id: String,
    method: String,
    amount: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContractPayment {
    pub id: String,
    pub contract_id: String,
    pub amount: f64,
    pub method: String,
    pub period_from: String,
    pub period_to: String,
    pub operator_user_id: Option<String>,
    pub created_at: String,
}

#[tauri::command]
pub fn contracts_record_payment(
    state: State<AppState>,
    args: RecordPaymentArgs,
) -> Result<Contract, String> {
    state.check_permission(permissions::CONTRACTS_PAYMENT_CREATE)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let valid_methods = ["cash", "card", "transfer"];
    let method = args.method.trim().to_lowercase();
    if !valid_methods.contains(&method.as_str()) {
        return Err(format!("Invalid payment method: {}", method));
    }

    let contract_id = args.contract_id.trim().to_string();
    let contract = conn
        .query_row(
            &format!("SELECT {CONTRACT_COLS} FROM contracts WHERE id = ?1"),
            params![&contract_id],
            |row| row_to_contract(row),
        )
        .map_err(|_| "Contract not found".to_string())?;

    if contract.status == "cancelled" {
        return Err("Cannot record payment for a cancelled contract".to_string());
    }

    let amount = args.amount.unwrap_or(contract.monthly_amount);
    if amount < 0.0 {
        return Err("Amount must be >= 0".to_string());
    }

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let period_from = if contract.date_to < today {
        today.clone()
    } else {
        contract.date_to.clone()
    };

    let period_to_date = chrono::NaiveDate::parse_from_str(&period_from, "%Y-%m-%d")
        .map_err(|e| e.to_string())?;
    let period_to = (period_to_date + chrono::Duration::days(contract.billing_period_days))
        .format("%Y-%m-%d")
        .to_string();

    let payment_id = id_gen::generate_id("cpay");
    let created_at = chrono::Utc::now().to_rfc3339();
    let operator_user_id = state.get_current_user_id();

    conn.execute("BEGIN IMMEDIATE", []).map_err(|e| e.to_string())?;

    let result = (|| {
        conn.execute(
            r#"INSERT INTO contract_payments
                (id, contract_id, amount, method, period_from, period_to, operator_user_id, created_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"#,
            params![
                payment_id, contract_id, amount, method,
                period_from, period_to, operator_user_id, created_at
            ],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE contracts SET date_to = ?1, status = 'active' WHERE id = ?2",
            params![period_to, contract_id],
        )
        .map_err(|e| e.to_string())?;

        conn.query_row(
            &format!("SELECT {CONTRACT_COLS} FROM contracts WHERE id = ?1"),
            params![&contract_id],
            |row| row_to_contract(row),
        )
        .map_err(|e| e.to_string())
    })();

    match result {
        Ok(updated) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            Ok(updated)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

#[tauri::command]
pub fn contracts_list_payments(
    state: State<AppState>,
    contract_id: String,
) -> Result<Vec<ContractPayment>, String> {
    state.check_permission(permissions::CONTRACTS_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let cid = contract_id.trim().to_string();

    let mut stmt = conn
        .prepare(
            r#"SELECT id, contract_id, amount, method, period_from, period_to,
                      operator_user_id, created_at
               FROM contract_payments
               WHERE contract_id = ?1
               ORDER BY created_at DESC"#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![cid], |row| {
            Ok(ContractPayment {
                id: row.get("id")?,
                contract_id: row.get("contract_id")?,
                amount: row.get("amount")?,
                method: row.get("method")?,
                period_from: row.get("period_from")?,
                period_to: row.get("period_to")?,
                operator_user_id: row.get("operator_user_id")?,
                created_at: row.get("created_at")?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub fn contracts_get_any_by_plate(
    state: State<AppState>,
    plate: String,
) -> Result<Option<Contract>, String> {
    state.check_permission(permissions::CONTRACTS_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let plate_upper = plate.trim().to_uppercase();
    Ok(find_any_contract_for_plate(&conn, &plate_upper))
}
