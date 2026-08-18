import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, X, Eye } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBlob: Blob | null;
  fileName?: string;
  pdfBase64?: string | null;
  title?: string;
}

export function PDFViewerModal({
  isOpen,
  onClose,
  pdfBlob,
  fileName = "document.pdf",
  pdfBase64,
  title = "Aperçu du Document PDF"
}: PDFViewerModalProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      setObjectUrl(url);
      return () => {
        URL.revokeObjectURL(url);
          toast.success("Impression lancée");
  };
    } else {
      setObjectUrl(null);
    }
  }, [pdfBlob]);

  const handlePrint = async () => {
    // If base64 is available and in Tauri runtime, we can also use open_pdf for system native printing
    if (pdfBase64) {
      try {
        await invoke("open_pdf", { pdfBase64, fileName });
        toast.success("Ouverture du document dans le lecteur système pour impression.");
        return;
      } catch (err) {
        console.warn("Tauri open_pdf command not available, falling back to browser print:", err);
      }
    }

    // Fallback: Webview window print via iframe
    const iframeEl = document.getElementById("pdf-preview-iframe") as HTMLIFrameElement | null;
    if (iframeEl && iframeEl.contentWindow) {
      try {
        iframeEl.contentWindow.focus();
        iframeEl.contentWindow.print();
      } catch (e) {
        console.error("Failed to print via iframe:", e);
        toast.error("Échec du lancement de l'impression.");
      }
    }
  };

  const handleSave = async () => {
    if (!pdfBlob && !pdfBase64) return;
    setIsSaving(true);

    try {
      // 1. Try Tauri backend save_pdf if pdfBase64 exists
      let b64 = pdfBase64;
      if (!b64 && pdfBlob) {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        b64 = btoa(binary);
      }

      if (b64) {
        try {
          const savedPath = await invoke<string>("save_pdf", {
            pdfBase64: b64,
            fileName: fileName
          });
          toast.success(`Fichier enregistré avec succès dans Téléchargements: ${savedPath}`);
          setIsSaving(false);
          return;
        } catch (tauriErr) {
          console.warn("Tauri save_pdf failed, using browser download fallback:", tauriErr);
        }
      }

      // 2. Fallback browser download
      if (objectUrl) {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Document téléchargé: ${fileName}`);
      }
    } catch (error) {
      console.error("Save PDF error:", error);
      toast.error("Erreur lors de l'enregistrement du PDF.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-900 border-slate-800 text-white">
        <DialogHeader className="p-4 bg-slate-950 border-b border-slate-800 flex flex-row items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">{title}</DialogTitle>
              <p className="text-xs text-slate-400">{fileName}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200 space-x-1.5"
            >
              <Printer className="w-4 h-4 text-blue-400" />
              <span>Imprimer</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              disabled={isSaving}
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-500 text-white space-x-1.5"
            >
              <Download className="w-4 h-4" />
              <span>{isSaving ? "Enregistrement..." : "Télécharger PDF"}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-400 hover:text-white hover:bg-slate-800 p-2"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-slate-900 relative">
          {objectUrl ? (
            <iframe
              id="pdf-preview-iframe"
              src={objectUrl}
              className="w-full h-full border-none bg-slate-900"
              title="PDF Preview"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              <p>Génération du vector PDF en cours...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
