import { useState } from "react";
import { SearchInput, Switch, Label, Button, Tabs, TabsList, TabsTrigger } from "@sordi/ui";
import { RiLogoutBoxRLine as LogoutIcon, RiShieldKeyholeLine as KeyIcon, RiRefreshLine as RefreshIcon } from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { clearAdminKey } from "@/lib/adminAuth";
import { useDevices } from "@/hooks/useDevices";
import { useLeadNotifications } from "@/hooks/useLeadNotifications";
import { KpiCards } from "@/components/KpiCards";
import { DeviceFilterTabs, type DeviceFilter } from "@/components/DeviceFilterTabs";
import { DevicesTable } from "@/components/DevicesTable";
import { LeadsTable } from "@/components/LeadsTable";
import { CustomerDrawer } from "@/components/CustomerDrawer";
import { IssueLicenseModal } from "@/components/IssueLicenseModal";
import { NotificationBell } from "@/components/NotificationBell";
import type { DeviceRow } from "@/lib/adminApi";

type Section = "devices" | "leads";

export function Dashboard() {
  const [section, setSection] = useState<Section>("devices");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DeviceFilter>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [drawerDevice, setDrawerDevice] = useState<DeviceRow | null>(null);
  const [issuingDevice, setIssuingDevice] = useState<DeviceRow | null>(null);

  const status = filter === "all" ? undefined : filter;
  const { data: devices = [], isLoading } = useDevices(search, status, autoRefresh);
  const { leads } = useLeadNotifications();
  const queryClient = useQueryClient();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
            <KeyIcon className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">Sordi Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <button
            type="button"
            onClick={clearAdminKey}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <LogoutIcon className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Command Center</h1>
          <div className="flex items-center gap-3">
            {section === "devices" && (
              <div className="flex items-center gap-2">
                <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground cursor-pointer">
                  Auto (10s)
                </Label>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: [section === "devices" ? "devices" : "leads"] })}
              className="flex items-center gap-1.5"
            >
              <RefreshIcon className="w-3.5 h-3.5" />
              Actualiser
            </Button>
          </div>
        </div>

        <KpiCards devices={devices} />

        <Tabs value={section} onValueChange={(v) => setSection(v as Section)}>
          <TabsList>
            <TabsTrigger value="devices">Appareils</TabsTrigger>
            <TabsTrigger value="leads">
              Prospects{leads.length > 0 ? ` (${leads.length})` : ""}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {section === "devices" ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <DeviceFilterTabs value={filter} onChange={setFilter} />
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Machine ID, nom, téléphone, email..."
                containerClassName="w-80"
              />
            </div>
            <DevicesTable devices={devices} isLoading={isLoading} onRowClick={setDrawerDevice} />
          </>
        ) : (
          <LeadsTable leads={leads} />
        )}
      </main>

      <CustomerDrawer
        device={drawerDevice}
        onOpenChange={(open) => !open && setDrawerDevice(null)}
        onIssueLicense={(device) => {
          setIssuingDevice(device);
        }}
      />

      <IssueLicenseModal device={issuingDevice} onOpenChange={(open) => !open && setIssuingDevice(null)} />
    </div>
  );
}
