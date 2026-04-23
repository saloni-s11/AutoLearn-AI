import { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { summarizeVideo } from "@/api";

export default function VideoHighlights({ videoId, url }: { videoId?: string; url?: string }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<{ summary: string; key_points: string[] } | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const handle = async () => {
        if (data) { setOpen(o => !o); return; }
        try {
            setLoading(true); setErr(null);
            const res = await summarizeVideo({ video_id: videoId, url });
            setData(res); setOpen(true);
        } catch (e: any) {
            setErr(e.message || "Failed");
        } finally { setLoading(false); }
    };

    return (
        <div className="mt-2">
            <button
                onClick={handle}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-sm font-semibold"
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                ✨ Highlights
                {data && (open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
            </button>
            {err && <p className="text-destructive text-sm mt-2">{err}</p>}
            {open && data && (
                <div className="mt-3 glass-card p-5 space-y-4 animate-fade-in">
                    <div>
                        <h4 className="font-bold mb-2">Summary</h4>
                        <p className="text-foreground/80 leading-relaxed">{data.summary}</p>
                    </div>
                    <div>
                        <h4 className="font-bold mb-2">Key Points</h4>
                        <ul className="space-y-1.5">
                            {data.key_points.map((p, i) => (
                                <li key={i} className="flex gap-2"><span className="text-primary">•</span>{p}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
