import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import UploadPage from "./pages/UploadPage";
import LearningPage from "./pages/LearningPage";
import QuizPage from "./pages/QuizPage";
import FlashcardsPage from "./pages/FlashcardsPage";
import HistoryPage from "./pages/HistoryPage";
import ResearchPage from "./pages/ResearchPage";
import NotFound from "./pages/NotFound";
import { StudyProvider } from "@/context/StudyContext";
import AuthWrapper from "./AuthWrapper";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <StudyProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthWrapper />
      </TooltipProvider>
    </StudyProvider>
  </QueryClientProvider>
);

export default App;
