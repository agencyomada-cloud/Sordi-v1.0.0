import { useMemo, useState } from "react";
import { Input, Label } from "@sordi/ui";
import { RiFileDownloadLine as PdfIcon, RiCheckLine as CheckIcon, RiShieldCheckLine as ShieldIcon, RiMailSendLine as MailIcon } from "@remixicon/react";

const TVA_RATE = 0.19;
const TIMBRE_FISCAL = 500;
const DEFAULT_HT = 50000;

function formatDA(amount: number): string {
  return `${Math.round(amount).toLocaleString("fr-FR")} DA`;
}

/** Live, editable mini invoice calculator embedded directly in the hero —
 *  a "try it before you download it" sandbox rather than a static
 *  screenshot or mockup. All computation is client-side and instantaneous;
 *  nothing here calls the API. */
export function InvoiceSandbox() {
  const [htInput, setHtInput] = useState(String(DEFAULT_HT));
  const [exported, setExported] = useState(false);

  const ht = useMemo(() => {
    const parsed = Number.parseFloat(htInput.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [htInput]);

  const tva = ht * TVA_RATE;
  const ttc = ht + tva + TIMBRE_FISCAL;

  const handleExport = () => {
    setExported(true);
    window.setTimeout(() => setExported(false), 2200);
  };

  return (
    <div className="mt-16 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden text-left">
      <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">Simulateur de facture</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2.5 py-1">
          <ShieldIcon className="w-3.5 h-3.5" />
          Conforme 100% réglementation algérienne
        </span>
      </div>

      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="sandbox-ht" className="text-slate-600">
            Montant HT (DA)
          </Label>
          <Input
            id="sandbox-ht"
            value={htInput}
            onChange={(e) => setHtInput(e.target.value)}
            inputMode="decimal"
            className="mt-1.5 h-11 text-lg font-semibold border-slate-200 focus-visible:ring-rose-500/20 focus-visible:border-rose-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">TVA (19%)</span>
            <span className="font-medium tabular-nums text-slate-900">{formatDA(tva)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Timbre fiscal</span>
            <span className="font-medium tabular-nums text-slate-900">{formatDA(TIMBRE_FISCAL)}</span>
          </div>
          <div className="h-px bg-slate-200" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Total TTC</span>
            <span className="text-2xl font-bold tabular-nums text-slate-900">{formatDA(ttc)}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          onClick={handleExport}
          disabled={exported}
          className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold transition-colors ${
            exported ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-rose-600 text-white hover:bg-rose-700"
          }`}
        >
          {exported ? <CheckIcon className="w-4 h-4" /> : <PdfIcon className="w-4 h-4" />}
          {exported ? "PDF exporté !" : "Exporter en PDF certifié"}
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <MailIcon className="w-4 h-4" />
          Envoyer par email
        </button>
      </div>
    </div>
  );
}
