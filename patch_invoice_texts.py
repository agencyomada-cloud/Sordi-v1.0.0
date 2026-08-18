import os
import re

files_to_patch = [
    r"src\components\pdf\InvoicePDFDocument.tsx",
    r"src\components\invoice\InvoicePreview.tsx",
    r"src\components\invoice\InvoicePrintView.tsx",
    r"src\components\invoice\EditableInvoicePreview.tsx"
]

for rel_path in files_to_patch:
    path = os.path.join(r"C:\Users\omada production\Desktop\mobinov3-main", rel_path)
    if not os.path.exists(path):
        print(f"Not found: {path}")
        continue
        
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    original = content

    # 1. Fix Avoir N° -> Avoir relatif à la facture N°
    content = content.replace("Avoir N° ", "Avoir relatif à la facture N° ")
    content = content.replace("Avoir N°", "Avoir relatif à la facture N°")
    content = content.replace("Avoir N\ufffd", "Avoir relatif à la facture N°")

    # 2. Hide payment method for credit notes (Avoir)
    content = content.replace("{!isProforma && (", "{!isProforma && !isCreditNote && (")

    if content != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Patched {rel_path}")
    else:
        print(f"No changes made to {rel_path}")

print("Done patching texts.")
