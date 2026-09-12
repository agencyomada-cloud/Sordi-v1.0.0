import { useState } from "react";
import { RiTimeLine as ClockIcon } from "@remixicon/react";
import { useTrialStatus } from "@/services/licensing";
import { useLicenseStatus, useLicenseBackgroundVerify } from "@/hooks/useLicense";
import { ActivationModal } from "@/components/licensing/ActivationModal";

/**
 * Slim strip below the Header, visible whenever the license isn't fully
 * "active" — see useTrialStatus for what "trial" means here (an
 * informational countdown, not the real enforcement boundary). Owns the
 * ActivationModal's open state itself so AppLayout just renders
 * `<TrialBanner />` with no prop wiring.
 *
 * Supersedes the old components/LicenseBanner.tsx (removed) — that was a
 * plain amber warning + bare license-key dialog gated on the same
 * `state !== "active"` condition, which would otherwise render a second,
 * competing banner right alongside this one. Its only other job — firing
 * useLicenseBackgroundVerify() once per session — moved here.
 */
export function TrialBanner() {
  useLicenseBackgroundVerify();
  const { data: status } = useLicenseStatus();
  const { isTrial, trialDaysRemaining, isLoading } = useTrialStatus();
  const [activationOpen, setActivationOpen] = useState(false);

  if (isLoading || !isTrial) return null;

  // Genuinely not activated / expired-and-locked yet has no expiry claim
  // to count down from (useTrialStatus's fallback), vs. actually active
  // with a real term (trial or paid annual) — different label, since
  // "il vous reste 14 jours" doesn't make sense before any countdown has
  // started at all.
  const isActiveWithExpiry = status?.state === "active";

  return (
    <>
      <div className="bg-amber-500/10 border-b border-amber-500/20 dark:bg-amber-500/10 dark:border-amber-500/20 text-foreground py-1.5 px-4 text-xs flex items-center justify-between shrink-0">
        <div className="bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1.5">
          <ClockIcon className="w-3.5 h-3.5 shrink-0" />
          <span>
            {isActiveWithExpiry
              ? `Période d'essai : il vous reste ${trialDaysRemaining} jour${trialDaysRemaining > 1 ? "s" : ""}`
              : "Licence non activée"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setActivationOpen(true)}
          className="bg-primary/10 hover:bg-primary/15 text-primary text-xs font-medium px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
        >
          {isActiveWithExpiry ? "Passer à la version Pro →" : "Activer la licence →"}
        </button>
      </div>

      <ActivationModal open={activationOpen} onOpenChange={setActivationOpen} />
    </>
  );
}
