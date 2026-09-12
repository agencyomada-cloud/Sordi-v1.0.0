// Every "Télécharger" button on the landing page calls this directly — no
// modal, no form, no lead-capture step of any kind. A click must produce a
// file download immediately, with nothing in between.
const DOWNLOAD_URL: Record<"macos" | "windows", string> = {
  macos: "/downloads/sordi-finance-mac.dmg",
  windows: "/downloads/sordi-finance-win.exe",
};

export function triggerDirectDownload(osType: "macos" | "windows" = "macos") {
  const link = document.createElement("a");
  link.href = DOWNLOAD_URL[osType];
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
