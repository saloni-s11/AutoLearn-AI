import { useState, useMemo, useEffect } from "react";
import { BookOpen, Brain, Layers, MessageSquare, Video, Globe, Link as LinkIcon, Compass, Map } from "lucide-react";
import NotesTab from "@/components/learning/NotesTab";
import QuizTab from "@/components/learning/QuizTab";
import FlashcardsTab from "@/components/learning/FlashcardsTab";
import GlossaryTab from "@/components/learning/GlossaryTab";
import ChatTab from "@/components/learning/ChatTab";
import RoadmapTab from "@/components/learning/RoadmapTab";
import { useStudy } from "@/context/StudyContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const tabs = [
  { id: "notes", label: "Notes", icon: BookOpen, emoji: "📘" },
  { id: "quiz", label: "Quiz", icon: Brain, emoji: "🧠" },
  { id: "roadmap", label: "Roadmap", icon: Map, emoji: "🗺️" },
  { id: "glossary", label: "Glossary", icon: BookOpen, emoji: "📚" },
  { id: "flashcards", label: "Flashcards", icon: Layers, emoji: "🎴" },
  { id: "multimedia", label: "Multimedia", icon: Compass, emoji: "🎨" },
  { id: "chat", label: "Chat", icon: MessageSquare, emoji: "💬" },
];

export default function LearningPage() {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const topicParam = searchParams.get("topic");

  // If we arrived via a "Start Learning" button from Roadmap, 
  // default to the multimedia tab.
  const [activeTab, setActiveTab] = useState(topicParam ? "multimedia" : "notes");
  const { currentSession } = useStudy();

  const studyData = useMemo(() => {
    if (!currentSession?.data?.result) return null;
    try {
      return JSON.parse(currentSession.data.result);
    } catch (e) {
      console.error("Failed to parse study data", e);
      return null;
    }
  }, [currentSession]);

  // Special handling for topical/quick sessions (from Roadmap)
  const quickTopicData = useMemo(() => {
    if (currentSession) return null;
    if (!topicParam) return null;
    return {
      topic: topicParam,
      isQuick: true
    };
  }, [currentSession, topicParam]);

  if (!currentSession && !quickTopicData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center p-6 animate-fade-in">
        <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center">
          <BookOpen className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">No active session</h2>
          <p className="text-muted-foreground max-w-xs mx-auto">
            Upload some material or pick a lesson from your history to start learning.
          </p>
        </div>
        <Button onClick={() => navigate("/upload")} variant="gradient" size="lg">
          Start Learning ✨
        </Button>
      </div>
    );
  }

  // Define effective session for UI (real session or quick topic)
  const [quickEnrichment, setQuickEnrichment] = useState<any>(null);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);

  useEffect(() => {
    if (quickTopicData && !quickEnrichment && !enrichmentLoading) {
      const fetchEnrichment = async () => {
        setEnrichmentLoading(true);
        try {
          const response = await fetch(`/api/research/search?q=${encodeURIComponent(quickTopicData.topic)}`);
          const data = await response.json();
          // Also fetch youtube videos for the quick topic
          // Since we don't have a direct youtube endpoint for this yet, 
          // we'll just use the papers for now or I can add a quick one.
          setQuickEnrichment({
            research: { papers: data.papers || [] },
            videos: [] // Can expand this later
          });
        } catch (e) {
          console.error("Quick Enrichment Failed", e);
        } finally {
          setEnrichmentLoading(false);
        }
      };
      fetchEnrichment();
    }
  }, [quickTopicData, quickEnrichment, enrichmentLoading]);

  const displaySession = currentSession || {
     data: { 
        topic: topicParam, 
        isQuick: true,
        research: quickEnrichment?.research || { papers: [] },
        videos: quickEnrichment?.videos || []
     },
     title: topicParam || "Quick Mastery"
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 pb-32">
      <div className="animate-slide-up flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Layers className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-widest">{currentSession.type}</span>
          </div>
          <h1 className="font-heading text-4xl font-bold text-foreground truncate max-w-xl">
            {currentSession.title}
          </h1>
          <p className="text-muted-foreground mt-1">Generated AI Study Suite · {currentSession.timestamp}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 animate-slide-up no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all duration-300 ${
              activeTab === tab.id
                ? "gradient-primary-bg text-primary-foreground shadow-lg shadow-primary/20 scale-105"
                : "bg-card/50 text-muted-foreground hover:bg-accent border border-border/50"
            }`}
          >
            <span>{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in transition-all duration-500" key={activeTab}>
        {activeTab === "notes" && <NotesTab notes={studyData?.notes || []} />}
        {activeTab === "quiz" && (
          <QuizTab 
            quiz={studyData?.quiz || []} 
            topic={currentSession.title} 
            onNavigateToRoadmap={() => setActiveTab("roadmap")}
          />
        )}
        {activeTab === "roadmap" && (
          <RoadmapTab onNavigateToMultimedia={() => setActiveTab("multimedia")} />
        )}
        {activeTab === "glossary" && <GlossaryTab vocabulary={currentSession.data.vocabulary || []} />}
        {activeTab === "flashcards" && <FlashcardsTab flashcards={studyData?.flashcards || []} />}
        
        {activeTab === "multimedia" && (
          <div className="space-y-12">
            {/* Visual Aids */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Compass className="h-5 w-5 text-emerald-400" />
                <h3 className="text-xl font-bold text-foreground">Visual Context</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {currentSession.data.images?.map((img: any, idx: number) => (
                  <div key={idx} className="group relative rounded-2xl overflow-hidden glass-card aspect-video border-none shadow-lg">
                    <img src={img.url} alt={img.alt} className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex items-end">
                      <p className="text-[10px] text-white font-medium truncate">{img.alt}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Video Vault */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Video className="h-5 w-5 text-red-500" />
                <h3 className="text-xl font-bold text-foreground">Guided Video Tutorials</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentSession.data.videos?.map((vid: any, idx: number) => (
                  <a key={idx} href={`https://youtube.com/watch?v=${vid.id}`} target="_blank" rel="noreferrer" className="glass-card overflow-hidden group hover:border-primary/50 transition-all shadow-lg pb-4">
                     <div className="relative aspect-video">
                        <img src={vid.thumbnail} className="object-cover w-full h-full" alt="thumb" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                           <div className="h-12 w-12 rounded-full bg-primary/90 flex items-center justify-center text-white">
                              <Video className="h-6 w-6" />
                           </div>
                        </div>
                     </div>
                     <div className="p-4">
                        <h4 className="font-bold text-sm text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                           {vid.title}
                        </h4>
                     </div>
                  </a>
                ))}
              </div>
            </section>

             {/* Research Links */}
             <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-sky-400" />
                <h3 className="text-xl font-bold text-foreground">Research & Web Grounding</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {currentSession.data.research?.wiki && (
                  <div className="glass-card p-6 border-l-4 border-l-primary shadow-lg">
                    <h4 className="font-bold flex items-center gap-2 mb-3 text-foreground">
                      <BookOpen className="h-4 w-4 text-primary" /> Wikipedia Context
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed italic">"{currentSession.data.research.wiki}"</p>
                  </div>
                )}
                <div className="space-y-3">
                  {currentSession.data.research?.links?.map((link: any, idx: number) => (
                    <a key={idx} href={link.url} target="_blank" rel="noreferrer" className="glass-card p-4 flex items-center justify-between group hover:bg-accent/50 shadow-md">
                      <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate pr-4">{link.title}</span>
                      <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </div>
            </section>

            {/* Academic Papers */}
            <section className="space-y-4">
               <div className="flex items-center gap-3">
                 <Layers className="h-5 w-5 text-amber-500" />
                 <h3 className="text-xl font-bold text-foreground">Academic Research Vault</h3>
               </div>
               <div className="grid grid-cols-1 gap-4">
                  {currentSession.data.research?.papers?.map((paper: any, idx: number) => (
                    <a key={idx} href={paper.url} target="_blank" rel="noreferrer" className="glass-card p-6 flex flex-col gap-2 hover:border-amber-500/50 transition-all group">
                       <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Scientific Paper</span>
                          <Globe className="h-4 w-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                       </div>
                       <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">{paper.title}</h4>
                       <p className="text-xs text-muted-foreground line-clamp-2">{paper.snippet}</p>
                    </a>
                  ))}
                  {(!currentSession.data.research?.papers || currentSession.data.research.papers.length === 0) && (
                    <p className="text-sm text-muted-foreground italic">Searching for peer-reviewed citations...</p>
                  )}
               </div>
            </section>
          </div>
        )}

        {activeTab === "chat" && <ChatTab />}
      </div>
    </div>
  );
}

