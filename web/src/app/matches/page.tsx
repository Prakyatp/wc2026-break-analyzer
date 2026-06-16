"use client";
import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, Legend,
} from "recharts";
import { Card, CardHeader, InsightBox } from "@/components/Card";

type MatchMeta = { event_id: string; home: string; away: string; label: string };
type BreakData = {
  half: number; display: string; break_start: number; break_end: number;
  home_pre: number; home_post: number; home_delta: number;
  away_pre: number; away_post: number; away_delta: number;
};
type MatchDetail = {
  event_id: string; home: string; away: string;
  timeline: Record<string, number>[];
  breaks: BreakData[];
  insight: string;
  home_color: string; away_color: string;
};

const AMBER = "#f59e0b";

function DeltaBadge({ v, label }: { v: number; label: string }) {
  const pos = v >= 0;
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${pos ? "bg-green-50" : "bg-red-50"}`}>
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-bold ${pos ? "text-green-600" : "text-red-500"}`}>
        {v >= 0 ? "▲" : "▼"} {Math.abs(v).toFixed(3)} / min
      </span>
    </div>
  );
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchMeta[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [detail, setDetail]   = useState<MatchDetail | null>(null);

  useEffect(() => {
    fetch("/data/matches.json").then(r => r.json()).then((m: MatchMeta[]) => {
      setMatches(m);
      if (m.length) setSelected(m[0].event_id);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setDetail(null);
    fetch(`/data/match/${selected}.json`).then(r => r.json()).then(setDetail);
  }, [selected]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold wc-text">Match Analysis</h1>
        <p className="text-sm text-gray-400 mt-1">
          Attacking pressure timeline and hydration break impact for each game.
        </p>
      </div>

      {/* match selector */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {matches.map(m => (
            <button key={m.event_id} onClick={() => setSelected(m.event_id)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all border ${
                selected === m.event_id
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
              }`}>
              {m.home} <span className="opacity-50">vs</span> {m.away}
            </button>
          ))}
        </div>
      </div>

      {!detail ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
      ) : (
        <>
          {/* timeline */}
          <Card className="mb-6">
            <CardHeader
              title={`${detail.home} vs ${detail.away}`}
              subtitle="Attacking actions per 5-minute window. Amber bands = hydration break zones."
            />
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={detail.timeline} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                <defs>
                  <linearGradient id="gHome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={detail.home_color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={detail.home_color} stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="gAway" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={detail.away_color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={detail.away_color} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="minute" tick={{ fontSize: 11, fill: "#94a3b8" }}
                       label={{ value: "Minute", position: "insideBottomRight", offset: -5, fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={28} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                  labelFormatter={(l) => `Minute ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Area type="monotone" dataKey="home" name={detail.home}
                      stroke={detail.home_color} strokeWidth={2} fill="url(#gHome)" dot={false} />
                <Area type="monotone" dataKey="away" name={detail.away}
                      stroke={detail.away_color} strokeWidth={2} fill="url(#gAway)" dot={false} />
                {detail.breaks.map((b, i) => (
                  <ReferenceLine key={i} x={b.break_start} stroke={AMBER} strokeWidth={2}
                                 strokeDasharray="5 3"
                                 label={{ value: `💧 B${b.half}`, position: "top", fontSize: 10, fill: AMBER }} />
                ))}
                <ReferenceLine x={45} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 4"
                               label={{ value: "HT", position: "top", fontSize: 10, fill: "#94a3b8" }} />
              </AreaChart>
            </ResponsiveContainer>
            <InsightBox text={detail.insight} />
          </Card>

          {/* break cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {detail.breaks.map((brk, i) => {
              const barData = [
                { label: "Before", home: brk.home_pre, away: brk.away_pre },
                { label: "After",  home: brk.home_post, away: brk.away_post },
              ];
              return (
                <Card key={i}>
                  <CardHeader
                    title={`Break ${brk.half} — ${brk.half === 1 ? "1st" : "2nd"} Half (~${brk.display})`}
                    subtitle="Attacking actions per minute before and after the break."
                  />
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={barData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={30} />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                        formatter={(v) => [`${Number(v).toFixed(3)} / min`]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="home" name={detail.home} fill={detail.home_color}
                           fillOpacity={0.85} radius={[4,4,0,0]} maxBarSize={60} />
                      <Bar dataKey="away" name={detail.away} fill={detail.away_color}
                           fillOpacity={0.85} radius={[4,4,0,0]} maxBarSize={60} />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="mt-4 space-y-2">
                    <DeltaBadge v={brk.home_delta} label={detail.home} />
                    <DeltaBadge v={brk.away_delta} label={detail.away} />
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
