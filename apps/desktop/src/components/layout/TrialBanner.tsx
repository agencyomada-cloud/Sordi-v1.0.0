import { useEffect, useState } from "react";
import { RiTimeLine as ClockIcon, RiLockLine as LockIcon, RiAlarmWarningLine as AlarmIcon } from "@remixicon/react";
import { useLicenseDecision } from "@/services/licensing";
import { useLicenseBackgroundVerify } from "@/hooks/useLicense";
import { ActivationModal } from "@/components/licensing/ActivationModal";

const URGENT_THRESHOLD_MS = 72 * 60 * 60 * 1000; // 72h

/** Live days/hours/minutes remaining until `targetIso`, ticking every 30s
 *  — precise enough for a "temps réel" feel at minute granularity without
 *  a per-second re-render an invoicing app has no real need for. Returns
 *  null when there's nothing to count down to. */
function useCountdown(targetIso: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [targetIso]);

  if (!targetIso) return null;
  const totalMs = Math.max(0, new Date(targetIso).getTime() - now);
  return {
    totalMs,
    days: Math.floor(totalMs / 86_400_000),
    hours: Math.floor((totalMs % 86_400_000) / 3_600_000),
    minutes: Math.floor((totalMs % 3_600_000) / 60_000),
  };
}

function formatCountdown(c: { days: number; hours: number; minutes: number }): string {
  if (c.days > 0) return `${c.days}j ${c.hours}h ${c.minutes}min`;
  if (c.hours > 0) return `${c.hours}h ${c.minutes}min`;
  return `${c.minutes}min`;
}

/**
 * Adaptive banner, below the Header — three distinct visual registers
 * depending on how urgent the situation actually is, instead of one flat
 * amber strip for every non-paid state:
 *   - Sober (4-14j remaining on a trial): quiet, informational.
 *   - Urgent (<72h remaining on a trial): Scarlet accent, live
 *     day/hour/minute countdown — this is the moment that actually
 *     deserves attention.
 *   - Locked (trial/paid expired, revoked): a firm but calm "you're in
 *     read-only mode" state, not an alarm — the data is safe, nothing is
 *     being taken away, just gated.
 * A paid, active license shows no banner at all (ui.showBanner is false
 * for PAID_ACTIVE — see licensing.ts's getLicenseUiDecision). Driven by
 * useLicenseDecision() throughout; this component makes no licensing
 * decisions of its own, only presentation choices about a decision it's
 * handed.
 *
 * Supersedes the old components/LicenseBanner.tsx (removed) — that was a
 * plain amber warning + bare license-key dialog. Its only other job —
 * firing useLicenseBackgroundVerify() once per session — lives here.
 */
export function TrialBanner() {
  useLicenseBackgroundVerify();
  const { state, ui, expiresAt, daysRemaining, isLoading } = useLicenseDecision();
  const [activationOpen, setActivationOpen] = useState(false);
  const countdown = useCountdown(state === "TRIAL_ACTIVE" ? expiresAt : null);

  if (isLoading || !ui.showBanner) return null;

  const isUrgentTrial = state === "TRIAL_ACTIVE" && countdown !== null && countdown.totalMs <= URGENT_THRESHOLD_MS;
  const isLocked = state === "TRIAL_EXPIRED" || state === "PAID_EXPIRED" || state === "REVOKED";

  // Every register benefits from a way to activate/renew EXCEPT
  // OFFLINE_GRACE — that one is purely "please reconnect", not something
  // pasting a key or contacting support resolves.
  const isActionable = state !== "OFFLINE_GRACE";
  const actionLabel = isLocked ? "Débloquer l'accès →" : state === "TRIAL_ACTIVE" ? "Passer à la version Pro →" : "Activer la licence →";

  let toneClasses = "bg-amber-500/10 border-amber-500/20 dark:bg-amber-500/10 dark:border-amber-500/20";
  let pillClasses = "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  let Icon = ClockIcon;
  let message: React.ReactNode = ui.bannerMessage;

  if (isUrgentTrial && countdown) {
    toneClasses = "bg-primary/10 border-primary/30";
    pillClasses = "bg-primary/15 text-primary";
    Icon = AlarmIcon;
    message = (
      <>
        <span className="hidden sm:inline">⚡ Essai Sordi Pro —</span> il reste{" "}
        <span className="font-semibold tabular-nums">{formatCountdown(countdown)}</span>
      </>
    );
  } else if (state === "TRIAL_ACTIVE") {
    const days = daysRemaining ?? 0;
    message = `⚡ Essai Sordi Pro : ${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}`;
  } else if (isLocked) {
    toneClasses = "bg-muted border-border";
    pillClasses = "bg-muted-foreground/10 text-muted-foreground";
    Icon = LockIcon;
    message = state === "TRIAL_EXPIRED" ? "🔒 Période d'essai terminée — Mode consultation active" : `🔒 ${ui.bannerMessage}`;
  }

  return (
    <>
      <div className={`border-b py-1.5 px-4 text-xs flex items-center justify-between shrink-0 transition-colors ${toneClasses}`}>
        <div className={`font-medium px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1.5 ${pillClasses}`}>
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span>{message}</span>
        </div>
        {isActionable && (
          <button
            type="button"
            onClick={() => setActivationOpen(true)}
            className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
              isUrgentTrial ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "bg-primary/10 hover:bg-primary/15 text-primary"
            }`}
          >
            {actionLabel}
          </button>
        )}
      </div>

      <ActivationModal open={activationOpen} onOpenChange={setActivationOpen} />
    </>
  );
}
