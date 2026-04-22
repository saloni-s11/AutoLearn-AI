import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Compass, 
  Flag, 
  Clock, 
  BarChart, 
  Sparkles, 
  ChevronRight, 
  Loader2,
  CheckCircle2,
  ArrowRight,
  Brain,
  ExternalLink
} from "lucide-react";
import { generateRoadmap } from "@/api";
import { useStudy } from "@/context/StudyContext";
import { useEffect } from "react";
import { toast } from "sonner";

export default function RoadmapPage() {
  const navigate = useNavigate();
  const { currentSession, saveSessionToDb } = useStudy();
  const [topic, setTopic] = useState("");
  const [timeline, setTimeline] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roadmap, setRoadmap] = useState<any>(null);

  useEffect(() => {
    if (currentSession?.type === "Roadmap" && currentSession.data) {
      setRoadmap(currentSession.data);
      setTopic(currentSession.title.replace("Mastering ", ""));
    }
  }, [currentSession]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    const data = await generateRoadmap(topic, timeline || undefined);
    if (data) {
      setRoadmap(data);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!roadmap) return;
    setSaving(true);
    try {
      const newSession = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: roadmap.title || `Mastering ${topic}`,
        type: "Roadmap",
        data: roadmap
      };
      await saveSessionToDb(newSession);
      toast.success("Roadmap saved to your History ✨");
    } catch (e) {
      toast.error("Failed to save roadmap.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-12 pb-32">
      {/* Header Section */}
      <div className="text-center space-y-4 animate-slide-up">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
          <Sparkles className="h-3 w-3" />
          AI Learning Architect
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-foreground tracking-tight">
          Your Personal <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">Learning Roadmap</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Input any topic, skill, or academic subject. Our AI will architect a step-by-step path to mastery.
        </p>
      </div>

      {/* Input Section */}
      <div className="max-w-3xl mx-auto space-y-4 animate-slide-up">
        <div className="glass-card p-2 grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-7 flex items-center px-4 gap-3">
             <Brain className="h-5 w-5 text-primary/50" />
             <Input 
                placeholder="What do you want to learn?" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-12 border-none bg-transparent text-lg focus-visible:ring-0 px-0"
              />
          </div>
          <div className="md:col-span-3 flex items-center px-4 gap-3 border-l border-border/50">
             <Clock className="h-5 w-5 text-primary/50" />
             <Input 
                placeholder="Timeline (Optional)" 
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                className="h-12 border-none bg-transparent text-sm focus-visible:ring-0 px-0"
              />
          </div>
          <div className="md:col-span-2">
             <Button 
                onClick={handleGenerate}
                disabled={loading || !topic.trim()}
                className="w-full h-12 rounded-xl gradient-primary-bg font-black shadow-lg shadow-primary/20"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Architect"}
              </Button>
          </div>
        </div>
        <p className="text-[10px] text-center text-muted-foreground uppercase font-black tracking-widest opacity-50">
           Pro Tip: Try "6 months" or "intensive 2 weeks" for better results
        </p>
      </div>

      {/* Roadmap Content */}
      {roadmap && (
        <div className="space-y-12 animate-fade-in">
          <div className="glass-card p-8 border-l-4 border-l-primary flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
             <div className="flex items-center gap-6">
                <div className="h-16 w-16 min-w-[64px] rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                   <Flag className="h-8 w-8" />
                </div>
                <div>
                   <h2 className="text-2xl font-black text-foreground mb-1">{roadmap.title}</h2>
                   <p className="text-muted-foreground leading-relaxed">{roadmap.target}</p>
                </div>
             </div>
             <Button 
                onClick={handleSave} 
                disabled={saving}
                className="rounded-xl gradient-primary-bg font-black px-6 shadow-lg shadow-primary/20 shrink-0"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {saving ? "Saving..." : "Save to Studio ✨"}
             </Button>
          </div>

          {/* Timeline Visualization */}
          <div className="relative space-y-12 before:absolute before:inset-0 before:ml-8 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/50 before:via-purple-500/50 before:to-transparent">
            {roadmap.milestones.map((step: any, index: number) => (
              <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-slide-up">
                {/* Dot */}
                <div className="flex items-center justify-center w-16 h-16 rounded-full border-4 border-background bg-card shadow-xl absolute left-0 md:left-1/2 md:-translate-x-1/2 z-10 transition-transform group-hover:scale-110">
                   <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white font-black text-xs ${index === 0 ? "bg-emerald-500 shadow-emerald-500/50 shadow-lg" : "bg-primary shadow-primary/50 shadow-lg"}`}>
                      {index === 0 ? <CheckCircle2 className="h-5 w-5" /> : step.step}
                   </div>
                </div>

                {/* Content Card */}
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] ml-auto md:ml-0 glass-card-hover p-8 shadow-2xl border border-border/50 transition-all duration-500 hover:border-primary/50 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Compass className="h-24 w-24" />
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      step.level === 'Beginner' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      step.level === 'Intermediate' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                      'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>
                      {step.level}
                    </span>
                    <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold">
                       <Clock className="h-3 w-3" />
                       {step.time}
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">{step.title}</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                  
                  <div className="mt-8 pt-6 border-t border-border/50 flex flex-wrap items-center justify-end gap-3">
                     <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-primary font-black text-xs hover:bg-primary/10 gap-2 p-0 h-auto px-2 py-1"
                        onClick={() => navigate(`/research?q=${encodeURIComponent(step.title)}`)}
                      >
                        Research Papers <ArrowRight className="h-3 w-3" />
                     </Button>
                     <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-muted-foreground hover:text-foreground font-bold text-xs hover:bg-accent gap-2 p-0 h-auto px-2 py-1"
                        onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(step.title + " tutorials and resources")}`, '_blank')}
                      >
                        Web Search <ExternalLink className="h-3 w-3" />
                     </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Placeholder / Empty State */}
      {!roadmap && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
           {[
             { icon: Brain, title: "Structured Learning", desc: "Break down complex topics into digestible milestones." },
             { icon: Clock, title: "Time Optimized", desc: "Estimated durations for every phase of your journey." },
             { icon: BarChart, title: "Skill Progression", desc: "Clear path from foundational basics to expert mastery." }
           ].map((item, i) => (
             <div key={i} className="glass-card p-8 text-center space-y-4 border-none shadow-xl hover:translate-y-[-4px] transition-transform duration-300">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto">
                   <item.icon className="h-7 w-7" />
                </div>
                <h4 className="font-bold text-lg text-foreground">{item.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
             </div>
           ))}
        </div>
      )}
    </div>
  );
}
