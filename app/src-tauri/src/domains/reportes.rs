//! Report export: predefined types (transactions, completed vehicles, shift closures,
//! transactions+vehicle). Data via JOINs; configurable columns and filters; CSV export.

use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;
use chrono::{NaiveDate, TimeDelta};

use crate::permissions;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReportType {
    Transactions,
    CompletedVehicles,
    ShiftClosures,
    TransactionsWithVehicle,
    VehicleExits,
    Debtors,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnDef {
    pub key: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportData {
    pub columns: Vec<ColumnDef>,
    pub rows: Vec<HashMap<String, serde_json::Value>>,
}

fn transactions_columns() -> Vec<ColumnDef> {
    vec![
        ColumnDef { key: "id".into(), label: "ID".into() },
        ColumnDef { key: "vehicle_id".into(), label: "Vehicle ID".into() },
        ColumnDef { key: "amount".into(), label: "Amount".into() },
        ColumnDef { key: "method".into(), label: "Payment method".into() },
        ColumnDef { key: "created_at".into(), label: "Created at".into() },
    ]
}

fn completed_vehicles_columns() -> Vec<ColumnDef> {
    vec![
        ColumnDef { key: "id".into(), label: "ID".into() },
        ColumnDef { key: "ticket_code".into(), label: "Ticket".into() },
        ColumnDef { key: "plate".into(), label: "Plate".into() },
        ColumnDef { key: "vehicle_type".into(), label: "Vehicle type".into() },
        ColumnDef { key: "entry_time".into(), label: "Entry time".into() },
        ColumnDef { key: "exit_time".into(), label: "Exit time".into() },
        ColumnDef { key: "total_amount".into(), label: "Total amount".into() },
        ColumnDef { key: "debt".into(), label: "Debt".into() },
    ]
}

fn vehicle_exits_columns() -> Vec<ColumnDef> {
    vec![
        ColumnDef { key: "id".into(), label: "ID".into() },
        ColumnDef { key: "ticket_code".into(), label: "Ticket".into() },
        ColumnDef { key: "plate".into(), label: "Plate".into() },
        ColumnDef { key: "vehicle_type".into(), label: "Vehicle type".into() },
        ColumnDef { key: "entry_time".into(), label: "Entry time".into() },
        ColumnDef { key: "exit_time".into(), label: "Exit time".into() },
        ColumnDef { key: "status".into(), label: "Exit type".into() },
        ColumnDef { key: "total_amount".into(), label: "Total amount".into() },
        ColumnDef { key: "debt".into(), label: "Debt".into() },
    ]
}

fn shift_closures_columns() -> Vec<ColumnDef> {
    vec![
        ColumnDef { key: "id".into(), label: "ID".into() },
        ColumnDef { key: "closed_at".into(), label: "Closed at".into() },
        ColumnDef { key: "expected_total".into(), label: "Expected total".into() },
        ColumnDef { key: "cash_total".into(), label: "Cash total".into() },
        ColumnDef { key: "card_total".into(), label: "Card total".into() },
        ColumnDef { key: "transfer_total".into(), label: "Transfer total".into() },
        ColumnDef { key: "arqueo_cash".into(), label: "Arqueo cash".into() },
        ColumnDef { key: "discrepancy".into(), label: "Discrepancy".into() },
        ColumnDef { key: "total_transactions".into(), label: "Total transactions".into() },
        ColumnDef { key: "notes".into(), label: "Notes".into() },
    ]
}

fn transactions_with_vehicle_columns() -> Vec<ColumnDef> {
    vec![
        ColumnDef { key: "transaction_id".into(), label: "Transaction ID".into() },
        ColumnDef { key: "created_at".into(), label: "Created at".into() },
        ColumnDef { key: "amount".into(), label: "Amount".into() },
        ColumnDef { key: "method".into(), label: "Payment method".into() },
        ColumnDef { key: "vehicle_id".into(), label: "Vehicle ID".into() },
        ColumnDef { key: "ticket_code".into(), label: "Ticket".into() },
        ColumnDef { key: "plate".into(), label: "Plate".into() },
        ColumnDef { key: "vehicle_type".into(), label: "Vehicle type".into() },
        ColumnDef { key: "entry_time".into(), label: "Entry time".into() },
        ColumnDef { key: "exit_time".into(), label: "Exit time".into() },
    ]
}

fn debtors_columns() -> Vec<ColumnDef> {
    vec![
        ColumnDef { key: "plate".into(), label: "Plate".into() },
        ColumnDef { key: "total_debt".into(), label: "Total debt".into() },
        ColumnDef { key: "oldest_exit_time".into(), label: "Oldest exit (since)".into() },
        ColumnDef { key: "sessions_with_debt".into(), label: "Sessions with debt".into() },
    ]
}

fn all_columns_for_type(report_type: &ReportType) -> Vec<ColumnDef> {
    match report_type {
        ReportType::Transactions => transactions_columns(),
        ReportType::CompletedVehicles => completed_vehicles_columns(),
        ReportType::ShiftClosures => shift_closures_columns(),
        ReportType::TransactionsWithVehicle => transactions_with_vehicle_columns(),
        ReportType::VehicleExits => vehicle_exits_columns(),
        ReportType::Debtors => debtors_columns(),
    }
}

fn filter_columns(all: &[ColumnDef], selected_keys: &[String]) -> Vec<ColumnDef> {
    if selected_keys.is_empty() {
        return all.to_vec();
    }
    let set: std::collections::HashSet<&str> = selected_keys.iter().map(String::as_str).collect();
    all.iter()
        .filter(|c| set.contains(c.key.as_str()))
        .cloned()
        .collect()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportFilters {
    pub date_from: String,
    pub date_to: String,
    pub payment_method: Option<String>,
    pub vehicle_type: Option<String>,
}

fn normalize_date_prefix(s: &str) -> String {
    let s = s.trim();
    if s.len() >= 10 {
        format!("{}%", &s[..10])
    } else {
        format!("{}%", s)
    }
}

/// Exclusive end for date range: next day at 00:00:00 UTC (ISO format).
/// Stored timestamps are ISO (e.g. 2026-01-02T12:00:00.000Z); using "YYYY-MM-DD 23:59:59"
/// would sort before "T" and exclude that day. So we use "YYYY-MM-DD+1T00:00:00.000Z".
fn date_to_end(date_to: &str) -> String {
    let s = date_to.trim();
    let day = if s.len() >= 10 { &s[..10] } else { s };
    NaiveDate::parse_from_str(day, "%Y-%m-%d")
        .ok()
        .and_then(|d| d.checked_add_signed(TimeDelta::days(1)))
        .map(|d| format!("{}T00:00:00.000Z", d))
        .unwrap_or_else(|| format!("{} 23:59:59.999", day))
}

fn run_transactions(
    conn: &rusqlite::Connection,
    date_from: &str,
    date_to: &str,
    payment_method: Option<&str>,
    columns: &[ColumnDef],
) -> Result<Vec<HashMap<String, serde_json::Value>>, String> {
    let from_prefix = normalize_date_prefix(date_from);
    let to_end = date_to_end(date_to);
    let keys: Vec<String> = columns.iter().map(|c| c.key.clone()).collect();

    let mut list = Vec::new();
    if let Some(m) = payment_method {
        let m = m.to_lowercase();
        if ["cash", "card", "transfer"].contains(&m.as_str()) {
            let mut stmt = conn
                .prepare("SELECT id, vehicle_id, amount, method, created_at FROM transactions WHERE created_at >= ?1 AND created_at < ?2 AND LOWER(method) = ?3 ORDER BY created_at ASC")
                .map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![from_prefix, to_end, m], |row| {
                let mut map = HashMap::new();
                if keys.contains(&"id".to_string()) {
                    map.insert("id".into(), serde_json::json!(row.get::<_, String>(0)?));
                }
                if keys.contains(&"vehicle_id".to_string()) {
                    map.insert("vehicle_id".into(), serde_json::json!(row.get::<_, String>(1)?));
                }
                if keys.contains(&"amount".to_string()) {
                    map.insert("amount".into(), serde_json::json!(row.get::<_, f64>(2)?));
                }
                if keys.contains(&"method".to_string()) {
                    map.insert("method".into(), serde_json::json!(row.get::<_, String>(3)?));
                }
                if keys.contains(&"created_at".to_string()) {
                    map.insert("created_at".into(), serde_json::json!(row.get::<_, String>(4)?));
                }
                Ok(map)
            }).map_err(|e| e.to_string())?;
            for row in rows {
                list.push(row.map_err(|e| e.to_string())?);
            }
            return Ok(list);
        }
    }
    let mut stmt = conn
        .prepare("SELECT id, vehicle_id, amount, method, created_at FROM transactions WHERE created_at >= ?1 AND created_at < ?2 ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![from_prefix, to_end], |row| {
        let mut map = HashMap::new();
        if keys.contains(&"id".to_string()) {
            map.insert("id".into(), serde_json::json!(row.get::<_, String>(0)?));
        }
        if keys.contains(&"vehicle_id".to_string()) {
            map.insert("vehicle_id".into(), serde_json::json!(row.get::<_, String>(1)?));
        }
        if keys.contains(&"amount".to_string()) {
            map.insert("amount".into(), serde_json::json!(row.get::<_, f64>(2)?));
        }
        if keys.contains(&"method".to_string()) {
            map.insert("method".into(), serde_json::json!(row.get::<_, String>(3)?));
        }
        if keys.contains(&"created_at".to_string()) {
            map.insert("created_at".into(), serde_json::json!(row.get::<_, String>(4)?));
        }
        Ok(map)
    }).map_err(|e| e.to_string())?;
    for row in rows {
        list.push(row.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

fn run_completed_vehicles(
    conn: &rusqlite::Connection,
    date_from: &str,
    date_to: &str,
    vehicle_type: Option<&str>,
    columns: &[ColumnDef],
) -> Result<Vec<HashMap<String, serde_json::Value>>, String> {
    let from_prefix = normalize_date_prefix(date_from);
    let to_end = date_to_end(date_to);
    let keys: Vec<String> = columns.iter().map(|c| c.key.clone()).collect();

    let mut list = Vec::new();
    if let Some(vt) = vehicle_type {
        let vt = vt.to_lowercase();
        if ["car", "motorcycle", "truck", "bicycle"].contains(&vt.as_str()) {
            let mut stmt = conn
                .prepare("SELECT id, ticket_code, plate, vehicle_type, entry_time, exit_time, total_amount, debt FROM vehicles WHERE status = 'completed' AND exit_time IS NOT NULL AND exit_time >= ?1 AND exit_time < ?2 AND LOWER(vehicle_type) = ?3 ORDER BY exit_time ASC")
                .map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![from_prefix, to_end, vt], |row| {
                let mut map = HashMap::new();
                if keys.contains(&"id".to_string()) {
                    map.insert("id".into(), serde_json::json!(row.get::<_, String>(0)?));
                }
                if keys.contains(&"ticket_code".to_string()) {
                    map.insert("ticket_code".into(), serde_json::json!(row.get::<_, String>(1)?));
                }
                if keys.contains(&"plate".to_string()) {
                    map.insert("plate".into(), serde_json::json!(row.get::<_, String>(2)?));
                }
                if keys.contains(&"vehicle_type".to_string()) {
                    map.insert("vehicle_type".into(), serde_json::json!(row.get::<_, String>(3)?));
                }
                if keys.contains(&"entry_time".to_string()) {
                    map.insert("entry_time".into(), serde_json::json!(row.get::<_, String>(4)?));
                }
                if keys.contains(&"exit_time".to_string()) {
                    map.insert("exit_time".into(), serde_json::json!(row.get::<_, Option<String>>(5)?));
                }
                if keys.contains(&"total_amount".to_string()) {
                    map.insert("total_amount".into(), serde_json::json!(row.get::<_, Option<f64>>(6)?));
                }
                if keys.contains(&"debt".to_string()) {
                    map.insert("debt".into(), serde_json::json!(row.get::<_, Option<f64>>(7)?));
                }
                Ok(map)
            }).map_err(|e| e.to_string())?;
            for row in rows {
                list.push(row.map_err(|e| e.to_string())?);
            }
            return Ok(list);
        }
    }
    let mut stmt = conn
        .prepare("SELECT id, ticket_code, plate, vehicle_type, entry_time, exit_time, total_amount, debt FROM vehicles WHERE status = 'completed' AND exit_time IS NOT NULL AND exit_time >= ?1 AND exit_time < ?2 ORDER BY exit_time ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![from_prefix, to_end], |row| {
        let mut map = HashMap::new();
        if keys.contains(&"id".to_string()) {
            map.insert("id".into(), serde_json::json!(row.get::<_, String>(0)?));
        }
        if keys.contains(&"ticket_code".to_string()) {
            map.insert("ticket_code".into(), serde_json::json!(row.get::<_, String>(1)?));
        }
        if keys.contains(&"plate".to_string()) {
            map.insert("plate".into(), serde_json::json!(row.get::<_, String>(2)?));
        }
        if keys.contains(&"vehicle_type".to_string()) {
            map.insert("vehicle_type".into(), serde_json::json!(row.get::<_, String>(3)?));
        }
        if keys.contains(&"entry_time".to_string()) {
            map.insert("entry_time".into(), serde_json::json!(row.get::<_, String>(4)?));
        }
        if keys.contains(&"exit_time".to_string()) {
            map.insert("exit_time".into(), serde_json::json!(row.get::<_, Option<String>>(5)?));
        }
        if keys.contains(&"total_amount".to_string()) {
            map.insert("total_amount".into(), serde_json::json!(row.get::<_, Option<f64>>(6)?));
        }
        if keys.contains(&"debt".to_string()) {
            map.insert("debt".into(), serde_json::json!(row.get::<_, Option<f64>>(7)?));
        }
        Ok(map)
    }).map_err(|e| e.to_string())?;
    for row in rows {
        list.push(row.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

fn run_vehicle_exits(
    conn: &rusqlite::Connection,
    date_from: &str,
    date_to: &str,
    vehicle_type: Option<&str>,
    columns: &[ColumnDef],
) -> Result<Vec<HashMap<String, serde_json::Value>>, String> {
    let from_prefix = normalize_date_prefix(date_from);
    let to_end = date_to_end(date_to);
    let keys: Vec<String> = columns.iter().map(|c| c.key.clone()).collect();

    let mut list = Vec::new();
    if let Some(vt) = vehicle_type {
        let vt = vt.to_lowercase();
        if ["car", "motorcycle", "truck", "bicycle"].contains(&vt.as_str()) {
            let mut stmt = conn
                .prepare("SELECT id, ticket_code, plate, vehicle_type, entry_time, exit_time, status, total_amount, debt FROM vehicles WHERE status IN ('completed', 'removed') AND exit_time IS NOT NULL AND exit_time >= ?1 AND exit_time < ?2 AND LOWER(vehicle_type) = ?3 ORDER BY exit_time ASC")
                .map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![from_prefix, to_end, vt], |row| {
                let mut map = HashMap::new();
                if keys.contains(&"id".to_string()) {
                    map.insert("id".into(), serde_json::json!(row.get::<_, String>(0)?));
                }
                if keys.contains(&"ticket_code".to_string()) {
                    map.insert("ticket_code".into(), serde_json::json!(row.get::<_, String>(1)?));
                }
                if keys.contains(&"plate".to_string()) {
                    map.insert("plate".into(), serde_json::json!(row.get::<_, String>(2)?));
                }
                if keys.contains(&"vehicle_type".to_string()) {
                    map.insert("vehicle_type".into(), serde_json::json!(row.get::<_, String>(3)?));
                }
                if keys.contains(&"entry_time".to_string()) {
                    map.insert("entry_time".into(), serde_json::json!(row.get::<_, String>(4)?));
                }
                if keys.contains(&"exit_time".to_string()) {
                    map.insert("exit_time".into(), serde_json::json!(row.get::<_, Option<String>>(5)?));
                }
                if keys.contains(&"status".to_string()) {
                    map.insert("status".into(), serde_json::json!(row.get::<_, String>(6)?));
                }
                if keys.contains(&"total_amount".to_string()) {
                    map.insert("total_amount".into(), serde_json::json!(row.get::<_, Option<f64>>(7)?));
                }
                if keys.contains(&"debt".to_string()) {
                    map.insert("debt".into(), serde_json::json!(row.get::<_, Option<f64>>(8)?));
                }
                Ok(map)
            }).map_err(|e| e.to_string())?;
            for row in rows {
                list.push(row.map_err(|e| e.to_string())?);
            }
            return Ok(list);
        }
    }
    let mut stmt = conn
        .prepare("SELECT id, ticket_code, plate, vehicle_type, entry_time, exit_time, status, total_amount, debt FROM vehicles WHERE status IN ('completed', 'removed') AND exit_time IS NOT NULL AND exit_time >= ?1 AND exit_time < ?2 ORDER BY exit_time ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![from_prefix, to_end], |row| {
        let mut map = HashMap::new();
        if keys.contains(&"id".to_string()) {
            map.insert("id".into(), serde_json::json!(row.get::<_, String>(0)?));
        }
        if keys.contains(&"ticket_code".to_string()) {
            map.insert("ticket_code".into(), serde_json::json!(row.get::<_, String>(1)?));
        }
        if keys.contains(&"plate".to_string()) {
            map.insert("plate".into(), serde_json::json!(row.get::<_, String>(2)?));
        }
        if keys.contains(&"vehicle_type".to_string()) {
            map.insert("vehicle_type".into(), serde_json::json!(row.get::<_, String>(3)?));
        }
        if keys.contains(&"entry_time".to_string()) {
            map.insert("entry_time".into(), serde_json::json!(row.get::<_, String>(4)?));
        }
        if keys.contains(&"exit_time".to_string()) {
            map.insert("exit_time".into(), serde_json::json!(row.get::<_, Option<String>>(5)?));
        }
        if keys.contains(&"status".to_string()) {
            map.insert("status".into(), serde_json::json!(row.get::<_, String>(6)?));
        }
        if keys.contains(&"total_amount".to_string()) {
            map.insert("total_amount".into(), serde_json::json!(row.get::<_, Option<f64>>(7)?));
        }
        if keys.contains(&"debt".to_string()) {
            map.insert("debt".into(), serde_json::json!(row.get::<_, Option<f64>>(8)?));
        }
        Ok(map)
    }).map_err(|e| e.to_string())?;
    for row in rows {
        list.push(row.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

fn run_shift_closures(
    conn: &rusqlite::Connection,
    date_from: &str,
    date_to: &str,
    columns: &[ColumnDef],
) -> Result<Vec<HashMap<String, serde_json::Value>>, String> {
    let from_prefix = normalize_date_prefix(date_from);
    let to_end = date_to_end(date_to);

    let sql = "SELECT id, closed_at, expected_total, cash_total, card_total, transfer_total, arqueo_cash, discrepancy, total_transactions, notes FROM shift_closures WHERE closed_at >= ?1 AND closed_at < ?2 ORDER BY closed_at ASC";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let keys: Vec<String> = columns.iter().map(|c| c.key.clone()).collect();
    let rows = stmt
        .query_map(params![from_prefix, to_end], |row| {
            let mut map = HashMap::new();
            if keys.contains(&"id".to_string()) {
                map.insert("id".into(), serde_json::json!(row.get::<_, String>(0)?));
            }
            if keys.contains(&"closed_at".to_string()) {
                map.insert("closed_at".into(), serde_json::json!(row.get::<_, String>(1)?));
            }
            if keys.contains(&"expected_total".to_string()) {
                map.insert("expected_total".into(), serde_json::json!(row.get::<_, f64>(2)?));
            }
            if keys.contains(&"cash_total".to_string()) {
                map.insert("cash_total".into(), serde_json::json!(row.get::<_, f64>(3)?));
            }
            if keys.contains(&"card_total".to_string()) {
                map.insert("card_total".into(), serde_json::json!(row.get::<_, f64>(4)?));
            }
            if keys.contains(&"transfer_total".to_string()) {
                map.insert("transfer_total".into(), serde_json::json!(row.get::<_, f64>(5)?));
            }
            if keys.contains(&"arqueo_cash".to_string()) {
                map.insert("arqueo_cash".into(), serde_json::json!(row.get::<_, Option<f64>>(6)?));
            }
            if keys.contains(&"discrepancy".to_string()) {
                map.insert("discrepancy".into(), serde_json::json!(row.get::<_, f64>(7)?));
            }
            if keys.contains(&"total_transactions".to_string()) {
                map.insert("total_transactions".into(), serde_json::json!(row.get::<_, i64>(8)?));
            }
            if keys.contains(&"notes".to_string()) {
                map.insert("notes".into(), serde_json::json!(row.get::<_, Option<String>>(9)?));
            }
            Ok(map)
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for row in rows {
        list.push(row.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

fn run_transactions_with_vehicle(
    conn: &rusqlite::Connection,
    date_from: &str,
    date_to: &str,
    payment_method: Option<&str>,
    vehicle_type: Option<&str>,
    columns: &[ColumnDef],
) -> Result<Vec<HashMap<String, serde_json::Value>>, String> {
    let from_prefix = normalize_date_prefix(date_from);
    let to_end = date_to_end(date_to);
    let keys: Vec<String> = columns.iter().map(|c| c.key.clone()).collect();

    let base_sql = "SELECT t.id AS transaction_id, t.created_at, t.amount, t.method, v.id AS vehicle_id, v.ticket_code, v.plate, v.vehicle_type, v.entry_time, v.exit_time FROM transactions t INNER JOIN vehicles v ON v.id = t.vehicle_id WHERE t.created_at >= ?1 AND t.created_at < ?2";
    let map_row = |row: &rusqlite::Row| -> Result<HashMap<String, serde_json::Value>, rusqlite::Error> {
        let mut map = HashMap::new();
        if keys.contains(&"transaction_id".to_string()) {
            map.insert("transaction_id".into(), serde_json::json!(row.get::<_, String>(0)?));
        }
        if keys.contains(&"created_at".to_string()) {
            map.insert("created_at".into(), serde_json::json!(row.get::<_, String>(1)?));
        }
        if keys.contains(&"amount".to_string()) {
            map.insert("amount".into(), serde_json::json!(row.get::<_, f64>(2)?));
        }
        if keys.contains(&"method".to_string()) {
            map.insert("method".into(), serde_json::json!(row.get::<_, String>(3)?));
        }
        if keys.contains(&"vehicle_id".to_string()) {
            map.insert("vehicle_id".into(), serde_json::json!(row.get::<_, String>(4)?));
        }
        if keys.contains(&"ticket_code".to_string()) {
            map.insert("ticket_code".into(), serde_json::json!(row.get::<_, String>(5)?));
        }
        if keys.contains(&"plate".to_string()) {
            map.insert("plate".into(), serde_json::json!(row.get::<_, String>(6)?));
        }
        if keys.contains(&"vehicle_type".to_string()) {
            map.insert("vehicle_type".into(), serde_json::json!(row.get::<_, String>(7)?));
        }
        if keys.contains(&"entry_time".to_string()) {
            map.insert("entry_time".into(), serde_json::json!(row.get::<_, String>(8)?));
        }
        if keys.contains(&"exit_time".to_string()) {
            map.insert("exit_time".into(), serde_json::json!(row.get::<_, Option<String>>(9)?));
        }
        Ok(map)
    };

    let mut list = Vec::new();
    let pm = payment_method.filter(|m| ["cash", "card", "transfer"].contains(&m.to_lowercase().as_str()));
    let vt = vehicle_type.filter(|v| ["car", "motorcycle", "truck", "bicycle"].contains(&v.to_lowercase().as_str()));

    match (pm, vt) {
        (Some(m), Some(v)) => {
            let m = m.to_lowercase();
            let v = v.to_lowercase();
            let sql = format!("{} AND LOWER(t.method) = ?3 AND LOWER(v.vehicle_type) = ?4 ORDER BY t.created_at ASC", base_sql);
            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![from_prefix, to_end, m, v], |row| map_row(&row)).map_err(|e| e.to_string())?;
            for row in rows {
                list.push(row.map_err(|e| e.to_string())?);
            }
        }
        (Some(m), None) => {
            let m = m.to_lowercase();
            let sql = format!("{} AND LOWER(t.method) = ?3 ORDER BY t.created_at ASC", base_sql);
            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![from_prefix, to_end, m], |row| map_row(&row)).map_err(|e| e.to_string())?;
            for row in rows {
                list.push(row.map_err(|e| e.to_string())?);
            }
        }
        (None, Some(v)) => {
            let v = v.to_lowercase();
            let sql = format!("{} AND LOWER(v.vehicle_type) = ?3 ORDER BY t.created_at ASC", base_sql);
            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![from_prefix, to_end, v], |row| map_row(&row)).map_err(|e| e.to_string())?;
            for row in rows {
                list.push(row.map_err(|e| e.to_string())?);
            }
        }
        (None, None) => {
            let sql = format!("{} ORDER BY t.created_at ASC", base_sql);
            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![from_prefix, to_end], |row| map_row(&row)).map_err(|e| e.to_string())?;
            for row in rows {
                list.push(row.map_err(|e| e.to_string())?);
            }
        }
    }
    Ok(list)
}

fn run_debtors(
    conn: &rusqlite::Connection,
    columns: &[ColumnDef],
) -> Result<Vec<HashMap<String, serde_json::Value>>, String> {
    let keys: Vec<String> = columns.iter().map(|c| c.key.clone()).collect();
    let sql = r#"
        SELECT plate_upper AS plate,
               SUM(COALESCE(debt, 0)) AS total_debt,
               MIN(exit_time) AS oldest_exit_time,
               COUNT(*) AS sessions_with_debt
        FROM vehicles
        WHERE plate_upper IS NOT NULL AND plate_upper != '' AND COALESCE(debt, 0) > 0
        GROUP BY plate_upper
        ORDER BY total_debt DESC
    "#;
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let mut map = HashMap::new();
            if keys.contains(&"plate".to_string()) {
                map.insert("plate".into(), serde_json::json!(row.get::<_, String>(0)?));
            }
            if keys.contains(&"total_debt".to_string()) {
                map.insert("total_debt".into(), serde_json::json!(row.get::<_, f64>(1)?));
            }
            if keys.contains(&"oldest_exit_time".to_string()) {
                map.insert("oldest_exit_time".into(), serde_json::json!(row.get::<_, Option<String>>(2)?));
            }
            if keys.contains(&"sessions_with_debt".to_string()) {
                map.insert("sessions_with_debt".into(), serde_json::json!(row.get::<_, i64>(3)? as i32));
            }
            Ok(map)
        })
        .map_err(|e| e.to_string())?;
    let mut list = Vec::new();
    for row in rows {
        list.push(row.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub fn reportes_get_column_definitions(report_type: ReportType) -> Vec<ColumnDef> {
    all_columns_for_type(&report_type)
}

#[tauri::command]
pub fn reportes_fetch(
    state: State<AppState>,
    report_type: ReportType,
    filters: ReportFilters,
    selected_columns: Option<Vec<String>>,
) -> Result<ReportData, String> {
    state.check_permission(permissions::METRICAS_REPORTS_EXPORT)?;
    if report_type == ReportType::Debtors {
        state.check_permission(permissions::CAJA_DEBTORS_READ)?;
    }
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let all = all_columns_for_type(&report_type);
    let columns = filter_columns(
        &all,
        &selected_columns.unwrap_or_default(),
    );
    if columns.is_empty() {
        return Err("At least one column must be selected".to_string());
    }

    let rows = match &report_type {
        ReportType::Transactions => run_transactions(
            &conn,
            &filters.date_from,
            &filters.date_to,
            filters.payment_method.as_deref(),
            &columns,
        )?,
        ReportType::CompletedVehicles => run_completed_vehicles(
            &conn,
            &filters.date_from,
            &filters.date_to,
            filters.vehicle_type.as_deref(),
            &columns,
        )?,
        ReportType::ShiftClosures => run_shift_closures(
            &conn,
            &filters.date_from,
            &filters.date_to,
            &columns,
        )?,
        ReportType::TransactionsWithVehicle => run_transactions_with_vehicle(
            &conn,
            &filters.date_from,
            &filters.date_to,
            filters.payment_method.as_deref(),
            filters.vehicle_type.as_deref(),
            &columns,
        )?,
        ReportType::VehicleExits => run_vehicle_exits(
            &conn,
            &filters.date_from,
            &filters.date_to,
            filters.vehicle_type.as_deref(),
            &columns,
        )?,
        ReportType::Debtors => run_debtors(&conn, &columns)?,
    };

    Ok(ReportData { columns, rows })
}

fn row_to_csv_line(columns: &[ColumnDef], row: &HashMap<String, serde_json::Value>) -> String {
    let mut cells = Vec::with_capacity(columns.len());
    for col in columns {
        let v = row.get(&col.key).unwrap_or(&serde_json::Value::Null);
        let s = match v {
            serde_json::Value::String(x) => x.clone(),
            serde_json::Value::Number(x) => x.to_string(),
            serde_json::Value::Bool(x) => x.to_string(),
            serde_json::Value::Null => String::new(),
            _ => v.to_string(),
        };
        let escaped = if s.contains(',') || s.contains('"') || s.contains('\n') {
            format!("\"{}\"", s.replace('"', "\"\""))
        } else {
            s
        };
        cells.push(escaped);
    }
    cells.join(",")
}

#[tauri::command]
pub fn reportes_write_csv(
    state: State<AppState>,
    report_type: ReportType,
    filters: ReportFilters,
    selected_columns: Option<Vec<String>>,
    path: String,
) -> Result<(), String> {
    state.check_permission(permissions::METRICAS_REPORTS_EXPORT)?;
    if report_type == ReportType::Debtors {
        state.check_permission(permissions::CAJA_DEBTORS_READ)?;
    }
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let all = all_columns_for_type(&report_type);
    let columns = filter_columns(
        &all,
        &selected_columns.unwrap_or_default(),
    );
    if columns.is_empty() {
        return Err("At least one column must be selected".to_string());
    }

    let rows = match &report_type {
        ReportType::Transactions => run_transactions(
            &conn,
            &filters.date_from,
            &filters.date_to,
            filters.payment_method.as_deref(),
            &columns,
        )?,
        ReportType::CompletedVehicles => run_completed_vehicles(
            &conn,
            &filters.date_from,
            &filters.date_to,
            filters.vehicle_type.as_deref(),
            &columns,
        )?,
        ReportType::ShiftClosures => run_shift_closures(
            &conn,
            &filters.date_from,
            &filters.date_to,
            &columns,
        )?,
        ReportType::TransactionsWithVehicle => run_transactions_with_vehicle(
            &conn,
            &filters.date_from,
            &filters.date_to,
            filters.payment_method.as_deref(),
            filters.vehicle_type.as_deref(),
            &columns,
        )?,
        ReportType::VehicleExits => run_vehicle_exits(
            &conn,
            &filters.date_from,
            &filters.date_to,
            filters.vehicle_type.as_deref(),
            &columns,
        )?,
        ReportType::Debtors => run_debtors(&conn, &columns)?,
    };

    let header: String = columns.iter().map(|c| c.label.as_str()).collect::<Vec<_>>().join(",");
    let mut lines = vec![header];
    for row in &rows {
        lines.push(row_to_csv_line(&columns, row));
    }
    let content = lines.join("\n");
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}
