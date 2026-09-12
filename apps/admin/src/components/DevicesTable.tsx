import { EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@sordi/ui";
import { RiComputerLine as DeviceIcon, RiWhatsappLine as WhatsAppIcon } from "@remixicon/react";
import type { DeviceRow } from "@/lib/adminApi";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { DeviceStatusBadge } from "./DeviceStatusBadge";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface DevicesTableProps {
  devices: DeviceRow[];
  isLoading: boolean;
  onRowClick: (device: DeviceRow) => void;
}

export function DevicesTable({ devices, isLoading, onRowClick }: DevicesTableProps) {
  if (!isLoading && devices.length === 0) {
    return (
      <EmptyState
        icon={DeviceIcon}
        title="Aucun appareil"
        description="Aucun appareil n'a encore envoyé de heartbeat, ou aucun ne correspond à vos filtres."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Client / Appareil</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Utilisation</TableHead>
          <TableHead>Téléchargé le</TableHead>
          <TableHead>Dernier ping</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {devices.map((device) => (
          <TableRow
            key={device.id}
            onClick={() => onRowClick(device)}
            className="cursor-pointer hover:bg-muted/40"
          >
            <TableCell>
              <p className="font-medium text-sm">{device.customerName || "Client inconnu"}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{device.machineId}</p>
            </TableCell>
            <TableCell>
              {device.phoneNumber ? (
                <a
                  href={buildWhatsAppLink(device.phoneNumber)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5" />
                  {device.phoneNumber}
                </a>
              ) : device.email ? (
                <span className="text-xs text-muted-foreground">{device.email}</span>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <DeviceStatusBadge status={device.effectiveStatus} />
            </TableCell>
            <TableCell className="text-xs tabular-nums text-muted-foreground">
              {device.invoicesCount} factures · {device.clientsCount} clients
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">{formatDate(device.downloadedAt)}</TableCell>
            <TableCell className="text-muted-foreground text-xs">{formatDateTime(device.lastSeenAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
