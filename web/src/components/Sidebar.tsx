"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Swords, Users } from "lucide-react";
import clsx from "clsx";

const nav = [
  { href: "/",        label: "Overview", icon: LayoutDashboard },
  { href: "/matches", label: "By Match", icon: Swords },
  { href: "/teams",   label: "By Team",  icon: Users },
];

// WC2026 official gradient: warm red → orange → gold → deep navy
const WC_GRADIENT = "linear-gradient(145deg, #C8102E 0%, #E8412A 20%, #F47B20 50%, #FFB800 72%, #003087 100%)";

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="w-60 shrink-0 h-screen bg-white border-r border-gray-100 flex flex-col">

      {/* ── Logo / branding ────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: WC_GRADIENT }}>
        {/* subtle radial highlight */}
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: "radial-gradient(ellipse at 20% 40%, rgba(255,255,255,0.18) 0%, transparent 65%)" }} />

        <div className="relative px-5 py-5 flex items-center gap-3">
          {/* Trophy SVG — simplified WC2026-style silhouette */}
          <div className="w-10 h-10 shrink-0 flex items-center justify-center
                          rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-sm">
            <svg viewBox="0 0 28 34" width="20" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* cup body */}
              <path d="M7 2h14l-2 12c0 3.3-2.7 6-6 6s-6-2.7-6-6L7 2z" fill="white" fillOpacity="0.95"/>
              {/* handles */}
              <path d="M7 4H3a3 3 0 003 3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M21 4h4a3 3 0 01-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              {/* stem */}
              <rect x="12" y="20" width="4" height="6" rx="1" fill="white" fillOpacity="0.95"/>
              {/* base */}
              <rect x="8" y="26" width="12" height="3" rx="1.5" fill="white"/>
              {/* star on cup */}
              <path d="M14 6l.6 1.8H16l-1.3 1 .5 1.8L14 9.5l-1.2 1.1.5-1.8L12 7.8h1.4L14 6z"
                    fill="white" fillOpacity="0.6"/>
            </svg>
          </div>

          <div>
            {/* FIFA label */}
            <p className="text-white/70 text-[9px] font-bold tracking-[0.2em] uppercase leading-none mb-0.5">
              FIFA
            </p>
            {/* World Cup 2026 */}
            <p className="text-white text-[13px] font-bold leading-tight">
              World Cup 2026
            </p>
            <p className="text-white/60 text-[10px] leading-tight mt-0.5">
              Break Analyzer
            </p>
          </div>
        </div>

        {/* bottom fade into white */}
        <div className="h-3" style={{
          background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.08))"
        }} />
      </div>

      {/* ── Nav ────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all",
                active
                  ? "text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              )}
              style={active ? { background: WC_GRADIENT } : {}}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-t border-gray-100">
        <p className="text-[11px] text-gray-400 font-medium">Data via ESPN</p>
        <p className="text-[11px] text-gray-300">AI insights via Groq</p>
      </div>
    </aside>
  );
}
