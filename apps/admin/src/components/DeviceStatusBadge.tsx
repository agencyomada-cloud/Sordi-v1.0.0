import { StatusBadge, type StatusBadgeTone } from "@sordi/ui";
import type { DeviceRow } from "@/lib/adminApi";

const TONE_BY_STATUS: Record<DeviceRow["effectiveStatus"], StatusBadgeTone> = {
  trial: "warning",
  active: "success",
  expired: "error",
};

const LABEL_BY_STATUS: Record<DeviceRow["effectiveStatus"], string> = {
  trial: "Essai",
  active: "Actif",
  expired: "Expiré",
};

export function DeviceStatusBadge({ status }: { status: DeviceRow["effectiveStatus"] }) {
  return <StatusBadge tone={TONE_BY_STATUS[status]}>{LABEL_BY_STATUS[status]}</StatusBadge>;
}
