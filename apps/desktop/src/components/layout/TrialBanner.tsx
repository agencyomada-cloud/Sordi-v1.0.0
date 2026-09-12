import { useState } from "react";
import { RiTimeLine as ClockIcon } from "@remixicon/react";
import { useLicenseDecision } from "@/services/licensing";
import { useLicenseBackgroundVerify } from "@/hooks/useLicense";
import { ActivationModal } from "@/components/licensing/ActivationModal";

/**
 * Slim strip below the Header, driven directly by useLicenseDecision()'s
 * `ui` object — see licensing.ts's getLicenseUiDecision() for the single
 * place that decides showBanner/bannerMessage/blockWrites from the
 * license's actual state. This component itself makes no licensing
 * decisions of its own anymore; it only renders whatever the decision
 * layer says. Owns the ActivationModal's open state so AppLayout just
 * renders `<TrialBanner />` with no prop wiring.
 *
 * Supersedes the old components/LicenseBanner.tsx (removed) — that was a
 * plain amber warning + bare license-key dialog gated on the same
 * `state !== "active"` condition, which would otherwise render a second,
 * competing banner right alongside this one. Its only other job — firing
 * useLicenseBackgroundVerify() once per session — moved here.
 */
export function TrialBanner() {
  useLicenseBackgroundVerify();
  const { state, ui, isLoading } = useLicenseDecision();
  const [activationOpen, setActivationOpen] = useState(false);

  if (isLoading || !ui.showBanner) return null;

  // Every banner state benefits from a way to activate/renew EXCEPT
  // OFFLINE_GRACE — that one is purely "please reconnect", not something
  // pasting a key or contacting support resolves.
  const isActionable = state !== "OFFLINE_GRACE";

  return (
    <>
      <div className="bg-amber-500/10 border-b border-amber-500/20 dark:bg-amber-500/10 dark:border-amber-500/20 text-foreground py-1.5 px-4 text-xs flex items-center justify-between shrink-0">
        <div className="bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1.5">
          <ClockIcon className="w-3.5 h-3.5 shrink-0" />
          <span>{ui.bannerMessage}</span>
        </div>
        {isActionable && (
          <button
            type="button"
            onClick={() => setActivationOpen(true)}
            className="bg-primary/10 hover:bg-primary/15 text-primary text-xs font-medium px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
          >
            {state === "PAID_ACTIVE" ? "Renouveler →" : state === "TRIAL_ACTIVE" ? "Passer à la version Pro →" : "Activer la licence →"}
          </button>
        )}
      </div>

      <ActivationModal open={activationOpen} onOpenChange={setActivationOpen} />
    </>
  );
}
