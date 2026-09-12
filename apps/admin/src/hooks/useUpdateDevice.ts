import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/adminApi";

export function useUpdateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      machineId,
      data,
    }: {
      machineId: string;
      data: { customerName?: string; email?: string; phoneNumber?: string };
    }) => adminApi.updateDevice(machineId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}
