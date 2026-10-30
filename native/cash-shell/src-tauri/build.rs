fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "cash_backup_prepare", "cash_backup_write"
        ])
    )).expect("Tauri-konfigurationen kunde inte byggas");
}
