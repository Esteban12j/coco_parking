//! Daily metrics from persistent store (SQLite). Revenue and transaction count
//! come from table `transactions` so metrics are coherent with Caja (till).
//!
//! Hour-by-hour metrics (arrivals, occupancy, exits). All three count only completed turns (vehicles that have exited).
//! - Arrivals: hour of entry (when vehicles arrived, demand for spaces).
//! - Occupancy: vehicles that were occupying a spot during each hour (busiest hours).
//! - Exits (peak_hours): hour of checkout/payment (when spaces free up).

use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::permissions;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeakHourSlot {
    pub hour_label: String,
    pub hour_start: u8,
    pub count: u32,
}

fn hour_label(hour_start: u8) -> String {
    format!(
        "{:02}:00 - {:02}:00",
        hour_start,
        if hour_start == 23 { 0 } else { hour_start + 1 }
    )
}

fn date_bounds(
    date_from: Option<&str>,
    date_to: Option<&str>,
    today: &str,
) -> Result<(String, String, chrono::NaiveDate, chrono::NaiveDate), String> {
    let from = date_from.unwrap_or(today);
    let to = date_to.unwrap_or(today);
    let from_bound = format!("{}T00:00:00.000Z", from);
    let to_date = chrono::NaiveDate::parse_from_str(to, "%Y-%m-%d").map_err(|e| e.to_string())?;
    let to_next = to_date
        .succ_opt()
        .map(|d| format!("{}T00:00:00.000Z", d))
        .unwrap_or_else(|| format!("{}T23:59:59.999Z", to));
    let from_date = chrono::NaiveDate::parse_from_str(from, "%Y-%m-%d").map_err(|e| e.to_string())?;
    Ok((from_bound, to_next, from_date, to_date))
}

fn build_24_slots(counts_by_hour: &std::collections::HashMap<u8, u32>) -> Vec<PeakHourSlot> {
    (0..24)
        .map(|hour_start| {
            let count = *counts_by_hour.get(&hour_start).unwrap_or(&0);
            PeakHourSlot {
                hour_label: hour_label(hour_start),
                hour_start,
                count,
            }
        })
        .collect()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyMetrics {
    pub total_vehicles: u32,
    pub active_vehicles: u32,
    pub occupancy_rate: f64,
    pub total_revenue: f64,
    pub average_ticket: f64,
    pub average_stay_minutes: f64,
    pub turnover_rate: f64,
}

const MAX_SPOTS: f64 = 50.0;

#[tauri::command]
pub fn metricas_get_daily(state: State<AppState>) -> Result<DailyMetrics, String> {
    state.check_permission(permissions::METRICAS_DASHBOARD_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let today_prefix = format!("{}%", today);

    let active_vehicles: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM vehicles WHERE status = 'active'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let (completed_today, total_revenue, sum_stay_minutes): (u32, f64, f64) = conn
        .query_row(
            r#"
            SELECT
                COUNT(*),
                COALESCE(SUM(t.amount), 0),
                COALESCE(SUM(
                    (julianday(v.exit_time) - julianday(v.entry_time)) * 24 * 60
                ), 0)
            FROM vehicles v
            INNER JOIN transactions t ON t.vehicle_id = v.id
            WHERE t.created_at LIKE ?1
            "#,
            params![&today_prefix],
            |row| Ok((row.get::<_, i64>(0)? as u32, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    let total_vehicles = active_vehicles + completed_today;

    let average_ticket = if completed_today > 0 {
        total_revenue / (completed_today as f64)
    } else {
        0.0
    };

    let average_stay_minutes = if completed_today > 0 {
        sum_stay_minutes / (completed_today as f64)
    } else {
        0.0
    };

    let occupancy_rate = if MAX_SPOTS > 0.0 {
        ((active_vehicles as f64) / MAX_SPOTS * 100.0).min(100.0)
    } else {
        0.0
    };

    let turnover_rate = if active_vehicles > 0 {
        (completed_today as f64) / (active_vehicles as f64)
    } else {
        0.0
    };

    Ok(DailyMetrics {
        total_vehicles,
        active_vehicles,
        occupancy_rate,
        total_revenue,
        average_ticket,
        average_stay_minutes,
        turnover_rate,
    })
}

/// Exits by hour: count of checkouts/payments per hour (when spaces free up).
/// Only completed turns (transactions exist only when a vehicle has exited). Source: transactions.created_at.
#[tauri::command]
pub fn metricas_get_peak_hours(
    state: State<AppState>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<PeakHourSlot>, String> {
    state.check_permission(permissions::METRICAS_DASHBOARD_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let (from_bound, to_next, _, _) =
        date_bounds(date_from.as_deref(), date_to.as_deref(), &today)?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT CAST(substr(created_at, 12, 2) AS INTEGER) as h, COUNT(*) as cnt
            FROM transactions
            WHERE created_at >= ?1 AND created_at < ?2
            GROUP BY h
            "#,
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params![&from_bound, &to_next])
        .map_err(|e| e.to_string())?;

    let mut counts_by_hour: std::collections::HashMap<u8, u32> = (0..24).map(|h| (h, 0)).collect();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let h: u8 = row.get::<_, i64>(0).map_err(|e| e.to_string())? as u8;
        let cnt: u32 = row.get::<_, i64>(1).map_err(|e| e.to_string())? as u32;
        if h < 24 {
            counts_by_hour.insert(h, cnt);
        }
    }

    Ok(build_24_slots(&counts_by_hour))
}

/// Arrivals by hour: count of vehicles that entered per hour (demand for spaces).
/// Only completed turns (exit_time IS NOT NULL). Source: vehicles.entry_time.
#[tauri::command]
pub fn metricas_get_arrivals_by_hour(
    state: State<AppState>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<PeakHourSlot>, String> {
    state.check_permission(permissions::METRICAS_DASHBOARD_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let (from_bound, to_next, _, _) =
        date_bounds(date_from.as_deref(), date_to.as_deref(), &today)?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT CAST(substr(entry_time, 12, 2) AS INTEGER) as h, COUNT(*) as cnt
            FROM vehicles
            WHERE entry_time >= ?1 AND entry_time < ?2 AND exit_time IS NOT NULL
            GROUP BY h
            "#,
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params![&from_bound, &to_next])
        .map_err(|e| e.to_string())?;

    let mut counts_by_hour: std::collections::HashMap<u8, u32> = (0..24).map(|h| (h, 0)).collect();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let h: u8 = row.get::<_, i64>(0).map_err(|e| e.to_string())? as u8;
        let cnt: u32 = row.get::<_, i64>(1).map_err(|e| e.to_string())? as u32;
        if h < 24 {
            counts_by_hour.insert(h, cnt);
        }
    }

    Ok(build_24_slots(&counts_by_hour))
}

/// Occupancy by hour: average number of vehicles occupying a spot during each hour (busiest hours).
/// Only completed turns (exit_time IS NOT NULL). For each hour H, counts vehicles where
/// entry_time < end_of(H) and exit_time > start_of(H). Over a date range, returns the average per hour of day.
#[tauri::command]
pub fn metricas_get_occupancy_by_hour(
    state: State<AppState>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<PeakHourSlot>, String> {
    state.check_permission(permissions::METRICAS_DASHBOARD_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let (from_bound, to_next, from_date, to_date) =
        date_bounds(date_from.as_deref(), date_to.as_deref(), &today)?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT entry_time, exit_time
            FROM vehicles
            WHERE entry_time < ?1 AND exit_time IS NOT NULL AND exit_time > ?2
            "#,
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params![&to_next, &from_bound])
        .map_err(|e| e.to_string())?;

    let mut entries: Vec<(String, String)> = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let entry_time: String = row.get(0).map_err(|e| e.to_string())?;
        let exit_time: String = row.get(1).map_err(|e| e.to_string())?;
        entries.push((entry_time, exit_time));
    }

    let num_days = (to_date - from_date).num_days() + 1;
    let num_days = num_days.max(1) as f64;

    let mut sum_by_hour: std::collections::HashMap<u8, u32> = (0..24).map(|h| (h, 0)).collect();

    let mut d = from_date;
    while d <= to_date {
        let day_str = d.format("%Y-%m-%d").to_string();
        for hour in 0u8..24 {
            let start_ts = format!("{}T{:02}:00:00.000Z", day_str, hour);
            let end_ts = if hour == 23 {
                let next = d.succ_opt().unwrap_or(d);
                format!("{}T00:00:00.000Z", next.format("%Y-%m-%d"))
            } else {
                format!("{}T{:02}:00:00.000Z", day_str, hour + 1)
            };
            let count = entries
                .iter()
                .filter(|(entry_time, exit_time)| {
                    entry_time.as_str() < end_ts.as_str() && exit_time.as_str() > start_ts.as_str()
                })
                .count() as u32;
            *sum_by_hour.get_mut(&hour).unwrap() += count;
        }
        match d.succ_opt() {
            Some(next) => d = next,
            None => break,
        }
    }

    let counts_by_hour: std::collections::HashMap<u8, u32> = sum_by_hour
        .into_iter()
        .map(|(h, sum)| (h, (sum as f64 / num_days).round() as u32))
        .collect();

    Ok(build_24_slots(&counts_by_hour))
}
