import { useStudy } from "@/context/StudyContext";
import AuthPage from "./pages/AuthPage";
import AppLayout from "./components/AppLayout";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import UploadPage from "./pages/UploadPage";
import LearningPage from "./pages/LearningPage";
import QuizPage from "./pages/QuizPage";
import FlashcardsPage from "./pages/FlashcardsPage";
import HistoryPage from "./pages/HistoryPage";
import ResearchPage from "./pages/ResearchPage";
import RoadmapPage from "./pages/RoadmapPage";
import ExamPage from "./pages/ExamPage";
import NotFound from "./pages/NotFound";

export default function AuthWrapper() {
  const { token } = useStudy();

  if (!token) {
    return <AuthPage />;
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/learning" element={<LearningPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/flashcards" element={<FlashcardsPage />} />
          <Route path="/exam" element={<ExamPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
