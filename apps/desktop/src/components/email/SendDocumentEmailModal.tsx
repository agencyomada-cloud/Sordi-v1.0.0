import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Textarea,
  Badge,
  ToggleGroup,
  ToggleGroupItem,
} from "@sordi/ui";
import {
  RiMailSendLine as SendIcon,
  RiSparklingLine as SparkleIcon,
  RiRefreshLine as RefreshIcon,
  RiFilePdf2Line as PdfIcon,
  RiCheckLine as CheckIcon,
  RiLinksLine as ConnectIcon,
  RiLoader4Line as Loader2,
} from "@remixicon/react";
import { useIntegrations } from "@/hooks/useIntegrations";
import {
  draftDocumentSubject,
  draftDocumentEmailBody,
  EMAIL_TONE_LABELS,
  type DraftInput,
  type EmailTone,
} from "@/lib/emailDrafter";

interface SendDocumentEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftInput: DraftInput;
  recipientEmail?: string | null;
  fileName: string;
  /** Lazily generates the attachment — called once when the modal opens, so
   *  the (mildly expensive) PDF render only happens when the user actually
   *  intends to send, not on every page load. */
  getPdfBase64: () => Promise<string>;
}

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const estimateSizeLabel = (base64: string | null): string => {
  if (!base64) return "…";
  const bytes = Math.round((base64.length * 3) / 4);
  return bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`;
};

const TONE_ORDER: EmailTone[] = ["standard", "formal", "direct"];

export function SendDocumentEmailModal({
  open,
  onOpenChange,
  draftInput,
  recipientEmail,
  fileName,
  getPdfBase64,
}: SendDocumentEmailModalProps) {
  const navigate = useNavigate();
  const integrations = useIntegrations();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<EmailTone>("standard");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const smtpConfigured = integrations.gmail.connected;

  useEffect(() => {
    if (!open) return;

    setTo(recipientEmail || "");
    setSubject(draftDocumentSubject(draftInput));
    setBody(draftDocumentEmailBody(draftInput, "standard"));
    setTone("standard");
    setPdfBase64(null);

    setIsAttaching(true);
    getPdfBase64()
      .then(setPdfBase64)
      .catch((err) => {
        console.error("Failed to prepare document attachment:", err);
        toast.error("Erreur lors de la préparation du PDF à joindre.");
      })
      .finally(() => setIsAttaching(false));
    // Only re-run when the modal transitions open for a given document —
    // draftInput/getPdfBase64 are recreated every render by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const wordCount = useMemo(() => (body.trim() ? body.trim().split(/\s+/).length : 0), [body]);

  const handleRegenerate = () => {
    setBody(draftDocumentEmailBody(draftInput, tone));
  };

  const handleToneChange = (nextTone: string) => {
    if (!nextTone) return;
    const t = nextTone as EmailTone;
    setTone(t);
    setBody(draftDocumentEmailBody(draftInput, t));
  };

  const handleSend = async () => {
    if (!to.trim() || !isValidEmail(to.trim())) {
      toast.error("Veuillez saisir une adresse email de destinataire valide.");
      return;
    }
    if (!subject.trim()) {
      toast.error("L'objet du message est requis.");
      return;
    }
    if (!pdfBase64) {
      toast.error("Le document n'est pas encore prêt, veuillez patienter.");
      return;
    }

    setIsSending(true);
    try {
      if (smtpConfigured) {
        await invoke("send_email_with_pdf", {
          to: to.trim(),
          subject,
          body,
          pdfBase64,
          fileName,
        });
        toast.success("Email envoyé avec succès", { description: `${fileName} joint à destination de ${to.trim()}` });
        onOpenChange(false);
      } else {
        // Zero-setup fallback: hand off to the OS's default mail client via
        // mailto:, and drop the PDF into Downloads so it's one drag-and-drop
        // away — mailto: itself has no way to carry an attachment.
        const params = new URLSearchParams({ subject, body });
        await openUrl(`mailto:${encodeURIComponent(to.trim())}?${params.toString()}`);
        await invoke("save_pdf", { pdfBase64, fileName });
        toast.success("Client mail ouvert", {
          description: `${fileName} a été téléchargé — pensez à le joindre manuellement à l'email.`,
        });
        onOpenChange(false);
      }
    } catch (err) {
      console.error("Failed to send document email:", err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Échec de l'envoi de l'email", { description: message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden p-0">
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/[0.03] to-transparent px-6 pt-6 pb-5 border-b border-border/40">
          <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary shrink-0">
                <SparkleIcon className="w-4 h-4" />
              </span>
              Rédacteur Intelligent &amp; Envoi Email
            </DialogTitle>
            <DialogDescription>Générez et personnalisez votre message avant l'envoi au client.</DialogDescription>
          </DialogHeader>

          {smtpConfigured && (
            <div className="relative mt-3">
              <div className="inline-flex items-center gap-2 text-xs rounded-full border border-border/50 bg-card/80 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-muted-foreground">Expéditeur :</span>
                <span className="font-medium text-foreground">{integrations.gmail.senderEmail}</span>
                <span className="text-muted-foreground">(Connecté)</span>
              </div>
            </div>
          )}
        </div>

        {!smtpConfigured && (
          <div className="mx-6 mt-5 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <SparkleIcon className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Connexion requise pour l'envoi direct</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Liez votre compte Gmail ou SMTP pour envoyer ce document en un clic sans quitter Sordi. En attendant, l'envoi
                ci-dessous ouvrira votre client mail par défaut.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-3 gap-1.5"
                onClick={() => {
                  onOpenChange(false);
                  navigate("/integrations");
                }}
              >
                <ConnectIcon className="w-3.5 h-3.5" />
                Connecter mon compte Gmail
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="send-email-to">Destinataire</Label>
              <Input
                id="send-email-to"
                type="email"
                placeholder="client@entreprise.dz"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="send-email-subject">Objet</Label>
              <Input id="send-email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-primary hover:text-primary" onClick={handleRegenerate}>
                <SparkleIcon className="w-3.5 h-3.5" />
                Régénérer le brouillon IA
              </Button>
              <ToggleGroup
                type="single"
                value={tone}
                onValueChange={handleToneChange}
                className="justify-start rounded-full border border-border/50 bg-secondary/30 p-0.5"
              >
                {TONE_ORDER.map((t) => (
                  <ToggleGroupItem
                    key={t}
                    value={t}
                    size="sm"
                    className="h-6 rounded-full px-2.5 text-[11px] font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm"
                  >
                    {EMAIL_TONE_LABELS[t]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <Label htmlFor="send-email-body" className="sr-only">
              Corps du message
            </Label>
            <Textarea
              id="send-email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="text-sm leading-relaxed resize-y bg-secondary/20 border-border/60 transition-all focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40"
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {wordCount} mot{wordCount !== 1 ? "s" : ""} · {body.length} caractères
            </p>
          </div>

          <div>
            <Badge
              variant="outline"
              className="gap-2 font-normal py-1.5 pl-2 pr-3 border-primary/20 bg-primary/5"
            >
              {isAttaching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PdfIcon className="w-3.5 h-3.5 text-primary" />}
              {fileName}
              {!isAttaching && pdfBase64 && (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckIcon className="w-3 h-3" />
                  Généré automatiquement
                </span>
              )}
              <span className="text-muted-foreground">· {isAttaching ? "préparation…" : estimateSizeLabel(pdfBase64)}</span>
            </Badge>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Annuler
          </Button>
          <Button type="button" onClick={handleSend} disabled={isSending || isAttaching} className="gap-2">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
            {isSending ? "Envoi…" : "Envoyer l'email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
