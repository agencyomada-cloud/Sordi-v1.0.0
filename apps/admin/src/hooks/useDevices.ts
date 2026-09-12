import { useQuery } from "@tanstack/react-query";
import { adminApi, type DeviceStatus } from "@/lib/adminApi";

export function useDevices(search: string, status: DeviceStatus | undefined, autoRefresh: boolean) {
  return useQuery({
    queryKey: ["devices", search, status],
    queryFn: () => adminApi.listDevices(search || undefined, status),
    select: (data) => data.devices,
    // Devices list is cheap and benefits from staying fresh — an admin
    // issuing a license wants to immediately see the row flip to "active".
    staleTime: 0,
    // Manual refresh always works via queryClient.invalidateQueries; this
    // additionally polls every 10s when the caller's auto-refresh toggle is
    // on, per the task's "real-time auto-refresh / polling toggle" spec.
    refetchInterval: autoRefresh ? 10_000 : false,
  });
}
