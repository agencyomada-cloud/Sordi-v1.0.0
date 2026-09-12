import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@sordi/ui";
import { RiLoader4Line as Loader2 } from "@remixicon/react";
import { DatePicker } from "@/components/ui/date-picker";
import { useCreatePayment } from "@/hooks/usePayments";

// Matches the "X XXX.XX DA" convention InvoiceDetail.tsx's own formatCurrency
// already uses everywhere else on this page (invoicePdfShared's formatCurrency
// prints "DZD" instead, which would look inconsistent side by side with it).
const formatCurrency = (amount: number | null | undefined): string => {
  if (!amount) return "0.00 DA";
  return new Intl.NumberFormat("fr-DZ", { style: "decimal", minimumFractionDigits: 2 }).format(amount) + " DA";
};

interface RecordPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  /** The invoice's current balance_due — pre-fills Montant with the exact
   *  remaining amount, the common case (full settlement in one payment). */
  balanceDue: number;
  onRecorded?: () => void;
}

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "cash", label: "Espèces" },
  { value: "cheque", label: "Chèque" },
  { value: "transfer", label: "Virement bancaire" },
  { value: "traite", label: "Traite" },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Records a payment against an invoice in place, without navigating away to
 * the standalone Payments page — the amount pre-fills with the exact
 * remaining balance (the common "settle it all now" case), and the actual
 * partial-vs-full status transition is computed server-side by the existing
 * update_invoice_payment_status (database.rs), called automatically by
 * useCreatePayment's create_payment command. This modal only collects the
 * payment's own fields; it never sets invoice.status itself.
 */
export function RecordPaymentModal({ open, onOpenChange, invoiceId, balanceDue, onRecorded }: RecordPaymentModalProps) {
  const createPayment = useCreatePayment();
  const [amount, setAmount] = useState(String(Math.max(0, balanceDue)));
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // Re-prime the form to the current balance every time the modal opens —
  // otherwise a second payment on the same invoice would still show the
  // amount left over from whatever was typed during the first one.
  useEffect(() => {
    if (open) {
      setAmount(String(Math.max(0, balanceDue)));
      setPaymentDate(todayISO());
      setPaymentMethod("cash");
      setReference("");
      setNotes("");
    }
  }, [open, balanceDue]);

  const parsedAmount = Number(amount);
  const isValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    createPayment.mutate(
      {
        invoice_id: invoiceId,
        payment_date: paymentDate,
        amount: parsedAmount,
        payment_method: paymentMethod,
        cheque_number: reference || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onRecorded?.();
        },
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Slide-over, not a center-screen blocking modal — the invoice grid
          behind it stays visible/contextually present instead of being
          fully obscured for what's usually a quick, single-field edit. */}
      <SheetContent side="right" className="max-w-md w-full border-l border-border/80 bg-card p-6 shadow-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-sm font-semibold flex items-center justify-between gap-2">
            <span>Enregistrer un paiement</span>
            <kbd className="text-[10px] font-mono font-normal text-muted-foreground border border-border/60 rounded px-1.5 py-0.5">Esc</kbd>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-2 flex-1 overflow-y-auto">
          <div className="space-y-1.5">
            <Label htmlFor="payment-amount">Montant</Label>
            <Input
              id="payment-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              Reste à payer : <span className="font-mono tabular-nums">{formatCurrency(balanceDue)}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Date de règlement</Label>
            <DatePicker value={paymentDate} onChange={setPaymentDate} />
          </div>

          <div className="space-y-1.5">
            <Label>Mode de paiement</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-reference">Référence / N° de transaction</Label>
            <Input
              id="payment-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex : N° de chèque, référence de virement..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-notes">Note interne</Label>
            <Textarea
              id="payment-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optionnel"
            />
          </div>
        </div>

        <SheetFooter className="shrink-0 pt-4 border-t border-border/60 sm:justify-end">
          <Button variant="outline" size="sm" className="h-[30px] text-xs" onClick={() => onOpenChange(false)} disabled={createPayment.isPending}>
            Annuler
          </Button>
          <Button size="sm" className="h-[30px] text-xs gap-1.5" onClick={handleSubmit} disabled={!isValid || createPayment.isPending}>
            {createPayment.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Enregistrer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
