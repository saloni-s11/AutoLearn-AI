const API_BASE = "/api";

export const generateLearning = async (formData: FormData) => {
    try {
        const response = await fetch(`${API_BASE}/learn`, {
            method: "POST",
            body: formData,
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Generation Failed: ${errorText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
};

export const submitEvaluation = async (results: any[], topic: string) => {
    try {
        const token = localStorage.getItem("study_token");
        if (!token) throw new Error("Authentication token not found");

        const response = await fetch(`${API_BASE}/evaluation/submit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": token.startsWith("Bearer ") ? token : `Bearer ${token}`
            },
            body: JSON.stringify({ results, topic }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Evaluation Failed: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Evaluation API Error:", error);
        throw error;
    }
};

export const generateRoadmap = async (summary: string, scores: any, gaps: string[], topic: string) => {
    try {
        const token = localStorage.getItem("study_token");
        if (!token) throw new Error("Authentication token not found");

        const response = await fetch(`${API_BASE}/roadmap/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": token.startsWith("Bearer ") ? token : `Bearer ${token}`
            },
            body: JSON.stringify({ summary, scores, gaps, topic }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Roadmap Failed: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Roadmap API Error:", error);
        throw error;
    }
};
