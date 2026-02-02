#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod dev;
mod domains;
mod id_gen;
mod permissions;
mod scanner;
mod state;

use tauri::Manager;
use dev::{
    dev_clear_database,
    dev_get_current_user_id,
    dev_get_db_path,
    dev_get_db_snapshot,
    dev_list_commands,
    dev_login_as_developer,
    dev_set_current_user,
};
use domains::{
    backup::{backup_create, backup_list, backup_restore},
    caja::{caja_close_shift, caja_get_debug, caja_get_treasury, caja_list_shift_closures},
    custom_tariffs::{custom_tariffs_create, custom_tariffs_list, custom_tariffs_update, custom_tariffs_delete},
    metricas::{
        metricas_get_arrivals_by_hour,
        metricas_get_daily,
        metricas_get_heatmap_day_vehicle,
        metricas_get_occupancy_by_hour,
        metricas_get_peak_hours,
    },
    reportes::{reportes_fetch, reportes_get_column_definitions, reportes_write_csv},
    roles::{
        auth_get_session,
        auth_login,
        auth_logout,
        roles_create_user,
        roles_delete_user,
        roles_get_current_user,
        roles_get_my_permissions,
        roles_get_permissions_for_user,
        roles_get_role_permissions,
        roles_list_all_permissions,
        roles_list_roles,
        roles_list_users,
        roles_set_password,
        roles_update_role_permissions,
        roles_update_user,
    },
    vehiculos::{
        vehiculos_delete_vehicle,
        vehiculos_find_by_plate,
        vehiculos_find_by_ticket,
        vehiculos_get_debt_detail_by_plate,
        vehiculos_get_plate_conflicts,
        vehiculos_get_plate_debt,
        vehiculos_get_total_debt,
        vehiculos_get_vehicles_by_plate,
        vehiculos_list_debtors,
        vehiculos_list_vehicles,
        vehiculos_process_exit,
        vehiculos_register_entry,
        vehiculos_resolve_plate_conflict,
    },
};

fn load_dotenv() {
    if dotenvy::dotenv().is_ok() {
        return;
    }
    if let Ok(cwd) = std::env::current_dir() {
        if cwd.ends_with("src-tauri") {
            if let Some(parent) = cwd.parent() {
                let _ = dotenvy::from_path(parent.join(".env"));
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    load_dotenv();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
            let db_path = data_dir.join("coco_parking.db");
            let pool = db::open_pool(&db_path).map_err(|e| e.to_string())?;
            let canonical = db_path.canonicalize().unwrap_or_else(|_| db_path.clone());
            app.manage(state::AppState::new(std::sync::Arc::new(pool), canonical));
            scanner::spawn_barcode_listener(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            dev_login_as_developer,
            dev_get_current_user_id,
            dev_set_current_user,
            dev_clear_database,
            dev_get_db_path,
            dev_get_db_snapshot,
            dev_list_commands,
            vehiculos_list_vehicles,
            vehiculos_register_entry,
            vehiculos_process_exit,
            custom_tariffs_list,
            custom_tariffs_create,
            custom_tariffs_update,
            custom_tariffs_delete,
            vehiculos_find_by_plate,
            vehiculos_find_by_ticket,
            vehiculos_get_debt_detail_by_plate,
            vehiculos_get_plate_debt,
            vehiculos_get_total_debt,
            vehiculos_get_vehicles_by_plate,
            vehiculos_list_debtors,
            vehiculos_delete_vehicle,
            vehiculos_get_plate_conflicts,
            vehiculos_resolve_plate_conflict,
            caja_get_treasury,
            caja_get_debug,
            caja_close_shift,
            caja_list_shift_closures,
            metricas_get_daily,
            metricas_get_peak_hours,
            metricas_get_arrivals_by_hour,
            metricas_get_occupancy_by_hour,
            metricas_get_heatmap_day_vehicle,
            reportes_get_column_definitions,
            reportes_fetch,
            reportes_write_csv,
            auth_login,
            auth_logout,
            auth_get_session,
            roles_list_all_permissions,
            roles_list_roles,
            roles_list_users,
            roles_create_user,
            roles_update_user,
            roles_set_password,
            roles_delete_user,
            roles_get_current_user,
            roles_get_my_permissions,
            roles_get_permissions_for_user,
            roles_get_role_permissions,
            roles_update_role_permissions,
            backup_create,
            backup_restore,
            backup_list,
        ])
        .run(tauri::generate_context!())
        .expect("error while running COCO Parking");
}
