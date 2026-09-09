import React, { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
} from "@sordi/ui";
import { ShieldCheck, Fingerprint, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = "sordi_secure_session_ts";

interface SecureSessionContextType {
  lastVerifiedAt: number | null;
  SESSION_DURATION_MS: number;
  isSessionActive: () => boolean;
  lockSession: () => void;
  executeSecuredAction: (action: () => Promise<void> | void, reason?: string) => Promise<boolean>;
}

const SecureSessionContext = createContext<SecureSessionContextType | null>(null);

export function SecureSessionProvider({ children }: { children: ReactNode }) {
  const { isTauri, biometricAvailable } = useAuth();
  const [lastVerifiedAt, setLastVerifiedAt] = useState<number | null>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const ts = parseInt(saved, 10);
        if (!isNaN(ts) && Date.now() - ts < SESSION_DURATION_MS) {
          return ts;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  // Modal prompt state
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<string>("Vérification de sécurité requise");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Stored pending action resolver
  const pendingActionRef = useRef<(() => Promise<void> | void) | null>(null);
  const pendingResolverRef = useRef<((success: boolean) => void) | null>(null);

  const isSessionActive = useCallback(() => {
    if (!lastVerifiedAt) return false;
    return Date.now() - lastVerifiedAt < SESSION_DURATION_MS;
  }, [lastVerifiedAt]);

  const recordVerificationSuccess = useCallback(() => {
    const now = Date.now();
    setLastVerifiedAt(now);
    try {
      sessionStorage.setItem(STORAGE_KEY, now.toString());
    } catch {
      // ignore
    }
  }, []);

  const lockSession = useCallback(() => {
    setLastVerifiedAt(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Invalidate on minimize or window hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App is minimized or tab is hidden — invalidate elevated session for security
        lockSession();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [lockSession]);

  // Periodic check for 30m expiration
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastVerifiedAt && Date.now() - lastVerifiedAt >= SESSION_DURATION_MS) {
        lockSession();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [lastVerifiedAt, lockSession]);

  // Attempt biometric check
  const attemptBiometric = useCallback(async (customReason?: string): Promise<boolean> => {
    if (!isTauri || !biometricAvailable) return false;
    try {
      const success = await invoke<boolean>("authenticate_biometric", {
        reason: customReason || "Autoriser cette action sensible dans Sordi ERP",
      });
      return Boolean(success);
    } catch (e) {
      console.log("Step-up biometric verification dismissed or failed:", e);
      return false;
    }
  }, [isTauri, biometricAvailable]);

  const executeSecuredAction = useCallback(
    async (action: () => Promise<void> | void, actionReason = "Action protégée"): Promise<boolean> => {
      // 1. If session is already active within 30 min, refresh timestamp and execute immediately
      if (isSessionActive()) {
        recordVerificationSuccess();
        await action();
        return true;
      }

      // 2. Otherwise, attempt biometric in the background first
      if (isTauri && biometricAvailable) {
        const bioSuccess = await attemptBiometric(actionReason);
        if (bioSuccess) {
          recordVerificationSuccess();
          await action();
          return true;
        }
      }

      // 3. Fallback to password modal prompt
      return new Promise<boolean>((resolve) => {
        pendingActionRef.current = action;
        pendingResolverRef.current = resolve;
        setReason(actionReason);
        setPassword("");
        setPasswordError("");
        setIsOpen(true);
      });
    },
    [isSessionActive, recordVerificationSuccess, isTauri, biometricAvailable, attemptBiometric]
  );

  const handlePasswordSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password) {
      setPasswordError("Veuillez entrer votre mot de passe");
      return;
    }

    setIsVerifying(true);
    setPasswordError("");

    try {
      let isValid = false;
      if (isTauri) {
        isValid = await invoke<boolean>("check_password", { password });
      } else {
        isValid = password === "admin";
      }

      if (isValid) {
        recordVerificationSuccess();
        setIsOpen(false);
        const action = pendingActionRef.current;
        const resolve = pendingResolverRef.current;
        pendingActionRef.current = null;
        pendingResolverRef.current = null;
        if (action) {
          await action();
        }
        if (resolve) resolve(true);
      } else {
        setPasswordError("Mot de passe incorrect");
      }
    } catch (err) {
      setPasswordError("Erreur de vérification");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualBiometric = async () => {
    setIsVerifying(true);
    setPasswordError("");
    const success = await attemptBiometric(reason);
    setIsVerifying(false);
    if (success) {
      recordVerificationSuccess();
      setIsOpen(false);
      const action = pendingActionRef.current;
      const resolve = pendingResolverRef.current;
      pendingActionRef.current = null;
      pendingResolverRef.current = null;
      if (action) {
        await action();
      }
      if (resolve) resolve(true);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    const resolve = pendingResolverRef.current;
    pendingActionRef.current = null;
    pendingResolverRef.current = null;
    if (resolve) resolve(false);
  };

  return (
    <SecureSessionContext.Provider
      value={{
        lastVerifiedAt,
        SESSION_DURATION_MS,
        isSessionActive,
        lockSession,
        executeSecuredAction,
      }}
    >
      {children}

      {/* Step-up Authentication Modal */}
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <DialogContent className="sm:max-w-md bg-white border border-slate-200/90 shadow-2xl rounded-2xl p-6">
          <DialogHeader className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-1">
              <ShieldCheck className="w-5 h-5 stroke-[2]" />
            </div>
            <DialogTitle className="text-lg font-semibold text-slate-900 tracking-tight">
              Vérification de sécurité (Sudo)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed">
              {reason}. Cette vérification accorde une session sécurisée de <span className="font-medium text-slate-700">30 minutes</span> pour toutes vos opérations sensibles.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePasswordSubmit} className="space-y-4 my-2">
            <div className="space-y-1.5">
              <Label htmlFor="sudo-password" className="text-xs font-medium text-slate-700">
                Mot de passe maître
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="sudo-password"
                  type="password"
                  placeholder="••••••••"
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError("");
                  }}
                  className="pl-9 h-10 text-sm border-slate-200 focus-visible:border-blue-500 rounded-xl"
                />
              </div>
              {passwordError && (
                <p className="text-xs text-rose-500 font-medium">{passwordError}</p>
              )}
            </div>

            {isTauri && biometricAvailable && (
              <button
                type="button"
                onClick={handleManualBiometric}
                disabled={isVerifying}
                className="w-full text-xs text-slate-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5 py-1 select-none"
              >
                <Fingerprint className="w-4 h-4 text-blue-500" />
                <span>Utiliser Touch ID</span>
              </button>
            )}

            <DialogFooter className="gap-2 sm:gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isVerifying}
                className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isVerifying}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                {isVerifying ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : null}
                Confirmer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SecureSessionContext.Provider>
  );
}

export function useSecureSession() {
  const context = useContext(SecureSessionContext);
  if (!context) {
    throw new Error("useSecureSession must be used within a SecureSessionProvider");
  }
  return context;
}
