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
import SharedPage from "./pages/SharedPage";
import NotFound from "./pages/NotFound";
import { StudyProvider } from "@/context/StudyContext";
import AuthWrapper from "./AuthWrapper";
import ExamPage from "./pages/ExamPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <StudyProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        <BrowserRouter>
          <Routes>
            {/* Public Shared Routes */}
            <Route path="/shared/:share_id" element={<SharedPage />} />

            {/* Protected Routes */}
            <Route element={<AuthWrapper />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/learning" element={<LearningPage />} />
                <Route path="/quiz" element={<QuizPage />} />
                <Route path="/flashcards" element={<FlashcardsPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/research" element={<ResearchPage />} />
                <Route path="/exam" element={<ExamPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>

      </TooltipProvider>
    </StudyProvider>
  </QueryClientProvider>
);

export default App;