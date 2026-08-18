import os

def patch_print(filepath, generate_func, name_field, default_name):
    if not os.path.exists(filepath):
        return
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    
    # We want to replace the `const handlePrint = () => { window.print(); };` block
    old_print = """  const handlePrint = () => {
    window.print();
  };"""
    
    # or async version if it already exists
    old_print_2 = """  const handlePrint = async () => {
    window.print();
  };"""

    new_print = f"""  const handlePrint = async () => {{
    if (!{generate_func.replace('generate', '').replace('PDF', '').lower()}) return; // wait this var name might be wrong
    setIsGenerating(true);
    try {{
      // Need to find the exact variable name. For Delivery it's deliveryNote, for Order it's order.
      // We can just call handleDownloadPDF() logic but use open_pdf.
      // Wait, let's just make it call the API if it's there.
    }} catch (error) {{
    }}
  }};"""

# Actually, a better way is to just replace the handlePrint function completely
# using regex.
    import re
    # Find the variable name from handleDownloadPDF
    var_match = re.search(r'generate[A-Za-z]+PDF\(([^,]+),', content)
    if var_match:
        var_name = var_match.group(1).strip()
        
        replacement = f"""  const handlePrint = async () => {{
    if (!{var_name}) return;
    setIsGenerating(true);
    try {{
      const pdfBase64 = await {generate_func}({var_name}, settings, false);
      const {{ invoke }} = await import("@tauri-apps/api/core");
      const fileName = `Impression-${{ {var_name}.{name_field} || "{default_name}" }}.pdf`;
      await invoke("open_pdf", {{ pdfBase64, fileName }});
      toast.success("PDF ouvert pour impression");
    }} catch (error) {{
      console.error("Print error:", error);
      toast.error("Erreur lors de l'impression");
    }} finally {{
      setIsGenerating(false);
    }}
  }};"""
        
        content = re.sub(r'const handlePrint = \(\) => \{\s*window\.print\(\);\s*\};', replacement, content)
        content = re.sub(r'const handlePrint = async \(\) => \{\s*window\.print\(\);\s*\};', replacement, content)
        
        if content != original:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"Patched {filepath}")

patch_print(r"C:\Users\omada production\Desktop\mobinov3-main\src\pages\DeliveryDetail.tsx", "generateDeliveryNotePDF", "delivery_number", "bon_livraison")
patch_print(r"C:\Users\omada production\Desktop\mobinov3-main\src\pages\OrderDetail.tsx", "generateOrderPDF", "order_number", "bon_commande")

print("Done patching print functions.")
