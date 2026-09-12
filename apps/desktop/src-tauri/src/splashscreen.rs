use tauri::{AppHandle, Manager};

/// Invoked once by the frontend's own bootstrap gate (App.tsx) once the
/// main window's initial data (active company/workspace, theme) has
/// resolved and painted — never on a timer from the Rust side, since the
/// splash's whole purpose is to cover however long that actually takes on
/// a given machine, not a guessed constant. Showing `main` before closing
/// `splashscreen` (rather than the reverse) avoids a one-frame flash of
/// the desktop behind both windows.
#[tauri::command]
pub fn close_splashscreen(app: AppHandle) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        main.show().map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
    }

    // The splash window may already be gone (command invoked twice, or the
    // window was closed by other means) — that's not an error for this
    // command's purpose, which is "make sure main is showing".
    if let Some(splash) = app.get_webview_window("splashscreen") {
        splash.close().map_err(|e| e.to_string())?;
    }

    Ok(())
}
