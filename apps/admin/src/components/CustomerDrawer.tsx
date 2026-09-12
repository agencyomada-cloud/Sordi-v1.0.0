import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@sordi/ui";
import { RiWhatsappLine as WhatsAppIcon, RiSaveLine as SaveIcon } from "@remixicon/react";
import type { DeviceRow } from "@/lib/adminApi";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { useUpdateDevice } from "@/hooks/useUpdateDevice";
import { DeviceStatusBadge } from "./DeviceStatusBadge";

interface CustomerDrawerProps {
  device: DeviceRow | null;
  onOpenChange: (open: boolean) => void;
  onIssueLicense: (device: DeviceRow) => void;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function TelemetryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono text-foreground">{value}</span>
    </div>
  );
}

export function CustomerDrawer({ device, onOpenChange, onIssueLicense }: CustomerDrawerProps) {
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const updateDevice = useUpdateDevice();

  useEffect(() => {
    if (device) {
      setCustomerName(device.customerName ?? "");
      setEmail(device.email ?? "");
      setPhoneNumber(device.phoneNumber ?? "");
    }
  }, [device]);

  const open = device !== null;

  const handleSave = () => {
    if (!device) return;
    updateDevice.mutate(
      { machineId: device.machineId, data: { customerName, email, phoneNumber } },
      {
        onSuccess: () => toast.success("Informations client mises à jour."),
        onError: (error) => toast.error(error instanceof Error ? error.message : "Échec de la mise à jour."),
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {device && (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono text-sm">{device.machineId}</SheetTitle>
            </SheetHeader>
            <div className="mt-1">
              <DeviceStatusBadge status={device.effectiveStatus} />
            </div>

            <div className="mt-6 space-y-6">
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</h3>
                <div className="space-y-1.5">
                  <Label htmlFor="customer-name">Nom</Label>
                  <Input id="customer-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nom du client" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customer-email">Email</Label>
                  <Input id="customer-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@exemple.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customer-phone">Téléphone (WhatsApp)</Label>
                  <Input id="customer-phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="213555123456" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={updateDevice.isPending}
                  className="w-full flex items-center justify-center gap-1.5"
                >
                  <SaveIcon className="w-3.5 h-3.5" />
                  {updateDevice.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
                {phoneNumber && (
                  <a
                    href={buildWhatsAppLink(phoneNumber)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 h-9 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
                  >
                    <WhatsAppIcon className="w-4 h-4" />
                    Ouvrir WhatsApp
                  </a>
                )}
              </section>

              <section className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Télémétrie & matériel
                </h3>
                <TelemetryRow label="Empreinte machine" value={device.deviceFingerprint.slice(0, 24) + "…"} />
                <TelemetryRow label="Version de l'app" value={device.appVersion} />
                <TelemetryRow label="Plateforme" value={device.osPlatform ?? "—"} />
                <TelemetryRow label="Factures locales" value={String(device.invoicesCount)} />
                <TelemetryRow label="Clients locaux" value={String(device.clientsCount)} />
                <TelemetryRow label="Dépenses locales" value={String(device.expensesCount)} />
                <TelemetryRow label="Type de licence" value={device.licenseType ?? "—"} />
                <TelemetryRow label="Téléchargé le" value={formatDateTime(device.downloadedAt)} />
                <TelemetryRow label="Dernière activité" value={formatDateTime(device.lastActiveAt)} />
                <TelemetryRow label="Dernier ping serveur" value={formatDateTime(device.lastSeenAt)} />
                <TelemetryRow label="Valide jusqu'au" value={formatDateTime(device.validUntil)} />
              </section>

              <Button onClick={() => onIssueLicense(device)} className="w-full">
                Émettre une licence
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
