import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

// Placeholder web credentials until real backend auth (signup/login against
// the apps/api API) is wired into the frontend — see apps/api/README.md.
const WEB_DEMO_LOGIN = 'admin';
const WEB_DEMO_PASSWORD = 'admin';

const AUTH_FLAG_KEY = 'omada_authenticated';

// sessionStorage always gets the flag (keeps the current window's session
// alive, same as before "remember me" existed). localStorage only gets it
// when the user opted in — that's what survives a full app restart.
const persistAuthFlag = (rememberMe?: boolean) => {
  sessionStorage.setItem(AUTH_FLAG_KEY, 'true');
  if (rememberMe) localStorage.setItem(AUTH_FLAG_KEY, 'true');
};

const clearAuthFlag = () => {
  sessionStorage.removeItem(AUTH_FLAG_KEY);
  localStorage.removeItem(AUTH_FLAG_KEY);
};

export function useAuth() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
  // Touch ID only exists on macOS — the backend's authenticate_biometric
  // command already refuses gracefully on other platforms, but gating the
  // button on the client side too avoids offering an action that's certain
  // to fail. navigator.platform is a reasonable client hint here since this
  // only decides whether to show a UI affordance, not whether to trust the
  // authentication result itself (that's the backend's job).
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);
  const biometricAvailable = isTauri && isMac;

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!isTauri) {
          // Web Mode: only restore a session already established via signIn
          // (this browser session, or a prior one if "remember me" was set) —
          // no auto-login.
          const savedAuth = sessionStorage.getItem(AUTH_FLAG_KEY) || localStorage.getItem(AUTH_FLAG_KEY);
          if (savedAuth === 'true') {
            setUser({ id: "local-user", email: "user@local" });
          }
          setLoading(false);
          return;
        }

        const hasSet = await invoke<boolean>('has_password_set');
        setNeedsSetup(!hasSet);

        // If we are already "logged in" (this session, or a prior one if
        // "remember me" was set), keep it
        const savedAuth = sessionStorage.getItem(AUTH_FLAG_KEY) || localStorage.getItem(AUTH_FLAG_KEY);
        if (savedAuth === 'true') {
          setUser({ id: "local-user", email: "user@local" });
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        if (!isTauri) {
          // Web preview only — no real backend to check against.
          setUser({ id: "local-user", email: "user@local" });
          persistAuthFlag();
        }
        // In Tauri, a failed invoke must NOT silently authenticate — leave
        // `user` null so the password screen still gates access.
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [isTauri]);

  /**
   * Desktop calls signIn(password). Web calls signIn(password, login) — the
   * hardcoded admin/admin check above stands in until login/signup hit the
   * real API.
   */
  const signIn = async (password?: string, login?: string, rememberMe?: boolean) => {
    if (!isTauri) {
      if (login === WEB_DEMO_LOGIN && password === WEB_DEMO_PASSWORD) {
        setUser({ id: "local-user", email: "user@local" });
        persistAuthFlag(rememberMe);
        return { error: null };
      }
      return { error: new Error("Identifiant ou mot de passe incorrect") };
    }

    if (needsSetup && password) {
      try {
        await invoke('set_password', { newPassword: password });
        setNeedsSetup(false);
        setUser({ id: "local-user", email: "user@local" });
        persistAuthFlag(rememberMe);
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    }

    if (password) {
      try {
        const isValid = await invoke<boolean>('check_password', { password });
        if (isValid) {
          setUser({ id: "local-user", email: "user@local" });
          persistAuthFlag(rememberMe);
          return { error: null };
        }
        return { error: new Error("Mot de passe incorrect") };
      } catch (err) {
        // This branch only runs in Tauri (the !isTauri case already
        // returned above) — an invoke failure here must be reported as a
        // login failure, never treated as a successful password check.
        console.error("check_password invoke failed:", err);
        return { error: new Error("Impossible de vérifier le mot de passe. Réessayez.") };
      }
    }

    return { error: new Error("Mot de passe requis") };
  };

  /**
   * Touch ID / biometric unlock — only meaningful once a password already
   * exists (it unlocks an existing account, it doesn't create one), so
   * callers should gate this behind `!needsSetup` the same way the
   * password-confirmation field is gated.
   */
  const signInWithBiometric = async (reason: string, rememberMe?: boolean) => {
    if (!isTauri) {
      return { error: new Error("L'authentification biométrique n'est disponible que dans l'application de bureau") };
    }
    try {
      const success = await invoke<boolean>('authenticate_biometric', { reason });
      if (success) {
        setUser({ id: "local-user", email: "user@local" });
        persistAuthFlag(rememberMe);
        return { error: null };
      }
      return { error: new Error("Authentification biométrique échouée") };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const signOut = async () => {
    setUser(null);
    clearAuthFlag();
    return { error: null };
  };

  return {
    user,
    loading,
    needsSetup,
    isTauri,
    biometricAvailable,
    signIn,
    signInWithBiometric,
    signOut,
  };
}
