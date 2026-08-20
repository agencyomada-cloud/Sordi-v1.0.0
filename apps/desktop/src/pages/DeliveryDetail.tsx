import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  RiArrowLeftLine as ArrowLeft, 
  RiDownloadLine as Download, 
  RiPrinterLine as Printer, 
  RiTruckLine as Truck, 
  RiEditLine as Edit, 
  RiLoader4Line as Loader2 
} from "@remixicon/react";
import { Button } from "@sordi/ui";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useDeliveryNote } from "@/hooks/useDeliveryNotes";
import { generateDeliveryNotePDF } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";
import { useLicenseStatus } from "@/hooks/useLicense";
import { DeliveryEditablePreview } from "@/components/delivery/DeliveryEditablePreview";
import { chunkItems } from "@/lib/paginationUtils";

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: deliveryNote, isLoading, error } = useDeliveryNote(id);
  const { data: settings } = useSettings();
  const { data: licenseStatus } = useLicenseStatus();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadPDF = async () => {
    if (!deliveryNote) return;

    try {
      setIsGenerating(true);
      const noteForPDF = {
        ...deliveryNote,
        items: deliveryNote.delivery_note_items || [],
        // Ensure client details are populated for PDF if needed, 
        // though generateDeliveryNotePDF usually expects a structure similar to what we have.
        // We might need to ensure 'clients' object is passed correctly if generateDeliveryNotePDF uses it.
        clients: deliveryNote.clients
      };
      await generateDeliveryNotePDF(noteForPDF as any, settings, true, undefined, licenseStatus?.state === "active");
      toast.success("PDF téléchargé avec succès");
      toast.success("PDF téléchargé");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setIsGenerating(false);
    }
  };

    const handlePrint = async () => {
    if (!noteForPDF as any) return;
    setIsGenerating(true);
    try {
      const pdfBase64 = await generateDeliveryNotePDF(noteForPDF as any, settings, false, undefined, licenseStatus?.state === "active");
      const { invoke } = await import("@tauri-apps/api/core");
      const fileName = `Impression-${ noteForPDF as any.delivery_number || "bon_livraison" }.pdf`;
      await invoke("open_pdf", { pdfBase64, fileName });
      toast.success("PDF ouvert pour impression");
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Erreur lors de l'impression");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "0,00 DA";
    return new Intl.NumberFormat("fr-DZ", {
      style: "decimal",
      minimumFractionDigits: 2,
    }).format(amount) + " DA";
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-8 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Chargement...</div>
          </main>
        </div>
      </div>
    );
  }

  if (!deliveryNote && !isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-8 flex items-center justify-center">
            <div className="text-center">
              <div className="text-muted-foreground mb-4">Bon de livraison non trouvé</div>
              {id && (
                <div className="text-sm text-muted-foreground mb-4">
                  ID: {id}
                </div>
              )}
              {error && (
                <div className="text-sm text-destructive mb-4">
                  Erreur: {error instanceof Error ? error.message : String(error)}
                </div>
              )}
              <Button onClick={() => navigate("/deliveries")}>
                Retour aux livraisons
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!deliveryNote) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 p-8 pt-4">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/deliveries")}
                className="rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-foreground tracking-tight">
                    Bon de livraison {deliveryNote.delivery_number}
                  </h1>
                </div>
                <p className="text-muted-foreground mt-1">
                  {deliveryNote.clients?.name} • {formatDate(deliveryNote.delivery_date)}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate(`/deliveries/${id}/edit`)}>
                <Edit className="w-4 h-4 mr-2" />
                Modifier
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimer
              </Button>
              <Button onClick={handleDownloadPDF} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {isGenerating ? "Téléchargement..." : "Télécharger PDF"}
              </Button>
            </div>
          </div>

          {/* Delivery Preview Section */}
          <div className="bg-card rounded-3xl border border-border/30 shadow-card overflow-hidden p-8">
            <div className="flex justify-center bg-muted rounded-lg p-6 overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              <div className="shadow-xl">
                <DeliveryEditablePreview
                  deliveryNote={{
                    ...deliveryNote,
                    items: deliveryNote.delivery_note_items || [],
                    // Ensure these fields from DB are passed if they exist in deliveryNote object
                    driver_name: deliveryNote.driver_name,
                    truck_plate: deliveryNote.truck_plate,
                    delivery_location: deliveryNote.delivery_location,
                    custom_title: deliveryNote.custom_title,
                    notes: deliveryNote.notes,
                    reserves: deliveryNote.reserves
                  }}
                  onDeliveryChange={() => { }}
                  readOnly={true}
                  clients={[deliveryNote.clients].filter(Boolean)}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

