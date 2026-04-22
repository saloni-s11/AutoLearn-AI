<<<<<<< HEAD
# 🎓 AutoLearn AI Studio

AutoLearn AI Studio is an advanced, multimodal educational ecosystem that transforms static content into a dynamic, personalized learning experience. Leveraging 8 different external APIs and high-performance AI models, it creates a "Premium Personal Tutor" environment for students and researchers.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![React](https://img.shields.io/badge/frontend-React%20%2B%20Vite-blue)
![FastAPI](https://img.shields.io/badge/backend-FastAPI%20%2B%20Python-darkgreen)

---

## ✨ Key Features

*   **🧠 Intelligent Extraction**: Upload PDF, Audio, Images, or Text to instantly generate academic study suites.
*   **📚 Automated Study Suites**: Generates 7-10 detailed chapters, flashcards, interactive quizzes, and contextual vocabulary.
*   **🌐 Real-time Web Grounding**: Integrates verified data from Wikipedia, YouTube, and academic research engines.
*   **🔍 Academic Research Hub**: Search through over 200 million papers via Semantic Scholar and arXiv.
*   **💬 Context-Aware AI Chat**: A deep-thinking tutor that answers questions based specifically on your uploaded materials.
*   **🎨 Premium UI/UX**: Modern glassmorphism design with smooth animations and responsive layouts.
*   **🔒 Secure Auth & Sync**: Personalized accounts with JWT authentication and persistent MongoDB storage.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React (Vite), TypeScript, Tailwind CSS, Framer Motion, Shadcn/UI |
| **Backend** | FastAPI (Python 3.11+), Motor (Async MongoDB), Groq SDK |
| **Database** | MongoDB Atlas (Cloud) |
| **Testing** | Playwright (E2E), Vitest (Unit) |

---

## 🌐 Integrated API Services

The "Brain" of AutoLearn is powered by 8 specialized services:

1.  **Groq (Llama 3.3 70B)**: Core logic for content generation and Chat.
2.  **YouTube Data API**: Educational video fetching.
3.  **Pexels API**: High-quality visual aids.
4.  **Wikipedia API**: Factual summaries and historical background.
5.  **DuckDuckGo Search**: Top-rated external reading and web links.
6.  **Semantic Scholar**: Primary engine for academic paper search.
7.  **arXiv XML**: Secondary source for tech/AI whitepapers.
8.  **Free Dictionary API**: Formal phonetics and parts of speech for vocabulary.

---

## 🚀 Getting Started

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18+)
*   [Python](https://www.python.org/) (v3.11+)
*   [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) Account

### 1. Setup Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend` folder:
```env
GROQ_API_KEY=your_key
YOUTUBE_API_KEY=your_key
PEXELS_API_KEY=your_key
MONGODB_URL=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

### 2. Setup Frontend
```bash
cd frontend
npm install
```

### 3. Run the Application
*   **Start Backend**: `uvicorn main:app --reload`
*   **Start Frontend**: `npm run dev`

---

## 🎨 Design Philosophy

*   **Aesthetics**: Minimalist dark theme with focused color accents for readability.
*   **Accessibility**: Semantic HTML and responsive grids for seamless tablet/mobile use.
*   **Performance**: Background API processing ensures the AI generates content while visual assets load.

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.
=======
# AutoLearn-AI
AutoLearn AI is an autonomous learning agent that understands user intent, processes content, and uses multiple AI tools to generate personalized notes, explanations, and quizzes for smarter learning.
>>>>>>> 8c291fb2727055189391f4a7b928694ed27a4655
