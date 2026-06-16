"""
Compute all analysis metrics and write JSON to web/public/data/.
Run after build_dataset.py to refresh the website.
"""
import json, os, re
from pathlib import Path
import pandas as pd
import numpy as np
from scipy import stats as scipy_stats
from dotenv import load_dotenv

load_dotenv()

OUT = Path("web/public/data")
OUT.mkdir(parents=True, exist_ok=True)

ATK = {
    "Shot On Target","Shot Off Target","Shot Blocked",
    "Shot Hit Woodwork","Goal","Goal - Header","Goal - Own Goal","Corner Awarded",
}
WINDOW = 10

# ── load ──────────────────────────────────────────────────────────────────────
events = pd.read_csv("data/wc2026_events.csv")
breaks = pd.read_csv("data/wc2026_breaks.csv")
atk    = events[events["event_type"].isin(ATK) & (events["team"] != "unknown")].copy()

# ── build per-team-break table ────────────────────────────────────────────────
rows = []
for _, brk in breaks.iterrows():
    mid, bstart, bend = brk["event_id"], brk["break_start"], brk["break_end"]
    m_atk = atk[atk["event_id"] == mid]
    pre   = m_atk[m_atk["minute"].between(bstart - WINDOW, bstart)]
    post  = m_atk[m_atk["minute"].between(bend, bend + WINDOW)]
    for team in m_atk["team"].unique():
        opp    = brk["away_team"] if team == brk["home_team"] else brk["home_team"]
        n_pre  = len(pre[pre["team"] == team])
        n_post = len(post[post["team"] == team])
        rows.append({
            "team":          team,
            "opponent":      opp,
            "half":          int(brk["half"]),
            "match_label":   f"{brk['home_team']} v {brk['away_team']}",
            "event_id":      mid,
            "break_start":   round(float(bstart), 1),
            "break_end":     round(float(bend),   1),
            "display_start": brk["display_start"],
            "pre_rate":      round(n_pre  / WINDOW, 4),
            "post_rate":     round(n_post / WINDOW, 4),
            "delta":         round((n_post - n_pre) / WINDOW, 4),
            "was_pressing":  bool(n_pre >= 2),
        })

df = pd.DataFrame(rows)

# ── Groq helper ───────────────────────────────────────────────────────────────
GROQ_KEY = os.getenv("GROQ_API_KEY", "")

def gpt(prompt: str) -> str:
    if not GROQ_KEY:
        return ""
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_KEY)
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.4,
            max_tokens=180,
            messages=[
                {"role": "system", "content":
                    "You are a sports data analyst explaining FIFA World Cup 2026 hydration break "
                    "statistics. Write exactly one paragraph (3-4 sentences), plain English, no "
                    "bullet points, no headers. Focus on what the numbers mean in real match terms."},
                {"role": "user", "content": prompt},
            ],
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"  Groq error: {e}")
        return ""

def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

# ═════════════════════════════════════════════════════════════════════════════
# overview.json
# ═════════════════════════════════════════════════════════════════════════════
print("Building overview.json…")

n_matches = int(events["event_id"].nunique())
n_breaks  = int(len(breaks))
pressing  = df[df["was_pressing"]]
lost_pct  = round((pressing["delta"] < 0).mean() * 100)
gain_pct  = round((df[~df["was_pressing"]]["delta"] >= 0).mean() * 100)

# timeline
atk_full = events[events["event_type"].isin(ATK) & (events["team"] != "unknown")].copy()
atk_full["win"] = (atk_full["minute"] // 5 * 5).astype(int)
avg = (atk_full[atk_full["win"] <= 90]
       .groupby(["event_id","win"]).size()
       .reset_index(name="n")
       .groupby("win")["n"]
       .agg(["mean","sem"])
       .reset_index())
b1_avg = round(float(breaks[breaks["half"]==1]["break_start"].mean()), 1)
b2_avg = round(float(breaks[breaks["half"]==2]["break_start"].mean()), 1)

timeline = [
    {"minute": int(r["win"]), "avg": round(float(r["mean"]),3),
     "upper": round(float(r["mean"]+r["sem"]),3),
     "lower": round(max(float(r["mean"]-r["sem"]),0),3)}
    for _, r in avg.iterrows()
]

# scatter (pressing teams)
scatter = {}
for h in [1, 2]:
    sub = df[(df["half"]==h) & df["was_pressing"]]
    scatter[f"half{h}"] = [
        {"team": r["team"], "pre": r["pre_rate"], "post": r["post_rate"],
         "delta": r["delta"], "pressing": True}
        for _, r in sub.iterrows()
    ]

# delta bars
deltas = {}
for h in [1, 2]:
    sub = df[df["half"]==h].sort_values("delta")
    deltas[f"half{h}"] = [
        {"team": r["team"], "delta": r["delta"], "pressing": r["was_pressing"]}
        for _, r in sub.iterrows()
    ]

# summary bars
summary = {}
for h in [1, 2]:
    sub    = df[df["half"]==h]
    pr     = sub[sub["was_pressing"]]["delta"]
    npr    = sub[~sub["was_pressing"]]["delta"]
    try:    _, pval = scipy_stats.mannwhitneyu(pr, npr, alternative="two-sided")
    except: pval = float("nan")
    summary[f"half{h}"] = {
        "pressing":    {"mean": round(float(pr.mean()),4),  "sem": round(float(pr.sem()),4),  "n": int(len(pr))},
        "notpressing": {"mean": round(float(npr.mean()),4), "sem": round(float(npr.sem()),4), "n": int(len(npr))},
        "pvalue":      round(float(pval),4) if not np.isnan(pval) else None,
    }

print("  Generating overview AI insights…")
insights = {
    "timeline": gpt(
        f"WC2026 attacking pressure (shots+corners+goals) averaged across {n_matches} matches, "
        f"plotted in 5-minute windows. Hydration breaks occur at ~{b1_avg}' (1st half) and ~{b2_avg}' (2nd half). "
        f"Describe what the pressure pattern reveals about how teams build rhythm and how the break timing fits."
    ),
    "scatter": gpt(
        f"In WC2026, teams pressing actively (≥2 attacks in 10 min before break) almost always lose momentum after it. "
        f"1st half break: {(df[(df['half']==1)&df['was_pressing']]['delta']<0).sum()} of "
        f"{(df['half']==1).sum() and df[(df['half']==1)&df['was_pressing']].shape[0]} pressing teams dropped. "
        f"2nd half: {(df[(df['half']==2)&df['was_pressing']]['delta']<0).sum()} of "
        f"{df[(df['half']==2)&df['was_pressing']].shape[0]} dropped. Each point on the scatter is one team — "
        f"below the diagonal means they lost momentum. Explain what this shows."
    ),
    "deltas": gpt(
        f"Across all WC2026 matches, mean delta at 1st half break: "
        f"{df[df['half']==1]['delta'].mean():+.3f} actions/min; 2nd half: "
        f"{df[df['half']==2]['delta'].mean():+.3f} actions/min. "
        f"Teams that were pressing (★) dominate the negative side. Non-pressing teams cluster on the positive side. "
        f"Explain what this distribution shows about the break as a momentum disruptor."
    ),
    "summary": gpt(
        f"Pressing teams dropped by {df[(df['half']==1)&df['was_pressing']]['delta'].mean():+.3f}/min at 1st half break "
        f"while non-pressing gained {df[(df['half']==1)&~df['was_pressing']]['delta'].mean():+.3f}/min "
        f"(p={summary['half1']['pvalue']}). "
        f"At 2nd half break: pressing dropped {df[(df['half']==2)&df['was_pressing']]['delta'].mean():+.3f}, "
        f"non-pressing gained {df[(df['half']==2)&~df['was_pressing']]['delta'].mean():+.3f} "
        f"(p={summary['half2']['pvalue']}). Explain the equalizer effect."
    ),
}

overview = {
    "stats":       {"matches": n_matches, "breaks": n_breaks, "pressing_lost_pct": lost_pct, "passive_gained_pct": gain_pct},
    "break_times": {"half1": b1_avg, "half2": b2_avg},
    "timeline":    timeline,
    "scatter":     scatter,
    "deltas":      deltas,
    "summary":     summary,
    "insights":    insights,
}
(OUT/"overview.json").write_text(json.dumps(overview, indent=2))
print("  overview.json written")

# ═════════════════════════════════════════════════════════════════════════════
# matches.json  +  match/{id}.json
# ═════════════════════════════════════════════════════════════════════════════
print("Building match files…")
(OUT/"match").mkdir(exist_ok=True)

matches_meta = []
matches_list = breaks[["event_id","home_team","away_team"]].drop_duplicates("event_id")

for _, mr in matches_list.iterrows():
    mid, home, away = mr["event_id"], mr["home_team"], mr["away_team"]
    m_atk    = atk[atk["event_id"] == mid].copy()
    m_breaks = breaks[breaks["event_id"] == mid].reset_index(drop=True)

    # timeline per team
    m_atk["win"] = (m_atk["minute"] // 5 * 5).astype(int)
    max_min  = int(m_atk["win"].max()) if not m_atk.empty else 90
    all_wins = list(range(0, max_min + 5, 5))
    timeline_data = []
    for win in all_wins:
        row = {"minute": win}
        for team, key in [(home,"home"),(away,"away")]:
            row[key] = int((m_atk[(m_atk["team"]==team) & (m_atk["win"]==win)].shape[0]))
        timeline_data.append(row)

    # breaks
    brk_data, ctx_parts = [], []
    for _, brk in m_breaks.iterrows():
        pre  = m_atk[m_atk["minute"].between(brk["break_start"]-WINDOW, brk["break_start"])]
        post = m_atk[m_atk["minute"].between(brk["break_end"], brk["break_end"]+WINDOW)]
        h_pre  = len(pre[pre["team"]==home]);  h_post = len(post[post["team"]==home])
        a_pre  = len(pre[pre["team"]==away]);  a_post = len(post[post["team"]==away])
        entry  = {
            "half":        int(brk["half"]),
            "break_start": round(float(brk["break_start"]),1),
            "break_end":   round(float(brk["break_end"]),1),
            "display":     brk["display_start"],
            "home_pre":  round(h_pre/WINDOW,4), "home_post": round(h_post/WINDOW,4),
            "home_delta":round((h_post-h_pre)/WINDOW,4),
            "away_pre":  round(a_pre/WINDOW,4), "away_post": round(a_post/WINDOW,4),
            "away_delta":round((a_post-a_pre)/WINDOW,4),
        }
        brk_data.append(entry)
        ctx_parts.append(
            f"{home} at break {int(brk['half'])} (~{brk['display_start']}): "
            f"{h_pre}→{h_post} actions (Δ{(h_post-h_pre)/WINDOW:+.2f}/min); "
            f"{away}: {a_pre}→{a_post} (Δ{(a_post-a_pre)/WINDOW:+.2f}/min)"
        )

    insight = gpt(
        f"Match: {home} vs {away}. {'; '.join(ctx_parts)}. "
        f"Describe what happened to each team's attacking momentum at the hydration breaks, "
        f"and which team benefited more overall."
    )

    match_doc = {
        "event_id": mid, "home": home, "away": away,
        "timeline": timeline_data, "breaks": brk_data, "insight": insight,
        "home_color": "#3b82f6", "away_color": "#ef4444",
    }
    (OUT/"match"/f"{mid}.json").write_text(json.dumps(match_doc, indent=2))
    matches_meta.append({"event_id": mid, "home": home, "away": away,
                          "label": f"{home} vs {away}"})
    print(f"  {home} vs {away}")

(OUT/"matches.json").write_text(json.dumps(matches_meta, indent=2))

# ═════════════════════════════════════════════════════════════════════════════
# teams.json  +  team/{slug}.json
# ═════════════════════════════════════════════════════════════════════════════
print("Building team files…")
(OUT/"team").mkdir(exist_ok=True)

all_teams = sorted(df["team"].unique())
teams_meta = []

for team in all_teams:
    td     = df[df["team"]==team]
    press  = td[td["was_pressing"]]
    nonpr  = td[~td["was_pressing"]]
    gained = int((td["delta"]>=0).sum())
    lost   = int((td["delta"]<0).sum())
    mean_d = round(float(td["delta"].mean()),4)

    verdict = ("hurt" if mean_d < -0.05 else "helped" if mean_d > 0.05 else "neutral")

    insight = gpt(
        f"Team: {team}. Across {len(td)} hydration breaks in WC2026: "
        f"gained momentum in {gained}/{len(td)} breaks (mean Δ {mean_d:+.3f}/min). "
        f"When pressing before ({len(press)} times): avg Δ {press['delta'].mean():+.3f}/min, "
        f"kept momentum {(press['delta']>=0).sum()}/{len(press)} times. "
        f"When NOT pressing ({len(nonpr)} times): avg Δ {nonpr['delta'].mean():+.3f}/min. "
        f"Write a paragraph about how breaks affect {team}."
    )

    slug = slugify(team)
    team_doc = {
        "team":    team, "slug": slug,
        "stats": {
            "total_breaks":    int(len(td)),
            "gained":          gained,
            "lost":            lost,
            "mean_delta":      mean_d,
            "verdict":         verdict,
            "pressing_n":      int(len(press)),
            "pressing_mean":   round(float(press["delta"].mean()),4) if len(press) else 0,
            "pressing_kept":   int((press["delta"]>=0).sum()),
            "nonpressing_n":   int(len(nonpr)),
            "nonpressing_mean":round(float(nonpr["delta"].mean()),4) if len(nonpr) else 0,
            "nonpressing_gained": int((nonpr["delta"]>=0).sum()),
            "half1_mean":      round(float(td[td["half"]==1]["delta"].mean()),4) if len(td[td["half"]==1]) else 0,
            "half2_mean":      round(float(td[td["half"]==2]["delta"].mean()),4) if len(td[td["half"]==2]) else 0,
        },
        "breaks": [
            {"opponent": r["opponent"], "half": r["half"], "match_label": r["match_label"],
             "pre_rate": r["pre_rate"], "post_rate": r["post_rate"],
             "delta": r["delta"], "pressing": bool(r["was_pressing"])}
            for _, r in td.iterrows()
        ],
        "insight": insight,
    }
    (OUT/"team"/f"{slug}.json").write_text(json.dumps(team_doc, indent=2))
    teams_meta.append({"team": team, "slug": slug, "verdict": verdict, "mean_delta": mean_d})
    print(f"  {team}")

(OUT/"teams.json").write_text(json.dumps(teams_meta, indent=2))
print(f"\nDone — {len(matches_meta)} matches, {len(all_teams)} teams exported to {OUT}")
