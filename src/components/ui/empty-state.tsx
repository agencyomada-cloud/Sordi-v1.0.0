import { 
  RiFileCloseLine as FileX, 
  RiGroupLine as Users, 
  RiBox3Line as Package, 
  RiFileTextLine as FileText, 
  RiTruckLine as Truck, 
  RiBankCardLine as CreditCard, 
  RiReceiptLine as Receipt 
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const defaultIcons: Record<string, React.ElementType> = {
  invoices: FileText,
  clients: Users,
  products: Package,
  deliveries: Truck,
  payments: CreditCard,
  expenses: Receipt,
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
}

export function EmptyState({ 
  title, 
  description, 
  icon, 
  type = "default",
  action,
  className 
}: EmptyStateProps) {
  const Icon = icon || defaultIcons[type] || defaultIcons.default;

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
