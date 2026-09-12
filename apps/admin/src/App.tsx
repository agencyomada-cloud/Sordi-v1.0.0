import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@sordi/ui";
import { useAdminKey } from "@/lib/adminAuth";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function RequireAdminKey({ children }: { children: React.ReactNode }) {
  const adminKey = useAdminKey();
  if (!adminKey) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/devices"
            element={
              <RequireAdminKey>
                <Dashboard />
              </RequireAdminKey>
            }
          />
          <Route path="*" element={<Navigate to="/devices" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
