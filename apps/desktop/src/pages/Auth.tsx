import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVersion } from '@tauri-apps/api/app';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useLicenseStatus } from '@/hooks/useLicense';
import { cn } from '@/lib/utils';
import { Button, Input, Checkbox } from "@sordi/ui";
import { SplashPoster } from '@/components/auth/SplashPoster';
import { BlueprintCanvas } from '@/components/auth/BlueprintCanvas';
import { FloatingCardComposition } from '@/components/auth/FloatingCardComposition';
import {
  RiUserLine,
  RiLockPasswordLine,
  RiShieldCheckLine,
  RiEyeLine,
  RiEyeOffLine,
  RiLoader4Line as Loader2,
} from '@remixicon/react';
import { toast } from 'sonner';

// Only used if getVersion() can't run (e.g. previewing outside Tauri) —
// kept as a small local literal rather than importing pdfGenerator.ts,
// which would drag @react-pdf/renderer into the login screen's bundle.
const FALLBACK_APP_VERSION = "1.0.3";

// Splash stays up for exactly this long (spec: "1.4s on boot"), regardless
// of how fast the local auth check (has_password_set / sessionStorage read)
// resolves — otherwise the intro would flicker past on a warm start instead
// of reading as a deliberate, unhurried moment.
const MIN_SPLASH_MS = 1400;

const Auth = () => {
  const { user, loading, needsSetup, isTauri, signIn } = useAuth();
  const { data: licenseStatus } = useLicenseStatus();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const footerNote = !isTauri
    ? null
    : licenseStatus?.state === 'active'
      ? "Licence active — Appareil vérifié • Stockage local 100% sécurisé"
      : "Mode consultation — Stockage local 100% sécurisé";

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {!loading && (
        <div className={cn("grid grid-cols-1 lg:grid-cols-2 min-h-screen", readyToReveal ? "animate-fade-in" : "opacity-0")}>
          {/* Left — light visual / trust panel. Same BlueprintCanvas +
              FloatingCardComposition as the splash poster so the
              splash-to-login handoff reads as one continuous scene rather
              than a jump-cut between two different mockups. */}
          <div className="hidden lg:flex relative flex-col justify-between overflow-hidden p-12 xl:p-16">
            <BlueprintCanvas origin="top-left" />

            {/* Floating composition, given its own breathing room above the
                headline instead of squeezed inline beside it. Now a real
                grid (see FloatingCardComposition) instead of centered
                absolute offsets, so it just needs a width to lay out in —
                no more edge-clipping offset hack required. */}
            <div className="relative z-10 h-72 max-w-md animate-fade-in-up animation-delay-100">
              <FloatingCardComposition className="h-full" />
            </div>

            <div className="relative z-10 max-w-lg animate-fade-in-up animation-delay-150">
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-neutral-900 dark:text-neutral-50">
                Le système de gestion interne exclusif d'Omada Marketing &amp; Digital Solutions.
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                Trésorerie, facturation conforme, suivi de projets et pilotage d'agence 100% sur-mesure.
              </p>
            </div>

            {/* Agency signature — flat and transparent (no card/border/
                shadow), aligned with the heading above it. Text-only: no
                "omada" wordmark chip until the real logo asset is available. */}
            <div className="relative z-10 leading-snug animate-fade-in-up animation-delay-300">
              <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Crafted with precision by Omada Marketing &amp; Digital Solutions
              </p>
              <p className="text-[10.5px] text-neutral-400 dark:text-neutral-500">
                Sétif, Algérie • © 2026 Sordi ERP
              </p>
            </div>
          </div>

          {/* Right — login card */}
          <div className="relative flex items-center justify-center bg-background p-6 sm:p-10">
            <div className={cn(
              "w-full max-w-sm bg-white dark:bg-[#121316] rounded-3xl border border-neutral-200/60 dark:border-neutral-800/60 shadow-sm p-8",
              readyToReveal ? "animate-scale-in" : "opacity-0"
            )}>
              <div className="flex items-center gap-3 mb-10">
                <img src="/brand/sordi-logo.svg" alt="Sordi" className="h-7 w-auto dark:invert" />
                <span className="text-[10px] font-medium text-muted-foreground bg-secondary/60 rounded-full px-2 py-0.5 border border-border/50">
                  v{appVersion}
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
                  {needsSetup ? "Configuration initiale" : "Connexion à Sordi"}
                </h2>
                <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
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
                        className="pl-10 focus-visible:ring-2 focus-visible:ring-primary/20 transition-all"
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
                      className="pl-10 pr-10 focus-visible:ring-2 focus-visible:ring-[#EB3B48]/20 focus-visible:border-[#EB3B48] transition-all"
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
                        className="pl-10 pr-10 focus-visible:ring-2 focus-visible:ring-primary/20 transition-all"
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
                  className="w-full mt-2 bg-[#EB3B48] hover:bg-[#D82F3C] text-white font-medium py-3 rounded-xl shadow-[0_4px_14px_rgba(235,59,72,0.25)] transition-all active:scale-[0.99]"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {needsSetup ? "Configurer Sordi" : "Se connecter"}
                </Button>
              </form>

              {footerNote && (
                <p className={cn(
                  "mt-6 text-center text-[11px] text-muted-foreground",
                  readyToReveal ? "animate-fade-in-up animation-delay-300" : "opacity-0"
                )}>
                  {footerNote}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Intro splash — AnimatePresence owns the actual unmount, firing only
          once its exit animation finishes, so the poster's floating cards
          and glow dissolve into the (visually matching) light login panel
          behind it rather than cutting away. */}
      <AnimatePresence>
        {!splashExiting && (
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.03 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <SplashPoster durationMs={MIN_SPLASH_MS} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Auth;
