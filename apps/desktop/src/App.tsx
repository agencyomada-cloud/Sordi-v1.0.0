import { Toaster, TooltipProvider } from "@sordi/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LicenseBanner } from "@/components/LicenseBanner";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Clients from "./pages/Clients";
import NewClient from "./pages/NewClient";
import ClientDetail from "./pages/ClientDetail";
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
import UpgradePage from "./pages/Upgrade";
import Management from "./pages/Management";
import Projects from "./pages/Projects";
import NewProject from "./pages/NewProject";
import ProjectDetail from "./pages/ProjectDetail";
import Payroll from "./pages/Payroll";
import EmployeeDetail from "./pages/EmployeeDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <LicenseBanner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<Index />} />
            <Route path="/history" element={<History />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/new" element={<NewClient />} />
            <Route path="/clients/:id/edit" element={<NewClient />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
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
            <Route path="/products" element={<Products />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/analyses" element={<SalesAnalysis />} />

            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/orders/:id/edit" element={<EditOrder />} />
            <Route path="/orders/new" element={<NewOrder />} />

            <Route path="/test-verification" element={<VerificationTest />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/upgrade" element={<UpgradePage />} />
            <Route path="/management" element={<Management />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/new" element={<NewProject />} />
            <Route path="/projects/:id/edit" element={<NewProject />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/employees/:id" element={<EmployeeDetail />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
