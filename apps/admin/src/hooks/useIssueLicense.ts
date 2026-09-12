import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/adminApi";

export function useIssueLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      machineId,
      validDays,
      licenseType,
    }: {
      machineId: string;
      validDays: number;
      licenseType: "yearly" | "lifetime";
    }) => adminApi.issueLicense(machineId, validDays, licenseType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}
