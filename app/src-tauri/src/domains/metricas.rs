//! Daily metrics from persistent store (SQLite). Revenue and transaction count
//! come from table `transactions` so metrics are coherent with Caja (till).
//!
//! Hour-by-hour metrics (arrivals, occupancy, exits). All three count only completed turns (vehicles that have exited).
//! - Arrivals: hour of entry (when vehicles arrived, demand for spaces).
//! - Occupancy: vehicles that were occupying a spot during each hour (busiest hours).
//! - Exits (peak_hours): hour of checkout/payment (when spaces free up).
//!
//! All hourly aggregations use the app timezone (Colombia, UTC-5) so labels match local time.

use chrono::{DateTime, FixedOffset, NaiveDate, Timelike, TimeZone, Utc};
use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::permissions;
use crate::state::AppState;

fn utc_to_local_hour(utc_iso: &str) -> Option<u8> {
    let dt = DateTime::parse_from_rfc3339(utc_iso).ok()?.with_timezone(&Utc);
    let colombia = FixedOffset::west_opt(5 * 3600)?;
    let local = dt.with_timezone(&colombia);
    Some(local.hour() as u8)
}

fn local_date_hour_to_utc_range(
    date: NaiveDate,
    hour: u8,
) -> Option<(chrono::DateTime<Utc>, chrono::DateTime<Utc>)> {
    let colombia = FixedOffset::west_opt(5 * 3600)?;
    let local_start = date.and_hms_opt(hour.into(), 0, 0)?;
    let local_end = if hour == 23 {
        date.succ_opt()?.and_hms_opt(0, 0, 0)?
    } else {
        date.and_hms_opt((hour + 1).into(), 0, 0)?
    };
    let utc_start = colombia.from_local_datetime(&local_start).single()?.with_timezone(&Utc);
    let utc_end = colombia.from_local_datetime(&local_end).single()?.with_timezone(&Utc);
    Some((utc_start, utc_end))
}

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

fn date_prefix(s: &str) -> &str {
    let s = s.trim();
    if s.len() >= 10 {
        &s[..10]
    } else {
        s
    }
}

fn date_bounds(
    date_from: Option<&str>,
    date_to: Option<&str>,
    today: &str,
) -> Result<(String, String, chrono::NaiveDate, chrono::NaiveDate), String> {
    let from = date_prefix(date_from.unwrap_or(today));
    let to = date_prefix(date_to.unwrap_or(today));
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
/// Only completed turns. Hour is in app timezone (Colombia).
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
            "SELECT created_at FROM transactions WHERE created_at >= ?1 AND created_at < ?2",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params![&from_bound, &to_next])
        .map_err(|e| e.to_string())?;

    let mut counts_by_hour: std::collections::HashMap<u8, u32> = (0..24).map(|h| (h, 0)).collect();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let created_at: String = row.get(0).map_err(|e| e.to_string())?;
        if let Some(h) = utc_to_local_hour(&created_at) {
            if h < 24 {
                *counts_by_hour.get_mut(&h).unwrap() += 1;
            }
        }
    }

    Ok(build_24_slots(&counts_by_hour))
}

/// Arrivals by hour: count of vehicles that entered per hour (demand for spaces).
/// Only completed turns. Hour is in app timezone (Colombia).
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
            SELECT entry_time FROM vehicles
            WHERE entry_time >= ?1 AND entry_time < ?2 AND exit_time IS NOT NULL
            "#,
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params![&from_bound, &to_next])
        .map_err(|e| e.to_string())?;

    let mut counts_by_hour: std::collections::HashMap<u8, u32> = (0..24).map(|h| (h, 0)).collect();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let entry_time: String = row.get(0).map_err(|e| e.to_string())?;
        if let Some(h) = utc_to_local_hour(&entry_time) {
            if h < 24 {
                *counts_by_hour.get_mut(&h).unwrap() += 1;
            }
        }
    }

    Ok(build_24_slots(&counts_by_hour))
}

/// Occupancy by hour: average number of vehicles occupying a spot during each hour (busiest hours).
/// Only completed turns. Hour buckets are in app timezone (Colombia).
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
        for hour in 0u8..24 {
            let (utc_start, utc_end) = match local_date_hour_to_utc_range(d, hour) {
                Some(pair) => pair,
                None => continue,
            };
            let start_ts = utc_start.to_rfc3339();
            let end_ts = utc_end.to_rfc3339();
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeatmapDayVehicleRow {
    pub day_of_week: u8,
    pub vehicle_type: String,
    pub count: u32,
}

fn hour_in_period(hour: u8, period: &str) -> bool {
    match period {
        "morning" => (6..=11).contains(&hour),
        "midday" => (12..=14).contains(&hour),
        "afternoon" => (15..=18).contains(&hour),
        "night" => hour >= 19 || hour <= 5,
        _ => true,
    }
}

/// Heatmap: count of completed vehicles by day of week and vehicle type.
/// Counts vehicles whose turn ended (exit_time) in the date range; day of week and period come from exit_time.
/// Optional period filter: morning (6–12), midday (12–15), afternoon (15–19), night (19–6).
/// Vehicle types are distinct values from the vehicles table (not a fixed list).
#[tauri::command]
pub fn metricas_get_heatmap_day_vehicle(
    state: State<AppState>,
    date_from: Option<String>,
    date_to: Option<String>,
    period: Option<String>,
) -> Result<Vec<HeatmapDayVehicleRow>, String> {
    state.check_permission(permissions::METRICAS_DASHBOARD_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let (from_bound, to_next, _, _) =
        date_bounds(date_from.as_deref(), date_to.as_deref(), &today)?;

    let period_key = period.as_deref().unwrap_or("");

    let mut stmt = conn
        .prepare(
            r#"
            SELECT
                CAST(COALESCE(strftime('%w', substr(exit_time, 1, 10)), '0') AS INTEGER) as dow,
                CAST(substr(exit_time, 12, 2) AS INTEGER) as h,
                LOWER(vehicle_type) as vehicle_type,
                COUNT(*) as cnt
            FROM vehicles
            WHERE status = 'completed' AND exit_time IS NOT NULL AND length(exit_time) >= 13 AND exit_time >= ?1 AND exit_time < ?2
            GROUP BY dow, h, LOWER(vehicle_type)
            "#,
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params![&from_bound, &to_next])
        .map_err(|e| e.to_string())?;

    let mut acc: std::collections::HashMap<(u8, String), u32> = std::collections::HashMap::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let dow: u8 = row.get::<_, i64>(0).map_err(|e| e.to_string())? as u8;
        let h: u8 = row.get::<_, i64>(1).map_err(|e| e.to_string())? as u8;
        let vt: String = row.get(2).map_err(|e| e.to_string())?;
        let cnt: u32 = row.get::<_, i64>(3).map_err(|e| e.to_string())? as u32;
        if !hour_in_period(h, period_key) {
            continue;
        }
        *acc.entry((dow, vt)).or_insert(0) += cnt;
    }

    let out: Vec<HeatmapDayVehicleRow> = acc
        .into_iter()
        .map(|((day_of_week, vehicle_type), count)| HeatmapDayVehicleRow {
            day_of_week,
            vehicle_type,
            count,
        })
        .collect();

    Ok(out)
}
