import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db, type TelemetryStatus } from "@/lib/database";

/** Read-only — the actual heartbeat send is entirely background/Rust-side
 *  (see telemetry.rs), never triggered from here. This just reflects the
 *  disclosed opt-out preference and last-sent time for Settings. */
export function useTelemetryStatus() {
  return useQuery({
    queryKey: ["telemetry", "status"],
    queryFn: (): Promise<TelemetryStatus> => db.telemetry.getStatus(),
    staleTime: 30_000,
  });
}

export function useSetTelemetryEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => db.telemetry.setEnabled(enabled),
    onSuccess: (_data, enabled) => {
      queryClient.setQueryData<TelemetryStatus | undefined>(["telemetry", "status"], (prev) =>
        prev ? { ...prev, enabled } : prev
      );
    },
  });
}
