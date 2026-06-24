import { useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useStudy } from "@/context/StudyContext";

interface QuizItem {
  question: string;
  options: string[];
  correct: number;
}

interface QuizTabProps {
  quiz: QuizItem[];
  notesContent?: string;
}

export default function QuizTab({ quiz: initialQuiz, notesContent }: QuizTabProps) {
  const { recordQuizResult, currentSession } = useStudy();
  const [quiz, setQuiz] = useState<QuizItem[]>(initialQuiz);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  if (!quiz || quiz.length === 0) {
    return (
      <div className="glass-card p-12 text-center space-y-4 animate-fade-in">
        <p className="text-muted-foreground">No quiz available for this session.</p>
      </div>
    );
  }

  const q = quiz[currentQ];

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === q.correct) setScore(s => s + 1);
    setAnswered(a => a + 1);
  };

  const nextQuestion = () => {
    if (currentQ < quiz.length - 1) {
      setSelected(null);
      setCurrentQ(c => c + 1);
    } else {
      // Record this attempt before showing results
      const finalScore = selected === q.correct ? score + 1 : score;
      recordQuizResult(finalScore, quiz.length);
      setShowResults(true);
    }
  };

  const restartQuiz = () => {
    setCurrentQ(0);
    setSelected(null);
    setScore(0);
    setAnswered(0);
    setShowResults(false);
  };

  const loadMoreQuestions = async () => {
    if (!currentSession) return;
    setLoadingMore(true);
    try {
      // Use notes content if available, otherwise fall back to the session title
      const content = notesContent || currentSession.title || "";

      const formData = new FormData();
      formData.append("text", content);

      const res = await fetch("http://localhost:8000/learn", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to fetch more questions");

      const data = await res.json();
      const parsed = JSON.parse(data.result);
      const newQuiz: QuizItem[] = parsed?.quiz || [];

      if (newQuiz.length === 0) throw new Error("No questions returned");

      setQuiz(newQuiz);
      setCurrentQ(0);
      setSelected(null);
      setScore(0);
      setAnswered(0);
      setShowResults(false);
    } catch (err) {
      console.error("More questions error:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (showResults) {
    return (
      <div className="glass-card p-12 text-center space-y-6 animate-fade-in">
        <div className="h-20 w-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-foreground">Quiz Complete!</h2>
          <p className="text-muted-foreground">You scored {score} out of {quiz.length}</p>
        </div>
        <div className="pt-4 flex flex-wrap gap-4 justify-center">
          <button
            onClick={restartQuiz}
            className="px-8 py-3 rounded-2xl border-2 border-primary text-primary font-bold hover:bg-primary/10 hover:scale-105 transition-all"
          >
            Try Again 🔄
          </button>
          <button
            onClick={loadMoreQuestions}
            disabled={loadingMore}
            className="px-8 py-3 rounded-2xl gradient-primary-bg text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "More Questions ✨"
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 shadow-md border-l-4 border-l-primary">
        <div className="flex justify-between text-sm mb-3">
          <span className="text-muted-foreground font-bold">QUESTION {currentQ + 1} OF {quiz.length}</span>
          <span className="font-bold text-primary">SCORE: {score}/{answered}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3">
          <div
            className="bg-primary rounded-full h-3 transition-all duration-700 shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
            style={{ width: `${((currentQ + 1) / quiz.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="glass-card p-8 animate-fade-in shadow-xl">
        <h3 className="font-heading font-bold text-foreground text-2xl mb-8 leading-tight">{q.question}</h3>
        <div className="grid grid-cols-1 gap-4">
          {q.options.map((opt, i) => {
            let classes = "glass-card p-5 cursor-pointer transition-all duration-300 flex items-center gap-4 text-left border-2";
            if (selected !== null) {
              if (i === q.correct) classes += " border-success bg-success/10 shadow-lg shadow-success/10 scale-[1.02]";
              else if (i === selected) classes += " border-destructive bg-destructive/10 shadow-lg shadow-destructive/10";
              else classes += " opacity-50 border-border";
            } else {
              classes += " border-transparent hover:border-primary/40 hover:bg-accent/50 hover:translate-x-2";
            }

            return (
              <div key={i} onClick={() => handleSelect(i)} className={classes}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                  selected !== null && i === q.correct ? "bg-success text-success-foreground" :
                  selected === i ? "bg-destructive text-destructive-foreground" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {selected !== null && i === q.correct ? <CheckCircle className="h-5 w-5" /> :
                   selected === i ? <XCircle className="h-5 w-5" /> :
                   String.fromCharCode(65 + i)}
                </div>
                <span className="flex-1 text-lg font-medium text-foreground">{opt}</span>
              </div>
            );
          })}
        </div>

        {selected !== null && (
          <div className="mt-10 flex justify-end animate-slide-up">
            <button
              onClick={nextQuestion}
              className="px-10 py-4 rounded-2xl gradient-primary-bg text-primary-foreground font-bold text-lg shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
            >
              {currentQ < quiz.length - 1 ? "Next Question →" : "Finish Quiz ✨"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
