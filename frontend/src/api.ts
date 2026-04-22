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