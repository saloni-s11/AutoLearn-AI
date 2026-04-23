import { useMemo } from "react";
import QuizTab from "@/components/learning/QuizTab";
import { useStudy } from "@/context/StudyContext";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function QuizPage() {
  const { currentSession } = useStudy();
  const navigate = useNavigate();

  const quizData = useMemo(() => {
    if (!currentSession?.data?.result) return [];
    try {
      const parsed = JSON.parse(currentSession.data.result);
      return parsed.quiz || [];
    } catch (e) {
      return [];
    }
  }, [currentSession]);

  if (!currentSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-6">
        <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center">
          <BookOpen className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Start a session first</h2>
          <p className="text-muted-foreground">Upload content to generate a specialized quiz.</p>
        </div>
        <Button onClick={() => navigate("/upload")} variant="gradient">Go to Upload</Button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 pb-32">
      <div className="animate-slide-up">
        <h1 className="font-heading text-4xl font-bold text-foreground">Quiz & Practice</h1>
        <p className="text-muted-foreground mt-1">Testing your knowledge on: <span className="text-primary font-bold">{currentSession.title}</span></p>
      </div>
      <QuizTab quiz={quizData} />
    </div>
  );
}
