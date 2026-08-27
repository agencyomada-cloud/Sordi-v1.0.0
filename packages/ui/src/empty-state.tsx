import {
  RiFileCloseLine as FileX,
  RiGroupLine as Users,
  RiBox3Line as Package,
  RiFileTextLine as FileText,
  RiTruckLine as Truck,
  RiStore2Line as Store,
  RiBankCardLine as CreditCard,
  RiReceiptLine as Receipt,
  RiFileList3Line as OrdersIcon,
  RiFolderChartLine as ProjectsIcon,
  RiHistoryLine as HistoryIcon,
  RiPieChartLine as PartnersIcon,
  RiWalletLine as PayrollIcon,
  RiUserSettingsLine as EmployeesIcon,
} from "@remixicon/react";
import { cn } from "./lib/utils";
import { Button } from "./button";

// Same icon per entity as its Sidebar nav item — an empty table should read
// like the section it belongs to, not a generic "nothing here" glyph.
const defaultIcons: Record<string, React.ElementType> = {
  invoices: FileText,
  clients: Users,
  suppliers: Store,
  products: Package,
  deliveries: Truck,
  payments: CreditCard,
  expenses: Receipt,
  orders: OrdersIcon,
  projects: ProjectsIcon,
  history: HistoryIcon,
  partners: PartnersIcon,
  payroll: PayrollIcon,
  employees: EmployeesIcon,
  default: FileX,
};

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  type?: keyof typeof defaultIcons;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  /** "default" is the full-page/full-table treatment (64px circle, large
   *  title, default-size button). "compact" is sized to sit inside a
   *  smaller card body (e.g. a dashboard chart card) — smaller icon badge,
   *  body-weight text instead of a heading, small outline button. */
  size?: "default" | "compact";
}

export function EmptyState({
  title,
  description,
  icon,
  type = "default",
  action,
  className,
  size = "default",
}: EmptyStateProps) {
  const Icon = icon || defaultIcons[type] || defaultIcons.default;

  if (size === "compact") {
    return (
      <div className={cn("flex flex-col items-center justify-center text-center py-8 w-full gap-3 h-full", className)}>
        <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-muted text-muted-foreground">
          <Icon className="w-5 h-5" strokeWidth={1.5} />
        </span>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          {description && <p className="text-xs text-muted-foreground/80 max-w-xs">{description}</p>}
        </div>
        {action && (
          <Button size="sm" variant="outline" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4", className)}>
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-muted-foreground text-sm text-center max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}
