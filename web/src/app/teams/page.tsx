"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { Card, CardHeader, InsightBox, MetricCard } from "@/components/Card";

type TeamMeta   = { team: string; slug: string; verdict: string; mean_delta: number };
type BreakEntry = {
  opponent: string; half: number; match_label: string;
  pre_rate: number; post_rate: number; delta: number; pressing: boolean;
};
type TeamDetail = {
  team: string; slug: string;
  stats: {
    total_breaks: number; gained: number; lost: number; mean_delta: number; verdict: string;
    pressing_n: number; pressing_mean: number; pressing_kept: number;
    nonpressing_n: number; nonpressing_mean: number; nonpressing_gained: number;
    half1_mean: number; half2_mean: number;
  };
  breaks: BreakEntry[];
  insight: string;
};

const GREEN = "#16a34a";
const RED   = "#dc2626";
const BLUE  = "#2563eb";

const verdictLabel: Record<string,string> = {
  hurt:    "Breaks hurt this team",
  helped:  "Breaks help this team",
  neutral: "Breaks have little effect",
};
const verdictColor: Record<string,string> = {
  hurt:    "text-red-500 bg-red-50 border-red-200",
  helped:  "text-green-600 bg-green-50 border-green-200",
  neutral: "text-gray-500 bg-gray-50 border-gray-200",
};

export default function TeamsPage() {
  const [teams,    setTeams]    = useState<TeamMeta[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [detail,   setDetail]   = useState<TeamDetail | null>(null);

  useEffect(() => {
    fetch("/data/teams.json").then(r => r.json()).then((t: TeamMeta[]) => {
      setTeams(t);
      if (t.length) setSelected(t[0].slug);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setDetail(null);
    fetch(`/data/team/${selected}.json`).then(r => r.json()).then(setDetail);
  }, [selected]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold wc-text">Team Analysis</h1>
        <p className="text-sm text-gray-400 mt-1">
          How each team is affected by hydration breaks across all their matches.
        </p>
      </div>

      {/* team grid selector */}
      <div className="mb-6 flex flex-wrap gap-2">
        {teams.map(t => (
          <button key={t.slug} onClick={() => setSelected(t.slug)}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all border ${
              selected === t.slug
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
            }`}>
            {t.team}
          </button>
        ))}
      </div>

      {!detail ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
      ) : (
        <>
          {/* verdict badge */}
          <div className={`inline-block mb-6 px-4 py-2 rounded-xl border text-sm font-semibold ${verdictColor[detail.stats.verdict]}`}>
            {verdictLabel[detail.stats.verdict]}
          </div>

          {/* stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Breaks played"   value={detail.stats.total_breaks} color="blue" />
            <MetricCard label="Mean Δ / min"
              value={`${detail.stats.mean_delta >= 0 ? "+" : ""}${detail.stats.mean_delta.toFixed(3)}`}
              color={detail.stats.mean_delta >= 0 ? "green" : "red"} />
            <MetricCard label="Gained momentum" value={`${detail.stats.gained}/${detail.stats.total_breaks}`} color="green" />
            <MetricCard label="Lost momentum"   value={`${detail.stats.lost}/${detail.stats.total_breaks}`}  color="red" />
          </div>

          {/* main chart */}
          <Card className="mb-6">
            <CardHeader
              title={`${detail.team} — Change at each break`}
              subtitle="Green = gained momentum, red = lost it. ★ marks breaks where they were pressing before."
            />
            <ResponsiveContainer width="100%" height={Math.max(240, detail.breaks.length * 40)}>
              <BarChart
                layout="vertical"
                data={detail.breaks}
                margin={{ top: 5, right: 60, bottom: 5, left: 160 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }}
                       label={{ value: "Δ actions / min (after − before)", position: "insideBottomRight", offset: -5, fontSize: 11, fill: "#94a3b8" }} />
                <YAxis type="category" dataKey="opponent" width={155}
                       tick={{ fontSize: 11, fill: "#64748b" }}
                       tickFormatter={(v: string, i: number) => {
                         const b = detail.breaks[i];
                         return b ? `${v.slice(0,13)}  H${b.half}${b.pressing ? " ★" : ""}` : v;
                       }} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v: any, _: any, p: any) => [
                    `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(3)} / min`,
                    p?.payload?.pressing ? "Was pressing ★" : "Not pressing",
                  ]}
                  labelFormatter={(_, p) => p[0]?.payload?.match_label ?? ""}
                />
                <ReferenceLine x={0} stroke="#0f172a" strokeWidth={1.5} />
                <ReferenceLine x={detail.stats.mean_delta} stroke={BLUE} strokeWidth={1.5}
                               strokeDasharray="5 3"
                               label={{ value: `Mean ${detail.stats.mean_delta >= 0 ? "+" : ""}${detail.stats.mean_delta.toFixed(3)}`, position: "top", fontSize: 10, fill: BLUE }} />
                <Bar dataKey="delta" radius={[0, 4, 4, 0]}>
                  {detail.breaks.map((b, i) => (
                    <Cell key={i} fill={b.delta >= 0 ? GREEN : RED} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <InsightBox text={detail.insight} />
          </Card>

          {/* pressing vs not pressing breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {[
              { label: "When pressing before the break", n: detail.stats.pressing_n,    mean: detail.stats.pressing_mean,    kept: detail.stats.pressing_kept,       type: "kept" },
              { label: "When NOT pressing before",       n: detail.stats.nonpressing_n, mean: detail.stats.nonpressing_mean, kept: detail.stats.nonpressing_gained,  type: "gained" },
            ].map(({ label, n, mean, kept, type }) => (
              <Card key={label}>
                <CardHeader title={label} subtitle={`${n} break${n !== 1 ? "s" : ""}`} />
                <div className="flex items-end justify-between">
                  <div>
                    <p className={`text-3xl font-bold ${mean >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {mean >= 0 ? "+" : ""}{mean.toFixed(3)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">avg Δ / min</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-800">{kept}/{n}</p>
                    <p className="text-xs text-gray-400">{type} momentum</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* half breakdown */}
          <Card>
            <CardHeader title="By half" subtitle="Average delta split between 1st and 2nd half breaks." />
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "1st Half Break (~23')", value: detail.stats.half1_mean },
                { label: "2nd Half Break (~68')", value: detail.stats.half2_mean },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${value >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {value >= 0 ? "+" : ""}{value.toFixed(3)}
                  </p>
                  <p className="text-xs text-gray-400">Δ / min</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
