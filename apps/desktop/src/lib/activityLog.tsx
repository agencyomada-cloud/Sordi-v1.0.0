import {
  RiUserLine as User,
  RiFileTextLine as FileText,
  RiTruckLine as Truck,
  RiSettings3Line as Settings,
  RiDatabase2Line as Database,
  RiReceiptLine as Receipt,
  RiHistoryLine as HistoryIcon,
  RiFileShield2Line as ContractIcon,
  RiFileList3Line as OrderIcon,
  RiBankCardLine as PaymentIcon,
  RiStore2Line as SupplierIcon,
} from "@remixicon/react";

/**
 * Shared between the History page and the header notification dropdown —
 * one place for what an activity log entry looks like, so the two views
 * can't quietly drift apart.
 */
export function getActionColor(action: string) {
  switch (action) {
    case "CREATE": return "bg-stat-positive/10 text-stat-positive border-stat-positive/20";
    case "UPDATE": return "bg-primary/10 text-primary border-primary/20";
    case "DELETE": return "bg-destructive/10 text-destructive border-destructive/20";
    case "CONVERT": return "bg-chart-5/10 text-chart-5 border-chart-5/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function getActionLabel(action: string) {
  switch (action) {
    case "CREATE": return "Création";
    case "UPDATE": return "Modification";
    case "DELETE": return "Suppression";
    case "CONVERT": return "Conversion";
    default: return action;
  }
}

export function getEntityConfig(type: string) {
  switch (type) {
    case "CLIENT":
      return { label: "Client", color: "bg-chart-1/10 text-chart-1", icon: <User className="w-4 h-4" /> };
    case "INVOICE":
      return { label: "Facture", color: "bg-chart-5/10 text-chart-5", icon: <FileText className="w-4 h-4" /> };
    case "DELIVERY":
      return { label: "Livraison", color: "bg-chart-2/10 text-chart-2", icon: <Truck className="w-4 h-4" /> };
    case "PRODUCT":
      return { label: "Produit", color: "bg-chart-3/10 text-chart-3", icon: <Database className="w-4 h-4" /> };
    case "SETTINGS":
      return { label: "Paramètres", color: "bg-muted text-muted-foreground", icon: <Settings className="w-4 h-4" /> };
    case "EXPENSE":
      return { label: "Dépense", color: "bg-destructive/10 text-destructive", icon: <Receipt className="w-4 h-4" /> };
    case "CONTRACT":
      return { label: "Contrat", color: "bg-indigo-500/10 text-indigo-500", icon: <ContractIcon className="w-4 h-4" /> };
    case "ORDER":
      return { label: "Commande", color: "bg-cyan-500/10 text-cyan-500", icon: <OrderIcon className="w-4 h-4" /> };
    case "PAYMENT":
      return { label: "Paiement", color: "bg-teal-500/10 text-teal-500", icon: <PaymentIcon className="w-4 h-4" /> };
    case "SUPPLIER":
      return { label: "Fournisseur", color: "bg-orange-500/10 text-orange-500", icon: <SupplierIcon className="w-4 h-4" /> };
    default:
      return { label: type, color: "bg-muted text-muted-foreground", icon: <HistoryIcon className="w-4 h-4" /> };
  }
}

/** Where clicking a notification for this entity type should navigate. */
export function getEntityRoute(entityType: string, entityId: string | null): string {
  if (!entityId) return "/history";
  switch (entityType) {
    case "CLIENT": return `/clients/${entityId}`;
    case "INVOICE": return `/invoices/${entityId}`;
    case "DELIVERY": return `/deliveries/${entityId}`;
    case "PRODUCT": return "/products";
    case "EXPENSE": return "/expenses";
    case "SETTINGS": return "/settings";
    case "CONTRACT": return "/contracts";
    case "ORDER": return `/orders/${entityId}`;
    case "PAYMENT": return "/payments";
    case "SUPPLIER": return "/fournisseurs";
    default: return "/history";
  }
}
