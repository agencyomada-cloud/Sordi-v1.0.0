import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

// Placeholder web credentials until real backend auth (signup/login against
// the apps/api API) is wired into the frontend — see apps/api/README.md.
const WEB_DEMO_LOGIN = 'admin';
const WEB_DEMO_PASSWORD = 'admin';

export function useAuth() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!isTauri) {
          // Web Mode: only restore a session already established via signIn
          // in this browser session — no auto-login.
          const savedAuth = sessionStorage.getItem('omada_authenticated');
          if (savedAuth === 'true') {
            setUser({ id: "local-user", email: "user@local" });
          }
          setLoading(false);
          return;
        }

        const hasSet = await invoke<boolean>('has_password_set');
        setNeedsSetup(!hasSet);

        // If we are already "logged in" in this session, keep it
        const savedAuth = sessionStorage.getItem('omada_authenticated');
        if (savedAuth === 'true') {
          setUser({ id: "local-user", email: "user@local" });
        }
      } catch (err) {
        console.error("Auth check failed, fallback to web auth:", err);
        // Fallback for web mode
        setUser({ id: "local-user", email: "user@local" });
        sessionStorage.setItem('omada_authenticated', 'true');
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
  const signIn = async (password?: string, login?: string) => {
    if (!isTauri) {
      if (login === WEB_DEMO_LOGIN && password === WEB_DEMO_PASSWORD) {
        setUser({ id: "local-user", email: "user@local" });
        sessionStorage.setItem('omada_authenticated', 'true');
        return { error: null };
      }
      return { error: new Error("Identifiant ou mot de passe incorrect") };
    }

    if (needsSetup && password) {
      try {
        await invoke('set_password', { newPassword: password });
        setNeedsSetup(false);
        setUser({ id: "local-user", email: "user@local" });
        sessionStorage.setItem('omada_authenticated', 'true');
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
          sessionStorage.setItem('omada_authenticated', 'true');
          return { error: null };
        } else {
          return { error: new Error("Mot de passe incorrect") };
        }
      } catch (err) {
        // Fallback if invoke fails in web
        setUser({ id: "local-user", email: "user@local" });
        sessionStorage.setItem('omada_authenticated', 'true');
        return { error: null };
      }
    }

    return { error: new Error("Mot de passe requis") };
  };

  const signOut = async () => {
    setUser(null);
    sessionStorage.removeItem('omada_authenticated');
    return { error: null };
  };

  return {
    user,
    loading,
    needsSetup,
    isTauri,
    signIn,
    signOut,
  };
}
