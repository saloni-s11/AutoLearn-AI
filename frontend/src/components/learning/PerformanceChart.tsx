import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { fetchExamHistory } from "@/api";
import { Loader2, TrendingUp, Trophy, Target } from "lucide-react";
import { format } from "date-fns";

export default function PerformanceChart() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await fetchExamHistory();
        const formatted = history.history.map((h: any) => ({
          name: format(new Date(h.timestamp), "MMM d"),
          accuracy: h.accuracy,
          correct: h.correct,
          total: h.total,
          title: h.title || "Study Session",
          fullDate: format(new Date(h.timestamp), "PPPP p")
        }));
        setData(formatted);
      } catch (e) {
        console.error("Failed to load history", e);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-accent/10 rounded-3xl border border-dashed border-primary/20 p-6 text-center">
        <Target className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
        <p className="text-muted-foreground font-medium">No exam data yet. Complete a quiz to see your progress!</p>
      </div>
    );
  }

  const latestAccuracy = data[data.length - 1].accuracy;
  const avgAccuracy = Math.round(data.reduce((acc, curr) => acc + curr.accuracy, 0) / data.length);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Latest Score</p>
            <p className="text-2xl font-black text-foreground">{latestAccuracy}%</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Average Accuracy</p>
            <p className="text-2xl font-black text-foreground">{avgAccuracy}%</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Tests Taken</p>
            <p className="text-2xl font-black text-foreground">{data.length}</p>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 h-[350px]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Learning Velocity
          </h3>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
             <div className="h-3 w-3 rounded-full bg-primary" /> Accuracy Over Time
          </div>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="glass-card p-3 border-primary/20 bg-slate-900/90 shadow-2xl backdrop-blur-xl">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">{data.fullDate}</p>
                      <p className="text-sm font-bold text-foreground mb-1">{data.title}</p>
                      <div className="flex items-center gap-4">
                        <p className="text-xl font-black text-primary">{data.accuracy}%</p>
                        <p className="text-xs text-muted-foreground">({data.correct}/{data.total} correct)</p>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area 
              type="monotone" 
              dataKey="accuracy" 
              stroke="#8b5cf6" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorAcc)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
