import os

def patch_timbre(filepath):
    if not os.path.exists(filepath):
        print(f"Not found: {filepath}")
        return
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    
    # We want to replace:
    #       calcTimbre = amount * rate;
    #       if (calcTimbre < 5) calcTimbre = 5;
    
    # with:
    #       calcTimbre = amount * rate;
    #       if (calcTimbre < 5) calcTimbre = 5;
    #       if (calcTimbre > 20000) calcTimbre = 20000;

    target_block1 = """      calcTimbre = amount * rate;
      if (calcTimbre < 5) calcTimbre = 5;"""

    replacement1 = """      calcTimbre = amount * rate;
      if (calcTimbre < 5) calcTimbre = 5;
      if (calcTimbre > 20000) calcTimbre = 20000;"""

    # Sometimes it might be formatted differently, so let's do a more robust replace using string operations.
    if target_block1 in content:
        content = content.replace(target_block1, replacement1)
    else:
        # Fallback if there are spaces
        target_block2 = "calcTimbre = amount * rate;\n      if (calcTimbre < 5) calcTimbre = 5;"
        replacement2 = "calcTimbre = amount * rate;\n      if (calcTimbre < 5) calcTimbre = 5;\n      if (calcTimbre > 20000) calcTimbre = 20000;"
        content = content.replace(target_block2, replacement2)
        
    if content != original:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Patched {filepath}")
    else:
        print(f"No changes needed or pattern not found in {filepath}")

files = [
    r"C:\Users\omada production\Desktop\mobinov3-main\src\pages\NewInvoice.tsx",
    r"C:\Users\omada production\Desktop\mobinov3-main\src\pages\NewProforma.tsx",
    r"C:\Users\omada production\Desktop\mobinov3-main\src\components\invoice\EditableInvoicePreview.tsx"
]

for file in files:
    patch_timbre(file)

print("Done patching timbre maximum.")
