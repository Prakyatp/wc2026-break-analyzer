"use client";
import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, Legend,
} from "recharts";
import { MetricCard, Card, CardHeader, InsightBox } from "@/components/Card";

type Overview = {
  stats: { matches: number; breaks: number; pressing_lost_pct: number; passive_gained_pct: number };
  break_times: { half1: number; half2: number };
  timeline: { minute: number; avg: number; upper: number; lower: number }[];
  scatter: { half1: ScatterPoint[]; half2: ScatterPoint[] };
  deltas: { half1: DeltaPoint[]; half2: DeltaPoint[] };
  summary: {
    half1: HalfSummary;
    half2: HalfSummary;
  };
  insights: { timeline: string; scatter: string; deltas: string; summary: string };
};
type ScatterPoint = { team: string; pre: number; post: number; delta: number; pressing: boolean };
type DeltaPoint   = { team: string; delta: number; pressing: boolean };
type HalfSummary  = {
  pressing:    { mean: number; sem: number; n: number };
  notpressing: { mean: number; sem: number; n: number };
  pvalue:      number | null;
};

const BLUE  = "#2563eb";
const GREEN = "#16a34a";
const RED   = "#dc2626";
const AMBER = "#f59e0b";

function HalfTabs({ children, half, setHalf }: {
  children: React.ReactNode; half: 1|2; setHalf: (h: 1|2) => void
}) {
  return (
    <div>
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {([1,2] as const).map(h => (
          <button key={h} onClick={() => setHalf(h)}
            className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-all ${
              half === h ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {h === 1 ? "1st Half Break (~23')" : "2nd Half Break (~68')"}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [scatterHalf, setScatterHalf]   = useState<1|2>(1);
  const [deltaHalf,   setDeltaHalf]     = useState<1|2>(1);
  const [summaryHalf, setSummaryHalf]   = useState<1|2>(1);

  useEffect(() => {
    fetch("/data/overview.json").then(r => r.json()).then(setData);
  }, []);

  if (!data) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
      Loading…
    </div>
  );

  const { stats, timeline, break_times, scatter, deltas, summary, insights } = data;

  // scatter diagonal reference line
  const scatterData = scatter[`half${scatterHalf}` as "half1"|"half2"];
  const maxScatter  = Math.max(...scatterData.map(d => Math.max(d.pre, d.post)), 0.15) * 1.2;
  const diagLine    = [{ pre: 0, post: 0 }, { pre: maxScatter, post: maxScatter }];

  // delta data
  const deltaData = deltas[`half${deltaHalf}` as "half1"|"half2"];

  // summary bars
  const sumHalf = summary[`half${summaryHalf}` as "half1"|"half2"];
  const sumBars = [
    { name: "Pressing\nbefore break",    value: sumHalf.pressing.mean,    n: sumHalf.pressing.n },
    { name: "Not pressing\nbefore break", value: sumHalf.notpressing.mean, n: sumHalf.notpressing.n },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold wc-text">Overview</h1>
        <p className="text-sm text-gray-400 mt-1">
          Does the hydration break disrupt momentum — or level the playing field?
        </p>
      </div>

      {/* metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Matches analysed"       value={stats.matches}              color="blue"  />
        <MetricCard label="Drink breaks tracked"   value={stats.breaks}               color="amber" />
        <MetricCard label="Pressing teams that lost momentum" value={`${stats.pressing_lost_pct}%`} color="red" sub="after the break" />
        <MetricCard label="Passive teams that gained"        value={`${stats.passive_gained_pct}%`} color="green" sub="after the break" />
      </div>

      {/* Chart 1 — Timeline */}
      <Card className="mb-6">
        <CardHeader
          title="Attacking pressure across 90 minutes"
          subtitle="Average attacking actions per 5-minute window across all matches. Shaded bands show break zones."
        />
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={timeline} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="gradAvg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={BLUE} stopOpacity={0.15} />
                <stop offset="95%" stopColor={BLUE} stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="gradBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={BLUE} stopOpacity={0.06} />
                <stop offset="95%" stopColor={BLUE} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="minute" tick={{ fontSize: 11, fill: "#94a3b8" }}
                   label={{ value: "Match minute", position: "insideBottomRight", offset: -5, fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={30} />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
              formatter={(v: number) => [v.toFixed(2), "Avg actions"]}
              labelFormatter={(l) => `Minute ${l}`}
            />
            <Area type="monotone" dataKey="upper" stroke="none" fill="url(#gradBand)" />
            <Area type="monotone" dataKey="avg"   stroke={BLUE} strokeWidth={2}
                  fill="url(#gradAvg)" dot={false} />
            <ReferenceLine x={break_times.half1} stroke={AMBER} strokeWidth={2} strokeDasharray="5 3"
                           label={{ value: `💧 Break 1 (~${break_times.half1}')`, position: "top", fontSize: 11, fill: AMBER }} />
            <ReferenceLine x={break_times.half2} stroke={AMBER} strokeWidth={2} strokeDasharray="5 3"
                           label={{ value: `💧 Break 2 (~${break_times.half2}')`, position: "top", fontSize: 11, fill: AMBER }} />
            <ReferenceLine x={45} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 4"
                           label={{ value: "HT", position: "top", fontSize: 10, fill: "#94a3b8" }} />
          </AreaChart>
        </ResponsiveContainer>
        <InsightBox text={insights.timeline} />
      </Card>

      {/* Chart 2 — Scatter */}
      <Card className="mb-6">
        <CardHeader
          title="Did pressing teams keep their momentum?"
          subtitle="Each dot = one team. Points below the diagonal lost momentum after the break. Points above kept it."
        />
        <HalfTabs half={scatterHalf} setHalf={setScatterHalf}>
          <div className="flex gap-6">
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" dataKey="pre"  name="Before" domain={[0, maxScatter]}
                       tick={{ fontSize: 11, fill: "#94a3b8" }}
                       label={{ value: "Actions/min — BEFORE break", position: "insideBottom", offset: -15, fontSize: 11, fill: "#94a3b8" }} />
                <YAxis type="number" dataKey="post" name="After"  domain={[0, maxScatter]}
                       tick={{ fontSize: 11, fill: "#94a3b8" }} width={40}
                       label={{ value: "After", angle: -90, position: "insideLeft", fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.[0]) return null;
                    const d = payload[0].payload as ScatterPoint;
                    return (
                      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-3 text-xs">
                        <p className="font-semibold text-gray-900 mb-1">{d.team}</p>
                        <p className="text-gray-500">Before: <span className="font-medium text-gray-700">{d.pre.toFixed(3)}</span></p>
                        <p className="text-gray-500">After: <span className="font-medium text-gray-700">{d.post.toFixed(3)}</span></p>
                        <p className={`font-semibold mt-1 ${d.delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                          Δ {d.delta >= 0 ? "+" : ""}{d.delta.toFixed(3)}/min
                        </p>
                      </div>
                    );
                  }}
                />
                {/* diagonal y=x reference */}
                <Scatter data={diagLine} dataKey="post" line={{ stroke: "#cbd5e1", strokeWidth: 1.5, strokeDasharray: "5 3" }}
                         shape={() => <></>} legendType="none" />
                <Scatter
                  data={scatterData}
                  name="Team"
                  shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    const color = payload.delta >= 0 ? GREEN : RED;
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={7} fill={color} fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
                        <text x={cx + 9} y={cy + 4} fontSize={10} fill="#64748b">{payload.team.slice(0,10)}</text>
                      </g>
                    );
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
            {/* legend */}
            <div className="flex flex-col justify-center gap-3 min-w-[140px]">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-3 h-3 rounded-full bg-green-600 inline-block" />Kept momentum
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Lost momentum
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="w-6 border-t-2 border-dashed border-gray-300 inline-block" />No change line
              </div>
            </div>
          </div>
        </HalfTabs>
        <InsightBox text={insights.scatter} />
      </Card>

      {/* Chart 3 — Delta bars */}
      <Card className="mb-6">
        <CardHeader
          title="Change in pressing at each break — all teams"
          subtitle="Sorted by change. ★ = team was pressing before the break. Green = gained momentum, red = lost it."
        />
        <HalfTabs half={deltaHalf} setHalf={setDeltaHalf}>
          <ResponsiveContainer width="100%" height={Math.max(320, deltaData.length * 22)}>
            <BarChart layout="vertical" data={deltaData}
                      margin={{ top: 5, right: 60, bottom: 5, left: 110 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }}
                     label={{ value: "Δ actions / min (after − before)", position: "insideBottomRight", offset: -5, fontSize: 11, fill: "#94a3b8" }} />
              <YAxis type="category" dataKey="team" tick={{ fontSize: 11, fill: "#64748b" }} width={105}
                     tickFormatter={(v: string, i: number) => {
                       const d = deltaData[i];
                       return d ? `${v.slice(0,13)}${d.pressing ? " ★" : ""}` : v;
                     }} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                formatter={(v: number, _: string, p: any) => [
                  `${v >= 0 ? "+" : ""}${v.toFixed(3)} / min`,
                  p.payload.pressing ? "Pressing ★" : "Not pressing"
                ]}
              />
              <ReferenceLine x={0} stroke="#0f172a" strokeWidth={1.5} />
              <Bar dataKey="delta" radius={[0, 4, 4, 0]}>
                {deltaData.map((d, i) => (
                  <Cell key={i} fill={d.delta >= 0 ? GREEN : RED} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </HalfTabs>
        <InsightBox text={insights.deltas} />
      </Card>

      {/* Chart 4 — Summary bars */}
      <Card className="mb-6">
        <CardHeader
          title="The equalizer effect"
          subtitle="Average change in attacking rate after the break, comparing teams that were pressing vs those that weren't."
        />
        <HalfTabs half={summaryHalf} setHalf={setSummaryHalf}>
          <div className="flex items-start gap-8">
            <ResponsiveContainer width="60%" height={280}>
              <BarChart data={sumBars} margin={{ top: 20, right: 30, bottom: 40, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={40} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v: number, _, p) => [
                    `${v >= 0 ? "+" : ""}${v.toFixed(3)} / min (n=${p.payload.n})`,
                    "Mean Δ"
                  ]}
                />
                <ReferenceLine y={0} stroke="#0f172a" strokeWidth={1.5} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={90}
                     label={{ position: "top", fontSize: 12, fontWeight: 700,
                              formatter: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(3)}` }}>
                  <Cell fill={RED}   fillOpacity={0.85} />
                  <Cell fill={GREEN} fillOpacity={0.85} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* stats panel */}
            <div className="flex-1 space-y-4 pt-2">
              {[
                { label: "Pressing teams", data: sumHalf.pressing, color: RED },
                { label: "Non-pressing teams", data: sumHalf.notpressing, color: GREEN },
              ].map(({ label, data: d, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[12px] font-semibold text-gray-500 mb-2">{label}</p>
                  <p className={`text-2xl font-bold`} style={{ color }}>
                    {d.mean >= 0 ? "+" : ""}{d.mean.toFixed(3)}
                  </p>
                  <p className="text-xs text-gray-400">avg Δ / min  ·  n = {d.n}</p>
                </div>
              ))}
              {sumHalf.pvalue !== null && (
                <div className="text-xs text-gray-400 pt-1">
                  Mann-Whitney p = <span className="font-semibold text-gray-600">{sumHalf.pvalue.toFixed(3)}</span>
                  {sumHalf.pvalue < 0.05 && <span className="ml-2 text-green-600 font-semibold">Statistically significant ✓</span>}
                </div>
              )}
            </div>
          </div>
        </HalfTabs>
        <InsightBox text={insights.summary} />
      </Card>
    </div>
  );
}
