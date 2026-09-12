import { useState } from "react";
import { MockDashboardPreview } from "./MockDashboardPreview";

/** Real macOS-chrome window showcase for the hero. Tries the real product
 *  screenshot at /assets/screenshots/dashboard.png (drop it into
 *  apps/web/public/assets/screenshots/ to activate it — no code change
 *  needed) and falls back to the stylized MockDashboardPreview if it 404s,
 *  so the hero never shows a broken image while no real screenshot has
 *  been captured yet. */
export function DesktopShowcase() {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="mt-16 rounded-xl bg-white ring-1 ring-slate-200 shadow-2xl shadow-slate-900/10 overflow-hidden">
      <div className="h-9 border-b border-slate-200 flex items-center px-4 bg-slate-50">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57] shadow-[0_0_1px_rgba(0,0,0,0.4)]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e] shadow-[0_0_1px_rgba(0,0,0,0.4)]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840] shadow-[0_0_1px_rgba(0,0,0,0.4)]" />
        </div>
        <span className="flex-1 text-center text-xs font-medium text-slate-500 -ml-16">Sordi Finance</span>
      </div>
      <div className="aspect-[16/9] overflow-hidden">
        {!imageFailed ? (
          <img
            src="/assets/screenshots/dashboard.png"
            alt="Aperçu du tableau de bord Sordi Finance"
            className="w-full h-full object-cover object-top"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <MockDashboardPreview />
        )}
      </div>
    </div>
  );
}
