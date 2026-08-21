import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

/**
 * Mounted once by the protected-routes layout route (see App.tsx), instead
 * of every page independently rendering its own Sidebar/Header — that used
 * to remount both on every navigation, causing a visible flicker.
 */
export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <Outlet />
      </div>
    </div>
  );
}
