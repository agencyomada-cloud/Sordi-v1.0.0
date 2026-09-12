import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useActiveCompany } from '@/hooks/useActiveCompany';
import { Button, Input, Checkbox } from "@sordi/ui";
import {
  RiEyeLine,
  RiEyeOffLine,
  RiErrorWarningLine as AlertCircle,
  RiLoader4Line as Loader2,
} from '@remixicon/react';
import { Fingerprint, ShieldCheck } from 'lucide-react';
import { SetupWizard } from '@/components/auth/SetupWizard';

/**
 * Native macOS auth surface — first-run goes to the 3-step SetupWizard,
 * every subsequent launch goes to a compact daily-unlock dialog. No splash
 * sequence, no forced minimum display time: this renders the moment
 * `loading` (the local has_password_set / session check) resolves.
 */
const Auth = () => {
  const { user, loading, needsSetup, isTauri, biometricAvailable, signIn, signInWithBiometric } = useAuth();
  const { company } = useActiveCompany();
  // Only ever rendered/used when !isTauri (web preview) — Tauri's own
  // signIn(password) call below passes no login, matching the desktop
  // product this whole screen is designed around.
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBiometricSubmitting, setIsBiometricSubmitting] = useState(false);
  // Quiet inline error, not a toast — auth mistakes are an expected, routine
  // part of unlocking a desktop app, not an event worth a floating alert.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isTauri && !login) {
      setErrorMessage("Veuillez entrer votre identifiant");
      return;
    }
    if (!password) {
      setErrorMessage("Veuillez entrer un mot de passe");
      return;
    }

    setIsSubmitting(true);
    const result = await signIn(password, login, rememberMe);
    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error.message || "Identifiants incorrects");
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleBiometricLogin = async (isAuto = false) => {
    if (isBiometricSubmitting) return;
    setIsBiometricSubmitting(true);
    const result = await signInWithBiometric("Authentifiez-vous pour déverrouiller Sordi", rememberMe);
    setIsBiometricSubmitting(false);

    if (result.error) {
      // Auto-triggered on load or cancelled by the user — stay quiet so
      // they can just type their password instead.
      if (!isAuto) {
        setErrorMessage(result.error.message || "Authentification biométrique impossible");
      }
    } else {
      navigate('/', { replace: true });
    }
  };

  const hasAutoPromptedBiometrics = useRef(false);

  useEffect(() => {
    if (!loading && !needsSetup && biometricAvailable && !user && !hasAutoPromptedBiometrics.current) {
      hasAutoPromptedBiometrics.current = true;
      handleBiometricLogin(true);
    }
  }, [loading, needsSetup, biometricAvailable, user]);

  // Brief and local (a has_password_set read / session check) — nothing to
  // fill this gap with, a native app wouldn't show a splash for it either.
  if (loading) return null;

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-muted/40 dark:bg-zinc-950">
      {/* macOS titlebar strip — draggable, clears the traffic lights, and
          doubles as the one place a quiet "this is a secure local vault"
          cue belongs (not inside the card itself, which is about the
          unlock action, not the app's security posture). */}
      <div data-tauri-drag-region className="h-10 w-full shrink-0 flex items-center justify-center select-none">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="w-4 h-4" />
          Espace local chiffré
        </span>
      </div>

      {/* Faint grid texture over the acrylic canvas — the "real desktop
          lock screen" depth cue, not an empty flat void. */}
      <div
        className="relative flex-1 flex items-center justify-center px-6"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(127,127,127,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(127,127,127,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        {needsSetup ? (
          <SetupWizard />
        ) : (
          <div className="w-[360px] bg-card/95 border border-border/80 rounded-xl p-6 shadow-2xl backdrop-blur-md">
            {/* User avatar chip — the active company's identity, not a
                generic app icon, since unlocking is "who's coming back",
                not "what app is this". */}
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-border/60 flex items-center justify-center mb-2.5">
                <span className="text-sm font-semibold text-primary">
                  {(company?.name || "Mon Entreprise").trim().charAt(0).toUpperCase()}
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground">{company?.name || "Mon Entreprise"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Déverrouillez votre espace local</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {!isTauri && (
                <Input
                  type="text"
                  placeholder="Identifiant"
                  className="h-[34px] rounded-md border-border/80 bg-background text-xs px-3 focus-visible:ring-1"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  autoFocus={!isTauri}
                  autoComplete="username"
                />
              )}
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mot de passe"
                  className="h-[34px] rounded-md border-border/80 bg-background text-xs px-3 pr-9 focus-visible:ring-1"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus={isTauri}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <RiEyeOffLine className="h-3.5 w-3.5" /> : <RiEyeLine className="h-3.5 w-3.5" />}
                </button>
              </div>

              {errorMessage && (
                <div className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {errorMessage}
                </div>
              )}

              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none w-fit">
                <Checkbox checked={rememberMe} onCheckedChange={(v) => setRememberMe(v === true)} />
                Se souvenir de moi
              </label>

              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-[34px] rounded-md text-xs font-medium"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Déverrouiller"}
                </Button>
                {biometricAvailable && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleBiometricLogin(false)}
                    disabled={isBiometricSubmitting}
                    className="h-[34px] w-[34px] shrink-0 rounded-md [&_svg]:size-4"
                    title="Déverrouiller avec Touch ID"
                  >
                    {isBiometricSubmitting ? <Loader2 className="animate-spin" /> : <Fingerprint />}
                  </Button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Quiet agency credit — belongs at the bottom of every auth state
          (first-run wizard and daily unlock alike), never inside the card
          itself which is about the unlock/setup action, not attribution. */}
      <div className="shrink-0 pb-4 flex items-center justify-center gap-1.5 select-none">
        <span className="text-[10px] text-muted-foreground/70">Développé par</span>
        <img src="/brand/omada-logo.svg" alt="Omada" className="h-3.5 w-auto opacity-70 invert dark:invert-0" draggable={false} />
      </div>
    </div>
  );
};

export default Auth;
