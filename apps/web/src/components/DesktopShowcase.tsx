import { MockDashboardPreview } from "./MockDashboardPreview";

/** Real macOS-chrome window showcase for the hero. Currently always renders
 *  the stylized MockDashboardPreview: no real product screenshot exists
 *  anywhere in this repo (nothing under apps/web/public/), so there is
 *  nothing at /assets/screenshots/dashboard.png to load — a plain <img>
 *  pointed at that path would 404 on every page load.
 *
 *  To activate a real screenshot once one exists: drop the file at
 *  apps/web/public/assets/screenshots/dashboard.png, then swap the
 *  MockDashboardPreview render below for
 *  `<img src="/assets/screenshots/dashboard.png" alt="Aperçu du tableau de
 *  bord Sordi Finance" className="w-full h-full object-cover object-top" />`. */
export function DesktopShowcase() {
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
        <MockDashboardPreview />
      </div>
    </div>
  );
}
