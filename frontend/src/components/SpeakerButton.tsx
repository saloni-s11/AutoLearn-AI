import { useRef, useState } from "react";
import { Volume2, Loader2, Pause } from "lucide-react";
import { fetchTTS } from "@/api";

export default function SpeakerButton({ text }: { text: string }) {
    const [loading, setLoading] = useState(false);
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const handleClick = async () => {
        if (playing && audioRef.current) {
            audioRef.current.pause();
            setPlaying(false);
            return;
        }
        if (audioRef.current) {
            audioRef.current.play();
            setPlaying(true);
            return;
        }
        try {
            setLoading(true);
            const url = await fetchTTS(text);
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => setPlaying(false);
            audio.onpause = () => setPlaying(false);
            await audio.play();
            setPlaying(true);
        } catch (e) {
            console.warn("Backend TTS failed, falling back to browser synthesis:", e);
            
            // Fallback: Use browser's native SpeechSynthesis
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.onstart = () => setPlaying(true);
                utterance.onend = () => setPlaying(false);
                utterance.onerror = () => {
                    setPlaying(false);
                    setLoading(false);
                };
                window.speechSynthesis.speak(utterance);
            } else {
                console.error("Speech synthesis not supported in this browser.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleClick}
            title="Listen"
            className="absolute top-4 right-4 p-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition"
        >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> :
                playing ? <Pause className="h-5 w-5" /> :
                    <Volume2 className="h-5 w-5" />}
        </button>
    );
}
