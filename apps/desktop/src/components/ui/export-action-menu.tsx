import {
  RiDownloadLine as DownloadIcon,
  RiFileExcel2Line as CsvIcon,
  RiFilePdf2Line as PdfIcon,
  RiLoader4Line as Loader2,
} from "@remixicon/react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@sordi/ui";

interface ExportActionMenuProps {
  onExportCSV: () => void;
  onExportPDF: () => void;
  isExportingPDF?: boolean;
  csvLabel?: string;
  pdfLabel?: string;
  align?: "start" | "end";
}

/**
 * Single "Exporter" trigger replacing the two separate CSV/PDF buttons the
 * reports pages used to show side by side — same underlying export
 * functions (onExportCSV/onExportPDF), just one compact desktop control
 * instead of two competing for header space.
 */
export function ExportActionMenu({
  onExportCSV,
  onExportPDF,
  isExportingPDF = false,
  csvLabel = "Exporter CSV",
  pdfLabel = "Exporter PDF",
  align = "end",
}: ExportActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExportingPDF} className="h-[30px] px-2.5 text-xs gap-1.5 rounded-md">
          {isExportingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadIcon className="w-3.5 h-3.5" />}
          Exporter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuItem onClick={onExportCSV}>
          <CsvIcon className="w-3.5 h-3.5 mr-2" />
          {csvLabel}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportPDF} disabled={isExportingPDF}>
          <PdfIcon className="w-3.5 h-3.5 mr-2" />
          {isExportingPDF ? "Génération..." : pdfLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
