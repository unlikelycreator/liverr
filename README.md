# Liverr

Write about your day in plain words. Liverr reads the entry and files everything into your logs: ledger, meals, movies & books, workouts, sleep & health, mood, people, places, activities and notes.

```
"Slept 7 hours. Lunch with Riya at Blue Tokai, paid ₹640. Watched Dune Part Two on Prime, 9/10. Ran 5 km in 27 min."
  → health · sleep 7h      → finance · −₹640 (food, Blue Tokai)   → food · lunch
  → social · Riya          → place · Blue Tokai                   → media · Dune Part Two ★9
  → exercise · run 5 km, 27 min
```

## Stack

| | |
|---|---|
| `frontend/` | React + Vite + Tailwind, deployed to **Netlify** |
| `backend/` | Node + Express + Mongoose (MongoDB), deployed to **Render** |
| Parsing | **Gemini** (`GEMINI_API_KEY`) with structured JSON output; falls back to a built-in offline rule parser if no key is set or the call fails |

## Run locally

```bash
cd backend && cp .env.example .env   # set MONGODB_URI (and optionally GEMINI_API_KEY, ACCESS_PASSCODE)
npm install && npm run dev            # http://localhost:4000
```

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxies /api to :4000)
```

Parser tests: `cd backend && npm test`.

## Deploy

**Backend → Render.** New → Blueprint → pick this repo. `render.yaml` creates the `liverr-api` web service. Fill in the env vars it asks for:

| Variable | |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string (allow `0.0.0.0/0` in Atlas network access) |
| `GEMINI_API_KEY` | Google AI Studio key. Optional: without it the offline parser is used |
| `ACCESS_PASSCODE` | The passcode for the login screen. Leave empty to disable login |
| `CORS_ORIGINS` | Your Netlify URL, e.g. `https://liverr.netlify.app` (empty = allow all) |

`JWT_SECRET` is generated automatically. `DEFAULT_CURRENCY` (INR) and `TIMEZONE` (Asia/Kolkata) can be changed.

**Frontend → Netlify.** Import the repo; `netlify.toml` sets base `frontend`, build `npm run build`, publish `dist`, SPA routing. Set `VITE_API_URL` to your Render URL (defaults to `https://liverr-api.onrender.com`) and redeploy.

Render's free plan sleeps after ~15 min idle; the app shows "Waking up the server…" and retries for up to a minute.

## API

All routes under `/api`, Bearer token from `POST /api/auth/login` when a passcode is set.

- `POST /entries` `{ text, date? }` → parse + save, returns `{ entry, records }`
- `POST /entries/preview` → parse without saving
- `GET /entries`, `GET|PUT|DELETE /entries/:id` (PUT re-runs extraction; manual edits are kept)
- `GET|POST /records`, `PATCH|DELETE /records/:id` (filters: `category, subtype, from, to, q, direction`)
- `GET /stats/overview?from&to`, `GET /stats/category/:category?from&to`
- `GET /health`
