// Native Touch ID / biometric authentication for the login screen.
//
// tauri-plugin-biometric (the official Tauri plugin) only targets Android
// and iOS's mobile bridge — a regular windowed macOS app has no biometric
// story through it. This talks to Apple's LocalAuthentication framework
// directly via the objc2 bindings instead.

#[cfg(target_os = "macos")]
mod macos {
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::runtime::Bool;
    use objc2_foundation::{NSError, NSString};
    use objc2_local_authentication::{LAContext, LAPolicy};
    use std::sync::mpsc;

    /// Runs the native Touch ID prompt and blocks the calling thread until
    /// the user responds (or the OS rejects the request outright, e.g. no
    /// enrolled fingerprint). Must be called off the main/UI thread — see
    /// `spawn_blocking` in `authenticate_biometric` below.
    pub fn authenticate(reason: &str) -> Result<bool, String> {
        // SAFETY: LAContext is a plain Foundation object; `new`,
        // `canEvaluatePolicy_error` and `evaluatePolicy_localizedReason_reply`
        // are used exactly per Apple's documented contract — one context per
        // call, kept alive on this stack frame until the reply fires.
        unsafe {
            let context: Retained<LAContext> = LAContext::new();
            let policy = LAPolicy::DeviceOwnerAuthenticationWithBiometrics;

            // Fail fast with a clear message when there's no enrolled Touch
            // ID (older Mac, no fingerprint set up, hardware locked out)
            // instead of showing a prompt that's doomed to error out.
            if let Err(err) = context.canEvaluatePolicy_error(policy) {
                return Err(describe_error(&err));
            }

            let (tx, rx) = mpsc::channel::<Result<bool, String>>();
            let localized_reason = NSString::from_str(reason);

            let reply_block = RcBlock::new(move |success: Bool, error: *mut NSError| {
                let result = if success.as_bool() {
                    Ok(true)
                } else if !error.is_null() {
                    Err(describe_error(&*error))
                } else {
                    Err("Authentification annulée".to_string())
                };
                let _ = tx.send(result);
            });

            context.evaluatePolicy_localizedReason_reply(policy, &localized_reason, &reply_block);

            // The reply fires asynchronously on an internal Apple queue, not
            // this thread — block here until it does, since the whole point
            // is a modal system prompt the user must respond to.
            rx.recv()
                .map_err(|_| "Le service d'authentification a été interrompu".to_string())?
        }
    }

    fn describe_error(error: &NSError) -> String {
        error.localizedDescription().to_string()
    }
}

#[tauri::command]
pub async fn authenticate_biometric(reason: String) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        tauri::async_runtime::spawn_blocking(move || macos::authenticate(&reason))
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = reason;
        Err("L'authentification biométrique n'est disponible que sur macOS".to_string())
    }
}
