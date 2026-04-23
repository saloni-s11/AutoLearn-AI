import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchSharedContent } from "@/api";
import { Loader2, BookOpen, Brain, Layers, MessageSquare, Compass, Video, Globe, Sparkles, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotesTab from "@/components/learning/NotesTab";
import QuizTab from "@/components/learning/QuizTab";
import FlashcardsTab from "@/components/learning/FlashcardsTab";
import GlossaryTab from "@/components/learning/GlossaryTab";
import MultimediaTab from "@/components/learning/MultimediaTab";

export default function SharedPage() {
  const { share_id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("notes");

  useEffect(() => {
    const loadShared = async () => {
      try {
        const res = await fetchSharedContent(share_id!);
        setData(res);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadShared();
  }, [share_id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-slate-400 font-medium">Loading shared study suite...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white gap-6 text-center p-6">
        <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <BookOpen className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">Content Not Found</h2>
          <p className="text-slate-400 max-w-sm">This shared link may have expired or is incorrect.</p>
        </div>
        <Button onClick={() => navigate("/")} variant="outline" className="rounded-2xl gap-2">
          <Home className="h-4 w-4" /> Go to AutoLearn AI
        </Button>
      </div>
    );
  }

  const sessionData = data.data;
  const tabs = [
    { id: "notes", label: "Notes", emoji: "📘" },
    { id: "quiz", label: "Quiz", emoji: "🧠" },
    { id: "glossary", label: "Glossary", emoji: "📚" },
    { id: "flashcards", label: "Flashcards", emoji: "🎴" },
    { id: "multimedia", label: "Multimedia", emoji: "🎨" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-32">
      {/* Header */}
      <div className="border-b border-white/5 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Shared with AutoLearn AI</span>
            </div>
            <h1 className="text-2xl font-black truncate">{data.title}</h1>
          </div>
          <Button onClick={() => navigate("/")} variant="gradient" className="rounded-2xl gap-2 font-bold shadow-xl shadow-primary/20">
            Create Your Own ✨
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-8 mt-8">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all duration-300 ${
                activeTab === tab.id
                  ? "gradient-primary-bg text-primary-foreground shadow-lg shadow-primary/20 scale-105"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800 border border-white/5"
              }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="animate-fade-in" key={activeTab}>
          {activeTab === "notes" && <NotesTab notes={sessionData.notes || []} />}
          {activeTab === "quiz" && <QuizTab quiz={sessionData.quiz || []} />}
          {activeTab === "glossary" && <GlossaryTab vocabulary={sessionData.vocabulary || []} />}
          {activeTab === "flashcards" && <FlashcardsTab flashcards={sessionData.flashcards || []} />}
          {activeTab === "multimedia" && (
             <div className="space-y-8">
                <section className="space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-2"><Compass className="h-5 w-5 text-emerald-400" /> Visual Context</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {sessionData.images?.map((img: any, idx: number) => (
                      <img key={idx} src={img.url} className="rounded-2xl aspect-video object-cover border border-white/5 shadow-lg" alt={img.alt} />
                    ))}
                  </div>
                </section>
                <section className="space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-2"><Video className="h-5 w-5 text-red-500" /> Recommended Videos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {sessionData.videos?.map((vid: any, idx: number) => (
                      <a key={idx} href={`https://youtube.com/watch?v=${vid.id}`} target="_blank" rel="noreferrer" className="glass-card group block overflow-hidden shadow-lg border border-white/5">
                        <img src={vid.thumbnail} className="aspect-video object-cover w-full group-hover:scale-105 transition-transform" alt="thumb" />
                        <div className="p-4">
                          <h4 className="font-bold text-sm line-clamp-2">{vid.title}</h4>
                        </div>
                      </a>
                    ))}
                  </div>
                </section>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
