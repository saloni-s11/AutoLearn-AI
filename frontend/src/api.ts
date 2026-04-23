const API = "http://localhost:8000";

export const generateLearning = async (formData: FormData) => {
    try {
        const r = await fetch(`${API}/learn`, { method: "POST", body: formData });
        if (!r.ok) {
            const errData = await r.json();
            throw new Error(errData.detail || "Failed to generate learning content");
        }
        return await r.json();
    } catch (e) {
        console.error("API Error:", e);
        return { 
            result: JSON.stringify({ notes: [], quiz: [], flashcards: [] }), 
            vocabulary: [], 
            videos: [], 
            images: [], 
            research: { wiki: `Error: ${e instanceof Error ? e.message : "Connection failed"}`, links: [] } 
        };
    }
};

// 🔊 TTS — returns blob URL for <audio>
export const fetchTTS = async (text: string): Promise<string> => {
    const r = await fetch(`${API}/voice/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });
    if (!r.ok) throw new Error(`TTS failed: ${r.status}`);
    const blob = await r.blob();
    return URL.createObjectURL(blob);
};

// 🎥 Video summary
export const summarizeVideo = async (input: { video_id?: string; url?: string }) => {
    const r = await fetch(`${API}/video/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        throw new Error(errData.detail || `Summary failed: ${r.status}`);
    }
    return r.json() as Promise<{ video_id: string; summary: string; key_points: string[] }>;
};

// 🧠 Exam
export type ExamType = "practice" | "timed" | "adaptive" | "topic" | "mock";
export type Difficulty = "easy" | "medium" | "hard";
export interface ExamQuestion {
    question: string;
    options: string[];
    correct: number;
    explanation: string;
    topic: string;
    difficulty: Difficulty;
}

export const fetchExamHistory = async () => {
    const token = localStorage.getItem("study_token");
    const r = await fetch(`${API}/exam/history`, {
        headers: { "Authorization": `Bearer ${token}` }
    });
    if (!r.ok) throw new Error("Failed to fetch exam history");
    return r.json();
};

export const generateExam = async (body: {
    content: string;
    exam_type: ExamType;
    difficulty: Difficulty;
    number_of_questions: number;
    topic?: string;
}) => {
    const r = await fetch(`${API}/exam/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Exam gen failed: ${r.status}`);
    return r.json() as Promise<{ exam_type: ExamType; difficulty: Difficulty; questions: ExamQuestion[] }>;
};

export const adaptiveNext = async (body: {
    content: string;
    current_difficulty: Difficulty;
    last_correct: boolean;
    asked_questions: string[];
}) => {
    const r = await fetch(`${API}/exam/adaptive/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Adaptive failed: ${r.status}`);
    return r.json() as Promise<{ difficulty: Difficulty; question: ExamQuestion }>;
};

export const examAnalytics = async (body: {
    answers: Array<{ question: string; topic: string; correct: boolean; time_taken: number }>;
    duration_seconds: number;
    title?: string;
}) => {
    const token = localStorage.getItem("study_token");
    const r = await fetch(`${API}/exam/analytics`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Analytics failed: ${r.status}`);
    return r.json();
};

export const createShare = async (title: string, data: any) => {
    const r = await fetch(`${API}/share/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, data }),
    });
    if (!r.ok) throw new Error("Failed to create share link");
    return r.json() as Promise<{ share_id: string; share_url: string }>;
};

export const fetchSharedContent = async (share_id: string) => {
    const r = await fetch(`${API}/share/${share_id}`);
    if (!r.ok) throw new Error("Shared content not found");
    return r.json();
};

export const generateMindMap = async (content: string) => {
    const r = await fetch(`${API}/mindmap/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
    });
    if (!r.ok) throw new Error("Failed to generate mind map");
    return r.json();
};
