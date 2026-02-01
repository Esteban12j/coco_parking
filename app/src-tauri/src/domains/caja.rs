//! Caja (tesorería) lee del mismo almacén que vehículos: AppState.db (SQLite).
//! Evita duplicación y desalineación front/back; no hay cálculo de tesorería solo en frontend.

use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::permissions;
use crate::state::AppState;

/// Dev-only: verifica qué lee caja_get_treasury (today, conteos, suma del día, muestra de transacciones).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CajaDebug {
    pub today_utc: String,
    pub today_prefix: String,
    pub total_transactions_all: u32,
    pub total_transactions_today: u32,
    /// Sum of amounts for today's transactions (to verify expected_cash).
    pub sum_today: f64,
    pub last_transactions: Vec<(String, f64, String, String)>,
}

#[tauri::command]
pub fn caja_get_debug(state: State<AppState>) -> Result<CajaDebug, String> {
    state.check_permission(permissions::CAJA_TREASURY_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let today_prefix = format!("{}%", today);

    let total_transactions_all: u32 = conn
        .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let total_transactions_today: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM transactions WHERE created_at LIKE ?1",
            params![&today_prefix],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let sum_today: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE created_at LIKE ?1",
            params![&today_prefix],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let mut last_transactions = Vec::new();
    let mut stmt = conn
        .prepare(
            "SELECT id, amount, method, created_at FROM transactions ORDER BY created_at DESC LIMIT 5",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?, r.get::<_, String>(2)?, r.get::<_, String>(3)?)))
        .map_err(|e| e.to_string())?;
    for row in rows {
        last_transactions.push(row.map_err(|e| e.to_string())?);
    }

    Ok(CajaDebug {
        today_utc: today.clone(),
        today_prefix: today_prefix.clone(),
        total_transactions_all,
        total_transactions_today,
        sum_today,
        last_transactions,
    })
}

/// Fuente única: solo tabla transactions. No hay fallback a otras tablas.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreasuryData {
    pub expected_cash: f64,
    pub actual_cash: f64,
    pub discrepancy: f64,
    pub total_transactions: u32,
    pub payment_breakdown: PaymentBreakdown,
}

#[derive(Debug, Clone, Serialize)]
pub struct PaymentBreakdown {
    pub cash: f64,
    pub card: f64,
    pub transfer: f64,
}

#[tauri::command]
pub fn caja_get_treasury(state: State<AppState>) -> Result<TreasuryData, String> {
    state.check_permission(permissions::CAJA_TREASURY_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let today_prefix = format!("{}%", today);

    let total_transactions: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM transactions WHERE created_at LIKE ?1",
            params![&today_prefix],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let (cash, card, transfer) = if total_transactions > 0 {
        let cash: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE created_at LIKE ?1 AND LOWER(method) = 'cash'",
                params![&today_prefix],
                |row| row.get(0),
            )
            .unwrap_or(0.0);

        let card: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE created_at LIKE ?1 AND LOWER(method) = 'card'",
                params![&today_prefix],
                |row| row.get(0),
            )
            .unwrap_or(0.0);

        let transfer: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE created_at LIKE ?1 AND LOWER(method) = 'transfer'",
                params![&today_prefix],
                |row| row.get(0),
            )
            .unwrap_or(0.0);

        (cash, card, transfer)
    } else {
        (0.0, 0.0, 0.0)
    };

    let expected_cash = cash + card + transfer;
    let actual_cash = expected_cash;
    let discrepancy = 0.0;

    Ok(TreasuryData {
        expected_cash,
        actual_cash,
        discrepancy,
        total_transactions,
        payment_breakdown: PaymentBreakdown {
            cash,
            card,
            transfer,
        },
    })
}

#[tauri::command]
pub fn caja_close_shift(state: State<AppState>) -> Result<String, String> {
    state.check_permission(permissions::CAJA_SHIFT_CLOSE)?;
    Ok("Shift closed (placeholder)".to_string())
}
