import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/database";

export function useLicenseStatus() {
  return useQuery({
    queryKey: ["license", "status"],
    queryFn: () => db.license.getStatus(),
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

/** Fires the background re-verify once per app session, right after mount.
 *  Never blocks anything and never surfaces an error — a network failure
 *  here just means the existing local token (if still locally valid) keeps
 *  being used until the next launch tries again. Only updates the cached
 *  status on success, since that's the only case where anything changed. */
export function useLicenseBackgroundVerify() {
  const queryClient = useQueryClient();
  useEffect(() => {
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
