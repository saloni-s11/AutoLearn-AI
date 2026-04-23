import { useState, useMemo } from "react";
import { CheckCircle, XCircle, Brain, Target, Zap, Rocket, Loader2, ArrowRight } from "lucide-react";
import { submitEvaluation, generateRoadmap } from "@/api";
import { Button } from "../ui/button";
import { toast } from "sonner";

interface QuizItem {
  question: string;
  options: string[];
  correct: number;
  level?: number;
  sub_topic?: string;
}

interface QuizTabProps {
  quiz: QuizItem[];
  topic: string;
  onNavigateToRoadmap?: () => void;
}

export default function QuizTab({ quiz, topic, onNavigateToRoadmap }: QuizTabProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [userAnswers, setUserAnswers] = useState<any[]>([]);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);

  if (!quiz || quiz.length === 0) {
    return (
      <div className="glass-card p-12 text-center space-y-4 animate-fade-in">
        <p className="text-muted-foreground">No quiz available for this session.</p>
      </div>
    );
  }

  const q = quiz[currentQ];
  
  // Robustly handle 'correct' if it's a string ("0", "A", etc.)
  const correctIdx = useMemo(() => {
    if (typeof q.correct === 'number') return q.correct;
    if (typeof q.correct === 'string') {
      const val = q.correct.toUpperCase();
      if (val === 'A') return 0;
      if (val === 'B') return 1;
      if (val === 'C') return 2;
      if (val === 'D') return 3;
      const parsed = parseInt(val);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }, [q]);

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    
    const isCorrect = idx === correctIdx;
    if (isCorrect) setScore(s => s + 1);
    setAnswered(a => a + 1);
    
    setUserAnswers(prev => [...prev, {
      question: q.question,
      selected: idx,
      correct: correctIdx,
      level: q.level || 1,
      sub_topic: q.sub_topic || "General"
    }]);
  };

  const nextQuestion = async () => {
    if (currentQ < quiz.length - 1) {
      setSelected(null);
      setCurrentQ(c => c + 1);
    } else {
      setShowResults(true);
      await handleEvaluationSubmit();
    }
  };

  const [roadmap, setRoadmap] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEvaluationSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      // 1. Submit Evaluation
      console.log("Submitting evaluation with results:", userAnswers);
      const evalData = await submitEvaluation(userAnswers, topic);
      setEvaluation(evalData);
      
      // 2. Automatically generate Roadmap using the evaluation context
      setIsGeneratingRoadmap(true);
      const roadmapData = await generateRoadmap(
        evalData.summary, 
        evalData.scores, 
        evalData.gaps, 
        evalData.topic
      );
      setRoadmap(roadmapData);
      localStorage.setItem("last_roadmap", JSON.stringify(roadmapData));
      localStorage.setItem("last_eval_data", JSON.stringify({
        summary: evalData.summary,
        scores: evalData.scores,
        gaps: evalData.gaps,
        topic: evalData.topic
      }));
      
      toast.success("Cognitive roadmap synthesized!");
    } catch (err: any) {
      console.error("Audit Flow Failed:", err);
      setError(err.message || "An unexpected error occurred during analysis.");
      toast.error("Analysis Pipeline Interrupted");
    } finally {
      setIsSubmitting(false);
      setIsGeneratingRoadmap(false);
    }
  };

  const restartQuiz = () => {
    setCurrentQ(0);
    setSelected(null);
    setScore(0);
    setAnswered(0);
    setShowResults(false);
    setUserAnswers([]);
    setEvaluation(null);
    setRoadmap(null);
    setError(null);
  };

  if (showResults) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="glass-card p-12 text-center space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 gradient-primary-bg opacity-50" />
          
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-foreground">Diagnostic Complete</h2>
            <p className="text-muted-foreground">Comprehensive Cognitive Analysis</p>
          </div>

          {error && (
            <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive font-bold animate-shake">
              <div className="flex items-center justify-center gap-2 mb-2">
                <XCircle className="h-6 w-6" /> Error Detected
              </div>
              <p className="text-sm opacity-80">{error}</p>
              <Button variant="outline" className="mt-4" onClick={handleEvaluationSubmit}>
                Retry Analysis 🔄
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 border-b-4 border-b-blue-500">
              <Target className="h-8 w-8 text-blue-500 mx-auto mb-3" />
              <div className="text-3xl font-bold">{Math.round((score/quiz.length) * 100)}%</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Accuracy</div>
            </div>
            <div className="glass-card p-6 border-b-4 border-b-purple-500">
              <Zap className="h-8 w-8 text-purple-500 mx-auto mb-3" />
              <div className="text-3xl font-bold">{score}/{quiz.length}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Total Score</div>
            </div>
            <div className="glass-card p-6 border-b-4 border-b-emerald-500">
              <Brain className="h-8 w-8 text-emerald-500 mx-auto mb-3" />
              <div className="text-3xl font-bold">{evaluation ? "Analyzed" : isSubmitting ? "..." : "Pending"}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Intelligence</div>
            </div>
          </div>

          {evaluation && evaluation.summary && (
            <div className="glass-card p-8 bg-primary/5 border-primary/20 animate-slide-up">
              <h4 className="font-bold text-lg mb-2 flex items-center justify-center gap-2">
                 Mental Capacity Summary 🧠
              </h4>
              <p className="text-muted-foreground italic leading-relaxed text-lg max-w-2xl mx-auto">
                "{evaluation.summary}"
              </p>
              
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                 <Button 
                    variant="gradient" 
                    size="xl" 
                    className="rounded-2xl shadow-xl shadow-primary/20 group"
                    disabled={isGeneratingRoadmap || !roadmap}
                    onClick={() => {
                        if (onNavigateToRoadmap) onNavigateToRoadmap();
                    }}
                 >
                    {isGeneratingRoadmap ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                        <>
                            View Personalized Roadmap
                            <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                 </Button>
                 <Button variant="outline" size="lg" onClick={restartQuiz} className="rounded-2xl">
                    Try Again 🔄
                 </Button>
              </div>
            </div>
          )}

          {(isSubmitting || isGeneratingRoadmap) && (
            <div className="flex flex-col items-center gap-6 py-12 animate-pulse">
              <div className="relative">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
                <Brain className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="space-y-2 text-center">
                <p className="font-black text-primary tracking-widest uppercase text-sm">
                  {isSubmitting ? "Deep Cognitive Analysis in Progress" : "Synthesizing Roadmap Path..."}
                </p>
                <p className="text-xs text-muted-foreground animate-bounce">Consulting the AI Neural Engine...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 shadow-md border-l-4 border-l-primary">
        <div className="flex justify-between text-sm mb-3">
          <div className="flex flex-col">
            <span className="text-muted-foreground font-bold uppercase tracking-tighter text-xs">DIAGNOSTIC PROGRESS</span>
            <span className="font-heading font-black text-xl">QUESTION {currentQ + 1} / {quiz.length}</span>
          </div>
          <div className="text-right">
             <div className="flex items-center gap-1 text-primary font-black text-xl">
                <Target className="h-5 w-5" /> {score}/{answered}
             </div>
             {q.level && (
               <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                 LEVEL {q.level}: {q.level === 1 ? 'Foundational' : q.level === 2 ? 'Analytical' : 'Cognitive'}
               </span>
             )}
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-3">
          <div
            className="bg-primary rounded-full h-3 transition-all duration-700 shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
            style={{ width: `${((currentQ + 1) / quiz.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="glass-card p-10 animate-fade-in shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
           <Brain className="h-32 w-32" />
        </div>
        
        <div className="mb-2">
            <span className="text-primary font-bold text-xs uppercase tracking-[0.2em]">{q.sub_topic || "GENERAL CONCEPT"}</span>
        </div>
        <h3 className="font-heading font-bold text-foreground text-3xl mb-10 leading-tight">{q.question}</h3>
        
        <div className="grid grid-cols-1 gap-5">
          {q.options.map((opt, i) => {
            let classes = "glass-card p-6 cursor-pointer transition-all duration-300 flex items-center gap-5 text-left border-2 group relative";
            if (selected !== null) {
              if (i === correctIdx) classes += " border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 scale-[1.02]";
              else if (i === selected) classes += " border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/10";
              else classes += " opacity-50 border-border";
            } else {
              classes += " border-transparent hover:border-primary/40 hover:bg-accent/50 hover:translate-x-2";
            }

            return (
              <div key={i} onClick={() => handleSelect(i)} className={classes}>
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black transition-all ${
                  selected !== null && i === correctIdx ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" :
                  selected === i ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30" :
                  "bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground"
                }`}>
                  {selected !== null && i === correctIdx ? <CheckCircle className="h-6 w-6" /> :
                   selected === i ? <XCircle className="h-6 w-6" /> :
                   String.fromCharCode(65 + i)}
                </div>
                <div className="flex-1">
                   <span className="block text-xl font-semibold text-foreground">{opt}</span>
                   {selected !== null && i === correctIdx && (
                      <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest mt-1 block">Correct Answer</span>
                   )}
                   {selected === i && i !== correctIdx && (
                      <span className="text-xs font-bold text-rose-600 uppercase tracking-widest mt-1 block">Your Choice</span>
                   )}
                </div>
              </div>
            );
          })}
        </div>

        {selected !== null && (
          <div className="mt-12 flex justify-end animate-slide-up">
            <button
              onClick={nextQuestion}
              className="px-12 py-5 rounded-2xl gradient-primary-bg text-primary-foreground font-black text-xl shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              {currentQ < quiz.length - 1 ? "Next Question →" : "Generate Analysis ✨"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

