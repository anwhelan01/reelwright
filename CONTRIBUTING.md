# Contributing

## Dev

```bash
cp .env.example .env   # XAI_API_KEY for Draft / Produce
npm install
npm run dev
```

The sample cut on the phone does not need a key. Use it to check the compositor without spending quota.

## Checks before a PR

```bash
npm run typecheck
npm test
npm run lint
```

## Conventions

- Tokens live in `src/styles.css` `@theme`. No ad-hoc hex in JSX.
- Server functions in `src/lib/generate.ts` are the only place that read `XAI_API_KEY`.
- Do not add auth or a database unless the feature is per-user and cross-device. High scores and recents stay in `localStorage`.
- Image and TTS calls must stay user-initiated. No generation on hydrate besides `checkAi`.
- Keep stills scene-bound. Do not wire a stock-footage search as the default shoot.

## Spend

A full 15s Produce is 1 chat + 1 TTS + 4 stills. Prefer Revoice / Reshoot over Produce when only one layer changed.
