# Marketing Agent — Need-Based Personalization Demo

A small demo of "personalize at scale" done through **needs, not identity labels**.

Given a customer's raw purchase history, a ReAct-style Claude agent separates
ambiguous single-item signals from convergent groups of items, infers concrete
needs from the convergent groups only, and proposes one focused Prime Day
campaign (headline, subheadline, product picks) **per need** — instead of
merging unrelated needs into one disjointed headline.

The agent is explicitly instructed to never output a demographic or
life-stage label (no "parent", "pet owner", "elderly", etc.). A single
product is compatible with too many identities to guess safely — needs are a
sharper, lower-risk signal than identity.

## What it shows

- **Two real purchase histories** (from actual Amazon order history
  screenshots), each with a hand-written "cached" agent trace matching the
  reasoning worked out by hand first, and a "live" mode that re-runs the same
  reasoning through Claude in real time.
- **A visible agent trace** — every `evaluate_signal` (ambiguous → discard vs.
  convergent → keep), `identify_need` (with the identity labels it
  considered and deliberately avoided), and `propose_campaign` call is
  rendered as a step in the UI, ReAct-style (thought → action → observation).
- **One theme per campaign.** If the agent finds multiple reliable needs, it
  proposes a separate single-theme campaign for each and ranks them by
  confidence. The highest-confidence one shows by default; a "Try another
  reliable angle" button cycles through the others — it never blends two
  needs into one headline.
- **Cached vs. live**, side by side. Cached mode shows a pre-computed trace
  (the batch-generate-then-serve pattern real personalization systems use in
  production). Live mode runs an actual multi-turn Claude tool-use loop
  against `/api/analyze` and shows real latency and real variance.

## Architecture

```
lib/purchaseHistories.ts   Two purchase histories + their cached agent traces/campaigns
app/api/analyze/route.ts   Live agent: multi-turn Claude tool-use loop
                            (evaluate_signal → identify_need → propose_campaign)
app/page.tsx                UI: history picker, cached/live toggle, trace panel,
                            hero + product cards, confidence-ranked campaign cycling
```

The live agent loop calls the Anthropic Messages API with three tools and
loops on tool_use until the model stops calling tools:

- `evaluate_signal` — judge one item (or tight item-group) as an ambiguous
  single-point signal to discard, or part of a convergent group to keep
- `identify_need` — declare one concrete need from a convergent group,
  explicitly logging which identity labels were considered and rejected
- `propose_campaign` — one campaign per confident need (never blended)

## Local development

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY to enable live mode
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app works without an
API key too — it just falls back to cached mode.

## Deploying on Railway

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub
   repo** → select this repo (authorize Railway's GitHub access if prompted).
2. Railway auto-detects this as a Next.js app via Nixpacks and runs
   `npm run build` / `npm run start` — no extra config needed.
3. Open the new service → **Variables** tab → add:
   - `ANTHROPIC_API_KEY` = your Anthropic API key
4. Wait for the build to finish (Deployments tab).
5. Service → **Settings** → **Networking** → **Generate Domain** to get a
   public `*.up.railway.app` URL.

That URL is shareable — cached mode works instantly, live mode calls Claude
per request using the API key you set in step 3.

## Tech stack

Next.js (App Router, TypeScript) · Tailwind CSS · `@anthropic-ai/sdk`
