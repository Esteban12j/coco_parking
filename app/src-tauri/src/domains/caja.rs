//! Caja (tesorería) lee del mismo almacén que vehículos: AppState.db (SQLite).
//! Evita duplicación y desalineación front/back; no hay cálculo de tesorería solo en frontend.

use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::id_gen;
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShiftClosure {
    pub id: String,
    pub closed_at: String,
    pub expected_total: f64,
    pub cash_total: f64,
    pub card_total: f64,
    pub transfer_total: f64,
    pub arqueo_cash: Option<f64>,
    pub discrepancy: f64,
    pub total_transactions: u32,
    pub notes: Option<String>,
}

#[tauri::command]
pub fn caja_close_shift(
    state: State<AppState>,
    arqueo_cash: Option<f64>,
    notes: Option<String>,
) -> Result<ShiftClosure, String> {
    state.check_permission(permissions::CAJA_SHIFT_CLOSE)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let now = chrono::Utc::now();
    let now_rfc = now.to_rfc3339();
    let today_str = now.format("%Y-%m-%d").to_string();
    let today_prefix = format!("{}%", today_str);
    let since_str = conn
        .query_row(
            "SELECT closed_at FROM shift_closures WHERE closed_at LIKE ?1 AND closed_at < ?2 ORDER BY closed_at DESC LIMIT 1",
            params![&today_prefix, &now_rfc],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .unwrap_or_else(|| format!("{}T00:00:00.000Z", today_str));

    let total_transactions: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM transactions WHERE created_at > ?1 AND created_at <= ?2",
            params![&since_str, &now_rfc],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let (cash_total, card_total, transfer_total) = if total_transactions > 0 {
        let cash: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE created_at > ?1 AND created_at <= ?2 AND LOWER(method) = 'cash'",
                params![&since_str, &now_rfc],
                |row| row.get(0),
            )
            .unwrap_or(0.0);
        let card: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE created_at > ?1 AND created_at <= ?2 AND LOWER(method) = 'card'",
                params![&since_str, &now_rfc],
                |row| row.get(0),
            )
            .unwrap_or(0.0);
        let transfer: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE created_at > ?1 AND created_at <= ?2 AND LOWER(method) = 'transfer'",
                params![&since_str, &now_rfc],
                |row| row.get(0),
            )
            .unwrap_or(0.0);
        (cash, card, transfer)
    } else {
        (0.0, 0.0, 0.0)
    };

    let expected_total = cash_total + card_total + transfer_total;
    let discrepancy = arqueo_cash
        .map(|a| a - cash_total)
        .unwrap_or(0.0);

    let id = id_gen::generate_id(id_gen::PREFIX_SHIFT_CLOSURE);
    let closed_at = now_rfc.clone();

    conn.execute(
        "INSERT INTO shift_closures (id, closed_at, expected_total, cash_total, card_total, transfer_total, arqueo_cash, discrepancy, total_transactions, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            &id,
            &closed_at,
            expected_total,
            cash_total,
            card_total,
            transfer_total,
            arqueo_cash,
            discrepancy,
            total_transactions as i64,
            notes.as_deref(),
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(ShiftClosure {
        id: id.clone(),
        closed_at: closed_at.clone(),
        expected_total,
        cash_total,
        card_total,
        transfer_total,
        arqueo_cash,
        discrepancy,
        total_transactions,
        notes,
    })
}

#[tauri::command]
pub fn caja_list_shift_closures(
    state: State<AppState>,
    limit: Option<u32>,
) -> Result<Vec<ShiftClosure>, String> {
    state.check_permission(permissions::CAJA_TREASURY_READ)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50).min(200) as i64;

    let mut stmt = conn
        .prepare(
            "SELECT id, closed_at, expected_total, cash_total, card_total, transfer_total, arqueo_cash, discrepancy, total_transactions, notes FROM shift_closures ORDER BY closed_at DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(ShiftClosure {
                id: row.get(0)?,
                closed_at: row.get(1)?,
                expected_total: row.get(2)?,
                cash_total: row.get(3)?,
                card_total: row.get(4)?,
                transfer_total: row.get(5)?,
                arqueo_cash: row.get(6)?,
                discrepancy: row.get(7)?,
                total_transactions: row.get::<_, i64>(8)? as u32,
                notes: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for row in rows {
        list.push(row.map_err(|e| e.to_string())?);
    }
    Ok(list)
}
