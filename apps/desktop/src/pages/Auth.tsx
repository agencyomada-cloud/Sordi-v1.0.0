import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVersion } from '@tauri-apps/api/app';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Button, Input, Checkbox } from "@sordi/ui";
import { SplashPoster } from '@/components/auth/SplashPoster';
import { BlueprintCanvas } from '@/components/auth/BlueprintCanvas';
import { HeroBentoCard } from '@/components/auth/HeroBentoCard';
import {
  RiUserLine,
  RiLockPasswordLine,
  RiShieldCheckLine,
  RiEyeLine,
  RiEyeOffLine,
  RiLoader4Line as Loader2,
} from '@remixicon/react';
import { Fingerprint } from 'lucide-react';
import { toast } from 'sonner';

// Only used if getVersion() can't run (e.g. previewing outside Tauri) —
// kept as a small local literal rather than importing pdfGenerator.ts,
// which would drag @react-pdf/renderer into the login screen's bundle.
const FALLBACK_APP_VERSION = "1.0.4";

// Splash stays up for exactly this long (spec: "1.4s on boot"), regardless
// of how fast the local auth check (has_password_set / sessionStorage read)
// resolves — otherwise the intro would flicker past on a warm start instead
// of reading as a deliberate, unhurried moment.
const MIN_SPLASH_MS = 1400;

const Auth = () => {
  const { user, loading, needsSetup, isTauri, biometricAvailable, signIn, signInWithBiometric } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBiometricSubmitting, setIsBiometricSubmitting] = useState(false);
  const [appVersion, setAppVersion] = useState(FALLBACK_APP_VERSION);
  const navigate = useNavigate();

  const [minSplashElapsed, setMinSplashElapsed] = useState(false);

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion(FALLBACK_APP_VERSION));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMinSplashElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  const readyToReveal = !loading && minSplashElapsed;
  // AnimatePresence drives the splash's actual unmount (after its exit
  // animation finishes) — this only decides when that exit should begin.
  const splashExiting = readyToReveal;

  // Two-stage reveal: the card appears first, centered across the *whole*
  // window, holds there for a beat, then the layout eases open into the
  // real 50/50 split — sliding the card into its half and unveiling the
  // blue panel behind it. This is a pure `transform: translateX` slide (see
  // the card wrapper below), not an animated grid-template-columns: a
  // transform only ever touches compositing, never triggers layout, so it
  // stays smooth regardless of how much is on either side — animating the
  // grid track itself instead (an earlier version of this) forces a full
  // reflow on every frame and is what made that version feel janky.
  // lg: variants make this a no-op below the breakpoint, where there's a
  // single column and no split to perform.
  const [splitOpen, setSplitOpen] = useState(false);

  useEffect(() => {
    if (!readyToReveal) return;
    const t = setTimeout(() => setSplitOpen(true), 700);
    return () => clearTimeout(t);
  }, [readyToReveal]);

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isTauri && !login) {
      toast.error("Veuillez entrer votre identifiant");
      return;
    }
    if (!password) {
      toast.error("Veuillez entrer un mot de passe");
      return;
    }
    if (needsSetup && password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    setIsSubmitting(true);
    const result = await signIn(password, login, rememberMe);
    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error.message || "Une erreur est survenue");
    } else {
      toast.success(needsSetup ? "Mot de passe configuré avec succès" : "Connexion réussie");
      navigate('/', { replace: true });
    }
  };

  const handleBiometricLogin = async (isAuto = false) => {
    if (isBiometricSubmitting) return;
    setIsBiometricSubmitting(true);
    const result = await signInWithBiometric("Authentifiez-vous pour déverrouiller Sordi", rememberMe);
    setIsBiometricSubmitting(false);

    if (result.error) {
      // If auto-triggered on load or cancelled, silently catch so the user can just type their password
      if (!isAuto) {
        toast.error(result.error.message || "Authentification biométrique impossible");
      }
      console.log("Biometric prompt dismissed or bypassed:", result.error);
    } else {
      toast.success("Connexion réussie");
      navigate('/', { replace: true });
    }
  };

  const hasAutoPromptedBiometrics = useRef(false);

  useEffect(() => {
    if (readyToReveal && !needsSetup && biometricAvailable && !user && !hasAutoPromptedBiometrics.current) {
      hasAutoPromptedBiometrics.current = true;
      handleBiometricLogin(true);
    }
  }, [readyToReveal, needsSetup, biometricAvailable, user]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#F8FAFC]">
      {!loading && (
        <div
          className={cn(
            "relative grid grid-cols-1 h-screen",
            readyToReveal ? "opacity-100" : "opacity-0",
            // A genuine CSS transition on grid-template-columns (native
            // browser interpolation, which correctly tweens `fr` values) —
            // not Framer Motion's `animate` prop. Framer's JS-driven
            // interpolator doesn't reliably recognize `fr` as an
            // animatable unit, so an earlier version of this just snapped
            // between the two layouts instead of easing between them,
            // which is what actually read as "not smooth". The timing
            // function is set inline instead of via an `ease-[...]`
            // arbitrary class — Tailwind flags that class as ambiguous
            // against its own theme scale.
            splitOpen ? "lg:grid-cols-[1fr_1fr]" : "lg:grid-cols-[0fr_1fr]"
          )}
          style={{ transitionProperty: "opacity, grid-template-columns", transitionDuration: "200ms, 850ms", transitionTimingFunction: "ease, cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          {/* One unified executive-light canvas spans both columns — same
              BlueprintCanvas as the splash poster, so the splash-to-login
              handoff reads as one continuous scene rather than a jump-cut
              between two differently-treated surfaces. */}
          <BlueprintCanvas origin="center" />

          {/* Left — product proof & manifesto.
              Its reveal is state-driven (splitOpen), not a CSS
              animation-delay timer — a plain opacity/translate transition
              that starts from an explicit "hidden" className has no
              equivalent to animation-delay's "flash visible, then snap
              hidden" gap, so the stagger below is reliable without needing
              an animation-fill-mode workaround. */}
          {/* min-w-0 is load-bearing: a grid item's default automatic
              minimum width is its content's size, not 0 — the padding
              alone on this div (xl:p-16 = 64px a side) was enough to stop
              the "0fr" column below from ever truly reaching 0 width, which
              is exactly what was throwing off both the horizontal centering
              (the column sat at ~128px instead of 0, shifting the card's
              actual center that far off from the viewport's) and the
              vertical centering (the same 128px squeezed this column's
              text into far more wrapped lines than usual, stretching this
              row — and with it the whole page — well past 100vh). Padding
              now lives on the inner div instead, which isn't a grid item
              and so has no such floor. */}
          <div className="hidden lg:flex relative z-10 min-w-0 overflow-hidden">
            {/* Single vertically-centered group — headline first, hero card
                directly below it — instead of a full-height spread. pl-10
                on the inner group (on top of the outer p-12/xl:p-16) gives
                the traffic-light corner and the content both a generous,
                balanced margin. */}
            <div className="relative z-10 flex h-full w-full items-center pt-16 pb-12 px-12 xl:pt-20 xl:pb-16 xl:px-16">
              <div className="flex flex-col justify-center max-w-lg space-y-6 pl-10">
                <div
                  className={cn(
                    "space-y-2 transition-[opacity,transform] duration-500",
                    splitOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                  )}
                  style={{ transitionDelay: splitOpen ? "150ms" : "0ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                >
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900 leading-tight">
                    Gestion financière &amp;<br />pilotage d'agence.
                  </h1>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-sm">
                    Trésorerie, facturation certifiée et rentabilité en temps réel sur poste dédié.
                  </p>
                </div>

                <div
                  className={cn(
                    "transition-[opacity,transform] duration-500",
                    splitOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                  )}
                  style={{ transitionDelay: splitOpen ? "280ms" : "0ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                >
                  <HeroBentoCard />
                </div>
              </div>
            </div>
          </div>

          {/* Right — the frosted glass authentication box, floating on the
              same light canvas rather than its own separate colored field. */}
          <div className="relative z-10 flex items-center justify-center overflow-hidden p-6 sm:p-10">
            <div className={cn(
              "w-full max-w-sm bg-white/85 backdrop-blur-2xl border border-slate-200/80 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] rounded-3xl p-8",
              readyToReveal ? "animate-scale-in" : "opacity-0"
            )}>
              <div className="flex items-center gap-3 mb-10">
                <img src="/brand/sordi-logo.svg" alt="Sordi" className="h-7 w-auto" />
                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 border border-slate-200">
                  v{appVersion}
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
                  {needsSetup ? "Configuration initiale" : "Connexion à Sordi"}
                </h2>
                <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                  {needsSetup
                    ? "Définissez un mot de passe pour sécuriser vos données."
                    : "Accédez à votre espace de gestion commerciale."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isTauri && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground/80 ml-0.5">
                      Email / Identifiant
                    </label>
                    <div className="relative">
                      <RiUserLine className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="admin"
                        className="pl-10 border-slate-200/90 bg-white/70 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/10 transition-all"
                        value={login}
                        onChange={(e) => setLogin(e.target.value)}
                        autoFocus
                        autoComplete="username"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/80 ml-0.5">
                    {needsSetup ? "Nouveau mot de passe" : "Mot de passe"}
                  </label>
                  <div className="relative">
                    <RiLockPasswordLine className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 border-slate-200/90 bg-white/70 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/10 transition-all"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus={isTauri}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPassword ? <RiEyeOffLine className="h-4 w-4" /> : <RiEyeLine className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Discreet re-trigger if prompt was closed */}
                {!needsSetup && biometricAvailable && (
                  <button
                    type="button"
                    onClick={() => handleBiometricLogin(false)}
                    disabled={isBiometricSubmitting}
                    className="mt-2 text-xs text-slate-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5 w-full select-none"
                    title="Déverrouiller avec Touch ID"
                  >
                    {isBiometricSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Fingerprint className="w-3.5 h-3.5" />
                    )}
                    <span>Utiliser Touch ID</span>
                  </button>
                )}

                {needsSetup && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground/80 ml-0.5">
                      Confirmer le mot de passe
                    </label>
                    <div className="relative">
                      <RiShieldCheckLine className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-10 border-slate-200/90 bg-white/70 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/10 transition-all"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showConfirmPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      >
                        {showConfirmPassword ? <RiEyeOffLine className="h-4 w-4" /> : <RiEyeLine className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {!needsSetup && (
                  <div className="flex items-center pt-1">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                      <Checkbox
                        checked={rememberMe}
                        onCheckedChange={(v) => setRememberMe(v === true)}
                      />
                      Se souvenir de moi
                    </label>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="w-full mt-2 h-11 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-medium rounded-xl transition-all shadow-[0_4px_16px_-2px_rgba(37,99,235,0.35)]"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {needsSetup ? "Configurer Sordi" : "Se connecter"}
                </Button>
              </form>

              <p className={cn(
                "mt-6 text-center text-[11px] text-slate-400",
                readyToReveal ? "animate-fade-in-up animation-delay-300 [animation-fill-mode:backwards]" : "opacity-0"
              )}>
                © 2026 Sordi • Omada Marketing &amp; Digital Solutions
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Intro splash — AnimatePresence owns the actual unmount, firing only
          once its exit animation finishes, so the breathing brand mark
          dissolves into the (visually matching) light login canvas behind
          it rather than cutting away. */}
      <AnimatePresence>
        {!splashExiting && (
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <SplashPoster durationMs={MIN_SPLASH_MS} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Auth;
