/**
 * The Rust/SQLite side of the desktop app is snake_case throughout (confirmed
 * by today's existing `CreateClientData`/`CreateInvoiceData` etc. in
 * src/lib/database.ts, which already send/receive snake_case fields
 * successfully). DataClient's types are camelCase. These helpers convert at
 * the LocalAdapter boundary so the rest of the app never sees snake_case.
 */

function toSnakeCaseKey(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamelCaseKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function deepMapKeys(value: unknown, mapKey: (key: string) => string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => deepMapKeys(item, mapKey));
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        mapKey(key),
        deepMapKeys(val, mapKey),
      ]),
    );
  }
  return value;
}

export function toSnakeCase<T = unknown>(value: unknown): T {
  return deepMapKeys(value, toSnakeCaseKey) as T;
}

export function toCamelCase<T = unknown>(value: unknown): T {
  return deepMapKeys(value, toCamelCaseKey) as T;
}
