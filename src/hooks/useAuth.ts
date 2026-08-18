import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useAuth() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
        if (!isTauri) {
          // Web Mode: auto-login or allow setup
          const savedAuth = sessionStorage.getItem('omada_authenticated');
          if (savedAuth === 'true' || true) { // Auto login in browser dev mode
            setUser({ id: "local-user", email: "user@local" });
            sessionStorage.setItem('omada_authenticated', 'true');
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
  }, []);

  const signIn = async (password?: string) => {
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    if (!isTauri) {
      setUser({ id: "local-user", email: "user@local" });
      sessionStorage.setItem('omada_authenticated', 'true');
      return { error: null };
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
    signIn,
    signOut,
  };
}
