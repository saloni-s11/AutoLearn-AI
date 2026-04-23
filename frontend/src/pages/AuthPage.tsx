import { useState } from "react";
import { Brain, Lock, User, Mail, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudy } from "@/context/StudyContext";
import { toast } from "sonner";

export default function AuthPage() {
  const { login } = useStudy();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // Login Logic
        const params = new URLSearchParams();
        params.append('username', formData.username);
        params.append('password', formData.password);

        const response = await fetch("http://localhost:8000/auth/login", {
          method: "POST",
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params
        });

        const data = await response.json();
        if (response.ok) {
          login(data.access_token, formData.username);
          toast.success(`Welcome back, ${formData.username}!`);
        } else {
          toast.error(data.detail || "Login failed");
        }
      } else {
        // Signup Logic
        const signupForm = new FormData();
        signupForm.append('username', formData.username);
        signupForm.append('password', formData.password);

        const response = await fetch("http://localhost:8000/auth/signup", {
          method: "POST",
          body: signupForm
        });

        const data = await response.json();
        if (response.ok) {
          toast.success("Account created! Please login.");
          setIsLogin(true);
        } else {
          toast.error(data.detail || "Signup failed");
        }
      }
    } catch (error) {
      toast.error("Connection error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background overflow-hidden">
      {/* Left Decoration */}
      <div className="hidden lg:flex flex-col items-center justify-center p-12 relative overflow-hidden bg-primary/5">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 text-center space-y-8 max-w-lg">
          <div className="h-24 w-24 rounded-3xl gradient-primary-bg shadow-2xl flex items-center justify-center mx-auto animate-bounce-slow">
             <Brain className="h-12 w-12 text-white" />
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-black font-heading text-foreground tracking-tight leading-none">
              The Future of <br />
              <span className="gradient-text">Learning is AI</span>
            </h1>
            <p className="text-muted-foreground text-lg italic">
              "Your personalized academic studio. Powered by 8 industrial-grade APIs and persistent cloud memory."
            </p>
          </div>
          <div className="flex justify-center gap-4">
             <div className="glass-card p-4 rounded-2xl flex flex-col items-center gap-1">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">Precise</span>
             </div>
             <div className="glass-card p-4 rounded-2xl flex flex-col items-center gap-1">
                <Lock className="h-5 w-5 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">Private</span>
             </div>
          </div>
        </div>
      </div>

      {/* Right Form */}
      <div className="flex items-center justify-center p-6 md:p-12 animate-fade-in relative">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black text-foreground tracking-tight">
              {isLogin ? "Welcome Back" : "Start your Studio"}
            </h2>
            <p className="text-muted-foreground">
              {isLogin ? "Sign in to access your saved study sessions." : "Create a free account to sync your studies to the cloud."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
               <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Username</label>
               <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input 
                    required
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    placeholder="scholar_name"
                    className="w-full h-14 bg-muted/30 border border-border rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium"
                  />
               </div>
            </div>

            <div className="space-y-1.5">
               <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Password</label>
               <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input 
                    required
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full h-14 bg-muted/30 border border-border rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium"
                  />
               </div>
            </div>

            <Button 
                type="submit" 
                disabled={loading}
                className="w-full h-14 rounded-2xl gradient-primary-bg shadow-xl shadow-primary/20 text-lg font-black tracking-tight"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : isLogin ? "Sign In" : "Join Studio"}
            </Button>
          </form>

          <div className="text-center">
            <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
