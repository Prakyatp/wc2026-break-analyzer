"""
Fetch ESPN commentary for all played WC2026 matches and build two CSV files:
  data/wc2026_events.csv  — every timed event (shot, foul, corner…) per match per team
  data/wc2026_breaks.csv  — exact drinks-break start/end minutes per match

Run once to backfill, then re-run daily to add new matches.
"""
import urllib.request
import json
import csv
import time
from datetime import date, timedelta
from pathlib import Path

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/json",
}

SHOT_TYPES = {
    "Shot on Target", "Shot Blocked", "Shot Missed", "Shot Hit Woodwork",
    "Goal", "Goal - Header", "Goal - Own Goal",
}
PRESSING_TYPES = {"Foul", "Yellow Card", "Red Card"}
CORNER_TYPES   = {"Corner Awarded"}


def fetch(url: str) -> dict:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=12) as r:
        return json.loads(r.read())


def get_match_ids(from_date: date, to_date: date) -> list[dict]:
    matches = []
    d = from_date
    while d <= to_date:
        url = (
            "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world"
            f"/scoreboard?dates={d.strftime('%Y%m%d')}"
        )
        try:
            data = fetch(url)
        except Exception as e:
            print(f"  scoreboard {d}: {e}")
            d += timedelta(days=1)
            continue

        for ev in data.get("events", []):
            status = ev.get("status", {}).get("type", {}).get("name", "")
            if "SCHEDULED" in status:
                d += timedelta(days=1)
                continue
            comps = ev.get("competitions", [{}])[0]
            competitors = comps.get("competitors", [])
            home = next((c for c in competitors if c.get("homeAway") == "home"), {})
            away = next((c for c in competitors if c.get("homeAway") == "away"), {})
            matches.append({
                "event_id":   ev["id"],
                "date":       d.isoformat(),
                "home_team":  home.get("team", {}).get("displayName", "?"),
                "away_team":  away.get("team", {}).get("displayName", "?"),
                "home_id":    home.get("team", {}).get("id", ""),
                "away_id":    away.get("team", {}).get("id", ""),
                "status":     status,
            })
        d += timedelta(days=1)
    return matches


FIFA_ALIASES = {
    "korea republic":           "south korea",
    "usa":                      "united states",
    "ir iran":                  "iran",
    "côte d'ivoire":            "ivory coast",
    "cabo verde":               "cape verde",
    "bosnia and herzegovina":   "bosnia-herzegovina",
    "türkiye":                  "turkey",
}

def _normalize(name: str) -> str:
    return FIFA_ALIASES.get(name.lower(), name.lower())


def parse_summary(event_id: str, home_team: str, away_team: str,
                  home_id: str, away_id: str, match_date: str):
    """
    Returns (events_rows, breaks_rows) for a single match.
    """
    url = (
        "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world"
        f"/summary?event={event_id}"
    )
    data = fetch(url)

    events_rows = []
    breaks_rows = []

    # ── Drinks breaks from keyEvents ─────────────────────────────────────
    pending_break_start = None
    for ke in data.get("keyEvents", []):
        etype = ke.get("type", {}).get("text", "")
        text  = ke.get("text", "")
        secs  = ke.get("clock", {}).get("value")
        disp  = ke.get("clock", {}).get("displayValue", "")
        if secs is None:
            continue
        minute = round(secs / 60, 1)

        if etype == "Start Delay" and "drink" in text.lower():
            pending_break_start = {"minute": minute, "display": disp}

        elif etype == "End Delay" and pending_break_start:
            breaks_rows.append({
                "event_id":    event_id,
                "date":        match_date,
                "home_team":   home_team,
                "away_team":   away_team,
                "break_start": pending_break_start["minute"],
                "break_end":   minute,
                "duration_s":  round((minute - pending_break_start["minute"]) * 60),
                "display_start": pending_break_start["display"],
                "display_end":   disp,
                "half":        1 if minute < 46 else 2,
            })
            pending_break_start = None

    # ── Per-event rows from commentary ────────────────────────────────────
    for c in data.get("commentary", []):
        secs = c.get("time", {}).get("value")
        if not secs:
            continue
        minute = round(secs / 60, 1)
        disp   = c.get("time", {}).get("displayValue", "")
        text   = c.get("text", "")

        play  = c.get("play", {}) or {}
        etype = play.get("type", {}).get("text", "")
        if not etype:
            continue

        # Team attribution: try athlete team id first, fall back to text parse
        team_name = "unknown"
        athletes  = play.get("athletes", []) or []
        if athletes:
            tid = athletes[0].get("team", {}).get("id", "")
            if tid == home_id:
                team_name = home_team
            elif tid == away_id:
                team_name = away_team

        if team_name == "unknown":
            import re
            home_n = _normalize(home_team)
            away_n = _normalize(away_team)

            def match_team(candidate: str) -> str:
                c = _normalize(candidate)
                if c == home_n or home_n.startswith(c) or c.startswith(home_n):
                    return home_team
                if c == away_n or away_n.startswith(c) or c.startswith(away_n):
                    return away_team
                return "unknown"

            # Pattern 1: "Corner, Mexico." / "Offside, South Africa."
            m = re.match(r'^[^,]+,\s+([^.]+)\.', text)
            if m:
                team_name = match_team(m.group(1).strip())

        if team_name == "unknown":
            # Pattern 2: "Player (Team) does X"
            for f in re.findall(r'\(([^)]+)\)', text):
                result = match_team(f.strip())
                if result != "unknown":
                    team_name = result
                    break

        is_shot     = etype in SHOT_TYPES
        is_goal     = "Goal" in etype
        is_foul     = etype in PRESSING_TYPES
        is_corner   = etype in CORNER_TYPES

        events_rows.append({
            "event_id":   event_id,
            "date":       match_date,
            "home_team":  home_team,
            "away_team":  away_team,
            "minute":     minute,
            "display":    disp,
            "half":       1 if minute < 46 else 2,
            "event_type": etype,
            "team":       team_name,
            "is_shot":    int(is_shot),
            "is_goal":    int(is_goal),
            "is_foul":    int(is_foul),
            "is_corner":  int(is_corner),
            "text":       text[:150],
        })

    return events_rows, breaks_rows


def load_existing_ids(path: Path) -> set:
    if not path.exists():
        return set()
    with path.open() as f:
        reader = csv.DictReader(f)
        return {row["event_id"] for row in reader}


def load_break_counts(path: Path) -> dict:
    """Return {event_id: number_of_breaks_recorded}."""
    if not path.exists():
        return {}
    counts: dict = {}
    with path.open() as f:
        for row in csv.DictReader(f):
            eid = row["event_id"]
            counts[eid] = counts.get(eid, 0) + 1
    return counts


def remove_match_rows(path: Path, event_id: str, fieldnames: list) -> None:
    """Rewrite the CSV without any rows belonging to event_id."""
    if not path.exists():
        return
    with path.open() as f:
        rows = [r for r in csv.DictReader(f) if r["event_id"] != event_id]
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def main():
    Path("data").mkdir(exist_ok=True)
    events_path = Path("data/wc2026_events.csv")
    breaks_path = Path("data/wc2026_breaks.csv")

    event_fields = [
        "event_id","date","home_team","away_team","minute","display","half",
        "event_type","team","is_shot","is_goal","is_foul","is_corner","text",
    ]
    break_fields = [
        "event_id","date","home_team","away_team",
        "break_start","break_end","duration_s","display_start","display_end","half",
    ]

    existing     = load_existing_ids(events_path)
    break_counts = load_break_counts(breaks_path)

    # Matches that were fetched mid-game and have < 2 breaks need a re-fetch
    incomplete = {eid for eid in existing if break_counts.get(eid, 0) < 2}

    today = date.today()
    start = date(2026, 6, 11)
    print(f"Fetching match list {start} → {today}…")
    matches = get_match_ids(start, today)

    new_matches = [
        m for m in matches
        if (m["event_id"] not in existing or m["event_id"] in incomplete)
        and "SCHEDULED" not in m["status"]
    ]
    print(f"Known matches: {len(existing)}  Incomplete (< 2 breaks): {len(incomplete)}  "
          f"To fetch: {len(new_matches)}")

    all_events = []
    all_breaks = []

    for m in new_matches:
        mid = m["event_id"]
        label = f"{m['home_team']} vs {m['away_team']}"
        if mid in incomplete:
            print(f"  Re-fetching (incomplete) {label} ({mid})…", end=" ")
            remove_match_rows(events_path, mid, event_fields)
            remove_match_rows(breaks_path, mid, break_fields)
        else:
            print(f"  Fetching {label} ({mid})…", end=" ")
        try:
            evs, brs = parse_summary(
                mid, m["home_team"], m["away_team"],
                m["home_id"], m["away_id"], m["date"]
            )
            all_events.extend(evs)
            all_breaks.extend(brs)
            print(f"{len(evs)} events, {len(brs)} breaks")
        except Exception as e:
            print(f"FAIL: {e}")
        time.sleep(0.4)

    write_header = not events_path.exists()
    with events_path.open("a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=event_fields)
        if write_header:
            w.writeheader()
        w.writerows(all_events)

    write_header = not breaks_path.exists()
    with breaks_path.open("a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=break_fields)
        if write_header:
            w.writeheader()
        w.writerows(all_breaks)

    print(f"\nDone. Events appended: {len(all_events)}  Breaks appended: {len(all_breaks)}")
    print(f"Files: {events_path}  {breaks_path}")


if __name__ == "__main__":
    main()
