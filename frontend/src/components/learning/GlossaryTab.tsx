import { Book, Volume2, Bookmark, Sparkles } from "lucide-react";

interface WordDefinition {
  word: string;
  definition: string;
  phonetic: string;
  partOfSpeech: string;
}

interface GlossaryTabProps {
  vocabulary: WordDefinition[];
}

export default function GlossaryTab({ vocabulary }: GlossaryTabProps) {
  if (!vocabulary || vocabulary.length === 0) {
    return (
      <div className="glass-card p-20 text-center space-y-4 animate-fade-in border-dashed border-2">
        <Book className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
        <p className="text-muted-foreground font-medium text-lg">
          No key terms extracted. Try a more technical topic!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Sparkles className="h-6 w-6 text-primary animate-pulse" />
        <h2 className="text-2xl font-bold text-foreground font-heading italic">Terminologies & Glossary</h2>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {vocabulary.map((item, i) => (
          <div 
            key={i} 
            className="glass-card-hover p-8 animate-slide-up shadow-xl border-l-4 border-l-primary group bg-card/40 backdrop-blur-xl"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                   <h3 className="text-3xl font-black text-foreground tracking-tight group-hover:text-primary transition-colors">
                    {item.word}
                  </h3>
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20">
                    {item.partOfSpeech}
                  </span>
                </div>
                {item.phonetic && (
                  <div className="flex items-center gap-2 text-muted-foreground font-medium text-sm">
                    <Volume2 className="h-4 w-4" />
                    <span>{item.phonetic}</span>
                  </div>
                )}
              </div>
              <button className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center hover:bg-primary hover:text-white transition-all">
                <Bookmark className="h-5 w-5" />
              </button>
            </div>

            <div className="relative p-6 rounded-2xl bg-muted/30 border border-border/50">
               <p className="text-lg text-foreground italic leading-relaxed">
                "{item.definition}"
               </p>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-6 bg-gradient-to-r from-primary/5 to-transparent border-none mt-12">
         <p className="text-xs text-muted-foreground font-medium uppercase tracking-[0.2em]">
           Verified by Academic Dictionary Services
         </p>
      </div>
    </div>
  );
}
