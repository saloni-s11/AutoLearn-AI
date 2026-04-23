import { useState } from "react";
import { Map, Search, Sparkles, Rocket, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateRoadmap } from "@/api";
import { toast } from "sonner";
import RoadmapTab from "@/components/learning/RoadmapTab";

export default function RoadmapPage() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [roadmapData, setRoadmapData] = useState<any>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    try {
      // For topical roadmap without a previous evaluation, 
      // we'll send a special flag or just the topic.
      // Since our current backend endpoint /generate-personalized-roadmap 
      // expects an evaluation_id, we might need a new endpoint or 
      // modify the existing one.
      
      // Let's assume we want a quick roadmap based on just the topic.
      // I will add an endpoint /generate-topical-roadmap for this.
      
      const token = localStorage.getItem("study_token");
      const formData = new FormData();
      formData.append("topic", topic);

      const response = await fetch("/api/generate-topical-roadmap", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      setRoadmapData(data);
      toast.success("Roadmap generated successfully!");
    } catch (err) {
      toast.error("Failed to generate roadmap. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-12 pb-32">
      {!roadmapData ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center animate-fade-in">
          <div className="space-y-4">
            <div className="h-20 w-20 rounded-3xl gradient-primary-bg shadow-2xl flex items-center justify-center mx-auto animate-pulse">
               <Map className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-foreground tracking-tight">
              Personalized <span className="gradient-text">Learning Path</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto italic">
              "Enter any topic, and our AI Architect will build a custom mastery roadmap with prerequisites and milestones."
            </p>
          </div>

          <form onSubmit={handleGenerate} className="w-full max-w-2xl relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex flex-col md:flex-row gap-4 p-2 bg-card border border-border/50 rounded-[2rem] shadow-2xl">
               <div className="flex-1 relative">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
                  <input 
                    type="text" 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="What do you want to master today?"
                    className="w-full h-16 bg-transparent border-none focus:ring-0 pl-16 pr-4 text-xl font-bold placeholder:text-muted-foreground/50"
                  />
               </div>
               <Button 
                type="submit" 
                disabled={loading || !topic.trim()}
                variant="gradient"
                size="xl"
                className="h-16 px-10 rounded-2xl font-black text-lg shadow-xl shadow-primary/20"
               >
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                    <div className="flex items-center gap-2">
                      Build Roadmap <Sparkles className="h-5 w-5" />
                    </div>
                  )}
               </Button>
            </div>
          </form>

          <div className="flex flex-wrap justify-center gap-3">
             {["Quantum Physics", "Modern UI Design", "Macroeconomics", "Blockchain Architecture"].map((suggest) => (
               <button 
                key={suggest}
                onClick={() => setTopic(suggest)}
                className="px-4 py-2 rounded-full bg-muted/50 hover:bg-primary/10 border border-border hover:border-primary/50 text-xs font-bold text-muted-foreground hover:text-primary transition-all"
               >
                 {suggest}
               </button>
             ))}
          </div>
        </div>
      ) : (
        <div className="animate-fade-in space-y-10">
          <div className="flex justify-between items-center">
             <Button variant="ghost" onClick={() => setRoadmapData(null)} className="font-bold text-muted-foreground">
                ← Back to search
             </Button>
             <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-xs">
                <Sparkles className="h-4 w-4" /> AI Generated Path
             </div>
          </div>
          
          {/* We reuse the RoadmapTab logic but pass the data directly */}
          {/* I'll modify RoadmapTab to accept optional data prop */}
          <RoadmapTab 
            initialData={roadmapData} 
            onNavigateToMultimedia={() => {
              // Redirect to learning page and pass the topic for multimedia search
              window.location.href = `/learning?topic=${encodeURIComponent(topic)}`;
            }}
          />
        </div>
      )}
    </div>
  );
}
