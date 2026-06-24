import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Brain, Clock, Settings, Play, CheckCircle2, XCircle, AlertCircle, 
  Calendar, ChevronLeft, History, Sparkles, BookOpen, Award, 
  Timer, BarChart3, Shuffle, ListChecks, HelpCircle
} from "lucide-react";
import { useStudy } from "@/context/StudyContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  generateExam, 
  getNextAdaptiveQuestion, 
  submitExamAnalytics, 
  getExamHistory 
} from "@/api";

interface Question {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
}

interface AnalyticsResult {
  score: string;
  correct: number;
  total: number;
  accuracy: number;
  time_taken_seconds: number;
  weak_topics: string[];
  suggested_revision: string[];
  topic_breakdown: Record<string, { total: number; correct: number }>;
}

export default function ExamPage() {
  const { currentSession, token } = useStudy();
  const navigate = useNavigate();

  // Active view: 'setup' | 'loading' | 'active' | 'submitting' | 'results' | 'history'
  const [view, setView] = useState<"setup" | "loading" | "active" | "submitting" | "results" | "history">("setup");

  // Configuration states
  const [examType, setExamType] = useState<"practice" | "timed" | "adaptive" | "mock">("practice");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionCount, setQuestionCount] = useState<number>(10);

  // Active Exam states
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  
  // Timer states
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Adaptive specific states
  const [currentDifficulty, setCurrentDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [askedQuestionTexts, setAskedQuestionTexts] = useState<string[]>([]);
  const [adaptiveLoading, setAdaptiveLoading] = useState(false);

  // Result state
  const [results, setResults] = useState<AnalyticsResult | null>(null);

  // History state
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load content string from active session
  const contentString = useMemo(() => {
    if (!currentSession?.data?.result) return "";
    try {
      const parsed = JSON.parse(currentSession.data.result);
      if (parsed.notes) {
        return parsed.notes.map((n: any) => `${n.title}\n${n.content}`).join("\n\n");
      }
      return currentSession.title;
    } catch (e) {
      return currentSession.title;
    }
  }, [currentSession]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const loadHistory = async () => {
    if (!token) return;
    setHistoryLoading(true);
    const data = await getExamHistory(token);
    if (data && data.history) {
      setHistoryList(data.history);
    }
    setHistoryLoading(false);
  };

  const handleStartExam = async () => {
    if (!contentString) {
      toast.error("No study material loaded. Please upload content first.");
      return;
    }

    setView("loading");
    setSelectedAnswers({});
    setCurrentQuestionIdx(0);
    setAskedQuestionTexts([]);
    setCurrentDifficulty(difficulty);

    try {
      // For adaptive exam, we start with generating just 1 initial question
      const startCount = examType === "adaptive" ? 1 : questionCount;
      const data = await generateExam(contentString, examType, difficulty, startCount);

      if (data && data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setAskedQuestionTexts([data.questions[0].question]);
        
        // Start timers
        startTimeRef.current = Date.now();
        if (examType === "timed") {
          // 60 seconds per question limit
          const totalSeconds = questionCount * 60;
          setTimeRemaining(totalSeconds);
          startTimer();
        }

        setView("active");
        toast.success(`Exam started! Good luck.`);
      } else {
        setView("setup");
        toast.error("Failed to generate exam questions. Please try again.");
      }
    } catch (err) {
      setView("setup");
      toast.error("An error occurred during exam generation.");
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleForceSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAnswerSelect = (optionIdx: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQuestionIdx]: optionIdx
    }));
  };

  const handleNextQuestion = async () => {
    if (selectedAnswers[currentQuestionIdx] === undefined) {
      toast.warning("Please select an answer before proceeding.");
      return;
    }

    const currentQuestion = questions[currentQuestionIdx];
    const isCorrect = selectedAnswers[currentQuestionIdx] === currentQuestion.correct;

    // If Adaptive mode, fetch next question dynamically
    if (examType === "adaptive" && currentQuestionIdx === questions.length - 1 && questions.length < questionCount) {
      setAdaptiveLoading(true);
      const nextQ = await getNextAdaptiveQuestion(
        contentString,
        currentDifficulty,
        isCorrect,
        askedQuestionTexts
      );
      setAdaptiveLoading(false);

      if (nextQ && nextQ.question) {
        setQuestions(prev => [...prev, nextQ.question]);
        setAskedQuestionTexts(prev => [...prev, nextQ.question.question]);
        setCurrentDifficulty(nextQ.difficulty);
        setCurrentQuestionIdx(prev => prev + 1);
      } else {
        toast.error("Could not fetch next adaptive question. Submitting exam.");
        handleFinishExam();
      }
    } else {
      if (currentQuestionIdx < questions.length - 1) {
        setCurrentQuestionIdx(prev => prev + 1);
      } else {
        handleFinishExam();
      }
    }
  };

  const handleForceSubmit = () => {
    toast.error("Time is up! Submitting your answers.");
    handleFinishExam();
  };

  const handleFinishExam = async () => {
    setView("submitting");
    if (timerRef.current) clearInterval(timerRef.current);

    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    // Format answers for analytics endpoint
    const submittedAnswers = questions.map((q, idx) => {
      const selected = selectedAnswers[idx];
      return {
        question: q.question,
        topic: q.topic || "General",
        correct: selected === q.correct,
        time_taken: Math.round(durationSeconds / questions.length) // average time per question
      };
    });

    try {
      if (!token) return;
      const data = await submitExamAnalytics(
        token, 
        submittedAnswers, 
        durationSeconds, 
        `${currentSession?.title || "AI Exam"} (${examType.toUpperCase()})`
      );

      if (data) {
        setResults(data);
        setView("results");
        toast.success("Exam completed! Review your results.");
      } else {
        setView("setup");
        toast.error("Failed to submit exam analytics.");
      }
    } catch (e) {
      setView("setup");
      toast.error("Error submitting exam results.");
    }
  };

  // Format time remaining MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!currentSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-6 animate-fade-in">
        <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center">
          <BookOpen className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">No active session</h2>
          <p className="text-muted-foreground max-w-xs mx-auto">
            Please upload some content or select a previous study session to start an exam.
          </p>
        </div>
        <Button onClick={() => navigate("/upload")} variant="gradient" size="lg">
          Start Learning ✨
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 pb-32">
      
      {/* Header Block */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="font-heading text-4xl font-black text-foreground bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
            Exam & Assessment
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            Prepare, evaluate, and adapt using advanced AI testing.
          </p>
        </div>
        {view === "setup" && (
          <Button 
            onClick={() => { setView("history"); loadHistory(); }} 
            variant="outline" 
            className="gap-2 border-primary/20 hover:border-primary/50 text-sm font-bold h-11 rounded-xl"
          >
            <History className="h-4 w-4 text-primary" />
            Exam History
          </Button>
        )}
        {view === "history" && (
          <Button 
            onClick={() => setView("setup")} 
            variant="ghost" 
            className="gap-2 text-sm font-bold h-11 rounded-xl"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Config
          </Button>
        )}
      </div>

      {/* --- VIEW: SETUP --- */}
      {view === "setup" && (
        <div className="grid grid-cols-1 gap-8 animate-slide-up">
          
          {/* Exam Configuration Card */}
          <div className="glass-card p-6 md:p-8 space-y-8">
            
            {/* Session Info Banner */}
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <p className="text-sm text-foreground/80">
                You are testing on: <span className="font-bold text-primary">{currentSession.title}</span>
              </p>
            </div>

            {/* Exam Mode Grid */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" /> Selection Exam Mode
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Practice Mode */}
                <div 
                  onClick={() => setExamType("practice")}
                  className={`p-5 rounded-2xl border cursor-pointer select-none transition-all duration-300 hover:border-primary/50 ${
                    examType === "practice" ? "border-2 border-primary bg-primary/5 shadow-md shadow-primary/5" : "border-border bg-card/40"
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                      <ListChecks className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">Practice Exam</h4>
                      <p className="text-xs text-muted-foreground mt-1">Untimed assessment with no strict limits. Perfect for studying.</p>
                    </div>
                  </div>
                </div>

                {/* Timed Mode */}
                <div 
                  onClick={() => setExamType("timed")}
                  className={`p-5 rounded-2xl border cursor-pointer select-none transition-all duration-300 hover:border-primary/50 ${
                    examType === "timed" ? "border-2 border-primary bg-primary/5 shadow-md shadow-primary/5" : "border-border bg-card/40"
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                      <Clock className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">Timed Exam</h4>
                      <p className="text-xs text-muted-foreground mt-1">Adds a dynamic countdown timer (60 seconds per question). Keep pace!</p>
                    </div>
                  </div>
                </div>

                {/* Adaptive Mode */}
                <div 
                  onClick={() => setExamType("adaptive")}
                  className={`p-5 rounded-2xl border cursor-pointer select-none transition-all duration-300 hover:border-primary/50 ${
                    examType === "adaptive" ? "border-2 border-primary bg-primary/5 shadow-md shadow-primary/5" : "border-border bg-card/40"
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Shuffle className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">Adaptive Intelligence</h4>
                      <p className="text-xs text-muted-foreground mt-1">Difficulty levels change question-by-question depending on your answers.</p>
                    </div>
                  </div>
                </div>

                {/* Mock Mode */}
                <div 
                  onClick={() => setExamType("mock")}
                  className={`p-5 rounded-2xl border cursor-pointer select-none transition-all duration-300 hover:border-primary/50 ${
                    examType === "mock" ? "border-2 border-primary bg-primary/5 shadow-md shadow-primary/5" : "border-border bg-card/40"
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Award className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">Mock Examination</h4>
                      <p className="text-xs text-muted-foreground mt-1">Realistic environment. Mixes difficulties without hints or helps.</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Difficulty and Questions Count */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Difficulty Selection (Hidden or locked for Adaptive/Mock as they auto-adjust) */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" /> Starting Difficulty
                </h3>
                <div className="flex gap-2">
                  {["easy", "medium", "hard"].map(diff => (
                    <button
                      key={diff}
                      type="button"
                      disabled={examType === "mock"}
                      onClick={() => setDifficulty(diff as any)}
                      className={`flex-1 py-3.5 rounded-xl border text-sm font-bold capitalize transition-all duration-300 ${
                        difficulty === diff
                          ? "gradient-primary-bg text-white border-transparent shadow-md shadow-primary/20"
                          : "bg-card border-border hover:border-primary/40 text-foreground"
                      } ${examType === "mock" ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
                {examType === "mock" && (
                  <p className="text-xs text-amber-500 italic">Mock exams use a blended/adaptive mix of difficulties automatically.</p>
                )}
              </div>

              {/* Number of Questions */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-primary" /> Total Questions
                </h3>
                <div className="flex gap-2">
                  {[5, 10, 15, 20].map(count => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setQuestionCount(count)}
                      className={`flex-1 py-3.5 rounded-xl border text-sm font-bold transition-all duration-300 ${
                        questionCount === count
                          ? "gradient-primary-bg text-white border-transparent shadow-md shadow-primary/20"
                          : "bg-card border-border hover:border-primary/40 text-foreground"
                      }`}
                    >
                      {count} Questions
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Submit Action */}
            <div className="flex justify-end pt-4">
              <Button 
                variant="gradient" 
                size="lg" 
                onClick={handleStartExam}
                className="w-full sm:w-60 h-14 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-primary/25"
              >
                <Play className="h-5 w-5 fill-current" /> Start Examination
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* --- VIEW: LOADING --- */}
      {view === "loading" && (
        <div className="glass-card p-16 text-center space-y-6 flex flex-col items-center justify-center min-h-[400px] animate-fade-in">
          <div className="relative">
            <div className="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Brain className="h-8 w-8 text-primary absolute inset-0 m-auto animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">Generating Exam...</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Our AI visualizer is reading your material and designing evaluation questions for you.
            </p>
          </div>
        </div>
      )}

      {/* --- VIEW: ACTIVE EXAM --- */}
      {view === "active" && questions.length > 0 && (
        <div className="space-y-6 animate-fade-in relative">
          
          {/* Top Info Bar */}
          <div className="flex items-center justify-between glass-card p-4 border-l-4 border-l-primary z-10 relative">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-black uppercase tracking-wider rounded-lg">
                Question {currentQuestionIdx + 1} of {questionCount}
              </span>
              {examType === "adaptive" && (
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-black uppercase tracking-wider rounded-lg capitalize">
                  Difficulty: {currentDifficulty}
                </span>
              )}
            </div>
            {examType === "timed" && (
              <div className="flex items-center gap-2 text-foreground font-black text-lg bg-card border border-border/50 px-4 py-1.5 rounded-xl shadow-sm">
                <Timer className={`h-5 w-5 ${timeRemaining < 15 ? "text-red-500 animate-pulse" : "text-primary"}`} />
                <span className={timeRemaining < 15 ? "text-red-500" : ""}>{formatTime(timeRemaining)}</span>
              </div>
            )}
          </div>

          {/* Question Text Box */}
          <div className="glass-card p-8 space-y-6 relative overflow-hidden">
            <h2 className="font-heading font-bold text-foreground text-xl md:text-2xl leading-relaxed">
              {questions[currentQuestionIdx]?.question}
            </h2>
            
            {/* Options grid */}
            <div className="grid grid-cols-1 gap-4">
              {questions[currentQuestionIdx]?.options.map((option, idx) => {
                const isSelected = selectedAnswers[currentQuestionIdx] === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => handleAnswerSelect(idx)}
                    className={`p-5 rounded-2xl border-2 cursor-pointer select-none transition-all duration-300 hover:border-primary/50 flex items-center gap-4 ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                        : "border-border bg-card/30"
                    }`}
                  >
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 border-2 ${
                      isSelected ? "border-primary bg-primary text-white" : "border-muted-foreground/50 text-muted-foreground"
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span className="text-foreground/90 font-medium text-base md:text-lg">{option}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions footer */}
          <div className="flex justify-end">
            <Button
              variant="gradient"
              size="lg"
              onClick={handleNextQuestion}
              disabled={selectedAnswers[currentQuestionIdx] === undefined || adaptiveLoading}
              className="h-14 px-8 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20"
            >
              {adaptiveLoading ? (
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 animate-spin" /> Adapting Next...
                </span>
              ) : currentQuestionIdx === questionCount - 1 ? (
                "Complete & Submit Exam"
              ) : (
                "Next Question"
              )}
            </Button>
          </div>

        </div>
      )}

      {/* --- VIEW: SUBMITTING ANALYTICS --- */}
      {view === "submitting" && (
        <div className="glass-card p-16 text-center space-y-6 flex flex-col items-center justify-center min-h-[400px] animate-fade-in">
          <div className="relative">
            <div className="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Award className="h-8 w-8 text-primary absolute inset-0 m-auto animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">Calculating Analytics...</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              We are saving your records and mapping your subject knowledge breakdown.
            </p>
          </div>
        </div>
      )}

      {/* --- VIEW: RESULTS & ANALYTICS --- */}
      {view === "results" && results && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Summary Card */}
          <div className="glass-card p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 bg-gradient-to-br from-card/90 to-background/50 border-none shadow-xl">
            
            {/* Circular Gauge */}
            <div className="relative h-36 w-36 flex items-center justify-center shrink-0 select-none">
              <svg className="absolute inset-0 transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" className="text-muted/20" fill="transparent" />
                <circle 
                  cx="50" 
                  cy="50" 
                  r="42" 
                  stroke="currentColor" 
                  strokeWidth="8" 
                  className="text-primary" 
                  fill="transparent" 
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - results.accuracy / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="text-center">
                <span className="block font-heading font-black text-3xl text-foreground">{results.score}</span>
                <span className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Correct</span>
              </div>
            </div>

            {/* Metrics */}
            <div className="flex-1 space-y-4 text-center md:text-left">
              <div>
                <h3 className="text-2xl font-black text-foreground">Analysis Summary</h3>
                <p className="text-muted-foreground text-sm">Your exam metrics, strengths, and weaknesses have been computed.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-card/40 border border-border/40 p-3 rounded-2xl text-center">
                  <span className="block text-[10px] text-muted-foreground uppercase font-bold">Accuracy</span>
                  <span className="font-heading font-black text-xl text-primary">{results.accuracy}%</span>
                </div>
                <div className="bg-card/40 border border-border/40 p-3 rounded-2xl text-center">
                  <span className="block text-[10px] text-muted-foreground uppercase font-bold">Duration</span>
                  <span className="font-heading font-black text-xl text-foreground">{results.time_taken_seconds}s</span>
                </div>
                <div className="bg-card/40 border border-border/40 p-3 rounded-2xl text-center col-span-2 sm:col-span-1">
                  <span className="block text-[10px] text-muted-foreground uppercase font-bold">Grade</span>
                  <span className="font-heading font-black text-xl text-emerald-500">
                    {results.accuracy >= 90 ? "A+" : results.accuracy >= 80 ? "A" : results.accuracy >= 70 ? "B" : results.accuracy >= 60 ? "C" : "Needs Work"}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Topics Breakdown & Revision recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Weak Topics */}
            <div className="glass-card p-6 md:p-8 space-y-4">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-destructive" /> Weak Areas
              </h3>
              {results.weak_topics && results.weak_topics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {results.weak_topics.map(topic => (
                    <span key={topic} className="px-3.5 py-1.5 rounded-xl bg-destructive/10 text-destructive text-xs font-black tracking-wider uppercase border border-destructive/20">
                      {topic}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Excellent! No specific weak topics detected. You excelled in all sectors.</p>
              )}
            </div>

            {/* Suggested Revisions */}
            <div className="glass-card p-6 md:p-8 space-y-4">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-emerald-500" /> Suggested Revision
              </h3>
              {results.suggested_revision && results.suggested_revision.length > 0 ? (
                <ul className="space-y-2.5">
                  {results.suggested_revision.map((rev, idx) => (
                    <li key={idx} className="text-sm font-semibold text-foreground/80 flex items-center gap-2.5">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      <span>Review and revise details related to: <strong className="text-primary">{rev}</strong></span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">You are fully prepared! No urgent revisions are recommended right now.</p>
              )}
            </div>

          </div>

          {/* Detailed Question Review */}
          <div className="space-y-6">
            <h3 className="font-heading font-black text-2xl text-foreground">Questions Breakdown</h3>
            {questions.map((q, idx) => {
              const selectedOption = selectedAnswers[idx];
              const isCorrect = selectedOption === q.correct;

              return (
                <div 
                  key={idx}
                  className={`glass-card p-6 md:p-8 border-l-4 space-y-5 shadow-md ${
                    isCorrect ? "border-l-emerald-500" : "border-l-destructive"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                      Question {idx + 1} · {q.topic || "General"} · {q.difficulty}
                    </span>
                    <div className="flex items-center gap-2 shrink-0 font-bold text-sm">
                      {isCorrect ? (
                        <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Correct</span>
                      ) : (
                        <span className="text-destructive flex items-center gap-1"><XCircle className="h-4 w-4" /> Incorrect</span>
                      )}
                    </div>
                  </div>

                  <h4 className="font-heading font-bold text-foreground text-lg leading-relaxed">
                    {q.question}
                  </h4>

                  {/* Options indicators */}
                  <div className="grid grid-cols-1 gap-3">
                    {q.options.map((opt, oIdx) => {
                      const isUserSelection = selectedOption === oIdx;
                      const isCorrectSelection = q.correct === oIdx;

                      let borderClass = "border-border bg-card/30";
                      let indicatorColor = "border-muted-foreground/35 text-muted-foreground";

                      if (isCorrectSelection) {
                        borderClass = "border-emerald-500/40 bg-emerald-500/5";
                        indicatorColor = "border-emerald-500 bg-emerald-500 text-white";
                      } else if (isUserSelection && !isCorrect) {
                        borderClass = "border-destructive/40 bg-destructive/5";
                        indicatorColor = "border-destructive bg-destructive text-white";
                      }

                      return (
                        <div key={oIdx} className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-semibold select-none ${borderClass}`}>
                          <div className={`h-5.5 w-5.5 rounded-full border-2 flex items-center justify-center text-[10px] font-black shrink-0 ${indicatorColor}`}>
                            {String.fromCharCode(65 + oIdx)}
                          </div>
                          <span className="text-foreground/90">{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Explanation Alert Box */}
                  <div className="p-4 rounded-2xl bg-accent/20 border border-accent/20 space-y-1">
                    <h5 className="font-black text-xs text-primary flex items-center gap-1.5 uppercase tracking-wider">
                      <AlertCircle className="h-3.5 w-3.5" /> AI Explanation
                    </h5>
                    <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                      {q.explanation}
                    </p>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Setup Redirect */}
          <div className="flex justify-center pt-4">
            <Button 
              onClick={() => setView("setup")} 
              variant="outline" 
              size="lg" 
              className="px-8 rounded-xl font-bold h-12"
            >
              Start Another Exam
            </Button>
          </div>

        </div>
      )}

      {/* --- VIEW: HISTORY --- */}
      {view === "history" && (
        <div className="space-y-6 animate-fade-in">
          {historyLoading ? (
            <div className="glass-card p-16 text-center space-y-4 flex flex-col items-center justify-center min-h-[300px]">
              <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <p className="text-muted-foreground text-sm font-semibold">Fetching previous exam cards...</p>
            </div>
          ) : historyList.length === 0 ? (
            <div className="glass-card p-12 text-center space-y-4">
              <History className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-foreground font-bold">No exam logs found</p>
              <p className="text-muted-foreground text-sm">Completed exams will write statistics and weakness maps to your dashboard.</p>
              <Button onClick={() => setView("setup")} variant="outline">Take Your First Exam</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {historyList.map((record) => (
                <div 
                  key={record._id}
                  className="glass-card p-6 flex flex-col sm:flex-row items-center justify-between gap-6 hover:border-primary/30 transition-all duration-300 shadow-sm"
                >
                  <div className="flex items-center gap-4 text-left min-w-0">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Award className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-heading font-black text-foreground text-base md:text-lg truncate leading-tight">
                        {record.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-bold">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{new Date(record.timestamp).toLocaleDateString()} · {record.time_taken_seconds}s Taken</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center shrink-0">
                      <span className="block text-[9px] text-muted-foreground uppercase font-black">Score</span>
                      <span className="font-heading font-black text-xl text-primary">{record.score}</span>
                    </div>
                    <div className="text-center shrink-0">
                      <span className="block text-[9px] text-muted-foreground uppercase font-black">Accuracy</span>
                      <span className="font-heading font-black text-xl text-emerald-500">{record.accuracy}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
