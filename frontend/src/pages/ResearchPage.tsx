import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, FileText, ExternalLink, User, Clock, ArrowRight, BookOpen, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Paper {
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  url: string;
  pdf: string | null;
  citations: number;
  source: string;
}

export default function ResearchPage() {
  const [query, setQuery] = useState("");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setQuery(q);
      performSearch(q);
    }
  }, [searchParams]);

  const performSearch = async (searchTerm: string) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/research/search?q=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();
      setPapers(data.papers);
      if (data.papers.length === 0) {
        toast.info("No papers found for this topic.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to connect to research database.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    performSearch(query);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="font-heading text-4xl font-bold text-foreground">Research Hub</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Search over 200 million papers from IEEE, arXiv, Springer, and more. 
          Powered by <span className="text-primary font-bold">Semantic Scholar</span>.
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative group max-w-2xl animate-slide-up">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter research topic (e.g., 'Attention is all you need', 'Quantum Computing')..." 
          className="w-full bg-card border border-border rounded-2xl pl-12 pr-32 py-4 shadow-xl focus:ring-2 focus:ring-primary focus:outline-none transition-all text-lg"
        />
        <Button 
          type="submit" 
          disabled={loading}
          className="absolute right-2 top-2 bottom-2 rounded-xl gradient-primary-bg px-6 font-bold"
        >
          {loading ? "Searching..." : "Search"}
        </Button>
      </form>

      {/* Results */}
      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="glass-card p-8 animate-pulse space-y-4">
              <div className="h-6 w-3/4 bg-muted rounded" />
              <div className="h-4 w-1/2 bg-muted rounded" />
              <div className="h-20 w-full bg-muted rounded" />
            </div>
          ))
        ) : papers.length > 0 ? (
          papers.map((paper, i) => (
            <div 
              key={i} 
              className="glass-card-hover p-8 animate-slide-up bg-card/40 backdrop-blur-xl border-none shadow-xl group"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    {paper.pdf && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold uppercase tracking-wider border border-emerald-500/20">
                        Open Access PDF
                      </span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase tracking-wider border border-primary/20">
                      via {paper.source}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                    {paper.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-medium">
                    <span className="flex items-center gap-1.5"><User className="h-4 w-4" /> {paper.authors.slice(0, 3).join(", ")}{paper.authors.length > 3 ? " et al." : ""}</span>
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {paper.year}</span>
                    <span className="flex items-center gap-1.5"><Quote className="h-4 w-4" /> {paper.citations.toLocaleString()} Citations</span>
                  </div>

                  {paper.abstract && (
                    <p className="text-muted-foreground leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all duration-500">
                      {paper.abstract}
                    </p>
                  )}

                  <div className="flex items-center gap-4 pt-2">
                    <a 
                      href={paper.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm font-bold text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" /> View Source
                    </a>
                    {paper.pdf && (
                      <a 
                        href={paper.pdf} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm font-bold text-emerald-500 hover:underline"
                      >
                        <ArrowRight className="h-4 w-4" /> Direct PDF
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 md:w-48 shrink-0">
                  <Button variant="outline" className="w-full gap-2 font-bold rounded-xl border-primary/20 text-primary hover:bg-primary hover:text-white transition-all">
                    <BookOpen className="h-4 w-4" /> Deep Dive
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground font-medium uppercase tracking-widest mt-2">
                    Coming Soon: Study with AI
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : !loading && query && (
          <div className="text-center py-20 grayscale opacity-50 space-y-4">
             <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto">
               <Search className="h-10 w-10" />
             </div>
             <p className="text-xl font-medium">No results found for "{query}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
