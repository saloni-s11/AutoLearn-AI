import { toast } from "sonner";

let currentAudio: HTMLAudioElement | null = null;

export const stopSpeech = () => {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
};

export const generateLearning = async (formData: FormData) => {
    try {
        const response = await fetch("http://localhost:8000/learn", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();
        return data; // Return full multimodal object

    } catch (error) {
        console.error("API Error:", error);
        return { result: "Error connecting to backend", videos: [], images: [], research: [] };
    }
};

export const textToSpeech = async (text: string) => {
    // Stop any existing speech first
    stopSpeech();

    const loadingToast = toast.loading("Generating AI voice...");
    try {
        const formData = new FormData();
        formData.append("text", text);

        const response = await fetch("http://localhost:8000/tts", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "TTS failed" }));
            throw new Error(errorData.detail || "TTS failed");
        }

        const blob = await response.blob();
        if (blob.size < 100) throw new Error("Audio generation failed (empty response)");

        const url = URL.createObjectURL(blob);
        currentAudio = new Audio(url);
        
        currentAudio.oncanplaythrough = () => {
            toast.dismiss(loadingToast);
            currentAudio?.play().catch(e => {
                console.error("Playback failed:", e);
                toast.error("Playback blocked by browser. Please interact with the page first.");
            });
        };

        currentAudio.onended = () => {
            currentAudio = null;
        };

        currentAudio.onerror = () => {
            toast.dismiss(loadingToast);
            currentAudio = null;
            throw new Error("Audio playback error");
        };

    } catch (error: any) {
        toast.dismiss(loadingToast);
        console.warn("ElevenLabs failed, falling back to browser speech:", error);
        
        // Fallback to Native Browser Speech Synthesis
        try {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Female"));
            if (preferredVoice) utterance.voice = preferredVoice;

            window.speechSynthesis.speak(utterance);
            toast.success("Using browser voice fallback", { duration: 2000 });
        } catch (fallbackError) {
            toast.error("Speech playback failed.");
        }
    }
};

export const generateRoadmap = async (topic: string, timeline?: string) => {
    try {
        const formData = new FormData();
        formData.append("topic", topic);
        if (timeline) formData.append("timeline", timeline);

        const response = await fetch("http://localhost:8000/roadmap", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();
        return data; 

    } catch (error) {
        console.error("Roadmap API Error:", error);
        return null;
    }
};