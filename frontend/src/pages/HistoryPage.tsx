import { Clock, FileText, Brain, Layers, Trash2, Search, Map } from "lucide-react";
import { useStudy } from "@/context/StudyContext";
import { useNavigate } from "react-router-dom";

export default function HistoryPage() {
  const { sessions, setCurrentSession, removeSession } = useStudy();
  const navigate = useNavigate();

  const handleSelectSession = (session: any) => {
    setCurrentSession(session);
    if (session.type === "Roadmap") {
      navigate("/roadmap");
    } else {
      navigate("/learning");
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this session?")) {
      removeSession(id);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8 pb-32">
      <div className="animate-slide-up flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-bold text-foreground">Study History</h1>
          <p className="text-muted-foreground mt-1">Access all your AI-generated learning materials.</p>
        </div>
        <div className="relative group">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
           <input 
              type="text" 
              placeholder="Search history..." 
              className="bg-card border border-border rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all w-64"
           />
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="glass-card p-20 text-center space-y-4 animate-fade-in border-dashed border-2">
           <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto opacity-20">
              <Clock className="h-8 w-8" />
           </div>
           <div className="space-y-1">
              <h3 className="text-xl font-bold text-foreground">No history found</h3>
              <p className="text-muted-foreground">Your generated lessons will appear here.</p>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sessions.map((item, i) => (
            <div
              key={item.id}
              onClick={() => handleSelectSession(item)}
              className="glass-card-hover group flex items-center gap-6 p-6 cursor-pointer animate-slide-up border-none shadow-lg hover:shadow-primary/5 bg-card/40 backdrop-blur-md"
              style={{ opacity: 0, animationDelay: `${i * 0.08}s` }}
            >
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent group-hover:text-white transition-all duration-500 text-2xl ${item.type === "Roadmap" ? "group-hover:bg-purple-500" : "group-hover:bg-primary"}`}>
                {item.type === "File Upload" ? "📄" : item.type === "Roadmap" ? "🗺️" : "✍️"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                   <p className="font-bold text-foreground text-lg truncate group-hover:text-primary transition-colors">{item.title}</p>
                   <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-black uppercase tracking-wider">{item.type}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                   <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {item.timestamp}</span>
                   <span className="flex items-center gap-1">
                      {item.type === "Roadmap" ? (
                         <><Map className="h-3 w-3 text-purple-400" /> Professional Roadmap</>
                      ) : (
                         <><Brain className="h-3 w-3 text-primary" /> Full Study Suite</>
                      )}
                   </span>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                  onClick={(e) => handleDelete(e, item.id)}
                  className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                 >
                    <Trash2 className="h-4 w-4" />
                 </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
