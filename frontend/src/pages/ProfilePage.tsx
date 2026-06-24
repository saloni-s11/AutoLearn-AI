import { useState, useEffect } from "react";
import {
  User, Mail, Lock, Pencil, Check, X, Loader2,
  ShieldCheck, KeyRound, BookOpen, Target, Brain,
} from "lucide-react";
import { useStudy } from "@/context/StudyContext";
import { toast } from "sonner";

interface ProfileData {
  username: string;
  email: string;
  auth_provider: string;
}

interface EditState {
  username: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Inline editable field -------------------------------------------------------
function EditableField({
  label,
  value,
  icon: Icon,
  type = "text",
  editing,
  onEdit,
  onCancel,
  onSave,
  saving,
  children,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  type?: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card p-5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        {!editing ? (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1 text-xs font-bold text-green-500 hover:underline disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </button>
            <button
              onClick={onCancel}
              className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
          </div>
        )}
      </div>
      {!editing ? (
        <p className="font-semibold text-foreground text-base pl-1">
          {type === "password" ? "••••••••••••" : value || <span className="text-muted-foreground italic">Not set</span>}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

// Password section (separate — needs current + new + confirm) ------------------
function PasswordSection({
  authProvider,
  token,
  username,
}: {
  authProvider: string;
  token: string;
  username: string;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState({ current: "", next: "", confirm: "" });

  const handleSave = async () => {
    if (fields.next !== fields.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    if (fields.next.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.append("new_password", fields.next);
      if (authProvider === "local") form.append("current_password", fields.current);

      const res = await fetch("http://localhost:8000/auth/profile", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.detail || "Failed to update password"); return; }
      toast.success("Password updated successfully");
      setEditing(false);
      setFields({ current: "", next: "", confirm: "" });
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Password
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            <Pencil className="h-3 w-3" /> Change
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 text-xs font-bold text-green-500 hover:underline disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </button>
            <button
              onClick={() => { setEditing(false); setFields({ current: "", next: "", confirm: "" }); }}
              className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        <p className="font-semibold text-foreground text-base pl-1">••••••••••••</p>
      ) : (
        <div className="space-y-3 pt-1">
          {authProvider === "local" && (
            <input
              type="password"
              placeholder="Current password"
              value={fields.current}
              onChange={(e) => setFields({ ...fields, current: e.target.value })}
              className="w-full h-10 bg-muted/30 border border-border rounded-xl px-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
          )}
          <input
            type="password"
            placeholder="New password"
            value={fields.next}
            onChange={(e) => setFields({ ...fields, next: e.target.value })}
            className="w-full h-10 bg-muted/30 border border-border rounded-xl px-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={fields.confirm}
            onChange={(e) => setFields({ ...fields, confirm: e.target.value })}
            className="w-full h-10 bg-muted/30 border border-border rounded-xl px-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}

// Main Page -------------------------------------------------------------------
export default function ProfilePage() {
  const { user, token, login, sessions, quizStats } = useStudy();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [editingField, setEditingField] = useState<"username" | "email" | null>(null);
  const [editValues, setEditValues] = useState<EditState>({
    username: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);

  // Fetch profile on mount
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch("http://localhost:8000/auth/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: ProfileData = await res.json();
          setProfile(data);
          setEditValues((prev) => ({ ...prev, username: data.username, email: data.email }));
        }
      } catch {
        toast.error("Failed to load profile");
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [token]);

  const startEdit = (field: "username" | "email") => {
    setEditingField(field);
    setEditValues((prev) => ({
      ...prev,
      username: profile?.username ?? "",
      email: profile?.email ?? "",
    }));
  };

  const cancelEdit = () => setEditingField(null);

  const saveField = async (field: "username" | "email") => {
    if (!token || !profile) return;
    setSaving(true);
    try {
      const form = new FormData();
      if (field === "username") form.append("new_username", editValues.username);
      if (field === "email") form.append("new_email", editValues.email);

      const res = await fetch("http://localhost:8000/auth/profile", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.detail || "Update failed"); return; }

      // If username changed, refresh the JWT and context
      if (data.access_token) {
        login(data.access_token, data.username);
      }
      setProfile((prev) => prev ? { ...prev, [field]: field === "username" ? data.username : editValues.email } : prev);
      toast.success(`${field === "username" ? "Username" : "Email"} updated`);
      setEditingField(null);
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  const quizAccuracy = quizStats.totalQuestions > 0
    ? `${Math.round((quizStats.totalCorrect / quizStats.totalQuestions) * 100)}%`
    : "—";

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-5">
        <div className="h-20 w-20 rounded-3xl gradient-primary-bg flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-primary/20 shrink-0">
          {profile?.username?.[0]?.toUpperCase() ?? "U"}
        </div>
        <div>
          <h1 className="text-3xl font-black font-heading text-foreground">{profile?.username}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{profile?.email || "No email set"}</p>
          {profile?.auth_provider === "google" && (
            <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              <ShieldCheck className="h-3 w-3" /> Google Account
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Sessions", value: sessions.length, icon: BookOpen, color: "text-primary" },
          { label: "Quiz Accuracy", value: quizAccuracy, icon: Target, color: "text-secondary" },
          { label: "AI Insights", value: sessions.length * 42, icon: Brain, color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4 text-center">
            <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
            <p className="text-xl font-black text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-bold mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Profile Fields */}
      <div className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground px-1">Account Details</h2>

        {/* Username */}
        <EditableField
          label="Username"
          value={profile?.username ?? ""}
          icon={User}
          editing={editingField === "username"}
          onEdit={() => startEdit("username")}
          onCancel={cancelEdit}
          onSave={() => saveField("username")}
          saving={saving}
        >
          <input
            type="text"
            value={editValues.username}
            onChange={(e) => setEditValues({ ...editValues, username: e.target.value })}
            className="w-full h-10 bg-muted/30 border border-border rounded-xl px-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </EditableField>

        {/* Email */}
        <EditableField
          label="Email"
          value={profile?.email ?? ""}
          icon={Mail}
          editing={editingField === "email"}
          onEdit={() => startEdit("email")}
          onCancel={cancelEdit}
          onSave={() => saveField("email")}
          saving={saving}
        >
          <input
            type="email"
            value={editValues.email}
            onChange={(e) => setEditValues({ ...editValues, email: e.target.value })}
            className="w-full h-10 bg-muted/30 border border-border rounded-xl px-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </EditableField>

        {/* Password */}
        <PasswordSection
          authProvider={profile?.auth_provider ?? "local"}
          token={token ?? ""}
          username={profile?.username ?? ""}
        />
      </div>

      {/* Note about forgot-password */}
      <div className="glass-card p-4 flex items-start gap-3 border-l-4 border-l-primary">
        <KeyRound className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          If you used <span className="font-semibold text-foreground">Forgot Password</span>, the temporary password sent to your email is already active. You can change it here using the password field above.
        </p>
      </div>
    </div>
  );
}
