import { Volume2, Square } from "lucide-react";
import { textToSpeech, stopSpeech } from "@/api";

interface Note {
  title: string;
  content: string;
  tags?: string[];
}

interface NotesTabProps {
  notes: Note[];
}

export default function NotesTab({ notes }: NotesTabProps) {
  if (!notes || notes.length === 0) {
    return (
      <div className="glass-card p-12 text-center space-y-4 animate-fade-in">
        <p className="text-muted-foreground">No notes available for this session.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notes.map((note, i) => (
        <div
          key={i}
          className="glass-card-hover p-8 animate-slide-up shadow-lg border-l-4 border-l-primary"
          style={{ opacity: 0, animationDelay: `${i * 0.1}s` }}
        >
          <div className="flex items-center justify-between gap-4 mb-3">
            <h3 className="font-heading font-bold text-foreground text-2xl">{note.title}</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => textToSpeech(note.title + ". " + note.content)}
                className="h-10 w-10 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                title="Listen to Note"
              >
                <Volume2 className="h-5 w-5" />
              </button>
              <button 
                onClick={() => stopSpeech()}
                className="h-10 w-10 rounded-full flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all shadow-sm"
                title="Stop Voice"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            </div>
          </div>
          <p className="text-foreground/80 leading-relaxed text-lg whitespace-pre-wrap">{note.content}</p>
          {note.tags && note.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6">
              {note.tags.map(tag => (
                <span key={tag} className="px-4 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
