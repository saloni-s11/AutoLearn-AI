# 🚀 AutoLearn AI Studio - Project Overview

AutoLearn AI Studio is a premium, multimodal learning platform designed to transform static educational content into a dynamic, AI-powered study suite.

---

## 🛠️ Tech Stack
- **Backend**: FastAPI (Python 3.11+), Uvicorn, Groq SDK.
- **Frontend**: React (Vite), Tailwind CSS, Lucide Icons, Framer Motion (Animations).
- **Communication**: RESTful API with JSON/FormData payloads.

---

## 🌐 API Integrations (Total: 8)
This project utilizes 8 distinct external API services to provide a comprehensive learning experience:

1.  **Groq Cloud API (Llama 3.3 70B)**
    - **Purpose**: Acts as the "Brain" of the platform. It generates structured JSON for notes, quizzes, flashcards, and powers the contextual AI Chat.
2.  **YouTube Data API v3**
    - **Purpose**: Fetches relevant educational tutorials and guided videos based on the core topic detected in the user's material.
3.  **Pexels API**
    - **Purpose**: Provides high-quality, academic-style photography and visual aids to give students a visual context for abstract concepts.
4.  **Wikipedia API**
    - **Purpose**: Performs factual grounding by fetching verified summaries and historical context from the world's largest encyclopedia.
5.  **DuckDuckGo Search API**
    - **Purpose**: Powers the "Web Grounding" section by finding the top-rated educational links and external reading materials.
6.  **Semantic Scholar API**
    - **Purpose**: Primary engine for the **Research Hub**. It searches over 200 million academic papers from IEEE, Nature, Springer, etc.
7.  **arXiv XML API**
    - **Purpose**: Acts as a robust fallback for the Research Hub. If the primary academic API is rate-limited, arXiv provides instant access to tech and AI whitepapers.
8.  **Free Dictionary API**
    - **Purpose**: Powers the **Mastering Vocabulary** tab. Fetching formal definitions, parts of speech, and phonetics for technical terms.

---

## 🔄 Core Application Flow

### 1. The Input Phase
- User uploads a **PDF**, **Image**, **Audio**, or **Raw Text**.
- Backend extracts technical content (using `pypdf` for documents).

### 2. The AI Generation Phase
- Content is sent to **Groq**.
- AI identifies a **Core Topic** and generates:
    - **Notes**: 7-10 detailed academic sections.
    - **Quiz**: 10-12 multiple-choice questions.
    - **Flashcards**: 10-15 key recall cards.
    - **Vocabulary**: 8-10 technical terms for the glossary.

### 3. The Multimodal Enhancement Phase
- System simultaneously queries **YouTube, Pexels, Wikipedia, and the Dictionary API** in the background.
- It builds a "Multimodal Package" combining local AI results with live web data.

### 4. The Interactive Study Phase
- **Notes Hub**: Dynamic sections for reading.
- **Glossary Tab**: Context-aware technical definitions (AI + Dictionary).
- **Quiz Player**: Interactive scoring and progress tracking.
- **Flashcard Suite**: 3D flip-cards for memorization.
- **Research Hub**: Integrated academic search engine.
- **AI Chat Tab**: A document-aware tutor that answers questions based on the specific session context.

### 5. Persistence Phase
- All sessions are saved in **Global State** and synchronized via **LocalStorage** for a seamless history and resume experience.

---

## 🎨 Design Philosophy
- **Premium Aesthetics**: Using Glassmorphism, blurred backdrops, and subtle micro-animations.
- **Data-Driven UI**: Every list, grid, and card is tied to a real-time reactive global context.
- **Mobile First**: Fully responsive layouts for studying on the go.