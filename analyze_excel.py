
import pandas as pd
import os

files = [
    '/Users/mac/Desktop/OmadaInvoice/ETAT DES SUIVI FACT CLIENTS 2025.xlsx',
    '/Users/mac/Desktop/OmadaInvoice/FICHE POUR CLIENTS 2025 A PARTIR 09-08-2025.xlsx'
]

for file_path in files:
    print(f"\n--- Analyzing: {os.path.basename(file_path)} ---")
    try:
        xls = pd.ExcelFile(file_path)
        print(f"Sheets: {xls.sheet_names}")
        for sheet in xls.sheet_names:
            print(f"\nSheet: {sheet}")
            df = pd.read_excel(xls, sheet_name=sheet, nrows=5)
            print("Columns:", df.columns.tolist())
            print("First row samples:", df.iloc[0].tolist() if not df.empty else "Empty")
    except Exception as e:
        print(f"Error reading file: {e}")
