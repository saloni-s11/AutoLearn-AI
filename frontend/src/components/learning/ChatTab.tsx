import { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import { useStudy } from "@/context/StudyContext";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "ai";
  content: string;
}

const initialMessages: Message[] = [
  { role: "ai", content: "Hi! I'm your AI learning assistant. Ask me anything about your uploaded materials! 🧠" },
];

/** Renders AI markdown responses with clean, ChatGPT-style formatting */
function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none
      prose-p:leading-relaxed prose-p:my-1.5
      prose-headings:font-semibold prose-headings:text-foreground
      prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
      prose-headings:mt-3 prose-headings:mb-1
      prose-ul:my-1.5 prose-ol:my-1.5
      prose-li:my-0.5 prose-li:leading-relaxed
      prose-strong:text-foreground prose-strong:font-semibold
      prose-code:bg-muted prose-code:text-primary prose-code:px-1.5 prose-code:py-0.5
      prose-code:rounded-md prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-pre:p-4
      prose-pre:text-xs prose-pre:overflow-x-auto
      prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground prose-blockquote:italic
      prose-hr:border-border
      prose-a:text-primary prose-a:no-underline hover:prose-a:underline
      text-foreground text-sm"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function ChatTab() {
  const { currentSession } = useStudy();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput("");
    setTyping(true);

    try {
      let context = "";
      if (currentSession?.data?.result) {
        try {
          const studyData = JSON.parse(currentSession.data.result);
          context = studyData.notes?.map((n: any) => `${n.title}: ${n.content}`).join("\n\n");
        } catch (e) {
          console.error("Context parse error", e);
        }
      }

      const formData = new FormData();
      formData.append("message", currentInput);
      formData.append("context", context);

      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Chat failed");

      const data = await response.json();
      setMessages(prev => [...prev, { role: "ai", content: data.response }]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to get AI response");
      setMessages(prev => [...prev, { role: "ai", content: "Sorry, I had trouble processing that. Please try again." }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="glass-card flex flex-col h-[600px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {/* Avatar */}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full self-start mt-0.5 ${
              msg.role === "ai" ? "gradient-primary-bg" : "bg-muted"
            }`}>
              {msg.role === "ai"
                ? <Bot className="h-4 w-4 text-primary-foreground" />
                : <User className="h-4 w-4 text-muted-foreground" />
              }
            </div>

            {/* Bubble */}
            {msg.role === "ai" ? (
              <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-3 bg-card border border-border shadow-sm">
                <MarkdownMessage content={msg.content} />
              </div>
            ) : (
              <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 gradient-primary-bg text-primary-foreground text-sm leading-relaxed">
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {typing && (
          <div className="flex gap-3 animate-fade-in">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-primary-bg">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0s" }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.15s" }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask anything about your materials..."
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="p-2.5 rounded-xl gradient-primary-bg text-primary-foreground hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
