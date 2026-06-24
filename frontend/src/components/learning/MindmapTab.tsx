import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Network, RefreshCw, Sparkles, ChevronDown, ChevronRight, HelpCircle, Lightbulb, BookOpen, Layers } from "lucide-react";
import { generateMindMap } from "@/api";
import { Button } from "@/components/ui/button";

interface MindMapNode {
  title: string;
  children: { title: string }[];
}

interface MindMapData {
  topic: string;
  nodes: MindMapNode[];
}

interface MindmapTabProps {
  notes: { title: string; content: string }[];
}

interface ConnectionPath {
  d: string;
  color: string;
}

export default function MindmapTab({ notes }: MindmapTabProps) {
  const [mindMap, setMindMap] = useState<MindMapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPillars, setExpandedPillars] = useState<Record<string, boolean>>({});
  const [paths, setPaths] = useState<ConnectionPath[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const contentString = notes.map(n => `${n.title}\n${n.content}`).join("\n\n");

  const fetchMindMap = async () => {
    if (!contentString.trim()) {
      setError("No content available to generate a mind map.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await generateMindMap(contentString);
      if (data && data.topic) {
        setMindMap(data);
        const initialExpanded: Record<string, boolean> = {};
        data.nodes.forEach((node: MindMapNode) => {
          initialExpanded[node.title] = true;
        });
        setExpandedPillars(initialExpanded);
      } else {
        setError("Failed to generate a valid mind map structure.");
      }
    } catch (err) {
      setError("An error occurred while generating the mind map.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMindMap();
  }, [contentString]);

  // Recalculate paths on resize, expand, or data load
  const calculatePaths = () => {
    if (!containerRef.current || !mindMap) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const newPaths: ConnectionPath[] = [];

    const centralNode = container.querySelector("#node-central");
    if (!centralNode) return;
    const centralRect = centralNode.getBoundingClientRect();

    // Pillar theme colors (mapped dynamically)
    const colors = ["#a855f7", "#10b981", "#0ea5e9", "#f59e0b", "#ec4899", "#3b82f6"];

    mindMap.nodes.forEach((pillar, pIdx) => {
      const pillarNode = container.querySelector(`#node-pillar-${pIdx}`);
      if (!pillarNode) return;
      const pillarRect = pillarNode.getBoundingClientRect();
      const pColor = colors[pIdx % colors.length];

      // 1. Connection: Central Hub (bottom center) -> Pillar (top center)
      const startX = centralRect.left + centralRect.width / 2 - containerRect.left;
      const startY = centralRect.bottom - containerRect.top;
      const endX = pillarRect.left + pillarRect.width / 2 - containerRect.left;
      const endY = pillarRect.top - containerRect.top;
      
      // Vertical smooth Bezier curve
      const d = `M ${startX} ${startY} C ${startX} ${(startY + endY) / 2}, ${endX} ${(startY + endY) / 2}, ${endX} ${endY}`;
      newPaths.push({ d, color: pColor });

      // 2. Connection: Pillar (bottom center) -> Children (top center)
      const isExpanded = expandedPillars[pillar.title] !== false;
      if (isExpanded) {
        pillar.children.forEach((child, cIdx) => {
          const childNode = container.querySelector(`#node-child-${pIdx}-${cIdx}`);
          if (!childNode) return;
          const childRect = childNode.getBoundingClientRect();

          const cStartX = pillarRect.left + pillarRect.width / 2 - containerRect.left;
          const cStartY = pillarRect.bottom - containerRect.top;
          const cEndX = childRect.left + childRect.width / 2 - containerRect.left;
          const cEndY = childRect.top - containerRect.top;
          
          const cD = `M ${cStartX} ${cStartY} C ${cStartX} ${(cStartY + cEndY) / 2}, ${cEndX} ${(cStartY + cEndY) / 2}, ${cEndX} ${cEndY}`;
          newPaths.push({ d: cD, color: pColor });
        });
      }
    });

    setPaths(newPaths);
  };

  useLayoutEffect(() => {
    if (mindMap) {
      const handleResize = () => requestAnimationFrame(calculatePaths);
      const timeoutId = setTimeout(calculatePaths, 150);

      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
        clearTimeout(timeoutId);
      };
    }
  }, [mindMap, expandedPillars]);

  const togglePillar = (title: string) => {
    setExpandedPillars(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
    setTimeout(calculatePaths, 80);
  };

  if (loading) {
    return (
      <div className="glass-card p-16 text-center space-y-6 flex flex-col items-center justify-center min-h-[400px] animate-fade-in border-none">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <Network className="h-8 w-8 text-primary absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-foreground">Mapping concepts...</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Our visual engine is organizing your notes into a clean structural diagram.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-12 text-center space-y-4 animate-fade-in">
        <HelpCircle className="h-12 w-12 text-destructive mx-auto" />
        <p className="text-foreground font-bold">Could not generate mind map</p>
        <p className="text-muted-foreground text-sm">{error}</p>
        <Button onClick={fetchMindMap} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Try Again
        </Button>
      </div>
    );
  }

  if (!mindMap) return null;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">AI Level-Wise Mind Map</span>
        </div>
        <Button onClick={fetchMindMap} variant="ghost" size="sm" className="gap-2 hover:bg-primary/10 hover:text-primary transition-all rounded-xl font-bold">
          <RefreshCw className="h-3.5 w-3.5" />
          Regenerate Map
        </Button>
      </div>

      {/* Mindmap Container (Level-wise Vertical flow) */}
      <div 
        ref={containerRef}
        className="glass-card p-8 md:p-16 relative overflow-visible flex flex-col items-center gap-16 min-h-[600px] border-none shadow-xl bg-gradient-to-br from-card/90 to-background/50 backdrop-blur-xl"
      >
        {/* SVG Connections Overlay */}
        <svg className="absolute inset-0 pointer-events-none w-full h-full z-0 overflow-visible">
          <defs>
            <linearGradient id="glow-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(243 75% 65%)" />
              <stop offset="100%" stopColor="hsl(280 70% 60%)" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {paths.map((path, idx) => (
            <g key={idx}>
              <path
                d={path.d}
                fill="none"
                stroke={path.color}
                strokeWidth="6"
                strokeOpacity="0.12"
                strokeLinecap="round"
                filter="url(#glow)"
              />
              <path
                d={path.d}
                fill="none"
                stroke={path.color}
                strokeWidth="2"
                strokeOpacity="0.55"
                strokeLinecap="round"
                strokeDasharray="6, 6"
                className="animate-flow-dash"
              />
            </g>
          ))}
        </svg>

        {/* --- Level 1: Central Hub Node (Top Center) --- */}
        <div className="flex justify-center items-center z-10 w-full">
          <div 
            id="node-central"
            className="px-8 py-6 rounded-[2.5rem] gradient-primary-bg text-white font-black text-xl md:text-2xl shadow-xl shadow-primary/20 flex flex-col items-center gap-3 border border-white/20 select-none text-center max-w-[320px] group transition-all duration-300 hover:scale-105"
          >
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform duration-300">
              <Network className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold mb-1">Central Concept</span>
              <span className="font-heading font-black leading-tight block">{mindMap.topic}</span>
            </div>
          </div>
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-48 h-20 bg-primary/20 blur-2xl rounded-full -z-10 animate-pulse" />
        </div>

        {/* --- Level 2: Pillars (Horizontal Row) --- */}
        <div className="flex flex-row flex-wrap justify-center items-start gap-12 md:gap-16 w-full z-10">
          {mindMap.nodes.map((pillar, idx) => {
            const isExpanded = expandedPillars[pillar.title] !== false;
            
            // Themes and colors dynamically mapped
            const themes = [
              {
                border: "hover:border-purple-500/50 hover:shadow-purple-500/5",
                bg: "bg-purple-500/5 border-purple-500/20",
                badgeBg: "bg-purple-500/10",
                badgeText: "text-purple-400",
                bullet: "bg-purple-400",
                icon: BookOpen
              },
              {
                border: "hover:border-emerald-500/50 hover:shadow-emerald-500/5",
                bg: "bg-emerald-500/5 border-emerald-500/20",
                badgeBg: "bg-emerald-500/10",
                badgeText: "text-emerald-400",
                bullet: "bg-emerald-400",
                icon: Lightbulb
              },
              {
                border: "hover:border-sky-500/50 hover:shadow-sky-500/5",
                bg: "bg-sky-500/5 border-sky-500/20",
                badgeBg: "bg-sky-500/10",
                badgeText: "text-sky-400",
                bullet: "bg-sky-400",
                icon: Layers
              },
              {
                border: "hover:border-amber-500/50 hover:shadow-amber-500/5",
                bg: "bg-amber-500/5 border-amber-500/20",
                badgeBg: "bg-amber-500/10",
                badgeText: "text-amber-400",
                bullet: "bg-amber-400",
                icon: BookOpen
              },
              {
                border: "hover:border-pink-500/50 hover:shadow-pink-500/5",
                bg: "bg-pink-500/5 border-pink-500/20",
                badgeBg: "bg-pink-500/10",
                badgeText: "text-pink-400",
                bullet: "bg-pink-400",
                icon: Lightbulb
              },
              {
                border: "hover:border-blue-500/50 hover:shadow-blue-500/5",
                bg: "bg-blue-500/5 border-blue-500/20",
                badgeBg: "bg-blue-500/10",
                badgeText: "text-blue-400",
                bullet: "bg-blue-400",
                icon: Layers
              }
            ];
            
            const theme = themes[idx % themes.length];
            const IconComponent = theme.icon;

            return (
              <div 
                key={pillar.title} 
                className="flex flex-col items-center gap-10 w-full sm:w-[320px] shrink-0 animate-slide-up"
                style={{ animationDelay: `${idx * 0.08}s` }}
              >
                {/* Level 2 Card (Pillar Node) */}
                <div 
                  id={`node-pillar-${idx}`}
                  onClick={() => togglePillar(pillar.title)}
                  className={`w-full glass-card p-5 border flex items-center justify-between cursor-pointer select-none transition-all duration-300 hover:-translate-y-0.5 shadow-lg active:scale-98 ${theme.bg} ${theme.border}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-10 w-10 rounded-xl ${theme.badgeBg} flex items-center justify-center shrink-0`}>
                      <IconComponent className={`h-5 w-5 ${theme.badgeText}`} />
                    </div>
                    <div className="text-left min-w-0">
                      <span className="block text-[9px] uppercase tracking-wider text-muted-foreground font-black">Level 2 Pillar</span>
                      <h4 className="font-heading font-black text-foreground text-sm leading-snug truncate">
                        {pillar.title}
                      </h4>
                    </div>
                  </div>
                  <div className={`p-1.5 rounded-lg bg-card/60 border border-border/40 transition-colors ${theme.badgeText}`}>
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </div>
                </div>

                {/* --- Level 3: Details (Arranged horizontally below their parent pillar) --- */}
                {isExpanded && (
                  <div className="flex flex-row flex-wrap justify-center gap-3.5 w-full animate-slide-up">
                    {pillar.children.map((child, cIdx) => (
                      <div 
                        key={cIdx} 
                        id={`node-child-${idx}-${cIdx}`}
                        className="w-[130px] sm:w-[145px] min-h-[80px] flex flex-col items-center justify-center py-3 px-3.5 rounded-2xl border border-border/70 text-[10px] md:text-[11px] font-black leading-tight text-center select-none bg-card/90 text-foreground/80 hover:text-foreground hover:border-primary/40 hover:bg-accent/10 hover:-translate-y-0.5 transition-all duration-300 shadow-sm relative group overflow-hidden"
                      >
                        {/* Little top colored line indicating Level 3 child link */}
                        <div className={`absolute top-0 inset-x-0 h-1 ${theme.bullet}`} />
                        <span className="hyphens-auto break-words w-full">{child.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Styled inline keyframes for animated dash lines */}
      <style>{`
        @keyframes flowDash {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-flow-dash {
          animation: flowDash 0.8s linear infinite;
        }
      `}</style>
    </div>
  );
}
