export function detectOS(): "macos" | "windows" {
  if (typeof navigator === "undefined") return "macos";
  const platform = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`.toLowerCase();
  return platform.includes("win") ? "windows" : "macos";
}
