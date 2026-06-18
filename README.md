# StressTest My Plan — prototype

A guided **scenario-planning** web app. It walks a user from a messy situation to a
practical action plan in six steps:

> Name it → Explore it → Combine it → Map it → Act on it → Revisit it.

The goal is always to move the user **from fear to agency** — they should leave thinking
"now I can see the board," not "everything could go wrong."

## Run it

No build step. Either:

```bash
python3 serve.py          # http://localhost:4180  (no-cache dev server)
```

…or open `index.html` directly, or deploy the folder to any static host (Vercel, Netlify,
GitHub Pages). It's pure HTML/CSS/JS.

## How it's built

| File | Role |
|------|------|
| `index.html` | Shell — loads fonts, `data.js`, `app.js`. The whole UI renders into `#app`. |
| `styles.css` | Design system. Calm/professional; scenario color-coding (green/amber/red/blue); print stylesheet for the PDF brief; responsive (table → cards on mobile). |
| `data.js` | **Knowledge base** (`window.STKB`): ~28 driving forces (why / triggers / warning signs / prevention / mitigation / opportunity / consequence chain), domain → relevant-forces + who-to-involve maps, sensitive-content safety map with real crisis resources, tone presets, and the worked example. |
| `app.js` | **`ENGINE`** (generation) + the wizard controller (state, routing, rendering, localStorage, export). |

### The generation engine (`ENGINE` in `app.js`)

Everything is generated **deterministically from `data.js`** — no API key, no cost, works
offline. The functions:

- `detectSensitive(text)` — flags self-harm / abuse / emergency language and surfaces help.
- `discoverForces(state)` — Step 1. Ranks driving forces by domain relevance + keyword match.
- `buildScenarios(state)` — Steps 2 & 3. Four bundles (Green/Yellow/Red/Blue) with narratives
  that interpolate the user's actual top forces, hope, and worry.
- `buildConsequenceMap(state)` — Step 4. Trigger → immediate → 2nd → 3rd → warning → prevention → opportunity.
- `buildActionPlan(state)` — Do now / Watch / Prepare / Avoid / Ask for help / Opportunity / Open questions.

### Upgrading to a real LLM (later)

`ENGINE.regenerate()` is the single seam. To use a model instead of the built-in templates,
make `buildScenarios` / `buildConsequenceMap` / `buildActionPlan` `async` and call a model
through a small serverless proxy (keys must **not** live in client code), feeding it the same
`state` + the `data.js` content as grounding. The UI already reads from `state.scenarios` etc.,
so nothing else changes.

### Upgrading to Supabase (later)

`localStorage` currently stands in for the backend (`stp_current_v1`, `stp_saved_v1`). The
spec's tables (`users`, `scenarios`, `driving_forces`, `scenario_bundles`, `consequence_maps`,
`action_plans`) map 1:1 to the in-memory `state` object — swap the save/load helpers for
Supabase calls.

## Safety

Every screen carries a disclaimer (planning/education only — not legal, medical, financial,
or psychological advice; not a crisis service). Sensitive language shifts tone and shows real
resources (988, Crisis Text Line, National DV Hotline, 911). The app never diagnoses, predicts
specific outcomes, or presents unlikely catastrophes as probable.

## Status

Prototype — all six screens, the four-step method, the safety guardrails, save/export, and a
one-page printable brief are working. Built-in engine; LLM + Supabase are documented upgrade paths.
