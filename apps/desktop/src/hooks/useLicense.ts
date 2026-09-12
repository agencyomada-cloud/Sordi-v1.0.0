import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db, type LicenseStatus } from "@/lib/database";

// omada-agency-branch-only: set via apps/desktop/.env.omada-agency
// (VITE_LICENSE_BYPASS=true), never present in a real Sordi build. Keeps the
// licensing code itself (license.rs, this file's real query path) completely
// untouched — this is a single additive short-circuit, not a modification of
// how licensing works.
const LICENSE_BYPASS = import.meta.env.VITE_LICENSE_BYPASS === "true";
const BYPASS_STATUS: LicenseStatus = { state: "active", client_reference_id: null, expires_at: null, plan_type: "lifetime" };

export function useLicenseStatus() {
  return useQuery({
    queryKey: ["license", "status"],
    queryFn: () => (LICENSE_BYPASS ? Promise.resolve(BYPASS_STATUS) : db.license.getStatus()),
    // Local-only check on the Rust side (a file read + signature verify) —
    // cheap enough to treat as fresh on every focus, not just app start.
    staleTime: 0,
  });
}

export function useActivateLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (licenseKey: string) => db.license.activate(licenseKey),
    onSuccess: (status) => {
      queryClient.setQueryData(["license", "status"], status);
    },
  });
}

export function useRequestTrial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { organizationName: string; phone: string; email: string }) => db.license.requestTrial(input),
    onSuccess: (status) => {
      queryClient.setQueryData(["license", "status"], status);
    },
  });
}

/** Fires the background re-verify once per app session, right after mount.
 *  Never blocks anything and never surfaces an error — a network failure
 *  here just means the existing local token (if still locally valid) keeps
 *  being used until the next launch tries again. Only updates the cached
 *  status on success, since that's the only case where anything changed. */
export function useLicenseBackgroundVerify() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (LICENSE_BYPASS) return;
    let cancelled = false;
    db.license
      .verifyBackground()
      .then((status) => {
        if (!cancelled) queryClient.setQueryData(["license", "status"], status);
      })
      .catch(() => {
        // Silent by design — see verify_background()'s own doc comment in
        // license.rs for why a failure here must never surface to the user.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
