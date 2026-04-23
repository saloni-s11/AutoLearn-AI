import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { summarizeVideo } from "@/api";
import { Loader2, Sparkles, CheckCircle2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoSummaryModalProps {
  videoId: string;
  videoTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoSummaryModal({ videoId, videoTitle, isOpen, onClose }: VideoSummaryModalProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && videoId) {
      handleSummarize();
    }
  }, [isOpen, videoId]);

  const handleSummarize = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await summarizeVideo({ video_id: videoId });
      setSummary(data.summary);
      setKeyPoints(data.key_points);
    } catch (err: any) {
      setError(err.message || "Failed to generate summary. The video might not have a transcript available.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-2xl border-primary/20 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 text-primary mb-2">
            <Video className="h-5 w-5" />
            <span className="text-xs font-black uppercase tracking-tighter">AI Video Intelligence</span>
          </div>
          <DialogTitle className="text-2xl font-bold leading-tight">{videoTitle}</DialogTitle>
          <DialogDescription className="text-muted-foreground italic">
            Extracting core knowledge from the video transcript...
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="relative">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <Sparkles className="absolute -top-2 -right-2 h-5 w-5 text-purple-400 animate-pulse" />
              </div>
              <p className="text-sm font-medium text-muted-foreground animate-pulse">Analyzing transcript & synthesizing summary...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-center">
              <p className="text-destructive font-medium">{error}</p>
              <Button variant="outline" className="mt-4" onClick={handleSummarize}>Try Again</Button>
            </div>
          ) : (
            <div className="space-y-8 animate-fade-in">
              <div className="space-y-3">
                <h4 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Sparkles className="h-4 w-4 text-purple-400" /> Executive Summary
                </h4>
                <p className="text-muted-foreground leading-relaxed text-sm whitespace-pre-wrap">{summary}</p>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Key Takeaways
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {keyPoints.map((point, i) => (
                    <div key={i} className="flex gap-3 p-4 rounded-xl bg-accent/30 border border-border/50 group hover:border-primary/30 transition-all">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                        {i + 1}
                      </div>
                      <p className="text-sm text-foreground/90 font-medium leading-snug">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
