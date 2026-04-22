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
    try {
        const formData = new FormData();
        formData.append("text", text);

        const response = await fetch("http://localhost:8000/tts", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) throw new Error("TTS failed");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();

    } catch (error) {
        console.error("TTS Error:", error);
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