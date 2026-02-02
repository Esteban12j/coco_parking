//! Daily metrics from persistent store (SQLite). Revenue and transaction count
//! come from table `transactions` so metrics are coherent with Caja (till).

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

#[tauri::command]
pub fn metricas_get_peak_hours(
    state: State<AppState>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<PeakHourSlot>, String> {
    state.check_permission(permissions::METRICAS_DASHBOARD_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let from = date_from.as_deref().unwrap_or(&today);
    let to = date_to.as_deref().unwrap_or(&today);

    let from_bound = format!("{}T00:00:00.000Z", from);
    let to_date = chrono::NaiveDate::parse_from_str(to, "%Y-%m-%d").map_err(|e| e.to_string())?;
    let to_next = to_date
        .succ_opt()
        .map(|d| format!("{}T00:00:00.000Z", d))
        .unwrap_or_else(|| format!("{}T23:59:59.999Z", to));

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

    let slots: Vec<PeakHourSlot> = (0..24)
        .map(|hour_start| {
            let count = *counts_by_hour.get(&hour_start).unwrap_or(&0);
            let hour_label = format!(
                "{:02}:00 - {:02}:00",
                hour_start,
                if hour_start == 23 { 0 } else { hour_start + 1 }
            );
            PeakHourSlot {
                hour_label,
                hour_start,
                count,
            }
        })
        .collect();

    Ok(slots)
}
