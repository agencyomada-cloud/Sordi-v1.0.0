import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { AiCopilotResult } from "./AiCopilotResult";
import { AnimatedPlaceholder } from "./AnimatedPlaceholder";
import { SordiCopilotOrb } from "./SordiCopilotOrb";
import { analyzeCopilotText, CopilotApiError } from "./copilotApi";
import { useCopilotContext } from "./useCopilotContext";
import { useAiCopilotShortcut } from "./useAiCopilotShortcut";
import { findCachedResult, getFewShotExamples, recordConfirmedExample, recordDraftCorrections } from "./copilotMemory";
import { useCreateExpense } from "@/hooks/useExpenses";
import { useCreateInvoice } from "@/hooks/useInvoices";
import { useCreateClient } from "@/hooks/useClients";
import { useCreateProduct } from "@/hooks/useProducts";
import { useCreatePayment } from "@/hooks/usePayments";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { CopilotResult } from "./types";

// One example per major action the Copilot understands, deliberately
// with no real company/client names (Nadatek et al. are this app's own
// test data, not something to show off in a rotating placeholder) —
// covers compound invoices, French and Darija expenses, standalone
// client/product creation, and a direct settings command.
const PLACEHOLDERS = [
  "Créer facture avec 40% d'acompte et 2 articles...",
  "Dépense matériel bureau 15 000 DA par carte...",
  "خلصت مازوت 3000 دج نقدا...",
  "Nouveau client Particulier tél 0550 12 34 56...",
  "Nouveau produit Câble Réseau prix vente 2500 DA achat 1400 DA...",
  "Mettre l'application en mode nuit...",
];

const ROTATE_INTERVAL_MS = 4000;

/**
 * Permanent hero input pinned to the top of the Dashboard (Index.tsx),
 * directly above the KPI strip. Free text in, a live in-memory review
 * card out — nothing ever reaches SQLite until "Confirmer & Enregistrer"
 * is actually clicked (or Enter pressed with the input empty, its keyboard
 * equivalent). The review card (AiCopilotResult) is a fully controlled,
 * editable form bound to `draft`, and typing a further instruction while
 * it's showing re-analyzes it as a refinement of the current draft.
 *
 * Two extra layers beyond the raw parse call:
 * - An exact-repeat offline cache (copilotMemory.ts's findCachedResult) —
 *   re-typing the same phrase you've confirmed before resolves instantly,
 *   0 API tokens, 0 network latency.
 * - Few-shot injection of this company's last few confirmed examples,
 *   sent with every online call so Gemini picks up this user's own
 *   vocabulary over time.
 *
 * Self-contained: Index.tsx only renders <AiCopilotBar /> and owns none of
 * its state, so this whole feature lives in this directory.
 */
export function AiCopilotBar() {
  const [value, setValue] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [phase, setPhase] = useState<"idle" | "processing" | "result" | "error">("idle");
  const [draft, setDraft] = useState<CopilotResult | null>(null);
  const [wasFromCache, setWasFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Drives the orb's brief "bloom" — flipped true right after a
  // successful confirm, auto-cleared ~600ms later (long enough for the
  // orb's own one-shot bloom animation to play out) rather than tied to
  // `phase`, which is already back to "idle" (drawer closed) by then.
  const [justSucceeded, setJustSucceeded] = useState(false);
  // Drives the input beam's "active" (faster/brighter) state alongside
  // isProcessing — set on focus/blur so typing (not just AI activity)
  // reads as "AI readiness" too, per the Gemini/Apple-Intelligence brief.
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  // The AI's own output, before any in-place edits — kept separately from
  // `draft` so confirm-time correction logging can diff "what the model
  // said" against "what the user actually kept". The very first natural-
  // language prompt (never a refinement's synthetic JSON-embedding text)
  // is kept alongside it, since that's what gets logged/cached/replayed.
  const originalDraftRef = useRef<CopilotResult | null>(null);
  const originalPromptRef = useRef<string>("");

  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const context = useCopilotContext();
  const { activeCompanyId } = useWorkspace();
  const createExpense = useCreateExpense();
  const createInvoice = useCreateInvoice();
  const createClient = useCreateClient();
  const createProduct = useCreateProduct();
  const createPayment = useCreatePayment();
  const isSaving =
    createExpense.isPending || createInvoice.isPending || createClient.isPending || createProduct.isPending || createPayment.isPending;

  useAiCopilotShortcut(inputRef);

  // Rotating placeholder — paused once there's real input or the drawer is
  // open, so it never competes with what the user is actually looking at.
  useEffect(() => {
    if (value || phase !== "idle") return;
    const id = setInterval(() => setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length), ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [value, phase]);

  // SET_APP_SETTINGS is the one action that never gets a review card —
  // it's executed the instant it's recognized (either from the network or
  // the offline cache), with just a toast, per the "instant toggle, no
  // heavy review card" brief. Returns true if it handled the result (so
  // the caller knows not to also open the drawer).
  const applyIfSettingsAction = (analyzed: CopilotResult): boolean => {
    if (analyzed.action !== "SET_APP_SETTINGS") return false;
    setTheme(analyzed.value);
    const THEME_LABEL: Record<typeof analyzed.value, string> = { dark: "sombre", light: "clair", system: "système" };
    toast.success(`Thème ${THEME_LABEL[analyzed.value]} activé`);
    setPhase("idle");
    setValue("");
    return true;
  };

  // Fresh top-level analysis (not a refinement) — checks the offline
  // exact-match cache first, only reaching the network on a miss.
  const runAnalysis = async (text: string) => {
    const requestId = ++requestIdRef.current;
    setError(null);
    originalPromptRef.current = text;

    const cached = activeCompanyId ? findCachedResult(activeCompanyId, text) : null;
    if (cached) {
      if (applyIfSettingsAction(cached)) return;
      originalDraftRef.current = cached;
      setDraft(cached);
      setWasFromCache(true);
      setPhase("result");
      setValue("");
      return;
    }

    setPhase("processing");
    setWasFromCache(false);
    try {
      const fewShot = activeCompanyId ? getFewShotExamples(activeCompanyId) : undefined;
      const analyzed = await analyzeCopilotText(text, context, fewShot);
      // Guards against a stale response landing after the user already
      // cleared/resubmitted the bar before this one came back.
      if (requestId !== requestIdRef.current) return;
      if (applyIfSettingsAction(analyzed)) return;
      originalDraftRef.current = analyzed;
      setDraft(analyzed);
      setPhase("result");
      setValue("");
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof CopilotApiError ? err.message : "L'analyse a échoué. Réessayez.");
      setPhase("error");
    }
  };

  // A correction typed while the review card is already showing
  // ("change amount to 120 000 DA", "add 20% acompte") — sent back through
  // the same /copilot/parse endpoint with the current draft embedded as
  // prior state, so the model returns a corrected version of the exact
  // same object rather than a fresh, unrelated guess. No API changes
  // needed: this is just a differently-shaped prompt. Never offline-cached
  // (the synthetic prompt text is not something a user would ever
  // literally retype) and does not touch originalPromptRef/originalDraftRef
  // — those still point at the very first natural-language input, which is
  // what confirm-time correction logging and the example cache key off.
  const runRefinement = async (instruction: string) => {
    if (!draft) return;
    const requestId = ++requestIdRef.current;
    setPhase("processing");
    setError(null);
    const prompt = `État actuel à corriger (JSON) : ${JSON.stringify(draft)}\nInstruction de correction : "${instruction}"\nApplique cette correction et renvoie l'objet JSON complet mis à jour, dans le même schéma exact.`;
    try {
      const fewShot = activeCompanyId ? getFewShotExamples(activeCompanyId) : undefined;
      const analyzed = await analyzeCopilotText(prompt, context, fewShot);
      if (requestId !== requestIdRef.current) return;
      setDraft(analyzed);
      setPhase("result");
      setValue("");
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof CopilotApiError ? err.message : "L'analyse a échoué. Réessayez.");
      setPhase("error");
    }
  };

  // Full reset — after a successful confirm, or an explicit cancel
  // (Escape / "Annuler"). Discards the in-memory draft entirely; nothing
  // was ever written to the database by anything up to this point.
  const cancel = () => {
    requestIdRef.current++;
    setPhase("idle");
    setDraft(null);
    setError(null);
    setValue("");
    setWasFromCache(false);
    originalDraftRef.current = null;
    originalPromptRef.current = "";
  };

  const handleConfirm = async () => {
    if (!draft || draft.action === "OUT_OF_SCOPE") {
      cancel();
      return;
    }
    try {
      if (draft.action === "CREATE_EXPENSE") {
        await createExpense.mutateAsync({
          expense_date: new Date().toISOString().slice(0, 10),
          category: draft.category,
          amount: draft.amount,
          description: draft.notes || undefined,
          payment_method: draft.paymentMethod,
          supplier_id: draft.supplierId ?? undefined,
        });
      } else if (draft.action === "CREATE_CLIENT") {
        await createClient.mutateAsync({
          name: draft.name,
          phone: draft.phone ?? undefined,
          email: draft.email ?? undefined,
          address: draft.address ?? undefined,
        });
      } else if (draft.action === "CREATE_PRODUCT") {
        // No cost/buy-price column exists on the real Product row — folded
        // into the description instead of silently dropped (see
        // CopilotProductResult's own doc comment).
        await createProduct.mutateAsync({
          code: `${draft.name.slice(0, 3).toUpperCase()}${Date.now().toString().slice(-5)}`,
          name: draft.name,
          description: draft.buyPrice != null ? `Prix d'achat : ${draft.buyPrice} DA` : undefined,
          unit_price: draft.sellPrice,
        });
      } else {
        // CREATE_INVOICE — orchestrated batch: create the client first if
        // `newClient` says this one doesn't exist yet (authoritative
        // signal from the API, see CopilotInvoiceResult's doc comment),
        // then the invoice itself, then a real payment record for any
        // acompte — a genuine receipt, not just a note on the invoice.
        let clientId = draft.clientId;
        if (draft.newClient) {
          const created = await createClient.mutateAsync({ name: draft.newClient.name });
          clientId = created.id;
        }
        if (!clientId) {
          // Defensive fallback — should be unreachable (either clientId or
          // newClient is always set for a validated CREATE_INVOICE), but a
          // required field on the mutation can't be left undefined.
          const created = await createClient.mutateAsync({ name: draft.clientName });
          clientId = created.id;
        }

        const invoice = await createInvoice.mutateAsync({
          client_id: clientId,
          invoice_date: new Date().toISOString().slice(0, 10),
          items: draft.items.map((line) => ({
            product_id: line.itemId ?? undefined,
            product_name: line.itemId ? undefined : line.description,
            product_description: line.itemId ? line.description : undefined,
            quantity: line.quantity,
            unit_price: line.unitPrice,
          })),
        });

        if (typeof draft.advancePayment === "number" && draft.advancePayment > 0) {
          await createPayment.mutateAsync({
            invoice_id: invoice.id,
            payment_date: new Date().toISOString().slice(0, 10),
            amount: draft.advancePayment,
            notes: "Acompte enregistré via Copilote IA",
          });
        }

        toast.success(`Facture ${invoice.invoice_number ?? ""} créée`, {
          action: { label: "Voir", onClick: () => navigate(`/invoices/${invoice.id}`) },
        });
      }

      // Local-first learning loop — logs which fields the user actually
      // changed (if any) and caches the final confirmed result under the
      // original prompt, so an exact repeat next time resolves for free.
      if (activeCompanyId && originalDraftRef.current) {
        recordDraftCorrections(activeCompanyId, originalPromptRef.current, originalDraftRef.current, draft);
        recordConfirmedExample(activeCompanyId, originalPromptRef.current, draft);
      }

      cancel();
      setJustSucceeded(true);
      setTimeout(() => setJustSucceeded(false), 600);
    } catch {
      // useCreateExpense/useCreateInvoice/useCreateClient each already
      // surface their own toast.error on failure (see their onError
      // handlers) — nothing to duplicate here, just keep the drawer open
      // (don't reset) so the user can retry Confirmer without retyping.
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = value.trim();
      if (phase === "result") {
        // Empty input + Enter while reviewing = confirm (the review
        // card's own button carries the same ↵ hint). Non-empty = a
        // refinement instruction.
        if (trimmed) void runRefinement(trimmed);
        else void handleConfirm();
      } else if ((phase === "idle" || phase === "error") && trimmed) {
        void runAnalysis(trimmed);
      }
    } else if (e.key === "Escape" && phase !== "idle") {
      cancel();
    }
  };

  const isProcessing = phase === "processing";
  const orbState = justSucceeded ? "success" : isProcessing ? "analyzing" : "idle";

  return (
    <div className="shrink-0 my-3 animate-fade-in-down">
      {/* No animated border — a static Scarlet stroke (the same
          --primary token as the "+ Facture" CTA) with a subtle static
          inner glow. The orb icon alone carries the "analyzing"
          animation now; nothing here moves. */}
      <div
        className="relative rounded-xl border border-primary bg-white dark:bg-neutral-900 px-4 py-2.5"
        style={{ boxShadow: "inset 0 0 14px hsl(var(--primary) / 0.12)" }}
      >
          {/* One unbroken horizontal row — icon+badge, input, ⌘K, and the
              button all on the same baseline, nothing ever hidden at a
              breakpoint (this card lives inside a sidebar-narrowed
              content column, not the full window, so viewport-width
              breakpoints like sm:/md: don't reliably apply here — items
              just shrink instead of hiding). ~52px tall (py-2.5 + content). */}
          <div className="flex flex-nowrap items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <SordiCopilotOrb size={32} state={orbState} />
              <span className="inline-flex items-center rounded-full bg-muted/50 px-2 py-1 text-xs font-medium text-foreground/80">
                Sordi Assistant
              </span>
            </div>

            <div className="h-5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700" />

            <div className="relative flex-1 min-w-0 h-5">
              {!value && (
                <AnimatedPlaceholder
                  text={phase === "result" ? "Corriger... (ex: change le montant à 120 000 DA)" : PLACEHOLDERS[placeholderIndex]}
                />
              )}
              <input
                ref={inputRef}
                type="text"
                dir="auto"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={isProcessing}
                aria-label="Copilote IA — décrivez une dépense ou une facture"
                className="absolute inset-0 w-full bg-transparent border-0 outline-none text-sm text-foreground disabled:opacity-60"
              />
            </div>

            <kbd className="shrink-0 inline-flex items-center gap-0.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono font-medium text-neutral-500 dark:text-neutral-400">
              ⌘K
            </kbd>

            <motion.button
              type="button"
              onClick={() => {
                const trimmed = value.trim();
                if (!trimmed) return;
                void (phase === "result" ? runRefinement(trimmed) : runAnalysis(trimmed));
              }}
              disabled={!value.trim() || isProcessing}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              // Same brand token as the Header's "+ Facture" CTA
              // (bg-primary/hover:bg-primary-hover) — a hardcoded hex here
              // previously drifted from that real brand red.
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground font-medium text-xs px-3.5 py-1.5 shadow-sm transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              Analyser
              <span className="text-[10px] font-mono opacity-90 bg-white/20 rounded px-1">↵</span>
            </motion.button>
          </div>

          {/* No laser shimmer here — the orb icon is now the only visible
              "analyzing" indicator on this bar, per an explicit request
              not to layer other animations (this sliding line, the
              review card's own progress bar) on top of it. */}
      </div>

      <AnimatePresence>
        {phase !== "idle" && (
          <div className="relative">
            {wasFromCache && phase === "result" && (
              <div className="absolute -top-1 right-2 z-10 -translate-y-full inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-medium px-2 py-0.5">
                <Zap className="w-2.5 h-2.5" />
                Résultat instantané (mémoire locale)
              </div>
            )}
            <AiCopilotResult
              phase={phase === "processing" ? "processing" : phase === "error" ? "error" : "result"}
              draft={draft}
              error={error}
              context={context}
              onChange={setDraft}
              onConfirm={() => void handleConfirm()}
              onCancel={cancel}
              isSaving={isSaving}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
