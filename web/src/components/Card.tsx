import clsx from "clsx";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("bg-white rounded-2xl border border-gray-100 shadow-sm p-6", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-[13px] text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

export function MetricCard({
  label, value, sub, color = "blue",
}: { label: string; value: string | number; sub?: string; color?: "blue"|"green"|"red"|"amber" }) {
  const isBlue = color === "blue";
  const accent = isBlue ? "" : {
    green: "text-green-600",
    red:   "text-red-500",
    amber: "text-amber-500",
    blue:  "",
  }[color];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-[12px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${isBlue ? "wc-text" : accent}`}>{value}</p>
      {sub && <p className="text-[12px] text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export function InsightBox({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-xl px-4 py-3">
      <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-1">AI Insight</p>
      <p className="text-[13px] text-slate-700 leading-relaxed">{text}</p>
    </div>
  );
}
