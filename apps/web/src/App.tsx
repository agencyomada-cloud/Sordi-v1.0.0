import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@sordi/ui";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { BentoGrid } from "@/components/BentoGrid";
import { WorkflowSteps } from "@/components/WorkflowSteps";
import { ResultsBanner } from "@/components/ResultsBanner";
import { Pricing } from "@/components/Pricing";
import { Faq } from "@/components/Faq";
import { triggerDirectDownload } from "@/lib/download";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <SiteHeader onDownload={() => triggerDirectDownload("macos")} />
        <Hero onDownload={triggerDirectDownload} />
        <BentoGrid />
        <WorkflowSteps />
        <ResultsBanner />
        <Pricing onDownload={() => triggerDirectDownload("macos")} />
        <Faq />
        <Footer onDownload={() => triggerDirectDownload("macos")} />
      </div>

      <Toaster />
    </QueryClientProvider>
  );
}
