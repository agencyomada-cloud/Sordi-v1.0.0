import os
import re

files_to_patch = [
    r"src\components\dashboard\ClientCumulativeTable.tsx",
    r"src\components\dashboard\ClientProductPivotTable.tsx",
    r"src\components\pdf\PDFViewerModal.tsx",
    r"src\pages\Clients.tsx",
    r"src\pages\Deliveries.tsx",
    r"src\pages\DeliveryDetail.tsx",
    r"src\pages\History.tsx",
    r"src\pages\InvoiceDetail.tsx",
    r"src\pages\Invoices.tsx",
    r"src\pages\OrderDetail.tsx",
    r"src\pages\Orders.tsx"
]

def add_toast_import(content):
    if "import { toast } from" not in content and "import { toast } " not in content:
        # Add import { toast } from "sonner"; at the top
        return 'import { toast } from "sonner";\n' + content
    return content

for rel_path in files_to_patch:
    path = os.path.join(r"C:\Users\omada production\Desktop\mobinov3-main", rel_path)
    if not os.path.exists(path):
        continue
        
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    original_content = content
    content = add_toast_import(content)

    # Patch exportToCSV
    if "link.click();" in content and "exportToCSV" in content:
        content = re.sub(r'(link\.click\(\);[\s\S]*?)(};)', r'\1    toast.success("Fichier CSV téléchargé avec succès");\n  \2', content)

    # Patch exportToPDF in dashboard
    if "exportToPDF = async" in content:
        content = re.sub(r'(await generateCumulativesPDF[^\n]*\n)', r'\1      toast.success("PDF généré et téléchargé avec succès");\n', content)
        content = re.sub(r'(await generatePDF[^\n]*\n)', r'\1      toast.success("PDF généré et téléchargé avec succès");\n', content)

    # Patch handleDownloadPDF
    if "handleDownloadPDF = async" in content:
        content = re.sub(r'(await generateDeliveryNotePDF[^\n]*\n)', r'\1      toast.success("PDF téléchargé avec succès");\n', content)
        content = re.sub(r'(await generateInvoicePDF[^\n]*\n)', r'\1      toast.success("PDF téléchargé avec succès");\n', content)
        content = re.sub(r'(await generateOrderPDF[^\n]*\n)', r'\1      toast.success("PDF téléchargé avec succès");\n', content)

    # Patch handlePrint
    if "handlePrint = async" in content or "handlePrint = ()" in content:
        content = re.sub(r'(printWindow\.print\(\);[\s\S]*?)(};)', r'\1    toast.success("Impression lancée");\n  \2', content)
        content = re.sub(r'(URL\.revokeObjectURL\(url\);[\s\S]*?)(};)', r'\1    toast.success("Impression lancée");\n  \2', content)

    # Specific client exportToCSV
    if "exportToCSV(exportData," in content:
        content = re.sub(r'(exportToCSV\(exportData,[^\n]*\n)', r'\1    toast.success("Fichier CSV téléchargé avec succès");\n', content)

    # History exportToCSV
    if "exportToCSV(dataToExport," in content:
        content = re.sub(r'(exportToCSV\(dataToExport,[^\n]*\n)', r'\1        toast.success("Fichier CSV téléchargé avec succès");\n', content)

    if content != original_content:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Patched {rel_path}")

print("Done patching toasts.")
