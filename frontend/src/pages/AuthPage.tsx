import { useState } from "react";
import { Brain, Lock, User, Mail, ArrowRight, Loader2, Sparkles, KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudy } from "@/context/StudyContext";
import { toast } from "sonner";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

// ── Forgot Password Modal ─────────────────────────────────────────────────────
function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const form = new FormData();
      form.append("email", email);
      const res = await fetch("http://localhost:8000/auth/forgot-password", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || "Something went wrong");
        return;
      }
      setSent(true);
    } catch {
      toast.error("Connection error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-card border border-border rounded-3xl p-8 w-full max-w-sm shadow-2xl mx-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="flex flex-col items-center gap-2 mb-6 text-center">
          <div className="h-12 w-12 rounded-2xl gradient-primary-bg flex items-center justify-center mb-1">
            <KeyRound className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-xl font-black text-foreground">Forgot Password?</h3>
          <p className="text-sm text-muted-foreground">
            Enter your registered email and we'll send you a temporary password.
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="text-4xl">📬</div>
            <p className="text-sm font-medium text-foreground">
              If that email is registered, a new password has been sent. Check your inbox.
            </p>
            <Button onClick={onClose} className="w-full rounded-2xl gradient-primary-bg">
              Back to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-12 bg-muted/30 border border-border rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium text-sm"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl gradient-primary-bg shadow-lg text-base font-black"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Temporary Password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Google Sign-In Button ─────────────────────────────────────────────────────
function GoogleSignInButton({ onSuccess }: { onSuccess: (token: string, username: string) => void }) {
  const handleSuccess = async (credentialResponse: any) => {
    const idToken = credentialResponse.credential;
    try {
      const form = new FormData();
      form.append("token", idToken);
      const res = await fetch("http://localhost:8000/auth/google", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data.access_token, data.username);
      } else {
        toast.error(data.detail || "Google Sign-In failed");
      }
    } catch {
      toast.error("Connection error. Is the backend running?");
    }
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => toast.error("Google Sign-In failed")}
      useOneTap={false}
      theme="outline"
      shape="pill"
      size="large"
      width="100%"
      text="continue_with"
    />
  );
}

// ── Main Auth Page ────────────────────────────────────────────────────────────
export default function AuthPage() {
  const { login } = useStudy();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const params = new URLSearchParams();
        params.append("username", formData.username);
        params.append("password", formData.password);

        const response = await fetch("http://localhost:8000/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params,
        });

        const data = await response.json();
        if (response.ok) {
          login(data.access_token, formData.username);
          toast.success(`Welcome back, ${formData.username}!`);
        } else {
          toast.error(data.detail || "Login failed");
        }
      } else {
        const signupForm = new FormData();
        signupForm.append("username", formData.username);
        signupForm.append("email", formData.email);
        signupForm.append("password", formData.password);

        const response = await fetch("http://localhost:8000/auth/signup", {
          method: "POST",
          body: signupForm,
        });

        const data = await response.json();
        if (response.ok) {
          toast.success("Account created! Please sign in.");
          setIsLogin(true);
          setFormData({ username: "", email: "", password: "" });
        } else {
          toast.error(data.detail || "Signup failed");
        }
      }
    } catch {
      toast.error("Connection error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = (accessToken: string, username: string) => {
    login(accessToken, username);
    toast.success(`Welcome, ${username}!`);
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}

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
        <div className="flex items-center justify-center p-6 md:p-12 animate-fade-in relative overflow-y-auto">
          <div className="w-full max-w-md space-y-6 py-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-foreground tracking-tight">
                {isLogin ? "Welcome Back" : "Start your Studio"}
              </h2>
              <p className="text-muted-foreground">
                {isLogin
                  ? "Sign in to access your saved study sessions."
                  : "Create a free account to sync your studies to the cloud."}
              </p>
            </div>

            {/* Google Sign-In */}
            {GOOGLE_CLIENT_ID && (
              <>
                <div className="flex justify-center">
                  <GoogleSignInButton onSuccess={handleGoogleSuccess} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </>
            )}

            {/* Email / Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Username
                </label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    required
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="scholar_name"
                    className="w-full h-14 bg-muted/30 border border-border rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium"
                  />
                </div>
              </div>

              {/* Email — only on signup */}
              {!isLogin && (
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                    Email
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="you@example.com"
                      className="w-full h-14 bg-muted/30 border border-border rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    required
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full h-14 bg-muted/30 border border-border rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium"
                  />
                </div>
              </div>

              {/* Forgot password link */}
              {isLogin && (
                <div className="flex justify-end -mt-1">
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-2xl gradient-primary-bg shadow-xl shadow-primary/20 text-lg font-black tracking-tight"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isLogin ? (
                  <>Sign In <ArrowRight className="ml-2 h-5 w-5" /></>
                ) : (
                  "Join Studio"
                )}
              </Button>
            </form>

            <div className="text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setFormData({ username: "", email: "", password: "" });
                }}
                className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
