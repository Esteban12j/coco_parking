//! Métricas leen del mismo almacén que vehículos: AppState.db (SQLite).
//! Evita duplicación y desalineación front/back; no hay cálculo de métricas solo en frontend.

use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::permissions;
use crate::state::AppState;

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

    let (completed_today, total_revenue): (u32, f64) = conn
        .query_row(
            "SELECT COUNT(*), COALESCE(SUM(total_amount), 0) FROM vehicles WHERE status = 'completed' AND exit_time LIKE ?1",
            params![&today_prefix],
            |row| Ok((row.get::<_, u32>(0)?, row.get::<_, f64>(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let total_vehicles = active_vehicles + completed_today;

    let average_ticket = if completed_today > 0 {
        total_revenue / (completed_today as f64)
    } else {
        0.0
    };

    let sum_stay_minutes: f64 = conn
        .query_row(
            r#"
            SELECT COALESCE(SUM(
                (julianday(exit_time) - julianday(entry_time)) * 24 * 60
            ), 0) FROM vehicles
            WHERE status = 'completed' AND exit_time LIKE ?1
            "#,
            params![&today_prefix],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

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
