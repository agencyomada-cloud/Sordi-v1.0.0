import { useState } from "react";
import { 
  RiSearchLine as Search, 
  RiEqualizerLine as SlidersHorizontal, 
  RiMoreFill as MoreHorizontal, 
  RiDownloadLine as Download, 
  RiAddLine as Plus 
} from "@remixicon/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type InvoiceStatus = "Paid" | "Pending" | "Unpaid" | "Draft";

interface Invoice {
  id: string;
  client: string;
  email: string;
  date: string;
  amount: string;
  status: InvoiceStatus;
}

const invoices: Invoice[] = [
  { id: "INV-0001", client: "Ethan Mitchell", email: "@ethanmitchell@gmail.com", date: "20 Nov, 2023", amount: "$632", status: "Paid" },
  { id: "INV-0002", client: "Adrian Carter", email: "@adriancarter@gmail.com", date: "21 Nov, 2023", amount: "$632", status: "Pending" },
  { id: "INV-0003", client: "Marcus Turner", email: "@marcusturner@gmail.com", date: "22 Nov, 2023", amount: "$632", status: "Unpaid" },
  { id: "INV-0004", client: "Nolan Foster", email: "@nolanfoster@gmail.com", date: "23 Nov, 2023", amount: "$632", status: "Paid" },
  { id: "INV-0005", client: "Leo Parker", email: "@leoparker@gmail.com", date: "24 Nov, 2023", amount: "$632", status: "Pending" },
  { id: "INV-0006", client: "Garrett Evans", email: "@garrettevans@gmail.com", date: "25 Nov, 2023", amount: "$632", status: "Unpaid" },
  { id: "INV-0007", client: "Henry Nelson", email: "@henrynelson@gmail.com", date: "26 Nov, 2023", amount: "$632", status: "Paid" },
];

const tabs = [
  { label: "All Invoices", count: null },
  { label: "Drafts", count: 3 },
  { label: "Unpaid", count: 4 },
  { label: "Paid", count: 7 },
  { label: "Pending", count: 8 },
];

const statusStyles: Record<InvoiceStatus, string> = {
  Paid: "bg-status-paid-bg text-status-paid",
  Pending: "bg-status-pending-bg text-status-pending",
  Unpaid: "bg-status-unpaid-bg text-status-unpaid",
  Draft: "bg-status-draft-bg text-status-draft",
};

export function InvoiceTable() {
  const [activeTab, setActiveTab] = useState("All Invoices");
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

  const toggleInvoice = (id: string) => {
    setSelectedInvoices(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedInvoices(prev => 
      prev.length === invoices.length 
        ? []
        : invoices.map(i => i.id)
    );
  };

  return (
    <div className="bg-card rounded-xl border border-border">
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-border">
        <h2 className="text-xl font-semibold text-foreground">Invoices</h2>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Import
          </Button>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Tabs and Search */}
      <div className="p-6 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                activeTab === tab.label
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count !== null && (
                <span className={cn(
                  "ml-2 text-xs px-1.5 py-0.5 rounded",
                  activeTab === tab.label
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              type="text" 
              placeholder="Search..." 
              className="pl-10 bg-secondary border-0 focus-visible:ring-1"
            />
          </div>
          <Button variant="outline" className="gap-2">
            Filter
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-4 text-left">
                <Checkbox 
                  checked={selectedInvoices.length === invoices.length}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Invoice ID</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Client</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Email</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Date</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Amount</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Status</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                <td className="px-6 py-4">
                  <Checkbox 
                    checked={selectedInvoices.includes(invoice.id)}
                    onCheckedChange={() => toggleInvoice(invoice.id)}
                  />
                </td>
                <td className="px-6 py-4 text-sm font-medium text-foreground">{invoice.id}</td>
                <td className="px-6 py-4 text-sm text-foreground">{invoice.client}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{invoice.email}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{invoice.date}</td>
                <td className="px-6 py-4 text-sm font-medium text-foreground">{invoice.amount}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "inline-flex px-3 py-1 text-xs font-medium rounded-full",
                    statusStyles[invoice.status]
                  )}>
                    {invoice.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button className="p-1 rounded hover:bg-secondary transition-colors">
                    <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
