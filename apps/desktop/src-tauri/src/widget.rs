use tauri::{AppHandle, Manager};

/// Neither `data-tauri-drag-region` nor a manual `startDragging()` call from
/// JS ever actually moved this window, while the native OS resize handles
/// at its edges worked fine — a strong signal the problem was never in the
/// webview/JS layer at all. A borderless (`decorations: false`) NSWindow on
/// macOS defaults `isMovableByWindowBackground` to `false`; both of those
/// JS-side mechanisms still rely on the window ultimately being draggable
/// by its background, so with that flag off, neither one had anything to
/// actually invoke. This flips it on directly via the raw NSWindow handle
/// Tauri exposes, the same `objc2` crate already used for Touch ID
/// (biometric.rs) — no typed `objc2-app-kit` binding needed for one
/// property setter.
#[cfg(target_os = "macos")]
fn make_window_movable_by_background(window: &tauri::WebviewWindow) {
    use objc2::runtime::AnyObject;

    let Ok(ns_window_ptr) = window.ns_window() else { return };
    if ns_window_ptr.is_null() {
        return;
    }
    // SAFETY: ns_window() returns the live NSWindow* backing this Tauri
    // window for as long as the window itself exists (true here — this
    // runs on the "widget" window's own show path). setMovableByWindowBackground:
    // is a plain Cocoa property setter taking a BOOL, called exactly per
    // Apple's documented signature.
    unsafe {
        let ns_window = ns_window_ptr as *mut AnyObject;
        let _: () = objc2::msg_send![ns_window, setMovableByWindowBackground: true];
    }
}

#[cfg(not(target_os = "macos"))]
fn make_window_movable_by_background(_window: &tauri::WebviewWindow) {}

/// Shows/hides the floating "widget" window declared in tauri.conf.json
/// (created hidden at launch via `"visible": false`) — a glanceable
/// companion to the main window, not a separate authenticated session, so
/// this never creates or destroys it, only toggles visibility.
#[tauri::command]
pub fn toggle_widget_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("widget")
        .ok_or_else(|| "Widget window not found".to_string())?;

    let visible = window.is_visible().map_err(|e| e.to_string())?;
    if visible {
        window.hide().map_err(|e| e.to_string())?;
    } else {
        window.show().map_err(|e| e.to_string())?;
        // Defensively rule out the window silently ignoring mouse input
        // (a real Tauri/macOS gotcha for transparent windows in some
        // configurations) — cursor events must be enabled for either
        // drag mechanism (data-tauri-drag-region or startDragging()) to
        // ever receive the mousedown in the first place.
        window.set_ignore_cursor_events(false).map_err(|e| e.to_string())?;
        make_window_movable_by_background(&window);
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}
