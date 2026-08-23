# AGENTS.md — Reelwright

Scene-bound shorts from a single line. Script, stills, voice, cut — in the browser.

Hermes discovers this file automatically (project context). Bot Mode profile: `.hermes/`.

## Hermes Bot

```bash
./scripts/install-hermes-bot.sh
hermes -p reelwright chat
```

Desktop: **Bots** tab. `@mention reelwright` from any chat. Routines appear in `hermes cron list` as `[bot:reelwright]`.

Project-local skills: `.hermes/skills/` (also copied into `~/.hermes/profiles/reelwright/skills/` on install).

## Stack

React 19 · TanStack Start / Router · Tailwind v4 · Zustand · Zod · Node 22.

Dev: `npm run dev`. Typecheck: `npm run typecheck`. Test: `npm test`. Build: `npm run build`.

## Hard rules

- Do not commit secrets (`XAI_API_KEY`, cookies, tokens).
- Peer-level voice. No sycophancy. UK English. Quality over speed.
- One clarifying question max. Prefer shipping the next concrete move.
- xAI writer, Imagine stills, TTS. Degrade cleanly without a key.
- Sample cut must play on first load.

## Layout

- src/ compositor, writer, recorder
- public/og.jpg

- `AGENTS.md` — this harness
- `.hermes/bot.yaml` — Bot Mode roster metadata
- `.hermes/SOUL.md` — bot identity (profile slot #1)
- `.hermes/skills/` — portable skills (agentskills.io)

## Memory

Durable personal facts live in the private repo `k3ss-memory`. Do not copy that ledger into this repo. Do not surface residential addresses or family-scam details in public outputs.
