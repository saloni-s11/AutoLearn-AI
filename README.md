
# 🚀 AutoLearn AI Studio

### 🧠 Autonomous Multimodal Learning Platform

> Transform **PDFs, text, audio, and visual content** into structured knowledge — instantly.

---

## ✨ What Makes This Different?

**AutoLearn AI Studio** is not just a notes generator — it’s a **complete AI-powered learning ecosystem**.

It combines:

* 🧠 Generative AI *(Llama 3.3 via Groq)*
* 🔎 Retrieval-Augmented Generation *(RAG)*
* 🎥 Multimedia intelligence
* 🎤 Voice interaction
* 📄 Multi-document reasoning

👉 **Result:** Deep understanding, not just summaries

---

## 🖥️ Product Preview

📸 *(Add your screenshot here)*

---

## 🔥 Core Features

### 📥 Multimodal Input System

Upload and learn from:

* 📄 PDFs
* 📝 Raw text
* 🎤 Audio *(speech → learning)*
* 🖼️ Images *(via Computer Vision / OCR)*

---

### 📚 AI Learning Suite

Auto-generates:

* 📖 Structured Notes *(7–10 chapters)*
* ❓ Quiz *(MCQs)*
* 🧠 Flashcards
* 📘 Technical Glossary

---

### 🎯 Exam Mode *(MCQ-Based)*

Practice like real exams:

* Difficulty Levels:

  * Easy
  * Medium
  * Hard

* Features:

  * ❓ Multiple Choice Questions (MCQs)
  * 🧠 AI-generated questions from your content
  * 📊 Instant scoring & feedback

---

### 🎥 Video Intelligence

* Fetches relevant YouTube videos
* One-click:

  * ✨ Video summary
  * 📌 Key highlights
  * 🎯 Learning points

---

### 🎤 Voice AI Tutor

* Ask doubts using voice
* AI responds with:

  * Text
  * 🔊 Speech *(ElevenLabs integration)*

👉 Enables **hands-free learning**

---

### 📄 Multi-Document Intelligence

* Upload multiple PDFs
* Cross-document understanding
* Unified output:

  * 📖 Notes
  * ❓ Answers
  * 💡 Insights

---

### 🧠 Adaptive Learning Engine

Real AI behavior:

* Tracks user learning patterns
* Dynamically adjusts:

  * Difficulty
  * Content depth
  * Question complexity

---

### 🧩 Interactive Mind Maps

* Auto-generated visual learning maps
* Click nodes → Ask AI deeper questions
* Clean, screen-fit UI
* 📄 Export included in PDF

---

### 🔍 Research Hub

Integrated with:

* Semantic Scholar
* arXiv

Provides:

* 📄 Research papers
* 🧾 Abstracts
* 🔗 References

---

### 📤 Share & Export

* 🔗 Share via link
* 📄 Export structured PDF

Includes:

* Notes
* Quiz
* Mindmap

---

## 🏗️ Architecture

```
Frontend (React + Vite)
        ↓
FastAPI Backend
        ↓
AI Engine (Groq - Llama 3.3)
        ↓
RAG Pipeline (LangChain / LangGraph)
        ↓
External APIs + MongoDB
```

---

## ⚙️ Tech Stack

### 💻 Frontend

* React (Vite)
* Tailwind CSS
* React Query
* ShadCN UI

### ⚙️ Backend

* FastAPI
* MongoDB (Motor)
* JWT Authentication

### 🧠 AI & Intelligence

* Groq (Llama 3.3 70B)
* LangChain / LangGraph
* RAG Pipeline

### 🔌 APIs

* YouTube Data API
* Pexels API
* Semantic Scholar
* arXiv
* Wikipedia
* DuckDuckGo
* Free Dictionary API
* ElevenLabs *(Voice AI)*

---

## 🚀 Setup Guide

### 1️⃣ Clone Repository

```bash
git clone https://github.com/your-username/AutoLearn-AI.git
cd AutoLearn-AI
```

---

### 2️⃣ Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate

pip install -r requirements.txt
```

---

### 3️⃣ Environment Variables

Create `.env` file:

```
GROQ_API_KEY=
YOUTUBE_API_KEY=
PEXELS_API_KEY=
MONGODB_URL=
JWT_SECRET=
ELEVENLABS_API_KEY=
```

---

### 4️⃣ Run Backend

```bash
python -m uvicorn main:app --reload
```

---

### 5️⃣ Frontend Setup

```bash
cd ../frontend
npm install
npm run dev
```

---

## 🌐 How It Works

1. Upload content *(PDF / Text / Audio / Image)*
2. AI processes and structures content
3. Generates:

   * Notes
   * Quiz
   * Flashcards
4. Enhances with:

   * Videos
   * Images
   * Research data
5. Interact via:

   * Chat
   * Voice AI
6. Test knowledge with Exam Mode
7. Export or share

---

## 📊 Use Cases

* 🎓 Students *(Engineering, Medical, etc.)*
* 📚 Competitive exam preparation
* 🔬 Researchers
* 💼 Professionals upskilling

---

## ⚠️ Limitations

* Requires internet connection
* Dependent on external APIs
* Possible AI latency
* Limited offline functionality

---

## 🔮 Future Scope

* 👥 Real-time collaboration
* 📱 Mobile application
* 📊 Learning analytics dashboard
* 🧠 Advanced personalization AI
* 🌐 Offline AI capabilities

---

