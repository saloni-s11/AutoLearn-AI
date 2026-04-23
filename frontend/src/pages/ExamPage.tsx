import { useEffect, useMemo, useRef, useState } from "react";
import {
    generateExam, adaptiveNext, examAnalytics,
    type ExamQuestion, type ExamType, type Difficulty,
} from "@/api";

const EXAM_TYPES: { value: ExamType; label: string; desc: string }[] = [
    { value: "practice", label: "Practice", desc: "No timer, instant feedback" },
    { value: "timed", label: "Timed", desc: "Countdown, auto-submit" },
    { value: "adaptive", label: "Adaptive", desc: "Difficulty adjusts to you" },
    { value: "topic", label: "Topic", desc: "Single chapter focus" },
    { value: "mock", label: "Mock", desc: "Real exam simulation" },
];

import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import PerformanceChart from "@/components/learning/PerformanceChart";

export default function ExamPage() {
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [content, setContent] = useState("");
    const [topic, setTopic] = useState("");
    const [examType, setExamType] = useState<ExamType>("practice");
    const [difficulty, setDifficulty] = useState<Difficulty>("medium");
    const [numQ, setNumQ] = useState(10);
    const [duration, setDuration] = useState(10); // minutes for timed/mock

    const [phase, setPhase] = useState<"setup" | "running" | "results">("setup");
    const [questions, setQuestions] = useState<ExamQuestion[]>([]);
    const [idx, setIdx] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);
    const [answers, setAnswers] = useState<Array<{ question: string; topic: string; correct: boolean; time_taken: number }>>([]);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const startedAtRef = useRef<number>(0);
    const qStartRef = useRef<number>(0);
    const [adaptiveDiff, setAdaptiveDiff] = useState<Difficulty>("medium");
    const [analytics, setAnalytics] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const isTimed = examType === "timed" || examType === "mock";
    const showInstantFeedback = examType === "practice" || examType === "adaptive" || examType === "topic";

    useEffect(() => {
        if (phase !== "running" || !isTimed) return;
        if (secondsLeft <= 0) { void submit(); return; }
        const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [secondsLeft, phase, isTimed]);

    const startExam = async () => {
        if (content.trim().length < 20) { alert("Paste study content (min 20 chars)"); return; }
        setLoading(true);
        try {
            if (examType === "adaptive") {
                const first = await adaptiveNext({ content, current_difficulty: difficulty, last_correct: true, asked_questions: [] });
                setQuestions([first.question]);
                setAdaptiveDiff(first.difficulty);
            } else {
                const res = await generateExam({
                    content,
                    exam_type: examType,
                    difficulty,
                    number_of_questions: examType === "mock" ? Math.max(15, numQ) : numQ,
                    topic: examType === "topic" ? topic : undefined,
                });
                setQuestions(res.questions);
            }
            setIdx(0); setSelected(null); setAnswers([]);
            setPhase("running");
            startedAtRef.current = Date.now();
            qStartRef.current = Date.now();
            if (isTimed) setSecondsLeft(duration * 60);
        } catch (e: any) { alert(e.message); }
        finally { setLoading(false); }
    };

    const recordAnswer = (chosen: number) => {
        const q = questions[idx];
        const time_taken = Math.round((Date.now() - qStartRef.current) / 1000);
        const correct = chosen === q.correct;
        setAnswers(a => [...a, { question: q.question, topic: q.topic, correct, time_taken }]);
        return { correct, q };
    };

    const handleSelect = async (chosen: number) => {
        if (selected !== null) return;
        setSelected(chosen);
        const { correct, q } = recordAnswer(chosen);

        if (examType === "adaptive") {
            // Generate next adaptive question after short delay
            setTimeout(async () => {
                if (answers.length + 1 >= numQ) { void submit(); return; }
                try {
                    const next = await adaptiveNext({
                        content,
                        current_difficulty: adaptiveDiff,
                        last_correct: correct,
                        asked_questions: questions.map(x => x.question),
                    });
                    setQuestions(qs => [...qs, next.question]);
                    setAdaptiveDiff(next.difficulty);
                    setIdx(i => i + 1);
                    setSelected(null);
                    qStartRef.current = Date.now();
                } catch (e: any) { alert(e.message); }
            }, showInstantFeedback ? 1500 : 300);
        }
    };

    const next = () => {
        if (idx + 1 >= questions.length) { void submit(); return; }
        setIdx(i => i + 1); setSelected(null); qStartRef.current = Date.now();
    };

    const submit = async () => {
        const duration_seconds = Math.round((Date.now() - startedAtRef.current) / 1000);
        try {
            const title = examType === "topic" ? `Topic: ${topic}` : `${examType.charAt(0).toUpperCase() + examType.slice(1)} Exam`;
            const a = await examAnalytics({ 
                answers, 
                duration_seconds,
                title: title
            });
            setAnalytics(a);
            setPhase("results");
        } catch (e: any) { alert(e.message); }
    };

    const retryWeak = async () => {
        if (!analytics?.weak_topics?.length) return;
        setExamType("topic"); setTopic(analytics.weak_topics[0]);
        setPhase("setup");
    };

    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

    // ---------- RENDER ----------
    if (phase === "setup") {
        return (
            <div className="max-w-3xl mx-auto p-8 space-y-8">
                <div className="flex items-end justify-between">
                    <h1 className="text-4xl font-bold">🧠 Exam Mode</h1>
                    <button 
                        onClick={() => setShowAnalytics(!showAnalytics)}
                        className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors bg-primary/5 px-4 py-2 rounded-xl border border-primary/10"
                    >
                        <BarChart3 className="h-4 w-4" />
                        {showAnalytics ? "Hide Exam Analysis" : "Show Previous Exam Analysis"}
                        {showAnalytics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                </div>

                {showAnalytics && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                        <PerformanceChart />
                    </div>
                )}

                <div className="glass-card p-6 space-y-4">
                    <label className="block">
                        <span className="font-semibold">Study content</span>
                        <textarea value={content} onChange={e => setContent(e.target.value)}
                            rows={6} className="w-full mt-2 p-3 rounded-xl border bg-background"
                            placeholder="Paste notes, chapter text, or topic summary..." />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        {EXAM_TYPES.map(t => (
                            <button key={t.value} onClick={() => setExamType(t.value)}
                                className={`p-4 rounded-xl border-2 text-left ${examType === t.value ? "border-primary bg-primary/10" : "border-border"}`}>
                                <div className="font-bold">{t.label}</div>
                                <div className="text-xs text-muted-foreground">{t.desc}</div>
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label>Difficulty
                            <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}
                                className="w-full mt-1 p-2 rounded-lg border bg-background">
                                <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                            </select>
                        </label>
                        <label># Questions
                            <input type="number" min={1} max={30} value={numQ}
                                onChange={e => setNumQ(+e.target.value)}
                                className="w-full mt-1 p-2 rounded-lg border bg-background" />
                        </label>
                    </div>

                    {isTimed && (
                        <label>Duration (min)
                            <select value={duration} onChange={e => setDuration(+e.target.value)}
                                className="w-full mt-1 p-2 rounded-lg border bg-background">
                                <option value={5}>5</option><option value={10}>10</option>
                                <option value={20}>20</option><option value={30}>30</option>
                            </select>
                        </label>
                    )}

                    {examType === "topic" && (
                        <label>Topic / chapter
                            <input value={topic} onChange={e => setTopic(e.target.value)}
                                className="w-full mt-1 p-2 rounded-lg border bg-background"
                                placeholder="e.g. Photosynthesis" />
                        </label>
                    )}

                    <button onClick={startExam} disabled={loading}
                        className="w-full py-3 rounded-2xl gradient-primary-bg text-primary-foreground font-bold">
                        {loading ? "Generating..." : "Start Exam"}
                    </button>
                </div>
            </div>
        );
    }

    if (phase === "running") {
        const q = questions[idx];
        return (
            <div className="max-w-3xl mx-auto p-8 space-y-6">
                <div className="flex justify-between items-center">
                    <span className="font-semibold">Question {idx + 1}{examType !== "adaptive" && ` / ${questions.length}`}</span>
                    {isTimed && <span className="font-mono text-lg px-3 py-1 rounded-lg bg-primary/10 text-primary">⏱ {fmt(secondsLeft)}</span>}
                    {examType === "adaptive" && <span className="text-xs px-2 py-1 rounded bg-primary/10">Difficulty: {adaptiveDiff}</span>}
                </div>

                <div className="glass-card p-6 space-y-4">
                    <p className="text-lg font-semibold">{q.question}</p>
                    <div className="space-y-2">
                        {q.options.map((opt, i) => {
                            const isSel = selected === i;
                            const isCorrect = i === q.correct;
                            const showColor = showInstantFeedback && selected !== null;
                            const cls = showColor
                                ? isCorrect ? "border-green-500 bg-green-500/10"
                                    : isSel ? "border-red-500 bg-red-500/10" : "border-border"
                                : isSel ? "border-primary bg-primary/10" : "border-border hover:bg-muted";
                            return (
                                <button key={i} onClick={() => handleSelect(i)} disabled={selected !== null}
                                    className={`w-full text-left p-3 rounded-xl border-2 ${cls}`}>
                                    {opt}
                                </button>
                            );
                        })}
                    </div>

                    {showInstantFeedback && selected !== null && (
                        <div className="p-3 rounded-lg bg-muted text-sm">
                            <strong>Explanation:</strong> {q.explanation}
                        </div>
                    )}
                </div>

                <div className="flex justify-between">
                    <button onClick={submit} className="px-4 py-2 rounded-xl border">Submit early</button>
                    {examType !== "adaptive" && (
                        <button onClick={next} disabled={selected === null && showInstantFeedback}
                            className="px-6 py-2 rounded-xl gradient-primary-bg text-primary-foreground font-bold">
                            {idx + 1 >= questions.length ? "Finish" : "Next →"}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // results
    return (
        <div className="max-w-3xl mx-auto p-8 space-y-6">
            <h1 className="text-4xl font-bold">📊 Results</h1>
            <div className="glass-card p-6 grid grid-cols-3 gap-4 text-center">
                <Stat label="Score" value={analytics.score} />
                <Stat label="Accuracy" value={`${analytics.accuracy}%`} />
                <Stat label="Time" value={fmt(analytics.time_taken_seconds)} />
            </div>

            {analytics.weak_topics?.length > 0 && (
                <div className="glass-card p-6">
                    <h3 className="font-bold mb-2">Weak topics</h3>
                    <div className="flex flex-wrap gap-2">
                        {analytics.weak_topics.map((t: string) => (
                            <span key={t} className="px-3 py-1 rounded-lg bg-destructive/10 text-destructive text-sm">{t}</span>
                        ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">Suggested revision: {analytics.suggested_revision.join(", ")}</p>
                </div>
            )}

            <div className="flex gap-3">
                <button onClick={() => setPhase("setup")} className="px-5 py-2 rounded-xl border">New exam</button>
                {analytics.weak_topics?.length > 0 && (
                    <button onClick={retryWeak} className="px-5 py-2 rounded-xl gradient-primary-bg text-primary-foreground font-bold">
                        Retry weak topics
                    </button>
                )}
                <button onClick={startExam} className="px-5 py-2 rounded-xl border">Generate similar</button>
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-3xl font-bold text-primary">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
        </div>
    );
}
