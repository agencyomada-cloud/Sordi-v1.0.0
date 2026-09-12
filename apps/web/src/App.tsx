import { useState } from "react";
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
import { DownloadModal } from "@/components/DownloadModal";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

export function App() {
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [osType, setOsType] = useState<"macos" | "windows">("macos");

  const openDownload = (os: "macos" | "windows" = "macos") => {
    setOsType(os);
    setDownloadOpen(true);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <SiteHeader onDownload={() => openDownload("macos")} />
        <Hero onDownload={openDownload} />
        <BentoGrid />
        <WorkflowSteps />
        <ResultsBanner />
        <Pricing onDownload={() => openDownload("macos")} />
        <Faq />
        <Footer onDownload={() => openDownload("macos")} />
      </div>

      <DownloadModal open={downloadOpen} onOpenChange={setDownloadOpen} osType={osType} />
      <Toaster />
    </QueryClientProvider>
  );
}
