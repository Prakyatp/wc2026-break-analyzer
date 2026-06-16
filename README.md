# WC2026 Hydration Break Analyzer

Every FIFA World Cup 2026 match has two cooling/hydration breaks — one around the 23rd minute, one around the 68th. This project tracks whether those breaks affect team momentum by measuring attacking pressure before and after each break, across every WC2026 match.

**Live dashboard → [prakyatp.github.io/wc2026-break-analyzer](https://prakyatp.github.io/wc2026-break-analyzer)**

---

## Run it yourself

**Requirements:** Python 3.11+, Node 20+

### 1. Clone the repo

```bash
git clone https://github.com/Prakyatp/wc2026-break-analyzer
cd wc2026-break-analyzer
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Set up your API key

Create a `.env` file in the root directory:

```
GROQ_API_KEY=your_key_here
```

Get a free Groq API key at [console.groq.com](https://console.groq.com). It's used to generate the AI insight paragraphs on each chart.

### 4. Fetch match data

```bash
python3 build_dataset.py
```

This pulls all WC2026 matches played up to today and saves them locally. Safe to run multiple times — it skips matches already fetched.

### 5. Export dashboard data

```bash
python3 export_data.py
```

This reads the match data, computes the before/after metrics, and writes JSON files to `web/public/data/`.

### 6. Run the dashboard

```bash
cd web
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000) and explore the results yourself.

---

## Updating as the tournament progresses

Every time new matches finish, just run:

```bash
python3 build_dataset.py
python3 export_data.py
```

The script automatically re-fetches any match that was only partially captured (e.g. script ran mid-game with only one break detected).

If you fork the repo, the GitHub Actions workflow in `.github/workflows/update.yml` handles this automatically every day at 9 AM UTC. Add your `GROQ_API_KEY` under **Settings → Secrets → Actions** in your fork and it runs without any manual steps.

---

## Project structure

```
wc2026-break-analyzer/
├── build_dataset.py        # fetches ESPN data, detects break timestamps
├── export_data.py          # computes metrics, writes dashboard JSON
├── requirements.txt
├── data/
│   ├── wc2026_events.csv   # all match events (goals, shots, corners...)
│   └── wc2026_breaks.csv   # detected breaks + pre/post pressure stats
└── web/                    # Next.js dashboard
    ├── src/app/            # Overview, Match, and Team pages
    ├── src/components/     # shared UI components
    └── public/data/        # pre-generated JSON loaded by the dashboard
```

---

Built by [Prakyat Prakash](https://github.com/Prakyatp) during FIFA World Cup 2026.
