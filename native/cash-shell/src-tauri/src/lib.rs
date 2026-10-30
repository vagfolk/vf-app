use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

struct BackupLock(Mutex<()>);

fn valid_id(id: &str) -> bool {
    id.len() >= 8 && id.len() <= 64 && id.starts_with("K-") &&
        id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-')
}

fn valid_operation_id(id: &str) -> bool {
    id.len() == 36 && id.bytes().enumerate().all(|(index, c)| {
        if [8, 13, 18, 23].contains(&index) { c == b'-' }
        else { c.is_ascii_hexdigit() }
    })
}

fn file_path(app: &AppHandle, cash_id: &str) -> Result<PathBuf, String> {
    if !valid_id(cash_id) { return Err("Ogiltigt kassa-ID".into()); }
    Ok(app.path().app_local_data_dir().map_err(|e| e.to_string())?
        .join("kassareserv")
        .join(format!("VF26-reserv-{cash_id}.txt")))
}

fn event_ids(text: &str) -> Result<HashSet<String>, String> {
    if !text.starts_with("VÄGFÖLK 26 – RESERVLOGG") {
        return Err("Reservfilens format känns inte igen".into());
    }
    let mut found = HashSet::new();
    for line in text.lines().filter(|line| line.starts_with("Händelse: ")) {
        let id = line.rsplit_once(" · ID ").map(|(_, id)| id)
            .ok_or("Reservfilen saknar händelse-ID")?;
        if !valid_operation_id(id) || !found.insert(id.to_owned()) {
            return Err("Reservfilen innehåller ett ogiltigt eller upprepat händelse-ID".into());
        }
    }
    Ok(found)
}

fn supplied_ids(ids: &[String]) -> Result<HashSet<String>, String> {
    if ids.len() > 1000 { return Err("För många väntande händelser".into()); }
    let found: HashSet<String> = ids.iter().cloned().collect();
    if found.len() != ids.len() || ids.iter().any(|id| !valid_operation_id(id)) {
        return Err("Ogiltiga eller upprepade händelse-ID:n".into());
    }
    Ok(found)
}

fn save(path: &PathBuf, text: &str) -> Result<(), String> {
    if text.len() > 2_000_000 { return Err("Reservfilen är för stor".into()); }
    let directory = path.parent().ok_or("Reservkatalog saknas")?;
    fs::create_dir_all(directory).map_err(|e| e.to_string())?;
    let mut temp = tempfile::NamedTempFile::new_in(directory).map_err(|e| e.to_string())?;
    temp.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(path).map_err(|e| e.error.to_string())?;
    Ok(())
}

#[tauri::command]
fn cash_backup_prepare(app: AppHandle, lock: State<'_, BackupLock>,
    cash_id: String, text: String, pending_ids: Vec<String>) -> Result<(), String> {
    let _guard = lock.0.lock().map_err(|_| "Reservfilen är låst")?;
    let path = file_path(&app, &cash_id)?;
    let pending = supplied_ids(&pending_ids)?;
    if event_ids(&text)? != pending { return Err("Reservtext och kö skiljer sig".into()); }
    match fs::read_to_string(&path) {
      Ok(old) => {
        if !old.contains(&format!("Kassa: {cash_id}\n")) || event_ids(&old)? != pending {
            return Err("Reservfilen och webbläsarens kö skiljer sig. Stoppa försäljningen och stäm av manuellt.".into());
        }
        return Ok(());
      }
      Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
      Err(error) => return Err(error.to_string()),
    }
    if !pending.is_empty() {
        return Err("Reservfilen saknas trots väntande kassahändelser. Stoppa försäljningen och stäm av manuellt.".into());
    }
    save(&path, &text)
}

#[tauri::command]
fn cash_backup_write(app: AppHandle, lock: State<'_, BackupLock>,
    cash_id: String, text: String, pending_ids: Vec<String>,
    confirmed_ids: Vec<String>) -> Result<(), String> {
    let _guard = lock.0.lock().map_err(|_| "Reservfilen är låst")?;
    let path = file_path(&app, &cash_id)?;
    let pending = supplied_ids(&pending_ids)?;
    let confirmed = supplied_ids(&confirmed_ids)?;
    if !pending.is_disjoint(&confirmed) || event_ids(&text)? != pending {
        return Err("Reservtext, kö och bekräftelser skiljer sig".into());
    }
    let old = fs::read_to_string(&path).map_err(|_| "Befintlig reservfil saknas")?;
    let old_ids = event_ids(&old)?;
    if !old.contains(&format!("Kassa: {cash_id}\n")) ||
        !confirmed.is_subset(&old_ids) ||
        old_ids.difference(&confirmed).any(|id| !pending.contains(id)) {
        return Err("Reservfilen innehåller obekräftade händelser som inte får tas bort".into());
    }
    save(&path, &text)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(BackupLock(Mutex::new(())))
        .invoke_handler(tauri::generate_handler![cash_backup_prepare, cash_backup_write])
        .run(tauri::generate_context!())
        .expect("Kassans appskal kunde inte startas");
}
