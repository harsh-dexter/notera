import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom"; // Changed BrowserRouter to HashRouter
import Home from "./pages/Home";
import MeetingsList from "./pages/MeetingsList";
import MeetingDetails from "./pages/MeetingDetails";
import NotFound from "./pages/NotFound";
import { RecordingProvider } from "./context/RecordingContext"; // Import the provider

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <RecordingProvider> {/* Move Provider inside Router */}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/meetings" element={<MeetingsList />} />
            <Route path="/meetings/:id" element={<MeetingDetails />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </RecordingProvider> {/* Close Provider inside Router */}
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
