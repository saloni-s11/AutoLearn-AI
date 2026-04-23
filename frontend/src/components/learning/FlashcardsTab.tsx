import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Sparkles, Volume2, Square } from "lucide-react";
import { textToSpeech, stopSpeech } from "@/api";

interface Flashcard {
  front: string;
  back: string;
}

interface FlashcardsTabProps {
  flashcards: Flashcard[];
}

export default function FlashcardsTab({ flashcards }: FlashcardsTabProps) {
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!flashcards || flashcards.length === 0) {
    return (
      <div className="glass-card p-12 text-center space-y-4 animate-fade-in">
        <p className="text-muted-foreground">No flashcards available for this session.</p>
      </div>
    );
  }

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCard((prev) => (prev + 1) % flashcards.length);
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCard((prev) => (prev - 1 + flashcards.length) % flashcards.length);
    }, 150);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      {/* Progress */}
      <div className="text-center space-y-2">
        <p className="text-xs font-black text-primary uppercase tracking-[0.2em]">Flashcard {currentCard + 1} of {flashcards.length}</p>
        <div className="flex justify-center gap-1">
          {flashcards.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-300 ${i === currentCard ? "w-8 bg-primary" : "w-2 bg-muted hover:bg-primary/30"}`}
            />
          ))}
        </div>
      </div>

      {/* Flip Card */}
      <div 
        className="relative h-[400px] w-full perspective-1000 cursor-pointer group"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`relative h-full w-full transition-transform duration-700 preserve-3d ${isFlipped ? "rotate-y-180" : ""}`} style={{ transformStyle: "preserve-3d" }}>
          {/* Front */}
          <div className="absolute inset-0 backface-hidden glass-card p-10 flex flex-col items-center justify-center text-center shadow-2xl border-2 border-primary/20 bg-gradient-to-br from-card to-background" style={{ backfaceVisibility: "hidden" }}>
            <div className="flex flex-col items-center gap-6">
              <h3 className="text-2xl font-bold text-foreground leading-tight">{flashcards[currentCard].front}</h3>
              <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); textToSpeech(flashcards[currentCard].front); }}
                  className="h-10 w-10 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                  title="Listen"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); stopSpeech(); }}
                  className="h-10 w-10 rounded-full flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all shadow-sm"
                  title="Stop"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              </div>
            </div>
            <p className="mt-8 text-xs text-muted-foreground font-medium uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">Click to reveal answer</p>
          </div>

          {/* Back */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 glass-card p-10 flex flex-col items-center justify-center text-center shadow-2xl border-2 border-secondary/20 bg-gradient-to-br from-secondary/10 to-background" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <div className="flex flex-col items-center gap-6">
              <p className="text-xl font-medium text-foreground leading-relaxed">{flashcards[currentCard].back}</p>
              <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); textToSpeech(flashcards[currentCard].back); }}
                  className="h-10 w-10 rounded-full flex items-center justify-center bg-secondary/10 text-secondary hover:bg-secondary hover:text-white transition-all shadow-sm"
                  title="Listen"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); stopSpeech(); }}
                  className="h-10 w-10 rounded-full flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all shadow-sm"
                  title="Stop"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              </div>
            </div>
            <p className="mt-8 text-xs text-secondary font-bold uppercase tracking-widest">Click to flip back</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6">
        <button 
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
          className="h-14 w-14 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent hover:border-primary/50 transition-all active:scale-90"
        >
          <ChevronLeft className="h-6 w-6 text-foreground" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
          className="h-14 w-14 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent hover:border-primary/50 transition-all active:scale-90"
        >
          <ChevronRight className="h-6 w-6 text-foreground" />
        </button>
      </div>
    </div>
  );
}
