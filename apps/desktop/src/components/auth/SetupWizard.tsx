import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, DesktopSegmentedControl } from '@sordi/ui';
import {
  RiEyeLine,
  RiEyeOffLine,
  RiErrorWarningLine as AlertCircle,
  RiLoader4Line as Loader2,
  RiCheckLine as Check,
} from '@remixicon/react';
import { Fingerprint, KeyRound, ArrowRight, Building2, FileText, LayoutDashboard, Phone, Mail, Rocket } from 'lucide-react';
import { RiWhatsappLine as WhatsAppIcon } from '@remixicon/react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useLicenseStatus, useRequestTrial } from '@/hooks/useLicense';
import { useMachineId, buildWhatsAppActivationUrl } from '@/services/licensing';

// Sentinel Select value for "Autre (préciser)" — never itself stored as the
// company's activity; handleStep1Continue swaps it out for the free-text
// customActivity value below. Every other option's `value` IS the exact
// French label — company.activity flows straight into PDF headers
// ("Activité : ...", see lib/pdfGenerator.ts), so what's stored has to
// already be the human-readable text, not an English/slug key.
const OTHER_ACTIVITY = '__other__';

const ACTIVITIES = [
  { value: 'Agence (Marketing, Web, Design, Communication)', label: 'Agence (Marketing, Web, Design, Communication)' },
  { value: 'Freelance / Consultant indépendant', label: 'Freelance / Consultant indépendant' },
  { value: 'Prestations de Services & Conseil B2B', label: 'Prestations de Services & Conseil B2B' },
  { value: 'Commerce & Vente de Marchandises', label: 'Commerce & Vente de Marchandises' },
  { value: 'BTP, Architecture & Travaux', label: 'BTP, Architecture & Travaux' },
  { value: 'Industrie & Production', label: 'Industrie & Production' },
  { value: OTHER_ACTIVITY, label: 'Autre (préciser)' },
];

type CurrencyCode = 'DZD' | 'EUR' | 'USD';

const CURRENCIES: { value: CurrencyCode; label: string; pill: string }[] = [
  { value: 'DZD', label: 'Dinar Algérien (DZD)', pill: 'DZD' },
  { value: 'EUR', label: '€ - Euro (EUR)', pill: 'EUR' },
  { value: 'USD', label: '$ - Dollar américain (USD)', pill: 'USD' },
];

type Step = 1 | 2 | 3 | 4;

/**
 * First-run Desktop Setup Assistant — replaces the bare "create a password"
 * form on a fresh install with a 4-step wizard (company identity → vault
 * password → activation request → ready), matching the same native-dialog
 * register as the daily unlock screen (Auth.tsx) it sits inside.
 *
 * Step 1 provisions the active company via useWorkspace().createCompany —
 * on a genuinely fresh database there is no company row at all yet, so this
 * is load-bearing, not cosmetic: every company-scoped query in the app
 * gates on `useWorkspace().isReady`, which never becomes true otherwise.
 * Step 2 sets the master password via the same useAuth().signIn(password)
 * path the daily unlock screen uses (it internally calls the Rust
 * `set_password` command when `needsSetup` is true) — same backend command,
 * same session flag, nothing new introduced there.
 * Step 3 is skippable and only ever shown when there is no active license
 * yet (a fresh install always qualifies) — it posts name/phone/email to
 * apps/api's POST /licenses/request-trial, which unlocks a 14-day trial
 * immediately and separately queues the lead for the sales team's own
 * à-contacter follow-up in the admin dashboard. Skipping it is always safe:
 * the app already works unlicensed via the existing TrialBanner/
 * ActivationModal path elsewhere in the app, this step is purely a
 * frictionless shortcut to the same outcome.
 */
export function SetupWizard() {
  const navigate = useNavigate();
  const { signIn, biometricAvailable } = useAuth();
  const { createCompany, isCreatingCompany } = useWorkspace();

  const [step, setStep] = useState<Step>(1);
  const [companyName, setCompanyName] = useState('');
  const [activity, setActivity] = useState(ACTIVITIES[0].value);
  const [customActivity, setCustomActivity] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('DZD');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Purely informational at this stage — Touch ID unlock (authenticate_biometric)
  // is tied to the OS session, not a separate app-level enrollment step, so
  // there's no backend call this toggle needs to make. It just previews the
  // capability the daily unlock screen will offer once a password exists.
  const [biometricPreview, setBiometricPreview] = useState(true);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: licenseStatus } = useLicenseStatus();
  const { data: machineId } = useMachineId();
  const requestTrial = useRequestTrial();
  const [activationPhone, setActivationPhone] = useState('');
  const [activationEmail, setActivationEmail] = useState('');
  const [activationError, setActivationError] = useState<string | null>(null);
  const [trialRequested, setTrialRequested] = useState(false);

  // The Select's own value when "Autre" is chosen is the OTHER_ACTIVITY
  // sentinel, never what actually gets stored/displayed — this resolves it
  // to the real text (the free-form field for "Autre", the option's own
  // label otherwise) everywhere that needs the true activity string.
  const resolvedActivity = activity === OTHER_ACTIVITY ? customActivity.trim() : activity;

  const handleStep1Continue = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (activity === OTHER_ACTIVITY && !customActivity.trim()) {
      setErrorMessage('Veuillez préciser votre activité');
      return;
    }
    try {
      await createCompany({ name: companyName.trim() || 'Mon Entreprise', activity: resolvedActivity, currency });
      setStep(2);
    } catch (error) {
      // useWorkspace().createCompany already logs the full error via
      // logError() — this surfaces the real backend message too (e.g. the
      // Rust command's own Err(String)) instead of a fixed generic string,
      // since a silently swallowed cause here is exactly what made a real
      // bug (the license gate blocking first-run company creation) hard to
      // diagnose from the UI alone.
      const detail = typeof error === 'string' ? error : error instanceof Error ? error.message : null;
      setErrorMessage(detail || "Impossible de créer l'espace entreprise. Réessayez.");
    }
  };

  const handleSkipStep1 = async () => {
    setErrorMessage(null);
    try {
      await createCompany({ name: 'Mon Entreprise', activity: ACTIVITIES[0].value, currency: 'DZD' });
      setStep(2);
    } catch (error) {
      const detail = typeof error === 'string' ? error : error instanceof Error ? error.message : null;
      setErrorMessage(detail || "Impossible de créer l'espace entreprise. Réessayez.");
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!password) {
      setErrorMessage('Veuillez entrer un mot de passe');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas');
      return;
    }

    setIsSubmittingPassword(true);
    const result = await signIn(password);
    setIsSubmittingPassword(false);

    if (result.error) {
      setErrorMessage(result.error.message || 'Une erreur est survenue');
    } else {
      setStep(3);
    }
  };

  const handleActivationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivationError(null);

    if (!activationPhone.trim()) {
      setActivationError('Veuillez entrer votre numéro de téléphone');
      return;
    }
    if (!activationEmail.trim()) {
      setActivationError('Veuillez entrer votre adresse email');
      return;
    }

    requestTrial.mutate(
      {
        organizationName: companyName.trim() || 'Mon Entreprise',
        phone: activationPhone.trim(),
        email: activationEmail.trim(),
      },
      {
        onSuccess: () => setTrialRequested(true),
        onError: (error: unknown) => {
          const detail = typeof error === 'string' ? error : error instanceof Error ? error.message : null;
          setActivationError(detail || "Impossible d'envoyer la demande. Réessayez.");
        },
      }
    );
  };

  const whatsappUrl = machineId ? buildWhatsAppActivationUrl(companyName.trim() || 'Mon Entreprise', machineId) : undefined;

  // Edge case: the license is already active by the time Step 3 would show
  // (VITE_LICENSE_BYPASS, or a rare race with a background verify) — skip
  // straight past the activation-request UI instead of rendering a
  // pointless form for a license that already exists.
  useEffect(() => {
    if (step === 3 && licenseStatus?.state === 'active') {
      setStep(4);
    }
  }, [step, licenseStatus?.state]);

  const finish = (destination: string) => navigate(destination, { replace: true });

  return (
    // min-h keeps the card a stable size across step 1's two states (with
    // and without the "Autre" custom-activity field) instead of visibly
    // resizing/jumping, and independently guarantees the title/step-
    // indicator/company-name-field block above the Activité select always
    // has real room — belt-and-suspenders alongside the Select's own
    // side="bottom" fix above, not a substitute for it (this alone
    // wouldn't stop a portaled popover from rendering over the card).
    <div className="relative w-full max-w-[440px] min-h-[500px] p-8 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/80 shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
      {/* Header — brandmark + title, shared across all 3 steps */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl shadow-md flex items-center justify-center bg-zinc-900 text-white font-bold text-base shrink-0">
          S
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Bienvenue dans Sordi</h1>
          <p className="text-xs text-muted-foreground">Configurez votre espace de gestion local en 30 secondes.</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1.5 mb-6">
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={handleStep1Continue} className="space-y-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <Building2 className="w-3.5 h-3.5" />
            Étape 1 — Identité de votre entreprise
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nom de l'entreprise / Raison sociale</label>
            <Input
              type="text"
              placeholder="Ex : EURL Omada Agency"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              autoFocus
              className="h-10 rounded-lg text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Activité principale</label>
            <Select
              value={activity}
              onValueChange={(value) => {
                setActivity(value);
                // Switching away from "Autre" clears any half-typed custom
                // text so a later re-selection of "Autre" starts blank
                // instead of resurrecting a stale value.
                if (value !== OTHER_ACTIVITY) setCustomActivity('');
              }}
            >
              <SelectTrigger className="h-10 rounded-lg text-sm focus-visible:ring-1 focus-visible:ring-primary">
                <SelectValue />
              </SelectTrigger>
              {/* This modal is short and vertically centered, so Radix's
                  default collision detection can decide there's "more room
                  above" the trigger than below and flip the whole menu to
                  open upward — covering the title/step-indicator/company-
                  name field above it. Pinning side="bottom" and disabling
                  collision avoidance forces it to always open downward,
                  which the modal genuinely has room for. */}
              <SelectContent side="bottom" avoidCollisions={false}>
                {ACTIVITIES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Animated reveal — only mounted while "Autre" is selected,
                height+opacity so it slides in/out instead of popping. */}
            <AnimatePresence initial={false}>
              {activity === OTHER_ACTIVITY && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <Input
                    type="text"
                    placeholder="Précisez votre activité (ex: Cabinet comptable, Production audiovisuelle...)"
                    value={customActivity}
                    onChange={(e) => setCustomActivity(e.target.value)}
                    autoFocus
                    className="h-10 rounded-lg text-sm mt-1.5 focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Devise de tenue de compte</label>
            <DesktopSegmentedControl
              className="h-10 w-full"
              options={CURRENCIES.map((c) => ({ value: c.value, label: c.pill }))}
              value={currency}
              onChange={(value) => setCurrency(value as CurrencyCode)}
            />
          </div>

          {errorMessage && (
            <div className="text-[11px] text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleSkipStep1}
              disabled={isCreatingCompany}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Passer cette étape
            </button>
            <Button type="submit" disabled={isCreatingCompany} className="h-9 px-4 rounded-lg text-sm gap-1.5">
              {isCreatingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continuer <ArrowRight className="w-3.5 h-3.5" /></>}
            </Button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleStep2Submit} className="space-y-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <KeyRound className="w-3.5 h-3.5" />
            Étape 2 — Sécurité du coffre local
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mot de passe principal</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="new-password"
                className="h-10 rounded-lg text-sm pr-9"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                {showPassword ? <RiEyeOffLine className="h-4 w-4" /> : <RiEyeLine className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Confirmation</label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="h-10 rounded-lg text-sm pr-9"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                {showConfirmPassword ? <RiEyeOffLine className="h-4 w-4" /> : <RiEyeLine className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {biometricAvailable && (
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border/80 px-3 py-2.5 cursor-pointer">
              <span className="flex items-center gap-2 text-xs text-foreground">
                <Fingerprint className="w-4 h-4 text-muted-foreground" />
                Déverrouiller avec Touch ID
              </span>
              <input
                type="checkbox"
                checked={biometricPreview}
                onChange={(e) => setBiometricPreview(e.target.checked)}
                className="accent-primary"
              />
            </label>
          )}

          {errorMessage && (
            <div className="text-[11px] text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Retour
            </button>
            <Button type="submit" disabled={isSubmittingPassword} className="h-9 px-4 rounded-lg text-sm gap-1.5">
              {isSubmittingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continuer <ArrowRight className="w-3.5 h-3.5" /></>}
            </Button>
          </div>
        </form>
      )}

      {step === 3 && licenseStatus?.state !== 'active' && (
        <div className="space-y-4">
          {!trialRequested ? (
            <form onSubmit={handleActivationSubmit} className="space-y-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <Rocket className="w-3.5 h-3.5" />
                Étape 3 — Activer votre accès
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed -mt-2">
                Laissez-nous vos coordonnées : notre équipe vous contactera par téléphone pour activer votre accès complet.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Numéro de téléphone
                </label>
                <Input
                  type="tel"
                  placeholder="05 XX XX XX XX"
                  value={activationPhone}
                  onChange={(e) => setActivationPhone(e.target.value)}
                  autoFocus
                  className="h-10 rounded-lg text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Adresse email
                </label>
                <Input
                  type="email"
                  placeholder="vous@entreprise.com"
                  value={activationEmail}
                  onChange={(e) => setActivationEmail(e.target.value)}
                  className="h-10 rounded-lg text-sm"
                />
              </div>

              {activationError && (
                <div className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {activationError}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  disabled={requestTrial.isPending}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Passer, activer plus tard
                </button>
                <Button type="submit" disabled={requestTrial.isPending} className="h-9 px-4 rounded-lg text-sm gap-1.5">
                  {requestTrial.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Envoyer la demande <ArrowRight className="w-3.5 h-3.5" /></>}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Demande envoyée
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-1.5">
                <p className="text-sm font-medium text-foreground">Votre demande a bien été reçue !</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Votre accès d'essai est déjà actif. Notre équipe vous appellera prochainement pour vous accompagner et activer votre abonnement complet.
                </p>
              </div>

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 h-10 rounded-lg border border-border/80 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  <WhatsAppIcon className="w-4 h-4 text-emerald-600" />
                  Nous contacter sur WhatsApp
                </a>
              )}

              <Button onClick={() => setStep(4)} className="w-full h-10 rounded-lg text-sm gap-1.5 justify-center">
                Continuer <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Étape 4 — Prêt à démarrer
          </div>

          <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-1">
            <p className="text-sm font-medium text-foreground">{companyName.trim() || 'Mon Entreprise'}</p>
            <p className="text-xs text-muted-foreground">
              {resolvedActivity || ACTIVITIES[0].label} · {CURRENCIES.find((c) => c.value === currency)?.label}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Button
              onClick={() => finish('/invoices/new')}
              className="h-10 rounded-lg text-sm gap-2 justify-center"
            >
              <FileText className="w-4 h-4" />
              Créer ma première facture immédiatement
            </Button>
            <Button
              onClick={() => finish('/')}
              variant="outline"
              className="h-10 rounded-lg text-sm gap-2 justify-center"
            >
              <LayoutDashboard className="w-4 h-4" />
              Explorer le tableau de bord
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
