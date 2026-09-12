import { Tabs, TabsList, TabsTrigger } from "@sordi/ui";
import type { DeviceStatus } from "@/lib/adminApi";

export type DeviceFilter = "all" | DeviceStatus;

const TABS: { value: DeviceFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "trial", label: "Essais" },
  { value: "active", label: "Licences actives" },
  { value: "expired", label: "Inactifs / Expirés" },
];

interface DeviceFilterTabsProps {
  value: DeviceFilter;
  onChange: (value: DeviceFilter) => void;
}

export function DeviceFilterTabs({ value, onChange }: DeviceFilterTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as DeviceFilter)}>
      <TabsList>
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
