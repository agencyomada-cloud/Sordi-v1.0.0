import { Toaster, TooltipProvider } from "@sordi/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { SecureSessionProvider } from "@/hooks/useSecureSession";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Clients from "./pages/Clients";
import NewClient from "./pages/NewClient";
import ClientDetail from "./pages/ClientDetail";
import Suppliers from "./pages/Suppliers";
import Invoices from "./pages/Invoices";
import InvoiceDetail from "./pages/InvoiceDetail";
import NewInvoice from "./pages/NewInvoice";
import NewProforma from "./pages/NewProforma";
import NewCreditNote from "./pages/NewCreditNote";
import Deliveries from "./pages/Deliveries";
import DeliveryDetail from "./pages/DeliveryDetail";
import NewDelivery from "./pages/NewDelivery";
import EditDelivery from "./pages/EditDelivery";
import Payments from "./pages/Payments";
import Relances from "./pages/Relances";
import Products from "./pages/Products";
import SalesAnalysis from "./pages/SalesAnalysis";
import History from "./pages/History";
import Expenses from "./pages/Expenses";


import Orders from "./pages/Orders";
import NewOrder from "./pages/NewOrder";
import EditOrder from "./pages/EditOrder";
import OrderDetail from "./pages/OrderDetail";
import VerificationTest from "./pages/VerificationTest";
import SettingsPage from "./pages/Settings";
import IntegrationsPage from "./pages/Integrations";
import UpgradePage from "./pages/Upgrade";
import Management from "./pages/Management";
import Projects from "./pages/Projects";
import Contracts from "./pages/Contracts";
import NewProject from "./pages/NewProject";
import ProjectDetail from "./pages/ProjectDetail";
import Payroll from "./pages/Payroll";
import Partners from "./pages/Partners";
import { useLanguage } from "@/hooks/useLanguage";
import EmployeeDetail from "./pages/EmployeeDetail";
import NotFound from "./pages/NotFound";
import Widget from "./pages/Widget";
import SplashScreen from "./pages/SplashScreen";
import { useSplashDismissal } from "@/hooks/useSplashDismissal";

const queryClient = new QueryClient();

// Reconciles i18next's in-memory language with the workspace-wide setting
// once it loads from the DB — see useLanguage. Renders nothing.
function LanguageBootstrap() {
  useLanguage();
  return null;
}

// The floating widget window (see tauri.conf.json's "widget" window and
// widget.rs) loads this same index.html/App bundle with ?view=widget — it's
// a companion glance-view of the already-running main window, not its own
// authenticated session, so it skips the router/AppLayout/ProtectedRoute/
// Toaster/TrialBanner tree entirely and just needs the data providers.
const isWidgetWindow = new URLSearchParams(window.location.search).get("view") === "widget";

// The splashscreen window (see tauri.conf.json's "splashscreen" window and
// splashscreen.rs) loads this same bundle with ?view=splash — purely
// decorative and fully self-contained (SplashScreen.tsx has zero data
// dependencies), so it only needs ThemeProvider for correct light/dark
// `bg-background`/`border-border` colors, nothing else from the app shell.
const isSplashWindow = new URLSearchParams(window.location.search).get("view") === "splash";

// Fires the close_splashscreen IPC call once this (the "main") window's
// own bootstrap has actually settled — see useSplashDismissal for what
// "settled" means and why. Rendered as its own component (not called
// directly in App) purely so its hooks only run in the main-window render
// tree below, never in the widget or splash branches above/below it.
function SplashDismissalBootstrap() {
  useSplashDismissal();
  return null;
}

const App = () => {
  if (isSplashWindow) {
    return (
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <SplashScreen />
      </ThemeProvider>
    );
  }

  if (isWidgetWindow) {
    return (
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <QueryClientProvider client={queryClient}>
          <WorkspaceProvider>
            <TooltipProvider>
              <Widget />
            </TooltipProvider>
          </WorkspaceProvider>
        </QueryClientProvider>
      </ThemeProvider>
    );
  }

  return (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
    <WorkspaceProvider>
    <TooltipProvider>
      <SplashDismissalBootstrap />
      <LanguageBootstrap />
      <Toaster
        position="bottom-center"
        offset="24px"
        gap={8}
        duration={3000}
        expand={false}
        richColors
        closeButton
      />
      <BrowserRouter>
        <SecureSessionProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Index />} />
              <Route path="/history" element={<History />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/clients/new" element={<NewClient />} />
              <Route path="/clients/:id/edit" element={<NewClient />} />
              <Route path="/clients/:id" element={<ClientDetail />} />
              <Route path="/fournisseurs" element={<Suppliers />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/new" element={<NewInvoice />} />
              <Route path="/invoices/:id/edit" element={<NewInvoice />} />
              <Route path="/invoices/:id" element={<InvoiceDetail />} />
              <Route path="/proformas/new" element={<NewProforma />} />
              <Route path="/invoices/credit-note/new" element={<NewCreditNote />} />
              <Route path="/deliveries" element={<Deliveries />} />
              <Route path="/deliveries/:id" element={<DeliveryDetail />} />
              <Route path="/deliveries/:id/edit" element={<EditDelivery />} />
              <Route path="/deliveries/new" element={<NewDelivery />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/relances" element={<Relances />} />
              <Route path="/products" element={<Products />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/analyses" element={<SalesAnalysis />} />

              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/orders/:id/edit" element={<EditOrder />} />
              <Route path="/orders/new" element={<NewOrder />} />

              {/* Sidebar-tree-hierarchy route aliases — the sidebar nav links
                  here, but the underlying pages/data are unchanged (same
                  components, same query hooks). Kept as aliases rather than
                  renaming the canonical paths above, so every existing
                  navigate()/Link call elsewhere in the app keeps working. */}
              <Route path="/factures" element={<Invoices />} />
              <Route path="/devis" element={<Invoices />} />
              <Route path="/livraisons" element={<Deliveries />} />
              <Route path="/charges" element={<Expenses />} />
              <Route path="/commandes" element={<Orders />} />
              <Route path="/paie" element={<Payroll />} />
              <Route path="/stocks" element={<Products />} />
              <Route path="/employes" element={<Management />} />
              <Route path="/associes" element={<Partners />} />
              <Route path="/historique" element={<History />} />

              <Route path="/test-verification" element={<VerificationTest />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/upgrade" element={<UpgradePage />} />
              <Route path="/management" element={<Management />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/projects/new" element={<NewProject />} />
              <Route path="/projects/:id/edit" element={<NewProject />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/partners" element={<Partners />} />
              <Route path="/employees/:id" element={<EmployeeDetail />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SecureSessionProvider>
      </BrowserRouter>
    </TooltipProvider>
    </WorkspaceProvider>
    </QueryClientProvider>
  </ThemeProvider>
  );
};

export default App;
