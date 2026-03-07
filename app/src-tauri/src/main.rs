// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let fallback_log_path = std::env::temp_dir().join("coco_parking_panic.log");
        let panic_message = match info.location() {
            Some(location) => format!(
                "COCO Parking panic: {}\nLocation: {}:{}:{}",
                info,
                location.file(),
                location.line(),
                location.column()
            ),
            None => format!("COCO Parking panic: {}", info),
        };

        tauri_plugin_log::log::error!("{panic_message}");

        let _ = std::fs::write(
            &fallback_log_path,
            format!("{panic_message}\n"),
        );

        let dialog_message = format!(
            "{panic_message}\n\nA fatal error occurred while starting COCO Parking.\nPlease share this log file with support:\n{}",
            fallback_log_path.to_string_lossy()
        );

        let _ = native_dialog::MessageDialog::new()
            .set_type(native_dialog::MessageType::Error)
            .set_title("COCO Parking startup error")
            .set_text(&dialog_message)
            .show_alert();
    }));

    coco_parking_lib::run()
}
