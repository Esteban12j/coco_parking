#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod dev;
mod domains;
mod id_gen;
mod permissions;
mod scanner;
mod state;

use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};
use dev::{
    dev_clear_database,
    dev_get_current_user_id,
    dev_get_db_path,
    dev_get_db_snapshot,
    dev_list_commands,
    dev_login_as_developer,
    dev_reset_user_password,
    dev_set_current_user,
};
use domains::{
    first_run::{
        first_run_change_admin_password,
        first_run_get_status,
        first_run_set_completed,
        reset_password_with_dev,
    },
    backup::{
        backup_config_get,
        backup_config_set,
        backup_create,
        backup_list,
        backup_restore,
        backup_run_full,
        spawn_backup_scheduler,
        trigger_backup_on_exit,
    },
    barcodes::{
        barcodes_create,
        barcodes_delete,
        barcodes_generate_image,
        barcodes_get_by_code,
        barcodes_get_by_id,
        barcodes_list,
    },
    caja::{caja_close_shift, caja_get_debug, caja_get_treasury, caja_list_shift_closures},
    contracts::{
        contracts_create,
        contracts_delete,
        contracts_get_by_plate,
        contracts_list,
        contracts_list_payments,
        contracts_record_payment,
        contracts_suggest_monthly,
        contracts_update,
    },
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
        vehiculos_list_vehicles_by_date,
        vehiculos_process_exit,
        vehiculos_register_entry,
        vehiculos_remove_from_parking,
        vehiculos_resolve_plate_conflict,
        vehiculos_search_vehicles_by_plate_prefix,
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

fn resolve_startup_log_dir() -> PathBuf {
    let app_identifier = "com.cocoparking.app";
    let data_dir = if cfg!(target_os = "windows") {
        std::env::var("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| std::env::temp_dir())
    } else if cfg!(target_os = "macos") {
        std::env::var("HOME")
            .map(|home| PathBuf::from(home).join("Library").join("Application Support"))
            .unwrap_or_else(|_| std::env::temp_dir())
    } else {
        std::env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|_| std::env::var("HOME").map(|home| PathBuf::from(home).join(".local").join("share")))
            .unwrap_or_else(|_| std::env::temp_dir())
    };
    let app_data_dir = data_dir.join(app_identifier);
    let _ = std::fs::create_dir_all(&app_data_dir);
    app_data_dir
}

fn show_startup_error_dialog(message: &str) {
    let _ = native_dialog::MessageDialog::new()
        .set_type(native_dialog::MessageType::Error)
        .set_title("COCO Parking startup error")
        .set_text(message)
        .show_alert();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    load_dotenv();
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(Target::new(TargetKind::Folder {
                    path: resolve_startup_log_dir(),
                    file_name: Some("coco_parking".to_string()),
                }))
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            log::info!("Starting COCO Parking setup");
            let data_dir = match app.path().app_data_dir() {
                Ok(path) => path,
                Err(error) => {
                    let message = format!("Unable to resolve app data directory: {error}");
                    log::error!("{message}");
                    show_startup_error_dialog(&message);
                    return Ok(());
                }
            };
            log::info!("Resolved app data directory: {}", data_dir.to_string_lossy());
            if let Err(error) = std::fs::create_dir_all(&data_dir) {
                let message = format!("Unable to create app data directory: {error}");
                log::error!("{message}");
                show_startup_error_dialog(&message);
                return Ok(());
            }
            let db_path = data_dir.join("coco_parking.db");
            log::info!("Opening SQLite pool at: {}", db_path.to_string_lossy());
            let pool = match db::open_pool(&db_path) {
                Ok(pool) => pool,
                Err(error) => {
                    let message = format!("Unable to open SQLite pool: {error}");
                    log::error!("{message}");
                    show_startup_error_dialog(&message);
                    return Ok(());
                }
            };
            let canonical = db_path.canonicalize().unwrap_or_else(|_| db_path.clone());
            app.manage(state::AppState::new(std::sync::Arc::new(pool), canonical));
            log::info!("Database pool initialized and app state managed");
            scanner::spawn_barcode_listener(app.handle().clone());
            spawn_backup_scheduler(app.handle().clone());
            log::info!("Setup completed successfully");
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                trigger_backup_on_exit(window.app_handle().clone());
            }
        })
        .invoke_handler(tauri::generate_handler![
            dev_login_as_developer,
            dev_get_current_user_id,
            dev_set_current_user,
            dev_reset_user_password,
            dev_clear_database,
            dev_get_db_path,
            dev_get_db_snapshot,
            dev_list_commands,
            vehiculos_list_vehicles,
            vehiculos_list_vehicles_by_date,
            vehiculos_register_entry,
            vehiculos_process_exit,
            vehiculos_remove_from_parking,
            custom_tariffs_list,
            custom_tariffs_create,
            custom_tariffs_update,
            custom_tariffs_delete,
            contracts_list,
            contracts_create,
            contracts_update,
            contracts_delete,
            contracts_get_by_plate,
            contracts_suggest_monthly,
            contracts_record_payment,
            contracts_list_payments,
            barcodes_list,
            barcodes_get_by_id,
            barcodes_get_by_code,
            barcodes_create,
            barcodes_delete,
            barcodes_generate_image,
            vehiculos_find_by_plate,
            vehiculos_find_by_ticket,
            vehiculos_get_debt_detail_by_plate,
            vehiculos_get_plate_debt,
            vehiculos_get_total_debt,
            vehiculos_get_vehicles_by_plate,
            vehiculos_search_vehicles_by_plate_prefix,
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
            backup_run_full,
            backup_list,
            backup_config_get,
            backup_config_set,
            first_run_change_admin_password,
            first_run_get_status,
            first_run_set_completed,
            reset_password_with_dev,
        ])
        .run(tauri::generate_context!())
        .expect("error while running COCO Parking");
}
