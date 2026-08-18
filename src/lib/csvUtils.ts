// CSV Export utility
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns: { key: keyof T; label: string }[]
): void {
  if (data.length === 0) {
    alert("Aucune donnée à exporter");
    return;
  }

  // Create header row
  const header = columns.map(col => `"${col.label}"`).join(";");

  // Create data rows
  const rows = data.map(item =>
    columns.map(col => {
      const value = item[col.key];
      if (value === null || value === undefined) return '""';
      // Escape quotes and wrap in quotes
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    }).join(";")
  );

  // Combine header and rows
  const csv = [header, ...rows].join("\n");

  // Add BOM for proper UTF-8 encoding in Excel
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });

  // Create download link
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// CSV Import utility
export function parseCSV(content: string): Record<string, string>[] {
  // 1. Strip BOM if present
  const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;

  const lines = cleanContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  // 2. Detect delimiter from the first line (header)
  const firstLine = lines[0];
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = semicolonCount >= commaCount ? ";" : ",";

  // Parse header
  const headers = parseCSVLine(firstLine, delimiter).map(h => h.trim().replace(/^"|"$/g, ''));

  // Parse data rows
  const data: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);

    // Create row object if we have values
    if (values.length > 0) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        // Clean value (remove surrounding quotes if parseCSVLine kept them, though logic below removes them)
        // Actually parseCSVLine logic below reconstructs the value without surrounding quotes but handles internal escaped quotes.
        // Let's rely on parseCSVLine result.

        // Handle undefined or empty values
        const value = values[index]?.trim() || "";
        if (header) {
          row[header] = value;
        }
      });
      // Only push if row has data
      if (Object.values(row).some(v => v)) {
        data.push(row);
      }
    }
  }

  return data;
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

// Map CSV headers to database fields
export function mapCSVToClient(row: Record<string, string>): Record<string, string> {
  const headerMapping: Record<string, string> = {
    // Standard keys (lowercase)
    "nom": "name",
    "name": "name",
    "code": "code",
    "téléphone": "phone",
    "telephone": "phone",
    "phone": "phone",
    "email": "email",
    "mail": "email",
    "adresse": "address",
    "address": "address",
    "ville": "city",
    "city": "city",
    "wilaya": "wilaya",
    "nif": "nif",
    "nis": "nis",
    "rc": "rc",
    "ai": "ai",
    "notes": "notes",
    "contact": "contact_person",
    "contact_person": "contact_person",
    "interlocuteur": "contact_person"
  };

  const mapped: Record<string, string> = {};

  for (const [csvHeader, value] of Object.entries(row)) {
    const normalizedHeader = csvHeader.toLowerCase().trim();

    // Direct lookup
    let dbField = headerMapping[normalizedHeader];

    // Fuzzy lookup
    if (!dbField) {
      if (normalizedHeader.includes("nom")) dbField = "name";
      else if (normalizedHeader.includes("téléphone") || normalizedHeader.includes("phone")) dbField = "phone";
      else if (normalizedHeader.includes("mail")) dbField = "email";
      else if (normalizedHeader.includes("adresse")) dbField = "address";
    }

    // Fallback to original header if it matches a DB field directly
    if (!dbField) dbField = normalizedHeader;

    if (value) {
      mapped[dbField] = value;
    }
  }

  return mapped;
}

// Map CSV headers to product fields
export function mapCSVToProduct(row: Record<string, string>): Record<string, string | number> {
  const headerMapping: Record<string, string> = {
    "Code": "code",
    "Nom": "name",
    "Description": "description",
    "Prix unitaire": "unit_price",
    "Prix": "unit_price",
    "Unité": "unit",
    "Name": "name",
    "Price": "unit_price",
    "Unit": "unit",
  };

  const mapped: Record<string, string | number> = {};

  for (const [csvHeader, value] of Object.entries(row)) {
    const dbField = headerMapping[csvHeader] || csvHeader.toLowerCase();
    if (value) {
      if (dbField === "unit_price") {
        mapped[dbField] = parseFloat(value.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
      } else {
        mapped[dbField] = value;
      }
    }
  }

  return mapped;
}

// Validate required fields
export function validateClientImport(data: Record<string, string>[]): { valid: Record<string, string>[]; errors: string[] } {
  const valid: Record<string, string>[] = [];
  const errors: string[] = [];

  data.forEach((row, index) => {
    const mapped = mapCSVToClient(row);
    if (!mapped.name || mapped.name.trim() === "") {
      errors.push(`Ligne ${index + 2}: Le nom du client est requis`);
    } else {
      valid.push(mapped);
    }
  });

  return { valid, errors };
}

export function validateProductImport(data: Record<string, string>[]): { valid: Record<string, string | number>[]; errors: string[] } {
  const valid: Record<string, string | number>[] = [];
  const errors: string[] = [];

  data.forEach((row, index) => {
    const mapped = mapCSVToProduct(row);
    if (!mapped.name || String(mapped.name).trim() === "") {
      errors.push(`Ligne ${index + 2}: Le nom du produit est requis`);
    } else if (!mapped.code || String(mapped.code).trim() === "") {
      errors.push(`Ligne ${index + 2}: Le code produit est requis`);
    } else {
      valid.push(mapped);
    }
  });

  return { valid, errors };
}
