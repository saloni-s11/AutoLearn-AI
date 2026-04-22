import React, { createContext, useContext, useState, useEffect } from "react";

interface Session {
  id: string;
  _id?: string; // MongoDB ID
  title: string;
  type: string;
  timestamp: string;
  data: any;
}

interface StudyContextType {
  currentSession: Session | null;
  sessions: Session[];
  user: string | null;
  token: string | null;
  setCurrentSession: (session: Session) => void;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  saveSessionToDb: (session: Session) => Promise<void>;
  login: (token: string, username: string) => void;
  logout: () => void;
}

const StudyContext = createContext<StudyContextType | undefined>(undefined);

export const StudyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSessionState] = useState<Session | null>(null);
  const [user, setUser] = useState<string | null>(localStorage.getItem("study_user"));
  const [token, setToken] = useState<string | null>(localStorage.getItem("study_token"));

  const fetchSessions = async (authToken: string) => {
    try {
      const res = await fetch("http://localhost:8000/sessions/me", {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions.map((s: any) => ({ ...s, id: s._id })));
        if (data.sessions.length > 0 && !currentSession) {
          setCurrentSessionState({ ...data.sessions[0], id: data.sessions[0]._id });
        }
      }
    } catch (e) {
      console.error("Fetch sessions error", e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSessions(token);
    }
  }, [token]);

  const login = (newToken: string, username: string) => {
    setToken(newToken);
    setUser(username);
    localStorage.setItem("study_token", newToken);
    localStorage.setItem("study_user", username);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setSessions([]);
    localStorage.removeItem("study_token");
    localStorage.removeItem("study_user");
  };

  const addSession = (session: Session) => {
    // Temporary session (not yet saved to DB)
    setCurrentSessionState(session);
    setSessions(prev => [session, ...prev]);
  };

  const saveSessionToDb = async (session: Session) => {
    if (!token) return;
    try {
      const formData = new FormData();
      formData.append("session_data", JSON.stringify(session));
      const res = await fetch("http://localhost:8000/sessions/save", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        fetchSessions(token);
      }
    } catch (e) {
      console.error("Save session error", e);
    }
  };

  const removeSession = async (id: string) => {
    if (token) {
      try {
        await fetch(`http://localhost:8000/sessions/${id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        fetchSessions(token);
      } catch (e) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      }
    } else {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const setCurrentSession = (session: Session) => {
    setCurrentSessionState(session);
  };

  return (
    <StudyContext.Provider value={{ 
      currentSession, sessions, user, token,
      setCurrentSession, addSession, removeSession, saveSessionToDb, 
      login, logout 
    }}>
      {children}
    </StudyContext.Provider>
  );
};

export const useStudy = () => {
  const context = useContext(StudyContext);
  if (!context) throw new Error("useStudy must be used within a StudyProvider");
  return context;
};
