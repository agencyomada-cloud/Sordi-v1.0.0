import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  RiSendPlaneFill as Send,
  RiLoader4Line as Loader2,
  RiSettings3Line as SettingsIcon,
  RiAddLine as Plus,
  RiDeleteBinLine as Trash2,
  RiMessage3Line as MessageSquare,
} from "@remixicon/react";
import { SordiLogo } from "@/components/brand/SordiLogo";
import { Globe, Cpu } from "lucide-react";
import {
  Badge,
  Button,
  Input,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@sordi/ui";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useLicenseGate } from "@/hooks/useLicenseGate";
import { LicenseBlockedModal } from "@/components/licensing/LicenseBlockedModal";
import {
  useSordiIqSessions,
  useSordiIqSession,
  useCreateSordiIqSession,
  useSaveSordiIqSessionMessages,
  useDeleteSordiIqSession,
  type SordiIqStoredMessage,
} from "@/hooks/useSordiIqSessions";
import { useSordiIqModels } from "@/hooks/useSordiIqModels";
import { useClients, useCreateClient } from "@/hooks/useClients";
import { useCreateSupplier } from "@/hooks/useSuppliers";
import { useCreateExpense } from "@/hooks/useExpenses";
import { useCreateInvoice } from "@/hooks/useInvoices";
import { resolveEntityMatch } from "@/components/dashboard/ai-copilot/resolveEntityMatch";
import { renderSordiIqMarkdown } from "@/lib/sordiIqMarkdown";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ToolDraftCard } from "@/components/sordi-iq/ToolDraftCard";
import { ToolDraftsDrawer } from "@/components/sordi-iq/ToolDraftsDrawer";
import { buildDraftFromToolCall, type ToolDraft } from "@/components/sordi-iq/types";

/** Mirrors the Rust side's SordiIqToolCall (sordi_iq.rs) — only present on
 *  an assistant reply that stopped to request a WRITE action (create_*);
 *  read-only tools are resolved entirely server-side and never reach here. */
interface SordiIqToolCall {
  id: string;
  function: { name: string; arguments: string };
}

// A message that carries pending tool drafts is NOT auto-executed and NOT
// persisted until every draft on it resolves (saved or error) — see
// sendMessage's tool_calls branch and resolveDraftMessageIfDone below. This
// is strictly a local, in-memory extension of the persisted shape; drafts
// are stripped before anything is ever saved via useSaveSordiIqSessionMessages.
type ChatMessage = SordiIqStoredMessage & { drafts?: ToolDraft[] };

// Shown only before an API key is entered (nothing to fetch yet) or while
// the live OpenRouter catalog is loading — the dynamic list from
// useSordiIqModels is the primary source once available, per the "no more
// guessed slugs" requirement.
const FALLBACK_MODEL_OPTIONS = [
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "openai/gpt-4o", label: "GPT-4o" },
  { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
];
const CUSTOM_MODEL_VALUE = "__custom__";

const QUICK_PROMPTS = [
  "Vue d'ensemble de l'entreprise",
  "Quelles sont les factures en retard ?",
  "Qui sont mes meilleurs clients ?",
  "Résume mes dépenses récentes",
];

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

/**
 * Sordi IQ — the in-app AI assistant. Gradient-accented chat page with a
 * left history sidebar (past sessions, "+ Nouvelle conversation"). Fully
 * theme-responsive: every surface/text/border below is a shadcn semantic
 * token (bg-background/text-foreground/bg-muted/border-border/etc.), not a
 * hardcoded dark palette — only the Scarlet Red gradient buttons and AI
 * avatar glows stay literal, per the design system's brand accent. Calls
 * the sordi_iq_chat Tauri command for replies and the sordi_iq_sessions
 * CRUD commands (src-tauri/src/sordi_iq.rs) for persistence — every
 * session survives an app restart, same as every other piece of Sordi's
 * data.
 */
export default function SordiIQPage() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const { data: sessions, isLoading: sessionsLoading } = useSordiIqSessions();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const { data: activeSession, isFetching: sessionLoading } = useSordiIqSession(activeSessionId);
  const createSession = useCreateSordiIqSession();
  const saveMessages = useSaveSordiIqSessionMessages();
  const deleteSession = useDeleteSordiIqSession();

  // Tool execution — the exact same mutation hooks AiCopilotBar.tsx (the
  // now-removed Dashboard omnibar) used, so a create_client/create_invoice/
  // etc. tool call runs through the one real, validated write path instead
  // of a second parallel implementation.
  const { data: existingClients } = useClients();
  const createClient = useCreateClient();
  const createSupplier = useCreateSupplier();
  const createExpense = useCreateExpense();
  const createInvoice = useCreateInvoice();
  const { requireActive, blockedOpen, setBlockedOpen } = useLicenseGate();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [draftApiKey, setDraftApiKey] = useState("");
  const [draftModel, setDraftModel] = useState(FALLBACK_MODEL_OPTIONS[0].value);
  const [draftCustomModel, setDraftCustomModel] = useState("");
  // AI runtime mode badge — "cloud" whenever Sordi IQ successfully reaches
  // OpenRouter, "local" otherwise. NOTE: there is no actual local AI engine
  // in this app — "local" is an honest re-labeling of "not currently
  // reaching the cloud API" (no network, or the last sordi_iq_chat call
  // failed), not a real on-device inference fallback. Flips back to
  // "cloud" on the next successful reply (see sendMessage's try/catch
  // below).
  const [aiRuntimeMode, setAiRuntimeMode] = useState<"cloud" | "local">(
    typeof navigator !== "undefined" && !navigator.onLine ? "local" : "cloud"
  );
  // Index into `messages` of the draft batch currently open in the full
  // editor drawer — null when closed.
  const [drawerMsgIndex, setDrawerMsgIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const goOnline = () => setAiRuntimeMode("cloud");
    const goOffline = () => setAiRuntimeMode("local");
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const { models: fetchedModels, isLoading: modelsLoading, error: modelsError, isEligible: modelsEligible } = useSordiIqModels(draftApiKey);

  const apiKey = settings?.sordi_iq_api_key || "";
  const model = settings?.sordi_iq_model || FALLBACK_MODEL_OPTIONS[0].value;
  const hasApiKey = apiKey.trim().length > 0;

  // Live catalog once fetched, otherwise the small curated fallback (before
  // a key is entered, or while loading) — plus, if the currently-selected
  // model isn't in whichever list is showing (a saved slug the catalog
  // doesn't happen to include), a synthetic entry for it so the dropdown
  // never silently blanks out a valid, already-working selection.
  const baseModelOptions = fetchedModels.length > 0
    ? fetchedModels.map((m) => ({ value: m.id, label: m.name }))
    : FALLBACK_MODEL_OPTIONS;
  const modelOptions = baseModelOptions.some((m) => m.value === draftModel) || draftModel === CUSTOM_MODEL_VALUE
    ? baseModelOptions
    : [{ value: draftModel, label: draftModel }, ...baseModelOptions];

  // Auto-select the most recent session on first load — never on later
  // refetches (that would yank the user back to session 1 mid-conversation
  // with someone else's session list update).
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (!hasAutoSelected.current && sessions && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
      hasAutoSelected.current = true;
    }
  }, [sessions]);

  // Load the selected session's messages into local state whenever it
  // changes underneath us (session switch, or the fetch resolving).
  useEffect(() => {
    if (activeSession) setMessages(activeSession.messages);
  }, [activeSession]);

  useEffect(() => {
    setDraftApiKey(apiKey);
    // The saved model id is always selectable directly now — modelOptions
    // above injects a synthetic entry for it if the live/fallback list
    // doesn't happen to include it, so there's no need to detour through
    // "Personnalisé" just because a slug isn't in whichever list loaded.
    setDraftModel(model);
    setDraftCustomModel("");
  }, [apiKey, model]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  const handleSaveConfig = () => {
    const resolvedModel = draftModel === CUSTOM_MODEL_VALUE ? draftCustomModel.trim() : draftModel;
    if (!resolvedModel) {
      toast.error("Indiquez un modèle (ex: anthropic/claude-3.5-sonnet)");
      return;
    }
    updateSettings.mutate(
      { sordi_iq_api_key: draftApiKey.trim(), sordi_iq_model: resolvedModel },
      {
        onSuccess: () => {
          toast.success("Configuration Sordi IQ enregistrée");
          setConfigOpen(false);
        },
        onError: () => toast.error("Échec de l'enregistrement de la configuration"),
      }
    );
  };

  const handleNewChat = () => {
    createSession.mutate(undefined, {
      onSuccess: (session) => {
        setActiveSessionId(session.id);
        setMessages([]);
      },
      onError: () => toast.error("Impossible de créer une nouvelle conversation"),
    });
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSession.mutate(id, {
      onSuccess: () => {
        if (activeSessionId === id) {
          setActiveSessionId(null);
          setMessages([]);
          hasAutoSelected.current = false;
        }
      },
      onError: () => toast.error("Échec de la suppression"),
    });
  };

  /**
   * Runs ONE approved draft against the real mutation hooks — called only
   * from handleConfirmDraft/handleConfirmAllDrafts below, i.e. only after
   * the user has clicked [Confirmer] on that specific draft. Reads
   * `draft.fields` (the model's extraction, possibly hand-edited by the
   * user first) rather than re-parsing the original tool_call JSON, so an
   * edit made in the card/drawer is exactly what gets written. Returns the
   * confirmation bubble text — never throws.
   */
  const executeToolDraft = async (draft: ToolDraft): Promise<string> => {
    try {
      switch (draft.toolName) {
        case "create_client": {
          const f = draft.fields as { name: string; phone: string };
          const client = await createClient.mutateAsync({ name: f.name || "Client", phone: f.phone || undefined });
          return `✅ Validé et enregistré : Client "${client.name}" ajouté avec succès.`;
        }
        case "create_supplier": {
          const f = draft.fields as { name: string; phone: string };
          const supplier = await createSupplier.mutateAsync({ name: f.name || "Fournisseur", phone: f.phone || undefined });
          return `✅ Validé et enregistré : Fournisseur "${supplier.name}" ajouté avec succès.`;
        }
        case "create_expense": {
          const f = draft.fields as { category: string; amount: number; description: string; date: string };
          const expense = await createExpense.mutateAsync({
            expense_date: f.date || new Date().toISOString().split("T")[0],
            category: f.category || "Autre",
            amount: f.amount ?? 0,
            description: f.description || undefined,
            payment_method: "cash",
          });
          return `✅ Validé et enregistré : Dépense de ${expense.amount.toLocaleString("fr-FR")} DZD enregistrée avec succès.`;
        }
        case "create_invoice": {
          // Same by-name resolution as AiCopilotBar.tsx used to: match an
          // existing client, only creating a new one if genuinely no match
          // exists (an invoice needs a real client_id either way).
          const f = draft.fields as { client_name: string; description: string; amount: number; date: string };
          const clientName = f.client_name || "Client";
          let clientId = resolveEntityMatch(clientName, existingClients ?? [])?.id;
          if (!clientId) {
            const created = await createClient.mutateAsync({ name: clientName });
            clientId = created.id;
          }
          const invoice = await createInvoice.mutateAsync({
            client_id: clientId,
            invoice_date: f.date || new Date().toISOString().split("T")[0],
            items: [{ product_name: f.description || clientName, quantity: 1, unit_price: f.amount ?? 0 }],
          });
          return `✅ Validé et enregistré : Facture ${invoice.invoice_number ?? ""} créée pour "${clientName}".`;
        }
        default:
          return `❌ Outil inconnu : "${draft.toolName}".`;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Sordi IQ tool execution failed (${draft.toolName}):`, error);
      return `❌ Échec de l'action "${draft.toolName}" : ${message}`;
    }
  };

  /** Edits one field of one pending draft — from either the compact card or
   *  the full drawer, both call this. Never touches "saving"/"saved"/
   *  "error" drafts (their inputs are disabled). */
  const handleDraftFieldChange = (msgIndex: number, draftId: string, field: string, value: string | number) => {
    setMessages((prev) => {
      const next = [...prev];
      const msg = next[msgIndex];
      if (!msg?.drafts) return prev;
      next[msgIndex] = {
        ...msg,
        drafts: msg.drafts.map((d) => (d.id === draftId ? { ...d, fields: { ...d.fields, [field]: value } } : d)),
      };
      return next;
    });
  };

  /**
   * Runs the actual database mutation for ONE approved draft — the only
   * path that ever calls executeToolDraft. Once every draft on this
   * message has resolved (saved or error), the message is collapsed into
   * a plain persisted text summary and saved via useSaveSordiIqSessionMessages
   * — until then, the whole turn stays unpersisted local state, so an
   * unconfirmed draft never survives a reload in limbo.
   */
  const handleConfirmDraft = async (msgIndex: number, draftId: string) => {
    const draft = messages[msgIndex]?.drafts?.find((d) => d.id === draftId);
    if (!draft || draft.status !== "pending") return;

    // License gate — checked BEFORE attempting the mutation (same
    // proactive pattern as NewClient.tsx/NewSupplierDialog.tsx/
    // Expenses.tsx), not just left to fail server-side and surface as a
    // generic error bubble. The draft stays "pending" so the user can
    // retry immediately after activating.
    if (!requireActive()) return;

    setMessages((prev) => {
      const next = [...prev];
      const msg = next[msgIndex];
      if (!msg?.drafts) return prev;
      next[msgIndex] = { ...msg, drafts: msg.drafts.map((d) => (d.id === draftId ? { ...d, status: "saving" } : d)) };
      return next;
    });

    const resultMessage = await executeToolDraft(draft);
    const status: ToolDraft["status"] = resultMessage.startsWith("✅") ? "saved" : "error";

    setMessages((prev) => {
      const next = [...prev];
      const msg = next[msgIndex];
      if (!msg?.drafts) return prev;
      const updatedDrafts = msg.drafts.map((d) => (d.id === draftId ? { ...d, status, resultMessage } : d));
      const allResolved = updatedDrafts.every((d) => d.status === "saved" || d.status === "error");
      if (allResolved && activeSessionId) {
        const summary = updatedDrafts.map((d) => d.resultMessage).filter(Boolean).join("\n\n");
        next[msgIndex] = { role: "assistant", content: summary };
        // Persist the full conversation — strips the transient `drafts`
        // field from every message, not just this one, via the {role,
        // content} projection below.
        saveMessages.mutate({ id: activeSessionId, messages: next.map(({ role, content }) => ({ role, content })) });
      } else {
        next[msgIndex] = { ...msg, drafts: updatedDrafts };
      }
      return next;
    });
  };

  /** [Confirmer tout] in the drawer — runs every still-pending draft on
   *  this message sequentially, so a partial failure leaves predictable
   *  state instead of a scramble of concurrent mutations. */
  const handleConfirmAllDrafts = async (msgIndex: number) => {
    const pendingIds = (messages[msgIndex]?.drafts ?? []).filter((d) => d.status === "pending").map((d) => d.id);
    for (const id of pendingIds) {
      await handleConfirmDraft(msgIndex, id);
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    // No hard block on a missing API key — sordi_iq_chat (sordi_iq.rs)
    // automatically falls back to a local, keyword-matched engine over the
    // real SQLite data when apiKey is empty (or the request itself fails),
    // so the user can keep chatting instead of being stopped cold. The
    // empty-state banner still nudges toward configuring a key for full
    // capability, but typing is never blocked on it.

    // Lazily create a session on the very first message of a fresh visit —
    // the sidebar's "+" button already creates one eagerly, but a user
    // typing straight into an empty new-page state shouldn't be blocked on
    // clicking it first.
    let sessionId = activeSessionId;
    if (!sessionId) {
      try {
        const session = await createSession.mutateAsync();
        sessionId = session.id;
        setActiveSessionId(sessionId);
      } catch {
        toast.error("Impossible de créer une conversation");
        return;
      }
    }

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const reply = await invoke<{ role: string; content: string | null; tool_calls?: SordiIqToolCall[] | null }>("sordi_iq_chat", {
        apiKey,
        model,
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
      });

      if (reply.tool_calls && reply.tool_calls.length > 0) {
        // A write action was requested — intercepted here, never executed
        // blindly and never rendered as raw JSON. Every tool_call becomes a
        // pending, editable draft card instead (human-in-the-loop review —
        // see ToolDraftCard/ToolDraftsDrawer); nothing is written to the
        // database until the user clicks [Confirmer] on it. This turn is
        // deliberately NOT persisted yet — see handleConfirmDraft, which
        // only saves once every draft on this message has resolved.
        const drafts = reply.tool_calls
          .map((call) => buildDraftFromToolCall(call.id, call.function.name, call.function.arguments))
          .filter((d): d is ToolDraft => d !== null);
        const draftMessage: ChatMessage = { role: "assistant", content: "", drafts };
        setMessages([...nextMessages, draftMessage]);
        setAiRuntimeMode("cloud");
      } else {
        const finalMessages: ChatMessage[] = [...nextMessages, { role: "assistant", content: reply.content || "(Réponse vide)" }];
        setMessages(finalMessages);
        saveMessages.mutate({ id: sessionId, messages: finalMessages });
        setAiRuntimeMode("cloud");
      }
    } catch (error) {
      // Logged verbatim for diagnostics — a Tauri invoke rejection is often
      // a plain string (the exact Result::Err text from the Rust command),
      // not an Error instance, so console.error(error) alone can print
      // "[object Object]" or swallow useful detail depending on the shape.
      // This is the ONLY place the raw error is ever surfaced — the chat
      // bubble itself always gets the clean fallback below, never this.
      console.error("Sordi IQ request failed. Raw error:", error);
      try {
        console.error("Sordi IQ request failed. JSON:", JSON.stringify(error, null, 2));
      } catch {
        // error isn't JSON-serializable (e.g. contains a circular ref) —
        // the raw log above already has it, nothing more to do here.
      }
      setAiRuntimeMode("local");
      const fallback = "⚠️ Erreur de connexion ou crédit insuffisant. Sordi IQ fonctionne actuellement en mode hors ligne.";
      toast.error("Sordi IQ hors ligne");
      const finalMessages: ChatMessage[] = [...nextMessages, { role: "assistant", content: fallback }];
      setMessages(finalMessages);
      saveMessages.mutate({ id: sessionId, messages: finalMessages });
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  return (
    <main className="flex-1 flex h-full min-h-0 bg-background text-foreground relative overflow-hidden">
      {/* Ambient AI-console glows — strictly clipped to this page's own box
          via overflow-hidden on the main container above, never bleeding
          onto the rest of the app shell. */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-[28rem] h-[28rem] rounded-full bg-rose-500/5 dark:bg-rose-500/20 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-48 -right-24 w-[32rem] h-[32rem] rounded-full bg-red-600/5 dark:bg-red-600/25 blur-[150px]" />
      <div className="pointer-events-none absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-rose-500/[0.03] dark:bg-rose-500/10 blur-[100px]" />

      {/* Session history sidebar */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col relative z-10 bg-muted/30">
        <div className="h-14 shrink-0 flex items-center px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <SordiLogo iconOnly className="w-6 h-6 rounded-md shrink-0" />
            <span className="font-semibold text-sm text-foreground">Sordi IQ</span>
            {/* True AI runtime mode, not a superficial connection dot: "cloud"
                only while a real API key is configured AND the last request
                actually reached OpenRouter — either condition failing shows
                "local" (see aiRuntimeMode's own note: there's no real local
                engine, this is an honest label for "not on the cloud API"). */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 px-1.5 text-[10px] font-medium border-transparent",
                    hasApiKey && aiRuntimeMode === "cloud" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                  )}
                >
                  {hasApiKey && aiRuntimeMode === "cloud" ? (
                    <>
                      <Globe className="w-3.5 h-3.5 mr-1.5" />
                      API Cloud
                    </>
                  ) : (
                    <>
                      <Cpu className="w-3.5 h-3.5 mr-1.5" />
                      AI Local
                    </>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {!hasApiKey
                  ? "Aucune clé API OpenRouter configurée"
                  : aiRuntimeMode === "cloud"
                  ? "Connecté à OpenRouter"
                  : "Dernière requête OpenRouter échouée ou hors ligne"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-1.5 h-8 text-xs bg-muted/50 border-border text-foreground/80 hover:text-foreground hover:bg-muted hover:border-rose-400/40"
            onClick={handleNewChat}
            disabled={createSession.isPending}
          >
            {createSession.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Nouvelle conversation
          </Button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 space-y-0.5">
          {sessionsLoading ? (
            <div className="px-2 py-4 text-xs text-muted-foreground text-center">Chargement...</div>
          ) : !sessions || sessions.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <MessageSquare className="w-5 h-5 text-muted-foreground/60 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Aucune conversation</p>
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setActiveSessionId(session.id)}
                className={cn(
                  "w-full text-left px-2.5 py-2 rounded-lg group flex items-start gap-2 transition-colors",
                  activeSessionId === session.id ? "bg-muted" : "hover:bg-muted/50"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-medium truncate", activeSessionId === session.id ? "text-foreground" : "text-foreground/70")}>
                    {session.title}
                  </p>
                  {session.last_message_preview && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{session.last_message_preview}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">{formatRelativeTime(session.updated_at)}</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      role="button"
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 shrink-0 w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right">Supprimer</TooltipContent>
                </Tooltip>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex-1 min-w-0 flex flex-col relative">
        {/* Header */}
        <header className="shrink-0 h-14 border-b border-border flex items-center justify-between px-6 relative z-10 backdrop-blur-sm">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Assistant IA</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => setConfigOpen(true)}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            Configurer
          </Button>
        </header>

        {/* Message list */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto relative z-10 px-6 py-6">
          {sessionLoading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Chargement de la conversation...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto gap-6">
              <SordiLogo iconOnly className="w-14 h-14 rounded-2xl shadow-[0_0_32px_rgba(255,41,73,0.35)]" />
              <div>
                <h1 className="text-lg font-semibold text-foreground mb-1.5">Bonjour, je suis Sordi IQ</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Posez-moi une question sur votre chiffre d'affaires, vos factures en retard, vos clients ou vos dépenses — je m'appuie sur vos données réelles.
                </p>
              </div>
              {!hasApiKey && (
                <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  Aucune clé API configurée — Sordi IQ répond en Mode Local (Sans API) avec vos données réelles. Cliquez sur « Configurer » pour activer les réponses complètes.
                </div>
              )}
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/40 text-foreground/70 hover:text-foreground hover:border-rose-400/40 hover:bg-muted transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              {messages.map((msg, idx) => {
                // A pending tool-call batch — rendered as editable draft
                // cards (human-in-the-loop review), never as a text bubble.
                if (msg.role === "assistant" && msg.drafts && msg.drafts.length > 0) {
                  return (
                    <div key={idx} className="flex gap-3">
                      <SordiLogo iconOnly className="w-7 h-7 rounded-lg shrink-0 mt-0.5 shadow-[0_0_12px_rgba(255,41,73,0.35)]" />
                      <div className="flex-1 max-w-[85%] space-y-2">
                        {msg.drafts.map((draft) => (
                          <ToolDraftCard
                            key={draft.id}
                            draft={draft}
                            onFieldChange={(field, value) => handleDraftFieldChange(idx, draft.id, field, value)}
                            onConfirm={() => void handleConfirmDraft(idx, draft.id)}
                            onOpenEditor={() => setDrawerMsgIndex(idx)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }

                // A tool-execution confirmation/failure bubble — styled
                // distinctly (green/red tint) instead of the neutral
                // assistant bubble, so a real database action taken on the
                // user's behalf stands out from a plain chat reply.
                const isToolSuccess = msg.role === "assistant" && msg.content.startsWith("✅");
                const isToolFailure = msg.role === "assistant" && msg.content.startsWith("❌");
                return (
                  <div key={idx} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
                    {msg.role === "assistant" ? (
                      <SordiLogo iconOnly className="w-7 h-7 rounded-lg shrink-0 mt-0.5 shadow-[0_0_12px_rgba(255,41,73,0.35)]" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-semibold text-foreground">Moi</span>
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 max-w-[80%]",
                        isToolSuccess
                          ? "bg-emerald-500/10 border border-emerald-500/30 rounded-tl-sm"
                          : isToolFailure
                          ? "bg-destructive/10 border border-destructive/30 rounded-tl-sm"
                          : msg.role === "assistant"
                          ? "bg-muted/50 border border-border rounded-tl-sm"
                          : "bg-gradient-to-br from-rose-500/20 to-red-600/20 border border-border rounded-tr-sm"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        isToolSuccess || isToolFailure ? (
                          <p className={cn("text-sm font-medium", isToolSuccess ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
                            {msg.content}
                          </p>
                        ) : (
                          <div className="text-sm">{renderSordiIqMarkdown(msg.content)}</div>
                        )
                      ) : (
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {isSending && (
                <div className="flex gap-3">
                  {/* animate-spin only while actually loading/fetching — the
                      same avatar in the message list above never spins. */}
                  <SordiLogo iconOnly className="w-7 h-7 rounded-lg shrink-0 shadow-[0_0_12px_rgba(255,41,73,0.35)] animate-spin" />
                  <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-muted/50 border border-border flex items-center gap-2 text-muted-foreground text-sm">
                    Analyse en cours...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border px-6 py-4 relative z-10">
          {messages.length > 0 && (
            <div className="max-w-3xl mx-auto flex flex-wrap gap-2 mb-3">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  disabled={isSending}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:border-rose-400/40 transition-colors disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-end gap-2">
            {/* Focus ring uses the same Sordi-brand Scarlet accent as everywhere
                else on this page — a "glowing accent line" reading on the
                input itself via ring + border-color transition on focus. */}
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder="Posez une question sur votre activité..."
              rows={1}
              className="min-h-[42px] max-h-32 resize-none bg-muted/40 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:border-rose-400/50 transition-all"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isSending || !input.trim()}
              className="h-[42px] w-[42px] shrink-0 bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 border-0"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </div>

      {/* API key / model configuration */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurer Sordi IQ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Clé API OpenRouter</label>
              <Input
                type="password"
                value={draftApiKey}
                onChange={(e) => setDraftApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">
                Stockée localement sur cet appareil, jamais transmise ailleurs qu'à OpenRouter lors de vos échanges avec Sordi IQ.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Modèle</label>
                {modelsLoading && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Récupération des modèles...
                  </span>
                )}
              </div>
              <Select value={draftModel} onValueChange={setDraftModel} disabled={modelsLoading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_MODEL_VALUE}>Personnalisé (slug OpenRouter)...</SelectItem>
                </SelectContent>
              </Select>
              {draftModel === CUSTOM_MODEL_VALUE && (
                <Input
                  value={draftCustomModel}
                  onChange={(e) => setDraftCustomModel(e.target.value)}
                  placeholder="ex: anthropic/claude-3.5-sonnet"
                  autoComplete="off"
                />
              )}
              {modelsError ? (
                <p className="text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2 py-1.5">
                  {modelsError}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  {fetchedModels.length > 0
                    ? `${fetchedModels.length} modèles disponibles sur votre compte OpenRouter.`
                    : modelsEligible
                    ? "Liste en attente de la clé API ci-dessus."
                    : "Entrez une clé API pour charger la liste réelle des modèles."}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfigOpen(false)}>Annuler</Button>
            <Button type="button" onClick={handleSaveConfig} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full draft editor — opened via a card's [Modifier] button; shows
          every pending draft from that same turn (the multi-item batch
          review surface). */}
      <ToolDraftsDrawer
        open={drawerMsgIndex !== null}
        onOpenChange={(open) => !open && setDrawerMsgIndex(null)}
        drafts={drawerMsgIndex !== null ? messages[drawerMsgIndex]?.drafts ?? [] : []}
        onFieldChange={(draftId, field, value) => drawerMsgIndex !== null && handleDraftFieldChange(drawerMsgIndex, draftId, field, value)}
        onConfirm={(draftId) => drawerMsgIndex !== null && void handleConfirmDraft(drawerMsgIndex, draftId)}
        onConfirmAll={() => drawerMsgIndex !== null && void handleConfirmAllDrafts(drawerMsgIndex)}
      />

      <LicenseBlockedModal open={blockedOpen} onOpenChange={setBlockedOpen} />
    </main>
  );
}
