import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import SizeSelection from "./pages/SizeSelection";
import StyleSelection from "./pages/StyleSelection";
import DesignDetails from "./pages/DesignDetails";
import ProposalsView from "./pages/ProposalsView";
import NotFound from "./pages/NotFound";
import { LanguageSelector } from "@/components/LanguageSelector";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="fixed top-6 right-6 z-50">
          <LanguageSelector />
        </div>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/design/size" element={<SizeSelection />} />
          <Route path="/design/style" element={<StyleSelection />} />
          <Route path="/design/details" element={<DesignDetails />} />
          <Route path="/design/proposals/:requestId" element={<ProposalsView />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
